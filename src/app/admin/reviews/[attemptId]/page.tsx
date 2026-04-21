import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { ReviewAttemptForm } from "@/components/admin/review-attempt-form";

type AudioAnswer = {
  kind: "audio_recording";
  bucket: string;
  path: string;
  mime_type?: string;
  duration_seconds?: number;
};

type EssayAnswer = string;

function isAudioAnswer(value: unknown): value is AudioAnswer {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return row.kind === "audio_recording" && typeof row.bucket === "string" && typeof row.path === "string";
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function moduleBadgeClass(module: string) {
  return `admin-badge admin-badge--${module}`;
}

export default async function AdminReviewAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const { user } = await getAuthUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    notFound();
  }

  const admin = createServiceRoleClient();
  const { data: attempt } = await admin
    .from("mock_attempts")
    .select("id, exam_id, user_id, status, review_status, answers_json, created_at, completed_at, listening_band, reading_band, writing_band, speaking_band, overall_band, speaking_review_notes, reviewed_at")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt) {
    notFound();
  }

  const [{ data: exam }, { data: questions }, { data: profiles }] = await Promise.all([
    admin
      .from("mock_exams")
      .select("id, title, slug, modules, structure_json")
      .eq("id", attempt.exam_id)
      .maybeSingle(),
    admin
      .from("exam_questions")
      .select("id, module, prompt, sort_order, question_type")
      .eq("exam_id", attempt.exam_id)
      .in("module", ["writing", "speaking"])
      .order("sort_order"),
    admin
      .from("profiles")
      .select("id, full_name")
      .eq("id", attempt.user_id)
      .maybeSingle(),
  ]);

  if (!exam) {
    notFound();
  }

  let studentEmail = "";
  try {
    const { data } = await admin.auth.admin.getUserById(attempt.user_id);
    studentEmail = data.user?.email ?? "";
  } catch {
    studentEmail = "";
  }

  const studentName = profiles?.full_name?.trim() || `Student ${attempt.user_id.slice(0, 8)}`;
  const answers = attempt.answers_json && typeof attempt.answers_json === "object"
    ? attempt.answers_json as Record<string, unknown>
    : {};

  const writingTasks = ((exam.structure_json as { writing_tasks?: { part: number; prompt: string; min_words?: number }[] } | null)?.writing_tasks ?? [])
    .map((task) => ({
      ...task,
      question: (questions ?? []).find((question) => question.module === "writing" && Math.floor(question.sort_order / 100 || 1) === task.part),
    }))
    .filter((task) => task.question);

  const writingResponses = writingTasks.map((task) => ({
    part: task.part,
    prompt: task.prompt,
    minWords: task.min_words ?? null,
    questionId: task.question!.id,
    answer: typeof answers[task.question!.id] === "string" ? answers[task.question!.id] as EssayAnswer : "",
  }));

  const speakingResponses = await Promise.all(
    (questions ?? [])
      .filter((question) => question.module === "speaking")
      .map(async (question) => {
        const answer = answers[question.id];
        if (!isAudioAnswer(answer)) return null;
        const { data } = await admin.storage.from(answer.bucket).createSignedUrl(answer.path, 60 * 60);
        return {
          questionId: question.id,
          prompt: question.prompt,
          part: Math.max(1, Math.floor(question.sort_order / 100) || 1),
          durationSeconds: Number(answer.duration_seconds ?? 0),
          signedUrl: data?.signedUrl ?? null,
        };
      }),
  );

  const moduleSummary = Array.isArray(exam.modules) ? exam.modules : [];

  return (
    <>
      <p className="admin-lead">
        <Link href="/admin/reviews" className="admin-wizard-back">
          ← Back to review queue
        </Link>
      </p>

      <div className="admin-dash-head">
        <div>
          <h1 className="admin-h1" style={{ marginBottom: "0.35rem" }}>
            Review Attempt
          </h1>
          <p className="admin-lead" style={{ marginBottom: 0 }}>
            {exam.title} · {studentName} · Submitted {formatDateTime(attempt.completed_at ?? attempt.created_at)}
          </p>
        </div>
        <div className="admin-table-actions">
          {moduleSummary.map((module) => (
            <span key={module} className={moduleBadgeClass(module)}>
              {module}
            </span>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-review-grid">
          <div className="admin-review-item">
            <span className="admin-review-label">Student</span>
            <span className="admin-review-value">{studentName}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Email</span>
            <span className="admin-review-value">{studentEmail || "—"}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Status</span>
            <span className="admin-review-value">{attempt.review_status ?? "—"}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Reviewed at</span>
            <span className="admin-review-value">{formatDateTime(attempt.reviewed_at)}</span>
          </div>
        </div>
      </div>

      {writingResponses.length > 0 ? (
        <div className="admin-card">
          <h2>Writing Answers</h2>
          <div className="admin-writing-review-list">
            {writingResponses.map((response) => (
              <article key={response.questionId} className="admin-review-answer-card">
                <div className="admin-review-answer-card__header">
                  <div>
                    <p className="admin-review-answer-card__eyebrow">Task {response.part}</p>
                    <h3>{response.prompt}</h3>
                  </div>
                  {response.minWords ? (
                    <span className="admin-badge admin-badge--writing">Min {response.minWords} words</span>
                  ) : null}
                </div>
                <div className="admin-review-answer-card__body">
                  {response.answer ? response.answer : "No writing answer submitted for this task."}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {speakingResponses.filter(Boolean).length > 0 ? (
        <div className="admin-card">
          <h2>Speaking Recordings</h2>
          <div className="admin-speaking-review-list">
            {speakingResponses.filter(Boolean).map((response) => (
              <article key={response!.questionId} className="admin-review-answer-card">
                <div className="admin-review-answer-card__header">
                  <div>
                    <p className="admin-review-answer-card__eyebrow">Speaking Part {response!.part}</p>
                    <h3>{response!.prompt}</h3>
                  </div>
                  <span className="admin-badge admin-badge--speaking">
                    {response!.durationSeconds ? `${response!.durationSeconds}s` : "Audio"}
                  </span>
                </div>
                {response!.signedUrl ? (
                  <audio controls src={response!.signedUrl} style={{ width: "100%" }} preload="metadata" />
                ) : (
                  <p style={{ margin: 0, color: "#b91c1c", fontWeight: 700 }}>
                    Could not generate playback URL for this recording.
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="admin-card">
        <h2>Marking</h2>
        <ReviewAttemptForm
          attemptId={attempt.id}
          examId={exam.id}
          examTitle={exam.title}
          studentName={studentName}
          studentEmail={studentEmail}
          modules={moduleSummary}
          listeningBand={attempt.listening_band != null ? Number(attempt.listening_band) : null}
          readingBand={attempt.reading_band != null ? Number(attempt.reading_band) : null}
          writingBand={attempt.writing_band != null ? Number(attempt.writing_band) : null}
          speakingBand={attempt.speaking_band != null ? Number(attempt.speaking_band) : null}
          reviewNotes={attempt.speaking_review_notes}
        />
      </div>
    </>
  );
}
