import type {
  Fundamentals,
  MarketRegime,
  StrategySelectionInput,
  StrategySelectionResult,
  StrategyType,
  TrendMetrics
} from "@/src/lib/types";
import { deriveRegime } from "@/src/lib/scoring/trend";

// types are re-exported in src/lib/types/strategy.ts

const isHoldable = (fundamentals: Fundamentals | null) => {
  if (!fundamentals) return false;
  if (fundamentals.marketCap !== null && fundamentals.marketCap < 5_000_000_000) return false;
  if (fundamentals.debtToEquity !== null && fundamentals.debtToEquity > 2.5) return false;
  if (fundamentals.currentRatio !== null && fundamentals.currentRatio < 1) return false;
  return true;
};

export const selectStrategies = (
  input: StrategySelectionInput
): StrategySelectionResult => {
  const marketRegime = deriveRegime(input.marketTrend);
  const stockRegime = deriveRegime(input.stockTrend);
  const assignmentEligible = isHoldable(input.fundamentals);

  const biasDefinedRisk = input.preferDefinedRisk ?? !assignmentEligible;

  const bullishOrNeutral = marketRegime !== "BEAR" && stockRegime !== "BEAR";
  const neutralOrBearish = marketRegime !== "BULL" || stockRegime !== "BULL";

  const strategies = new Set<StrategyType>();

  if (bullishOrNeutral) {
    strategies.add("PCS");
    if (!biasDefinedRisk) {
      strategies.add("CSP");
    }
  }

  if (neutralOrBearish) {
    strategies.add("CCS");
    if (!biasDefinedRisk) {
      strategies.add("CC");
    }
  }

  return {
    strategies: Array.from(strategies),
    marketRegime,
    stockRegime,
    assignmentEligible
  };
};
