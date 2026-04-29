import { notFound, redirect } from "next/navigation";

import { getSession, resolveStepPath } from "@/lib/session-service";

export const dynamic = "force-dynamic";

export default async function CompletePage({ params }) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);

  if (!session) {
    notFound();
  }

  if (session.currentStep !== "complete") {
    redirect(resolveStepPath(session));
  }

  return (
    <main className="shell narrow">
      <section className="panel stack-lg">
        <div className="eyebrow">Study complete</div>
        <h1>Thank you, your responses were saved</h1>
      </section>
    </main>
  );
}
