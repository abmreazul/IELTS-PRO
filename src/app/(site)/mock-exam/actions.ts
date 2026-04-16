"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const ATTEMPT_MEDIA_BUCKET = "attempt-media";

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

export async function getSignedSpeakingResponseUploadUrl(
  attemptId: string,
  questionId: string,
  fileExt: string,
  contentType: string,
): Promise<
  | { ok: true; signedUrl: string; path: string; bucket: string }
  | { ok: false; message: string }
> {
  const { user, error } = await getAuthUser();
  if (error || !user) {
    return { ok: false, message: "Sign in required" };
  }

  const admin = createServiceRoleClient();
  const { data: attempt } = await admin
    .from("mock_attempts")
    .select("id, user_id, status")
    .eq("id", attemptId)
    .single();

  if (!attempt || attempt.user_id !== user.id) {
    return { ok: false, message: "Attempt not found" };
  }
  if (attempt.status === "completed") {
    return { ok: false, message: "This attempt is already submitted." };
  }

  const safeExt = (fileExt || "webm").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "webm";
  const path = `speaking/${user.id}/${attemptId}/${questionId}-${crypto.randomUUID()}.${safeExt}`;

  const { data, error: uploadErr } = await admin.storage
    .from(ATTEMPT_MEDIA_BUCKET)
    .createSignedUploadUrl(path);

  if (uploadErr || !data) {
    return { ok: false, message: uploadErr?.message ?? "Could not create upload URL" };
  }

  return {
    ok: true,
    signedUrl: data.signedUrl,
    path,
    bucket: ATTEMPT_MEDIA_BUCKET,
  };
}

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
    .select("id, module, question_type, correct_json, points")
    .eq("exam_id", attempt.exam_id)
    .order("sort_order");

  if (!questions || questions.length === 0) {
    return { ok: false, message: "No questions found" };
  }

  // Score each question
  const moduleScores: Record<string, { correct: number; total: number }> = {};
  const allModules = new Set<string>();
  const reviewPendingModules = new Set<string>();
  const subjectiveQuestionTypes = new Set(["essay", "speaking_prompt"]);

  for (const q of questions) {
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

  const overallBand = reviewPendingModules.size > 0
    ? null
    : rawToBand(totalCorrect, totalQuestions);
  const reviewStatus = reviewPendingModules.size > 0 ? "pending" : "not_required";

  // Update attempt
  const { error: updateErr } = await admin
    .from("mock_attempts")
    .update({
      answers_json: answers,
      review_status: reviewStatus,
      status: "completed",
      overall_band: overallBand,
      listening_band: moduleBands.listening ?? null,
      reading_band: moduleBands.reading ?? null,
      writing_band: moduleBands.writing ?? null,
      speaking_band: moduleBands.speaking ?? null,
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
