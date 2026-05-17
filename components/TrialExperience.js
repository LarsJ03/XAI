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

    setError("");
    setIsSubmitting(true);

    const response = await fetch(`/api/sessions/${sessionId}/trials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trialIndex,
        trialId: trial.id,
        selectedMethod: selectedMethod || "not-selected",
        confidence,
        trustworthiness,
        choiceReason: choiceReason.trim() || null,
        timeSpentMs: Date.now() - startedAt
      })
    });
    const data = await response.json();
    router.push(data.redirectTo);
  }

  return (
    <section className="panel trial-panel stack-md">
      <div className="trial-title-block">
        <div className="eyebrow">
          Trial {trialIndex + 1} of {totalTrials}
        </div>
        <h1>{trial.question}</h1>
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

      <form className="trial-form" onSubmit={handleSubmit}>
        {error ? <div className="error-banner">{error}</div> : null}

        <div className="trial-choice-layout">
          <aside className="trial-card trial-context-card">
            <div className="image-label">Original image</div>
            <img src={trial.originalAsset} alt="Original trial example" className="digit-image" />
            <dl className="context-list">
              <div>
                <dt>Original digit</dt>
                <dd>{trial.originalLabel}</dd>
              </div>
              <div>
                <dt>Model currently predicts</dt>
                <dd>{trial.originalPredictedLabel}</dd>
              </div>
              <div>
                <dt>Target digit</dt>
                <dd>{trial.target}</dd>
              </div>
            </dl>
          </aside>

          <div className="trial-method-grid">
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
        </div>

        <article className="card response-card">
          <div className="response-ratings">
            <div className="rating-block">
              <h3>Confidence</h3>
              <div className="likert-row compact">
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
                <span>Low</span>
                <span>High</span>
              </div>
            </div>

            <div className="rating-block">
              <h3>Trustworthiness</h3>
              <div className="likert-row compact">
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
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          </div>

          <div className="response-reason-row">
            <label className="reason-block">
              <span>Why did you choose it?</span>
              <textarea
                className="textarea"
                rows={4}
                value={choiceReason}
                placeholder="Briefly explain what made this explanation the best choice."
                onChange={(event) => setChoiceReason(event.target.value)}
              />
            </label>

            <div className="actions response-actions">
              <button className="button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : trialIndex + 1 === totalTrials ? "Finish trials" : "Next trial"}
              </button>
            </div>
          </div>
        </article>
      </form>
    </section>
  );
}
