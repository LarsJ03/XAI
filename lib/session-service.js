import { randomUUID } from "node:crypto";

import { query, queryOne, queryRows, withTransaction } from "./db.js";
import { getTrialById, trialExamples } from "./study-content.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeCondition(condition) {
  return condition === "dashboard" || condition === "text" ? condition : null;
}

async function chooseCondition(requestedCondition) {
  const normalizedCondition = normalizeCondition(requestedCondition);

  if (normalizedCondition) {
    return normalizedCondition;
  }

  const rows = await queryRows("SELECT condition, COUNT(*)::int AS c FROM sessions GROUP BY condition");
  const counts = { dashboard: 0, text: 0 };

  for (const row of rows) {
    if (row.condition in counts) counts[row.condition] = Number(row.c);
  }

  if (counts.dashboard < counts.text) return "dashboard";
  if (counts.text < counts.dashboard) return "text";
  return Math.random() < 0.5 ? "dashboard" : "text";
}

export async function recordEvent(sessionId, type, payload = {}) {
  await query(
    `
      INSERT INTO events (session_id, type, created_at, payload)
      VALUES ($1, $2, $3, $4)
    `,
    [sessionId, type, nowIso(), JSON.stringify(payload)]
  );
}

export async function createSession(requestedCondition = null) {
  const sessionId = randomUUID();
  const condition = await chooseCondition(requestedCondition);

  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO sessions (id, condition, started_at, current_step, metadata)
        VALUES ($1, $2, $3, 'pre-task', $4)
      `,
      [sessionId, condition, nowIso(), JSON.stringify({ totalTrials: trialExamples.length })]
    );

    await client.query(
      `
        INSERT INTO events (session_id, type, created_at, payload)
        VALUES ($1, $2, $3, $4)
      `,
      [sessionId, "session_started", nowIso(), JSON.stringify({ condition })]
    );
  });

  return getSession(sessionId);
}

export async function getSession(sessionId) {
  return await queryOne(
    `
      SELECT id, condition, started_at AS "startedAt", completed_at AS "completedAt",
             current_step AS "currentStep", metadata
      FROM sessions
      WHERE id = $1
    `,
    [sessionId]
  );
}

export async function getSurveyResponses(sessionId, surveyType) {
  return await queryRows(
    `
      SELECT question_id AS "questionId", likert_value AS "likertValue", text_value AS "textValue"
      FROM survey_responses
      WHERE session_id = $1 AND survey_type = $2
    `,
    [sessionId, surveyType]
  );
}

export async function getTrialResponses(sessionId) {
  const rows = await queryRows(
    `
      SELECT trial_index AS "trialIndex", trial_id AS "trialId", selected_method AS "selectedMethod",
             confidence, trustworthiness, choice_reason AS "choiceReason", time_spent_ms AS "timeSpentMs",
             submitted_at AS "submittedAt", answer_payload AS "answerPayload"
      FROM trial_responses
      WHERE session_id = $1
      ORDER BY trial_index ASC
    `,
    [sessionId]
  );

  return rows.map((row) => ({
    ...row,
    answerPayload: row.answerPayload ? JSON.parse(row.answerPayload) : null
  }));
}

export async function saveSurvey(sessionId, surveyType, answers, timeSpentMs) {
  const createdAt = nowIso();
  const stepAfterSave = surveyType === "pre-task" ? "prep" : "complete";

  await withTransaction(async (client) => {
    for (const [questionId, value] of Object.entries(answers)) {
      const numericValue = typeof value === "number" ? value : null;
      const textValue = typeof value === "string" ? value : null;

      await client.query(
        `
          INSERT INTO survey_responses (
            session_id, survey_type, question_id, likert_value, text_value, created_at, time_spent_ms
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT(session_id, survey_type, question_id) DO UPDATE SET
            likert_value = EXCLUDED.likert_value,
            text_value = EXCLUDED.text_value,
            created_at = EXCLUDED.created_at,
            time_spent_ms = EXCLUDED.time_spent_ms
        `,
        [sessionId, surveyType, questionId, numericValue, textValue, createdAt, timeSpentMs]
      );
    }

    if (surveyType === "post-task") {
      await client.query(
        `
          UPDATE sessions
          SET current_step = $1, completed_at = $2
          WHERE id = $3
        `,
        [stepAfterSave, createdAt, sessionId]
      );
    } else {
      await client.query(
        `
          UPDATE sessions
          SET current_step = $1
          WHERE id = $2
        `,
        [stepAfterSave, sessionId]
      );
    }

    await client.query(
      `
        INSERT INTO events (session_id, type, created_at, payload)
        VALUES ($1, $2, $3, $4)
      `,
      [
        sessionId,
        `${surveyType}_submitted`,
        nowIso(),
        JSON.stringify({ timeSpentMs, questionCount: Object.keys(answers).length })
      ]
    );
  });

  return getSession(sessionId);
}

export async function markPrepComplete(sessionId, timeSpentMs) {
  await withTransaction(async (client) => {
    await client.query(
      `
        UPDATE sessions
        SET current_step = 'trial-0'
        WHERE id = $1
      `,
      [sessionId]
    );

    await client.query(
      `
        INSERT INTO events (session_id, type, created_at, payload)
        VALUES ($1, $2, $3, $4)
      `,
      [sessionId, "prep_completed", nowIso(), JSON.stringify({ timeSpentMs })]
    );
  });

  return getSession(sessionId);
}

export async function saveTrialResponse(
  sessionId,
  { trialIndex, trialId, selectedMethod, confidence, trustworthiness, choiceReason, timeSpentMs }
) {
  const submittedAt = nowIso();
  const trial = getTrialById(trialId);
  const selectedOption = trial?.options.find((option) => option.method === selectedMethod) || null;
  const nextStep = trialIndex + 1 >= trialExamples.length ? "post-task" : `trial-${trialIndex + 1}`;

  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO trial_responses (
          session_id, trial_index, trial_id, selected_method, confidence, trustworthiness, choice_reason,
          time_spent_ms, submitted_at, answer_payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT(session_id, trial_index) DO UPDATE SET
          trial_id = EXCLUDED.trial_id,
          selected_method = EXCLUDED.selected_method,
          confidence = EXCLUDED.confidence,
          trustworthiness = EXCLUDED.trustworthiness,
          choice_reason = EXCLUDED.choice_reason,
          time_spent_ms = EXCLUDED.time_spent_ms,
          submitted_at = EXCLUDED.submitted_at,
          answer_payload = EXCLUDED.answer_payload
      `,
      [
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
      ]
    );

    await client.query(
      `
        UPDATE sessions
        SET current_step = $1
        WHERE id = $2
      `,
      [nextStep, sessionId]
    );

    await client.query(
      `
        INSERT INTO events (session_id, type, created_at, payload)
        VALUES ($1, $2, $3, $4)
      `,
      [
        sessionId,
        "trial_submitted",
        nowIso(),
        JSON.stringify({
          trialIndex,
          trialId,
          selectedMethod,
          confidence,
          trustworthiness,
          choiceReason,
          timeSpentMs
        })
      ]
    );
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
