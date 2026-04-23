"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function TrialExperience({ sessionId, trial, trialIndex, totalTrials }) {
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState("");
  const [confidence, setConfidence] = useState(null);
  const [trustworthiness, setTrustworthiness] = useState(null);
  const [choiceReason, setChoiceReason] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startedAt = useMemo(() => Date.now(), []);
  const progressPercent = Math.round(((trialIndex + 1) / totalTrials) * 100);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "page_view",
        payload: { page: "trial", trialIndex, trialId: trial.id }
      })
    }).catch(() => {});
  }, [sessionId, trial.id, trialIndex]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedMethod || typeof confidence !== "number" || typeof trustworthiness !== "number" || !choiceReason.trim()) {
      setError("Please choose one counterfactual, rate confidence and trustworthiness, and explain your choice before continuing.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    const response = await fetch(`/api/sessions/${sessionId}/trials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trialIndex,
        trialId: trial.id,
        selectedMethod,
        confidence,
        trustworthiness,
        choiceReason: choiceReason.trim(),
        timeSpentMs: Date.now() - startedAt
      })
    });
    const data = await response.json();
    router.push(data.redirectTo);
  }

  return (
    <section className="panel stack-lg">
      <div className="topline">
        <div>
          <div className="eyebrow">
            Trial {trialIndex + 1} of {totalTrials}
          </div>
          <h1>{trial.question}</h1>
        </div>
        <div className="trial-progress">
          <div className="trial-progress-label">
            <span>Progress</span>
            <strong>{progressPercent}%</strong>
          </div>
          <div className="trial-progress-track" aria-hidden="true">
            <div className="trial-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="reference-layout">
        <article className="image-card trial-reference-card">
          <div className="image-label">Original image</div>
          <img src={trial.originalAsset} alt="Original trial example" className="digit-image" />
        </article>
        <article className="card trial-reference-card">
          <h3>Task context</h3>
          <p>
            Original label: <strong>{trial.originalLabel}</strong>
          </p>
          <p>
            Model prediction: <strong>{trial.originalPredictedLabel}</strong>
          </p>
          <p>
            Target class: <strong>{trial.target}</strong>
          </p>
          <p className="helper-text">
            Keep three questions in mind: does the image support the target class, does it still look
            plausible, and can you understand the change well enough to defend it?
          </p>
        </article>
      </div>

      <form className="stack-lg" onSubmit={handleSubmit}>
        {error ? <div className="error-banner">{error}</div> : null}
        <article className="card">
          <h3>Select one explanation image</h3>
          <p className="helper-text">
            Choose the explanation you would rank highest overall for the target class. After that,
            rate how confident and trustworthy that choice feels to you.
          </p>
        </article>
        <div className="trial-grid">
          {trial.options.map((option) => (
            <label className={`trial-card ${selectedMethod === option.method ? "selected" : ""}`} key={option.method}>
              <input
                type="radio"
                name="selectedMethod"
                value={option.method}
                checked={selectedMethod === option.method}
                onChange={() => setSelectedMethod(option.method)}
              />
              <div className="trial-card-header">
                <span>{option.methodLabel}</span>
              </div>
              <img src={option.asset} alt={option.methodLabel} className="digit-image" />
            </label>
          ))}
        </div>

        <article className="card">
          <h3>How confident are you in your choice?</h3>
          <div className="likert-row">
            {[1, 2, 3, 4, 5].map((value) => (
              <label className="likert-chip" key={value}>
                <input
                  type="radio"
                  name="confidence"
                  value={value}
                  checked={confidence === value}
                  onChange={() => setConfidence(value)}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>
          <div className="likert-caption">
            <span>Not confident</span>
            <span>Very confident</span>
          </div>
        </article>

        <article className="card">
          <h3>How trustworthy does this explanation feel?</h3>
          <div className="likert-row">
            {[1, 2, 3, 4, 5].map((value) => (
              <label className="likert-chip" key={value}>
                <input
                  type="radio"
                  name="trustworthiness"
                  value={value}
                  checked={trustworthiness === value}
                  onChange={() => setTrustworthiness(value)}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>
          <div className="likert-caption">
            <span>Not trustworthy</span>
            <span>Very trustworthy</span>
          </div>
        </article>

        <article className="card">
          <h3>Why did you choose this explanation?</h3>
          <textarea
            className="textarea"
            rows={4}
            value={choiceReason}
            placeholder="Briefly explain what made this explanation the best choice for you."
            onChange={(event) => setChoiceReason(event.target.value)}
          />
        </article>

        <div className="actions">
          <button className="button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : trialIndex + 1 === totalTrials ? "Finish trials" : "Next trial"}
          </button>
        </div>
      </form>
    </section>
  );
}
