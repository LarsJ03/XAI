import { randomUUID } from "node:crypto";

import { db } from "./db.js";
import { getTrialById, trialExamples } from "./study-content.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeCondition(condition) {
  return condition === "dashboard" || condition === "text" ? condition : null;
}

function chooseCondition(requestedCondition) {
  const normalizedCondition = normalizeCondition(requestedCondition);

  if (normalizedCondition) {
    return normalizedCondition;
  }

  const rows = db
    .prepare("SELECT condition, COUNT(*) AS c FROM sessions GROUP BY condition")
    .all();
  const counts = { dashboard: 0, text: 0 };
  for (const row of rows) {
    if (row.condition in counts) counts[row.condition] = row.c;
  }

  if (counts.dashboard < counts.text) return "dashboard";
  if (counts.text < counts.dashboard) return "text";
  return Math.random() < 0.5 ? "dashboard" : "text";
}

export function recordEvent(sessionId, type, payload = {}) {
  db.prepare(
    `
      INSERT INTO events (session_id, type, created_at, payload)
      VALUES (?, ?, ?, ?)
    `
  ).run(sessionId, type, nowIso(), JSON.stringify(payload));
}

export function createSession(requestedCondition = null) {
  const sessionId = randomUUID();
  const condition = chooseCondition(requestedCondition);

  db.prepare(
    `
      INSERT INTO sessions (id, condition, started_at, current_step, metadata)
      VALUES (?, ?, ?, 'pre-task', ?)
    `
  ).run(sessionId, condition, nowIso(), JSON.stringify({ totalTrials: trialExamples.length }));

  recordEvent(sessionId, "session_started", { condition });

  return getSession(sessionId);
}

export function getSession(sessionId) {
  return (
    db.prepare(
      `
        SELECT id, condition, started_at AS startedAt, completed_at AS completedAt,
               current_step AS currentStep, metadata
        FROM sessions
        WHERE id = ?
      `
    ).get(sessionId) || null
  );
}

export function getSurveyResponses(sessionId, surveyType) {
  return db
    .prepare(
      `
        SELECT question_id AS questionId, likert_value AS likertValue, text_value AS textValue
        FROM survey_responses
        WHERE session_id = ? AND survey_type = ?
      `
    )
    .all(sessionId, surveyType);
}

export function getTrialResponses(sessionId) {
  return db
    .prepare(
      `
        SELECT trial_index AS trialIndex, trial_id AS trialId, selected_method AS selectedMethod,
               confidence, trustworthiness, choice_reason AS choiceReason, time_spent_ms AS timeSpentMs,
               submitted_at AS submittedAt, answer_payload AS answerPayload
        FROM trial_responses
        WHERE session_id = ?
        ORDER BY trial_index ASC
      `
    )
    .all(sessionId)
    .map((row) => ({
      ...row,
      answerPayload: row.answerPayload ? JSON.parse(row.answerPayload) : null
    }));
}

export function saveSurvey(sessionId, surveyType, answers, timeSpentMs) {
  const createdAt = nowIso();
  const stepAfterSave = surveyType === "pre-task" ? "prep" : "complete";

  const upsert = db.prepare(
    `
      INSERT INTO survey_responses (
        session_id, survey_type, question_id, likert_value, text_value, created_at, time_spent_ms
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, survey_type, question_id) DO UPDATE SET
        likert_value = excluded.likert_value,
        text_value = excluded.text_value,
        created_at = excluded.created_at,
        time_spent_ms = excluded.time_spent_ms
    `
  );

  Object.entries(answers).forEach(([questionId, value]) => {
    const numericValue = typeof value === "number" ? value : null;
    const textValue = typeof value === "string" ? value : null;
    upsert.run(sessionId, surveyType, questionId, numericValue, textValue, createdAt, timeSpentMs);
  });

  if (surveyType === "post-task") {
    db.prepare(
      `
        UPDATE sessions
        SET current_step = ?, completed_at = ?
        WHERE id = ?
      `
    ).run(stepAfterSave, createdAt, sessionId);
  } else {
    db.prepare(
      `
        UPDATE sessions
        SET current_step = ?
        WHERE id = ?
      `
    ).run(stepAfterSave, sessionId);
  }

  recordEvent(sessionId, `${surveyType}_submitted`, { timeSpentMs, questionCount: Object.keys(answers).length });

  return getSession(sessionId);
}

export function markPrepComplete(sessionId, timeSpentMs) {
  db.prepare(
    `
      UPDATE sessions
      SET current_step = 'trial-0'
      WHERE id = ?
    `
  ).run(sessionId);

  recordEvent(sessionId, "prep_completed", { timeSpentMs });

  return getSession(sessionId);
}

export function saveTrialResponse(
  sessionId,
  { trialIndex, trialId, selectedMethod, confidence, trustworthiness, choiceReason, timeSpentMs }
) {
  const submittedAt = nowIso();
  const trial = getTrialById(trialId);
  const selectedOption = trial?.options.find((option) => option.method === selectedMethod) || null;
  const nextStep = trialIndex + 1 >= trialExamples.length ? "post-task" : `trial-${trialIndex + 1}`;

  db.prepare(
    `
      INSERT INTO trial_responses (
        session_id, trial_index, trial_id, selected_method, confidence, trustworthiness, choice_reason,
        time_spent_ms, submitted_at, answer_payload
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, trial_index) DO UPDATE SET
        trial_id = excluded.trial_id,
        selected_method = excluded.selected_method,
        confidence = excluded.confidence,
        trustworthiness = excluded.trustworthiness,
        choice_reason = excluded.choice_reason,
        time_spent_ms = excluded.time_spent_ms,
        submitted_at = excluded.submitted_at,
        answer_payload = excluded.answer_payload
    `
  ).run(
    sessionId,
    trialIndex,
    trialId,
    selectedMethod,
    confidence,
    trustworthiness,
    choiceReason,
    timeSpentMs,
    submittedAt,
    JSON.stringify({
      target: trial?.target ?? null,
      originalLabel: trial?.originalLabel ?? null,
      selectedOption,
      trustworthiness,
      choiceReason
    })
  );

  db.prepare(
    `
      UPDATE sessions
      SET current_step = ?
      WHERE id = ?
    `
  ).run(nextStep, sessionId);

  recordEvent(sessionId, "trial_submitted", {
    trialIndex,
    trialId,
    selectedMethod,
    confidence,
    trustworthiness,
    choiceReason,
    timeSpentMs
  });

  return getSession(sessionId);
}

export function resolveStepPath(session) {
  if (!session) {
    return "/";
  }

  if (session.currentStep === "pre-task") {
    return `/trial/${session.id}/pre-task`;
  }

  if (session.currentStep === "prep") {
    return `/trial/${session.id}/prep`;
  }

  if (session.currentStep === "post-task") {
    return `/trial/${session.id}/post-task`;
  }

  if (session.currentStep === "complete") {
    return `/trial/${session.id}/complete`;
  }

  if (session.currentStep.startsWith("trial-")) {
    const index = Number(session.currentStep.split("-")[1] || 0);
    return `/trial/${session.id}/trial/${index}`;
  }

  return `/trial/${session.id}/pre-task`;
}
