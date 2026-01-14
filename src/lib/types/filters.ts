export type UniverseFilters = {
  minAvgVolume: number;
  maxSpreadPct: number;
  minOpenInterest: number;
  minImpliedVol: number;
  dteMin: number;
  dteMax: number;
  allowEarnings: boolean;
  allowNonUS: boolean;
  excludeMeme: boolean;
};

export type UserPreferences = {
  accountSize: number;
  maxPerTradePct: number;
  maxPerTicker: number;
  sectorExposureMaxPct: number;
  preferDefinedRisk: boolean;
};
