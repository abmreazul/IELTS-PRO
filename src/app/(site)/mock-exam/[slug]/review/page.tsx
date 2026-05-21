import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import type { WritingAiReview } from "@/lib/ai/writing-review";
import { normalizeExamModules } from "@/lib/exam/ielts-defaults";
import "./review.css";

export const metadata: Metadata = {
  title: "Review results | The IELTS Exam",
};

const CRITERIA_LABELS: Record<string, string> = {
  task_response: "Task Response",
  coherence: "Coherence & Cohesion",
  lexical: "Lexical Resource",
  grammar: "Grammar & Accuracy",
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
      <main className="rv">
        <div className="rv__inner">
          <div className="rv__header">
            <h1 className="rv__title">Review results</h1>
            <p className="rv__exam-name">This exam could not be found.</p>
          </div>
          <div className="rv__actions">
            <Link href="/mock-exam" className="btn btn-outline">Back to mock exams</Link>
          </div>
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

  type SummaryCard = { label: string; value: number | string | null };
  const summaryCards: SummaryCard[] = attempt
    ? ([
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
              value: reviewPending ? "Pending" : attempt.writing_band,
            }
          : null,
      ].filter(Boolean) as SummaryCard[])
    : [];

  return (
    <main className="rv">
      <div className="rv__inner">
        {/* Header */}
        <div className="rv__header">
          <h1 className="rv__title">Review results</h1>
          <p className="rv__exam-name">{exam.title}</p>
        </div>

        {!attempt ? (
          <p className="rv__empty">No completed submission was found for this exam yet.</p>
        ) : (
          <>
            {/* Overall band hero */}
            {attempt.overall_band != null ? (
              <div className="rv__band-hero">
                <span className="rv__band-label">Overall Band Score</span>
                <span className="rv__band-value">{attempt.overall_band.toFixed(1)}</span>
              </div>
            ) : null}

            {/* Module bands */}
            <div className="rv__modules">
              {summaryCards.map((card) => (
                <div key={card.label} className="rv__module-card">
                  <span className="rv__module-name">{card.label}</span>
                  {typeof card.value === "number" ? (
                    <span className="rv__module-score">{card.value.toFixed(1)}</span>
                  ) : (
                    <span className="rv__module-score rv__module-score--pending">{card.value ?? "—"}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Pending message */}
            {reviewPending ? (
              <div className="rv__pending-msg">
                Your submission was saved, but the writing evaluation did not finish for this older attempt. Retake the writing exam to receive instant marking.
              </div>
            ) : null}

            {/* Writing Review */}
            {aiReview ? (
              <div className="rv__ai">
                <div className="rv__ai-header">
                  <div className="rv__ai-icon">
                    <Sparkles size={22} strokeWidth={2.2} aria-hidden />
                  </div>
                  <div>
                    <h2 className="rv__ai-title">Writing Assessment</h2>
                    <p className="rv__ai-sub">Marked against IELTS writing criteria</p>
                  </div>
                </div>

                {/* Summary */}
                <div className="rv__summary">
                  <p>{aiReview.summary}</p>
                </div>

                {/* Strengths & Improvements */}
                {aiReview.strengths.length > 0 || aiReview.improvements.length > 0 ? (
                  <div className="rv__insights">
                    {aiReview.strengths.length > 0 ? (
                      <div className="rv__insight-card rv__insight-card--strength">
                        <h3 className="rv__insight-label">
                          <span className="rv__insight-dot rv__insight-dot--green" />
                          Strengths
                        </h3>
                        <ul className="rv__insight-list">
                          {aiReview.strengths.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    ) : null}
                    {aiReview.improvements.length > 0 ? (
                      <div className="rv__insight-card rv__insight-card--improve">
                        <h3 className="rv__insight-label">
                          <span className="rv__insight-dot rv__insight-dot--amber" />
                          Areas to Improve
                        </h3>
                        <ul className="rv__insight-list">
                          {aiReview.improvements.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Per-task detailed cards */}
                {aiReview.tasks.map((task) => (
                  <div key={task.part} className="rv__task-card">
                    <div className="rv__task-head">
                      <h3 className="rv__task-name">Writing Task {task.part}</h3>
                      <span className="rv__task-band-pill">Band {task.estimated_band.toFixed(1)}</span>
                    </div>
                    <div className="rv__task-meta">{task.word_count} words</div>

                    <div className="rv__criteria">
                      {(Object.entries(task.criterion_scores) as [string, number][]).map(([key, score]) => (
                        <div key={key}>
                          <div className="rv__crit-head">
                            <span className="rv__crit-label">{CRITERIA_LABELS[key] ?? key}</span>
                            <span className="rv__crit-score">{score.toFixed(1)}</span>
                          </div>
                          <div className="rv__crit-track">
                            <div
                              className={`rv__crit-fill${score >= 7 ? " rv__crit-fill--high" : score >= 5 ? " rv__crit-fill--mid" : " rv__crit-fill--low"}`}
                              style={{ width: `${Math.min(100, (score / 9) * 100)}%` }}
                            />
                          </div>
                          <p className="rv__crit-feedback">
                            {(task.feedback as Record<string, string>)[key]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}

        {/* Actions */}
        <div className="rv__actions">
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
