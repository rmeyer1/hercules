import type { RiskFlag } from "@/src/lib/types";
import type { VolatilityMetrics } from "@/src/lib/types";

export type VolatilityScoreConfig = {
  minIv: number;
  penalizeLowIv: boolean;
  ivSpikeThreshold: number;
  ivCrushThreshold: number;
};

export type VolatilityScoreResult = {
  scoreMultiplier: number;
  riskFlags: RiskFlag[];
  metrics: VolatilityMetrics;
};

const DEFAULT_CONFIG: VolatilityScoreConfig = {
  minIv: 0.3,
  penalizeLowIv: true,
  ivSpikeThreshold: 0.2,
  ivCrushThreshold: -0.15
};

const classifyRegime = (changeRate: number | null): VolatilityMetrics["ivRegime"] => {
  if (changeRate === null) return "UNKNOWN";
  if (changeRate >= 0.2) return "EXPANDING";
  if (changeRate <= -0.15) return "CRUSHED";
  return "STABLE";
};

export const scoreVolatilityQuality = (
  iv: number | null,
  ivChangeRate: number | null,
  config: VolatilityScoreConfig = DEFAULT_CONFIG
): VolatilityScoreResult => {
  const riskFlags: RiskFlag[] = [];
  const regime = classifyRegime(ivChangeRate);

  let scoreMultiplier = 1;

  if (iv !== null && iv < config.minIv) {
    scoreMultiplier = config.penalizeLowIv ? 0.4 : 0.7;
  }

  if (ivChangeRate !== null && ivChangeRate >= config.ivSpikeThreshold) {
    riskFlags.push("RISK_IV_SPIKE");
    scoreMultiplier *= 0.7;
  }

  if (ivChangeRate !== null && ivChangeRate <= config.ivCrushThreshold) {
    scoreMultiplier *= 0.6;
  }

  const metrics: VolatilityMetrics = {
    iv,
    ivChangeRate,
    ivRegime: regime
  };

  return { scoreMultiplier, riskFlags, metrics };
};
