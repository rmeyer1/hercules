import type { CalendarSnapshot, EarningsInfo, MacroEvent, MacroEventType } from "@/src/lib/types";

const DEFAULT_BASE_URL = "https://financialmodelingprep.com";
const MACRO_HORIZON_DAYS = 14;

type CalendarClientOptions = {
  apiKey?: string;
  baseUrl?: string;
};

const buildQuery = (query: Record<string, string | number | boolean | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) return;
    params.append(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatDate = (value: Date) => value.toISOString().slice(0, 10);

const diffInDays = (from: Date, to: Date) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((to.getTime() - from.getTime()) / msPerDay);
};

export class CalendarProvider {
  private apiKey: string | null;
  private baseUrl: string;

  constructor(options: CalendarClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.FMP_API_KEY ?? null;
    this.baseUrl = options.baseUrl ?? process.env.FMP_BASE_URL ?? DEFAULT_BASE_URL;
  }

  private async request<T>(path: string, query: Record<string, string | number | boolean>) {
    if (!this.apiKey) {
      return null;
    }

    const url = `${this.baseUrl}${path}${buildQuery({ ...query, apikey: this.apiKey })}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  }

  private mapMacroEventType(label: string): MacroEventType | null {
    const normalized = label.toLowerCase();
    if (normalized.includes("cpi") || normalized.includes("consumer price")) {
      return "CPI";
    }
    if (
      normalized.includes("fomc") ||
      normalized.includes("federal open market committee") ||
      normalized.includes("federal funds") ||
      normalized.includes("fed rate")
    ) {
      return "FOMC";
    }
    return null;
  }

  private async getUpcomingMacroEvents(
    now: Date,
    horizonDays = MACRO_HORIZON_DAYS
  ): Promise<MacroEvent[]> {
    if (!this.apiKey) {
      return [];
    }

    const toDate = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
    const payload = await this.request<Array<Record<string, unknown>>>(
      `/api/v3/economic_calendar`,
      { from: formatDate(now), to: formatDate(toDate) }
    );

    if (!payload || payload.length === 0) {
      return [];
    }

    return payload
      .map((row) => {
        const label =
          (row.event as string | undefined) ??
          (row.name as string | undefined) ??
          (row.title as string | undefined);
        if (!label) return null;

        const type = this.mapMacroEventType(label);
        if (!type) return null;

        const date =
          (row.date as string | undefined) ??
          (row.eventDate as string | undefined) ??
          (row.dateTime as string | undefined);
        const eventDate = parseDate(date);
        if (!eventDate) return null;

        const delta = diffInDays(now, eventDate);
        if (delta < 0 || delta > horizonDays) return null;

        return {
          type,
          date: formatDate(eventDate),
          label
        } satisfies MacroEvent;
      })
      .filter((event): event is MacroEvent => Boolean(event));
  }

  private async getEarningsInfo(symbol: string, now: Date): Promise<EarningsInfo> {
    const from = formatDate(now);
    const to = formatDate(new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()));

    const payload = await this.request<Array<Record<string, unknown>>>(
      `/api/v3/earning_calendar`,
      { symbol, from, to }
    );

    if (!payload || payload.length === 0) {
      return { earningsDate: null, daysToEarnings: null };
    }

    const nextEarnings = payload
      .map((row) => parseDate(row.date as string | undefined))
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime())
      .find((date) => date.getTime() >= now.getTime());

    if (!nextEarnings) {
      return { earningsDate: null, daysToEarnings: null };
    }

    return {
      earningsDate: formatDate(nextEarnings),
      daysToEarnings: diffInDays(now, nextEarnings)
    };
  }

  async getCalendarSnapshot(symbol: string): Promise<CalendarSnapshot> {
    const now = new Date();
    const earnings = await this.getEarningsInfo(symbol.toUpperCase(), now);
    const macroEvents = await this.getUpcomingMacroEvents(now);

    return {
      symbol: symbol.toUpperCase(),
      earnings,
      macroEvents
    };
  }
}
