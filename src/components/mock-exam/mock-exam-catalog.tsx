import Image from "next/image";
import Link from "next/link";
import { Check, Clock3, Layers3, ShoppingCart, Star, Users } from "lucide-react";
import { ManualPaymentDialog } from "./manual-payment-dialog";
import type { MockAttemptRow, MockExamRow, MockPaymentRequestRow } from "./types";

function hasAnyPrice(exam: MockExamRow) {
  return (exam.price_usd_cents ?? 0) > 0 || (exam.price_bdt_cents ?? 0) > 0 || (exam.price_myr_cents ?? 0) > 0;
}

function formatDifficulty(d: string) {
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function moduleLabel(exam: MockExamRow) {
  if (exam.exam_type === "full") return "Full exam";
  return exam.modules.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(" · ");
}

function modulePillClass(exam: MockExamRow) {
  if (exam.exam_type === "full") return "me-card__module-pill me-card__module-pill--full";
  if (exam.modules.includes("listening")) return "me-card__module-pill me-card__module-pill--listening";
  if (exam.modules.includes("reading")) return "me-card__module-pill me-card__module-pill--reading";
  if (exam.modules.includes("writing")) return "me-card__module-pill me-card__module-pill--writing";
  return "me-card__module-pill me-card__module-pill--default";
}

/** Price badge for the card image */
function PriceBadge({ exam }: { exam: MockExamRow }) {
  const parts: { symbol: string; amount: string }[] = [];
  if ((exam.price_usd_cents ?? 0) > 0) parts.push({ symbol: "$", amount: (exam.price_usd_cents / 100).toFixed(0) });
  if ((exam.price_bdt_cents ?? 0) > 0) parts.push({ symbol: "৳", amount: (exam.price_bdt_cents / 100).toFixed(0) });
  if ((exam.price_myr_cents ?? 0) > 0) parts.push({ symbol: "RM", amount: (exam.price_myr_cents / 100).toFixed(0) });
  if (parts.length === 0) return null;

  return (
    <div className="me-card__price-badge">
      {parts.map((p, i) => (
        <span key={i} className="me-card__price-badge-item">
          {i > 0 ? <span className="me-card__price-badge-dot">·</span> : null}
          <span className="me-card__price-badge-sym">{p.symbol}</span>
          <span className="me-card__price-badge-val">{p.amount}</span>
        </span>
      ))}
    </div>
  );
}

type ExamCardProps = {
  exam: MockExamRow;
  latestAttempt: MockAttemptRow | null;
  entitled: boolean;
  isLoggedIn: boolean;
  paymentRequest?: MockPaymentRequestRow | null;
  actionHrefOverride?: string;
  actionLabelOverride?: string;
};

export function ExamCard({
  exam,
  latestAttempt,
  entitled,
  isLoggedIn,
  paymentRequest,
  actionHrefOverride,
  actionLabelOverride,
}: ExamCardProps) {
  const category = exam.exam_categories;
  const hasCompletedAttempt =
    latestAttempt?.status === "completed" &&
    latestAttempt?.completed_at;
  const reviewPending = Boolean(hasCompletedAttempt && latestAttempt?.review_status === "pending");
  const completed = Boolean(hasCompletedAttempt && latestAttempt?.overall_band != null);
  const band = latestAttempt?.overall_band ?? null;
  const isFree = !hasAnyPrice(exam);
  const accessGranted = entitled || isFree;
  const paymentPending = paymentRequest?.status === "pending";
  const defaultHref = actionHrefOverride ?? `/mock-exam/${exam.slug}/take`;
  const defaultLabel = actionLabelOverride ?? (isLoggedIn ? "Start Exam" : "Sign in to start");

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
            sizes="(max-width: 768px) 100vw, 512px"
          />
        ) : null}
        <div className="me-card__badge-row">
          {completed ? (
            <span className="me-card__status">
              <Check size={14} strokeWidth={2.5} aria-hidden />
              Attempted
            </span>
          ) : reviewPending ? (
            <span className="me-card__status">
              <Check size={14} strokeWidth={2.5} aria-hidden />
              Review pending
            </span>
          ) : (
            <span aria-hidden />
          )}
        </div>
        {completed && band != null ? (
          <div className="me-card__band-chip">
            <span className="me-card__band-chip-label">Band</span>
            <span className="me-card__band-chip-value">{Number(band).toFixed(1)}</span>
          </div>
        ) : null}
        {!isFree ? <PriceBadge exam={exam} /> : null}
      </div>

      <div className="me-card__body">
        <div className="me-card__title-row">
          <h2 className="me-card__title">{exam.title}</h2>
          {isFree ? <span className="me-card__price-pill">FREE</span> : null}
        </div>

        <div className="me-card__meta">
          <span>
            <Clock3 size={15} strokeWidth={2} aria-hidden />
            {exam.duration_minutes}m
          </span>
          <span>
            <Users size={16} strokeWidth={2} aria-hidden />
            {exam.question_count} questions
          </span>
        </div>

        <div className="me-card__eyebrow">
          <span className={modulePillClass(exam)}>
            <Layers3 size={14} strokeWidth={2.1} aria-hidden />
            {moduleLabel(exam)}
          </span>
          <span className="me-card__difficulty-pill">
            <Star size={13} strokeWidth={2.1} aria-hidden />
            {formatDifficulty(exam.difficulty)}
          </span>
        </div>

        <div
          className={`me-card__actions${completed || reviewPending ? " me-card__actions--row" : ""}`}
        >
          {completed || reviewPending ? (
            <>
              <Link href={`/mock-exam/${exam.slug}/review`} className="btn btn-outline">
                Review results
              </Link>
              <Link href={`/mock-exam/${exam.slug}/take`} className="btn btn-topbar-cta btn-primary">
                Retake
              </Link>
            </>
          ) : accessGranted && isLoggedIn ? (
            <Link href={defaultHref} className="btn btn-topbar-cta btn-primary">
              {defaultLabel}
            </Link>
          ) : !accessGranted && isLoggedIn ? (
            paymentPending ? (
              <button type="button" className="btn btn-outline me-card__pending-btn" disabled>
                Verification pending
              </button>
            ) : (
              <ManualPaymentDialog
                examId={exam.id}
                examTitle={exam.title}
                priceUsdCents={exam.price_usd_cents ?? 0}
                priceBdtCents={exam.price_bdt_cents ?? 0}
                priceMyrCents={exam.price_myr_cents ?? 0}
                existingRequest={paymentRequest ?? null}
              >
                <div className="me-buy-btn">
                  <span>Buy Now</span>
                  <ShoppingCart size={15} strokeWidth={2.2} />
                </div>
              </ManualPaymentDialog>
            )
          ) : (
            <Link href="/sign-in?next=/mock-exam" className="me-buy-btn me-buy-btn--link">
              <span>{isFree ? defaultLabel : "Buy Now"}</span>
              {!isFree ? <ShoppingCart size={15} strokeWidth={2.2} /> : null}
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
  paymentRequestsByExamId?: Record<string, MockPaymentRequestRow>;
  isLoggedIn: boolean;
};

export function MockExamCatalog({
  examsByCategory,
  attemptsByExamId,
  entitledExamIds,
  paymentRequestsByExamId = {},
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
                paymentRequest={paymentRequestsByExamId[exam.id] ?? null}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
