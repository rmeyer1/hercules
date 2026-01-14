import type { RiskFlag } from "@/src/lib/types/risk";

export type MarketRegime = "BULL" | "NEUTRAL" | "BEAR";

export type TrendMetrics = {
  price: number;
  dma50: number;
  dma100: number;
  dma200: number;
  distanceFrom200DmaPct: number;
};

export type TrendScoreResult = {
  score: number;
  regime: MarketRegime;
  riskFlags: RiskFlag[];
};
