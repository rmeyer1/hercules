import type { TradeCandidate, UniverseFilters } from "@/src/lib/types";

const defaultFilters: UniverseFilters = {
  minAvgVolume: 1_000_000,
  maxSpreadPct: 0.05,
  minOpenInterest: 500,
  minImpliedVol: 0.3,
  dteMin: 30,
  dteMax: 60,
  allowEarnings: true,
  allowNonUS: false,
  excludeMeme: true
};

const sampleCandidate: TradeCandidate = {
  id: "sample-1",
  ticker: "SPY",
  strategy: "PCS",
  expiration: "2026-03-20",
  dte: 55,
  shortStrike: 430,
  longStrike: 425,
  credit: 1.2,
  maxLoss: 3.8,
  breakEven: 428.8,
  pop: 0.73,
  thetaPerDay: 0.04,
  shortDelta: 0.18,
  iv: 0.31,
  ivTrend: "stable",
  riskFlags: ["MACRO_EVENT"],
  score: {
    fundamentals: 26,
    liquidity: 19,
    volatility: 17,
    trend: 16,
    eventRisk: 7,
    total: 85
  }
};

export async function GET() {
  return Response.json({
    filters: defaultFilters,
    candidate: sampleCandidate
  });
}
