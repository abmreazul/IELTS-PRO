import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { ExamWizard, type ExamWizardInitialExam } from "@/components/admin/exam-wizard";

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

  const { data: questionRows } = await admin
    .from("exam_questions")
    .select("id, module, question_type, prompt, options_json, correct_json, points")
    .eq("exam_id", id)
    .order("sort_order", { ascending: true });

  const initialExam: ExamWizardInitialExam = {
    id: exam.id,
    category_id: exam.category_id,
    title: exam.title,
    slug: exam.slug,
    description: exam.description,
    exam_type: exam.exam_type,
    modules: (exam.modules as string[]) ?? [],
    duration_minutes: exam.duration_minutes,
    question_count: exam.question_count,
    difficulty: exam.difficulty,
    price_cents: exam.price_cents,
    currency: exam.currency,
    cover_image_url: exam.cover_image_url,
    is_published: exam.is_published,
    structure_json: (exam as { structure_json?: unknown }).structure_json,
    scoring_json: (exam as { scoring_json?: unknown }).scoring_json,
    listening_audio_json: (exam as { listening_audio_json?: unknown }).listening_audio_json,
  };

  return (
    <ExamWizard
      categories={categories}
      initialExam={initialExam}
      initialQuestions={
        (questionRows ?? []).map((q) => ({
          id: q.id,
          module: q.module,
          question_type: q.question_type,
          prompt: q.prompt,
          options_json: q.options_json,
          correct_json: q.correct_json,
          points: q.points,
        }))
      }
    />
  );
}
