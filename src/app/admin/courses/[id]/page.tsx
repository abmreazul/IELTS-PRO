import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { CourseEditor } from "@/components/admin/course-editor";

export default async function AdminCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createServiceRoleClient();
  const { data: course } = await admin
    .from("courses")
    .select("id, title, slug, description, instructor, level, cover_image_url, is_published, lessons_json")
    .eq("id", id)
    .maybeSingle();

  if (!course) notFound();

  return (
    <CourseEditor
      course={{
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        instructor: course.instructor,
        level: course.level,
        cover_image_url: course.cover_image_url,
        is_published: course.is_published,
        lessons_json: Array.isArray(course.lessons_json) ? course.lessons_json as never[] : [],
      }}
    />
  );
}
