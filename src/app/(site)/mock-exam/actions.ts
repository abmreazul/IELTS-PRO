"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { evaluateWritingWithGemini } from "@/lib/ai/gemini-writing";
import { evaluateSpeakingWithGemini, type SpeakingRecordingSubmission } from "@/lib/ai/gemini-speaking";
import { roundBandToNearestHalf } from "@/lib/ai/writing-review";
import { coerceTestVariant, normalizeExamModules } from "@/lib/exam/ielts-defaults";
import {
  isManualPaymentMethodId,
  MANUAL_PAYMENT_METHOD_CURRENCIES,
  type ManualPaymentMethodId,
} from "@/lib/payments/manual-payment";
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
    .filter((module) => ["listening", "reading", "writing", "speaking"].includes(module))
    .map((module) => moduleBands[module])
    .filter((value): value is number => value != null);

  if (relevant.length === 0) return null;
  if (relevant.length !== activeModules.filter((module) => ["listening", "reading", "writing", "speaking"].includes(module)).length) {
    return null;
  }

  return roundBandToNearestHalf(
    relevant.reduce((sum, value) => sum + value, 0) / relevant.length,
  );
}

function getMissingMockAttemptColumn(message: string | undefined) {
  if (!message || !(message.includes("schema cache") || message.includes("Could not find the"))) {
    return null;
  }
  const match = message.match(/'([^']+)' column of 'mock_attempts'/);
  return match?.[1] ?? null;
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
const ATTEMPT_MEDIA_BUCKET = "attempt-media";

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
  if (!input.examId || !isManualPaymentMethodId(input.paymentMethod) || !transactionId) {
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
  const validCurrency = String(input.currency || "USD").trim().toUpperCase();
  if (!MANUAL_PAYMENT_METHOD_CURRENCIES[input.paymentMethod].includes(validCurrency)) {
    return { ok: false, message: `${input.paymentMethod === "paypal" ? "PayPal" : "This payment method"} does not support ${validCurrency}.` };
  }
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

export async function getSignedAttemptUploadUrl(
  attemptId: string,
  questionId: string,
  fileName: string,
  contentType: string,
): Promise<{ ok: true; signedUrl: string; token: string; path: string; bucket: string } | { ok: false; message: string }> {
  const { user, error } = await getAuthUser();
  if (error || !user) return { ok: false, message: "Sign in required" };

  try {
    await enforceActionRateLimit({
      action: "mock-exam:speaking-upload-url",
      subject: `user:${user.id}`,
      limit: 80,
      windowMs: 15 * 60_000,
    });
  } catch (rateError) {
    return { ok: false, message: rateError instanceof Error ? rateError.message : "Too many requests." };
  }

  const cleanAttemptId = String(attemptId ?? "").trim();
  const cleanQuestionId = String(questionId ?? "").trim();
  if (!cleanAttemptId || !cleanQuestionId) {
    return { ok: false, message: "Missing speaking recording target." };
  }

  const admin = createServiceRoleClient();
  const { data: attempt } = await admin
    .from("mock_attempts")
    .select("id, user_id, status")
    .eq("id", cleanAttemptId)
    .single();

  if (!attempt || attempt.user_id !== user.id || attempt.status !== "in_progress") {
    return { ok: false, message: "Attempt not found." };
  }

  const mime = String(contentType || "audio/webm").split(";")[0].trim().toLowerCase();
  const allowed = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg"]);
  if (!allowed.has(mime)) {
    return { ok: false, message: "This browser recording format is not supported." };
  }

  let ext = (fileName.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ext) {
    ext = mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : mime.includes("mp4") ? "mp4" : "webm";
  }
  const path = `${user.id}/${cleanAttemptId}/${cleanQuestionId}-${crypto.randomUUID()}.${ext}`.slice(0, 420);
  const { data, error: uploadError } = await admin.storage
    .from(ATTEMPT_MEDIA_BUCKET)
    .createSignedUploadUrl(path);

  if (uploadError || !data) {
    return { ok: false, message: uploadError?.message ?? "Could not prepare speaking upload." };
  }

  return { ok: true, signedUrl: data.signedUrl, token: data.token, path, bucket: ATTEMPT_MEDIA_BUCKET };
}

/* ═══════════════════════════════════════════════════════════════════
   Submit Attempt — score answers and save results
   ═══════════════════════════════════════════════════════════════════ */

type AnswerMap = Record<string, unknown>;
type SpeakingAnswerRef = {
  kind: "audio_recording";
  bucket: string;
  path: string;
  mimeType: string;
  durationSeconds: number;
};
type WritingAiReviewResult = {
  overall_band: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  tasks: {
    part: number;
    estimated_band: number;
    word_count: number;
    criterion_scores: { task_response: number; coherence: number; lexical: number; grammar: number };
    feedback: { task_response: string; coherence: string; lexical: string; grammar: string };
  }[];
};

type WritingTaskPayload = {
  part: number;
  prompt: string;
  min_words: number | null;
  image_url: string | null;
  answer: string;
  test_variant: "academic" | "general";
};

type SubmitResult = {
  overallBand: number | null;
  moduleBands: Record<string, number | null>;
  reviewPendingModules: string[];
  aiWritingReview: WritingAiReviewResult | null;
  speakingReview: import("@/lib/ai/speaking-review").SpeakingReview | null;
};

function decodeQuestionPart(sortOrder: number, fallback = 1) {
  if (sortOrder >= 100) return Math.max(1, Math.floor(sortOrder / 100));
  return fallback;
}

function getWritingAnswerFromMap(answers: AnswerMap, questionId: string) {
  const raw = answers[questionId];
  return typeof raw === "string" ? raw : "";
}

function getSpeakingAnswerRef(raw: unknown): SpeakingAnswerRef | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.kind !== "audio_recording") return null;
  const bucket = String(value.bucket ?? "").trim();
  const path = String(value.path ?? "").trim();
  const mimeType = String(value.mimeType ?? "audio/webm").trim();
  const durationSeconds = Math.max(0, Number(value.durationSeconds) || 0);
  if (!bucket || !path) return null;
  return { kind: "audio_recording", bucket, path, mimeType, durationSeconds };
}

