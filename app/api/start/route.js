import { NextResponse } from "next/server";

import { createSession, resolveStepPath } from "@/lib/session-service";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const session = createSession(body.condition);

  return NextResponse.json({
    sessionId: session.id,
    condition: session.condition,
    redirectTo: resolveStepPath(session)
  });
}
