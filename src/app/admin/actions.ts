"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import {
  coerceTestVariant,
  getReadingSectionLabel,
  SUPPORTED_QUESTION_TYPE_VALUES,
  type TestVariant,
} from "@/lib/exam/ielts-defaults";
import { createServiceRoleClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const { user, error } = await getAuthUser();
  if (error || !user?.email) {
    throw new Error("Unauthorized");
  }
  if (!isAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }
  return user;
}

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  const sort_order = Number.parseInt(String(formData.get("sort_order") ?? "0"), 10) || 0;
  if (!name || !slug) {
    throw new Error("Name and slug are required");
  }
  const admin = createServiceRoleClient();
  const { error } = await admin.from("exam_categories").insert({ name, slug, sort_order });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/categories");
  revalidatePath("/admin/exams");
  revalidatePath("/mock-exam");
}

export async function updateCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  const sort_order = Number.parseInt(String(formData.get("sort_order") ?? "0"), 10) || 0;
  if (!id || !name || !slug) {
    throw new Error("Invalid category");
  }
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("exam_categories")
    .update({ name, slug, sort_order })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/categories");
  revalidatePath("/mock-exam");
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const admin = createServiceRoleClient();
  const { error } = await admin.from("exam_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/categories");
  revalidatePath("/admin/exams");
  revalidatePath("/mock-exam");
}

export async function createExam(formData: FormData) {
  await requireAdmin();
  const payload = parseExamForm(formData);
  const admin = createServiceRoleClient();
  const { error } = await admin.from("mock_exams").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/exams");
  revalidatePath("/mock-exam");
}

export async function updateExam(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing exam id");
  const payload = parseExamForm(formData);
  const admin = createServiceRoleClient();
  const { error } = await admin.from("mock_exams").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/exams");
  revalidatePath("/mock-exam");
}

export async function deleteExam(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const admin = createServiceRoleClient();
  const { error } = await admin.from("mock_exams").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/exams");
  revalidatePath("/mock-exam");
}

const MODULE_SET = new Set(["listening", "reading", "writing", "speaking"]);

export type WizardQuestionInput = {
  module: string;
  part?: number; // 1-4 for listening
  question_type: string;
  prompt: string;
  options_json: unknown;
  correct_json: unknown;
  points: number;
};

export type ExamWizardSaveInput = {
  id?: string;
  category_id: string;
  title: string;
  slug: string;
  description: string | null;
  exam_type: "full" | "partial";
  modules: string[];
  duration_minutes: number;
  question_count: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  price_cents: number;
  currency: string;
  cover_image_url: string | null;
  is_published: boolean;
  structure_json: unknown;
  scoring_json: unknown;
  /** Listening section: one URL per part (MP3 etc.), stored on the exam row. */
  listening_audio_json?: unknown;
  questions: WizardQuestionInput[];
};

type SanitizedListeningClip = { part: number; url: string; title: string };
type ReadingPassage = { part: number; title: string; text: string; image_url: string };
type WritingTask = { part: number; prompt: string; image_url: string; min_words: number };

function parseExamMeta(structure_json: unknown): {
  testVariant: TestVariant;
  readingPassages: ReadingPassage[];
  writingTasks: WritingTask[];
} {
  let testVariant: TestVariant = "academic";
  let readingPassages: ReadingPassage[] = [];
  let writingTasks: WritingTask[] = [];

  if (!structure_json || typeof structure_json !== "object") {
    return { testVariant, readingPassages, writingTasks };
  }

  const structure = structure_json as Record<string, unknown>;
  if (structure.exam_meta && typeof structure.exam_meta === "object") {
    const meta = structure.exam_meta as Record<string, unknown>;
    testVariant = coerceTestVariant(meta.test_variant);
  }

  if (Array.isArray(structure.reading_passages)) {
    readingPassages = structure.reading_passages
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const passage = row as Record<string, unknown>;
        return {
          part: Math.max(1, Math.min(3, Math.floor(Number(passage.part)) || 1)),
          title: String(passage.title ?? "").trim(),
          text: String(passage.text ?? "").trim(),
          image_url: String(passage.image_url ?? "").trim(),
        };
      })
      .filter((row): row is ReadingPassage => Boolean(row));
  }

  if (Array.isArray(structure.writing_tasks)) {
    writingTasks = structure.writing_tasks
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const task = row as Record<string, unknown>;
        return {
          part: Math.max(1, Math.min(2, Math.floor(Number(task.part)) || 1)),
          prompt: String(task.prompt ?? "").trim(),
          image_url: String(task.image_url ?? "").trim(),
          min_words: Math.max(0, Math.floor(Number(task.min_words)) || 0),
        };
      })
      .filter((row): row is WritingTask => Boolean(row));
  }

  return { testVariant, readingPassages, writingTasks };
}

