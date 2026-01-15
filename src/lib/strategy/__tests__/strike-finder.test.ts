import { describe, expect, it } from "vitest";
import type { OptionChainSnapshot, OptionContract } from "@/src/lib/types";
import { findStrikeCandidate } from "../strike-finder";

const makeContract = (overrides: Partial<OptionContract>): OptionContract => ({
  symbol: overrides.symbol ?? "AAPL240216P00150000",
  underlying: overrides.underlying ?? "AAPL",
  side: overrides.side ?? "put",
  expiration: overrides.expiration ?? "2026-02-20",
  strike: overrides.strike ?? 150,
  bid: overrides.bid ?? 0.2,
  ask: overrides.ask ?? 0.25,
  last: overrides.last ?? 0.23,
  openInterest: overrides.openInterest ?? 300,
  volume: overrides.volume ?? 30,
  impliedVol: overrides.impliedVol ?? 0.3,
  delta: overrides.delta ?? -0.2,
  theta: overrides.theta ?? -0.05
});

const makeChain = (contracts: OptionContract[]): OptionChainSnapshot => ({
  underlying: "AAPL",
  asOf: new Date().toISOString(),
  contracts
});

describe("strike finder", () => {
  it("selects the short strike closest to target delta", () => {
    const contracts = [
      makeContract({ symbol: "A", strike: 145, delta: -0.19, bid: 0.2 }),
      makeContract({ symbol: "B", strike: 140, delta: -0.21, bid: 0.4 })
    ];

    const result = findStrikeCandidate(makeChain(contracts), 160, "PCS");
    expect(result.reasons).toHaveLength(0);
    expect(result.shortStrike).toBe(140);
  });

  it("rejects illiquid shorts", () => {
    const contracts = [
      makeContract({ symbol: "A", strike: 145, delta: -0.2, bid: 0.01 }),
      makeContract({ symbol: "B", strike: 140, delta: -0.21, bid: 0.02 })
    ];

    const result = findStrikeCandidate(makeChain(contracts), 160, "PCS");
    expect(result.reasons[0]?.code).toBe("NO_VALID_SHORT_STRIKE");
  });

  it("disqualifies trades below minimum credit", () => {
    const contracts = [makeContract({ symbol: "A", strike: 145, delta: -0.2, bid: 0.2 })];

    const result = findStrikeCandidate(makeChain(contracts), 160, "CSP", { minCredit: 0.3 });
    expect(result.reasons.some((reason) => reason.code === "INSUFFICIENT_CREDIT")).toBe(true);
  });

  it("disqualifies spreads with poor credit-to-width", () => {
    const contracts = [
      makeContract({ symbol: "A", strike: 140, delta: -0.2, bid: 0.3, ask: 0.35 }),
      makeContract({ symbol: "B", strike: 135, delta: -0.15, bid: 0.05, ask: 0.25 })
    ];

    const result = findStrikeCandidate(makeChain(contracts), 160, "PCS", {
      minCredit: 0.01,
      minCreditPct: 0.15
    });

    expect(result.reasons.some((reason) => reason.code === "POOR_CREDIT_TO_WIDTH")).toBe(
      true
    );
  });
});
