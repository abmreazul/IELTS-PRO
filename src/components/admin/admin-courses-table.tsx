"use client";

import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { deleteCourse } from "@/app/admin/actions";

export type AdminCourseRow = {
  id: string;
  title: string;
  slug: string;
  instructor: string | null;
  level: string;
  is_published: boolean;
  lessonCount: number;
  created_at: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function levelLabel(level: string) {
  if (level === "all-levels") return "All levels";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function AdminCoursesTable({ courses }: { courses: AdminCourseRow[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return courses;
    return courses.filter((course) =>
      course.title.toLowerCase().includes(t) ||
      course.slug.toLowerCase().includes(t) ||
      (course.instructor?.toLowerCase().includes(t) ?? false),
    );
  }, [courses, q]);

  return (
    <>
      <input
        type="search"
        className="admin-search"
        placeholder="Search courses..."
        value={q}
        onChange={(event) => setQ(event.target.value)}
        aria-label="Search courses"
      />

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Level</th>
              <th>Instructor</th>
              <th>Lessons</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((course) => (
              <tr key={course.id}>
                <td className="admin-table-title">{course.title}</td>
                <td>{levelLabel(course.level)}</td>
                <td>{course.instructor || "—"}</td>
                <td>{course.lessonCount}</td>
                <td>
                  <span className={course.is_published ? "admin-badge admin-badge--published" : "admin-badge admin-badge--draft"}>
                    {course.is_published ? "Published" : "Draft"}
                  </span>
                </td>
                <td>{formatDate(course.created_at)}</td>
                <td>
                  <div className="admin-table-actions">
                    <Link href={`/admin/courses/${course.id}`} className="admin-icon-btn" aria-label="Edit course" title="Edit course">
                      <Pencil />
                    </Link>
                    <Link href={`/courses/${course.slug}`} className="admin-icon-btn" aria-label="Preview course" title="Preview course">
                      <Eye />
                    </Link>
                    <form
                      action={deleteCourse}
                      style={{ display: "inline" }}
                      onSubmit={(event) => {
                        if (!confirm(`Delete "${course.title}"?`)) event.preventDefault();
                      }}
                    >
                      <input type="hidden" name="id" value={course.id} />
                      <button type="submit" className="admin-icon-btn" aria-label="Delete course" title="Delete course">
                        <Trash2 />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: "var(--muted)", marginTop: "1rem" }}>No courses match your search.</p>
      ) : null}
    </>
  );
}
