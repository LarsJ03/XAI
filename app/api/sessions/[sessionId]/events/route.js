import { NextResponse } from "next/server";

import { getSession, recordEvent } from "@/lib/session-service";

export async function POST(request, { params }) {
  const { sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const body = await request.json();
  recordEvent(sessionId, body.type || "event", body.payload || {});

  return NextResponse.json({ ok: true });
}
