import { NextResponse } from "next/server";

import { getSession, markPrepComplete, resolveStepPath } from "@/lib/session-service";

export async function POST(request, { params }) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const body = await request.json();
  const updated = await markPrepComplete(session.id, body.timeSpentMs || 0);

  return NextResponse.json({
    ok: true,
    redirectTo: resolveStepPath(updated)
  });
}
