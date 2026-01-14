import { buildUniverse } from "@/src/lib/universe/builder";
import type { UniverseBuildRequest } from "@/src/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UniverseBuildRequest;

    if (!body?.source) {
      return Response.json({ error: "Missing source" }, { status: 400 });
    }

    const result = await buildUniverse(body);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}
