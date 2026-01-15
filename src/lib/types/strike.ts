import type { StrategyType } from "@/src/lib/types";

export type StrikeFinderReasonCode =
  | "NO_TRADE"
  | "NO_VALID_SHORT_STRIKE"
  | "NO_VALID_LONG_STRIKE"
  | "INSUFFICIENT_CREDIT"
  | "POOR_CREDIT_TO_WIDTH";

export type StrikeFinderReason = {
  code: StrikeFinderReasonCode;
  message: string;
};

export type StrikeFinderConfig = {
  allowAtm: boolean;
  minShortBid: number;
  maxSpreadPct: number;
  minOpenInterest: number;
  minVolume: number;
  minCredit: number;
  minCreditPct: number;
  cspMinOtmPct: number;
  cspMaxOtmPct: number;
  cspTargetDelta: number;
  cspDeltaMin: number;
  cspDeltaMax: number;
  pcsMinOtmPct: number;
  pcsMaxOtmPct: number;
  pcsTargetDelta: number;
  pcsDeltaMin: number;
  pcsDeltaMax: number;
  ccsMinOtmPct: number;
  ccsMaxOtmPct: number;
  ccsTargetDelta: number;
  ccsDeltaMin: number;
  ccsDeltaMax: number;
  ccMinOtmPct: number;
  ccMaxOtmPct: number;
  ccTargetDelta: number;
  ccDeltaMin: number;
  ccDeltaMax: number;
  spreadWidthMin: number;
  spreadWidthMax: number;
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
