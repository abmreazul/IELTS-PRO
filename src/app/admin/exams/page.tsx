import Link from "next/link";
import { getAuthUser } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
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

export default async function AdminExamsListPage() {
  // Cached — admin layout already called getAuthUser(), this is a free hit
  const { user } = await getAuthUser();

  if (!user?.email || !isAdminEmail(user.email)) {
    return null;
  }

  const admin = createServiceRoleClient();
  const [{ data: exams }, { data: attempts }] = await Promise.all([
    admin
      .from("mock_exams")
      .select(
        "*, exam_categories(name)",
      )
      .order("created_at", { ascending: false }),
    admin.from("mock_attempts").select("exam_id, overall_band, status"),
  ]);

  const completed = (attempts ?? []).filter((a) => a.status === "completed");
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
    const avgBand = st && st.n > 0 ? st.sum / st.n : null;
    const structure = row.structure_json && typeof row.structure_json === "object"
      ? (row.structure_json as Record<string, unknown>)
      : null;
    const adminOrder = structure?.exam_meta && typeof structure.exam_meta === "object"
      ? Number((structure.exam_meta as Record<string, unknown>).admin_order) || 0
      : 0;
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
      display_order: adminOrder,
      categoryName: categoryNameFromRelation(row.exam_categories),
      attempts: st?.count ?? 0,
      avgBand,
    };
  });

  return (
    <>
      <div className="admin-dash-head">
        <div>
          <h1 className="admin-h1" style={{ marginBottom: "0.35rem" }}>
            Mock exams
          </h1>
          <p className="admin-lead" style={{ marginBottom: 0 }}>
            Create, publish, and manage IELTS-format mocks. Revenue is estimated from completed attempts × list
            price.
          </p>
        </div>
        <Link href="/admin/exams/new" className="btn btn-primary btn-topbar-cta">
          + Create New Exam
        </Link>
      </div>

      <div className="admin-card">
        <AdminExamsTable exams={rows} />
      </div>
    </>
  );
}
