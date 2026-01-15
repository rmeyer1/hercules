import { AlpacaClient } from "@/src/lib/providers/alpaca";
import { CalendarProvider } from "@/src/lib/providers/calendar";
import { FmpClient } from "@/src/lib/providers/fmp";
import { evaluateLiquidityGate } from "@/src/lib/liquidity/gate";
import { rankExpirations } from "@/src/lib/expiry/ranker";
import { scoreCandidate } from "@/src/lib/scoring/engine";
import { selectStrategies } from "@/src/lib/strategy/selector";
import { findStrikeCandidate } from "@/src/lib/strategy/strike-finder";
import { evaluatePositionSizing } from "@/src/lib/sizing/guardrail";
import type { OptionChainSnapshot, StrategyType, TradeCandidate, TrendMetrics } from "@/src/lib/types";
import type { QualifyRequest, QualifyResponse, DisqualifiedTicker, QualifiedCandidate } from "@/src/lib/types/qualify";
import type { ExpirationCandidate } from "@/src/lib/types/expiry";
import { buildUniverse } from "@/src/lib/universe/builder";

const parseDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const calcDte = (expiration: string) => {
  const exp = parseDate(expiration);
  if (!exp) return null;
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((exp.getTime() - now.getTime()) / msPerDay);
};

const filterContractsByExpiration = (chain: OptionChainSnapshot, expiration: string) => {
  return {
    ...chain,
    contracts: chain.contracts.filter((contract) => contract.expiration === expiration)
  };
};

const buildExpirationCandidates = (
  chain: OptionChainSnapshot,
  underlyingPrice: number,
  strategy: StrategyType,
  riskFlags: string[],
  strikeFailureCounts?: Record<string, number>,
  strikeFailureExamples?: Record<string, string>
): ExpirationCandidate[] => {
  const expirations = Array.from(new Set(chain.contracts.map((contract) => contract.expiration)));
  return expirations
    .map((expiration) => {
      const dte = calcDte(expiration);
      if (dte === null) return null;
      const slice = filterContractsByExpiration(chain, expiration);
      const strike = findStrikeCandidate(slice, underlyingPrice, strategy);
      if (strike.reasons.length > 0) {
        if (strikeFailureCounts && strikeFailureExamples) {
          strike.reasons.forEach((reason) => {
            strikeFailureCounts[reason.code] = (strikeFailureCounts[reason.code] ?? 0) + 1;
            if (!strikeFailureExamples[reason.code]) {
              strikeFailureExamples[reason.code] = reason.message;
            }
          });
        }
        return null;
      }
      return {
        expiration,
        dte,
        thetaPerDay: strike.thetaPerDay,
        credit: strike.credit,
        maxLoss: strike.maxLoss,
        riskFlags: riskFlags as unknown as any,
        strategy
      } satisfies ExpirationCandidate;
    })
    .filter((candidate): candidate is ExpirationCandidate => Boolean(candidate));
};

const toTradeCandidate = (
  ticker: string,
  strategy: StrategyType,
  expiration: string,
  dte: number,
  strike: ReturnType<typeof findStrikeCandidate>,
  score: ReturnType<typeof scoreCandidate>
): TradeCandidate => {
  return {
    id: `${ticker}-${strategy}-${expiration}`,
    ticker,
    strategy,
    expiration,
    dte,
    shortStrike: strike.shortStrike,
    longStrike: strike.longStrike,
    credit: strike.credit,
    maxLoss: strike.maxLoss,
    breakEven: strike.breakeven,
    pop: strike.pop,
    thetaPerDay: strike.thetaPerDay,
    shortDelta: strike.shortDelta ?? 0,
    iv: score.volatility.iv ?? 0,
    ivTrend:
      score.volatility.ivRegime === "EXPANDING"
        ? "expanding"
        : score.volatility.ivRegime === "CRUSHED"
          ? "crushing"
          : "stable",
    riskFlags: score.riskFlags,
    score: score.breakdown
  };
};

const neutralTrend = (price: number): TrendMetrics => ({
  price,
  dma50: price,
  dma100: price,
  dma200: price,
  distanceFrom200DmaPct: 0
});

