import { notFound, redirect } from "next/navigation";

import { getConditionLabel } from "@/lib/study-content";
import { getSession, getTrialResponses, resolveStepPath } from "@/lib/session-service";

export const dynamic = "force-dynamic";

export default async function CompletePage({ params }) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    notFound();
  }

  if (session.currentStep !== "complete") {
    redirect(resolveStepPath(session));
  }

  const trialResponses = getTrialResponses(sessionId);

  return (
    <main className="shell narrow">
      <section className="panel stack-lg">
        <div className="eyebrow">Study complete</div>
        <h1>Thank you, your responses were saved</h1>
        <p className="lede">
          The trial data, survey responses, condition assignment, and timestamps are now stored in the
          SQLite database for later analysis.
        </p>

        <div className="grid two-up">
          <article className="card">
            <h3>Session details</h3>
            <p>
              Session ID: <strong>{sessionId}</strong>
            </p>
            <p>
              Condition: <strong>{getConditionLabel(session.condition)}</strong>
            </p>
          </article>
          <article className="card">
            <h3>Responses recorded</h3>
            <p>
              Trials completed: <strong>{trialResponses.length}</strong>
            </p>
            <p>
              Started at: <strong>{new Date(session.startedAt).toLocaleString()}</strong>
            </p>
          </article>
        </div>

        <div className="actions">
          <a className="button" href="/">
            Start a new participant run
          </a>
        </div>
      </section>
    </main>
  );
}
