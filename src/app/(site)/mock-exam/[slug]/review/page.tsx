import Link from "next/link";
import type { Metadata } from "next";
import { createClient, getAuthUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Review results | The IELTS Exam",
};

export default async function ReviewMockExamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ user }, supabase] = await Promise.all([getAuthUser(), createClient()]);

  const { data: exam } = await supabase
    .from("mock_exams")
    .select("id, title")
    .eq("slug", slug)
    .maybeSingle();

  if (!exam) {
    return (
      <main className="page" style={{ padding: "3rem 1.5rem" }}>
        <div className="container" style={{ maxWidth: "42rem" }}>
          <h1 style={{ fontFamily: "var(--font-display), var(--font-sans), sans-serif", fontSize: "1.75rem", fontWeight: 800 }}>
            Review results
          </h1>
          <p style={{ color: "var(--muted)", marginTop: "0.75rem", lineHeight: 1.6 }}>
            This exam could not be found.
          </p>
          <Link href="/mock-exam" className="btn btn-outline" style={{ marginTop: "1.5rem" }}>
            Back to mock exams
          </Link>
        </div>
      </main>
    );
  }

  const { data: attempt } = user
    ? await supabase
        .from("mock_attempts")
        .select("status, review_status, overall_band, listening_band, reading_band, writing_band, completed_at, created_at")
        .eq("exam_id", exam.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const reviewPending = attempt?.review_status === "pending";

  return (
    <main className="page" style={{ padding: "3rem 1.5rem" }}>
      <div className="container" style={{ maxWidth: "42rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-display), var(--font-sans), sans-serif",
            fontSize: "1.75rem",
            fontWeight: 800,
          }}
        >
          Review results
        </h1>
        <p style={{ color: "var(--muted)", marginTop: "0.75rem", lineHeight: 1.6 }}>
          {exam.title}
        </p>

        {!attempt ? (
          <p style={{ color: "var(--muted)", marginTop: "1rem", lineHeight: 1.6 }}>
            No completed submission was found for this exam yet.
          </p>
        ) : reviewPending ? (
          <>
            <p style={{ color: "var(--text)", marginTop: "1rem", lineHeight: 1.7 }}>
              Your writing submission was saved successfully. Objective sections can still show bands, but the writing score stays pending until review is completed.
            </p>
            <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Listening</div>
                <div style={{ marginTop: "0.35rem", fontSize: "1.4rem", fontWeight: 800 }}>{attempt.listening_band ?? "—"}</div>
              </div>
              <div style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Reading</div>
                <div style={{ marginTop: "0.35rem", fontSize: "1.4rem", fontWeight: 800 }}>{attempt.reading_band ?? "—"}</div>
              </div>
              <div style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Writing</div>
                <div style={{ marginTop: "0.35rem", fontSize: "1.1rem", fontWeight: 800 }}>Pending review</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: "var(--muted)", marginTop: "1rem", lineHeight: 1.6 }}>
              Latest completed attempt.
            </p>
            <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Overall</div>
                <div style={{ marginTop: "0.35rem", fontSize: "1.4rem", fontWeight: 800 }}>{attempt.overall_band ?? "—"}</div>
              </div>
              <div style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Writing</div>
                <div style={{ marginTop: "0.35rem", fontSize: "1.4rem", fontWeight: 800 }}>{attempt.writing_band ?? "—"}</div>
              </div>
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.75rem" }}>
          <Link href={`/mock-exam/${slug}/take`} className="btn btn-primary btn-topbar-cta">
            Retake exam
          </Link>
          <Link href="/mock-exam" className="btn btn-outline">
            Back to mock exams
          </Link>
        </div>
      </div>
    </main>
  );
}
