import Image from "next/image";
import Link from "next/link";
import { Check, Clock, Users } from "lucide-react";
import type { MockAttemptRow, MockExamRow } from "./types";

function categoryBadgeClass(slug: string): string {
  const s = slug.toLowerCase();
  if (s.includes("listen")) return "me-card__cat me-card__cat--listen";
  if (s.includes("read")) return "me-card__cat me-card__cat--read";
  if (s.includes("writ")) return "me-card__cat me-card__cat--write";
  if (s.includes("speak")) return "me-card__cat me-card__cat--speak";
  if (s.includes("full")) return "me-card__cat me-card__cat--full";
  return "me-card__cat me-card__cat--default";
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

function formatDifficulty(d: string) {
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function moduleLabel(exam: MockExamRow) {
  if (exam.exam_type === "full") return "Full exam";
  return exam.modules.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(" · ");
}

type ExamCardProps = {
  exam: MockExamRow;
  latestAttempt: MockAttemptRow | null;
  entitled: boolean;
  isLoggedIn: boolean;
};

export function ExamCard({ exam, latestAttempt, entitled, isLoggedIn }: ExamCardProps) {
  const category = exam.exam_categories;
  const categoryName = category?.name ?? "Exam";
  const slug = category?.slug ?? "exam";
  const completed =
    latestAttempt?.status === "completed" &&
    latestAttempt?.completed_at &&
    latestAttempt.overall_band != null;
  const band = latestAttempt?.overall_band ?? null;

  const cover = exam.cover_image_url;

  return (
    <article className="me-card">
      <div className="me-card__media">
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 320px"
          />
        ) : null}
        <div className="me-card__badge-row">
          {completed ? (
            <span className="me-card__status">
              <Check size={14} strokeWidth={2.5} aria-hidden />
              Attempted
            </span>
          ) : (
            <span aria-hidden />
          )}
          <span className={categoryBadgeClass(slug)}>{categoryName}</span>
        </div>
      </div>

      <div className="me-card__body">
        <h2 className="me-card__title">{exam.title}</h2>
        <div className="me-card__meta">
          <span>
            <Clock size={16} strokeWidth={2} aria-hidden />
            {exam.duration_minutes}m
          </span>
          <span>
            <Users size={16} strokeWidth={2} aria-hidden />
            {exam.question_count} questions
          </span>
        </div>
        <p className="me-card__diff">
          Difficulty: <strong>{formatDifficulty(exam.difficulty)}</strong>
        </p>
        <p className="me-card__diff" style={{ fontSize: "0.8125rem", marginTop: "-0.25rem" }}>
          {moduleLabel(exam)}
        </p>

        {completed && band != null ? (
          <div className="me-card__score-box">
            <span className="me-card__score-label">Your band score</span>
            <span className="me-card__score-value">{Number(band).toFixed(1)}</span>
          </div>
        ) : (
          <p className="me-card__price">{formatPrice(exam.price_cents, exam.currency)}</p>
        )}

        <div
          className={`me-card__actions${completed ? " me-card__actions--row" : ""}`}
        >
          {completed ? (
            <>
              <Link href={`/mock-exam/${exam.slug}/review`} className="btn btn-outline">
                Review results
              </Link>
              <Link href={`/mock-exam/${exam.slug}/take`} className="btn btn-topbar-cta btn-primary">
                Retake
              </Link>
            </>
          ) : entitled ? (
            <Link href={`/mock-exam/${exam.slug}/take`} className="btn btn-topbar-cta btn-primary">
              Start
            </Link>
          ) : isLoggedIn ? (
            <button type="button" className="btn btn-topbar-cta btn-primary" disabled>
              Purchase and start
            </button>
          ) : (
            <Link href="/sign-in" className="btn btn-topbar-cta btn-primary">
              Sign in to purchase
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

type CatalogProps = {
  examsByCategory: { category: { id: string; name: string; sort_order: number }; exams: MockExamRow[] }[];
  attemptsByExamId: Record<string, MockAttemptRow>;
  entitledExamIds: Set<string>;
  isLoggedIn: boolean;
};

export function MockExamCatalog({
  examsByCategory,
  attemptsByExamId,
  entitledExamIds,
  isLoggedIn,
}: CatalogProps) {
  if (examsByCategory.length === 0) {
    return (
      <p className="me-empty">
        No mock exams are listed yet. Check back soon, or ask an admin to publish exams in the
        dashboard.
      </p>
    );
  }

  return (
    <>
      {examsByCategory.map(({ category, exams }) => (
        <section key={category.id} className="me-section">
          <h2 className="me-section__title">{category.name}</h2>
          <div className="me-grid">
            {exams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                latestAttempt={attemptsByExamId[exam.id] ?? null}
                entitled={entitledExamIds.has(exam.id)}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
