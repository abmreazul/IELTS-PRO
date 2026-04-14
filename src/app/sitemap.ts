import type { MetadataRoute } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ielts-pro.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/mock-exam`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/sign-in`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/create-account`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  // Dynamic exam pages
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin
      .from("mock_exams")
      .select("slug, updated_at")
      .eq("is_published", true);

    if (data) {
      for (const exam of data) {
        staticRoutes.push({
          url: `${SITE}/mock-exam/${exam.slug}`,
          lastModified: exam.updated_at ? new Date(exam.updated_at) : new Date(),
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }
  } catch {
    // Fail gracefully — static routes still work
  }

  return staticRoutes;
}
