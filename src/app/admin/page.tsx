import Link from "next/link";
import { BookOpen, DollarSign, TrendingUp, Users } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export default async function AdminHomePage() {
  const admin = createServiceRoleClient();

  const [{ count: examCount }, { data: attempts }, { data: examsForRev }] = await Promise.all([
    admin.from("mock_exams").select("*", { count: "exact", head: true }),
    admin.from("mock_attempts").select("exam_id, overall_band, status"),
    admin.from("mock_exams").select("id, price_cents"),
  ]);

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

  const priceByExam = new Map<string, number>();
  for (const e of examsForRev ?? []) {
    priceByExam.set(e.id, e.price_cents ?? 0);
  }
  let revenueCents = 0;
  for (const a of completed) {
    if (a.exam_id) {
      revenueCents += priceByExam.get(a.exam_id) ?? 0;
    }
  }
  const revenue = (revenueCents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <>
      <div className="admin-dash-head">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Manage and create mock exams aligned with IELTS task types.</p>
        </div>
        <Link href="/admin/exams/new" className="btn btn-primary btn-topbar-cta">
          + Create New Exam
        </Link>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card admin-stat-card--blue">
          <div className="admin-stat-card__icon" aria-hidden>
            <BookOpen strokeWidth={2} />
          </div>
          <div>
            <div className="admin-stat-card__label">Total exams</div>
            <div className="admin-stat-card__value">{examCount ?? 0}</div>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--green">
          <div className="admin-stat-card__icon" aria-hidden>
            <Users strokeWidth={2} />
          </div>
          <div>
            <div className="admin-stat-card__label">Total attempts</div>
            <div className="admin-stat-card__value">{totalAttempts}</div>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--purple">
          <div className="admin-stat-card__icon" aria-hidden>
            <TrendingUp strokeWidth={2} />
          </div>
          <div>
            <div className="admin-stat-card__label">Average score</div>
            <div className="admin-stat-card__value">{avgBand}</div>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--orange">
          <div className="admin-stat-card__icon" aria-hidden>
            <DollarSign strokeWidth={2} />
          </div>
          <div>
            <div className="admin-stat-card__label">Revenue (est.)</div>
            <div className="admin-stat-card__value">{revenue}</div>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h2>Quick links</h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.85 }}>
          <li>
            <Link href="/admin/exams" style={{ fontWeight: 600 }}>
              All mock exams
            </Link>{" "}
            — search, edit, duplicate, publish
          </li>
          <li>
            <Link href="/admin/categories" style={{ fontWeight: 600 }}>
              Categories
            </Link>
          </li>
          <li>
            <Link href="/mock-exam" style={{ fontWeight: 600 }}>
              Public catalog
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}
