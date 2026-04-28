"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { enforceActionRateLimit } from "@/lib/security/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

async function requireAdmin(actionName = "seo-action") {
  const { user, error } = await getAuthUser();
  if (error || !user?.email) throw new Error("Unauthorized");
  if (!isAdminEmail(user.email)) throw new Error("Forbidden");
  await enforceActionRateLimit({
    action: `admin:${actionName}`,
    subject: `user:${user.id}`,
    limit: 120,
    windowMs: 60_000,
  });
  return user;
}

export type SeoMetadataRow = {
  id: string;
  page_path: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  no_index: boolean;
  updated_at: string;
};

export type SeoSaveInput = {
  page_path: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  no_index: boolean;
};

function isMissingTable(message: string | undefined) {
  return Boolean(
    message &&
      message.includes("seo_metadata") &&
      (message.includes("schema cache") || message.includes("Could not find")),
  );
}

export async function saveSeoMetadata(
  input: SeoSaveInput,
): Promise<{ ok: boolean; message: string }> {
  const user = await requireAdmin("save-seo");
  const admin = createServiceRoleClient();

  const { error } = await admin.from("seo_metadata").upsert(
    {
      page_path: input.page_path,
      meta_title: input.meta_title || null,
      meta_description: input.meta_description || null,
      og_image_url: input.og_image_url || null,
      canonical_url: input.canonical_url || null,
      no_index: input.no_index,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "page_path" },
  );

  if (error) {
    if (isMissingTable(error.message)) {
      return {
        ok: false,
        message: "SEO table not found. Run migration 015_seo_metadata.sql first.",
      };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath(input.page_path);
  revalidatePath("/admin/seo");
  return { ok: true, message: "SEO metadata saved." };
}

export async function deleteSeoMetadata(
  pagePath: string,
): Promise<{ ok: boolean; message: string }> {
  await requireAdmin("delete-seo");
  const admin = createServiceRoleClient();

  const { error } = await admin
    .from("seo_metadata")
    .delete()
    .eq("page_path", pagePath);

  if (error) return { ok: false, message: error.message };

  revalidatePath(pagePath);
  revalidatePath("/admin/seo");
  return { ok: true, message: "SEO override removed." };
}
