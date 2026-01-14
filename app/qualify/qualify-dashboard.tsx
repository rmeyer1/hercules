"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  DisqualifiedTicker,
  QualifyRequest,
  QualifyResponse,
  QualifiedCandidate,
  RiskFlag,
  StrategyType,
  TradeCandidate
} from "@/src/lib/types";

const STRATEGIES: StrategyType[] = ["CSP", "PCS", "CCS", "CC"];

const RISK_FLAG_LABELS: Record<RiskFlag, string> = {
  EARNINGS_SOON: "Earnings soon",
  MACRO_EVENT: "Macro event",
  WIDE_SPREADS: "Wide spreads",
  LOW_OI: "Low open interest",
  VOLATILITY_SPIKE: "Volatility spike",
  RISK_IV_SPIKE: "IV spike",
  RISK_EARNINGS_WITHIN_TRADE: "Earnings inside trade",
  RISK_MACRO_EVENT: "Macro event",
  RISK_TREND_CONFLICT: "Trend conflict",
  RISK_CORRELATED_EXPOSURE: "Correlated exposure",
  RISK_SECTOR_CONCENTRATION: "Sector concentration"
};

const SCORE_KEYS: Array<{ key: SortKey; label: string }> = [
  { key: "score", label: "Score" },
  { key: "theta", label: "Theta/day" },
  { key: "pop", label: "POP" },
  { key: "credit", label: "Credit" },
  { key: "maxLoss", label: "Max loss" },
  { key: "dte", label: "DTE" },
  { key: "strategy", label: "Strategy" }
];

type SortKey =
  | "score"
  | "theta"
  | "pop"
  | "credit"
  | "maxLoss"
  | "dte"
  | "strategy";

type SortState = { key: SortKey; direction: "asc" | "desc" };

type FiltersState = {
  search: string;
  strategies: StrategyType[];
  minScore: number | null;
  minPop: number | null;
  dteMin: number | null;
  dteMax: number | null;
  includeRiskFlags: RiskFlag[];
  excludeRiskFlags: RiskFlag[];
};

type CandidateRow = QualifiedCandidate & { candidate: TradeCandidate };

type DrawerState = { open: boolean; candidate: CandidateRow | null };

type ExportMode = "qualified" | "disqualified";

const defaultFilters = (strategies: StrategyType[]): FiltersState => ({
  search: "",
  strategies,
  minScore: null,
  minPop: null,
  dteMin: null,
  dteMax: null,
  includeRiskFlags: [],
  excludeRiskFlags: []
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1
});

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatNumber = (value: number) => numberFormatter.format(value);
const formatPercent = (value: number) => percentFormatter.format(value);

const formatDateTime = (value: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString();
};

