import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { QualifiedCandidate, TradeCandidate } from "@/src/lib/types";
import {
  CandidateDetailsDrawer,
  QualifiedTradesTable,
  filterCandidates,
  sortCandidates
} from "../qualify-dashboard";

type CandidateRow = QualifiedCandidate & { candidate: TradeCandidate };

const makeCandidate = (overrides: Partial<TradeCandidate> = {}): CandidateRow => {
  const trade: TradeCandidate = {
    id: "AAPL-CSP-2024-10-18",
    ticker: "AAPL",
    strategy: "CSP",
    expiration: "2024-10-18",
    dte: 45,
    shortStrike: 170,
    longStrike: 165,
    credit: 1.2,
    maxLoss: 3.8,
    breakEven: 168.8,
    pop: 0.72,
    thetaPerDay: 0.12,
    shortDelta: 0.18,
    iv: 0.35,
    ivTrend: "stable",
    riskFlags: [],
    score: {
      fundamentals: 20,
      liquidity: 18,
      volatility: 17,
      trend: 16,
      eventRisk: 9,
      total: 80
    },
    ...overrides
  };

  return {
    ticker: trade.ticker,
    candidate: trade,
    sizing: {
      requiredCollateral: 380,
      allocationPct: 0.4,
      withinLimit: true
    }
  };
};

describe("qualify dashboard", () => {
  it("renders the qualified trades table from data", () => {
    const candidates = [makeCandidate()];

    render(
      <QualifiedTradesTable
        candidates={candidates}
        compact={false}
        onSelect={() => undefined}
        sort={{ key: "score", direction: "desc" }}
        onSortChange={() => undefined}
      />
    );

    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("CSP")).toBeInTheDocument();
    expect(screen.getByText("2024-10-18")).toBeInTheDocument();
  });

  it("filters and sorts candidates", () => {
    const first = makeCandidate({
      ticker: "AAPL",
      score: { fundamentals: 20, liquidity: 18, volatility: 17, trend: 16, eventRisk: 9, total: 80 }
    });
    const second = makeCandidate({
      ticker: "MSFT",
      score: { fundamentals: 18, liquidity: 16, volatility: 14, trend: 12, eventRisk: 8, total: 68 }
    });

    const filtered = filterCandidates([first, second], {
      search: "AAP",
      strategies: ["CSP"],
      minScore: 70,
      minPop: null,
      dteMin: null,
      dteMax: null,
      includeRiskFlags: [],
      excludeRiskFlags: []
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].candidate.ticker).toBe("AAPL");

    const sorted = sortCandidates([second, first], { key: "score", direction: "desc" });
    expect(sorted[0].candidate.ticker).toBe("AAPL");
  });

  it("opens the drawer with the selected candidate", () => {
    const candidates = [makeCandidate()];

    const Wrapper = () => {
      const [state, setState] = useState({ open: false, candidate: null as CandidateRow | null });
      return (
        <>
          <QualifiedTradesTable
            candidates={candidates}
            compact={false}
            onSelect={(candidate) => setState({ open: true, candidate })}
            sort={{ key: "score", direction: "desc" }}
            onSortChange={() => undefined}
          />
          <CandidateDetailsDrawer
            state={state}
            onClose={() => setState({ open: false, candidate: null })}
          />
        </>
      );
    };

    render(<Wrapper />);

    fireEvent.click(screen.getByText("AAPL"));
    expect(screen.getByText("AAPL · CSP")).toBeInTheDocument();
  });
});
