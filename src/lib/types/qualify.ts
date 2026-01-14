import type { RecommendationProfile, UniverseSource } from "@/src/lib/types";
import type { UserPreferences } from "@/src/lib/types";

export type QualifyRequest = {
  source: UniverseSource;
  tickers?: string[];
  recommendationProfile?: RecommendationProfile;
  accountSize: number;
  preferences?: Partial<UserPreferences>;
  maxCandidates?: number;
};

export type DisqualifiedTicker = {
  ticker: string;
  reasons: string[];
};

export type QualifiedCandidate = {
  ticker: string;
  candidate: unknown;
  sizing: {
    requiredCollateral: number;
    allocationPct: number;
    withinLimit: boolean;
    warning?: string;
  };
};

export type QualifyResponse = {
  generatedAt: string;
  candidates: QualifiedCandidate[];
  disqualified: DisqualifiedTicker[];
};
