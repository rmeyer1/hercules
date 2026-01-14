export type LiquidityDisqualificationCode =
  | "DISQUALIFIED_LOW_STOCK_LIQUIDITY"
  | "DISQUALIFIED_WIDE_OPTIONS_SPREAD"
  | "DISQUALIFIED_LOW_OPEN_INTEREST";

export type LiquidityDisqualification = {
  code: LiquidityDisqualificationCode;
  message: string;
};

export type LiquidityGateResult = {
  passed: boolean;
  reasons: LiquidityDisqualification[];
  diagnostics: {
    avgDailyVolume: number | null;
    evaluatedStrike: number | null;
    evaluatedSpreadPct: number | null;
    evaluatedOpenInterest: number | null;
  };
};
