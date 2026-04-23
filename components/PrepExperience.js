"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { conditionMeta, decisionCriteria } from "@/lib/study-content";

function getMetricRank(options, methodId, metricId) {
  const rankedOptions = options.filter((option) => typeof option.metrics[metricId] === "number");

  if (!rankedOptions.some((option) => option.method === methodId)) {
    return null;
  }

  const sorted = [...rankedOptions].sort((left, right) => left.metrics[metricId] - right.metrics[metricId]);
  return {
    rank: sorted.findIndex((option) => option.method === methodId) + 1,
    total: sorted.length
  };
}

function describeRank(rankInfo, labels) {
  if (!rankInfo) {
    return labels.missing;
  }

  const { rank, total } = rankInfo;

  if (total === 1) {
    return labels.only;
  }

  if (rank === 1) {
    return labels.best;
  }

  if (rank === total) {
    return labels.worst;
  }

  return rank <= Math.ceil(total / 2) ? labels.betterHalf : labels.worseHalf;
}

function getOutcomeSummary(option, example) {
  if (!option.available) {
    return "No usable counterfactual was returned for this case.";
  }

  if (option.metrics.correctness === 1) {
    return `Reached the target class ${example.target}.`;
  }

  if (typeof option.metrics.predictedLabel === "number") {
    return `Did not reach the target. The model still predicts ${option.metrics.predictedLabel}.`;
  }

  return "Did not reach the target class.";
}

function buildComparisonSignals(option, exampleOptions) {
  return {
    change: describeRank(getMetricRank(exampleOptions, option.method, "l2"), {
      best: "Smallest change",
      betterHalf: "Smaller change",
      worseHalf: "Larger change",
      worst: "Largest change",
      only: "Only change score",
      missing: "No change score"
    }),
    plausibility: describeRank(getMetricRank(exampleOptions, option.method, "implausibility"), {
      best: "Most realistic",
      betterHalf: "More realistic",
      worseHalf: "Less realistic",
      worst: "Least realistic",
      only: "Only realism score",
      missing: "No realism score"
    }),
    speed: describeRank(getMetricRank(exampleOptions, option.method, "optimTime"), {
      best: "Fastest",
      betterHalf: "Quick",
      worseHalf: "Slow",
      worst: "Slowest",
      only: "Only timed method",
      missing: "No time recorded"
    })
  };
}

function getOutcomeBadge(option, example) {
  if (!option.available) {
    return "No result";
  }

  return option.metrics.correctness === 1 ? `Target ${example.target} reached` : `Target ${example.target} missed`;
}

function buildMethodHighlights(option, example, methodMeta, exampleOptions) {
  const signals = buildComparisonSignals(option, exampleOptions);

  return [
    {
      label: "What happened",
      value: getOutcomeSummary(option, example)
    },
    {
      label: "Change size",
      value: `${signals.change}. This tells you whether the method changed the image a little or a lot.`
    },
    {
      label: "Realism",
      value: `${signals.plausibility}. This tells you whether the result still looks believable.`
    },
    {
      label: "Method",
      value: methodMeta?.description || "No method description available."
    }
  ];
}

function buildWhyExplanation(option, example, methodMeta, exampleOptions) {
  const signals = buildComparisonSignals(option, exampleOptions);
  const predictedLabel =
    typeof option.metrics.predictedLabel === "number" ? option.metrics.predictedLabel : "no class";

  return [
    option.available
      ? option.metrics.correctness === 1
        ? `This method succeeds for this example: after the edit, the model changes from ${example.originalPredictedLabel} to the target class ${example.target}.`
        : `This method does not succeed for this example: after the edit, the model still predicts ${predictedLabel} instead of the target class ${example.target}.`
      : "This method did not return a usable counterfactual for this example, so there is no successful edit to inspect.",
    `Compared with the other methods on this example, this result shows ${signals.change.toLowerCase()} and is ${signals.plausibility.toLowerCase()}.`,
    methodMeta?.description || "No method description available.",
    "Use this explanation to understand the method’s trade-off, not just whether it won or lost on one score."
  ];
}

