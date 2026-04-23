import { decisionCriteria } from "@/lib/study-content";
import StartTrialButton from "@/components/StartTrialButton";

export default async function LandingPage({ searchParams }) {
  const params = await searchParams;
  const requestedCondition =
    params?.condition === "dashboard" || params?.condition === "text" ? params.condition : null;

  return (
    <main className="shell">
      <section className="panel hero landing-stack">
        <div className="eyebrow">Counterfactual Study</div>
        <h1>See how different methods change an image to reach a target class</h1>
        <p className="lede">
          In this study, each method answers the same question: what would need to change in an image
          so the model predicts a chosen target class instead? You will first answer a short survey,
          then go through a short preparation phase, then compare five sets of counterfactual examples,
          and finally complete a short post-task survey.
        </p>

        <div className="grid two-up">
          <article className="card">
            <h3>What the study tests</h3>
            <p>
              We are testing how well people can understand and compare counterfactual explanations
              after a short preparation phase.
            </p>
          </article>
          <article className="card">
            <h3>What your task is</h3>
            <p>
              For each example, choose the result that best shows how the model could move from its
              current prediction to the target class, then report how confident you feel about that choice.
            </p>
          </article>
        </div>

        <article className="card soft">
          <h3>Simple example</h3>
          <p>
            If the model currently sees a <strong>7</strong> and the target class is <strong>3</strong>,
            each method proposes a different edited version of the image. Your job is to compare those
            edited versions and decide which one best explains how the model could switch from 7 to 3.
          </p>
        </article>

        <div className="grid criteria-grid">
          {decisionCriteria.map((criterion) => (
            <article className="card soft" key={criterion.label}>
              <h3>{criterion.label}</h3>
              <p>{criterion.summary}</p>
            </article>
          ))}
        </div>

        <div className="actions">
          <StartTrialButton requestedCondition={requestedCondition} />
        </div>
      </section>
    </main>
  );
}
