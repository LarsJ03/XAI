"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { LikertField, TextField } from "./SurveyFields";

function buildInitialState(questions) {
  return questions.reduce((acc, question) => {
    acc[question.id] = question.kind === "likert" ? null : "";
    return acc;
  }, {});
}

export default function PreTaskForm({ sessionId, questions }) {
  const router = useRouter();
  const [answers, setAnswers] = useState(() => buildInitialState(questions));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const startedAt = useMemo(() => Date.now(), []);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "page_view",
        payload: { page: "pre-task" }
      })
    }).catch(() => {});
  }, [sessionId]);

  function updateAnswer(questionId, value) {
    setAnswers((current) => ({
      ...current,
      [questionId]: value
    }));
  }

  function validate() {
    return questions.every((question) => {
      const value = answers[question.id];
      if (question.kind === "likert") {
        return typeof value === "number";
      }
      return typeof value === "string" && value.trim().length > 0;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) {
      setError("Please answer all pre-task questions before continuing.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    const response = await fetch(`/api/sessions/${sessionId}/pre-task`, {
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
      <div className="question-grid">
        {questions.map((question) =>
          question.kind === "likert" ? (
            <LikertField
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={updateAnswer}
            />
          ) : (
            <TextField
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={updateAnswer}
            />
          )
        )}
      </div>
      <div className="actions">
        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Continue to preparation"}
        </button>
      </div>
    </form>
  );
}
