import type { PositionSizingInput, PositionSizingResult } from "@/src/lib/types/sizing";

const DEFAULT_MAX_ALLOCATION = 0.05;

export const evaluatePositionSizing = (
  input: PositionSizingInput
): PositionSizingResult => {
  const maxAllocationPct = input.maxAllocationPct ?? DEFAULT_MAX_ALLOCATION;
  const allocationPct = input.accountSize > 0 ? input.requiredCollateral / input.accountSize : 0;
  const withinLimit = allocationPct <= maxAllocationPct;

  return {
    requiredCollateral: input.requiredCollateral,
    accountSize: input.accountSize,
    allocationPct,
    maxAllocationPct,
    withinLimit,
    warning: withinLimit
      ? undefined
      : `Allocation ${Math.round(allocationPct * 100)}% exceeds ${
          Math.round(maxAllocationPct * 100)
        }% limit.`
  };
};
