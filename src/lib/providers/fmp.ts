import type { Fundamentals } from "@/src/lib/types";
import { withCache } from "@/src/lib/cache/memory";

const DEFAULT_BASE_URL = "https://financialmodelingprep.com";

type FmpClientOptions = {
  apiKey?: string;
  baseUrl?: string;
};

type FmpRequestOptions = {
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
};

const buildQuery = (query: FmpRequestOptions["query"]) => {
  if (!query) return "";
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) return;
    params.append(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
};

const coerceString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return null;
};

export class FmpClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: FmpClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.FMP_API_KEY ?? "";
    this.baseUrl = options.baseUrl ?? process.env.FMP_BASE_URL ?? DEFAULT_BASE_URL;

    if (!this.apiKey) {
      throw new Error("FMP API key is required.");
    }
  }

  private async request<T>({ path, query }: FmpRequestOptions): Promise<T> {
    const url = `${this.baseUrl}${path}${buildQuery({ ...query, apikey: this.apiKey })}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`FMP API error (${response.status}): ${errorBody}`);
    }

    return (await response.json()) as T;
  }

  async getFundamentals(symbol: string): Promise<Fundamentals> {
    const safeSymbol = symbol.toUpperCase();
    const cacheKey = `fundamentals:${safeSymbol}`;
    const ttlMs = 12 * 60 * 60 * 1000;

    return withCache(cacheKey, ttlMs, async () => {
      const [profile, keyMetrics, ratios] = await Promise.all([
        this.request<Array<Record<string, unknown>>>({
          path: `/api/v3/profile/${safeSymbol}`
        }).catch(() => []),
        this.request<Array<Record<string, unknown>>>({
          path: `/api/v3/key-metrics-ttm/${safeSymbol}`
        }).catch(() => []),
        this.request<Array<Record<string, unknown>>>({
          path: `/api/v3/ratios-ttm/${safeSymbol}`
        }).catch(() => [])
      ]);

      const profileRow = profile[0] ?? {};
      const metricsRow = keyMetrics[0] ?? {};
      const ratiosRow = ratios[0] ?? {};

      return {
        symbol: safeSymbol,
        companyName: coerceString(profileRow.companyName),
        marketCap: coerceNumber(profileRow.mktCap ?? profileRow.marketCap),
        sector: coerceString(profileRow.sector),
        industry: coerceString(profileRow.industry),
        beta: coerceNumber(profileRow.beta),
        peRatio: coerceNumber(profileRow.pe ?? profileRow.peRatio),
        epsTtm: coerceNumber(profileRow.eps ?? profileRow.epsTTM),
        grossMargin: coerceNumber(ratiosRow.grossProfitMarginTTM),
        operatingMargin: coerceNumber(ratiosRow.operatingProfitMarginTTM),
        netMargin: coerceNumber(ratiosRow.netProfitMarginTTM),
        returnOnEquity: coerceNumber(metricsRow.roeTTM ?? ratiosRow.returnOnEquityTTM),
        returnOnAssets: coerceNumber(metricsRow.roaTTM ?? ratiosRow.returnOnAssetsTTM),
        debtToEquity: coerceNumber(metricsRow.debtToEquityTTM ?? ratiosRow.debtEquityRatioTTM),
        currentRatio: coerceNumber(metricsRow.currentRatioTTM ?? ratiosRow.currentRatioTTM),
        quickRatio: coerceNumber(metricsRow.quickRatioTTM ?? ratiosRow.quickRatioTTM),
        totalDebt: coerceNumber(metricsRow.totalDebtTTM ?? metricsRow.totalDebt),
        totalCash: coerceNumber(
          metricsRow.cashAndCashEquivalentsTTM ?? metricsRow.cashAndCashEquivalents
        ),
        revenueTtm: coerceNumber(metricsRow.revenueTTM ?? metricsRow.revenuePerShareTTM),
        freeCashFlowTtm: coerceNumber(
          metricsRow.freeCashFlowTTM ?? metricsRow.freeCashFlowPerShareTTM
        )
      };
    });
  }
}
