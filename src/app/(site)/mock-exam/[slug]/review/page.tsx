import Link from "next/link";
import type { Metadata } from "next";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import type { WritingAiReview } from "@/lib/ai/writing-review";
import { normalizeExamModules } from "@/lib/exam/ielts-defaults";

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
    .select("id, title, modules")
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

  let attempt: {
    status: string;
    review_status: string | null;
    overall_band: number | null;
    listening_band: number | null;
    reading_band: number | null;
    writing_band: number | null;
    completed_at: string | null;
    created_at: string;
    ai_review_json?: WritingAiReview | null;
  } | null = null;

  if (user) {
    const primary = await supabase
      .from("mock_attempts")
      .select("status, review_status, overall_band, listening_band, reading_band, writing_band, completed_at, created_at, ai_review_json")
      .eq("exam_id", exam.id)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (primary.error && primary.error.message.includes("ai_review_json")) {
      const fallback = await supabase
        .from("mock_attempts")
        .select("status, review_status, overall_band, listening_band, reading_band, writing_band, completed_at, created_at")
        .eq("exam_id", exam.id)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      attempt = fallback.data;
    } else {
      attempt = primary.data;
    }
  }

  const reviewPending = attempt?.review_status === "pending";
  const aiReview = attempt?.ai_review_json && typeof attempt.ai_review_json === "object"
    ? attempt.ai_review_json as WritingAiReview
    : null;
  const activeModules = normalizeExamModules(exam.modules);
  const summaryCards = attempt
    ? [
        activeModules.length > 1
          ? { label: "Overall", value: attempt.overall_band }
          : null,
        activeModules.includes("listening")
          ? { label: "Listening", value: attempt.listening_band }
          : null,
        activeModules.includes("reading")
          ? { label: "Reading", value: attempt.reading_band }
          : null,
        activeModules.includes("writing")
          ? {
              label: "Writing",
              value: reviewPending ? "Pending review" : attempt.writing_band,
            }
          : null,
      ].filter((card): card is { label: string; value: number | string | null } => Boolean(card))
    : [];

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
              {summaryCards.map((card) => (
                <div key={card.label} style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)" }}>
                  <div style={{ color: "var(--muted)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{card.label}</div>
                  <div style={{ marginTop: "0.35rem", fontSize: typeof card.value === "string" ? "1.1rem" : "1.4rem", fontWeight: 800 }}>
                    {typeof card.value === "number" ? card.value.toFixed(1) : (card.value ?? "—")}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p style={{ color: "var(--muted)", marginTop: "1rem", lineHeight: 1.6 }}>
              Latest completed attempt.
            </p>
            <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              {summaryCards.map((card) => (
                <div key={card.label} style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)" }}>
                  <div style={{ color: "var(--muted)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{card.label}</div>
                  <div style={{ marginTop: "0.35rem", fontSize: typeof card.value === "string" ? "1.1rem" : "1.4rem", fontWeight: 800 }}>
                    {typeof card.value === "number" ? card.value.toFixed(1) : (card.value ?? "—")}
                  </div>
                </div>
              ))}
            </div>
            {aiReview ? (
              <div style={{ marginTop: "1rem", display: "grid", gap: "0.9rem" }}>
                <div style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)" }}>
                  <div style={{ color: "var(--muted)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>AI writing summary</div>
                  <p style={{ margin: "0.5rem 0 0", lineHeight: 1.7, color: "var(--text)" }}>{aiReview.summary}</p>
                  {aiReview.strengths.length > 0 ? (
                    <div style={{ marginTop: "0.85rem" }}>
                      <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>Strengths</div>
                      <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--muted)", lineHeight: 1.7 }}>
                        {aiReview.strengths.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {aiReview.improvements.length > 0 ? (
                    <div style={{ marginTop: "0.85rem" }}>
                      <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>Improve next</div>
                      <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--muted)", lineHeight: 1.7 }}>
                        {aiReview.improvements.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  {aiReview.tasks.map((task) => (
                    <div key={task.part} style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "16px", background: "var(--surface)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "baseline" }}>
                        <div style={{ fontWeight: 800 }}>Task {task.part}</div>
                        <div style={{ color: "var(--primary)", fontWeight: 800 }}>Band {task.estimated_band.toFixed(1)}</div>
                      </div>
                      <div style={{ marginTop: "0.5rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                        {task.word_count} words
                      </div>
                      <div style={{ marginTop: "0.85rem", display: "grid", gap: "0.55rem" }}>
                        <div><strong>Task response:</strong> {task.feedback.task_response}</div>
                        <div><strong>Coherence:</strong> {task.feedback.coherence}</div>
                        <div><strong>Lexical:</strong> {task.feedback.lexical}</div>
                        <div><strong>Grammar:</strong> {task.feedback.grammar}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
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
