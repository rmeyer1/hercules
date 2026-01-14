import type { OptionChainSnapshot, OptionContract, StockQuote, StockTrade } from "@/src/lib/types";
import { withCache } from "@/src/lib/cache/memory";

const DEFAULT_DATA_BASE_URL = "https://data.alpaca.markets";
const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 250;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type AlpacaClientOptions = {
  apiKey?: string;
  apiSecret?: string;
  dataBaseUrl?: string;
  maxRetries?: number;
};

type AlpacaRequestOptions = {
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
};

const buildQuery = (query: AlpacaRequestOptions["query"]) => {
  if (!query) return "";
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) return;
    params.append(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

const parseDateString = (value?: string | null) => {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const parseOptionSymbol = (symbol: string) => {
  const match = /^(?<root>[A-Z]{1,6})(?<ymd>\d{6})(?<cp>[CP])(?<strike>\d{8})$/.exec(
    symbol
  );
  if (!match?.groups) {
    return {
      underlying: symbol.slice(0, 6).trim(),
      expiration: "",
      side: "call" as const,
      strike: 0
    };
  }
  const { root, ymd, cp, strike } = match.groups;
  const year = `20${ymd.slice(0, 2)}`;
  const month = ymd.slice(2, 4);
  const day = ymd.slice(4, 6);
  return {
    underlying: root,
    expiration: `${year}-${month}-${day}`,
    side: cp === "P" ? ("put" as const) : ("call" as const),
    strike: Number(strike) / 1000
  };
};

const coerceNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
};

const coerceNullableNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
};

export class AlpacaClient {
  private apiKey: string;
  private apiSecret: string;
  private dataBaseUrl: string;
  private maxRetries: number;

  constructor(options: AlpacaClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.ALPACA_API_KEY ?? "";
    this.apiSecret = options.apiSecret ?? process.env.ALPACA_API_SECRET ?? "";
    this.dataBaseUrl = options.dataBaseUrl ?? process.env.ALPACA_DATA_URL ?? DEFAULT_DATA_BASE_URL;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

    if (!this.apiKey || !this.apiSecret) {
      throw new Error("Alpaca API credentials are required.");
    }
  }

  private async request<T>({ path, query }: AlpacaRequestOptions): Promise<T> {
    const url = `${this.dataBaseUrl}${path}${buildQuery(query)}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await fetch(url, {
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.apiSecret,
          Accept: "application/json"
        }
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      const retryAfter = response.headers.get("retry-after");
      const shouldRetry = response.status === 429 || response.status >= 500 || response.status === 408;

      if (!shouldRetry || attempt === this.maxRetries) {
        const errorBody = await response.text();
        throw new Error(`Alpaca API error (${response.status}): ${errorBody}`);
      }

      const retryDelay = retryAfter ? Number(retryAfter) * 1000 : BASE_DELAY_MS * 2 ** attempt;
      const jitter = Math.round(Math.random() * 100);
      await sleep(retryDelay + jitter);
    }

    throw new Error("Alpaca API request failed after retries.");
  }

  async getLatestQuote(symbol: string, feed: "iex" | "sip" = "iex"): Promise<StockQuote> {
    const payload = await this.request<{ quote: Record<string, unknown> }>({
      path: `/v2/stocks/${symbol}/quotes/latest`,
      query: { feed }
    });

    const quote = payload.quote ?? {};
    return {
      symbol,
      bidPrice: coerceNumber(quote.bp),
      askPrice: coerceNumber(quote.ap),
      bidSize: coerceNumber(quote.bs),
      askSize: coerceNumber(quote.as),
      timestamp: parseDateString(quote.t as string | undefined)
    };
  }

  async getLatestTrade(symbol: string, feed: "iex" | "sip" = "iex"): Promise<StockTrade> {
    const payload = await this.request<{ trade: Record<string, unknown> }>({
      path: `/v2/stocks/${symbol}/trades/latest`,
      query: { feed }
    });

    const trade = payload.trade ?? {};
    return {
      symbol,
      price: coerceNumber(trade.p),
      size: coerceNumber(trade.s),
      timestamp: parseDateString(trade.t as string | undefined)
    };
  }

  async getOptionChainSnapshot(
    underlying: string,
    feed: "indicative" | "opra" = "indicative",
    pageToken?: string
  ): Promise<OptionChainSnapshot> {
    const safeUnderlying = underlying.toUpperCase();
    const cacheKey = `options:${safeUnderlying}:${feed}:${pageToken ?? "first"}`;
    const ttlMs = 10 * 60 * 1000;

    return withCache(cacheKey, ttlMs, async () => {
      const payload = await this.request<{
        snapshots?: Record<string, Record<string, unknown>>;
        next_page_token?: string;
      }>({
        path: `/v1beta1/options/snapshots/${safeUnderlying}`,
        query: { feed, page_token: pageToken }
      });

      const snapshots = payload.snapshots ?? {};
      const contracts: OptionContract[] = Object.entries(snapshots).map(([symbol, data]) => {
        const typedData = data ?? {};
        const latestQuote = (typedData.latestQuote ?? typedData.latest_quote ?? {}) as Record<
          string,
          unknown
        >;
        const latestTrade = (typedData.latestTrade ?? typedData.latest_trade ?? {}) as Record<
          string,
          unknown
        >;
        const greeks = (typedData.greeks ?? {}) as Record<string, unknown>;
        const parsedSymbol = parseOptionSymbol(symbol);

        const meta = {
          underlying:
            typeof typedData.root_symbol === "string"
              ? typedData.root_symbol
              : parsedSymbol.underlying,
          expiration:
            (typedData.expiration_date as string | undefined) ?? parsedSymbol.expiration,
          side:
            (typedData.type as string | undefined) === "put"
              ? "put"
              : (typedData.type as string | undefined) === "call"
                ? "call"
                : parsedSymbol.side,
          strike:
            typeof typedData.strike_price === "number"
              ? typedData.strike_price
              : parsedSymbol.strike
        };

        return {
          symbol,
          underlying: meta.underlying,
          side: meta.side,
          expiration: meta.expiration,
          strike: meta.strike,
          bid: coerceNumber(latestQuote.bp),
          ask: coerceNumber(latestQuote.ap),
          last: coerceNullableNumber(latestTrade.p),
          openInterest: coerceNumber(typedData.open_interest ?? typedData.openInterest),
          volume: coerceNumber(typedData.volume),
          impliedVol: coerceNumber(typedData.impliedVolatility ?? typedData.implied_volatility),
          delta: coerceNullableNumber(greeks.delta),
          theta: coerceNullableNumber(greeks.theta)
        };
      });

      const latestTimestamp = Object.values(snapshots)
        .map((data) => {
          const typedData = data ?? {};
          const latestQuote = (typedData.latestQuote ?? typedData.latest_quote ?? {}) as Record<
            string,
            unknown
          >;
          const latestTrade = (typedData.latestTrade ?? typedData.latest_trade ?? {}) as Record<
            string,
            unknown
          >;
          return (latestQuote.t as string | undefined) ?? (latestTrade.t as string | undefined);
        })
        .find(Boolean);

      return {
        underlying: safeUnderlying,
        asOf: parseDateString(latestTimestamp ?? null),
        contracts
      };
    });
  }
}
