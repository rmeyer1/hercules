import type { OptionContract } from "@/src/lib/types";
import type { LiquidityDisqualification, LiquidityGateResult } from "@/src/lib/types/liquidity";

export type LiquidityGateConfig = {
  minAvgDailyVolume: number;
  maxSpreadPct: number;
  minOpenInterest: number;
};

export type LiquidityGateInput = {
  avgDailyVolume: number | null;
  shortStrike?: number;
  contracts: OptionContract[];
  config?: Partial<LiquidityGateConfig>;
};

const DEFAULT_CONFIG: LiquidityGateConfig = {
  minAvgDailyVolume: 1_000_000,
  maxSpreadPct: 0.05,
  minOpenInterest: 500
};

const calculateSpreadPct = (contract: OptionContract) => {
  const mid = (contract.bid + contract.ask) / 2;
  if (mid <= 0) return null;
  return (contract.ask - contract.bid) / mid;
};

const findNearestContract = (contracts: OptionContract[], targetStrike?: number) => {
  if (contracts.length === 0) return null;
  if (targetStrike === undefined) {
    return contracts.reduce((best, contract) =>
      contract.openInterest > best.openInterest ? contract : best
    );
  }

  return contracts.reduce((best, contract) => {
    const bestDistance = Math.abs(best.strike - targetStrike);
    const nextDistance = Math.abs(contract.strike - targetStrike);
    return nextDistance < bestDistance ? contract : best;
  });
};

export const evaluateLiquidityGate = (input: LiquidityGateInput): LiquidityGateResult => {
  const config = { ...DEFAULT_CONFIG, ...(input.config ?? {}) };
  const reasons: LiquidityDisqualification[] = [];

  if (input.avgDailyVolume !== null && input.avgDailyVolume < config.minAvgDailyVolume) {
    reasons.push({
      code: "DISQUALIFIED_LOW_STOCK_LIQUIDITY",
      message: `Average volume ${input.avgDailyVolume} below ${config.minAvgDailyVolume}.`
    });
  }

  const contract = findNearestContract(input.contracts, input.shortStrike);
  const spreadPct = contract ? calculateSpreadPct(contract) : null;
  const openInterest = contract ? contract.openInterest : null;

  if (spreadPct !== null && spreadPct > config.maxSpreadPct) {
    reasons.push({
      code: "DISQUALIFIED_WIDE_OPTIONS_SPREAD",
      message: `Options spread ${(spreadPct * 100).toFixed(2)}% exceeds ${
        config.maxSpreadPct * 100
      }%.`
    });
  }

  if (openInterest !== null && openInterest < config.minOpenInterest) {
    reasons.push({
      code: "DISQUALIFIED_LOW_OPEN_INTEREST",
      message: `Open interest ${openInterest} below ${config.minOpenInterest}.`
    });
  }

  return {
    passed: reasons.length === 0,
    reasons,
    diagnostics: {
      avgDailyVolume: input.avgDailyVolume,
      evaluatedStrike: contract?.strike ?? null,
      evaluatedSpreadPct: spreadPct,
      evaluatedOpenInterest: openInterest
    }
  };
};
