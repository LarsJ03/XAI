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
          You&apos;ll compare sets of counterfactual images — edits that push the model from its
          current prediction to a target class — and pick the one that best explains the switch.
        </p>
        <p className="helper-text">
          E.g. model sees a <strong>7</strong>, target is <strong>3</strong>: which edited version
          best shows the switch?
        </p>
        <p className="helper-text">
          Flow: survey → preparation → 5 comparisons → short follow-up.
        </p>

        <div className="actions">
          <StartTrialButton requestedCondition={requestedCondition} />
        </div>
      </section>
    </main>
  );
}
