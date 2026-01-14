import type { QualifyRequest } from "@/src/lib/types/qualify";
import { qualify } from "@/src/lib/qualify/qualify";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QualifyRequest;
    const result = await qualify(body);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
