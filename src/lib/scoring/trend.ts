import type { RiskFlag } from "@/src/lib/types";
import type { MarketRegime, TrendMetrics } from "@/src/lib/types/trend";

export type TrendScoreConfig = {
  dmaAlignWeight: number;
  distanceWeight: number;
  conflictPenalty: number;
};

export type TrendScoreOutput = {
  score: number;
  regime: MarketRegime;
  riskFlags: RiskFlag[];
};

const DEFAULT_CONFIG: TrendScoreConfig = {
  dmaAlignWeight: 0.6,
  distanceWeight: 0.4,
  conflictPenalty: 0.2
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export const deriveRegime = (metrics: TrendMetrics): MarketRegime => {
  if (metrics.price > metrics.dma200 * 1.03) return "BULL";
  if (metrics.price < metrics.dma200 * 0.97) return "BEAR";
  return "NEUTRAL";
};

const dmaAlignmentScore = (metrics: TrendMetrics) => {
  let score = 0;
  if (metrics.dma50 >= metrics.dma100) score += 0.5;
  if (metrics.dma100 >= metrics.dma200) score += 0.5;
  return score;
};

const distanceScore = (distancePct: number) => {
  if (distancePct >= 15) return 1;
  if (distancePct >= 5) return 0.7;
  if (distancePct >= -5) return 0.5;
  if (distancePct >= -15) return 0.3;
  return 0.1;
};

export const scoreTrendSafety = (
  metrics: TrendMetrics,
  marketRegime: MarketRegime,
  config: TrendScoreConfig = DEFAULT_CONFIG
): TrendScoreOutput => {
  const stockRegime = deriveRegime(metrics);
  const alignmentScore = dmaAlignmentScore(metrics);
  const distance = metrics.distanceFrom200DmaPct;
  const distanceComponent = distanceScore(distance);

  const combined = clamp(
    alignmentScore * config.dmaAlignWeight + distanceComponent * config.distanceWeight
  );

  const riskFlags: RiskFlag[] = [];
  let score = combined;

  if (stockRegime !== marketRegime) {
    riskFlags.push("RISK_TREND_CONFLICT");
    score = clamp(score - config.conflictPenalty);
  }

  return {
    score,
    regime: stockRegime,
    riskFlags
  };
};
