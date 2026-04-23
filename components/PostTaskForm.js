"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { LikertField, TextField } from "./SurveyFields";

function buildInitialState(likertQuestions, openQuestions, dashboardQuestions) {
  const state = {};

  [...likertQuestions, ...openQuestions, ...dashboardQuestions].forEach((question) => {
    state[question.id] = likertQuestions.includes(question) ? null : "";
  });

  return state;
}

export default function PostTaskForm({
  sessionId,
  condition,
  likertQuestions,
  openQuestions,
  dashboardQuestions
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState(() =>
    buildInitialState(likertQuestions, openQuestions, dashboardQuestions)
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startedAt = useMemo(() => Date.now(), []);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "page_view",
        payload: { page: "post-task", condition }
      })
    }).catch(() => {});
  }, [condition, sessionId]);

  function updateAnswer(questionId, value) {
    setAnswers((current) => ({
      ...current,
      [questionId]: value
    }));
  }

  function validate() {
    const required = [...likertQuestions, ...openQuestions];
    return required.every((question) => {
      const value = answers[question.id];
      if (typeof value === "number") {
        return true;
      }
      return typeof value === "string" && value.trim().length > 0;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) {
      setError("Please answer all required post-task questions before finishing.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    const response = await fetch(`/api/sessions/${sessionId}/post-task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers,
        timeSpentMs: Date.now() - startedAt
      })
    });
    const data = await response.json();
    router.push(data.redirectTo);
  }

  return (
    <form className="stack-lg" onSubmit={handleSubmit}>
      {error ? <div className="error-banner">{error}</div> : null}

      <section className="stack-md">
        <h2>Likert-scale questions</h2>
        <div className="question-grid">
          {likertQuestions.map((question) => (
            <LikertField
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={updateAnswer}
            />
          ))}
        </div>
      </section>

      <section className="stack-md">
        <h2>Open questions</h2>
        <div className="question-grid">
          {openQuestions.map((question) => (
            <TextField
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={updateAnswer}
            />
          ))}
        </div>
      </section>

      {condition === "dashboard" && dashboardQuestions.length > 0 ? (
        <section className="stack-md">
          <h2>Dashboard-specific feedback</h2>
          <div className="question-grid">
            {dashboardQuestions.map((question) => (
              <TextField
                key={question.id}
                question={question}
                value={answers[question.id]}
                onChange={updateAnswer}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="actions">
        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Finish study"}
        </button>
      </div>
    </form>
  );
}
