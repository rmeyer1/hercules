export type VolatilityMetrics = {
  iv: number | null;
  ivChangeRate: number | null;
  ivRegime: "EXPANDING" | "STABLE" | "CRUSHED" | "UNKNOWN";
};
