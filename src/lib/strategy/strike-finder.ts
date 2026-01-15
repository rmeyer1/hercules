import type { OptionChainSnapshot, OptionContract, OptionSide, StrategyType } from "@/src/lib/types";
import type { StrikeCandidate, StrikeFinderConfig, StrikeFinderReason } from "@/src/lib/types/strike";

const DEFAULT_CONFIG: StrikeFinderConfig = {
  minOtmPct: 0.1,
  maxOtmPct: 0.25,
  allowAtm: process.env.STRIKE_ALLOW_ATM === "true",
  cspDeltaMin: 0.1,
  cspDeltaMax: 0.3,
  spreadDeltaMin: 0.08,
  spreadDeltaMax: 0.25,
  spreadWidthMin: 3,
  spreadWidthMax: 10
};

type ShortStrikeSelection = {
  strike: OptionContract | null;
  diagnostic: {
    total: number;
    otmMatches: number;
    deltaMatches: number;
    bothMatches: number;
  };
};

const calcOtmPct = (underlying: number, strike: number, side: OptionSide) => {
  if (side === "put") return (underlying - strike) / underlying;
  return (strike - underlying) / underlying;
};

const isValidOtm = (otmPct: number, config: StrikeFinderConfig) => {
  if (!config.allowAtm && otmPct <= 0) return false;
  return otmPct >= config.minOtmPct && otmPct <= config.maxOtmPct;
};

const inDeltaBand = (delta: number | null, min: number, max: number) => {
  if (delta === null) return false;
  const absDelta = Math.abs(delta);
  return absDelta >= min && absDelta <= max;
};

const selectShortStrike = (
  contracts: OptionContract[],
  underlying: number,
  side: OptionSide,
  deltaMin: number,
  deltaMax: number,
  config: StrikeFinderConfig
): ShortStrikeSelection => {
  const sideContracts = contracts.filter((contract) => contract.side === side);
  const otmMatches = sideContracts.filter((contract) => {
    const otmPct = calcOtmPct(underlying, contract.strike, side);
    return isValidOtm(otmPct, config);
  });
  const deltaMatches = sideContracts.filter((contract) =>
    inDeltaBand(contract.delta, deltaMin, deltaMax)
  );
  const filtered = sideContracts.filter((contract) => {
    if (contract.side !== side) return false;
    const otmPct = calcOtmPct(underlying, contract.strike, side);
    if (!isValidOtm(otmPct, config)) return false;
    return inDeltaBand(contract.delta, deltaMin, deltaMax);
  });

  if (filtered.length === 0) {
    return {
      strike: null,
      diagnostic: {
        total: sideContracts.length,
        otmMatches: otmMatches.length,
        deltaMatches: deltaMatches.length,
        bothMatches: 0
      }
    };
  }

  const strike = filtered.sort((a, b) => {
    const deltaA = Math.abs(a.delta ?? 0.5);
    const deltaB = Math.abs(b.delta ?? 0.5);
    return deltaA - deltaB;
  })[0];

  return {
    strike,
    diagnostic: {
      total: sideContracts.length,
      otmMatches: otmMatches.length,
      deltaMatches: deltaMatches.length,
      bothMatches: filtered.length
    }
  };
};

const selectLongStrike = (
  contracts: OptionContract[],
  shortStrike: number,
  side: OptionSide,
  widthMin: number,
  widthMax: number
) => {
  const candidates = contracts.filter((contract) => contract.side === side);
  if (candidates.length === 0) return null;

  const withinRange = candidates.filter((contract) => {
    const distance = Math.abs(contract.strike - shortStrike);
    return distance >= widthMin && distance <= widthMax;
  });

  if (withinRange.length === 0) {
    return null;
  }

  const targetDistance = (widthMin + widthMax) / 2;
  return withinRange.reduce((best, contract) => {
    const bestDistance = Math.abs(Math.abs(best.strike - shortStrike) - targetDistance);
    const nextDistance = Math.abs(Math.abs(contract.strike - shortStrike) - targetDistance);
    return nextDistance < bestDistance ? contract : best;
  });
};

const calcCredit = (short: OptionContract, long?: OptionContract) => {
  if (!long) return short.bid;
  return Math.max(short.bid - long.ask, 0);
};

