import type { OptionChainSnapshot, StrategyType } from "@/src/lib/types";
import type { StrikeFinderConfig } from "@/src/lib/types/strike";
import { findStrikeCandidate } from "@/src/lib/strategy/strike-finder";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      chain: OptionChainSnapshot;
      underlyingPrice: number;
      strategy: StrategyType;
      config?: Partial<StrikeFinderConfig>;
    };

    const result = findStrikeCandidate(
      body.chain,
      body.underlyingPrice,
      body.strategy,
      body.config
    );

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
