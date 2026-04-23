"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StartTrialButton({ requestedCondition = null }) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  async function handleStart() {
    setIsStarting(true);

    try {
      const response = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condition: requestedCondition
        })
      });
      const data = await response.json();
      router.push(data.redirectTo);
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <button className="button" onClick={handleStart} disabled={isStarting}>
      {isStarting ? "Preparing trial..." : "Start trial"}
    </button>
  );
}
