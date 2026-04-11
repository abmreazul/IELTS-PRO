"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
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
    Math.max(1, input.questions?.length ?? 0);
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
    const rows = qs.map((q, i) => ({
      exam_id: examId,
      sort_order: i,
      module: MODULE_SET.has(q.module) ? q.module : "reading",
      question_type: String(q.question_type || "multiple_choice").slice(0, 120),
      prompt: String(q.prompt ?? "").slice(0, 20000),
      options_json: q.options_json ?? [],
      correct_json: q.correct_json ?? null,
      points: Math.max(0, Math.round(Number(q.points) || 0)) || 1,
    }));
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
const MAX_COVER_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 45 * 1024 * 1024;

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

  const maxBytes = folder === "covers" ? MAX_COVER_BYTES : MAX_AUDIO_BYTES;
  if (file.size > maxBytes) {
    return {
      ok: false,
      message: `File too large. Max ${Math.round(maxBytes / 1024 / 1024)} MB for ${folder === "covers" ? "images" : "audio"}.`,
    };
  }

  let ext = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ext) {
    ext = folder === "covers" ? "jpg" : "mp3";
  }
  const objectName = `${crypto.randomUUID()}.${ext}`.slice(0, 200);
  const path = `${folder}/${objectName}`;

  const admin = createServiceRoleClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(EXAM_MEDIA_BUCKET).upload(path, buffer, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (error) {
    if (error.message?.includes("Bucket not found") || error.message?.includes("not found")) {
      return {
        ok: false,
        message:
          "Storage bucket missing. Run migration 006_exam_media_storage.sql in Supabase (creates bucket exam-media).",
      };
    }
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