export default function PrepExperience({ sessionId, condition, methods, examples }) {
  const router = useRouter();
  const [selectedExample, setSelectedExample] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState(examples[0]?.options[0]?.method ?? null);
  const [infoPanel, setInfoPanel] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startedAt = useMemo(() => Date.now(), []);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "page_view",
        payload: { page: "prep", condition }
      })
    }).catch(() => {});
  }, [condition, sessionId]);

  const example = examples[selectedExample];
  const methodLookup = new Map(methods.map((method) => [method.id, method]));
  const selectedOption = example.options.find((option) => option.method === selectedMethod) || null;
  const selectedMethodMeta = selectedOption ? methodLookup.get(selectedOption.method) : null;
  const selectedHighlights = selectedOption
    ? buildMethodHighlights(selectedOption, example, selectedMethodMeta, example.options)
    : [];
  const selectedWhyExplanation = selectedOption
    ? buildWhyExplanation(selectedOption, example, selectedMethodMeta, example.options)
    : [];

  useEffect(() => {
    setSelectedMethod(example.options[0]?.method ?? null);
  }, [example]);

  async function handleContinue() {
    setIsSubmitting(true);

    const response = await fetch(`/api/sessions/${sessionId}/prep-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeSpentMs: Date.now() - startedAt
      })
    });
    const data = await response.json();
    router.push(data.redirectTo);
  }

  return (
    <section className="panel stack-lg">
      <div className="eyebrow">Preparation</div>
      <h1>{conditionMeta[condition].label}</h1>
      <p className="lede">{conditionMeta[condition].description}</p>

      <div className="grid criteria-grid">
        {decisionCriteria.map((criterion) => (
          <article className="card soft" key={criterion.label}>
            <h3>{criterion.label}</h3>
            <p>{criterion.summary}</p>
          </article>
        ))}
      </div>

      {condition === "dashboard" ? (
        <div className="stack-lg">
          <article className="card soft">
            <div className="section-header">
              <h3>How to use this preparation phase</h3>
              <button className="info-button" onClick={() => setInfoPanel("guide")} type="button">
                More info
              </button>
            </div>
            <p className="helper-text">Choose a method and compare its edited image with the original image.</p>
          </article>

          <div className="prep-nav">
            <button
              className="button secondary"
              onClick={() => {
                setSelectedExample((index) => Math.max(0, index - 1));
              }}
              disabled={selectedExample === 0}
              type="button"
            >
              Previous example
            </button>
            <div className="center-note">
              Example {selectedExample + 1} of {examples.length}: model starts at{" "}
              {example.originalPredictedLabel} and tries to reach {example.target}
            </div>
            <button
              className="button secondary"
              onClick={() => {
                setSelectedExample((index) => Math.min(examples.length - 1, index + 1));
              }}
              disabled={selectedExample === examples.length - 1}
              type="button"
            >
              Next example
            </button>
          </div>

          <article className="card">
            <div className="section-header">
              <h3>Select a method to compare</h3>
              <button className="info-button" onClick={() => setInfoPanel("methods")} type="button">
                Method info
              </button>
            </div>
            <div className="option-strip">
              {example.options.map((option) => {
                const isSelected = selectedMethod === option.method;
                const signals = buildComparisonSignals(option, example.options);
                return (
                  <button
                    className={`mini-option ${isSelected ? "selected" : ""}`}
                    key={option.method}
                    onClick={() => setSelectedMethod(option.method)}
                    type="button"
                  >
                    <span className="mini-option-title">{option.methodLabel}</span>
                    <img src={option.asset} alt={option.methodLabel} className="digit-image small" />
                    <div className="mini-option-meta">
                      <span
                        className={`status-pill ${option.metrics.correctness === 1 ? "success" : option.available ? "danger" : "neutral"}`}
                      >
                        {getOutcomeBadge(option, example)}
                      </span>
                    </div>
                    <div className="compare-chip-row">
                      <span className="compare-chip neutral">{signals.change}</span>
                      <span className="compare-chip neutral">{signals.plausibility}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </article>

          <div className="compare-stage">
            <article className="image-card">
              <div className="compare-card-top">
                <div className="compare-card-heading">
                  <span className="image-label">Original image</span>
                </div>
                <span className="status-pill neutral">
                  Model predicts {example.originalPredictedLabel}
                </span>
              </div>
              <p className="helper-text compare-card-note">
                This is the starting image before any method changes it.
              </p>
              <img src={example.originalAsset} alt="Original example" className="digit-image" />
            </article>

            <article className="image-card spotlight-card">
              <div className="compare-card-top">
                <div className="compare-card-heading">
                  <span className="image-label">Edited result</span>
                  <strong>{selectedOption?.methodLabel || "Select a method"}</strong>
                </div>
                <button
                  className="info-button"
                  onClick={() => setInfoPanel("selected-method")}
                  type="button"
                  disabled={!selectedOption}
                >
                  Why?
                </button>
              </div>
              {selectedOption ? (
                <>
                  <div className="compare-summary-row">
                    <span
                      className={`status-pill ${selectedOption.metrics.correctness === 1 ? "success" : selectedOption.available ? "danger" : "neutral"}`}
                    >
                      {getOutcomeBadge(selectedOption, example)}
                    </span>
                    <span className="status-pill neutral">
                      Model predicts{" "}
                      {typeof selectedOption.metrics.predictedLabel === "number"
                        ? selectedOption.metrics.predictedLabel
                        : "n/a"}
                    </span>
                    <span className="status-pill neutral">Target {example.target}</span>
                  </div>
                  <img src={selectedOption.asset} alt={selectedOption.methodLabel} className="digit-image" />
                </>
              ) : (
                <p className="helper-text">
                  Select a method above to inspect its result.
                </p>
              )}
            </article>
          </div>
        </div>
      ) : (
        <div className="grid two-up">
          <article className="card">
            <h3>The five methods</h3>
            <div className="stack-sm">
              {methods.map((method) => (
                <div key={method.id}>
                  <strong>{method.label}</strong>
                  <p>{method.description}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="card">
            <h3>What to look for</h3>
            <div className="stack-sm">
              <div>
                <strong>Did it reach the target?</strong>
                <p>Check whether the edited image makes the model predict the target class.</p>
              </div>
              <div>
                <strong>What changed?</strong>
                <p>Look at which parts of the image were changed and whether those changes are easy to follow.</p>
              </div>
              <div>
                <strong>Does it still look believable?</strong>
                <p>Compare the edited image with the original and judge whether it still looks reasonable.</p>
              </div>
            </div>
            <p className="helper-text">
              Use this preparation phase to build a simple comparison strategy before the actual trial starts.
            </p>
          </article>
        </div>
      )}

      <div className="actions">
        <button className="button" onClick={handleContinue} disabled={isSubmitting} type="button">
          {isSubmitting ? "Loading trials..." : "Next"}
        </button>
      </div>

      {infoPanel ? (
        <div className="info-overlay" role="presentation" onClick={() => setInfoPanel(null)}>
          <article className="info-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="section-header">
              <h3>
                {infoPanel === "guide" && "How to use this preparation phase"}
                {infoPanel === "methods" && "Why methods look different"}
                {infoPanel === "selected-method" && `${selectedOption?.methodLabel || "Method"} details`}
              </h3>
              <button className="info-button" onClick={() => setInfoPanel(null)} type="button">
                Close
              </button>
            </div>

            {infoPanel === "guide" ? (
              <div className="stack-sm">
                <p>1. Pick one method and compare its edited image with the original image.</p>
                <p>2. Check whether the model reaches the target class after the edit.</p>
                <p>3. Among the methods that work, compare change size and realism.</p>
              </div>
            ) : null}

            {infoPanel === "methods" ? (
              <div className="stack-sm">
                {methods.map((method) => (
                  <div key={method.id}>
                    <strong>{method.label}</strong>
                    <p>{method.description}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {infoPanel === "selected-method" && selectedOption ? (
              <div className="stack-sm">
                {selectedWhyExplanation.map((paragraph, index) => (
                  <p key={`${selectedOption.method}-${index}`}>{paragraph}</p>
                ))}
                <div className="stack-sm">
                  {selectedHighlights.map((item) => (
                    <div key={item.label}>
                      <strong>{item.label}</strong>
                      <p>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}
