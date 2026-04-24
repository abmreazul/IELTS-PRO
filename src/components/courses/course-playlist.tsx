"use client";

import { useMemo, useState } from "react";
import { PlayCircle, Clock } from "lucide-react";

type Lesson = {
  title: string;
  summary: string;
  provider: "youtube" | "upload";
  video_url: string;
  duration_label: string;
};

function getYouTubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "").trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function CoursePlaylist({ lessons }: { lessons: Lesson[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeLesson = lessons[activeIndex] ?? null;

  const embedUrl = useMemo(() => {
    if (!activeLesson || activeLesson.provider !== "youtube") return null;
    return getYouTubeEmbedUrl(activeLesson.video_url);
  }, [activeLesson]);

  if (!activeLesson) {
    return null;
  }

  return (
    <div className="course-detail__layout">
      <div className="course-player">
        <div className="course-player__frame">
          {activeLesson.provider === "youtube" && embedUrl ? (
            <iframe
              src={embedUrl}
              title={activeLesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video controls src={activeLesson.video_url} playsInline preload="metadata" />
          )}
        </div>
        <div className="course-player__meta">
          <div className="course-player__meta-row">
            {activeLesson.duration_label ? (
              <span className="course-player__duration">
                <Clock size={14} />
                {activeLesson.duration_label}
              </span>
            ) : null}
          </div>
          <h2>{activeLesson.title}</h2>
          {activeLesson.summary ? <p>{activeLesson.summary}</p> : null}
        </div>
      </div>

      <aside className="course-playlist">
        <div className="course-playlist__head">
          <h3>Course playlist</h3>
          <span>{lessons.length} lessons</span>
        </div>
        <div className="course-playlist__items">
          {lessons.map((lesson, index) => (
            <button
              key={`${lesson.title}-${index}`}
              type="button"
              className={`course-playlist__item${index === activeIndex ? " course-playlist__item--active" : ""}`}
              onClick={() => setActiveIndex(index)}
            >
              <div className="course-playlist__item-icon">
                <PlayCircle size={18} />
              </div>
              <div className="course-playlist__item-body">
                <strong>{lesson.title}</strong>
                {lesson.summary ? <span>{lesson.summary}</span> : null}
              </div>
              {lesson.duration_label ? <span className="course-playlist__item-duration">{lesson.duration_label}</span> : null}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
