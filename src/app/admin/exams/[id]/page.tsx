import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { ExamForm } from "@/components/admin/exam-form";

export default async function AdminEditExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    notFound();
  }

  const admin = createServiceRoleClient();
  const { data: exam, error } = await admin.from("mock_exams").select("*").eq("id", id).maybeSingle();

  if (error || !exam) {
    notFound();
  }

  const { data: categories } = await supabase
    .from("exam_categories")
    .select("id, name, slug")
    .order("sort_order", { ascending: true });

  if (!categories?.length) {
    notFound();
  }

  return (
    <>
      <h1 className="admin-h1">Edit exam</h1>
      <p className="admin-lead">
        <Link href="/admin/exams" style={{ color: "var(--primary)", fontWeight: 600 }}>
          ← Back to list
        </Link>
      </p>
      <div className="admin-card">
        <ExamForm
          categories={categories}
          exam={{
            id: exam.id,
            category_id: exam.category_id,
            title: exam.title,
            slug: exam.slug,
            description: exam.description,
            exam_type: exam.exam_type,
            modules: exam.modules ?? [],
            duration_minutes: exam.duration_minutes,
            question_count: exam.question_count,
            difficulty: exam.difficulty,
            price_cents: exam.price_cents,
            currency: exam.currency,
            cover_image_url: exam.cover_image_url,
            is_published: exam.is_published,
          }}
        />
      </div>
    </>
  );
}
