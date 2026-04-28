import Link from "next/link";
import { BookOpen, ClipboardCheck, GraduationCap, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { normalizeExamModules } from "@/lib/exam/ielts-defaults";
import { formatExamPrice, getManualPaymentMethod } from "@/lib/payments/manual-payment";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { user } = await getAuthUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    notFound();
  }

  const { userId } = await params;
  const admin = createServiceRoleClient();

  const [{ data: authData, error: authError }, { data: profile }, { data: attempts }, { data: entitlements }, { data: payments }] =
    await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin.from("profiles").select("full_name, institution").eq("id", userId).maybeSingle(),
      admin
        .from("mock_attempts")
        .select(`
          id,
          exam_id,
          status,
          review_status,
          overall_band,
          listening_band,
          reading_band,
          writing_band,
          completed_at,
          created_at,
          mock_exams (
            title,
            slug,
            modules
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      admin
        .from("exam_entitlements")
        .select(`
          exam_id,
          granted_at,
          source,
          mock_exams (
            title,
            slug,
            modules,
            price_cents,
            currency
          )
        `)
        .eq("user_id", userId)
        .order("granted_at", { ascending: false }),
      admin
        .from("payment_requests")
        .select(`
          id,
          payment_method,
          transaction_id,
          amount_cents,
          currency,
          status,
          created_at,
          reviewed_at,
          mock_exams (
            title,
            slug
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

  if (authError || !authData.user) {
    notFound();
  }

  const account = authData.user;
  const meta = (account.user_metadata ?? {}) as Record<string, unknown>;
  const studentName =
    profile?.full_name?.trim() ||
    (typeof meta.full_name === "string" ? meta.full_name : null) ||
    (typeof meta.name === "string" ? meta.name : null) ||
    `Student ${userId.slice(0, 8)}`;
  const attemptsRows = (attempts ?? []) as Array<{
    id: string;
    exam_id: string;
    status: string;
    review_status: string | null;
    overall_band: number | null;
    listening_band: number | null;
    reading_band: number | null;
    writing_band: number | null;
    completed_at: string | null;
    created_at: string;
    mock_exams: { title: string; slug: string; modules: string[] } | { title: string; slug: string; modules: string[] }[] | null;
  }>;
  const entitlementRows = (entitlements ?? []) as Array<{
    exam_id: string;
    granted_at: string;
    source: string | null;
    mock_exams: { title: string; slug: string; modules: string[]; price_cents: number; currency: string } | { title: string; slug: string; modules: string[]; price_cents: number; currency: string }[] | null;
  }>;
  const paymentRows = (payments ?? []) as Array<{
    id: string;
    payment_method: string;
    transaction_id: string;
    amount_cents: number;
    currency: string;
    status: "pending" | "approved" | "rejected";
    created_at: string;
    reviewed_at: string | null;
    mock_exams: { title: string; slug: string } | { title: string; slug: string }[] | null;
  }>;

  const completedAttempts = attemptsRows.filter((row) => row.status === "completed");
  const scoredAttempts = completedAttempts.filter((row) => row.overall_band != null);
  const bestOverall = scoredAttempts.length
    ? Math.max(...scoredAttempts.map((row) => Number(row.overall_band)))
    : null;
  const avgOverall = scoredAttempts.length
    ? scoredAttempts.reduce((sum, row) => sum + Number(row.overall_band), 0) / scoredAttempts.length
    : null;
  const pendingReviews = attemptsRows.filter((row) => row.review_status === "pending").length;
  const approvedPayments = paymentRows.filter((row) => row.status === "approved").length;

  return (
    <>
      <div className="admin-dash-head">
        <div>
          <h1 className="admin-h1" style={{ marginBottom: "0.35rem" }}>
            {studentName}
          </h1>
          <p className="admin-lead" style={{ marginBottom: 0 }}>
            Full student overview: account details, exam access, attempts, scores, and payment history.
          </p>
        </div>
        <div className="admin-table-actions">
          <Link href="/admin/users" className="btn btn-outline">
            Back to users
          </Link>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-review-grid">
          <div className="admin-review-item">
            <span className="admin-review-label">Name</span>
            <span className="admin-review-value">{studentName}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Email</span>
            <span className="admin-review-value">{account.email ?? "—"}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Institution</span>
            <span className="admin-review-value">{profile?.institution || "—"}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Joined</span>
            <span className="admin-review-value">{formatDateTime(account.created_at ?? null)}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Last sign-in</span>
            <span className="admin-review-value">{formatDateTime(account.last_sign_in_at ?? null)}</span>
          </div>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card admin-stat-card--blue">
          <div className="admin-stat-card__body">
            <div className="admin-stat-card__label">Total Attempts</div>
            <div className="admin-stat-card__value">{attemptsRows.length}</div>
          </div>
          <div className="admin-stat-card__icon" aria-hidden>
            <ClipboardCheck strokeWidth={2} />
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--green">
          <div className="admin-stat-card__body">
            <div className="admin-stat-card__label">Purchased Exams</div>
            <div className="admin-stat-card__value">{entitlementRows.length}</div>
          </div>
          <div className="admin-stat-card__icon" aria-hidden>
            <BookOpen strokeWidth={2} />
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--purple">
          <div className="admin-stat-card__body">
            <div className="admin-stat-card__label">Best Overall</div>
            <div className="admin-stat-card__value">{bestOverall != null ? bestOverall.toFixed(1) : "—"}</div>
          </div>
          <div className="admin-stat-card__icon" aria-hidden>
            <Users strokeWidth={2} />
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--orange">
          <div className="admin-stat-card__body">
            <div className="admin-stat-card__label">Average Score</div>
            <div className="admin-stat-card__value">{avgOverall != null ? avgOverall.toFixed(1) : "—"}</div>
          </div>
          <div className="admin-stat-card__icon" aria-hidden>
            <GraduationCap strokeWidth={2} />
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--red">
          <div className="admin-stat-card__body">
            <div className="admin-stat-card__label">Pending Reviews</div>
            <div className="admin-stat-card__value">{pendingReviews}</div>
          </div>
          <div className="admin-stat-card__icon" aria-hidden>
            <ClipboardCheck strokeWidth={2} />
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--green">
          <div className="admin-stat-card__body">
            <div className="admin-stat-card__label">Approved Payments</div>
            <div className="admin-stat-card__value">{approvedPayments}</div>
          </div>
          <div className="admin-stat-card__icon" aria-hidden>
            <BookOpen strokeWidth={2} />
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h2>Purchased Mock Exams</h2>
        {entitlementRows.length === 0 ? (
          <div className="admin-empty-state admin-empty-state--compact">
            <BookOpen />
            <h2>No mock exam purchases yet</h2>
            <p>This student does not have any approved mock exam access yet.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Modules</th>
                  <th>Price</th>
                  <th>Access granted</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {entitlementRows.map((row) => {
                  const exam = Array.isArray(row.mock_exams) ? row.mock_exams[0] : row.mock_exams;
                  const modules = normalizeExamModules(exam?.modules ?? []);
                  return (
                    <tr key={`${row.exam_id}-${row.granted_at}`}>
                      <td className="admin-table-title">{exam?.title ?? "Unknown exam"}</td>
                      <td>
                        <div className="admin-table-actions">
                          {modules.map((module) => (
                            <span key={module} className={`admin-badge admin-badge--${module}`}>
                              {module}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>{exam ? formatExamPrice(exam.price_cents, exam.currency) : "—"}</td>
                      <td>{formatDateTime(row.granted_at)}</td>
                      <td>{row.source ?? "manual"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-card">
        <h2>Mock Exam Attempts</h2>
        {attemptsRows.length === 0 ? (
          <div className="admin-empty-state admin-empty-state--compact">
            <ClipboardCheck />
            <h2>No attempts yet</h2>
            <p>The student has not attempted any mock exams yet.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Status</th>
                  <th>Review</th>
                  <th>Overall</th>
                  <th>L</th>
                  <th>R</th>
                  <th>W</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {attemptsRows.map((row) => {
                  const exam = Array.isArray(row.mock_exams) ? row.mock_exams[0] : row.mock_exams;
                  return (
                    <tr key={row.id}>
                      <td className="admin-table-title">{exam?.title ?? "Unknown exam"}</td>
                      <td>
                        <span className={`admin-badge ${row.status === "completed" ? "admin-badge--published" : "admin-badge--draft"}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>{row.review_status ?? "—"}</td>
                      <td>{row.overall_band != null ? Number(row.overall_band).toFixed(1) : "—"}</td>
                      <td>{row.listening_band != null ? Number(row.listening_band).toFixed(1) : "—"}</td>
                      <td>{row.reading_band != null ? Number(row.reading_band).toFixed(1) : "—"}</td>
                      <td>{row.writing_band != null ? Number(row.writing_band).toFixed(1) : "—"}</td>
                      <td>{formatDateTime(row.completed_at ?? row.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-card">
        <h2>Payment History</h2>
        {paymentRows.length === 0 ? (
          <div className="admin-empty-state admin-empty-state--compact">
            <BookOpen />
            <h2>No payment submissions yet</h2>
            <p>Manual payment requests from this student will appear here.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Transaction ID</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((row) => {
                  const exam = Array.isArray(row.mock_exams) ? row.mock_exams[0] : row.mock_exams;
                  const method = getManualPaymentMethod(row.payment_method);
                  return (
                    <tr key={row.id}>
                      <td className="admin-table-title">{exam?.title ?? "Unknown exam"}</td>
                      <td>{method.name}</td>
                      <td>{formatExamPrice(row.amount_cents, row.currency)}</td>
                      <td>
                        <span
                          className={`admin-badge ${
                            row.status === "approved"
                              ? "admin-badge--published"
                              : row.status === "rejected"
                                ? "admin-badge--draft"
                                : "admin-badge--full"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>{row.transaction_id}</td>
                      <td>{formatDateTime(row.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-card">
        <h2>Course Purchases</h2>
        <div className="admin-empty-state admin-empty-state--compact">
          <GraduationCap />
          <h2>No course purchase records yet</h2>
          <p>Course payments are not tracked separately yet, so this section is ready for that future flow.</p>
        </div>
      </div>
    </>
  );
}
