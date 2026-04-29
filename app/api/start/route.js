import { NextResponse } from "next/server";

import { createSession, resolveStepPath } from "@/lib/session-service";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const session = await createSession(body.condition);

    return NextResponse.json({
      sessionId: session.id,
      condition: session.condition,
      redirectTo: resolveStepPath(session)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to start session."
      },
      { status: 500 }
    );
  }
}
