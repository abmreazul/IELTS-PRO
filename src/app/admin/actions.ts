"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
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
  revalidatePath("/admin/exams");
  revalidatePath("/mock-exam");
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