export const qualify = async (request: QualifyRequest): Promise<QualifyResponse> => {
  const generatedAt = new Date().toISOString();
  const disqualified: DisqualifiedTicker[] = [];
  const candidates: QualifiedCandidate[] = [];

  const universe = await buildUniverse({
    source: request.source,
    tickers: request.tickers,
    recommendationProfile: request.recommendationProfile,
    config: {
      allowUnknownOptionsLiquidity: true,
      useOptionsSnapshot: false
    }
  });

  universe.excluded.forEach((item) => {
    disqualified.push({
      ticker: item.ticker,
      reasons: item.reasons.map((reason) => reason.message)
    });
  });

  const fmpClient = new FmpClient();
  const alpacaClient = new AlpacaClient();
  const calendarProvider = new CalendarProvider();

  for (const item of universe.included) {
    try {
      const strikeFailureCounts: Record<string, number> = {};
      const strikeFailureExamples: Record<string, string> = {};

      const fundamentals = await fmpClient.getFundamentals(item.ticker);
      const quote = await fmpClient.getQuoteSnapshot(item.ticker);
      let resolvedPrice = quote.price ?? null;
      let resolvedAvgVolume = quote.avgVolume ?? null;

      if (!resolvedPrice || resolvedPrice <= 0) {
        try {
          const trade = await alpacaClient.getLatestTrade(item.ticker);
          if (trade.price > 0) {
            resolvedPrice = trade.price;
          } else {
            const latestQuote = await alpacaClient.getLatestQuote(item.ticker);
            const midpoint =
              latestQuote.bidPrice > 0 && latestQuote.askPrice > 0
                ? (latestQuote.bidPrice + latestQuote.askPrice) / 2
                : 0;
            if (midpoint > 0) {
              resolvedPrice = midpoint;
            }
          }
        } catch {
          // Ignore Alpaca fallback errors and use the existing quote data.
        }
      }

      if (!resolvedPrice || resolvedPrice <= 0) {
        disqualified.push({ ticker: item.ticker, reasons: ["Missing price data."] });
        continue;
      }

      const chain = await alpacaClient.getOptionChainSnapshot(item.ticker);
      const calendar = await calendarProvider.getCalendarSnapshot(item.ticker);

      const marketTrend = neutralTrend(resolvedPrice);
      const stockTrend = neutralTrend(resolvedPrice);
      const selection = selectStrategies({
        marketTrend,
        stockTrend,
        fundamentals,
        preferDefinedRisk: request.preferences?.preferDefinedRisk
      });

      const tradeCandidates: TradeCandidate[] = [];

      for (const strategy of selection.strategies) {
        const expirationCandidates = buildExpirationCandidates(
          chain,
          resolvedPrice,
          strategy,
          [],
          strikeFailureCounts,
          strikeFailureExamples
        );
        if (expirationCandidates.length === 0) continue;

        const ranked = rankExpirations(expirationCandidates);

        for (const rankedExpiration of ranked) {
          const slice = filterContractsByExpiration(chain, rankedExpiration.expiration);
          const strike = findStrikeCandidate(slice, resolvedPrice, strategy);
          if (strike.reasons.length > 0) continue;

          const liquidity = evaluateLiquidityGate({
            avgDailyVolume: resolvedAvgVolume,
            shortStrike: strike.shortStrike,
            contracts: slice.contracts
          });

          const score = scoreCandidate({
            fundamentals,
            liquidityGate: liquidity,
            impliedVol: slice.contracts[0]?.impliedVol ?? null,
            ivChangeRate: null,
            trendScore: null,
            stockTrend,
            marketTrend,
            eventRiskFlags: [],
            calendar,
            tradeDte: rankedExpiration.dte
          });

          tradeCandidates.push(
            toTradeCandidate(
              item.ticker,
              strategy,
              rankedExpiration.expiration,
              rankedExpiration.dte,
              strike,
              score
            )
          );
        }
      }

      if (tradeCandidates.length === 0) {
        const failureSummaries = Object.entries(strikeFailureCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([code, count]) => {
            const example = strikeFailureExamples[code];
            return `${code} (${count})${example ? ` — ${example}` : ""}`;
          })
          .join(" ");

        disqualified.push({
          ticker: item.ticker,
          reasons: [
            failureSummaries
              ? `No valid strikes found. ${failureSummaries}`
              : "No valid strikes found within DTE window."
          ]
        });
        continue;
      }

      tradeCandidates.sort((a, b) => b.score.total - a.score.total);
      const best = tradeCandidates[0];

      const sizing = evaluatePositionSizing({
        accountSize: request.accountSize,
        requiredCollateral: best.maxLoss,
        maxAllocationPct: request.preferences?.maxPerTradePct
      });

      candidates.push({
        ticker: item.ticker,
        candidate: best,
        sizing: {
          requiredCollateral: sizing.requiredCollateral,
          allocationPct: sizing.allocationPct,
          withinLimit: sizing.withinLimit,
          warning: sizing.warning
        }
      });
    } catch (error) {
      disqualified.push({
        ticker: item.ticker,
        reasons: [error instanceof Error ? error.message : "Qualification failed."]
      });
    }
  }

  const maxCandidates = request.maxCandidates ?? 25;
  const ranked = candidates.sort((a, b) => {
    const scoreA = (a.candidate as TradeCandidate).score.total;
    const scoreB = (b.candidate as TradeCandidate).score.total;
    return scoreB - scoreA;
  });

  return {
    generatedAt,
    candidates: ranked.slice(0, maxCandidates),
    disqualified
  };
};