export const normalizeTickers = (raw: string): string[] => {
  return raw
    .split(/[\n,]+/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
};

const formatTickersForInput = (tickers: string[]) => tickers.join(", ");

const buildCandidateRows = (candidates: QualifiedCandidate[]): CandidateRow[] => {
  return candidates
    .map((candidate) => {
      const trade = candidate.candidate as TradeCandidate;
      if (!trade || !trade.ticker) return null;
      return { ...candidate, candidate: trade } satisfies CandidateRow;
    })
    .filter((candidate): candidate is CandidateRow => Boolean(candidate));
};

const extractRiskFlags = (candidates: CandidateRow[]): RiskFlag[] => {
  const flags = new Set<RiskFlag>();
  candidates.forEach((candidate) => {
    candidate.candidate.riskFlags.forEach((flag) => flags.add(flag));
  });
  return Array.from(flags);
};

export const filterCandidates = (
  candidates: CandidateRow[],
  filters: FiltersState
): CandidateRow[] => {
  const search = filters.search.trim().toUpperCase();

  return candidates.filter((candidate) => {
    const trade = candidate.candidate;

    if (filters.strategies.length === 0) return false;
    if (!filters.strategies.includes(trade.strategy)) {
      return false;
    }

    if (search && !trade.ticker.includes(search)) {
      return false;
    }

    if (filters.minScore !== null && trade.score.total < filters.minScore) {
      return false;
    }

    if (filters.minPop !== null && trade.pop < filters.minPop) {
      return false;
    }

    if (filters.dteMin !== null && trade.dte < filters.dteMin) {
      return false;
    }

    if (filters.dteMax !== null && trade.dte > filters.dteMax) {
      return false;
    }

    if (filters.includeRiskFlags.length > 0) {
      const hasAll = filters.includeRiskFlags.every((flag) =>
        trade.riskFlags.includes(flag)
      );
      if (!hasAll) return false;
    }

    if (filters.excludeRiskFlags.length > 0) {
      const hasExcluded = filters.excludeRiskFlags.some((flag) =>
        trade.riskFlags.includes(flag)
      );
      if (hasExcluded) return false;
    }

    return true;
  });
};

export const sortCandidates = (
  candidates: CandidateRow[],
  sort: SortState
): CandidateRow[] => {
  const direction = sort.direction === "asc" ? 1 : -1;

  return [...candidates].sort((a, b) => {
    const tradeA = a.candidate;
    const tradeB = b.candidate;

    const compare = (valueA: number | string, valueB: number | string) => {
      if (valueA < valueB) return -1 * direction;
      if (valueA > valueB) return 1 * direction;
      return 0;
    };

    switch (sort.key) {
      case "theta":
        return compare(tradeA.thetaPerDay, tradeB.thetaPerDay);
      case "pop":
        return compare(tradeA.pop, tradeB.pop);
      case "credit":
        return compare(tradeA.credit, tradeB.credit);
      case "maxLoss":
        return compare(tradeA.maxLoss, tradeB.maxLoss);
      case "dte":
        return compare(tradeA.dte, tradeB.dte);
      case "strategy":
        return compare(tradeA.strategy, tradeB.strategy);
      case "score":
      default:
        return compare(tradeA.score.total, tradeB.score.total);
    }
  });
};

const buildQualifiedCsv = (candidates: CandidateRow[]) => {
  const headers = [
    "Ticker",
    "Strategy",
    "Expiration",
    "DTE",
    "Short Strike",
    "Long Strike",
    "Credit",
    "Max Loss",
    "Theta/day",
    "POP",
    "Delta",
    "Score",
    "Risk Flags"
  ];

  const rows = candidates.map((candidate) => {
    const trade = candidate.candidate;
    return [
      trade.ticker,
      trade.strategy,
      trade.expiration,
      trade.dte,
      trade.shortStrike,
      trade.longStrike ?? "",
      trade.credit,
      trade.maxLoss,
      trade.thetaPerDay,
      trade.pop,
      trade.shortDelta,
      trade.score.total,
      trade.riskFlags.join(" | ")
    ];
  });

  return [headers, ...rows].map((row) => row.join(",")).join("\n");
};

const buildDisqualifiedCsv = (disqualified: DisqualifiedTicker[]) => {
  const headers = ["Ticker", "Reasons"];
  const rows = disqualified.map((item) => [item.ticker, item.reasons.join(" | ")]);
  return [headers, ...rows].map((row) => row.join(",")).join("\n");
};

const downloadCsv = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const buildTradeSummary = (candidate: TradeCandidate) => {
  const strikeInfo = candidate.longStrike
    ? `${candidate.shortStrike}/${candidate.longStrike}`
    : `${candidate.shortStrike}`;

  return [
    `${candidate.ticker} ${candidate.strategy}`,
    `Expiration ${candidate.expiration} (${candidate.dte} DTE)`,
    `Strikes ${strikeInfo}`,
    `Credit ${formatCurrency(candidate.credit)}`,
    `Max loss ${formatCurrency(candidate.maxLoss)}`,
    `POP ${formatPercent(candidate.pop)}`,
    `Theta/day ${formatNumber(candidate.thetaPerDay)}`,
    `Score ${formatNumber(candidate.score.total)}`
  ].join("\n");
};

const selectRiskFlag = (flags: RiskFlag[], flag: RiskFlag) => {
  if (flags.includes(flag)) return flags.filter((item) => item !== flag);
  return [...flags, flag];
};

const inputNumber = (value: number | null) => (value === null ? "" : value);

const parseNumber = (value: string) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const useFocusTrap = (open: boolean, containerRef: RefObject<HTMLDivElement>) => {
  useEffect(() => {
    if (!open || !containerRef.current) return;

    const focusables = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      )
    );

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        (containerRef.current as HTMLDivElement | null)?.dispatchEvent(
          new CustomEvent("drawer:escape", { bubbles: true })
        );
      }

      if (event.key !== "Tab" || focusables.length === 0) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeydown);
    first?.focus();

    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open, containerRef]);
};

const toggleStrategy = (current: StrategyType[], next: StrategyType) => {
  if (current.includes(next)) return current.filter((item) => item !== next);
  return [...current, next];
};

