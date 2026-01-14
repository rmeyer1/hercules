import type { ExpirationCandidate, ExpirationRanked, ExpirationRankingConfig } from "@/src/lib/types/expiry";

const DEFAULT_CONFIG: ExpirationRankingConfig = {
  minDte: 30,
  maxDte: 60,
  softMinDte: 25,
  softMaxDte: 70,
  eventPenalty: 0.15,
  topN: 3
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const dteScore = (dte: number, config: ExpirationRankingConfig) => {
  if (dte >= config.minDte && dte <= config.maxDte) return 1;
  if (dte >= config.softMinDte && dte <= config.softMaxDte) return 0.6;
  return 0.2;
};

const efficiencyScore = (thetaPerDay: number, credit: number, maxLoss: number) => {
  const creditPerRisk = maxLoss > 0 ? credit / maxLoss : 0;
  const thetaFactor = clamp(thetaPerDay / 1, 0, 1);
  const creditFactor = clamp(creditPerRisk / 0.5, 0, 1);
  return 0.5 * thetaFactor + 0.5 * creditFactor;
};

export const rankExpirations = (
  candidates: ExpirationCandidate[],
  config: Partial<ExpirationRankingConfig> = {}
) => {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const ranked: ExpirationRanked[] = candidates.map((candidate) => {
    const base = dteScore(candidate.dte, cfg);
    const efficiency = efficiencyScore(candidate.thetaPerDay, candidate.credit, candidate.maxLoss);
    const hasEventRisk = candidate.riskFlags.length > 0;
    const penalty = hasEventRisk ? cfg.eventPenalty : 0;

    const score = clamp(base * 0.6 + efficiency * 0.4 - penalty, 0, 1);

    return {
      ...candidate,
      score
    };
  });

  return ranked.sort((a, b) => b.score - a.score).slice(0, cfg.topN);
};
