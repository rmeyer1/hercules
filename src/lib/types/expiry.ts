import type { RiskFlag, StrategyType } from "@/src/lib/types";

export type ExpirationCandidate = {
  expiration: string;
  dte: number;
  thetaPerDay: number;
  credit: number;
  maxLoss: number;
  riskFlags: RiskFlag[];
  strategy: StrategyType;
};

export type ExpirationRanked = ExpirationCandidate & {
  score: number;
};

export type ExpirationRankingConfig = {
  minDte: number;
  maxDte: number;
  softMinDte: number;
  softMaxDte: number;
  eventPenalty: number;
  topN: number;
};
