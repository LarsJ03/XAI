"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StartTrialButton({ requestedCondition = null }) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleStart() {
    setIsStarting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condition: requestedCondition
        })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to start the study session.");
      }

      router.push(data.redirectTo);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to start the study session.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <>
      <button className="button" onClick={handleStart} disabled={isStarting}>
        {isStarting ? "Preparing trial..." : "Start trial"}
      </button>
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    </>
  );
}
