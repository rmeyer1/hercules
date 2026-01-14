import type { ConcentrationConfig, ConcentrationResult, PositionExposure } from "@/src/lib/types/concentration";
import type { RiskFlag } from "@/src/lib/types";

const DEFAULT_CONFIG: ConcentrationConfig = {
  sectorMaxPct: 0.25,
  maxPositionsPerTicker: 1,
  correlatedSectorThreshold: 0.4,
  highBetaThreshold: 2
};

const normalizeSector = (sector: string | null) => sector?.trim() || "Unknown";

export const evaluateConcentrationRisk = (
  positions: PositionExposure[],
  config: Partial<ConcentrationConfig> = {}
): ConcentrationResult => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const riskFlags = new Set<RiskFlag>();
  const violations: string[] = [];

  const totalCollateral = positions.reduce((sum, position) => sum + position.collateral, 0);
  const sectorExposure: Record<string, number> = {};
  const tickerCounts: Record<string, number> = {};

  positions.forEach((position) => {
    const sectorKey = normalizeSector(position.sector);
    sectorExposure[sectorKey] = (sectorExposure[sectorKey] ?? 0) + position.collateral;
    tickerCounts[position.ticker] = (tickerCounts[position.ticker] ?? 0) + 1;

    if (position.beta !== null && position.beta >= cfg.highBetaThreshold) {
      riskFlags.add("RISK_CORRELATED_EXPOSURE");
    }
  });

  Object.entries(tickerCounts).forEach(([ticker, count]) => {
    if (count > cfg.maxPositionsPerTicker) {
      riskFlags.add("RISK_CORRELATED_EXPOSURE");
      violations.push(`Multiple positions in ${ticker} (count ${count}).`);
    }
  });

  Object.entries(sectorExposure).forEach(([sector, collateral]) => {
    if (totalCollateral <= 0) return;
    const pct = collateral / totalCollateral;
    if (pct >= cfg.sectorMaxPct) {
      riskFlags.add("RISK_SECTOR_CONCENTRATION");
      violations.push(`Sector ${sector} at ${(pct * 100).toFixed(1)}% of exposure.`);
    }
    if (pct >= cfg.correlatedSectorThreshold) {
      riskFlags.add("RISK_CORRELATED_EXPOSURE");
    }
  });

  return {
    riskFlags: Array.from(riskFlags),
    sectorExposure,
    violations
  };
};
