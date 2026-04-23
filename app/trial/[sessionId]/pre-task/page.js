import { redirect, notFound } from "next/navigation";

import PreTaskForm from "@/components/PreTaskForm";
import { getSession, resolveStepPath } from "@/lib/session-service";
import { preTaskQuestions } from "@/lib/study-content";

export const dynamic = "force-dynamic";

export default async function PreTaskPage({ params }) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    notFound();
  }

  if (session.currentStep !== "pre-task") {
    redirect(resolveStepPath(session));
  }

  return (
    <main className="shell narrow">
      <section className="panel stack-lg">
        <div className="eyebrow">Pre-task interview</div>
        <h1>Tell us a little about your background first</h1>
        <p className="lede">
          These questions capture your familiarity with explainable AI, confidence in data science,
          and what you personally look for when comparing counterfactual explanations.
        </p>
        <PreTaskForm sessionId={sessionId} questions={preTaskQuestions} />
      </section>
    </main>
  );
}
