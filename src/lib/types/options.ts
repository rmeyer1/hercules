import type { OptionSide } from "./strategy";

export type TickerSymbol = string;

export type OptionContract = {
  symbol: string;
  underlying: TickerSymbol;
  side: OptionSide;
  expiration: string;
  strike: number;
  bid: number;
  ask: number;
  last: number | null;
  openInterest: number;
  volume: number;
  impliedVol: number;
  delta: number | null;
  theta: number | null;
};

export type OptionChainSnapshot = {
  underlying: TickerSymbol;
  asOf: string;
  contracts: OptionContract[];
};
