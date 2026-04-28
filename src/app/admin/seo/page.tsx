import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { SeoEditor, type SeoPageInfo } from "@/components/admin/seo-editor";
import type { SeoMetadataRow } from "../seo-actions";

const STATIC_PAGES: SeoPageInfo[] = [
  { path: "/", label: "Home" },
  { path: "/mock-exam", label: "Exam Catalog" },
  { path: "/courses", label: "Courses" },
  { path: "/dashboard", label: "Student Dashboard" },
  { path: "/sign-in", label: "Sign In" },
  { path: "/create-account", label: "Create Account" },
  { path: "/terms", label: "Terms & Conditions" },
  { path: "/privacy", label: "Privacy Policy" },
];

export default async function AdminSeoPage() {
  const admin = createServiceRoleClient();

  // Fetch existing SEO overrides (gracefully handle missing table)
  let seoRows: SeoMetadataRow[] = [];
  try {
    const { data, error } = await admin
      .from("seo_metadata")
      .select("id, page_path, meta_title, meta_description, og_image_url, canonical_url, no_index, updated_at")
      .order("page_path");
    if (!error) seoRows = (data ?? []) as SeoMetadataRow[];
  } catch {
    /* table may not exist yet */
  }

  // Fetch dynamic pages (published exams + courses)
  const dynamicPages: SeoPageInfo[] = [];

  const { data: exams } = await admin
    .from("mock_exams")
    .select("slug, title")
    .eq("is_published", true)
    .order("title");

  for (const e of exams ?? []) {
    dynamicPages.push({ path: `/mock-exam/${e.slug}`, label: e.title });
  }

  try {
    const { data: courses } = await admin
      .from("courses")
      .select("slug, title")
      .eq("is_published", true)
      .order("title");

    for (const c of courses ?? []) {
      dynamicPages.push({ path: `/courses/${c.slug}`, label: c.title });
    }
  } catch {
    /* courses table may not exist */
  }

  const allPages = [...STATIC_PAGES, ...dynamicPages];
  const seoMap: Record<string, SeoMetadataRow> = {};
  for (const row of seoRows) {
    seoMap[row.page_path] = row;
  }

  return (
    <>
      <div className="admin-dash-head">
        <div>
          <h1 className="admin-h1" style={{ marginBottom: "0.35rem" }}>
            SEO Manager
          </h1>
          <p className="admin-lead" style={{ marginBottom: 0 }}>
            Manage meta titles, descriptions, and OG images for every page on
            the site.
          </p>
        </div>
        <Link href="/admin" className="btn btn-outline">
          Back to dashboard
        </Link>
      </div>

      <SeoEditor pages={allPages} seoMap={seoMap} />
    </>
  );
}
