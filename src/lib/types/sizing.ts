export type PositionSizingInput = {
  accountSize: number;
  requiredCollateral: number;
  maxAllocationPct?: number;
};

export type PositionSizingResult = {
  requiredCollateral: number;
  accountSize: number;
  allocationPct: number;
  maxAllocationPct: number;
  withinLimit: boolean;
  warning?: string;
};
