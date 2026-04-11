import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { deleteExam } from "../actions";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !isAdminEmail(user.email)) {
    return null;
  }

  const admin = createServiceRoleClient();
  const { data: exams } = await admin
    .from("mock_exams")
    .select("id, title, slug, is_published, exam_type, price_cents, currency, exam_categories(name)")
    .order("title", { ascending: true });

  return (
    <>
      <h1 className="admin-h1">Mock exams</h1>
      <p className="admin-lead">Create and publish exams for the Mock Exam catalog.</p>

      <p style={{ marginBottom: "1.25rem" }}>
        <Link href="/admin/exams/new" className="btn btn-primary btn-topbar-cta">
          New exam
        </Link>
      </p>

      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Type</th>
                <th>Price</th>
                <th>Published</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(exams ?? []).map((row) => {
                const catName = categoryNameFromRelation(row.exam_categories);
                const price = (row.price_cents / 100).toFixed(2);
                return (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>{catName ?? "—"}</td>
                    <td>{row.exam_type}</td>
                    <td>
                      {row.currency} {price}
                    </td>
                    <td>{row.is_published ? "Yes" : "No"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Link href={`/admin/exams/${row.id}`} className="btn btn-outline" style={{ fontSize: "0.8rem" }}>
                        Edit
                      </Link>
                      <form action={deleteExam} style={{ display: "inline-block", marginLeft: "0.35rem" }}>
                        <input type="hidden" name="id" value={row.id} />
                        <button type="submit" className="btn btn-outline" style={{ fontSize: "0.8rem" }}>
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
