import type { ExplanationInput } from "@/src/lib/types/explain";
import { buildExplanation } from "@/src/lib/explain/builder";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExplanationInput;
    const result = buildExplanation(body);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