function getObjectiveAnswerError(question: WizardQuestionInput): string | null {
  const prompt = String(question.prompt ?? "").trim();
  if (!prompt) {
    return "Every published listening and reading question must include question text.";
  }

  if (question.question_type === "multiple_choice") {
    const options = Array.isArray(question.options_json)
      ? question.options_json.map((option) => String(option ?? "").trim()).filter(Boolean)
      : [];
    const correct = question.correct_json && typeof question.correct_json === "object"
      ? (question.correct_json as { kind?: string; index?: unknown })
      : null;
    const index = typeof correct?.index === "number" ? correct.index : Number(correct?.index);
    if (options.length < 2) {
      return "Multiple-choice listening and reading questions need at least 2 answer options.";
    }
    if (correct?.kind !== "index" || !Number.isInteger(index) || index < 0 || index >= options.length) {
      return "Multiple-choice listening and reading questions need one valid correct answer.";
    }
    return null;
  }

  if (question.question_type === "true_false_not_given" || question.question_type === "yes_no_not_given") {
    const allowed = question.question_type === "true_false_not_given"
      ? new Set(["true", "false", "not_given"])
      : new Set(["yes", "no", "not_given"]);
    const correct = question.correct_json && typeof question.correct_json === "object"
      ? (question.correct_json as { kind?: string; value?: unknown })
      : null;
    const value = String(correct?.value ?? "").trim();
    if (correct?.kind !== "triple" || !allowed.has(value)) {
      return `${question.question_type === "true_false_not_given" ? "True / False / Not Given" : "Yes / No / Not Given"} questions need one valid correct answer.`;
    }
    return null;
  }

  const textTypes = new Set([
    "completion",
    "short_answer",
    "fill_in_blank",
    "sentence_completion",
    "matching_headings",
    "matching_information",
    "matching_features",
    "sentence_endings",
    "map_diagram_labeling",
    "matching",
  ]);
  if (textTypes.has(question.question_type)) {
    const correct = question.correct_json && typeof question.correct_json === "object"
      ? (question.correct_json as { kind?: string; value?: unknown })
      : null;
    const value = String(correct?.value ?? "").trim();
    if (correct?.kind !== "rubric" || !value) {
      return "Completion and matching listening/reading questions need an expected answer or answer key before publishing.";
    }
  }

  return null;
}

function validateListeningForPublish(
  questions: WizardQuestionInput[],
  listeningAudio: SanitizedListeningClip[],
): string | null {
  const listeningQuestions = questions.filter((question) => question.module === "listening");
  if (listeningQuestions.length !== 40) {
    return "Published Listening exams must contain exactly 40 questions across 4 parts.";
  }

  const counts = new Map<number, number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
  ]);

  for (const question of listeningQuestions) {
    const part = Number(question.part);
    if (!Number.isInteger(part) || part < 1 || part > 4) {
      return "Every published Listening question must be assigned to Part 1, 2, 3, or 4.";
    }
    counts.set(part, (counts.get(part) ?? 0) + 1);
    const answerError = getObjectiveAnswerError(question);
    if (answerError) return answerError;
  }

  for (const part of [1, 2, 3, 4]) {
    if ((counts.get(part) ?? 0) !== 10) {
      return `Listening Part ${part} must contain exactly 10 questions before publishing.`;
    }
  }

  const audioParts = new Set<number>();
  for (const clip of listeningAudio) {
    if (clip.part < 1 || clip.part > 4) {
      return "Listening audio can only be attached to Parts 1 through 4.";
    }
    audioParts.add(clip.part);
  }
  for (const part of [1, 2, 3, 4]) {
    if (!audioParts.has(part)) {
      return `Listening Part ${part} is missing its audio recording.`;
    }
  }

  return null;
}

