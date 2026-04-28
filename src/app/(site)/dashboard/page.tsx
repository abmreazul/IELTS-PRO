import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { normalizeExamModules } from "@/lib/exam/ielts-defaults";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";
import type { DashboardAttempt } from "@/components/dashboard/student-dashboard";
import { getSeoOverrides, applySeoOverrides } from "@/lib/seo/metadata";
import "./dashboard.css";

export async function generateMetadata(): Promise<Metadata> {
  const overrides = await getSeoOverrides("/dashboard");
  return applySeoOverrides(
    {
      title: "Dashboard | The IELTS Exam",
      description: "Track your IELTS mock exam attempts, band score progress, and module performance.",
    },
    overrides,
  );
}

export default async function DashboardPage() {
  const { user } = await getAuthUser();

  if (!user) {
    redirect("/sign-in?next=/dashboard");
  }

  const supabase = await createClient();

  // Fetch all completed attempts with their exam info
  const { data: attemptsRaw } = await supabase
    .from("mock_attempts")
    .select(
      `
      id,
      exam_id,
      status,
      review_status,
      overall_band,
      listening_band,
      reading_band,
      writing_band,
      completed_at,
      created_at,
      mock_exams!inner (
        title,
        slug,
        modules
      )
    `,
    )
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(50);

  const attempts: DashboardAttempt[] = (attemptsRaw ?? []).map((row) => {
    const exam = row.mock_exams as unknown as {
      title: string;
      slug: string;
      modules: string[];
    };
    return {
      id: row.id as string,
      exam_id: row.exam_id as string,
      status: row.status as string,
      review_status: row.review_status as DashboardAttempt["review_status"],
      overall_band: row.overall_band as number | null,
      listening_band: row.listening_band as number | null,
      reading_band: row.reading_band as number | null,
      writing_band: row.writing_band as number | null,
      completed_at: row.completed_at as string | null,
      created_at: row.created_at as string,
      exam_title: exam?.title ?? "Exam",
      exam_slug: exam?.slug ?? "",
      exam_modules: normalizeExamModules(exam?.modules ?? []),
    };
  });

  // Get user's display name
  const meta = user.user_metadata as Record<string, string | undefined> | undefined;
  const userName =
    meta?.full_name?.trim() ||
    meta?.name?.trim() ||
    user.email?.split("@")[0] ||
    "Student";

  return <StudentDashboard userName={userName} attempts={attempts} />;
}
