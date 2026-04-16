import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { reviewSpeakingAttempt } from "@/app/admin/actions";

type AudioAnswer = {
  kind: "audio_recording";
  bucket: string;
  path: string;
  mime_type?: string;
  duration_seconds?: number;
};

function isAudioAnswer(value: unknown): value is AudioAnswer {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return row.kind === "audio_recording" && typeof row.bucket === "string" && typeof row.path === "string";
}

export default async function AdminExamAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getAuthUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    notFound();
  }

  const admin = createServiceRoleClient();
  const { data: exam } = await admin
    .from("mock_exams")
    .select("id, title, slug, modules, structure_json")
    .eq("id", id)
    .maybeSingle();
  if (!exam) notFound();

  const [{ data: attempts }, { data: speakingQuestions }] = await Promise.all([
    admin
      .from("mock_attempts")
      .select("id, user_id, status, review_status, overall_band, speaking_band, speaking_review_notes, reviewed_at, completed_at, created_at, answers_json")
      .eq("exam_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("exam_questions")
      .select("id, prompt, sort_order")
      .eq("exam_id", id)
      .eq("module", "speaking")
      .order("sort_order"),
  ]);

  const promptByQuestionId = new Map<string, { prompt: string; sort_order: number }>();
  for (const question of speakingQuestions ?? []) {
    promptByQuestionId.set(question.id, {
      prompt: question.prompt,
      sort_order: question.sort_order,
    });
  }

  const speakingAttempts = (attempts ?? []).map((attempt) => {
    const answers = (attempt.answers_json && typeof attempt.answers_json === "object")
      ? attempt.answers_json as Record<string, unknown>
      : {};

    const recordings = Object.entries(answers)
      .filter(([, value]) => isAudioAnswer(value))
      .map(([questionId, value]) => {
        const audio = value as AudioAnswer;
        return {
        questionId,
        bucket: audio.bucket,
        path: audio.path,
        durationSeconds: Number(audio.duration_seconds ?? 0),
        prompt: promptByQuestionId.get(questionId)?.prompt ?? "Speaking prompt",
        sortOrder: promptByQuestionId.get(questionId)?.sort_order ?? 9999,
      };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return {
      ...attempt,
      recordings,
    };
  });

  const attemptsWithSignedUrls = await Promise.all(
    speakingAttempts.map(async (attempt) => {
      const recordings = await Promise.all(
        attempt.recordings.map(async (recording) => {
          const { data } = await admin.storage.from(recording.bucket).createSignedUrl(recording.path, 60 * 60);
          return {
            ...recording,
            signedUrl: data?.signedUrl ?? null,
          };
        }),
      );
      return {
        ...attempt,
        recordings,
      };
    }),
  );

  const completed = attemptsWithSignedUrls.filter((attempt) => attempt.status === "completed");
  const reviewed = completed.filter((attempt) => attempt.review_status === "reviewed");
  const pending = completed.filter((attempt) => attempt.review_status === "pending");

  let sum = 0;
  let n = 0;
  for (const attempt of reviewed) {
    if (attempt.speaking_band != null) {
      sum += Number(attempt.speaking_band);
      n += 1;
    }
  }
  const avg = n > 0 ? (sum / n).toFixed(1) : "—";

  return (
    <>
      <p className="admin-lead">
        <Link href="/admin/exams" className="admin-wizard-back">
          ← Back to exams
        </Link>
      </p>
      <div className="admin-dash-head">
        <div>
          <h1 className="admin-h1" style={{ marginBottom: "0.35rem" }}>
            Speaking Review — {exam.title}
          </h1>
          <p className="admin-lead" style={{ marginBottom: 0 }}>
            Completed attempts: {completed.length}. Pending speaking review: {pending.length}. Reviewed average speaking band: {avg}.
          </p>
        </div>
        <Link href={`/admin/exams/${id}`} className="btn btn-outline">
          Edit exam
        </Link>
      </div>

      <div className="admin-card" style={{ marginBottom: "1rem" }}>
        <div className="admin-review-grid">
          <div className="admin-review-item">
            <span className="admin-review-label">Modules</span>
            <span className="admin-review-value">{Array.isArray(exam.modules) ? exam.modules.join(", ") : "—"}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Completed</span>
            <span className="admin-review-value">{completed.length}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Pending speaking review</span>
            <span className="admin-review-value">{pending.length}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Reviewed average</span>
            <span className="admin-review-value">{avg}</span>
          </div>
        </div>
      </div>

      <div className="admin-card">
        {attemptsWithSignedUrls.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No attempts yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {attemptsWithSignedUrls.map((attempt) => (
              <div key={attempt.id} style={{ border: "1px solid var(--border)", borderRadius: "16px", padding: "1rem", background: "var(--surface)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 800, color: "var(--text)" }}>Attempt {attempt.id.slice(0, 8)}</p>
                    <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.84rem" }}>
                      User: {attempt.user_id.slice(0, 8)} · Submitted: {attempt.completed_at ?? attempt.created_at ?? "—"}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span className={`admin-badge ${attempt.status === "completed" ? "admin-badge--published" : "admin-badge--draft"}`}>
                      {attempt.status}
                    </span>
                    <span className={`admin-badge ${attempt.review_status === "reviewed" ? "admin-badge--published" : "admin-badge--draft"}`}>
                      {attempt.review_status ?? "—"}
                    </span>
                    <span className="admin-badge admin-badge--speaking">
                      Speaking {attempt.speaking_band ?? "—"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
                  {attempt.recordings.length === 0 ? (
                    <p style={{ margin: 0, color: "var(--muted)" }}>No speaking recordings uploaded for this attempt yet.</p>
                  ) : attempt.recordings.map((recording) => (
                    <div key={recording.path} style={{ padding: "0.85rem 1rem", border: "1px solid var(--border)", borderRadius: "12px", background: "color-mix(in srgb, var(--primary) 3%, var(--surface))" }}>
                      <p style={{ margin: 0, fontWeight: 700, color: "var(--text)" }}>{recording.prompt}</p>
                      <p style={{ margin: "0.25rem 0 0.6rem", color: "var(--muted)", fontSize: "0.8rem" }}>
                        Duration: {recording.durationSeconds || "—"}s
                      </p>
                      {recording.signedUrl ? (
                        <audio controls src={recording.signedUrl} style={{ width: "100%" }} preload="metadata" />
                      ) : (
                        <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.82rem", fontWeight: 700 }}>
                          Could not generate playback URL for this recording.
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <form action={reviewSpeakingAttempt} style={{ display: "grid", gap: "0.75rem" }}>
                  <input type="hidden" name="attempt_id" value={attempt.id} />
                  <input type="hidden" name="exam_id" value={exam.id} />
                  <div className="admin-form-grid admin-form-grid--2">
                    <div>
                      <label className="admin-label" htmlFor={`band-${attempt.id}`}>Speaking band</label>
                      <input
                        id={`band-${attempt.id}`}
                        name="speaking_band"
                        type="number"
                        min={0}
                        max={9}
                        step={0.5}
                        className="admin-input"
                        defaultValue={attempt.speaking_band ?? ""}
                        placeholder="e.g. 6.5"
                      />
                    </div>
                    <div>
                      <label className="admin-label">Reviewed at</label>
                      <div className="admin-input" style={{ display: "flex", alignItems: "center", color: "var(--muted)" }}>
                        {attempt.reviewed_at ?? "Not reviewed yet"}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="admin-label" htmlFor={`notes-${attempt.id}`}>Moderator notes</label>
                    <textarea
                      id={`notes-${attempt.id}`}
                      name="speaking_review_notes"
                      className="admin-textarea"
                      rows={4}
                      defaultValue={attempt.speaking_review_notes ?? ""}
                      placeholder="Internal notes about fluency, pronunciation, lexical resource, and grammar…"
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                      Saving review updates the speaking band and review status. Final emailing stays manual for now.
                    </span>
                    <button type="submit" className="btn btn-primary btn-topbar-cta">
                      Save Speaking Review
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
