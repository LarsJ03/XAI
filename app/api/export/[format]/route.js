import { NextResponse } from "next/server";

import { queryRows } from "@/lib/db";

function getExportToken(request) {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const url = new URL(request.url);
  return url.searchParams.get("token");
}

function ensureAuthorized(request) {
  const configuredToken = process.env.EXPORT_TOKEN;

  if (!configuredToken) {
    return NextResponse.json(
      {
        error: "EXPORT_TOKEN is not configured on the server."
      },
      { status: 503 }
    );
  }

  if (getExportToken(request) !== configuredToken) {
    return NextResponse.json({ error: "Unauthorized export request." }, { status: 401 });
  }

  return null;
}

function downloadHeaders(filename, contentType) {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store"
  };
}

async function exportJsonPayload() {
  return {
    exportedAt: new Date().toISOString(),
    sessions: await queryRows("SELECT * FROM sessions ORDER BY started_at ASC"),
    surveyResponses: await queryRows(
      "SELECT * FROM survey_responses ORDER BY session_id, survey_type, question_id"
    ),
    trialResponses: await queryRows(
      "SELECT * FROM trial_responses ORDER BY session_id, trial_index ASC"
    ),
    events: await queryRows("SELECT * FROM events ORDER BY created_at ASC")
  };
}

export async function GET(request, { params }) {
  const unauthorizedResponse = ensureAuthorized(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const { format } = await params;

  if (format === "json") {
    return new NextResponse(JSON.stringify(await exportJsonPayload(), null, 2), {
      status: 200,
      headers: downloadHeaders("study-export.json", "application/json; charset=utf-8")
    });
  }

  if (format === "sqlite") {
    return NextResponse.json(
      {
        error: "SQLite snapshot export is no longer available because the app now uses PostgreSQL. Use /api/export/json instead."
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ error: "Unsupported export format." }, { status: 404 });
}
