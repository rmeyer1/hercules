import type {
  CalendarSnapshot,
  Fundamentals,
  LiquidityGateResult,
  RiskFlag,
  ScoreBreakdown,
  StrikeCandidate,
  TrendMetrics,
  VolatilityMetrics
} from "@/src/lib/types";

export type ExplanationInput = {
  ticker: string;
  underlyingPrice?: number | null;
  score?: ScoreBreakdown | null;
  volatility?: VolatilityMetrics | null;
  strike?: StrikeCandidate | null;
  liquidity?: LiquidityGateResult | null;
  fundamentals?: Fundamentals | null;
  trend?: TrendMetrics | null;
  calendar?: CalendarSnapshot | null;
  tradeDte?: number | null;
  riskFlags?: RiskFlag[];
};

export type ExplanationResult = {
  why: string[];
  riskFlags: RiskFlag[];
};
