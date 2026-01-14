export type UniverseSource = "MANUAL" | "RECOMMENDED";

export type RecommendationProfile = "SP500" | "NASDAQ";

export type UniverseReasonCode =
  | "INVALID_TICKER"
  | "NON_US_LISTING"
  | "ADR_OR_INTL"
  | "MEME_RISK"
  | "LOW_AVG_VOLUME"
  | "LOW_OPTIONS_LIQUIDITY"
  | "UNKNOWN_OPTIONS_LIQUIDITY"
  | "UNKNOWN_PROFILE";

export type UniverseReasonSeverity = "EXCLUDE" | "WARN";

export type UniverseReason = {
  code: UniverseReasonCode;
  message: string;
  severity: UniverseReasonSeverity;
};

export type UniverseLiquidity = {
  avgDailyVolume: number | null;
  optionsOpenInterest: number | null;
  optionsVolume: number | null;
  optionsLiquidityStatus: "KNOWN" | "UNKNOWN";
};

export type UniverseTickerDecision = {
  ticker: string;
  normalizedTicker: string;
  reasons: UniverseReason[];
  metadata: {
    country: string | null;
    exchange: string | null;
    currency: string | null;
    companyName: string | null;
    liquidity: UniverseLiquidity;
  };
};

export type UniverseBuildConfig = {
  minAvgDailyVolume: number;
  minOptionsOpenInterest: number;
  minOptionsVolume: number;
  allowUnknownOptionsLiquidity: boolean;
  useOptionsSnapshot: boolean;
  allowUnknownProfile: boolean;
  memeTickers: string[];
};

export type UniverseBuildRequest = {
  source: UniverseSource;
  tickers?: string[];
  recommendationProfile?: RecommendationProfile;
  config?: Partial<UniverseBuildConfig>;
};

export type UniverseResult = {
  included: UniverseTickerDecision[];
  excluded: UniverseTickerDecision[];
};
