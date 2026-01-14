import type { ExpirationCandidate, ExpirationRankingConfig } from "@/src/lib/types/expiry";
import { rankExpirations } from "@/src/lib/expiry/ranker";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      candidates: ExpirationCandidate[];
      config?: Partial<ExpirationRankingConfig>;
    };

    const result = rankExpirations(body.candidates, body.config);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
