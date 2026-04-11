import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExamWizard } from "@/components/admin/exam-wizard";

export default async function AdminNewExamPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("exam_categories")
    .select("id, name, slug")
    .order("sort_order", { ascending: true });

  if (!categories?.length) {
    return (
      <>
        <p className="admin-lead">
          <Link href="/admin/exams" className="admin-wizard-back">
            ← Back to exams
          </Link>
        </p>
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

  return <ExamWizard categories={categories} />;
}
