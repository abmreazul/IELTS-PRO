import type { Metadata } from "next";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { MockExamCatalog } from "@/components/mock-exam/mock-exam-catalog";
import type { MockAttemptRow, MockExamRow, MockPaymentRequestRow } from "@/components/mock-exam/types";
import { normalizeExamModules } from "@/lib/exam/ielts-defaults";
import { getSeoOverrides, applySeoOverrides } from "@/lib/seo/metadata";
import "./mock-exam.css";

export async function generateMetadata(): Promise<Metadata> {
  const overrides = await getSeoOverrides("/mock-exam");
  return applySeoOverrides(
    {
      title: "Mock Exams | The IELTS Exam",
      description: "Browse full and partial IELTS mock exams by category.",
    },
    overrides,
  );
}

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
          `*, exam_categories ( id, slug, name, sort_order )`,
        )
        .eq("is_published", true),
    ]);

    const exams = ((examsRaw ?? []) as unknown as MockExamRow[]).map((exam) => ({
      ...exam,
      modules: normalizeExamModules(exam.modules),
    }));
    const catList = categories ?? [];
    const examsByCategory = catList
      .map((cat) => ({
        category: cat,
        exams: exams
          .filter((e) => e.category_id === cat.id)
          .sort((a, b) => {
            const aOrder = Number((a as unknown as { display_order?: unknown }).display_order) || 0;
            const bOrder = Number((b as unknown as { display_order?: unknown }).display_order) || 0;
            if (aOrder !== bOrder) return aOrder - bOrder;
            const aCreated = String((a as unknown as { created_at?: unknown }).created_at ?? "");
            const bCreated = String((b as unknown as { created_at?: unknown }).created_at ?? "");
            return bCreated.localeCompare(aCreated);
          }),
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
  const paymentRequestsByExamId: Record<string, MockPaymentRequestRow> = {};
  const entitledExamIds = new Set<string>();

  if (user) {
    const supabase = await createClient();
    const [{ data: attempts }, { data: ents }, { data: paymentRequests }] = await Promise.all([
      supabase
        .from("mock_attempts")
        .select(
          "id, exam_id, status, review_status, overall_band, listening_band, reading_band, writing_band, completed_at, created_at",
        )
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false }),
      supabase.from("exam_entitlements").select("exam_id").eq("user_id", user.id),
      supabase
        .from("payment_requests")
        .select("id, exam_id, payment_method, transaction_id, proof_url, amount_cents, currency, status, admin_note, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
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

    for (const row of paymentRequests ?? []) {
      const request = row as MockPaymentRequestRow;
      if (!paymentRequestsByExamId[request.exam_id]) {
        paymentRequestsByExamId[request.exam_id] = request;
      }
    }
  }

  return (
    <MockExamCatalog
      examsByCategory={examsByCategory}
      attemptsByExamId={attemptsByExamId}
      entitledExamIds={entitledExamIds}
      paymentRequestsByExamId={paymentRequestsByExamId}
      isLoggedIn={!!user}
    />
  );
}

export default function MockExamPage() {
  return (
    <main className="page me-page">
      <div className="container">
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
