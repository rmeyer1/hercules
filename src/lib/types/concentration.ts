import type { RiskFlag } from "@/src/lib/types";

export type PositionExposure = {
  ticker: string;
  sector: string | null;
  collateral: number;
  beta: number | null;
};

export type ConcentrationConfig = {
  sectorMaxPct: number;
  maxPositionsPerTicker: number;
  correlatedSectorThreshold: number;
  highBetaThreshold: number;
};

export type ConcentrationResult = {
  riskFlags: RiskFlag[];
  sectorExposure: Record<string, number>;
  violations: string[];
};
