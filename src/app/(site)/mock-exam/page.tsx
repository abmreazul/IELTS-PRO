import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { MockExamCatalog } from "@/components/mock-exam/mock-exam-catalog";
import type { MockAttemptRow, MockExamRow } from "@/components/mock-exam/types";
import "./mock-exam.css";

export const metadata: Metadata = {
  title: "Mock Exams | IELTS Pro",
  description: "Browse full and partial IELTS mock exams by category.",
};

export default async function MockExamPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("exam_categories")
    .select("id, slug, name, sort_order")
    .order("sort_order", { ascending: true });

  const { data: examsRaw } = await supabase
    .from("mock_exams")
    .select(
      `
      id,
      category_id,
      title,
      slug,
      description,
      exam_type,
      modules,
      duration_minutes,
      question_count,
      difficulty,
      price_cents,
      currency,
      cover_image_url,
      is_published,
      exam_categories ( id, slug, name, sort_order )
    `,
    )
    .eq("is_published", true);

  const exams = (examsRaw ?? []) as unknown as MockExamRow[];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const attemptsByExamId: Record<string, MockAttemptRow> = {};
  const entitledExamIds = new Set<string>();

  if (user) {
    const { data: attempts } = await supabase
      .from("mock_attempts")
      .select(
        "id, exam_id, status, overall_band, listening_band, reading_band, writing_band, speaking_band, completed_at, created_at",
      )
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    for (const row of attempts ?? []) {
      const a = row as MockAttemptRow;
      if (!attemptsByExamId[a.exam_id]) {
        attemptsByExamId[a.exam_id] = a;
      }
    }

    const { data: ents } = await supabase
      .from("exam_entitlements")
      .select("exam_id")
      .eq("user_id", user.id);

    for (const e of ents ?? []) {
      entitledExamIds.add((e as { exam_id: string }).exam_id);
    }
  }

  const catList = categories ?? [];
  const examsByCategory = catList
    .map((cat) => ({
      category: cat,
      exams: exams.filter((e) => e.category_id === cat.id),
    }))
    .filter((g) => g.exams.length > 0);

  return (
    <main className="page me-page">
      <div className="container">
        <header className="me-page__head">
          <h1 className="me-page__title">Mock exams</h1>
          <p className="me-page__lead">
            Full tests and single-skill practice, organised by category. Complete a test to see your
            band here on the card.
          </p>
        </header>

        <MockExamCatalog
          examsByCategory={examsByCategory}
          attemptsByExamId={attemptsByExamId}
          entitledExamIds={entitledExamIds}
          isLoggedIn={!!user}
        />
      </div>
    </main>
  );
}
