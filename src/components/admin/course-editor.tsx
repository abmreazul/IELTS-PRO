"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, PlayCircle, Youtube, Video } from "lucide-react";
import { saveCourse } from "@/app/admin/actions";
import { CourseMediaUpload } from "@/components/admin/course-media-upload";

type Lesson = {
  tempId: string;
  title: string;
  summary: string;
  provider: "youtube" | "upload";
  video_url: string;
  duration_label: string;
};

type Course = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instructor: string | null;
  level: "all-levels" | "beginner" | "intermediate" | "advanced";
  cover_image_url: string | null;
  is_published: boolean;
  lessons_json: Lesson[];
};

function makeTempId() {
  return `lesson-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeYouTubeUrl(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace("/", "").trim();
      return id ? `https://www.youtube.com/watch?v=${id}` : raw;
    }
    if (url.hostname.includes("youtube.com")) {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/watch?v=${id}` : raw;
    }
  } catch {
    return raw;
  }
  return raw;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function randomSlugSuffix(length = 6) {
  return Math.random().toString(36).slice(2, 2 + length);
}

export function CourseEditor({ course }: { course?: Course | null }) {
  const [title, setTitle] = useState(course?.title ?? "");
  const [slugSeed] = useState(() => course?.slug?.split("-").slice(-1)[0] || randomSlugSuffix());
  const [description, setDescription] = useState(course?.description ?? "");
  const [instructor, setInstructor] = useState(course?.instructor ?? "");
  const [level, setLevel] = useState<Course["level"]>(course?.level ?? "all-levels");
  const [coverImageUrl, setCoverImageUrl] = useState(course?.cover_image_url ?? "");
  const [isPublished, setIsPublished] = useState(Boolean(course?.is_published));
  const [lessons, setLessons] = useState<Lesson[]>(
    course?.lessons_json?.map((lesson) => ({ ...lesson, tempId: makeTempId() })) ?? [
      {
        tempId: makeTempId(),
        title: "",
        summary: "",
        provider: "youtube",
        video_url: "",
        duration_label: "",
      },
    ],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const normalizedSlug = useMemo(() => {
    if (course?.slug) return course.slug;
    const base = slugify(title) || "course";
    return `${base}-${slugSeed}`;
  }, [course?.slug, slugSeed, title]);

  function updateLesson(tempId: string, patch: Partial<Lesson>) {
    setLessons((current) => current.map((lesson) => (lesson.tempId === tempId ? { ...lesson, ...patch } : lesson)));
  }

  function moveLesson(tempId: string, direction: -1 | 1) {
    setLessons((current) => {
      const index = current.findIndex((lesson) => lesson.tempId === tempId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }

  async function onSubmit(formData: FormData) {
    setMessage(null);
    formData.set("slug", normalizedSlug);
    formData.set("lessons_json", JSON.stringify(
      lessons.map((lesson) => ({
        title: lesson.title.trim(),
        summary: lesson.summary.trim(),
        provider: lesson.provider,
        video_url: lesson.provider === "youtube" ? normalizeYouTubeUrl(lesson.video_url) : lesson.video_url.trim(),
        duration_label: lesson.duration_label.trim(),
      })),
    ));
    formData.set("cover_image_url", coverImageUrl.trim());
    formData.set("is_published", String(isPublished));
    startTransition(async () => {
      const result = await saveCourse(formData);
      setMessage(result.ok ? "Course saved." : result.message ?? "Could not save course.");
    });
  }

  return (
    <>
      <div className="admin-wizard-toolbar">
        <div>
          <Link href="/admin/courses" className="admin-wizard-back">← Back to courses</Link>
          <h1 className="admin-wizard-title" style={{ marginTop: "0.45rem" }}>
            {course ? "Edit Course" : "Create Course"}
          </h1>
        </div>
      </div>

      <form action={onSubmit} className="admin-form-grid" style={{ gap: "1rem" }}>
        {course?.id ? <input type="hidden" name="id" value={course.id} /> : null}

        <div className="admin-card">
          <h2>Basic Info</h2>
          <div className="admin-form-grid admin-form-grid--2">
            <div>
              <label className="admin-label" htmlFor="course-title">Course title</label>
              <input id="course-title" name="title" className="admin-input" value={title} onChange={(event) => setTitle(event.target.value)} required />
            </div>
            <div>
              <label className="admin-label" htmlFor="course-instructor">Instructor</label>
              <input id="course-instructor" name="instructor" className="admin-input" value={instructor} onChange={(event) => setInstructor(event.target.value)} placeholder="IELTS Team" />
            </div>
            <div>
              <label className="admin-label" htmlFor="course-level">Level</label>
              <select id="course-level" name="level" className="admin-select" value={level} onChange={(event) => setLevel(event.target.value as Course["level"])}>
                <option value="all-levels">All levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <label className="admin-label">Slug</label>
            <div className="admin-input" style={{ display: "flex", alignItems: "center", color: "var(--muted)", fontWeight: 600 }}>
              {normalizedSlug}
            </div>
            <p style={{ margin: "0.45rem 0 0", color: "var(--muted)", fontSize: "0.78rem" }}>
              Generated automatically so duplicate course titles never block publishing.
            </p>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <label className="admin-label" htmlFor="course-description">Description</label>
            <textarea id="course-description" name="description" className="admin-textarea" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="admin-form-grid admin-form-grid--2" style={{ marginTop: "1rem" }}>
            <div>
              <label className="admin-label" htmlFor="course-cover-url">Cover image URL</label>
              <input id="course-cover-url" name="cover_image_url" className="admin-input" value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} placeholder="https://..." />
            </div>
            <div style={{ display: "flex", alignItems: "end" }}>
              <label className="admin-check" style={{ marginBottom: "0.3rem" }}>
                <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
                Publish course
              </label>
            </div>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <CourseMediaUpload
              folder="covers"
              accept="image/*"
              label="Upload cover"
              onUploaded={setCoverImageUrl}
            />
          </div>
          {coverImageUrl ? (
            <div className="admin-course-cover-preview">
              <Image src={coverImageUrl} alt="" fill sizes="240px" className="object-cover" />
            </div>
          ) : null}
        </div>

        <div className="admin-card">
          <div className="admin-dash-head" style={{ marginBottom: "1rem" }}>
            <div>
              <h2 style={{ marginBottom: "0.3rem" }}>Playlist Lessons</h2>
              <p style={{ margin: 0, color: "var(--muted)" }}>Add YouTube videos or upload lesson videos directly.</p>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() =>
                setLessons((current) => [
                  ...current,
                  { tempId: makeTempId(), title: "", summary: "", provider: "youtube", video_url: "", duration_label: "" },
                ])
              }
            >
              <Plus size={16} />
              Add lesson
            </button>
          </div>

          <div className="admin-course-lesson-list">
            {lessons.map((lesson, index) => (
              <article key={lesson.tempId} className="admin-course-lesson-card">
                <div className="admin-course-lesson-card__header">
                  <div>
                    <p className="admin-course-lesson-card__eyebrow">Lesson {index + 1}</p>
                    <h3>{lesson.title || "Untitled lesson"}</h3>
                  </div>
                  <div className="admin-table-actions">
                    <button type="button" className="admin-icon-btn" aria-label="Move lesson up" onClick={() => moveLesson(lesson.tempId, -1)}>
                      <ArrowUp />
                    </button>
                    <button type="button" className="admin-icon-btn" aria-label="Move lesson down" onClick={() => moveLesson(lesson.tempId, 1)}>
                      <ArrowDown />
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn"
                      aria-label="Delete lesson"
                      onClick={() => setLessons((current) => current.filter((row) => row.tempId !== lesson.tempId))}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </div>

                <div className="admin-form-grid admin-form-grid--2">
                  <div>
                    <label className="admin-label">Lesson title</label>
                    <input className="admin-input" value={lesson.title} onChange={(event) => updateLesson(lesson.tempId, { title: event.target.value })} />
                  </div>
                  <div>
                    <label className="admin-label">Duration label</label>
                    <input className="admin-input" value={lesson.duration_label} onChange={(event) => updateLesson(lesson.tempId, { duration_label: event.target.value })} placeholder="12 min" />
                  </div>
                </div>

                <div style={{ marginTop: "1rem" }}>
                  <label className="admin-label">Lesson summary</label>
                  <textarea className="admin-textarea" rows={3} value={lesson.summary} onChange={(event) => updateLesson(lesson.tempId, { summary: event.target.value })} />
                </div>

                <div className="admin-course-provider-switch">
                  <button
                    type="button"
                    className={`admin-course-provider-btn${lesson.provider === "youtube" ? " admin-course-provider-btn--active" : ""}`}
                    onClick={() => updateLesson(lesson.tempId, { provider: "youtube", video_url: "" })}
                  >
                    <Youtube size={16} />
                    YouTube
                  </button>
                  <button
                    type="button"
                    className={`admin-course-provider-btn${lesson.provider === "upload" ? " admin-course-provider-btn--active" : ""}`}
                    onClick={() => updateLesson(lesson.tempId, { provider: "upload", video_url: "" })}
                  >
                    <Video size={16} />
                    Direct upload
                  </button>
                </div>

                <div style={{ marginTop: "1rem" }}>
                  <label className="admin-label">{lesson.provider === "youtube" ? "YouTube URL" : "Video URL"}</label>
                  <input
                    className="admin-input"
                    value={lesson.video_url}
                    onChange={(event) => updateLesson(lesson.tempId, { video_url: event.target.value })}
                    placeholder={lesson.provider === "youtube" ? "https://www.youtube.com/watch?v=..." : "https://.../lesson.mp4"}
                  />
                </div>

                {lesson.provider === "upload" ? (
                  <div style={{ marginTop: "1rem" }}>
                    <CourseMediaUpload
                      folder="videos"
                      accept="video/mp4,video/quicktime,video/webm"
                      label="Upload video lesson"
                      onUploaded={(url) => updateLesson(lesson.tempId, { video_url: url })}
                    />
                  </div>
                ) : null}

                <div className="admin-course-lesson-card__preview">
                  <PlayCircle size={18} />
                  <span>{lesson.video_url ? "Lesson source ready" : "Add a video source to include this lesson"}</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        {message ? (
          <div className={message === "Course saved." ? "admin-success" : "admin-error"}>{message}</div>
        ) : null}

        <div className="admin-wizard-actions">
          <button type="submit" className="btn btn-primary btn-topbar-cta" disabled={isPending}>
            {isPending ? "Saving…" : "Save Course"}
          </button>
          <Link href="/admin/courses" className="btn btn-outline">Cancel</Link>
        </div>
      </form>
    </>
  );
}
