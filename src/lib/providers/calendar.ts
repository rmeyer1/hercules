import type { CalendarSnapshot, EarningsInfo, MacroEvent } from "@/src/lib/types";

const DEFAULT_BASE_URL = "https://financialmodelingprep.com";
const MACRO_HORIZON_DAYS = 14;

const STATIC_MACRO_EVENTS: MacroEvent[] = [
  { type: "CPI", date: "2026-01-15", label: "CPI Release" },
  { type: "FOMC", date: "2026-01-28", label: "FOMC Rate Decision" }
];

type CalendarClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  macroEvents?: MacroEvent[];
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
  private macroEvents: MacroEvent[];

  constructor(options: CalendarClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.FMP_API_KEY ?? null;
    this.baseUrl = options.baseUrl ?? process.env.FMP_BASE_URL ?? DEFAULT_BASE_URL;
    this.macroEvents = options.macroEvents ?? STATIC_MACRO_EVENTS;
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

  private getUpcomingMacroEvents(now: Date, horizonDays = MACRO_HORIZON_DAYS) {
    return this.macroEvents.filter((event) => {
      const eventDate = parseDate(event.date);
      if (!eventDate) return false;
      const delta = diffInDays(now, eventDate);
      return delta >= 0 && delta <= horizonDays;
    });
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
    const macroEvents = this.getUpcomingMacroEvents(now);

    return {
      symbol: symbol.toUpperCase(),
      earnings,
      macroEvents
    };
  }
}