async function buildSpeakingRecordingsForReview(input: {
  admin: ReturnType<typeof createServiceRoleClient>;
  answers: AnswerMap;
  speakingQuestions: {
    id: string;
    prompt: string | null;
    sort_order: number;
  }[];
}): Promise<{ ok: true; recordings: SpeakingRecordingSubmission[] } | { ok: false; message: string }> {
  const recordings: SpeakingRecordingSubmission[] = [];
  for (const question of input.speakingQuestions) {
    const ref = getSpeakingAnswerRef(input.answers[question.id]);
    if (!ref) continue;
    const { data, error } = await input.admin.storage.from(ref.bucket).download(ref.path);
    if (error || !data) {
      return { ok: false, message: "Could not load one of the speaking recordings. Please try again." };
    }
    const arrayBuffer = await data.arrayBuffer();
    const audio_base64 = Buffer.from(arrayBuffer).toString("base64");
    recordings.push({
      question_id: question.id,
      part: decodeQuestionPart(question.sort_order, 1),
      prompt: String(question.prompt ?? "").trim(),
      mime_type: ref.mimeType,
      audio_base64,
      duration_seconds: ref.durationSeconds || null,
    });
  }
  return { ok: true, recordings };
}

function buildWritingTasksForAi(input: {
  answers: AnswerMap;
  structure: {
    exam_meta?: { test_variant?: "academic" | "general" };
    writing_tasks?: { part: number; prompt?: string; min_words?: number; image_url?: string }[];
  } | null;
  writingQuestions: {
    id: string;
    prompt: string | null;
    sort_order: number;
  }[];
}): WritingTaskPayload[] {
  const testVariant = coerceTestVariant(input.structure?.exam_meta?.test_variant);
  const sortedQuestions = [...input.writingQuestions].sort((a, b) => a.sort_order - b.sort_order);
  const structuredTasks = Array.isArray(input.structure?.writing_tasks)
    ? input.structure.writing_tasks
    : [];

  if (structuredTasks.length > 0) {
    return structuredTasks
      .map((task, index) => {
        const part = Math.max(1, Math.min(2, Math.floor(Number(task.part)) || index + 1));
        const matchedQuestion =
          sortedQuestions.find((question) => decodeQuestionPart(question.sort_order) === part) ??
          sortedQuestions[index];
        if (!matchedQuestion) return null;

        return {
          part,
          prompt: String(task.prompt ?? matchedQuestion.prompt ?? "").trim(),
          min_words: Number(task.min_words) || null,
          image_url: String(task.image_url ?? "").trim() || null,
          answer: getWritingAnswerFromMap(input.answers, matchedQuestion.id),
          test_variant: testVariant,
        };
      })
      .filter((task): task is WritingTaskPayload => Boolean(task));
  }

  return sortedQuestions.map((question, index) => {
    const part = Math.max(1, Math.min(2, decodeQuestionPart(question.sort_order, index + 1)));
    return {
      part,
      prompt: String(question.prompt ?? "").trim(),
      min_words: part === 1 ? 150 : 250,
      image_url: null,
      answer: getWritingAnswerFromMap(input.answers, question.id),
      test_variant: testVariant,
    };
  });
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
  const scorableQuestions = questions.filter((question) =>
    activeModuleSet.has((question.module || "reading") as "listening" | "reading" | "writing" | "speaking"),
  );

  // Score each question
  const moduleScores: Record<string, { correct: number; total: number }> = {};
  const allModules = new Set<string>();
  const reviewPendingModules = new Set<string>();
  const subjectiveQuestionTypes = new Set(["essay", "speaking_prompt"]);
  let aiReviewJson: Record<string, unknown> | null = null;
  let speakingReviewJson: Record<string, unknown> | null = null;

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
    const writingQuestions = scorableQuestions
      .filter((question) => question.module === "writing")
      .sort((a, b) => a.sort_order - b.sort_order);
    const writingTasks = buildWritingTasksForAi({
      answers,
      structure,
      writingQuestions,
    });

    if (writingTasks.length > 0) {
      const writingAiResult = await evaluateWritingWithGemini(writingTasks);
      if (writingAiResult.ok) {
        reviewPendingModules.delete("writing");
        moduleBands.writing = writingAiResult.review.overall_band;
        aiReviewJson = writingAiResult.review as unknown as Record<string, unknown>;
      } else {
        return {
          ok: false,
          message: "Writing assessment could not complete. Please try again in a moment.",
        };
      }
    } else {
      return {
        ok: false,
        message: "This writing exam is missing response slots. Ask an admin to resave the writing tasks.",
      };
    }
  }

  if (activeModuleSet.has("speaking")) {
    const speakingQuestions = scorableQuestions
      .filter((question) => question.module === "speaking")
      .sort((a, b) => a.sort_order - b.sort_order);
    const built = await buildSpeakingRecordingsForReview({
      admin,
      answers,
      speakingQuestions,
    });
    if (!built.ok) {
      return { ok: false, message: built.message };
    }
    if (built.recordings.length === 0) {
      return { ok: false, message: "Record at least one speaking answer before submitting." };
    }
    const speakingResult = await evaluateSpeakingWithGemini(built.recordings);
    if (!speakingResult.ok) {
      return { ok: false, message: "Speaking assessment could not complete. Please try again in a moment." };
    }
    reviewPendingModules.delete("speaking");
    moduleBands.speaking = speakingResult.review.overall_band;
    speakingReviewJson = speakingResult.review as unknown as Record<string, unknown>;
  }

  const overallBand = reviewPendingModules.size > 0
    ? null
    : computeOverallBand(moduleBands, activeModules) ?? rawToBand(totalCorrect, totalQuestions);
  const reviewStatus = reviewPendingModules.size > 0
    ? "pending"
    : aiReviewJson || speakingReviewJson
      ? "reviewed"
      : "not_required";

  // Update attempt
  const attemptUpdatePayload = {
    answers_json: answers,
    ai_review_json: aiReviewJson,
    speaking_review_json: speakingReviewJson,
    review_status: reviewStatus,
    status: "completed",
    overall_band: overallBand,
    listening_band: moduleBands.listening ?? null,
    reading_band: moduleBands.reading ?? null,
    writing_band: moduleBands.writing ?? null,
    speaking_band: moduleBands.speaking ?? null,
    completed_at: new Date().toISOString(),
  };
  const optionalAttemptColumns = new Set(["ai_review_json", "speaking_review_json"]);
  const updatePayload: Record<string, unknown> = { ...attemptUpdatePayload };
  let { error: updateErr } = await admin
    .from("mock_attempts")
    .update(updatePayload)
    .eq("id", attemptId);

  for (let attempt = 0; updateErr && attempt < optionalAttemptColumns.size; attempt += 1) {
    const missingColumn = getMissingMockAttemptColumn(updateErr.message);
    if (!missingColumn || !optionalAttemptColumns.has(missingColumn)) break;
    delete updatePayload[missingColumn];
    const retry = await admin
      .from("mock_attempts")
      .update(updatePayload)
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
      aiWritingReview: aiReviewJson
        ? {
            overall_band: Number((aiReviewJson as Record<string, unknown>).overall_band) || 0,
            summary: String((aiReviewJson as Record<string, unknown>).summary ?? ""),
            strengths: Array.isArray((aiReviewJson as Record<string, unknown>).strengths)
              ? ((aiReviewJson as Record<string, unknown>).strengths as string[])
              : [],
            improvements: Array.isArray((aiReviewJson as Record<string, unknown>).improvements)
              ? ((aiReviewJson as Record<string, unknown>).improvements as string[])
              : [],
            tasks: Array.isArray((aiReviewJson as Record<string, unknown>).tasks)
              ? ((aiReviewJson as Record<string, unknown>).tasks as WritingAiReviewResult["tasks"])
              : [],
          }
        : null,
      speakingReview: speakingReviewJson
        ? speakingReviewJson as unknown as import("@/lib/ai/speaking-review").SpeakingReview
        : null,
    },
  };
}
