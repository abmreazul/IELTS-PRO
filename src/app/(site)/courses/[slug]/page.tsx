import Image from "next/image";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { ChevronLeft, Layers3 } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { CoursePlaylist } from "@/components/courses/course-playlist";
import "../../../courses/courses.css";

type Lesson = {
  title: string;
  summary: string;
  provider: "youtube" | "upload";
  video_url: string;
  duration_label: string;
};

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  noStore();
  const admin = createServiceRoleClient();
  const { data: course } = await admin
    .from("courses")
    .select("id, title, slug, description, instructor, level, cover_image_url, lessons_json")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!course) notFound();

  const lessons = (Array.isArray(course.lessons_json) ? course.lessons_json : []) as Lesson[];

  return (
    <main className="course-detail-page">
      <section className="container course-detail__hero">
        <Link href="/courses" className="course-detail__back">
          <ChevronLeft size={16} />
          Back to courses
        </Link>

        <div className="course-detail__hero-grid">
          <div>
            <p className="courses-page__eyebrow">Course playlist</p>
            <h1>{course.title}</h1>
            {course.description ? <p className="course-detail__lead">{course.description}</p> : null}
            <div className="course-detail__hero-meta">
              <span>{course.instructor || "The IELTS Exam Team"}</span>
              <span>
                <Layers3 size={16} />
                {lessons.length} lessons
              </span>
            </div>
          </div>

          <div className="course-detail__hero-cover">
            {course.cover_image_url ? (
              <Image src={course.cover_image_url} alt="" fill sizes="(max-width: 900px) 100vw, 420px" className="object-cover" />
            ) : null}
          </div>
        </div>
      </section>

      <section className="container course-detail__content">
        <CoursePlaylist lessons={lessons} />
      </section>
    </main>
  );
}
