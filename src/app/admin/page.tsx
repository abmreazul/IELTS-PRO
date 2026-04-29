import Link from "next/link";
import { BookOpen, ClipboardCheck, DollarSign, TrendingUp, Users, Wallet } from "lucide-react";
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  AdminExamsTable,
  type AdminExamRow,
} from "@/components/admin/admin-exams-table";

function categoryNameFromRelation(rel: unknown): string | null {
  if (rel == null) return null;
  if (Array.isArray(rel)) {
    const first = rel[0];
    if (first && typeof first === "object" && "name" in first) {
      const n = (first as { name: unknown }).name;
      return typeof n === "string" ? n : null;
    }
    return null;
  }
  if (typeof rel === "object" && "name" in rel) {
    const n = (rel as { name: unknown }).name;
    return typeof n === "string" ? n : null;
  }
  return null;
}

/**
 * Cache admin dashboard data for 30s.
 * revalidatePath("/admin") from server actions will bust this instantly.
 */
const getAdminDashboardData = unstable_cache(
  async () => {
    const admin = createServiceRoleClient();

    const [{ count: examCount }, { data: attempts }, { data: approvedPayments }, { data: exams }, { count: pendingReviews }, { count: pendingPayments }, { count: userCount }] =
      await Promise.all([
        admin.from("mock_exams").select("*", { count: "exact", head: true }),
        admin.from("mock_attempts").select("exam_id, overall_band, status"),
        admin.from("payment_requests").select("amount_cents, currency").eq("status", "approved"),
        admin
          .from("mock_exams")
          .select(
            "id, title, slug, is_published, exam_type, modules, price_cents, currency, created_at, exam_categories(name)",
          )
          .order("created_at", { ascending: false }),
        admin.from("mock_attempts").select("*", { count: "exact", head: true }).eq("review_status", "pending"),
        admin.from("payment_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        admin.from("profiles").select("*", { count: "exact", head: true }),
      ]);

    /* ── Stats ─────────────────────────────────────────── */
    const completed = (attempts ?? []).filter((a) => a.status === "completed");
    const totalAttempts = completed.length;

    let sumBand = 0;
    let bandN = 0;
    for (const a of completed) {
      if (a.overall_band != null) {
        sumBand += Number(a.overall_band);
        bandN += 1;
      }
    }
    const avgBand = bandN > 0 ? (sumBand / bandN).toFixed(1) : "—";

    // Revenue = sum of approved payment requests (actual money received)
    let revenueCents = 0;
    for (const p of approvedPayments ?? []) {
      revenueCents += p.amount_cents ?? 0;
    }
    const revenue = (revenueCents / 100).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

    /* ── Table rows ─────────────────────────────────────── */
    const statsByExam = new Map<string, { count: number; sum: number; n: number }>();
    for (const a of completed) {
      if (!a.exam_id) continue;
      const cur = statsByExam.get(a.exam_id) ?? { count: 0, sum: 0, n: 0 };
      cur.count += 1;
      if (a.overall_band != null) {
        cur.sum += Number(a.overall_band);
        cur.n += 1;
      }
      statsByExam.set(a.exam_id, cur);
    }

    const rows: AdminExamRow[] = (exams ?? []).map((row) => {
      const st = statsByExam.get(row.id);
      const avgBandRow = st && st.n > 0 ? st.sum / st.n : null;
      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        is_published: row.is_published,
        exam_type: row.exam_type,
        modules: row.modules as string[] | null,
        price_cents: row.price_cents,
        currency: row.currency,
        created_at: row.created_at,
        categoryName: categoryNameFromRelation(row.exam_categories),
        attempts: st?.count ?? 0,
        avgBand: avgBandRow,
      };
    });

    return {
      examCount: examCount ?? 0,
      totalAttempts,
      avgBand,
      revenue,
      userCount: userCount ?? 0,
      pendingReviews: pendingReviews ?? 0,
      pendingPayments: pendingPayments ?? 0,
      rows,
    };
  },
  ["admin-dashboard"],
  { revalidate: 30, tags: ["admin-dashboard"] },
);

export default async function AdminHomePage() {
  const { examCount, totalAttempts, avgBand, revenue, userCount, pendingReviews, pendingPayments, rows } =
    await getAdminDashboardData();

  return (
    <>
      {/* ── Header ─────────────────────────────────── */}
      <div className="admin-dash-head">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Manage and create mock exams</p>
        </div>
        <div className="admin-table-actions">
          <Link href="/admin/seo" className="btn btn-outline">
            SEO
          </Link>
          <Link href="/admin/courses/new" className="btn btn-outline">
            + Create Course
          </Link>
          <Link href="/admin/exams/new" className="admin-cta-btn">
            + Create New Exam
          </Link>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────── */}
      <div className="admin-stat-grid">
        <div className="admin-stat-card admin-stat-card--blue">
          <div className="admin-stat-card__body">
            <div className="admin-stat-card__label">Total Exams</div>
            <div className="admin-stat-card__value">{examCount}</div>
          </div>
          <div className="admin-stat-card__icon" aria-hidden>
            <BookOpen strokeWidth={2} />
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--green">
          <div className="admin-stat-card__body">
            <div className="admin-stat-card__label">Total Attempts</div>
            <div className="admin-stat-card__value">{totalAttempts}</div>
          </div>
          <div className="admin-stat-card__icon" aria-hidden>
            <Users strokeWidth={2} />
          </div>
        </div>
        <Link href="/admin/users" className="admin-stat-link">
          <div className="admin-stat-card admin-stat-card--purple">
            <div className="admin-stat-card__body">
              <div className="admin-stat-card__label">Users</div>
              <div className="admin-stat-card__value">{userCount}</div>
            </div>
            <div className="admin-stat-card__icon" aria-hidden>
              <Users strokeWidth={2} />
            </div>
          </div>
        </Link>
        <div className="admin-stat-card admin-stat-card--purple">
          <div className="admin-stat-card__body">
            <div className="admin-stat-card__label">Average Score</div>
            <div className="admin-stat-card__value">{avgBand}</div>
          </div>
          <div className="admin-stat-card__icon" aria-hidden>
            <TrendingUp strokeWidth={2} />
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--orange">
          <div className="admin-stat-card__body">
            <div className="admin-stat-card__label">Revenue</div>
            <div className="admin-stat-card__value">{revenue}</div>
          </div>
          <div className="admin-stat-card__icon" aria-hidden>
            <DollarSign strokeWidth={2} />
          </div>
        </div>
        <Link href="/admin/payments" className="admin-stat-link">
          <div className="admin-stat-card admin-stat-card--green">
            <div className="admin-stat-card__body">
              <div className="admin-stat-card__label">Pending Payments</div>
              <div className="admin-stat-card__value">{pendingPayments}</div>
            </div>
            <div className="admin-stat-card__icon" aria-hidden>
              <Wallet strokeWidth={2} />
            </div>
          </div>
        </Link>
        <Link href="/admin/reviews" className="admin-stat-link">
          <div className="admin-stat-card admin-stat-card--red">
            <div className="admin-stat-card__body">
              <div className="admin-stat-card__label">Pending Reviews</div>
              <div className="admin-stat-card__value">{pendingReviews}</div>
            </div>
            <div className="admin-stat-card__icon" aria-hidden>
              <ClipboardCheck strokeWidth={2} />
            </div>
          </div>
        </Link>
      </div>

      {/* ── Exams table ────────────────────────────── */}
      <div className="admin-card">
        <AdminExamsTable exams={rows} />
      </div>
    </>
  );
}
