import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";

export default async function AdminExamAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    notFound();
  }

  const admin = createServiceRoleClient();
  const { data: exam } = await admin.from("mock_exams").select("id, title, slug").eq("id", id).maybeSingle();
  if (!exam) notFound();

  const { data: attempts } = await admin
    .from("mock_attempts")
    .select("id, user_id, status, overall_band, completed_at, created_at")
    .eq("exam_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  const completed = (attempts ?? []).filter((a) => a.status === "completed");
  let sum = 0;
  let n = 0;
  for (const a of completed) {
    if (a.overall_band != null) {
      sum += Number(a.overall_band);
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
            Analytics — {exam.title}
          </h1>
          <p className="admin-lead" style={{ marginBottom: 0 }}>
            Completed attempts: {completed.length}. Average overall band: {avg}.
          </p>
        </div>
        <Link href={`/admin/exams/${id}`} className="btn btn-outline">
          Edit exam
        </Link>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Status</th>
                <th>Overall band</th>
              </tr>
            </thead>
            <tbody>
              {(attempts ?? []).map((a) => (
                <tr key={a.id}>
                  <td>{a.completed_at ?? a.created_at ?? "—"}</td>
                  <td>{a.status}</td>
                  <td>{a.overall_band ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(attempts ?? []).length === 0 ? (
          <p style={{ color: "var(--muted)", marginTop: "0.75rem" }}>No attempts yet.</p>
        ) : null}
      </div>
    </>
  );
}
