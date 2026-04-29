import { Pool } from "pg";

export const DATABASE_URL = process.env.DATABASE_URL || null;

const globalForDb = globalThis;

function validateDatabaseUrl(value) {
  if (!value) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (value.includes("${{")) {
    throw new Error(
      "DATABASE_URL still contains a Railway template reference. In Railway, set the service variable DATABASE_URL to `${{ Postgres.DATABASE_URL }}` in the Variables UI so Railway resolves it before the app starts."
    );
  }

  try {
    const parsed = new URL(value);
    if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid PostgreSQL connection string. It should look like `postgresql://user:password@host:port/database`."
    );
  }
}

function getPool() {
  validateDatabaseUrl(DATABASE_URL);

  if (!globalForDb.__studyPgPool) {
    globalForDb.__studyPgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
    });
  }

  return globalForDb.__studyPgPool;
}

async function initDatabase() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      condition TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      current_step TEXT NOT NULL,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS survey_responses (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      survey_type TEXT NOT NULL,
      question_id TEXT NOT NULL,
      likert_value INTEGER,
      text_value TEXT,
      created_at TEXT NOT NULL,
      time_spent_ms INTEGER,
      UNIQUE(session_id, survey_type, question_id)
    );

    CREATE TABLE IF NOT EXISTS trial_responses (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      trial_index INTEGER NOT NULL,
      trial_id TEXT NOT NULL,
      selected_method TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      trustworthiness INTEGER,
      choice_reason TEXT,
      time_spent_ms INTEGER NOT NULL,
      submitted_at TEXT NOT NULL,
      answer_payload TEXT,
      UNIQUE(session_id, trial_index)
    );

    CREATE TABLE IF NOT EXISTS events (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT
    );
  `);

  await pool.query("ALTER TABLE trial_responses ADD COLUMN IF NOT EXISTS trustworthiness INTEGER");
  await pool.query("ALTER TABLE trial_responses ADD COLUMN IF NOT EXISTS choice_reason TEXT");
}

export async function ensureDb() {
  if (!globalForDb.__studyDbInitPromise) {
    globalForDb.__studyDbInitPromise = initDatabase();
  }

  await globalForDb.__studyDbInitPromise;
  return getPool();
}

export async function query(text, params = []) {
  const pool = await ensureDb();
  return pool.query(text, params);
}

export async function queryRows(text, params = []) {
  const result = await query(text, params);
  return result.rows;
}

export async function queryOne(text, params = []) {
  const rows = await queryRows(text, params);
  return rows[0] || null;
}

export async function withTransaction(run) {
  const pool = await ensureDb();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
