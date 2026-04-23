import { redirect, notFound } from "next/navigation";

import PrepExperience from "@/components/PrepExperience";
import { getSession, resolveStepPath } from "@/lib/session-service";
import { methods, trialExamples } from "@/lib/study-content";

export const dynamic = "force-dynamic";

export default async function PrepPage({ params }) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    notFound();
  }

  if (session.currentStep !== "prep") {
    redirect(resolveStepPath(session));
  }

  return (
    <main className="shell">
      <PrepExperience
        sessionId={sessionId}
        condition={session.condition}
        methods={methods}
        examples={trialExamples}
      />
    </main>
  );
}
