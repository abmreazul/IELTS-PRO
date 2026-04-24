"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { evaluateWritingWithGemini } from "@/lib/ai/gemini-writing";
import { roundBandToNearestHalf } from "@/lib/ai/writing-review";
import { coerceTestVariant, normalizeExamModules } from "@/lib/exam/ielts-defaults";

/* ═══════════════════════════════════════════════════════════════════
   IELTS Band Conversion (standard 40-question Listening / Reading)
   ═══════════════════════════════════════════════════════════════════ */

// Raw score → IELTS band (approximate Academic mapping)
const BAND_TABLE: [number, number][] = [
  [39, 9.0], [37, 8.5], [35, 8.0], [33, 7.5], [30, 7.0],
  [27, 6.5], [23, 6.0], [20, 5.5], [16, 5.0], [13, 4.5],
  [10, 4.0], [7, 3.5], [5, 3.0], [3, 2.5], [1, 2.0],
];

function rawToBand(correct: number, total: number): number {
  // Normalise to a 40-question scale
  const normalised = total > 0 ? Math.round((correct / total) * 40) : 0;
  for (const [threshold, band] of BAND_TABLE) {
    if (normalised >= threshold) return band;
  }
  return 1.0;
}

function computeOverallBand(moduleBands: Record<string, number | null>, activeModules: string[]) {
  const relevant = activeModules
    .filter((module) => ["listening", "reading", "writing"].includes(module))
    .map((module) => moduleBands[module])
    .filter((value): value is number => value != null);

  if (relevant.length === 0) return null;
  if (relevant.length !== activeModules.filter((module) => ["listening", "reading", "writing"].includes(module)).length) {
    return null;
  }

  return roundBandToNearestHalf(
    relevant.reduce((sum, value) => sum + value, 0) / relevant.length,
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Start Attempt
   ═══════════════════════════════════════════════════════════════════ */

export async function startExamAttempt(
  examId: string,
): Promise<{ ok: true; attemptId: string } | { ok: false; message: string }> {
  const { user, error } = await getAuthUser();
  if (error || !user) {
    return { ok: false, message: "Sign in required" };
  }

  const admin = createServiceRoleClient();

  // Check exam exists
  const { data: exam } = await admin
    .from("mock_exams")
    .select("id")
    .eq("id", examId)
    .eq("is_published", true)
    .single();

  if (!exam) {
    return { ok: false, message: "Exam not found" };
  }

  // Create attempt
  const { data: attempt, error: aErr } = await admin
    .from("mock_attempts")
    .insert({
      user_id: user.id,
      exam_id: examId,
      status: "in_progress",
    })
    .select("id")
    .single();

  if (aErr || !attempt) {
    return { ok: false, message: aErr?.message ?? "Could not create attempt" };
  }

  return { ok: true, attemptId: attempt.id };
}

/* ═══════════════════════════════════════════════════════════════════
   Submit Attempt — score answers and save results
   ═══════════════════════════════════════════════════════════════════ */

type AnswerMap = Record<string, unknown>;
type SubmitResult = {
  overallBand: number | null;
  moduleBands: Record<string, number | null>;
  reviewPendingModules: string[];
};

export async function submitExamAttempt(
  attemptId: string,
  answers: AnswerMap,
): Promise<
  | { ok: true; result: SubmitResult }
  | { ok: false; message: string }
> {
  const { user, error } = await getAuthUser();
  if (error || !user) {
    return { ok: false, message: "Sign in required" };
  }

  const admin = createServiceRoleClient();

  // Verify attempt belongs to user and is in_progress
  const { data: attempt } = await admin
    .from("mock_attempts")
    .select("id, exam_id, user_id, status")
    .eq("id", attemptId)
    .single();

  if (!attempt || attempt.user_id !== user.id) {
    return { ok: false, message: "Attempt not found" };
  }
  if (attempt.status === "completed") {
    return { ok: false, message: "Already submitted" };
  }

  // Fetch all questions for the exam
  const { data: questions } = await admin
    .from("exam_questions")
    .select("id, module, question_type, correct_json, points, sort_order, prompt")
    .eq("exam_id", attempt.exam_id)
    .order("sort_order");

  if (!questions || questions.length === 0) {
    return { ok: false, message: "No questions found" };
  }

  const { data: exam } = await admin
    .from("mock_exams")
    .select("modules, structure_json")
    .eq("id", attempt.exam_id)
    .single();
  const activeModules = normalizeExamModules(exam?.modules);
  const activeModuleSet = new Set(activeModules);
  const scorableQuestions = questions.filter((question) => activeModuleSet.has((question.module || "reading") as "listening" | "reading" | "writing"));

  // Score each question
  const moduleScores: Record<string, { correct: number; total: number }> = {};
  const allModules = new Set<string>();
  const reviewPendingModules = new Set<string>();
  const subjectiveQuestionTypes = new Set(["essay"]);
  let aiReviewJson: Record<string, unknown> | null = null;

  for (const q of scorableQuestions) {
    const mod = q.module || "reading";
    allModules.add(mod);
    if (subjectiveQuestionTypes.has(String(q.question_type ?? ""))) {
      reviewPendingModules.add(mod);
      continue;
    }
    if (!moduleScores[mod]) {
      moduleScores[mod] = { correct: 0, total: 0 };
    }
    moduleScores[mod].total += 1;

    const userAnswer = answers[q.id];
    if (userAnswer === undefined || userAnswer === null || userAnswer === "") continue;

    const correct = q.correct_json as Record<string, unknown> | null;
    if (!correct) continue;

    let isCorrect = false;

    if (correct.kind === "index") {
      // MCQ — compare selected index
      isCorrect = Number(userAnswer) === Number(correct.index);
    } else if (correct.kind === "triple") {
      // True/False/Not Given — compare string
      isCorrect =
        String(userAnswer).toLowerCase().trim() ===
        String(correct.value).toLowerCase().trim();
    } else if (correct.kind === "rubric") {
      // Short answer — case-insensitive match
      isCorrect =
        String(userAnswer).toLowerCase().trim() ===
        String(correct.value || "").toLowerCase().trim();
    }

    if (isCorrect) {
      moduleScores[mod].correct += 1;
    }
  }

  // Calculate bands per module
  const moduleBands: Record<string, number | null> = {};
  let totalCorrect = 0;
  let totalQuestions = 0;

  for (const [mod, { correct, total }] of Object.entries(moduleScores)) {
    moduleBands[mod] = rawToBand(correct, total);
    totalCorrect += correct;
    totalQuestions += total;
  }
  for (const mod of allModules) {
    if (!(mod in moduleBands)) {
      moduleBands[mod] = null;
    }
  }

  if (activeModuleSet.has("writing")) {
    const structure = exam?.structure_json && typeof exam.structure_json === "object"
      ? exam.structure_json as {
          exam_meta?: { test_variant?: "academic" | "general" };
          writing_tasks?: { part: number; prompt?: string; min_words?: number; image_url?: string }[];
        }
      : null;
    const testVariant = coerceTestVariant(structure?.exam_meta?.test_variant);
    const writingQuestions = scorableQuestions
      .filter((question) => question.module === "writing")
      .sort((a, b) => a.sort_order - b.sort_order);
    const writingTasks = (structure?.writing_tasks ?? [])
      .map((task) => {
        const matchedQuestion = writingQuestions.find((question) => {
          const decodedPart = question.sort_order >= 100 ? Math.floor(question.sort_order / 100) : 1;
          return decodedPart === task.part;
        });
        return matchedQuestion
          ? {
              part: task.part,
              prompt: String(task.prompt ?? matchedQuestion.prompt ?? "").trim(),
              min_words: Number(task.min_words) || null,
              image_url: String(task.image_url ?? "").trim() || null,
              answer: typeof answers[matchedQuestion.id] === "string" ? String(answers[matchedQuestion.id]) : "",
              test_variant: testVariant,
            }
          : null;
      })
      .filter((task): task is NonNullable<typeof task> => Boolean(task));

    if (writingTasks.length > 0) {
      const writingAiResult = await evaluateWritingWithGemini(writingTasks);
      if (writingAiResult.ok) {
        reviewPendingModules.delete("writing");
        moduleBands.writing = writingAiResult.review.overall_band;
        aiReviewJson = writingAiResult.review as unknown as Record<string, unknown>;
      } else {
        reviewPendingModules.add("writing");
      }
    } else {
      reviewPendingModules.add("writing");
    }
  }

  const overallBand = reviewPendingModules.size > 0
    ? null
    : computeOverallBand(moduleBands, activeModules) ?? rawToBand(totalCorrect, totalQuestions);
  const reviewStatus = reviewPendingModules.size > 0
    ? "pending"
    : aiReviewJson
      ? "reviewed"
      : "not_required";

  // Update attempt
  const { error: updateErr } = await admin
    .from("mock_attempts")
    .update({
      answers_json: answers,
      ai_review_json: aiReviewJson,
      review_status: reviewStatus,
      status: "completed",
      overall_band: overallBand,
      listening_band: moduleBands.listening ?? null,
      reading_band: moduleBands.reading ?? null,
      writing_band: moduleBands.writing ?? null,
      speaking_band: null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", attemptId);

  if (updateErr) {
    return { ok: false, message: updateErr.message };
  }

  revalidatePath("/mock-exam");

  return {
    ok: true,
    result: {
      overallBand,
      moduleBands,
      reviewPendingModules: Array.from(reviewPendingModules),
    },
  };
}
