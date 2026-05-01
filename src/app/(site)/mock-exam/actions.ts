"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { evaluateWritingWithGemini } from "@/lib/ai/gemini-writing";
import { roundBandToNearestHalf } from "@/lib/ai/writing-review";
import { coerceTestVariant, normalizeExamModules } from "@/lib/exam/ielts-defaults";
import type { ManualPaymentMethodId } from "@/lib/payments/manual-payment";
import { enforceActionRateLimit } from "@/lib/security/rate-limit";

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

function isMissingAiReviewColumn(message: string | undefined) {
  return Boolean(
    message &&
      message.includes("ai_review_json") &&
      (message.includes("schema cache") || message.includes("Could not find the")),
  );
}

function isMissingPaymentTable(message: string | undefined) {
  return Boolean(
    message &&
      message.includes("payment_requests") &&
      (message.includes("schema cache") || message.includes("Could not find the")),
  );
}

function isMissingPaymentBucket(message: string | undefined) {
  return Boolean(message && message.includes("payment-proofs"));
}

const PAYMENT_PROOF_BUCKET = "payment-proofs";

export async function uploadPaymentProof(formData: FormData) {
  const { user, error } = await getAuthUser();
  if (error || !user) {
    return { ok: false, message: "Sign in required." };
  }
  try {
    await enforceActionRateLimit({
      action: "mock-exam:upload-payment-proof",
      subject: `user:${user.id}`,
      limit: 10,
      windowMs: 5 * 60_000,
    });
  } catch (rateError) {
    return { ok: false, message: rateError instanceof Error ? rateError.message : "Too many requests." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "Receipt file is required." };
  }

  const mime = (file.type || "").toLowerCase();
  const allowed = mime.startsWith("image/") || mime === "application/pdf";
  if (!allowed) {
    return { ok: false, message: "Upload a receipt image or PDF." };
  }

  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    return { ok: false, message: "Receipt is too large. Max 10 MB." };
  }

  const ext = (file.name.split(".").pop() || (mime === "application/pdf" ? "pdf" : "jpg"))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext || "jpg"}`;

  const admin = createServiceRoleClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from(PAYMENT_PROOF_BUCKET).upload(path, buffer, {
    contentType: mime || undefined,
    upsert: false,
  });

  if (uploadError) {
    if (isMissingPaymentBucket(uploadError.message)) {
      return { ok: false, message: "Payment proof storage is missing in Supabase. Apply the latest payment migration first." };
    }
    return { ok: false, message: uploadError.message };
  }

  const { data } = admin.storage.from(PAYMENT_PROOF_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

type SubmitPaymentInput = {
  examId: string;
  paymentMethod: ManualPaymentMethodId;
  transactionId: string;
  proofUrl?: string | null;
  currency: string;
  amountCents: number;
};

export async function submitPaymentRequest(input: SubmitPaymentInput) {
  const { user, error } = await getAuthUser();
  if (error || !user) {
    return { ok: false, message: "Sign in required." };
  }
  try {
    await enforceActionRateLimit({
      action: "mock-exam:submit-payment-request",
      subject: `user:${user.id}`,
      limit: 6,
      windowMs: 10 * 60_000,
    });
  } catch (rateError) {
    return { ok: false, message: rateError instanceof Error ? rateError.message : "Too many requests." };
  }

  const transactionId = String(input.transactionId ?? "").trim();
  if (!input.examId || !input.paymentMethod || !transactionId) {
    return { ok: false, message: "Payment method and transaction ID are required." };
  }

  const admin = createServiceRoleClient();
  const { data: exam } = await admin
    .from("mock_exams")
    .select("id, title, price_cents, currency, price_usd_cents, price_bdt_cents, price_myr_cents, is_published")
    .eq("id", input.examId)
    .eq("is_published", true)
    .single();

  if (!exam) {
    return { ok: false, message: "Exam not found." };
  }

  // Validate the submitted currency + amount against the exam's actual price
  const validCurrency = input.currency || "USD";
  const examPriceMap: Record<string, number> = {
    USD: exam.price_usd_cents ?? 0,
    BDT: exam.price_bdt_cents ?? 0,
    MYR: exam.price_myr_cents ?? 0,
  };
  const expectedAmount = examPriceMap[validCurrency] ?? 0;

  if (expectedAmount <= 0) {
    return { ok: false, message: "This exam does not require payment in that currency." };
  }

  const { data: entitlement } = await admin
    .from("exam_entitlements")
    .select("exam_id")
    .eq("user_id", user.id)
    .eq("exam_id", input.examId)
    .maybeSingle();

  if (entitlement) {
    return { ok: false, message: "You already have access to this exam." };
  }

  const { data: latestRequest, error: latestError } = await admin
    .from("payment_requests")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("exam_id", input.examId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    if (isMissingPaymentTable(latestError.message)) {
      return { ok: false, message: "Payment requests are not set up in Supabase. Apply the latest payment migration first." };
    }
    return { ok: false, message: latestError.message };
  }

  if (latestRequest?.status === "pending") {
    return { ok: false, message: "A payment verification request is already pending for this exam." };
  }

  const { error: insertError } = await admin.from("payment_requests").insert({
    user_id: user.id,
    exam_id: input.examId,
    payment_method: input.paymentMethod,
    transaction_id: transactionId,
    proof_url: input.proofUrl?.trim() || null,
    amount_cents: expectedAmount,
    currency: validCurrency,
    status: "pending",
  });

  if (insertError) {
    if (isMissingPaymentTable(insertError.message)) {
      return { ok: false, message: "Payment requests are not set up in Supabase. Apply the latest payment migration first." };
    }
    return { ok: false, message: insertError.message };
  }

  revalidatePath("/mock-exam");
  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  return { ok: true, message: `Payment request sent for ${exam.title}. We will verify it shortly.` };
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
  try {
    await enforceActionRateLimit({
      action: "mock-exam:start-attempt",
      subject: `user:${user.id}`,
      limit: 20,
      windowMs: 10 * 60_000,
    });
  } catch (rateError) {
    return { ok: false, message: rateError instanceof Error ? rateError.message : "Too many requests." };
  }

  const admin = createServiceRoleClient();

  // Check exam exists
  const { data: exam } = await admin
    .from("mock_exams")
    .select("id, price_cents")
    .eq("id", examId)
    .eq("is_published", true)
    .single();

  if (!exam) {
    return { ok: false, message: "Exam not found" };
  }

  if ((exam.price_cents ?? 0) > 0) {
    const { data: entitlement } = await admin
      .from("exam_entitlements")
      .select("exam_id")
      .eq("user_id", user.id)
      .eq("exam_id", examId)
      .maybeSingle();

    if (!entitlement) {
      return { ok: false, message: "Purchase approval is required before starting this exam." };
    }
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
  try {
    await enforceActionRateLimit({
      action: "mock-exam:submit-attempt",
      subject: `user:${user.id}`,
      limit: 10,
      windowMs: 15 * 60_000,
    });
  } catch (rateError) {
    return { ok: false, message: rateError instanceof Error ? rateError.message : "Too many requests." };
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
  const attemptUpdatePayload = {
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
  };
  let { error: updateErr } = await admin
    .from("mock_attempts")
    .update(attemptUpdatePayload)
    .eq("id", attemptId);

  if (updateErr && isMissingAiReviewColumn(updateErr.message)) {
    const { ai_review_json: _ignored, ...fallbackPayload } = attemptUpdatePayload;
    const retry = await admin
      .from("mock_attempts")
      .update(fallbackPayload)
      .eq("id", attemptId);
    updateErr = retry.error;
  }

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