const hasActiveFilters = (filters: FiltersState, baseStrategies: StrategyType[]) => {
  return (
    filters.search.length > 0 ||
    filters.minScore !== null ||
    filters.minPop !== null ||
    filters.dteMin !== null ||
    filters.dteMax !== null ||
    filters.includeRiskFlags.length > 0 ||
    filters.excludeRiskFlags.length > 0 ||
    filters.strategies.length !== baseStrategies.length ||
    !filters.strategies.every((strategy) => baseStrategies.includes(strategy))
  );
};

const sameStrategySet = (a: StrategyType[], b: StrategyType[]) => {
  if (a.length !== b.length) return false;
  return a.every((strategy) => b.includes(strategy));
};

const parseQueryFilters = (
  params: URLSearchParams,
  fallback: FiltersState,
  availableRiskFlags: RiskFlag[]
): FiltersState => {
  const paramStrategies = params.get("strategy")?.split("|").filter(Boolean) ?? [];
  const strategies = paramStrategies.length
    ? paramStrategies.filter((item): item is StrategyType => STRATEGIES.includes(item as StrategyType))
    : fallback.strategies;

  const parseRiskFlags = (value: string | null) => {
    if (!value) return [];
    return value
      .split("|")
      .filter((flag): flag is RiskFlag => availableRiskFlags.includes(flag as RiskFlag));
  };

  return {
    ...fallback,
    search: params.get("search") ?? fallback.search,
    minScore: parseNumber(params.get("minScore") ?? "") ?? fallback.minScore,
    minPop: parseNumber(params.get("minPop") ?? "") ?? fallback.minPop,
    dteMin: parseNumber(params.get("dteMin") ?? "") ?? fallback.dteMin,
    dteMax: parseNumber(params.get("dteMax") ?? "") ?? fallback.dteMax,
    strategies,
    includeRiskFlags: parseRiskFlags(params.get("includeRisk")),
    excludeRiskFlags: parseRiskFlags(params.get("excludeRisk"))
  };
};

const buildSearchParams = (filters: FiltersState, sort: SortState, showDisqualified: boolean) => {
  const params = new URLSearchParams();

  if (filters.search) params.set("search", filters.search);
  if (filters.minScore !== null) params.set("minScore", String(filters.minScore));
  if (filters.minPop !== null) params.set("minPop", String(filters.minPop));
  if (filters.dteMin !== null) params.set("dteMin", String(filters.dteMin));
  if (filters.dteMax !== null) params.set("dteMax", String(filters.dteMax));
  if (filters.strategies.length > 0) params.set("strategy", filters.strategies.join("|"));
  if (filters.includeRiskFlags.length > 0)
    params.set("includeRisk", filters.includeRiskFlags.join("|"));
  if (filters.excludeRiskFlags.length > 0)
    params.set("excludeRisk", filters.excludeRiskFlags.join("|"));

  params.set("sort", `${sort.key}_${sort.direction}`);
  params.set("showDisq", showDisqualified ? "1" : "0");

  return params;
};

const parseSortParam = (value: string | null): SortState => {
  if (!value) return { key: "score", direction: "desc" };
  const [key, direction] = value.split("_");
  if (!key || (direction !== "asc" && direction !== "desc")) {
    return { key: "score", direction: "desc" };
  }

  if (!SCORE_KEYS.find((item) => item.key === key)) {
    return { key: "score", direction: "desc" };
  }

  return { key: key as SortKey, direction };
};

