import type { ScoreInput } from "@/src/lib/scoring/engine";
import { scoreCandidate } from "@/src/lib/scoring/engine";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ScoreInput;
    const result = scoreCandidate(body);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
