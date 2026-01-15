import type { Fundamentals, MarketRegime, TrendMetrics } from "@/src/lib/types";

export type StrategyType = "CSP" | "PCS" | "CCS" | "CC";

export type OptionSide = "put" | "call";

export type StrategySelectionInput = {
  marketTrend: TrendMetrics;
  stockTrend: TrendMetrics;
  fundamentals: Fundamentals | null;
  preferDefinedRisk?: boolean;
};

export type StrategySelectionResult = {
  strategies: StrategyType[];
  marketRegime: MarketRegime;
  stockRegime: MarketRegime;
  assignmentEligible: boolean;
};