const StrategyMultiSelect = ({
  value,
  onChange,
  label
}: {
  value: StrategyType[];
  onChange: (next: StrategyType[]) => void;
  label?: string;
}) => {
  return (
    <div className="space-y-2">
      {label ? (
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
          {label}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {STRATEGIES.map((strategy) => {
          const active = value.includes(strategy);
          return (
            <button
              key={strategy}
              type="button"
              onClick={() => onChange(toggleStrategy(value, strategy))}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                active
                  ? "bg-ink text-white"
                  : "border border-black/10 bg-white text-black/60 hover:text-ink"
              }`}
            >
              {strategy}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const Toggle = ({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) => (
  <label className="inline-flex items-center gap-2 text-xs font-semibold text-black/70">
    <span className="relative inline-flex h-6 w-11 items-center rounded-full border border-black/10 bg-white">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="h-5 w-5 translate-x-0.5 rounded-full bg-black/20 transition peer-checked:translate-x-5 peer-checked:bg-ember" />
    </span>
    {label}
  </label>
);

export const QualifiedTradesTable = ({
  candidates,
  compact,
  onSelect,
  sort,
  onSortChange
}: {
  candidates: CandidateRow[];
  compact: boolean;
  onSelect: (candidate: CandidateRow) => void;
  sort: SortState;
  onSortChange: (next: SortState) => void;
}) => {
  const handleSort = (key: SortKey) => {
    if (sort.key === key) {
      onSortChange({ key, direction: sort.direction === "asc" ? "desc" : "asc" });
      return;
    }
    onSortChange({ key, direction: "desc" });
  };

  const renderSortIndicator = (key: SortKey) => {
    if (sort.key !== key) return "";
    return sort.direction === "asc" ? "↑" : "↓";
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/90">
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-[#f8f5ef] text-[11px] uppercase tracking-[0.2em] text-black/50">
            <tr>
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => handleSort("strategy")}>
                  Strategy {renderSortIndicator("strategy")}
                </button>
              </th>
              <th className="px-4 py-3">Expiration</th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => handleSort("dte")}>
                  DTE {renderSortIndicator("dte")}
                </button>
              </th>
              <th className="px-4 py-3">Strikes</th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => handleSort("credit")}>
                  Credit {renderSortIndicator("credit")}
                </button>
              </th>
              {!compact ? (
                <th className="px-4 py-3">
                  <button type="button" onClick={() => handleSort("maxLoss")}>
                    Max loss {renderSortIndicator("maxLoss")}
                  </button>
                </th>
              ) : null}
              <th className="px-4 py-3">
                <button type="button" onClick={() => handleSort("theta")}>
                  Theta/day {renderSortIndicator("theta")}
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => handleSort("pop")}>
                  POP {renderSortIndicator("pop")}
                </button>
              </th>
              {!compact ? <th className="px-4 py-3">Delta</th> : null}
              <th className="px-4 py-3">
                <button type="button" onClick={() => handleSort("score")}>
                  Score {renderSortIndicator("score")}
                </button>
              </th>
              {!compact ? <th className="px-4 py-3">Risk flags</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 text-sm">
            {candidates.map((item) => {
              const trade = item.candidate;
              const strikes = trade.longStrike
                ? `${trade.shortStrike}/${trade.longStrike}`
                : `${trade.shortStrike}`;

              return (
                <tr
                  key={trade.id}
                  className="cursor-pointer transition hover:bg-black/5"
                  onClick={() => onSelect(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(item);
                    }
                  }}
                  tabIndex={0}
                >
                  <td className="px-4 py-3 font-semibold text-ink">{trade.ticker}</td>
                  <td className="px-4 py-3 text-black/70">{trade.strategy}</td>
                  <td className="px-4 py-3 text-black/70">{trade.expiration}</td>
                  <td className="px-4 py-3 text-black/70">{trade.dte}</td>
                  <td className="px-4 py-3 text-black/70">{strikes}</td>
                  <td className="px-4 py-3 text-black/70">{formatCurrency(trade.credit)}</td>
                  {!compact ? (
                    <td className="px-4 py-3 text-black/70">
                      {formatCurrency(trade.maxLoss)}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-black/70">
                    {formatNumber(trade.thetaPerDay)}
                  </td>
                  <td className="px-4 py-3 text-black/70">{formatPercent(trade.pop)}</td>
                  {!compact ? (
                    <td className="px-4 py-3 text-black/70">
                      {formatNumber(trade.shortDelta)}
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-ember/10 px-3 py-1 text-xs font-semibold text-ember">
                      {formatNumber(trade.score.total)}
                    </span>
                  </td>
                  {!compact ? (
                    <td className="px-4 py-3 text-xs text-black/60">
                      {trade.riskFlags.length ? (
                        <div className="flex flex-wrap gap-2">
                          {trade.riskFlags.map((flag) => (
                            <span
                              key={flag}
                              className="rounded-full bg-black/5 px-2 py-1"
                            >
                              {RISK_FLAG_LABELS[flag] ?? flag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-black/40">None</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const DisqualifiedTable = ({ disqualified }: { disqualified: DisqualifiedTicker[] }) => (
  <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-black/50">
        Disqualified tickers
      </h3>
      <span className="text-xs text-black/50">{disqualified.length} total</span>
    </div>
    <div className="mt-4 space-y-4">
      {disqualified.length === 0 ? (
        <p className="text-sm text-black/60">No disqualified tickers in this scan.</p>
      ) : (
        disqualified.map((item) => (
          <div key={item.ticker} className="rounded-xl border border-black/5 bg-white p-4">
            <p className="text-sm font-semibold text-ink">{item.ticker}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-black/70">
              {item.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  </div>
);

export const CandidateDetailsDrawer = ({
  state,
  onClose
}: {
  state: DrawerState;
  onClose: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(state.open, containerRef);

  useEffect(() => {
    const handler = () => onClose();
    const node = containerRef.current;
    if (!node) return;
    node.addEventListener("drawer:escape", handler as EventListener);
    return () => node.removeEventListener("drawer:escape", handler as EventListener);
  }, [onClose]);

  if (!state.open || !state.candidate) return null;

  const trade = state.candidate.candidate;
  const strikeInfo = trade.longStrike
    ? `${trade.shortStrike}/${trade.longStrike}`
    : `${trade.shortStrike}`;

  const handleCopy = async (mode: "summary" | "json" | "csv") => {
    if (mode === "csv") {
      const csv = buildQualifiedCsv([state.candidate]);
      await navigator.clipboard.writeText(csv);
      return;
    }

    if (mode === "json") {
      await navigator.clipboard.writeText(JSON.stringify(trade, null, 2));
      return;
    }

    await navigator.clipboard.writeText(buildTradeSummary(trade));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-4 py-6 md:items-stretch md:justify-end"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-6 shadow-xl md:h-full md:max-w-md md:rounded-none"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-black/50">Candidate</p>
            <h3 className="text-2xl font-semibold text-ink">
              {trade.ticker} · {trade.strategy}
            </h3>
            <p className="mt-1 text-xs text-black/60">
              {trade.expiration} · {trade.dte} DTE
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-black/70"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <section className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
            <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
              Trade summary
            </h4>
            <div className="mt-3 grid gap-3 text-sm text-black/70">
              <div className="flex items-center justify-between">
                <span>Strikes</span>
                <span className="font-semibold text-ink">{strikeInfo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Credit</span>
                <span className="font-semibold text-ink">{formatCurrency(trade.credit)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Max loss</span>
                <span className="font-semibold text-ink">{formatCurrency(trade.maxLoss)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Break-even</span>
                <span className="font-semibold text-ink">{formatCurrency(trade.breakEven)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Theta/day</span>
                <span className="font-semibold text-ink">{formatNumber(trade.thetaPerDay)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>POP</span>
                <span className="font-semibold text-ink">{formatPercent(trade.pop)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Delta</span>
                <span className="font-semibold text-ink">{formatNumber(trade.shortDelta)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-black/10 bg-white p-4">
            <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
              Confidence score
            </h4>
            <div className="mt-3 rounded-2xl border border-black/5 bg-ember/10 px-4 py-3 text-center">
              <p className="text-3xl font-semibold text-ember">{formatNumber(trade.score.total)}</p>
              <p className="text-xs uppercase tracking-[0.3em] text-black/50">Overall</p>
            </div>
            <div className="mt-3 space-y-2 text-xs text-black/70">
              {(
                [
                  ["Fundamentals", trade.score.fundamentals],
                  ["Liquidity", trade.score.liquidity],
                  ["Volatility", trade.score.volatility],
                  ["Trend", trade.score.trend],
                  ["Event risk", trade.score.eventRisk]
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <span>{label}</span>
                  <span className="font-semibold text-ink">{formatNumber(value)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-black/10 bg-white p-4">
            <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
              Risk flags
            </h4>
            <div className="mt-3">
              {trade.riskFlags.length === 0 ? (
                <p className="text-sm text-black/60">No risk flags returned.</p>
              ) : (
                <ul className="space-y-2 text-xs text-black/70">
                  {trade.riskFlags.map((flag) => (
                    <li key={flag} className="rounded-xl border border-black/5 bg-black/5 px-3 py-2">
                      <p className="text-sm font-semibold text-ink">
                        {RISK_FLAG_LABELS[flag] ?? flag}
                      </p>
                      <p className="text-xs text-black/60">Flag requires manual review.</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-black/10 bg-white p-4">
            <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
              Position sizing
            </h4>
            <div className="mt-3 space-y-2 text-xs text-black/70">
              <div className="flex items-center justify-between">
                <span>Required collateral</span>
                <span className="font-semibold text-ink">
                  {formatCurrency(state.candidate.sizing.requiredCollateral)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Allocation</span>
                <span className="font-semibold text-ink">
                  {formatPercent(state.candidate.sizing.allocationPct)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Within limit</span>
                <span
                  className={`font-semibold ${
                    state.candidate.sizing.withinLimit ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {state.candidate.sizing.withinLimit ? "Yes" : "No"}
                </span>
              </div>
              {state.candidate.sizing.warning ? (
                <p className="text-xs text-amber-600">{state.candidate.sizing.warning}</p>
              ) : null}
            </div>
          </section>

          <section className="space-y-2">
            <button
              type="button"
              onClick={() => handleCopy("summary")}
              className="w-full rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-black/70"
            >
              Copy trade summary
            </button>
            <button
              type="button"
              onClick={() => handleCopy("json")}
              className="w-full rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-black/70"
            >
              Copy JSON
            </button>
            <button
              type="button"
              onClick={() => handleCopy("csv")}
              className="w-full rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-black/70"
            >
              Copy CSV row
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

const ResultsHeaderBar = ({
  candidatesCount,
  disqualifiedCount,
  lastRunAt,
  showDisqualified,
  onToggleDisqualified,
  compactView,
  onToggleCompact,
  onExport
}: {
  candidatesCount: number;
  disqualifiedCount: number;
  lastRunAt: string | null;
  showDisqualified: boolean;
  onToggleDisqualified: (value: boolean) => void;
  compactView: boolean;
  onToggleCompact: (value: boolean) => void;
  onExport: (mode: ExportMode) => void;
}) => (
  <div className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white/80 p-4 md:flex-row md:items-center md:justify-between">
    <div className="flex flex-wrap items-center gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-black/50">Results</p>
        <div className="mt-1 flex items-center gap-4 text-sm text-black/70">
          <span className="font-semibold text-ink">{candidatesCount} qualified</span>
          <span>{disqualifiedCount} disqualified</span>
          <span>Last run {formatDateTime(lastRunAt)}</span>
        </div>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <Toggle
        checked={showDisqualified}
        onChange={onToggleDisqualified}
        label="Show disqualified"
      />
      <Toggle checked={compactView} onChange={onToggleCompact} label="Compact view" />
      <button
        type="button"
        className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-black/70"
        onClick={() => onExport("qualified")}
      >
        Export CSV
      </button>
      {showDisqualified ? (
        <button
          type="button"
          className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-black/70"
          onClick={() => onExport("disqualified")}
        >
          Export disqualified
        </button>
      ) : null}
    </div>
  </div>
);

const LoadingSkeleton = () => (
  <div className="rounded-2xl border border-black/10 bg-white/80 p-6">
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className="h-6 w-full animate-pulse rounded-full bg-black/5"
        />
      ))}
    </div>
  </div>
);

export const QualifyDashboard = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tickersInput, setTickersInput] = useState("");
  const [strategyFilters, setStrategyFilters] = useState<StrategyType[]>(STRATEGIES);
  const [accountSize, setAccountSize] = useState(100000);
  const [response, setResponse] = useState<QualifyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [showDisqualified, setShowDisqualified] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, candidate: null });

  const [filters, setFilters] = useState<FiltersState>(() => defaultFilters(STRATEGIES));
  const [sortState, setSortState] = useState<SortState>({
    key: "score",
    direction: "desc"
  });

  const normalizedTickers = useMemo(() => normalizeTickers(tickersInput), [tickersInput]);

  const candidates = useMemo(() => buildCandidateRows(response?.candidates ?? []), [response]);
  const disqualified = response?.disqualified ?? [];
  const availableRiskFlags = useMemo(() => extractRiskFlags(candidates), [candidates]);

  useEffect(() => {
    const stored = window.localStorage.getItem("qualify-controls");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as {
        tickers: string;
        accountSize: number;
        strategies: StrategyType[];
      };
      if (parsed.tickers) setTickersInput(parsed.tickers);
      if (parsed.accountSize) setAccountSize(parsed.accountSize);
      if (parsed.strategies?.length) setStrategyFilters(parsed.strategies);
      setFilters((prev) => ({ ...prev, strategies: parsed.strategies ?? prev.strategies }));
    } catch {
      // Ignore localStorage parse errors.
    }
  }, []);

  useEffect(() => {
    const payload = {
      tickers: tickersInput,
      accountSize,
      strategies: strategyFilters
    };
    window.localStorage.setItem("qualify-controls", JSON.stringify(payload));
  }, [tickersInput, accountSize, strategyFilters]);

  useEffect(() => {
    if (!searchParams) return;
    const nextSort = parseSortParam(searchParams.get("sort"));
    const nextShowDisq = searchParams.get("showDisq") === "1";
    const nextFilters = parseQueryFilters(
      new URLSearchParams(searchParams.toString()),
      defaultFilters(strategyFilters),
      availableRiskFlags
    );
    setSortState(nextSort);
    setShowDisqualified(nextShowDisq);
    setFilters(nextFilters);
    if (!sameStrategySet(strategyFilters, nextFilters.strategies)) {
      setStrategyFilters(nextFilters.strategies);
    }
  }, [searchParams, availableRiskFlags, strategyFilters]);

  useEffect(() => {
    const params = buildSearchParams(filters, sortState, showDisqualified);
    router.replace(`${pathname}?${params.toString()}`);
  }, [filters, sortState, showDisqualified, router, pathname]);

  const filteredCandidates = useMemo(() => {
    return filterCandidates(candidates, filters);
  }, [candidates, filters]);

  const sortedCandidates = useMemo(() => {
    return sortCandidates(filteredCandidates, sortState);
  }, [filteredCandidates, sortState]);

  const handleRunScan = async () => {
    const tickers = normalizeTickers(tickersInput);
    if (tickers.length === 0) return;

    setIsLoading(true);
    setError(null);

    const preferDefinedRisk =
      strategyFilters.length > 0 &&
      strategyFilters.every((strategy) => strategy === "PCS" || strategy === "CCS");

    const requestBody: QualifyRequest = {
      source: "MANUAL",
      tickers,
      accountSize,
      preferences: { preferDefinedRisk }
    };

    try {
      const res = await fetch("/api/qualify", {
        method: "POST",
        body: JSON.stringify(requestBody)
      });
      if (!res.ok) {
        throw new Error("Unable to run qualify scan.");
      }
      const data = (await res.json()) as QualifyResponse;
      setResponse(data);
      setLastRunAt(data.generatedAt ?? new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Qualify failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTickersBlur = () => {
    const normalized = normalizeTickers(tickersInput);
    setTickersInput(formatTickersForInput(normalized));
  };

  const handleExport = (mode: ExportMode) => {
    if (mode === "disqualified") {
      const csv = buildDisqualifiedCsv(disqualified);
      downloadCsv(csv, "disqualified-tickers.csv");
      return;
    }

    const csv = buildQualifiedCsv(sortedCandidates);
    downloadCsv(csv, "qualified-trades.csv");
  };

  const resetFilters = () => {
    setFilters(defaultFilters(strategyFilters));
  };

  const activeFilters = hasActiveFilters(filters, STRATEGIES);

  return (
    <section className="grid gap-8">
      <div className="rounded-3xl border border-black/10 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-black/50">
              Qualify dashboard
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-ink md:text-4xl">
              Ranked sell-side candidates
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-black/70">
              Run a qualify scan, filter by risk and strategy, then open a candidate for the full
              underwriting breakdown.
            </p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-xs text-black/60">
            <p className="text-xs uppercase tracking-[0.3em] text-black/50">Last run</p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {lastRunAt ? formatDateTime(lastRunAt) : "No scan yet"}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
                Manual tickers
              </label>
              <textarea
                className="mt-2 min-h-[110px] w-full rounded-2xl border border-black/10 bg-white/80 p-4 text-sm text-black/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-ember/40"
                placeholder="Paste tickers (AAPL, MSFT, NVDA)"
                value={tickersInput}
                onChange={(event) => setTickersInput(event.target.value)}
                onBlur={handleTickersBlur}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-black/60">
                <span>{normalizedTickers.length} tickers</span>
                <span>Normalized on blur</span>
              </div>
            </div>

            <StrategyMultiSelect
              value={strategyFilters}
              onChange={(next) => {
                setStrategyFilters(next);
                setFilters((prev) => ({ ...prev, strategies: next }));
              }}
              label="Strategies"
            />
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
                Account size
              </label>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-sm text-black/60">$</span>
                <input
                  type="number"
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/70"
                  value={accountSize}
                  min={0}
                  onChange={(event) => setAccountSize(Number(event.target.value))}
                />
              </div>
              <p className="mt-2 text-xs text-black/50">
                Used for allocation sizing in the results drawer.
              </p>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
                Universe
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-black/10 bg-ink px-4 py-2 text-xs font-semibold text-white"
                  disabled
                  title="Recommended universe is not enabled yet."
                >
                  Recommended universe (coming soon)
                </button>
              </div>
              <p className="mt-2 text-xs text-black/50">
                Manual tickers only for MVP qualification.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunScan}
              disabled={normalizedTickers.length === 0 || isLoading}
              className="w-full rounded-2xl bg-ember px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-ember/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Running scan..." : "Run scan"}
            </button>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
        </div>
      </div>

      {response ? (
        <ResultsHeaderBar
          candidatesCount={candidates.length}
          disqualifiedCount={disqualified.length}
          lastRunAt={lastRunAt}
          showDisqualified={showDisqualified}
          onToggleDisqualified={setShowDisqualified}
          compactView={compactView}
          onToggleCompact={setCompactView}
          onExport={handleExport}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {isLoading ? <LoadingSkeleton /> : null}

          {!isLoading && response && sortedCandidates.length === 0 ? (
            <div className="rounded-2xl border border-black/10 bg-white/80 p-6 text-sm text-black/70">
              <p className="font-semibold text-ink">No candidates qualified.</p>
              <p className="mt-2 text-sm text-black/60">
                Expand your ticker list or reduce strictness on filters to widen the universe.
              </p>
            </div>
          ) : null}

          {!isLoading && sortedCandidates.length > 0 ? (
            <QualifiedTradesTable
              candidates={sortedCandidates}
              compact={compactView}
              onSelect={(candidate) => setDrawer({ open: true, candidate })}
              sort={sortState}
              onSortChange={setSortState}
            />
          ) : null}

          {!isLoading && showDisqualified ? (
            <DisqualifiedTable disqualified={disqualified} />
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-black/10 bg-white/90 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
                Filters
              </h3>
              {activeFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-semibold text-ember"
                >
                  Clear filters
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
                  Search
                </label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/70"
                  placeholder="Ticker"
                />
              </div>

              <StrategyMultiSelect
                value={filters.strategies}
                onChange={(next) => setFilters((prev) => ({ ...prev, strategies: next }))}
                label="Strategy filter"
              />

              <div className="grid gap-3">
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
                  Score minimum
                </label>
                <input
                  type="number"
                  value={inputNumber(filters.minScore)}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, minScore: parseNumber(event.target.value) }))
                  }
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/70"
                />
              </div>

              <div className="grid gap-3">
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
                  POP minimum
                </label>
                <input
                  type="number"
                  value={inputNumber(filters.minPop)}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, minPop: parseNumber(event.target.value) }))
                  }
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/70"
                  step="0.05"
                  min="0"
                  max="1"
                />
              </div>

              <div className="grid gap-3">
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
                  DTE range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={inputNumber(filters.dteMin)}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, dteMin: parseNumber(event.target.value) }))
                    }
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/70"
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    value={inputNumber(filters.dteMax)}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, dteMax: parseNumber(event.target.value) }))
                    }
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/70"
                    placeholder="Max"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
                  Risk flags
                </label>
                <div className="mt-3 space-y-3">
                  {availableRiskFlags.length === 0 ? (
                    <p className="text-xs text-black/50">No risk flags found.</p>
                  ) : (
                    availableRiskFlags.map((flag) => (
                      <label
                        key={flag}
                        className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black/70"
                      >
                        <span>{RISK_FLAG_LABELS[flag] ?? flag}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                              filters.includeRiskFlags.includes(flag)
                                ? "bg-emerald-500 text-white"
                                : "border border-black/10 text-black/40"
                            }`}
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                includeRiskFlags: selectRiskFlag(prev.includeRiskFlags, flag)
                              }))
                            }
                          >
                            Include
                          </button>
                          <button
                            type="button"
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                              filters.excludeRiskFlags.includes(flag)
                                ? "bg-amber-500 text-white"
                                : "border border-black/10 text-black/40"
                            }`}
                            onClick={() =>
                              setFilters((prev) => ({
                                ...prev,
                                excludeRiskFlags: selectRiskFlag(prev.excludeRiskFlags, flag)
                              }))
                            }
                          >
                            Exclude
                          </button>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
                  Sort by
                </label>
                <div className="mt-2 grid gap-2">
                  {SCORE_KEYS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        setSortState((prev) => ({
                          key: item.key,
                          direction: prev.key === item.key ? prev.direction : "desc"
                        }))
                      }
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                        sortState.key === item.key
                          ? "border-ember/50 bg-ember/10 text-ember"
                          : "border-black/10 bg-white text-black/60"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white/90 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-black/50">
              Scan status
            </h3>
            <div className="mt-3 space-y-2 text-xs text-black/60">
              <div className="flex items-center justify-between">
                <span>Qualified rows</span>
                <span className="font-semibold text-ink">{sortedCandidates.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Disqualified rows</span>
                <span className="font-semibold text-ink">{disqualified.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Filters active</span>
                <span className="font-semibold text-ink">{activeFilters ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <CandidateDetailsDrawer
        state={drawer}
        onClose={() => setDrawer({ open: false, candidate: null })}
      />
    </section>
  );
};
