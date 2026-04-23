import { notFound, redirect } from "next/navigation";

import PostTaskForm from "@/components/PostTaskForm";
import { getSession, resolveStepPath } from "@/lib/session-service";
import {
  dashboardFeedbackQuestions,
  postTaskLikertQuestions,
  postTaskOpenQuestions
} from "@/lib/study-content";

export const dynamic = "force-dynamic";

export default async function PostTaskPage({ params }) {
  const { sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    notFound();
  }

  if (session.currentStep !== "post-task") {
    redirect(resolveStepPath(session));
  }

  return (
    <main className="shell narrow">
      <section className="panel stack-lg">
        <div className="eyebrow">Post-task survey</div>
        <h1>Reflect on the study experience</h1>
        <p className="lede">
          These questions capture understanding, plausibility, confidence, and usability after the
          evaluation task is complete.
        </p>
        <PostTaskForm
          sessionId={sessionId}
          condition={session.condition}
          likertQuestions={postTaskLikertQuestions}
          openQuestions={postTaskOpenQuestions}
          dashboardQuestions={dashboardFeedbackQuestions}
        />
      </section>
    </main>
  );
}
