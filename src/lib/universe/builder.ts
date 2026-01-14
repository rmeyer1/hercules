import { AlpacaClient } from "@/src/lib/providers/alpaca";
import { FmpClient } from "@/src/lib/providers/fmp";
import type {
  RecommendationProfile,
  UniverseBuildConfig,
  UniverseBuildRequest,
  UniverseReason,
  UniverseResult,
  UniverseTickerDecision
} from "@/src/lib/types";

const DEFAULT_MEME_TICKERS = [
  "AMC",
  "GME",
  "BBBY",
  "BB",
  "KOSS",
  "NOK",
  "SNDL",
  "CLOV",
  "SPCE",
  "CVNA",
  "RIVN",
  "HOOD",
  "NKLA"
];

const DEFAULT_CONFIG: UniverseBuildConfig = {
  minAvgDailyVolume: 1_000_000,
  minOptionsOpenInterest: 500,
  minOptionsVolume: 500,
  allowUnknownOptionsLiquidity: true,
  useOptionsSnapshot: false,
  allowUnknownProfile: false,
  memeTickers: DEFAULT_MEME_TICKERS
};

const normalizeTicker = (ticker: string) => ticker.trim().toUpperCase();

const isValidTicker = (ticker: string) => /^[A-Z0-9.\-]{1,8}$/.test(ticker);

const createReason = (
  code: UniverseReason["code"],
  message: string,
  severity: UniverseReason["severity"]
): UniverseReason => ({
  code,
  message,
  severity
});

const isUsListing = (country: string | null) => {
  if (!country) return false;
  const normalized = country.toLowerCase();
  return normalized === "us" || normalized === "usa" || normalized === "united states";
};

const detectAdr = (isAdr: boolean | null, currency: string | null, exchange: string | null) => {
  if (isAdr === true) return true;
  if (currency && currency.toUpperCase() !== "USD") return true;
  if (exchange && exchange.toUpperCase().includes("OTC")) return true;
  return false;
};

const resolveRecommendationProfile = (profile?: RecommendationProfile): RecommendationProfile => {
  return profile ?? "SP500";
};

const getRecommendedTickers = async (
  profile: RecommendationProfile,
  fmpClient: FmpClient
): Promise<string[]> => {
  if (profile === "NASDAQ") {
    const nasdaq = await fmpClient.getNasdaqConstituents();
    return nasdaq.map((item) => item.symbol);
  }
  const sp500 = await fmpClient.getSp500Constituents();
  return sp500.map((item) => item.symbol);
};

export const buildUniverse = async (request: UniverseBuildRequest): Promise<UniverseResult> => {
  const config: UniverseBuildConfig = {
    ...DEFAULT_CONFIG,
    ...(request.config ?? {}),
    memeTickers: request.config?.memeTickers ?? DEFAULT_CONFIG.memeTickers
  };

  let fmpClient: FmpClient | null = null;
  try {
    fmpClient = new FmpClient();
  } catch {
    fmpClient = null;
  }

  let sourceTickers: string[] = [];
  if (request.source === "RECOMMENDED") {
    if (!fmpClient) {
      throw new Error("FMP API key is required for recommended universe.");
    }
    const profile = resolveRecommendationProfile(request.recommendationProfile);
    const recommended = await getRecommendedTickers(profile, fmpClient);
    sourceTickers = [...recommended, ...(request.tickers ?? [])];
  } else {
    sourceTickers = request.tickers ?? [];
  }

  const normalizedTickers = Array.from(new Set(sourceTickers.map(normalizeTicker))).sort();
  let alpacaClient: AlpacaClient | null = null;

  if (config.useOptionsSnapshot) {
    try {
      alpacaClient = new AlpacaClient();
    } catch {
      alpacaClient = null;
    }
  }

  const included: UniverseTickerDecision[] = [];
  const excluded: UniverseTickerDecision[] = [];

  for (const ticker of normalizedTickers) {
    const reasons: UniverseReason[] = [];

    if (!isValidTicker(ticker)) {
      reasons.push(createReason("INVALID_TICKER", "Ticker format is invalid.", "EXCLUDE"));
    }

    const isMeme = config.memeTickers.includes(ticker);
    if (isMeme) {
      reasons.push(createReason("MEME_RISK", "Ticker is flagged as meme-risk.", "EXCLUDE"));
    }

    let profile = null;
    let quote = null;

    if (fmpClient) {
      try {
        profile = await fmpClient.getCompanyProfile(ticker);
        quote = await fmpClient.getQuoteSnapshot(ticker);
      } catch {
        profile = null;
        quote = null;
      }
    }

    if (!profile && !config.allowUnknownProfile) {
      reasons.push(createReason("UNKNOWN_PROFILE", "Company profile unavailable.", "EXCLUDE"));
    }

    const country = profile?.country ?? null;
    const exchange = profile?.exchangeShortName ?? profile?.exchange ?? null;
    const currency = profile?.currency ?? null;
    const companyName = profile?.companyName ?? null;

    if (profile && !isUsListing(country)) {
      reasons.push(
        createReason("NON_US_LISTING", `Non-US listing detected (${country ?? "unknown"}).`, "EXCLUDE")
      );
    }

    if (profile && detectAdr(profile.isAdr, currency, exchange)) {
      reasons.push(
        createReason("ADR_OR_INTL", "ADR or international listing detected.", "EXCLUDE")
      );
    }

    const avgVolume = quote?.avgVolume ?? null;
    if (avgVolume !== null && avgVolume < config.minAvgDailyVolume) {
      reasons.push(
        createReason(
          "LOW_AVG_VOLUME",
          `Average volume below threshold (${avgVolume}).`,
          "EXCLUDE"
        )
      );
    }

    let optionsOpenInterest: number | null = null;
    let optionsVolume: number | null = null;
    let optionsStatus: "KNOWN" | "UNKNOWN" = "UNKNOWN";

    if (config.useOptionsSnapshot && alpacaClient) {
      try {
        const snapshot = await alpacaClient.getOptionChainSnapshot(ticker);
        optionsOpenInterest = snapshot.contracts.reduce((sum, contract) => sum + contract.openInterest, 0);
        optionsVolume = snapshot.contracts.reduce((sum, contract) => sum + contract.volume, 0);
        optionsStatus = "KNOWN";

        if (optionsOpenInterest < config.minOptionsOpenInterest || optionsVolume < config.minOptionsVolume) {
          reasons.push(
            createReason(
              "LOW_OPTIONS_LIQUIDITY",
              "Options liquidity below threshold.",
              "EXCLUDE"
            )
          );
        }
      } catch {
        optionsStatus = "UNKNOWN";
      }
    }

    if (optionsStatus === "UNKNOWN" && !config.allowUnknownOptionsLiquidity) {
      reasons.push(
        createReason(
          "UNKNOWN_OPTIONS_LIQUIDITY",
          "Options liquidity data unavailable.",
          "EXCLUDE"
        )
      );
    }

    const decision: UniverseTickerDecision = {
      ticker,
      normalizedTicker: ticker,
      reasons,
      metadata: {
        country,
        exchange,
        currency,
        companyName,
        liquidity: {
          avgDailyVolume: avgVolume,
          optionsOpenInterest,
          optionsVolume,
          optionsLiquidityStatus: optionsStatus
        }
      }
    };

    const isExcluded = reasons.some((reason) => reason.severity === "EXCLUDE");
    if (isExcluded) {
      excluded.push(decision);
    } else {
      included.push(decision);
    }
  }

  return { included, excluded };
};
