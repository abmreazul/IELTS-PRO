import type { Metadata } from "next";
import { HomePage } from "@/components/home/home-page";
import type { MockExamRow } from "@/components/mock-exam/types";
import { normalizeExamModules } from "@/lib/exam/ielts-defaults";
import { createClient } from "@/lib/supabase/server";
import { getSeoOverrides, applySeoOverrides } from "@/lib/seo/metadata";
import "../(site)/mock-exam/mock-exam.css";

export async function generateMetadata(): Promise<Metadata> {
  const overrides = await getSeoOverrides("/");
  return applySeoOverrides(
    {
      title: "The IELTS Exam — Full Mock Tests & Band Analytics",
      description:
        "Master the IELTS exam with full mock tests, band analytics, writing review, and personalised preparation.",
    },
    overrides,
  );
}
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ielts-pro.vercel.app";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "The IELTS Exam",
  url: SITE_URL,
  description:
    "Master the IELTS exam with full mock tests, band analytics, writing review, and personalised preparation.",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "29",
    highPrice: "99",
    offerCount: "3",
  },
};

async function getFeaturedExams(): Promise<MockExamRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mock_exams")
    .select(
      `id, category_id, title, slug, description, exam_type, modules,
       duration_minutes, question_count, difficulty, price_cents, currency,
       cover_image_url, listening_audio_json, is_published,
       exam_categories ( id, slug, name, sort_order )`,
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  const exams = ((data ?? []) as unknown as MockExamRow[]).map((exam) => ({
    ...exam,
    modules: normalizeExamModules(exam.modules),
  }));

  const seenCategories = new Set<string>();
  const featured: MockExamRow[] = [];

  for (const exam of exams) {
    const key = exam.exam_categories?.id ?? exam.category_id;
    if (!key || seenCategories.has(key)) continue;
    seenCategories.add(key);
    featured.push(exam);
  }

  return featured.slice(0, 4);
}

export default async function Home() {
  const featuredExams = await getFeaturedExams();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePage featuredExams={featuredExams} />
    </>
  );
}
