import Link from "next/link";
import { getAuthUser } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminCoursesTable, type AdminCourseRow } from "@/components/admin/admin-courses-table";

export default async function AdminCoursesPage() {
  const { user } = await getAuthUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    return null;
  }

  const admin = createServiceRoleClient();
  const { data: courses } = await admin
    .from("courses")
    .select("id, title, slug, instructor, level, is_published, lessons_json, created_at")
    .order("created_at", { ascending: false });

  const rows: AdminCourseRow[] = (courses ?? []).map((course) => ({
    id: course.id,
    title: course.title,
    slug: course.slug,
    instructor: course.instructor,
    level: course.level,
    is_published: course.is_published,
    lessonCount: Array.isArray(course.lessons_json) ? course.lessons_json.length : 0,
    created_at: course.created_at,
  }));

  return (
    <>
      <div className="admin-dash-head">
        <div>
          <h1 className="admin-h1" style={{ marginBottom: "0.35rem" }}>Courses</h1>
          <p className="admin-lead" style={{ marginBottom: 0 }}>
            Build video playlists for IELTS learners with YouTube embeds or direct uploads.
          </p>
        </div>
        <Link href="/admin/courses/new" className="btn btn-primary btn-topbar-cta">
          + Create New Course
        </Link>
      </div>

      <div className="admin-card">
        <AdminCoursesTable courses={rows} />
      </div>
    </>
  );
}
