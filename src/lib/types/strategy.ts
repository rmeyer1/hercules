import type { Fundamentals, MarketRegime, StrategyType, TrendMetrics } from "@/src/lib/types";

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