function validateReadingForPublish(
  questions: WizardQuestionInput[],
  readingPassages: ReadingPassage[],
  testVariant: TestVariant,
): string | null {
  const label = getReadingSectionLabel(testVariant);
  const variantLabel = testVariant === "academic" ? "Academic" : "General Training";
  const readingQuestions = questions.filter((question) => question.module === "reading");

  if (readingQuestions.length !== 40) {
    return `Published ${variantLabel} Reading exams must contain exactly 40 questions across 3 ${label.toLowerCase()}s.`;
  }

  const passagesByPart = new Map<number, ReadingPassage>();
  for (const passage of readingPassages) {
    passagesByPart.set(passage.part, passage);
  }
  for (const part of [1, 2, 3]) {
    const passage = passagesByPart.get(part);
    if (!passage?.text) {
      return `${label} ${part} needs full source text before publishing.`;
    }
  }

  const counts = new Map<number, number>([
    [1, 0],
    [2, 0],
    [3, 0],
  ]);
  for (const question of readingQuestions) {
    const part = Number(question.part);
    if (!Number.isInteger(part) || part < 1 || part > 3) {
      return `Every published Reading question must be assigned to ${label} 1, 2, or 3.`;
    }
    counts.set(part, (counts.get(part) ?? 0) + 1);
    const answerError = getObjectiveAnswerError(question);
    if (answerError) return answerError;
  }
  for (const part of [1, 2, 3]) {
    if ((counts.get(part) ?? 0) === 0) {
      return `${label} ${part} must contain at least one question before publishing.`;
    }
  }

  return null;
}

function validateWritingForPublish(
  questions: WizardQuestionInput[],
  writingTasks: WritingTask[],
  testVariant: TestVariant,
): string | null {
  const variantLabel = testVariant === "general" ? "General Training" : "Academic";
  const writingQuestions = questions.filter((question) => question.module === "writing");
  if (writingQuestions.length !== 2) {
    return `Published ${variantLabel} Writing exams must contain exactly 2 response slots, one for each task.`;
  }

  const tasksByPart = new Map<number, WritingTask>();
  for (const task of writingTasks) {
    tasksByPart.set(task.part, task);
  }

  const minimumWordsByPart = new Map<number, number>([
    [1, 150],
    [2, 250],
  ]);

  for (const part of [1, 2]) {
    const task = tasksByPart.get(part);
    if (!task?.prompt) {
      return `Writing Task ${part} needs a prompt before publishing.`;
    }
    if (task.min_words < (minimumWordsByPart.get(part) ?? 0)) {
      return `Writing Task ${part} must require at least ${(minimumWordsByPart.get(part) ?? 0)} words.`;
    }
  }

  const counts = new Map<number, number>([
    [1, 0],
    [2, 0],
  ]);
  for (const question of writingQuestions) {
    const part = Number(question.part);
    if (!Number.isInteger(part) || part < 1 || part > 2) {
      return "Every published Writing response slot must belong to Task 1 or Task 2.";
    }
    if (question.question_type !== "essay") {
      return "Writing tasks only support essay responses.";
    }
    counts.set(part, (counts.get(part) ?? 0) + 1);
  }

  for (const part of [1, 2]) {
    if ((counts.get(part) ?? 0) !== 1) {
      return `Writing Task ${part} must have exactly one response slot.`;
    }
  }

  return null;
}

