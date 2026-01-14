Perfect. We’re locking this in and moving from **brainstorming → specification**.

Below is a **clean, build-ready MVP PRD** that directly reflects your trading philosophy, risk tolerances, and practical constraints. This is written so it can be handed to *you-in-3-weeks* and still make sense.

---

# OPTIONS INCOME QUALIFIER — MVP PRD

**Internal name:** *Hercules (Sell-Side Options Underwriter)*
**Working goal:** Qualify, rank, and explain *safe, repeatable* option-selling opportunities.

---

## 1. Product Objective

Create a web-based decision-support tool that:

* Screens equities suitable for **sell-side option strategies**
* Eliminates **bad risk** before premium is considered
* Produces **clear, explainable trade candidates**
* Prioritizes **capital preservation + consistency** over max yield

> This tool behaves like an **insurance underwriter**, not a signal generator.

---

## 2. Supported Strategies (MVP)

Sell-side only:

* Cash-Secured Puts (CSP)
* Put Credit Spreads (PCS)
* Call Credit Spreads (CCS)
* Covered Calls (CC)

**Key behavioral rule**

* Assignment is acceptable *only* for fundamentally strong, well-capitalized stocks
* Defined-risk structures preferred otherwise

---

## 3. Equity Universe Definition

### 3.1 Hard Exclusions

* Non-US equities (no ADRs, no internationals)
* Meme stocks (auto-flagged)
* Extremely illiquid options chains

### 3.2 Preferred Profile

* Large-cap growth or value
* Fundamentally “holdable” under assignment
* Small/mid caps allowed but penalized in scoring

---

## 4. Core Screening Rules

### 4.1 Liquidity (Hard Filter)

| Metric           | Requirement             |
| ---------------- | ----------------------- |
| Avg stock volume | ≥ 1M shares/day         |
| Options spread   | ≤ 5% of mid             |
| Open Interest    | ≥ 500 near short strike |

Fail → **auto-disqualify**

---

### 4.2 Volatility Rules

| Rule               | Behavior                           |
| ------------------ | ---------------------------------- |
| Min IV             | ≥ 30%                              |
| Rapid IV expansion | Penalize confidence                |
| IV crush           | Allowed, but premium score reduced |

---

### 4.3 Time Rules

* Expirations: **30–60 DTE only**
* Rank expirations inside window (do not filter to one)

---

## 5. Directional & Technical Logic

### 5.1 Market-First Bias

1. Determine market regime (SPY/QQQ proxy)
2. Align stock bias with market bias
3. Strategy selection:

   * Bullish/neutral → CSP / PCS
   * Neutral/bearish → CCS / CC

---

### 5.2 Technical Anchors Used

* Support / resistance
* 50 / 100 / 200 DMA
* Prior highs / lows

---

### 5.3 Strike Selection Rules (Critical)

* **Never ATM**
* Default short strike distance: **15–20% OTM**
* Delta constraints:

  * Spreads: **0.10–0.20**
  * CSP: **0.15–0.25**

If no strike satisfies:

> **“NO TRADE”**

---

## 6. Event Risk Handling

### Earnings

* Allowed **only if strikes are far OTM**
* Earnings proximity → confidence penalty + risk flag

### Macro Events

* CPI / FOMC / Fed events
* No disqualification, but confidence penalty

---

## 7. Risk Management Constraints

| Rule            | Value                              |
| --------------- | ---------------------------------- |
| Max per trade   | 5% of account                      |
| Max per ticker  | 1 active position                  |
| Sector exposure | ≤ 25%                              |
| Correlation     | Penalize stacking correlated names |

---

## 8. Scoring Engine (0–100)

### 8.1 Score Breakdown

| Component                  | Weight |
| -------------------------- | ------ |
| Fundamentals / Holdability | 30     |
| Liquidity & Execution      | 20     |
| Volatility Quality         | 20     |
| Trend & Technical Safety   | 20     |
| Event Risk                 | 10     |

---

### 8.2 Score Interpretation

| Score  | Meaning                          |
| ------ | -------------------------------- |
| 80–100 | High-confidence income candidate |
| 65–79  | Acceptable, review risk flags    |
| <65    | Pass                             |

---

## 9. Trade Output (MVP UI)

For each qualified opportunity:

### Trade Summary

* Ticker
* Strategy type
* Expiration
* Short / long strikes
* % OTM
* Credit received
* Max loss
* Break-even

### Risk & Probability

* Theta/day
* POP
* Short-strike delta
* IV level + IV trend

### Context

* Earnings distance
* Macro events
* Liquidity stats

### Explainability (Non-negotiable)

* **Why this trade qualifies**
* **Confidence score**
* **Risk flags**

  * ⚠ Earnings proximity
  * ⚠ High beta
  * ⚠ Wide spreads
  * ⚠ Correlated exposure
  * ⚠ IV spike

---

## 10. Data Architecture (MVP)

### Market & Options Data

* **Alpaca API**

  * Price data
  * Options chains
  * Greeks

### Fundamentals

* **Financial Modeling Prep (Free tier)**

  * Market cap
  * Profitability metrics
  * Sector / industry
  * Basic balance sheet sanity

> Zero paid APIs required for MVP.

---

## 11. Tech Architecture (Aligned to Your Stack)

### Frontend

* NextJS (App Router)
* React + TypeScript
* TailwindCSS
* Server Components for data-heavy views

### Backend

* NextJS API routes (Node)
* Scoring engine as pure TS module
* Cached responses (per ticker / per expiration)

### Data Flow

```
Universe → Filters → Scoring Engine → Trade Generator → Ranked Output
```

---

## 12. What This Tool Will NOT Do (By Design)

* No trade execution
* No prediction of direction
* No optimization for max premium
* No “alerts spam”

This is a **qualification engine**, not a trading bot.

---

## 13. Phase 2 (Already Designed For)

* Alternative strike ranking
* Portfolio-aware exposure modeling
* Assignment probability modeling
* Backtesting confidence scores
* Strategy-specific dashboards

