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

export type CompanyProfile = {
  symbol: string;
  companyName: string | null;
  country: string | null;
  exchange: string | null;
  exchangeShortName: string | null;
  currency: string | null;
  isAdr: boolean | null;
  marketCap: number | null;
};

export type QuoteSnapshot = {
  symbol: string;
  price: number | null;
  volume: number | null;
  avgVolume: number | null;
};

type IndexConstituent = {
  symbol: string;
  name: string | null;
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

  async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
    const safeSymbol = symbol.toUpperCase();
    const cacheKey = `profile:${safeSymbol}`;
    const ttlMs = 12 * 60 * 60 * 1000;

    return withCache(cacheKey, ttlMs, async () => {
      const payload = await this.request<Array<Record<string, unknown>>>({
        path: `/api/v3/profile/${safeSymbol}`
      }).catch(() => []);

      const profile = payload[0] ?? {};

      return {
        symbol: safeSymbol,
        companyName: coerceString(profile.companyName),
        country: coerceString(profile.country),
        exchange: coerceString(profile.exchange),
        exchangeShortName: coerceString(profile.exchangeShortName),
        currency: coerceString(profile.currency),
        isAdr: typeof profile.isAdr === "boolean" ? profile.isAdr : null,
        marketCap: coerceNumber(profile.mktCap ?? profile.marketCap)
      };
    });
  }

  async getQuoteSnapshot(symbol: string): Promise<QuoteSnapshot> {
    const safeSymbol = symbol.toUpperCase();
    const cacheKey = `quote:${safeSymbol}`;
    const ttlMs = 6 * 60 * 60 * 1000;

    return withCache(cacheKey, ttlMs, async () => {
      const payload = await this.request<Array<Record<string, unknown>>>({
        path: `/api/v3/quote/${safeSymbol}`
      }).catch(() => []);

      const quote = payload[0] ?? {};

      return {
        symbol: safeSymbol,
        price: coerceNumber(quote.price),
        volume: coerceNumber(quote.volume),
        avgVolume: coerceNumber(quote.avgVolume ?? quote.avgVolume10 ?? quote.avgVolume30)
      };
    });
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

  async getSp500Constituents(): Promise<IndexConstituent[]> {
    const cacheKey = "index:sp500";
    const ttlMs = 12 * 60 * 60 * 1000;

    return withCache(cacheKey, ttlMs, async () => {
      const payload = await this.request<Array<Record<string, unknown>>>({
        path: "/api/v3/sp500_constituent"
      }).catch(() => []);

      return payload
        .map((row) => {
          const symbol = coerceString(row.symbol);
          if (!symbol) return null;
          return {
            symbol,
            name: coerceString(row.name)
          };
        })
        .filter((row): row is IndexConstituent => Boolean(row));
    });
  }

  async getNasdaqConstituents(): Promise<IndexConstituent[]> {
    const cacheKey = "index:nasdaq";
    const ttlMs = 12 * 60 * 60 * 1000;

    return withCache(cacheKey, ttlMs, async () => {
      const payload = await this.request<Array<Record<string, unknown>>>({
        path: "/api/v3/nasdaq_constituent"
      }).catch(() => []);

      return payload
        .map((row) => {
          const symbol = coerceString(row.symbol);
          if (!symbol) return null;
          return {
            symbol,
            name: coerceString(row.name)
          };
        })
        .filter((row): row is IndexConstituent => Boolean(row));
    });
  }
}
