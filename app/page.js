import StartTrialButton from "@/components/StartTrialButton";

export default async function LandingPage({ searchParams }) {
  const params = await searchParams;
  const requestedCondition =
    params?.condition === "dashboard" || params?.condition === "text" ? params.condition : null;

  return (
    <main className="shell">
      <section className="panel hero landing-stack">
        <div className="eyebrow">Counterfactual Study</div>
        <h1>Which edited image best explains how the model changes its prediction?</h1>
        <p className="lede">
          You will judge image-based counterfactual explanations. Each task starts with an original
          handwritten digit and a target digit. You will compare edited versions of the original and
          choose the edit that best explains how the model could change its prediction.
        </p>
        <p className="helper-text">
          Example: if the model currently predicts <strong>7</strong> and the target is{" "}
          <strong>3</strong>, pick the edited image that most clearly supports the move from 7 to 3.
        </p>
        <p className="helper-text">
          Flow: short pre-task questions, preparation examples, 5 comparison trials, then a short
          follow-up survey.
        </p>
        <p className="helper-text">
          New to counterfactuals? Read this simple overview first:{" "}
          <a
            className="text-link"
            href="https://christophm.github.io/interpretable-ml-book/counterfactual.html"
            target="_blank"
            rel="noreferrer"
          >
            Counterfactual Explanations in Interpretable Machine Learning
          </a>
          .
        </p>

        <div className="actions">
          <StartTrialButton requestedCondition={requestedCondition} />
        </div>
      </section>
    </main>
  );
}
