import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExamForm } from "@/components/admin/exam-form";

export default async function AdminNewExamPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("exam_categories")
    .select("id, name, slug")
    .order("sort_order", { ascending: true });

  if (!categories?.length) {
    return (
      <>
        <h1 className="admin-h1">New exam</h1>
        <p className="admin-lead">
          Create at least one{" "}
          <Link href="/admin/categories" style={{ color: "var(--primary)", fontWeight: 700 }}>
            category
          </Link>{" "}
          first.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="admin-h1">New exam</h1>
      <p className="admin-lead">
        <Link href="/admin/exams" style={{ color: "var(--primary)", fontWeight: 600 }}>
          ← Back to list
        </Link>
      </p>
      <div className="admin-card">
        <ExamForm categories={categories} />
      </div>
    </>
  );
}
