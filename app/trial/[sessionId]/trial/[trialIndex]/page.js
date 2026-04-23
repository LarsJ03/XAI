import { notFound, redirect } from "next/navigation";

import TrialExperience from "@/components/TrialExperience";
import { getSession, resolveStepPath } from "@/lib/session-service";
import { getTrialByIndex, trialExamples } from "@/lib/study-content";

export const dynamic = "force-dynamic";

export default async function TrialPage({ params }) {
  const { sessionId, trialIndex } = await params;
  const session = getSession(sessionId);

  if (!session) {
    notFound();
  }

  const index = Number(trialIndex);
  const expectedStep = `trial-${index}`;

  if (session.currentStep !== expectedStep) {
    redirect(resolveStepPath(session));
  }

  const trial = getTrialByIndex(index);
  if (!trial) {
    notFound();
  }

  return (
    <main className="shell">
      <TrialExperience
        sessionId={sessionId}
        trial={trial}
        trialIndex={index}
        totalTrials={trialExamples.length}
      />
    </main>
  );
}