const calcTheta = (short: OptionContract, long?: OptionContract) => {
  const shortTheta = short.theta ?? 0;
  const longTheta = long?.theta ?? 0;
  return shortTheta - longTheta;
};

const calcPop = (short: OptionContract) => {
  const delta = short.delta;
  if (delta === null) return 0.5;
  return Math.max(0, Math.min(1, 1 - Math.abs(delta)));
};

const buildCandidate = (
  strategy: StrategyType,
  short: OptionContract,
  long: OptionContract | null,
  reasons: StrikeFinderReason[]
): StrikeCandidate => {
  const credit = calcCredit(short, long ?? undefined);
  const width = long ? Math.abs(short.strike - long.strike) : 0;
  const maxLoss = long ? Math.max(width - credit, 0) : Math.max(short.strike - credit, 0);
  const breakeven = short.side === "put" ? short.strike - credit : short.strike + credit;

  return {
    strategy,
    shortStrike: short.strike,
    longStrike: long?.strike,
    credit,
    maxLoss,
    breakeven,
    thetaPerDay: calcTheta(short, long ?? undefined),
    pop: calcPop(short),
    shortDelta: short.delta ?? null,
    reasons
  };
};

export const findStrikeCandidate = (
  chain: OptionChainSnapshot,
  underlyingPrice: number,
  strategy: StrategyType,
  config: Partial<StrikeFinderConfig> = {}
): StrikeCandidate => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const reasons: StrikeFinderReason[] = [];

  if (chain.contracts.length === 0) {
    return {
      strategy,
      shortStrike: 0,
      credit: 0,
      maxLoss: 0,
      breakeven: 0,
      thetaPerDay: 0,
      pop: 0,
      shortDelta: null,
      reasons: [{ code: "NO_TRADE", message: "No option contracts available." }]
    };
  }

  const isPutStrategy = strategy === "CSP" || strategy === "PCS";
  const side: OptionSide = isPutStrategy ? "put" : "call";
  const deltaMin = strategy === "CSP" ? cfg.cspDeltaMin : cfg.spreadDeltaMin;
  const deltaMax = strategy === "CSP" ? cfg.cspDeltaMax : cfg.spreadDeltaMax;

  const shortResult = selectShortStrike(
    chain.contracts,
    underlyingPrice,
    side,
    deltaMin,
    deltaMax,
    cfg
  );
  if (!shortResult.strike) {
    const diagnostic = shortResult.diagnostic;
    const summary = diagnostic
      ? `Side contracts: ${diagnostic.total}, OTM(${Math.round(
          cfg.minOtmPct * 100
        )}-${Math.round(cfg.maxOtmPct * 100)}%): ${diagnostic.otmMatches}, Delta(${deltaMin}-${deltaMax}): ${diagnostic.deltaMatches}.`
      : "No qualifying contracts in chain.";
    return {
      strategy,
      shortStrike: 0,
      credit: 0,
      maxLoss: 0,
      breakeven: 0,
      thetaPerDay: 0,
      pop: 0,
      shortDelta: null,
      reasons: [
        {
          code: "NO_VALID_SHORT_STRIKE",
          message: `No short strike meets OTM/delta rules. ${summary}`
        }
      ]
    };
  }

  if (strategy === "CSP" || strategy === "CC") {
    return buildCandidate(strategy, shortResult.strike, null, reasons);
  }

  const long = selectLongStrike(
    chain.contracts,
    shortResult.strike.strike,
    side,
    cfg.spreadWidthMin,
    cfg.spreadWidthMax
  );
  if (!long) {
    return {
      strategy,
      shortStrike: shortResult.strike.strike,
      credit: 0,
      maxLoss: 0,
      breakeven: 0,
      thetaPerDay: 0,
      pop: 0,
      shortDelta: shortResult.strike.delta ?? null,
      reasons: [
        {
          code: "NO_VALID_LONG_STRIKE",
          message: `No long strike found between ${cfg.spreadWidthMin} and ${cfg.spreadWidthMax} points from short strike.`
        }
      ]
    };
  }

  return buildCandidate(strategy, shortResult.strike, long, reasons);
};
