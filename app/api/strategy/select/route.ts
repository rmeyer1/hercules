import type { StrategySelectionInput } from "@/src/lib/strategy/selector";
import { selectStrategies } from "@/src/lib/strategy/selector";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StrategySelectionInput;
    const result = selectStrategies(body);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
