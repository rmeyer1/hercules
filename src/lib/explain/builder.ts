import type { ExplanationInput, ExplanationResult } from "@/src/lib/types/explain";
import type { RiskFlag } from "@/src/lib/types";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const formatPct = (value: number) => `${(value * 100).toFixed(0)}%`;

const formatNumber = (value: number) =>
  Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);

const unique = <T>(items: T[]) => Array.from(new Set(items));

const buildWhyBullets = (input: ExplanationInput): string[] => {
  const bullets: string[] = [];

  if (input.volatility?.iv !== null) {
    const regime = input.volatility.ivRegime.toLowerCase();
    bullets.push(`IV at ${formatPct(input.volatility.iv)} with ${regime} trend.`);
  }

  if (input.strike) {
    const otmPct =
      input.underlyingPrice && input.underlyingPrice > 0
        ? Math.abs((input.underlyingPrice - input.strike.shortStrike) / input.underlyingPrice)
        : null;
    const delta = input.strike.shortDelta !== null ? input.strike.shortDelta.toFixed(2) : "n/a";
    bullets.push(`Short strike ${input.strike.shortStrike} at ${delta} delta.`);
    if (otmPct !== null) {
      bullets.push(`Short strike ${formatPct(otmPct)} OTM.`);
    }
  }

  if (input.tradeDte !== null) {
    bullets.push(`Targeting ${input.tradeDte} DTE window.`);
  }

  if (input.liquidity?.diagnostics.avgDailyVolume !== null) {
    const vol = input.liquidity.diagnostics.avgDailyVolume;
    bullets.push(`Average daily volume ${formatNumber(vol)} shares.`);
  }

  if (input.fundamentals?.marketCap !== null) {
    bullets.push(`Market cap ${formatNumber(input.fundamentals.marketCap)}.`);
  }

  if (input.trend) {
    bullets.push(`Price vs 200DMA: ${formatPct(input.trend.distanceFrom200DmaPct / 100)}.`);
  }

  if (input.calendar?.earnings?.daysToEarnings !== null) {
    const days = input.calendar.earnings.daysToEarnings;
    const horizon = input.tradeDte ?? 21;
    if (days > horizon) {
      bullets.push(`No earnings within ${horizon} days.`);
    } else {
      bullets.push(`Earnings in ${days} days.`);
    }
  } else if (input.calendar) {
    bullets.push("No upcoming earnings on calendar.");
  }

  return bullets;
};

export const buildExplanation = (input: ExplanationInput): ExplanationResult => {
  const rawBullets = buildWhyBullets(input);
  const riskFlags = new Set<RiskFlag>(input.riskFlags ?? []);
  if (input.calendar?.macroEvents && input.calendar.macroEvents.length > 0) {
    riskFlags.add("RISK_MACRO_EVENT");
  }
  if (input.calendar?.earnings?.daysToEarnings !== null && input.tradeDte !== null) {
    if (input.calendar.earnings.daysToEarnings <= input.tradeDte) {
      riskFlags.add("RISK_EARNINGS_WITHIN_TRADE");
    }
  }

  const prioritized = rawBullets.filter(Boolean);
  const limited = prioritized.slice(0, 6);

  const filled = [...limited];
  if (filled.length < 3) {
    if (input.score) {
      filled.push(`Score ${input.score.total}/100 with balanced breakdown.`);
    }
    if (filled.length < 3) {
      filled.push("Meets baseline filters for strategy evaluation.");
    }
  }

  return {
    why: filled.slice(0, 6),
    riskFlags: Array.from(riskFlags)
  };
};
