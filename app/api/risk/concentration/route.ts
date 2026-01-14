import type { PositionExposure, ConcentrationConfig } from "@/src/lib/types/concentration";
import { evaluateConcentrationRisk } from "@/src/lib/risk/concentration";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      positions: PositionExposure[];
      config?: Partial<ConcentrationConfig>;
    };

    const result = evaluateConcentrationRisk(body.positions, body.config);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
