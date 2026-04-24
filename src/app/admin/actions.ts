"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import {
  coerceTestVariant,
  getReadingSectionLabel,
  normalizeExamModules,
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

type CourseLessonInput = {
  title: string;
  summary: string;
  provider: "youtube" | "upload";
  video_url: string;
  duration_label: string;
};

type CourseSaveInput = {
  id?: string;
  title: string;
  slug: string;
  description: string | null;
  instructor: string | null;
  level: "all-levels" | "beginner" | "intermediate" | "advanced";
  cover_image_url: string | null;
  is_published: boolean;
  lessons_json: CourseLessonInput[];
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCourseLessons(raw: string): CourseLessonInput[] {
  if (!raw.trim()) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((lesson) => {
      const row = lesson && typeof lesson === "object" ? lesson as Record<string, unknown> : {};
      const provider: CourseLessonInput["provider"] = row.provider === "youtube" ? "youtube" : "upload";
      return {
        title: String(row.title ?? "").trim().slice(0, 180),
        summary: String(row.summary ?? "").trim().slice(0, 600),
        provider,
        video_url: String(row.video_url ?? "").trim().slice(0, 2000),
        duration_label: String(row.duration_label ?? "").trim().slice(0, 40),
      };
    })
    .filter((lesson) => lesson.title && lesson.video_url);
}

function parseCourseForm(formData: FormData): CourseSaveInput {
  const title = String(formData.get("title") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const lessonsRaw = String(formData.get("lessons_json") ?? "[]");
  const levelRaw = String(formData.get("level") ?? "all-levels").trim();
  const level = ["all-levels", "beginner", "intermediate", "advanced"].includes(levelRaw)
    ? levelRaw as CourseSaveInput["level"]
    : "all-levels";

  return {
    id: String(formData.get("id") ?? "").trim() || undefined,
    title,
    slug: slugify(slugInput || title),
    description: String(formData.get("description") ?? "").trim() || null,
    instructor: String(formData.get("instructor") ?? "").trim() || null,
    level,
    cover_image_url: String(formData.get("cover_image_url") ?? "").trim() || null,
    is_published: String(formData.get("is_published") ?? "") === "true",
    lessons_json: parseCourseLessons(lessonsRaw),
  };
}

export async function saveCourse(formData: FormData) {
  await requireAdmin();
  const input = parseCourseForm(formData);

  if (!input.title || !input.slug) {
    return { ok: false, message: "Title and slug are required." };
  }
  if (input.lessons_json.length === 0) {
    return { ok: false, message: "Add at least one lesson before saving the course." };
  }

  const admin = createServiceRoleClient();
  const payload = {
    title: input.title,
    slug: input.slug,
    description: input.description,
    instructor: input.instructor,
    level: input.level,
    cover_image_url: input.cover_image_url,
    is_published: input.is_published,
    lessons_json: input.lessons_json,
  };

  let courseId = input.id;
  if (input.id) {
    const { error } = await admin.from("courses").update(payload).eq("id", input.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { data, error } = await admin.from("courses").insert(payload).select("id").single();
    if (error || !data?.id) return { ok: false, message: error?.message ?? "Could not create course." };
    courseId = data.id;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath("/courses");
  revalidatePath(`/courses/${input.slug}`);
  if (courseId) revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true, id: courseId };
}

export async function deleteCourse(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing course id");
  const admin = createServiceRoleClient();
  const { error } = await admin.from("courses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath("/courses");
}

function roundToNearestHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

type ReviewFormState = {
  ok: boolean;
  message: string | null;
  mailtoUrl?: string;
};

function parseBandValue(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const value = Number.parseFloat(text);
  if (Number.isNaN(value)) return null;
  return Math.max(0, Math.min(9, roundToNearestHalf(value)));
}

function buildReviewEmailUrl(input: {
  email: string;
  studentName: string;
  examTitle: string;
  overallBand: number | null;
  moduleBands: Record<string, number | null>;
}) {
  const subject = `${input.examTitle} review complete`;
  const lines = [
    `Hello ${input.studentName || "Student"},`,
    "",
    `Your mock exam review for "${input.examTitle}" is complete.`,
    "",
    `Overall band: ${input.overallBand ?? "Pending"}`,
    `Listening: ${input.moduleBands.listening ?? "—"}`,
    `Reading: ${input.moduleBands.reading ?? "—"}`,
    `Writing: ${input.moduleBands.writing ?? "—"}`,
    "",
    "Best regards,",
    "The IELTS Exam",
  ];

  return `mailto:${encodeURIComponent(input.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

export async function reviewSpeakingAttempt(formData: FormData) {
  const reviewer = await requireAdmin();
  const attemptId = String(formData.get("attempt_id") ?? "").trim();
  const examId = String(formData.get("exam_id") ?? "").trim();
  const speakingBandRaw = Number.parseFloat(String(formData.get("speaking_band") ?? ""));
  const notes = String(formData.get("speaking_review_notes") ?? "").trim() || null;

  if (!attemptId || !examId || Number.isNaN(speakingBandRaw)) {
    throw new Error("Attempt, exam, and speaking band are required.");
  }

  const speakingBand = Math.max(0, Math.min(9, roundToNearestHalf(speakingBandRaw)));
  const admin = createServiceRoleClient();

  const { data: attempt } = await admin
    .from("mock_attempts")
    .select("id, exam_id, listening_band, reading_band, writing_band, speaking_band")
    .eq("id", attemptId)
    .single();

  if (!attempt || attempt.exam_id !== examId) {
    throw new Error("Attempt not found.");
  }

  const { data: exam } = await admin
    .from("mock_exams")
    .select("modules")
    .eq("id", examId)
    .single();

  if (!exam) {
    throw new Error("Exam not found.");
  }

  const modules = Array.isArray(exam.modules) ? exam.modules.map(String) : [];
  const bandByModule: Record<string, number | null> = {
    listening: attempt.listening_band != null ? Number(attempt.listening_band) : null,
    reading: attempt.reading_band != null ? Number(attempt.reading_band) : null,
    writing: attempt.writing_band != null ? Number(attempt.writing_band) : null,
    speaking: speakingBand,
  };

  const requiredModuleBands = modules
    .filter((module) => ["listening", "reading", "writing", "speaking"].includes(module))
    .map((module) => bandByModule[module])
    .filter((band): band is number => band != null);

  const allModulesReviewed = modules
    .filter((module) => ["listening", "reading", "writing", "speaking"].includes(module))
    .every((module) => bandByModule[module] != null);

  const overallBand = allModulesReviewed && requiredModuleBands.length > 0
    ? roundToNearestHalf(requiredModuleBands.reduce((sum, band) => sum + band, 0) / requiredModuleBands.length)
    : null;

  const reviewStatus = modules.includes("writing") && attempt.writing_band == null ? "pending" : "reviewed";

  const { error } = await admin
    .from("mock_attempts")
    .update({
      speaking_band: speakingBand,
      overall_band: overallBand,
      review_status: reviewStatus,
      speaking_review_notes: notes,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer.id,
    })
    .eq("id", attemptId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/exams/${examId}/analytics`);
  revalidatePath("/admin");
  revalidatePath("/mock-exam");
}

export async function submitHumanReview(
  _prevState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  try {
    const reviewer = await requireAdmin();
    const attemptId = String(formData.get("attempt_id") ?? "").trim();
    const examId = String(formData.get("exam_id") ?? "").trim();
    const studentEmail = String(formData.get("student_email") ?? "").trim();
    const studentName = String(formData.get("student_name") ?? "").trim();
    const notes = String(formData.get("review_notes") ?? "").trim() || null;
    const writingBand = parseBandValue(formData.get("writing_band"));
    if (!attemptId || !examId) {
      return { ok: false, message: "Attempt and exam are required." };
    }

    const admin = createServiceRoleClient();
    const [{ data: attempt }, { data: exam }] = await Promise.all([
      admin
        .from("mock_attempts")
        .select("id, exam_id, listening_band, reading_band, writing_band, speaking_band")
        .eq("id", attemptId)
        .single(),
      admin
        .from("mock_exams")
        .select("id, title, modules")
        .eq("id", examId)
        .single(),
    ]);

    if (!attempt || attempt.exam_id !== examId || !exam) {
      return { ok: false, message: "Review target not found." };
    }

    const modules = normalizeExamModules(exam.modules);
    const requiresWriting = modules.includes("writing");

    if (requiresWriting && writingBand == null) {
      return { ok: false, message: "Writing band is required before submitting this review." };
    }

    const nextBands: Record<string, number | null> = {
      listening: attempt.listening_band != null ? Number(attempt.listening_band) : null,
      reading: attempt.reading_band != null ? Number(attempt.reading_band) : null,
      writing: requiresWriting ? writingBand : attempt.writing_band != null ? Number(attempt.writing_band) : null,
      speaking: null,
    };

    const reviewModules = modules.filter((module) =>
      ["listening", "reading", "writing"].includes(module),
    );
    const allModulesReady = reviewModules.every((module) => nextBands[module] != null);
    const overallBand = allModulesReady && reviewModules.length > 0
      ? roundToNearestHalf(
          reviewModules.reduce((sum, module) => sum + Number(nextBands[module] ?? 0), 0) / reviewModules.length,
        )
      : null;

    const { error } = await admin
      .from("mock_attempts")
      .update({
        writing_band: nextBands.writing,
        speaking_band: null,
        overall_band: overallBand,
        review_status: allModulesReady ? "reviewed" : "pending",
        speaking_review_notes: notes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewer.id,
      })
      .eq("id", attemptId);

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/reviews");
    revalidatePath(`/admin/reviews/${attemptId}`);
    revalidatePath(`/admin/exams/${examId}/analytics`);
    revalidatePath("/mock-exam");

    return {
      ok: true,
      message: "Review saved.",
      mailtoUrl: studentEmail
        ? buildReviewEmailUrl({
            email: studentEmail,
            studentName,
            examTitle: exam.title,
            overallBand,
            moduleBands: nextBands,
          })
        : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save review.",
    };
  }
}

const MODULE_SET = new Set(["listening", "reading", "writing"]);

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
type SanitizedListeningAudio = { url: string; title: string } | SanitizedListeningClip[] | null;
type ReadingPassage = { part: number; title: string; text: string; image_url: string };
type WritingTask = { part: number; prompt: string; image_url: string; min_words: number };
type SpeakingPartOne = { topic_title: string; prompts: string[]; audio_url: string };
type SpeakingPartTwo = { cue_card: string; bullet_points: string[]; follow_up_prompt: string; audio_url: string };
type SpeakingPartThree = { topic_title: string; prompts: string[]; audio_url: string };

function parseExamMeta(structure_json: unknown): {
  testVariant: TestVariant;
  readingPassages: ReadingPassage[];
  writingTasks: WritingTask[];
  speaking: {
    part1: SpeakingPartOne;
    part2: SpeakingPartTwo;
    part3: SpeakingPartThree;
  };
} {
  let testVariant: TestVariant = "academic";
  let readingPassages: ReadingPassage[] = [];
  let writingTasks: WritingTask[] = [];
  let speaking: {
    part1: SpeakingPartOne;
    part2: SpeakingPartTwo;
    part3: SpeakingPartThree;
  } = {
    part1: { topic_title: "", prompts: [], audio_url: "" },
    part2: { cue_card: "", bullet_points: [], follow_up_prompt: "", audio_url: "" },
    part3: { topic_title: "", prompts: [], audio_url: "" },
  };

  if (!structure_json || typeof structure_json !== "object") {
    return { testVariant, readingPassages, writingTasks, speaking };
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

  if (structure.speaking && typeof structure.speaking === "object") {
    const speakingRaw = structure.speaking as Record<string, unknown>;
    if (speakingRaw.part1 && typeof speakingRaw.part1 === "object") {
      const part1 = speakingRaw.part1 as Record<string, unknown>;
      speaking.part1 = {
        topic_title: String(part1.topic_title ?? "").trim(),
        prompts: Array.isArray(part1.prompts)
          ? part1.prompts.map((prompt) => String(prompt ?? "").trim()).filter(Boolean)
          : [],
        audio_url: String(part1.audio_url ?? "").trim(),
      };
    }
    if (speakingRaw.part2 && typeof speakingRaw.part2 === "object") {
      const part2 = speakingRaw.part2 as Record<string, unknown>;
      speaking.part2 = {
        cue_card: String(part2.cue_card ?? "").trim(),
        bullet_points: Array.isArray(part2.bullet_points)
          ? part2.bullet_points.map((point) => String(point ?? "").trim()).filter(Boolean)
          : [],
        follow_up_prompt: String(part2.follow_up_prompt ?? "").trim(),
        audio_url: String(part2.audio_url ?? "").trim(),
      };
    }
    if (speakingRaw.part3 && typeof speakingRaw.part3 === "object") {
      const part3 = speakingRaw.part3 as Record<string, unknown>;
      speaking.part3 = {
        topic_title: String(part3.topic_title ?? "").trim(),
        prompts: Array.isArray(part3.prompts)
          ? part3.prompts.map((prompt) => String(prompt ?? "").trim()).filter(Boolean)
          : [],
        audio_url: String(part3.audio_url ?? "").trim(),
      };
    }
  }

  return { testVariant, readingPassages, writingTasks, speaking };
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
  listeningAudio: SanitizedListeningAudio,
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

  if (!listeningAudio) {
    return "Published Listening exams need one full listening audio recording.";
  }

  if (Array.isArray(listeningAudio)) {
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
  listeningAudio: SanitizedListeningAudio,
): string | null {
  const questions = input.questions ?? [];
  for (const question of questions) {
    const questionType = String(question.question_type ?? "").trim();
    if (!SUPPORTED_QUESTION_TYPE_VALUES.has(questionType)) {
      return `Question type "${questionType || "unknown"}" is not supported. Replace it before publishing.`;
    }
  }

  const { testVariant, readingPassages, writingTasks, speaking } = parseExamMeta(input.structure_json);

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

  if (input.modules.includes("speaking")) {
    const speakingQuestions = questions.filter((question) => question.module === "speaking");
    if (speaking.part1.prompts.length < 4) {
      return "Speaking Part 1 needs at least 4 short interview questions before publishing.";
    }
    if (!speaking.part2.cue_card) {
      return "Speaking Part 2 needs a cue card prompt before publishing.";
    }
    if (speaking.part2.bullet_points.length < 3) {
      return "Speaking Part 2 needs at least 3 cue card bullet points before publishing.";
    }
    if (speaking.part3.prompts.length < 4) {
      return "Speaking Part 3 needs at least 4 discussion questions before publishing.";
    }

    const expectedCount = speaking.part1.prompts.length + 1 + speaking.part3.prompts.length;
    if (speakingQuestions.length !== expectedCount) {
      return "Speaking prompts are out of sync. Save the structured Speaking section again before publishing.";
    }

    const counts = new Map<number, number>([
      [1, 0],
      [2, 0],
      [3, 0],
    ]);

    for (const question of speakingQuestions) {
      const part = Number(question.part);
      if (!Number.isInteger(part) || part < 1 || part > 3) {
        return "Every published Speaking prompt must belong to Part 1, 2, or 3.";
      }
      if (question.question_type !== "speaking_prompt") {
        return "Speaking only supports speaking prompts.";
      }
      if (!String(question.prompt ?? "").trim()) {
        return "Every published Speaking prompt needs text.";
      }
      counts.set(part, (counts.get(part) ?? 0) + 1);
    }

    if ((counts.get(2) ?? 0) !== 1) {
      return "Speaking Part 2 must contain exactly one cue card prompt.";
    }
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
    modules = ["listening", "reading", "writing"];
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
      const hasPart = (q.module === "listening" || q.module === "reading" || q.module === "writing" || q.module === "speaking") && q.part && q.part >= 1;
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

const COURSE_MEDIA_BUCKET = "course-media";

export async function getSignedCourseUploadUrl(
  folder: "covers" | "videos",
  fileName: string,
): Promise<{ ok: true; signedUrl: string; path: string; publicUrl: string } | { ok: false; message: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, message: "Unauthorized" };
  }

  let ext = (fileName.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ext) ext = folder === "covers" ? "jpg" : "mp4";
  const objectName = `${crypto.randomUUID()}.${ext}`.slice(0, 200);
  const path = `${folder}/${objectName}`;

  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage
    .from(COURSE_MEDIA_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    if (error?.message?.includes("Bucket not found") || error?.message?.includes("not found")) {
      return { ok: false, message: "Storage bucket 'course-media' missing. Apply the latest migration." };
    }
    return { ok: false, message: error?.message ?? "Failed to create upload URL" };
  }

  const { data: publicData } = admin.storage.from(COURSE_MEDIA_BUCKET).getPublicUrl(path);

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

function sanitizeListeningAudioJson(raw: unknown): SanitizedListeningAudio {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const value = raw as Record<string, unknown>;
    const url = String(value.url ?? "").trim().slice(0, 2000);
    if (url) {
      return {
        url,
        title: String(value.title ?? "").trim().slice(0, 200) || "IELTS Listening Paper",
      };
    }
  }

  if (!Array.isArray(raw)) return null;
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
  return out.length > 0 ? out : null;
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

  let mod = exam_type === "full" ? ["listening", "reading", "writing"] : modules;
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
