import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = process.env.DB_PATH || join(process.cwd(), "data", "study.sqlite");

function initDatabase(database) {
  database.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      condition TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      current_step TEXT NOT NULL,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS survey_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT
    );
  `);

  const trialResponseColumns = database
    .prepare("PRAGMA table_info(trial_responses)")
    .all()
    .map((column) => column.name);

  if (!trialResponseColumns.includes("trustworthiness")) {
    database.exec("ALTER TABLE trial_responses ADD COLUMN trustworthiness INTEGER");
  }

  if (!trialResponseColumns.includes("choice_reason")) {
    database.exec("ALTER TABLE trial_responses ADD COLUMN choice_reason TEXT");
  }
}

function createDatabase() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const database = new DatabaseSync(DB_PATH);
  initDatabase(database);
  return database;
}

const globalForDb = globalThis;

export const db = globalForDb.__studyDb || createDatabase();

if (!globalForDb.__studyDb) {
  globalForDb.__studyDb = db;
}
