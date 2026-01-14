import type { CalendarSnapshot, RiskFlag } from "@/src/lib/types";

export type EventScoreConfig = {
  earningsPenalty: number;
  macroPenalty: number;
  macroHorizonDays: number;
};

export type EventScoreOutput = {
  scoreMultiplier: number;
  riskFlags: RiskFlag[];
};

const DEFAULT_CONFIG: EventScoreConfig = {
  earningsPenalty: 0.4,
  macroPenalty: 0.2,
  macroHorizonDays: 14
};

const withinHorizon = (daysToEvent: number | null, horizon: number) => {
  if (daysToEvent === null) return false;
  return daysToEvent >= 0 && daysToEvent <= horizon;
};

export const scoreEventRisk = (
  baseFlags: RiskFlag[],
  calendar: CalendarSnapshot | null,
  tradeDte: number | null,
  config: EventScoreConfig = DEFAULT_CONFIG
): EventScoreOutput => {
  const riskFlags = new Set<RiskFlag>(baseFlags);
  let scoreMultiplier = 1;

  if (calendar?.earnings && tradeDte !== null) {
    const withinTrade = withinHorizon(calendar.earnings.daysToEarnings, tradeDte);
    if (withinTrade) {
      riskFlags.add("RISK_EARNINGS_WITHIN_TRADE");
      scoreMultiplier -= config.earningsPenalty;
    }
  }

  if (calendar?.macroEvents && calendar.macroEvents.length > 0) {
    riskFlags.add("RISK_MACRO_EVENT");
    scoreMultiplier -= config.macroPenalty;
  }

  return {
    scoreMultiplier: Math.max(0, scoreMultiplier),
    riskFlags: Array.from(riskFlags)
  };
};
