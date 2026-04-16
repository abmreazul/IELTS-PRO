import type { Metadata } from "next";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { MockExamCatalog } from "@/components/mock-exam/mock-exam-catalog";
import type { MockAttemptRow, MockExamRow } from "@/components/mock-exam/types";
import "./mock-exam.css";

export const metadata: Metadata = {
  title: "Mock Exams | IELTS Pro",
  description: "Browse full and partial IELTS mock exams by category.",
};

/**
 * Cache the public catalog data (categories + published exams) for 60s.
 * This data is the same for ALL visitors — no need to re-fetch per request.
 * Admin publish actions call revalidatePath which busts this.
 */
const getCatalogData = unstable_cache(
  async () => {
    const supabase = await createClient();

    const [{ data: categories }, { data: examsRaw }] = await Promise.all([
      supabase
        .from("exam_categories")
        .select("id, slug, name, sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("mock_exams")
        .select(
          `id, category_id, title, slug, description, exam_type, modules,
           duration_minutes, question_count, difficulty, price_cents, currency,
           cover_image_url, listening_audio_json, is_published,
           exam_categories ( id, slug, name, sort_order )`,
        )
        .eq("is_published", true),
    ]);

    const exams = (examsRaw ?? []) as unknown as MockExamRow[];
    const catList = categories ?? [];
    const examsByCategory = catList
      .map((cat) => ({
        category: cat,
        exams: exams.filter((e) => e.category_id === cat.id),
      }))
      .filter((g) => g.exams.length > 0);

    return { examsByCategory };
  },
  ["mock-exam-catalog"],
  { revalidate: 60, tags: ["mock-exam-catalog"] },
);

/** Fetch user-specific attempt/entitlement data (not cached — unique per user). */
async function UserCatalog() {
  const [{ examsByCategory }, { user }] = await Promise.all([
    getCatalogData(),
    getAuthUser(),
  ]);

  const attemptsByExamId: Record<string, MockAttemptRow> = {};
  const entitledExamIds = new Set<string>();

  if (user) {
    const supabase = await createClient();
    const [{ data: attempts }, { data: ents }] = await Promise.all([
      supabase
        .from("mock_attempts")
        .select(
          "id, exam_id, status, review_status, overall_band, listening_band, reading_band, writing_band, speaking_band, completed_at, created_at",
        )
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false }),
      supabase.from("exam_entitlements").select("exam_id").eq("user_id", user.id),
    ]);

    for (const row of attempts ?? []) {
      const a = row as MockAttemptRow;
      if (!attemptsByExamId[a.exam_id]) {
        attemptsByExamId[a.exam_id] = a;
      }
    }

    for (const e of ents ?? []) {
      entitledExamIds.add((e as { exam_id: string }).exam_id);
    }
  }

  return (
    <MockExamCatalog
      examsByCategory={examsByCategory}
      attemptsByExamId={attemptsByExamId}
      entitledExamIds={entitledExamIds}
      isLoggedIn={!!user}
    />
  );
}

export default function MockExamPage() {
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

        <Suspense
          fallback={
            <>
              {Array.from({ length: 2 }).map((_, s) => (
                <section key={s} className="me-section">
                  <div className="skel skel-text" style={{ width: "120px", height: "1.05rem", marginBottom: "1.25rem" }} />
                  <div className="me-grid">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="me-card" style={{ minHeight: "320px" }}>
                        <div className="me-card__media">
                          <div className="skel" style={{ width: "100%", height: "100%" }} />
                        </div>
                        <div className="me-card__body">
                          <div className="skel skel-text" style={{ width: "85%", height: "1.2rem" }} />
                          <div className="skel skel-text" style={{ width: "60%", height: "0.875rem", marginTop: "0.5rem" }} />
                          <div className="skel skel-text" style={{ width: "80px", height: "1.5rem", marginTop: "0.75rem" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </>
          }
        >
          <UserCatalog />
        </Suspense>
      </div>
    </main>
  );
}
