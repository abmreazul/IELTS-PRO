import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type SeoOverride = {
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  no_index: boolean;
};

/**
 * Fetch admin-managed SEO overrides for a given page path.
 * Returns null if no override exists or the table is missing.
 */
export async function getSeoOverrides(pagePath: string): Promise<SeoOverride | null> {
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin
      .from("seo_metadata")
      .select("meta_title, meta_description, og_image_url, canonical_url, no_index")
      .eq("page_path", pagePath)
      .maybeSingle();
    return data as SeoOverride | null;
  } catch {
    return null;
  }
}

/**
 * Merge admin SEO overrides into the page's default Metadata object.
 * Only fields that are set (non-null) in the override will replace defaults.
 */
export function applySeoOverrides(
  defaults: Metadata,
  overrides: SeoOverride | null,
): Metadata {
  if (!overrides) return defaults;
  const result = { ...defaults };

  if (overrides.meta_title) {
    result.title = overrides.meta_title;
  }
  if (overrides.meta_description) {
    result.description = overrides.meta_description;
  }
  if (overrides.og_image_url) {
    result.openGraph = {
      ...(result.openGraph && typeof result.openGraph === "object" ? result.openGraph : {}),
      images: [{ url: overrides.og_image_url }],
    };
  }
  if (overrides.canonical_url) {
    result.alternates = { ...result.alternates, canonical: overrides.canonical_url };
  }
  if (overrides.no_index) {
    result.robots = { index: false, follow: false };
  }
  return result;
}
