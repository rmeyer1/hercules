import type { PositionSizingInput } from "@/src/lib/types/sizing";
import { evaluatePositionSizing } from "@/src/lib/sizing/guardrail";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PositionSizingInput;
    const result = evaluatePositionSizing(body);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
