import { NextResponse } from "next/server";

import { getSession, resolveStepPath, saveSurvey } from "@/lib/session-service";

export async function POST(request, { params }) {
  const { sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const body = await request.json();
  const updated = saveSurvey(session.id, "post-task", body.answers || {}, body.timeSpentMs || 0);

  return NextResponse.json({
    ok: true,
    redirectTo: resolveStepPath(updated)
  });
}
