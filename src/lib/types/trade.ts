import type { StrategyType } from "./strategy";
import type { ScoreBreakdown } from "./scoring";
import type { RiskFlag } from "./risk";

export type TradeCandidate = {
  id: string;
  ticker: string;
  strategy: StrategyType;
  expiration: string;
  dte: number;
  shortStrike: number;
  longStrike?: number;
  credit: number;
  maxLoss: number;
  breakEven: number;
  pop: number;
  thetaPerDay: number;
  shortDelta: number;
  iv: number;
  ivTrend: "expanding" | "stable" | "crushing";
  riskFlags: RiskFlag[];
  score: ScoreBreakdown;
};
