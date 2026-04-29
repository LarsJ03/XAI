import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { NextResponse } from "next/server";

import { db } from "@/lib/db";

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

function exportJsonPayload() {
  return {
    exportedAt: new Date().toISOString(),
    sessions: db.prepare("SELECT * FROM sessions ORDER BY started_at ASC").all(),
    surveyResponses: db
      .prepare("SELECT * FROM survey_responses ORDER BY session_id, survey_type, question_id")
      .all(),
    trialResponses: db
      .prepare("SELECT * FROM trial_responses ORDER BY session_id, trial_index ASC")
      .all(),
    events: db.prepare("SELECT * FROM events ORDER BY created_at ASC").all()
  };
}

async function exportSqliteSnapshot() {
  const tempDir = await mkdtemp(join(tmpdir(), "study-export-"));
  const snapshotPath = join(tempDir, "study.sqlite");

  try {
    db.exec("PRAGMA wal_checkpoint(FULL);");
    db.exec(`VACUUM INTO '${snapshotPath.replaceAll("'", "''")}'`);
    return await readFile(snapshotPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function GET(request, { params }) {
  const unauthorizedResponse = ensureAuthorized(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const { format } = await params;

  if (format === "json") {
    return new NextResponse(JSON.stringify(exportJsonPayload(), null, 2), {
      status: 200,
      headers: downloadHeaders("study-export.json", "application/json; charset=utf-8")
    });
  }

  if (format === "sqlite") {
    const snapshot = await exportSqliteSnapshot();

    return new NextResponse(snapshot, {
      status: 200,
      headers: downloadHeaders("study.sqlite", "application/x-sqlite3")
    });
  }

  return NextResponse.json({ error: "Unsupported export format." }, { status: 404 });
}
