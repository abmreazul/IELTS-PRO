import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ExamSessionGate, type ExamData, type ExamQuestion } from "@/components/mock-exam/exam-player";
import "./exam-player.css";

export const metadata: Metadata = {
  title: "Take Exam",
};

export default async function TakeMockExamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Require sign-in
  const { user, error: authErr } = await getAuthUser();
  if (authErr || !user) {
    redirect(`/sign-in?next=/mock-exam/${slug}/take`);
  }

  // Fetch exam
  const supabase = await createClient();
  const { data: exam } = await supabase
    .from("mock_exams")
    .select("id, title, slug, description, exam_type, modules, duration_minutes, question_count, difficulty, cover_image_url, listening_audio_json, structure_json, is_published, price_cents")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!exam) {
    return (
      <main className="page" style={{ padding: "3rem 1.5rem" }}>
        <div className="container" style={{ maxWidth: "36rem", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "1.5rem", fontWeight: 800 }}>
            Exam not found
          </h1>
          <p style={{ color: "var(--muted)", marginTop: "0.75rem" }}>
            This exam doesn&apos;t exist or isn&apos;t published yet.
          </p>
          <a href="/mock-exam" className="btn btn-primary btn-topbar-cta" style={{ marginTop: "1.5rem" }}>
            Browse exams
          </a>
        </div>
      </main>
    );
  }

  if ((exam.price_cents ?? 0) > 0) {
    const { data: entitlement } = await supabase
      .from("exam_entitlements")
      .select("exam_id")
      .eq("user_id", user.id)
      .eq("exam_id", exam.id)
      .maybeSingle();

    if (!entitlement) {
      return (
        <main className="page" style={{ padding: "3rem 1.5rem" }}>
          <div className="container" style={{ maxWidth: "36rem", textAlign: "center" }}>
            <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "1.5rem", fontWeight: 800 }}>
              Payment verification required
            </h1>
            <p style={{ color: "var(--muted)", marginTop: "0.75rem" }}>
              This premium mock exam becomes available after your manual payment is approved by the admin team.
            </p>
            <a href="/mock-exam" className="btn btn-primary btn-topbar-cta" style={{ marginTop: "1.5rem" }}>
              Back to mock exams
            </a>
          </div>
        </main>
      );
    }
  }

  // Fetch questions
  const admin = createServiceRoleClient();
  const { data: questionsRaw } = await admin
    .from("exam_questions")
    .select("id, module, question_type, prompt, options_json, correct_json, points, sort_order")
    .eq("exam_id", exam.id)
    .order("sort_order");

  const questions: ExamQuestion[] = (questionsRaw ?? []).map((q) => ({
    id: q.id,
    module: q.module,
    question_type: q.question_type,
    prompt: q.prompt,
    options_json: q.options_json,
    correct_json: null, // Don't send correct answers to client!
    points: q.points,
    sort_order: q.sort_order,
  }));

  if (questions.length === 0) {
    return (
      <main className="page" style={{ padding: "3rem 1.5rem" }}>
        <div className="container" style={{ maxWidth: "36rem", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-display), sans-serif", fontSize: "1.5rem", fontWeight: 800 }}>
            No questions yet
          </h1>
          <p style={{ color: "var(--muted)", marginTop: "0.75rem" }}>
            This exam has no questions added. Please try again later.
          </p>
          <a href="/mock-exam" className="btn btn-primary btn-topbar-cta" style={{ marginTop: "1.5rem" }}>
            Browse exams
          </a>
        </div>
      </main>
    );
  }

  const examData: ExamData = {
    id: exam.id,
    title: exam.title,
    slug: exam.slug,
    description: exam.description,
    exam_type: exam.exam_type,
    modules: exam.modules,
    duration_minutes: exam.duration_minutes,
    question_count: exam.question_count,
    difficulty: exam.difficulty,
    cover_image_url: exam.cover_image_url,
    listening_audio_json: exam.listening_audio_json as ExamData["listening_audio_json"],
    structure_json: exam.structure_json as ExamData["structure_json"],
  };

  return <ExamSessionGate exam={examData} questions={questions} />;
}
