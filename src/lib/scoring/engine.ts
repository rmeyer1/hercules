import type { Fundamentals, LiquidityGateResult, RiskFlag, ScoreBreakdown } from "@/src/lib/types";
import { scoreVolatilityQuality } from "@/src/lib/scoring/volatility";

export type ScoreInput = {
  fundamentals: Fundamentals | null;
  liquidityGate: LiquidityGateResult | null;
  impliedVol: number | null;
  ivChangeRate: number | null;
  trendScore: number | null;
  eventRiskFlags: RiskFlag[];
};

export type ScoreConfig = {
  fundamentalsWeight: number;
  liquidityWeight: number;
  volatilityWeight: number;
  technicalWeight: number;
  eventWeight: number;
};

export type ScoreResult = {
  total: number;
  breakdown: ScoreBreakdown;
  riskFlags: RiskFlag[];
  interpretation: "HIGH" | "ACCEPTABLE" | "PASS";
};

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  fundamentalsWeight: 30,
  liquidityWeight: 20,
  volatilityWeight: 20,
  technicalWeight: 20,
  eventWeight: 10
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const scoreFundamentals = (fundamentals: Fundamentals | null, weight: number) => {
  if (!fundamentals) return 0;

  let score = 0;

  if (fundamentals.marketCap && fundamentals.marketCap >= 10_000_000_000) score += 0.3;
  if (fundamentals.returnOnEquity && fundamentals.returnOnEquity > 0) score += 0.2;
  if (fundamentals.netMargin && fundamentals.netMargin > 0) score += 0.2;
  if (fundamentals.debtToEquity !== null && fundamentals.debtToEquity < 2) score += 0.2;
  if (fundamentals.currentRatio !== null && fundamentals.currentRatio > 1) score += 0.1;

  return clamp(score * weight, 0, weight);
};

const scoreLiquidity = (liquidityGate: LiquidityGateResult | null, weight: number) => {
  if (!liquidityGate) return weight * 0.5;
  return liquidityGate.passed ? weight : weight * 0.2;
};

const scoreTechnical = (trendScore: number | null, weight: number) => {
  if (trendScore === null) return weight * 0.5;
  const normalized = clamp(trendScore, 0, 1);
  return normalized * weight;
};

const scoreEventRisk = (riskFlags: RiskFlag[], weight: number) => {
  if (riskFlags.length === 0) return weight;
  return clamp(weight - riskFlags.length * 2, 0, weight);
};

const interpretScore = (total: number): ScoreResult["interpretation"] => {
  if (total >= 80) return "HIGH";
  if (total >= 65) return "ACCEPTABLE";
  return "PASS";
};

export const scoreCandidate = (
  input: ScoreInput,
  config: ScoreConfig = DEFAULT_SCORE_CONFIG
): ScoreResult => {
  const fundamentalsScore = scoreFundamentals(input.fundamentals, config.fundamentalsWeight);
  const liquidityScore = scoreLiquidity(input.liquidityGate, config.liquidityWeight);
  const volatilityQuality = scoreVolatilityQuality(input.impliedVol, input.ivChangeRate);
  const volatilityScore = clamp(
    config.volatilityWeight * volatilityQuality.scoreMultiplier,
    0,
    config.volatilityWeight
  );
  const technicalScore = scoreTechnical(input.trendScore, config.technicalWeight);
  const eventScore = scoreEventRisk(input.eventRiskFlags, config.eventWeight);
  const riskFlags = Array.from(
    new Set([...input.eventRiskFlags, ...volatilityQuality.riskFlags])
  );

  const total = clamp(
    fundamentalsScore + liquidityScore + volatilityScore + technicalScore + eventScore,
    0,
    100
  );

  const breakdown: ScoreBreakdown = {
    fundamentals: Math.round(fundamentalsScore),
    liquidity: Math.round(liquidityScore),
    volatility: Math.round(volatilityScore),
    trend: Math.round(technicalScore),
    eventRisk: Math.round(eventScore),
    total: Math.round(total)
  };

  return {
    total: breakdown.total,
    breakdown,
    riskFlags,
    interpretation: interpretScore(breakdown.total)
  };
};
