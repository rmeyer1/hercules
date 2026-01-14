import type { CalendarSnapshot, RiskFlag } from "@/src/lib/types";

export type RiskFlagOptions = {
  earningsThresholdDays?: number;
  macroHorizonDays?: number;
};

export const deriveCalendarRiskFlags = (
  calendar: CalendarSnapshot,
  options: RiskFlagOptions = {}
): RiskFlag[] => {
  const flags: RiskFlag[] = [];
  const earningsThreshold = options.earningsThresholdDays ?? 7;

  if (
    calendar.earnings.daysToEarnings !== null &&
    calendar.earnings.daysToEarnings <= earningsThreshold
  ) {
    flags.push("EARNINGS_SOON");
  }

  if (calendar.macroEvents.length > 0) {
    flags.push("MACRO_EVENT");
  }

  return flags;
};
