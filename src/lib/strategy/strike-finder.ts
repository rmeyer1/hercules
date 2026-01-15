import type { OptionChainSnapshot, OptionContract, OptionSide, StrategyType } from "@/src/lib/types";
import type { StrikeCandidate, StrikeFinderConfig, StrikeFinderReason } from "@/src/lib/types/strike";

const parseEnvNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const DEFAULT_CONFIG: StrikeFinderConfig = {
  allowAtm: process.env.STRIKE_ALLOW_ATM === "true",
  minShortBid: 0.05,
  maxSpreadPct: 0.2,
  minOpenInterest: 200,
  minVolume: 20,
  minCredit: parseEnvNumber(process.env.STRIKE_MIN_CREDIT, 0.1),
  minCreditPct: parseEnvNumber(process.env.STRIKE_MIN_CREDIT_PCT, 0.15),
  cspMinOtmPct: 0.05,
  cspMaxOtmPct: 0.3,
  cspTargetDelta: 0.23,
  cspDeltaMin: 0.18,
  cspDeltaMax: 0.28,
  pcsMinOtmPct: 0.03,
  pcsMaxOtmPct: 0.25,
  pcsTargetDelta: 0.2,
  pcsDeltaMin: 0.18,
  pcsDeltaMax: 0.22,
  ccsMinOtmPct: 0.03,
  ccsMaxOtmPct: 0.25,
  ccsTargetDelta: 0.18,
  ccsDeltaMin: 0.15,
  ccsDeltaMax: 0.2,
  ccMinOtmPct: 0.03,
  ccMaxOtmPct: 0.2,
  ccTargetDelta: 0.2,
  ccDeltaMin: 0.15,
  ccDeltaMax: 0.25,
  spreadWidthMin: 3,
  spreadWidthMax: 10
};

type ShortStrikeSelection = {
  strike: OptionContract | null;
  diagnostic: {
    total: number;
    otmMatches: number;
    deltaMatches: number;
    liquidityMatches: number;
    bothMatches: number;
  };
};

type StrategyStrikeConfig = {
  minOtmPct: number;
  maxOtmPct: number;
  targetDelta: number;
  deltaMin: number;
  deltaMax: number;
  side: OptionSide;
};

const calcOtmPct = (underlying: number, strike: number, side: OptionSide) => {
  if (side === "put") return (underlying - strike) / underlying;
  return (strike - underlying) / underlying;
};

const isValidOtm = (otmPct: number, config: StrikeFinderConfig, minOtm: number, maxOtm: number) => {
  if (!config.allowAtm && otmPct <= 0) return false;
  return otmPct >= minOtm && otmPct <= maxOtm;
};

const inDeltaBand = (delta: number | null, min: number, max: number) => {
  if (delta === null) return false;
  const absDelta = Math.abs(delta);
  return absDelta >= min && absDelta <= max;
};

const calcMid = (bid: number, ask: number) => (bid + ask) / 2;

const calcSpreadPct = (bid: number, ask: number) => {
  const mid = calcMid(bid, ask);
  if (mid <= 0) return Infinity;
  return (ask - bid) / mid;
};

const isLiquidShort = (contract: OptionContract, config: StrikeFinderConfig) => {
  if (contract.bid < config.minShortBid) return false;
  if (contract.ask <= 0) return false;
  const spreadPct = calcSpreadPct(contract.bid, contract.ask);
  if (!Number.isFinite(spreadPct) || spreadPct > config.maxSpreadPct) return false;
  if (contract.openInterest < config.minOpenInterest) return false;
  if (contract.volume < config.minVolume) return false;
  return true;
};

const getStrategyConfig = (
  strategy: StrategyType,
  config: StrikeFinderConfig
): StrategyStrikeConfig => {
  switch (strategy) {
    case "CSP":
      return {
        minOtmPct: config.cspMinOtmPct,
        maxOtmPct: config.cspMaxOtmPct,
        targetDelta: config.cspTargetDelta,
        deltaMin: config.cspDeltaMin,
        deltaMax: config.cspDeltaMax,
        side: "put"
      };
    case "PCS":
      return {
        minOtmPct: config.pcsMinOtmPct,
        maxOtmPct: config.pcsMaxOtmPct,
        targetDelta: config.pcsTargetDelta,
        deltaMin: config.pcsDeltaMin,
        deltaMax: config.pcsDeltaMax,
        side: "put"
      };
    case "CCS":
      return {
        minOtmPct: config.ccsMinOtmPct,
        maxOtmPct: config.ccsMaxOtmPct,
        targetDelta: config.ccsTargetDelta,
        deltaMin: config.ccsDeltaMin,
        deltaMax: config.ccsDeltaMax,
        side: "call"
      };
    case "CC":
    default:
      return {
        minOtmPct: config.ccMinOtmPct,
        maxOtmPct: config.ccMaxOtmPct,
        targetDelta: config.ccTargetDelta,
        deltaMin: config.ccDeltaMin,
        deltaMax: config.ccDeltaMax,
        side: "call"
      };
  }
};

