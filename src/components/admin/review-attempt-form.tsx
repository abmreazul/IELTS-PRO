"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, CheckCircle2 } from "lucide-react";
import { submitHumanReview } from "@/app/admin/actions";

type Props = {
  attemptId: string;
  examId: string;
  examTitle: string;
  studentName: string;
  studentEmail: string;
  modules: string[];
  listeningBand: number | null;
  readingBand: number | null;
  writingBand: number | null;
  reviewNotes: string | null;
};

type ReviewFormState = {
  ok: boolean;
  message: string | null;
  mailtoUrl?: string;
};

const INITIAL_STATE: ReviewFormState = {
  ok: false,
  message: null,
};

function roundToNearestHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function parseBand(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function ReviewAttemptForm({
  attemptId,
  examId,
  examTitle,
  studentName,
  studentEmail,
  modules,
  listeningBand,
  readingBand,
  writingBand,
  reviewNotes,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitHumanReview, INITIAL_STATE);
  const [showDialog, setShowDialog] = useState(false);
  const [writingValue, setWritingValue] = useState(writingBand?.toString() ?? "");

  useEffect(() => {
    if (!state.ok) return;
    setShowDialog(true);
    router.refresh();
  }, [router, state.ok]);

  const previewBands = useMemo(() => {
    return {
      listening: listeningBand,
      reading: readingBand,
      writing: modules.includes("writing") ? parseBand(writingValue) : writingBand,
      speaking: null,
    };
  }, [listeningBand, modules, readingBand, writingBand, writingValue]);

  const previewOverall = useMemo(() => {
    const relevant = modules.filter((module) => ["listening", "reading", "writing"].includes(module));
    if (relevant.length === 0) return null;
    const values = relevant.map((module) => previewBands[module as keyof typeof previewBands]);
    if (values.some((value) => value == null)) return null;
    const scoredValues = values.filter((value): value is number => value != null);
    return roundToNearestHalf(scoredValues.reduce((sum, value) => sum + value, 0) / scoredValues.length);
  }, [modules, previewBands]);

  return (
    <>
      <form action={formAction} className="admin-review-form">
        <input type="hidden" name="attempt_id" value={attemptId} />
        <input type="hidden" name="exam_id" value={examId} />
        <input type="hidden" name="student_email" value={studentEmail} />
        <input type="hidden" name="student_name" value={studentName} />

        <div className="admin-review-grid">
          <div className="admin-review-item">
            <span className="admin-review-label">Listening</span>
            <span className="admin-review-value">{listeningBand ?? "—"}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Reading</span>
            <span className="admin-review-value">{readingBand ?? "—"}</span>
          </div>
          <div className="admin-review-item admin-review-item--state">
            <span className="admin-review-label">Live overall</span>
            <span className="admin-review-value">{previewOverall ?? "Pending"}</span>
          </div>
        </div>

        <div className="admin-form-grid admin-form-grid--2" style={{ marginTop: "1rem" }}>
          {modules.includes("writing") ? (
            <div>
              <label className="admin-label" htmlFor="writing-band">Writing band</label>
              <input
                id="writing-band"
                name="writing_band"
                type="number"
                min={0}
                max={9}
                step={0.5}
                className="admin-input"
                value={writingValue}
                onChange={(event) => setWritingValue(event.target.value)}
                placeholder="e.g. 6.5"
                required
              />
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: "1rem" }}>
          <label className="admin-label" htmlFor="review-notes">Moderator notes</label>
          <textarea
            id="review-notes"
            name="review_notes"
            className="admin-textarea"
            rows={5}
            defaultValue={reviewNotes ?? ""}
            placeholder="Internal notes for writing review…"
          />
        </div>

        {state.message ? (
          <div className={state.ok ? "admin-success" : "admin-error"} style={{ marginTop: "1rem" }}>
            {state.message}
          </div>
        ) : null}

        <div className="admin-review-submit">
          <div>
            <p className="admin-review-submit__title">Finalise this review</p>
            <p className="admin-review-submit__copy">
              Save the human-marked bands, update the live overall score, and then email the student manually.
            </p>
          </div>
          <button type="submit" className="btn btn-primary btn-topbar-cta" disabled={pending}>
            {pending ? "Saving…" : "Submit Review"}
          </button>
        </div>
      </form>

      {showDialog ? (
        <div className="admin-review-dialog-backdrop" role="presentation" onClick={() => setShowDialog(false)}>
          <div className="admin-review-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="admin-review-dialog__icon">
              <CheckCircle2 />
            </div>
            <h2>Review saved</h2>
            <p>
              {studentName || "The student"}’s marks for <strong>{examTitle}</strong> are saved. If you want, open your mail app now and send the result.
            </p>
            <div className="admin-review-dialog__actions">
              {state.mailtoUrl ? (
                <a className="btn btn-primary btn-topbar-cta" href={state.mailtoUrl}>
                  <Mail />
                  Email Student
                </a>
              ) : null}
              <Link href="/admin/reviews" className="btn btn-outline">
                Back to queue
              </Link>
            </div>
            <button
              type="button"
              className="admin-review-dialog__close"
              onClick={() => setShowDialog(false)}
            >
              Continue reviewing
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
