export type MacroEventType = "CPI" | "FOMC";

export type MacroEvent = {
  type: MacroEventType;
  date: string;
  label: string;
};

export type EarningsInfo = {
  earningsDate: string | null;
  daysToEarnings: number | null;
};

export type CalendarSnapshot = {
  symbol: string;
  earnings: EarningsInfo;
  macroEvents: MacroEvent[];
};
