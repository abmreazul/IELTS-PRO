import Image from "next/image";
import Link from "next/link";
import { PlayCircle, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import "./courses.css";

type CourseRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instructor: string | null;
  level: string;
  cover_image_url: string | null;
  lessons_json: { title: string }[] | null;
};

function levelLabel(level: string) {
  if (level === "all-levels") return "All levels";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export default async function CoursesPage() {
  const supabase = await createClient();
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, slug, description, instructor, level, cover_image_url, lessons_json")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  const rows = (courses ?? []) as CourseRow[];

  return (
    <main className="courses-page">
      <section className="container courses-page__head">
        <p className="courses-page__eyebrow">Courses</p>
        <h1>Video courses for IELTS prep</h1>
        <p>
          Study with playlist-style lessons, follow along at your own pace, and keep everything in the same platform as your mock exams.
        </p>
      </section>

      <section className="container courses-grid">
        {rows.map((course) => (
          <article key={course.id} className="course-card">
            <Link href={`/courses/${course.slug}`} className="course-card__media">
              {course.cover_image_url ? (
                <Image src={course.cover_image_url} alt="" fill sizes="(max-width: 768px) 100vw, 420px" className="object-cover" />
              ) : (
                <div className="course-card__media-fallback">
                  <Video />
                </div>
              )}
            </Link>
            <div className="course-card__body">
              <div className="course-card__meta">
                <span>{levelLabel(course.level)}</span>
                <span>{Array.isArray(course.lessons_json) ? course.lessons_json.length : 0} lessons</span>
              </div>
              <h2>{course.title}</h2>
              {course.description ? <p>{course.description}</p> : null}
              <div className="course-card__footer">
                <span>{course.instructor || "The IELTS Exam Team"}</span>
                <Link href={`/courses/${course.slug}`} className="course-card__cta">
                  Start course
                  <PlayCircle size={16} />
                </Link>
              </div>
            </div>
          </article>
        ))}

        {rows.length === 0 ? (
          <div className="courses-empty">
            <h2>No courses published yet</h2>
            <p>Create the first course from the admin area and it will appear here automatically.</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