const selectShortStrike = (
  contracts: OptionContract[],
  underlying: number,
  strategyConfig: StrategyStrikeConfig,
  config: StrikeFinderConfig
): ShortStrikeSelection => {
  const sideContracts = contracts.filter((contract) => contract.side === strategyConfig.side);
  const otmMatches = sideContracts.filter((contract) => {
    const otmPct = calcOtmPct(underlying, contract.strike, strategyConfig.side);
    return isValidOtm(otmPct, config, strategyConfig.minOtmPct, strategyConfig.maxOtmPct);
  });
  const deltaMatches = sideContracts.filter((contract) =>
    inDeltaBand(contract.delta, strategyConfig.deltaMin, strategyConfig.deltaMax)
  );
  const liquidityMatches = sideContracts.filter((contract) => isLiquidShort(contract, config));
  const filtered = sideContracts.filter((contract) => {
    const otmPct = calcOtmPct(underlying, contract.strike, strategyConfig.side);
    if (!isValidOtm(otmPct, config, strategyConfig.minOtmPct, strategyConfig.maxOtmPct)) {
      return false;
    }
    if (!inDeltaBand(contract.delta, strategyConfig.deltaMin, strategyConfig.deltaMax)) {
      return false;
    }
    return isLiquidShort(contract, config);
  });

  if (filtered.length === 0) {
    return {
      strike: null,
      diagnostic: {
        total: sideContracts.length,
        otmMatches: otmMatches.length,
        deltaMatches: deltaMatches.length,
        liquidityMatches: liquidityMatches.length,
        bothMatches: 0
      }
    };
  }

  const strike = filtered.sort((a, b) => {
    const deltaA = Math.abs(a.delta ?? 0);
    const deltaB = Math.abs(b.delta ?? 0);
    const distanceA = Math.abs(deltaA - strategyConfig.targetDelta);
    const distanceB = Math.abs(deltaB - strategyConfig.targetDelta);
    if (distanceA !== distanceB) return distanceA - distanceB;
    if (a.bid !== b.bid) return b.bid - a.bid;
    return calcSpreadPct(a.bid, a.ask) - calcSpreadPct(b.bid, b.ask);
  })[0];

  return {
    strike,
    diagnostic: {
      total: sideContracts.length,
      otmMatches: otmMatches.length,
      deltaMatches: deltaMatches.length,
      liquidityMatches: liquidityMatches.length,
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

const applyCreditGuardrails = (
  candidate: StrikeCandidate,
  short: OptionContract,
  long: OptionContract | null,
  cfg: StrikeFinderConfig
) => {
  if (candidate.credit < cfg.minCredit) {
    candidate.reasons.push({
      code: "INSUFFICIENT_CREDIT",
      message: `Credit ${candidate.credit.toFixed(2)} is below minimum ${cfg.minCredit.toFixed(2)}.`
    });
  }

  if (long) {
    const width = Math.abs(short.strike - long.strike);
    if (width > 0 && candidate.credit / width < cfg.minCreditPct) {
      candidate.reasons.push({
        code: "POOR_CREDIT_TO_WIDTH",
        message: `Credit/width ${(candidate.credit / width).toFixed(2)} is below minimum ${cfg.minCreditPct.toFixed(2)}.`
      });
    }
  }
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

  const strategyConfig = getStrategyConfig(strategy, cfg);

  const shortResult = selectShortStrike(
    chain.contracts,
    underlyingPrice,
    strategyConfig,
    cfg
  );
  if (!shortResult.strike) {
    const diagnostic = shortResult.diagnostic;
    const summary = diagnostic
      ? `Side contracts: ${diagnostic.total}, OTM(${Math.round(
          strategyConfig.minOtmPct * 100
        )}-${Math.round(strategyConfig.maxOtmPct * 100)}%): ${diagnostic.otmMatches}, Delta(${strategyConfig.deltaMin}-${strategyConfig.deltaMax}): ${diagnostic.deltaMatches}, Liquid: ${diagnostic.liquidityMatches}.`
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
    const candidate = buildCandidate(strategy, shortResult.strike, null, reasons);
    applyCreditGuardrails(candidate, shortResult.strike, null, cfg);
    return candidate;
  }

  const long = selectLongStrike(
    chain.contracts,
    shortResult.strike.strike,
    strategyConfig.side,
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

  const candidate = buildCandidate(strategy, shortResult.strike, long, reasons);
  applyCreditGuardrails(candidate, shortResult.strike, long, cfg);
  return candidate;
};
