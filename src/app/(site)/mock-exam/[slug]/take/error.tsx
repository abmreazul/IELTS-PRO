"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function TakeExamError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page" style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: "2rem 1.5rem" }}>
      <div
        style={{
          width: "100%",
          maxWidth: "36rem",
          padding: "2rem",
          border: "1px solid var(--border)",
          borderRadius: "24px",
          background: "var(--surface)",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, color: "var(--muted)", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.08em" }}>
          Exam interrupted
        </p>
        <h1 style={{ margin: "0.75rem 0 0", fontSize: "2rem", fontWeight: 800 }}>
          This exam session ran into a runtime error.
        </h1>
        <p style={{ margin: "0.9rem 0 0", color: "var(--muted)", lineHeight: 1.7 }}>
          Your draft answers are kept locally for this exam. Try the session again or return to the exam catalog.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.5rem" }}>
          <button type="button" className="btn btn-primary btn-topbar-cta" onClick={reset}>
            Retry exam
          </button>
          <Link href="/mock-exam" className="btn btn-outline">
            Back to mock exams
          </Link>
        </div>
      </div>
    </main>
  );
}