function validatePublishRules(
  input: ExamWizardSaveInput,
  listeningAudio: SanitizedListeningClip[],
): string | null {
  const questions = input.questions ?? [];
  for (const question of questions) {
    const questionType = String(question.question_type ?? "").trim();
    if (!SUPPORTED_QUESTION_TYPE_VALUES.has(questionType)) {
      return `Question type "${questionType || "unknown"}" is not supported. Replace it before publishing.`;
    }
  }

  const { testVariant, readingPassages, writingTasks } = parseExamMeta(input.structure_json);

  if (input.modules.includes("listening")) {
    const listeningError = validateListeningForPublish(questions, listeningAudio);
    if (listeningError) return listeningError;
  }

  if (input.modules.includes("reading")) {
    const readingError = validateReadingForPublish(questions, readingPassages, testVariant);
    if (readingError) return readingError;
  }

  if (input.modules.includes("writing")) {
    const writingError = validateWritingForPublish(questions, writingTasks, testVariant);
    if (writingError) return writingError;
  }

  return null;
}

export async function saveExamWizard(
  input: ExamWizardSaveInput,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  const title = String(input.title ?? "").trim();
  let slug = String(input.slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  const category_id = String(input.category_id ?? "").trim();
  if (!category_id || !title) {
    return { ok: false, message: "Category and title are required" };
  }
  if (!slug) {
    slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
  if (!slug) {
    return { ok: false, message: "Could not derive slug" };
  }

  const exam_type = input.exam_type === "full" ? "full" : "partial";
  let modules = (input.modules ?? []).filter((m) => MODULE_SET.has(m));
  if (exam_type === "full") {
    modules = ["listening", "reading", "writing", "speaking"];
  }
  if (exam_type === "partial" && modules.length === 0) {
    return { ok: false, message: "Select at least one module for a partial exam" };
  }

  const duration_minutes =
    Number.parseInt(String(input.duration_minutes ?? 30), 10) || 30;
  const question_count =
    Number.parseInt(String(input.question_count ?? 0), 10) ||
    Math.max(0, input.questions?.length ?? 0);
  const difficulty =
    input.difficulty === "beginner" ||
    input.difficulty === "intermediate" ||
    input.difficulty === "advanced"
      ? input.difficulty
      : "intermediate";
  const price_cents = Math.max(0, Math.round(Number(input.price_cents) || 0));
  const currency = String(input.currency ?? "USD").trim() || "USD";
  const description =
    typeof input.description === "string" && input.description.trim()
      ? input.description.trim()
      : null;
  const cover_image_url =
    typeof input.cover_image_url === "string" && input.cover_image_url.trim()
      ? input.cover_image_url.trim()
      : null;

  const structure_json = input.structure_json ?? [];
  const scoring_json = input.scoring_json ?? {};
  const listening_audio_json = sanitizeListeningAudioJson(input.listening_audio_json);
  const publishError = input.is_published ? validatePublishRules({ ...input, modules }, listening_audio_json) : null;
  if (publishError) {
    return { ok: false, message: publishError };
  }

  const examPayload = {
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
    is_published: Boolean(input.is_published),
    structure_json,
    scoring_json,
    listening_audio_json,
  };

  const admin = createServiceRoleClient();
  let examId = input.id?.trim();

  if (examId) {
    const { data: existing } = await admin.from("mock_exams").select("id").eq("id", examId).maybeSingle();
    if (!existing) {
      return { ok: false, message: "Exam not found" };
    }
    const { error: upErr } = await admin.from("mock_exams").update(examPayload).eq("id", examId);
    if (upErr) {
      if (upErr.code === "23505") {
        return { ok: false, message: "Slug already in use. Change the slug." };
      }
      return { ok: false, message: upErr.message };
    }
  } else {
    const { data: inserted, error: insErr } = await admin
      .from("mock_exams")
      .insert(examPayload)
      .select("id")
      .single();
    if (insErr) {
      if (insErr.code === "23505") {
        return { ok: false, message: "Slug already in use. Change the slug." };
      }
      return { ok: false, message: insErr.message };
    }
    examId = inserted?.id;
  }

  if (!examId) {
    return { ok: false, message: "Could not save exam" };
  }

  await admin.from("exam_questions").delete().eq("exam_id", examId);

  const qs = input.questions ?? [];
  if (qs.length > 0) {
    // Encode part into sort_order: Part N → sort_order N*100+i
    // Works for listening (4 parts) and reading (3 parts)
    // Other modules: sort_order = i
    const partCounters: Record<string, Record<number, number>> = {};
    let flatIdx = 0;
    const rows = qs.map((q) => {
      let sort_order: number;
      const hasPart = (q.module === "listening" || q.module === "reading" || q.module === "writing") && q.part && q.part >= 1;
      if (hasPart) {
        const key = q.module;
        const p = q.part!;
        if (!partCounters[key]) partCounters[key] = {};
        partCounters[key][p] = partCounters[key][p] ?? 0;
        sort_order = p * 100 + partCounters[key][p];
        partCounters[key][p]++;
      } else {
        sort_order = flatIdx++;
      }
      return {
        exam_id: examId,
        sort_order,
        module: MODULE_SET.has(q.module) ? q.module : "reading",
        question_type: String(q.question_type === "multiple_choice_multi" ? "multiple_choice" : q.question_type || "multiple_choice").slice(0, 120),
        prompt: String(q.prompt ?? "").slice(0, 20000),
        options_json: q.options_json ?? [],
        correct_json: q.correct_json ?? null,
        points: Math.max(0, Math.round(Number(q.points) || 0)) || 1,
      };
    });
    const { error: qErr } = await admin.from("exam_questions").insert(rows);
    if (qErr) {
      return { ok: false, message: qErr.message };
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/exams");
  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/mock-exam");
  return { ok: true, id: examId };
}

export async function duplicateExam(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing exam id");

  const admin = createServiceRoleClient();
  const { data: exam, error: exErr } = await admin.from("mock_exams").select("*").eq("id", id).maybeSingle();
  if (exErr || !exam) throw new Error("Exam not found");

  const { data: questions } = await admin
    .from("exam_questions")
    .select("module, question_type, prompt, options_json, correct_json, points, sort_order")
    .eq("exam_id", id)
    .order("sort_order", { ascending: true });

  const suffix = `-${Date.now().toString(36)}`;
  const newSlug = String(exam.slug).replace(/-+$/, "") + suffix;
  const {
    id: _rid,
    created_at: _c,
    updated_at: _u,
    ...rest
  } = exam as Record<string, unknown> & { id: string; created_at?: string; updated_at?: string };

  const insertRow = {
    ...rest,
    slug: newSlug.slice(0, 200),
    title: `${String(exam.title)} (copy)`,
    is_published: false,
  };

  const { data: created, error: insErr } = await admin
    .from("mock_exams")
    .insert(insertRow)
    .select("id")
    .single();
  if (insErr || !created?.id) throw new Error(insErr?.message ?? "Duplicate failed");

  const newId = created.id as string;
  if (questions?.length) {
    const qrows = questions.map((q, i) => ({
      exam_id: newId,
      sort_order: i,
      module: q.module,
      question_type: q.question_type,
      prompt: q.prompt,
      options_json: q.options_json,
      correct_json: q.correct_json,
      points: q.points,
    }));
    await admin.from("exam_questions").insert(qrows);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/exams");
  revalidatePath("/mock-exam");
  redirect(`/admin/exams/${newId}`);
}

const EXAM_MEDIA_BUCKET = "exam-media";

/**
 * Returns a signed upload URL so the client can upload directly to Supabase
 * Storage — bypasses Vercel's 4.5 MB serverless body limit entirely.
 */
export async function getSignedUploadUrl(
  folder: "covers" | "listening",
  fileName: string,
  contentType: string,
): Promise<{ ok: true; signedUrl: string; path: string; publicUrl: string } | { ok: false; message: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  let ext = (fileName.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ext) ext = folder === "covers" ? "jpg" : "mp3";
  const objectName = `${crypto.randomUUID()}.${ext}`.slice(0, 200);
  const path = `${folder}/${objectName}`;

  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage
    .from(EXAM_MEDIA_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    if (error?.message?.includes("Bucket not found") || error?.message?.includes("not found")) {
      return { ok: false, message: "Storage bucket 'exam-media' missing. Create it in Supabase dashboard." };
    }
    return { ok: false, message: error?.message ?? "Failed to create upload URL" };
  }

  const { data: publicData } = admin.storage.from(EXAM_MEDIA_BUCKET).getPublicUrl(path);

  return {
    ok: true,
    signedUrl: data.signedUrl,
    path,
    publicUrl: publicData.publicUrl,
  };
}

/**
 * @deprecated — kept for backward compat. New uploads use getSignedUploadUrl + direct PUT.
 */
export async function uploadExamMedia(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  const file = formData.get("file");
  const folderRaw = String(formData.get("folder") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "No file selected" };
  }

  const folder = folderRaw === "listening" ? "listening" : "covers";
  const mime = (file.type || "").toLowerCase();
  const isImage = mime.startsWith("image/");
  const isAudio = mime.startsWith("audio/");
  if (folder === "covers" && !isImage) {
    return { ok: false, message: "Cover must be an image (JPEG, PNG, WebP, or GIF)." };
  }
  if (folder === "listening" && !isAudio) {
    return { ok: false, message: "Listening files must be audio (MP3, WAV, WebM, OGG, etc.)." };
  }

  const MAX_COVER_BYTES = 8 * 1024 * 1024;
  const MAX_AUDIO_BYTES = 45 * 1024 * 1024;
  const maxBytes = folder === "covers" ? MAX_COVER_BYTES : MAX_AUDIO_BYTES;
  if (file.size > maxBytes) {
    return {
      ok: false,
      message: `File too large. Max ${Math.round(maxBytes / 1024 / 1024)} MB.`,
    };
  }

  let ext = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ext) ext = folder === "covers" ? "jpg" : "mp3";
  const objectName = `${crypto.randomUUID()}.${ext}`.slice(0, 200);
  const path = `${folder}/${objectName}`;

  const admin = createServiceRoleClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(EXAM_MEDIA_BUCKET).upload(path, buffer, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const { data } = admin.storage.from(EXAM_MEDIA_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

function sanitizeListeningAudioJson(raw: unknown): { part: number; url: string; title: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { part: number; url: string; title: string }[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const part = Math.max(1, Math.min(20, Math.floor(Number(o.part)) || 1));
    const url = String(o.url ?? "").trim().slice(0, 2000);
    if (!url) continue;
    const title = String(o.title ?? "").trim().slice(0, 200) || `Part ${part}`;
    out.push({ part, url, title });
  }
  out.sort((a, b) => a.part - b.part);
  return out;
}

function parseExamForm(formData: FormData) {
  const category_id = String(formData.get("category_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  const description = String(formData.get("description") ?? "").trim() || null;
  const exam_type = String(formData.get("exam_type") ?? "partial") as "full" | "partial";
  const modules = formData.getAll("modules").map(String) as string[];
  const duration_minutes = Number.parseInt(String(formData.get("duration_minutes") ?? "30"), 10) || 30;
  const question_count = Number.parseInt(String(formData.get("question_count") ?? "40"), 10) || 40;
  const difficulty = String(formData.get("difficulty") ?? "intermediate") as
    | "beginner"
    | "intermediate"
    | "advanced";
  const price_cents = Math.round(Number.parseFloat(String(formData.get("price") ?? "9.99")) * 100) || 999;
  const currency = String(formData.get("currency") ?? "USD").trim() || "USD";
  const cover_image_url = String(formData.get("cover_image_url") ?? "").trim() || null;
  const is_published = formData.has("is_published");

  if (!category_id || !title || !slug) {
    throw new Error("Category, title, and slug are required");
  }

  let mod = exam_type === "full" ? ["listening", "reading", "writing", "speaking"] : modules;
  if (exam_type === "partial" && mod.length === 0) {
    throw new Error("Select at least one module for partial exams");
  }

  return {
    category_id,
    title,
    slug,
    description,
    exam_type,
    modules: mod,
    duration_minutes,
    question_count,
    difficulty,
    price_cents,
    currency,
    cover_image_url,
    is_published,
  };
}
