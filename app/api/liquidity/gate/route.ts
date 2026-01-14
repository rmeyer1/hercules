import type { LiquidityGateInput } from "@/src/lib/liquidity/gate";
import { evaluateLiquidityGate } from "@/src/lib/liquidity/gate";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LiquidityGateInput;
    const result = evaluateLiquidityGate(body);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
