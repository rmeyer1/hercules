import type { StrategyType } from "@/src/lib/types";

export type StrikeFinderReasonCode =
  | "NO_TRADE"
  | "NO_VALID_SHORT_STRIKE"
  | "NO_VALID_LONG_STRIKE";

export type StrikeFinderReason = {
  code: StrikeFinderReasonCode;
  message: string;
};

export type StrikeFinderConfig = {
  minOtmPct: number;
  maxOtmPct: number;
  allowAtm: boolean;
  cspDeltaMin: number;
  cspDeltaMax: number;
  spreadDeltaMin: number;
  spreadDeltaMax: number;
  spreadWidth: number;
};

export type StrikeCandidate = {
  strategy: StrategyType;
  shortStrike: number;
  longStrike?: number;
  credit: number;
  maxLoss: number;
  breakeven: number;
  thetaPerDay: number;
  pop: number;
  shortDelta: number | null;
  reasons: StrikeFinderReason[];
};
