"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitExamAttempt } from "@/app/(site)/mock-exam/actions";
import { coerceTestVariant, getReadingSectionLabel } from "@/lib/exam/ielts-defaults";
import { Clock, Send, Volume2, Pause, Play, ChevronLeft, ChevronRight } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

export type ExamQuestion = {
  id: string;
  module: string;
  question_type: string;
  prompt: string;
  options_json: unknown;
  correct_json: unknown;
  points: number;
  sort_order: number;
};

export type ExamData = {
  id: string;
  title: string;
  slug: string;
  modules: string[];
  duration_minutes: number;
  listening_audio_json?: { part: number; url: string; title?: string }[] | null;
  structure_json?: {
    exam_meta?: { test_variant?: "academic" | "general" };
    reading_passages?: { part: number; title: string; text: string; image_url?: string }[];
    writing_tasks?: { part: number; prompt: string; image_url?: string; min_words?: number }[];
  } | null;
};

type Props = {
  exam: ExamData;
  questions: ExamQuestion[];
  attemptId: string;
};

type AnswerMap = Record<string, string | number | string[]>;

const MODULE_LABELS: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

/* ═══════════════════════════════════════════════════════════════════
   Timer Hook
   ═══════════════════════════════════════════════════════════════════ */

function useCountdown(totalSeconds: number, onEnd: () => void) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const endedRef = useRef(false);

  useEffect(() => {
    if (remaining <= 0 && !endedRef.current) {
      endedRef.current = true;
      onEnd();
      return;
    }
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(id); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [remaining, onEnd]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const pct = totalSeconds > 0 ? (remaining / totalSeconds) * 100 : 0;
  const isLow = remaining < 300;

  return { remaining, display, pct, isLow, minutes };
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

type PartInfo = {
  part: number;         // Part number within the module (1-based)
  module: string;       // "listening" | "reading" | "writing" | "speaking"
  questions: ExamQuestion[];
  startIndex: number;   // Global question index offset
};

const MODULE_PART_COUNTS: Record<string, number> = {
  listening: 4,
  reading: 3,
  writing: 2,
};

const MODULE_ORDER = ["listening", "reading", "writing", "speaking"];

function groupByPart(questions: ExamQuestion[], modules: string[]): PartInfo[] {
  const ordered = MODULE_ORDER.filter((m) => modules.includes(m));
  const parts: PartInfo[] = [];
  let runningIdx = 0;

  for (const mod of ordered) {
    const modQuestions = questions.filter((q) => q.module === mod);
    const partCount = MODULE_PART_COUNTS[mod];

    if (partCount) {
      // Part-based module: decode part from sort_order
      const partMap: Record<number, ExamQuestion[]> = {};
      for (let i = 1; i <= partCount; i++) partMap[i] = [];

      for (const q of modQuestions) {
        const decoded = q.sort_order >= 100 ? Math.floor(q.sort_order / 100) : 1;
        const p = Math.max(1, Math.min(partCount, decoded));
        partMap[p].push(q);
      }

      for (let p = 1; p <= partCount; p++) {
        parts.push({ part: p, module: mod, questions: partMap[p], startIndex: runningIdx });
        runningIdx += partMap[p].length;
      }
    } else {
      // Non-part module: single section
      parts.push({ part: 1, module: mod, questions: modQuestions, startIndex: runningIdx });
      runningIdx += modQuestions.length;
    }
  }

  if (parts.length === 0) {
    return [{ part: 1, module: ordered[0] ?? "reading", questions: [], startIndex: 0 }];
  }
  return parts;
}

/* ═══════════════════════════════════════════════════════════════════
   ExamPlayer
   ═══════════════════════════════════════════════════════════════════ */

export function ExamPlayer({ exam, questions, attemptId }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [activePart, setActivePart] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ overallBand: number; moduleBands: Record<string, number> } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Audio — one ref per part
  const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({});
  const [playingPart, setPlayingPart] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<number, number>>({});

  const contentRef = useRef<HTMLDivElement>(null);
  const [navCollapsed, setNavCollapsed] = useState(false);

  const totalSeconds = exam.duration_minutes * 60;
  const handleTimeEnd = useCallback(() => {
    if (!submitted) handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const { display: timeDisplay, pct: timePct, isLow: timeIsLow, minutes: minsLeft } = useCountdown(totalSeconds, handleTimeEnd);

  const parts = useMemo(() => groupByPart(questions, exam.modules), [questions, exam.modules]);
  const currentPartInfo = parts[activePart - 1] ?? parts[0];
  const answeredCount = Object.keys(answers).length;
  const isReading = currentPartInfo.module === "reading";
  const isListening = currentPartInfo.module === "listening";
  const isWriting = currentPartInfo.module === "writing";
  const readingVariant = coerceTestVariant(exam.structure_json?.exam_meta?.test_variant);
  const readingSectionLabel = getReadingSectionLabel(readingVariant);

  // Get audio for a specific part
  const getAudioForPart = (partNum: number) => {
    if (!exam.listening_audio_json) return null;
    return exam.listening_audio_json.find((a) => a.part === partNum) ?? null;
  };

  const setAnswer = (questionId: string, value: string | number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const goToPart = (part: number) => {
    // Pause current audio when switching parts
    if (playingPart !== null) {
      audioRefs.current[playingPart]?.pause();
      setPlayingPart(null);
    }
    setActivePart(part);
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Scroll to a specific question
  const scrollToQuestion = (globalIdx: number) => {
    const el = document.getElementById(`q-${globalIdx + 1}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Brief highlight
      el.classList.add("ep-q--highlight");
      setTimeout(() => el.classList.remove("ep-q--highlight"), 1200);
    }
  };

  const handleSubmit = async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    setShowConfirm(false);
    const res = await submitExamAttempt(attemptId, answers);
    setSubmitting(false);
    if (res.ok) {
      setSubmitted(true);
      setResult({ overallBand: res.overallBand, moduleBands: res.moduleBands });
    } else {
      alert(res.message);
    }
  };

  const toggleAudio = (partNum: number) => {
    const audio = audioRefs.current[partNum];
    if (!audio) return;

    // If another part's audio is playing, pause it first
    if (playingPart !== null && playingPart !== partNum) {
      audioRefs.current[playingPart]?.pause();
    }

    if (playingPart === partNum) {
      audio.pause();
      setPlayingPart(null);
    } else {
      audio.play();
      setPlayingPart(partNum);
    }
  };

  const answeredInPart = (partQuestions: ExamQuestion[]) =>
    partQuestions.filter((q) => answers[q.id] !== undefined).length;

  /* ── Results screen ────────────── */
  if (submitted && result) {
    return (
      <div className="ep-results">
        <div className="ep-results__card ep-fade-in">
          <div className="ep-results__badge">✓</div>
          <h1 className="ep-results__title">Exam Completed!</h1>
          <p className="ep-results__sub">{exam.title}</p>
          <div className="ep-results__band-main">
            <span className="ep-results__band-label">Overall Band Score</span>
            <span className="ep-results__band-value">{result.overallBand.toFixed(1)}</span>
          </div>
          <div className="ep-results__modules">
            {Object.entries(result.moduleBands).map(([mod, band]) => (
              <div key={mod} className="ep-results__module">
                <span>{MODULE_LABELS[mod] ?? mod}</span>
                <strong>{band.toFixed(1)}</strong>
              </div>
            ))}
          </div>
          <div className="ep-results__stats">
            <div><span>Questions Answered</span><strong>{answeredCount} / {questions.length}</strong></div>
          </div>
          <div className="ep-results__actions">
            <button className="btn btn-primary btn-topbar-cta" onClick={() => router.push("/mock-exam")}>
              Back to Exams
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Render single question ────────────── */
  const renderQuestion = (q: ExamQuestion, globalIdx: number) => {
    const options = Array.isArray(q.options_json) ? (q.options_json as string[]) : [];

    return (
      <div key={q.id} className="ep-q ep-slide-up" id={`q-${globalIdx + 1}`}>
        {(q.question_type === "multiple_choice" || q.question_type === "multiple_choice_multi") && options.length > 0 ? (
          <>
            <p className="ep-q__text"><strong>{globalIdx + 1}.</strong> {q.prompt}</p>
            <div className="ep-q__opts">
              {options.map((opt, i) => {
                const selected = answers[q.id] === i;
                return (
                  <label key={i} className={`ep-q__radio${selected ? " ep-q__radio--sel" : ""}`}>
                    <input type="radio" name={`q-${q.id}`} checked={selected} onChange={() => setAnswer(q.id, i)} />
                    <span className="ep-q__letter">{String.fromCharCode(65 + i)}</span>
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </>
        ) : null}

        {(q.question_type === "true_false_not_given" || q.question_type === "yes_no_not_given") ? (
          <>
            <p className="ep-q__text"><strong>{globalIdx + 1}.</strong> {q.prompt}</p>
            <div className="ep-q__tf-group">
              {(q.question_type === "true_false_not_given" ? ["true", "false", "not_given"] : ["yes", "no", "not_given"]).map((opt) => {
                const selected = answers[q.id] === opt;
                return (
                  <label key={opt} className={`ep-q__tf${selected ? " ep-q__tf--sel" : ""}`}>
                    <input type="radio" name={`q-${q.id}`} checked={selected} onChange={() => setAnswer(q.id, opt)} />
                    <span>{opt.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                  </label>
                );
              })}
            </div>
          </>
        ) : null}

        {["completion", "short_answer", "fill_in_blank", "sentence_completion",
          "matching_headings", "matching_information", "matching_features",
          "sentence_endings", "map_diagram_labeling", "matching"].includes(q.question_type) ? (
          <div className="ep-q__fill-row">
            <p className="ep-q__text"><strong>{globalIdx + 1}.</strong> {q.prompt}</p>
            <div className="ep-q__fill-inline">
              <input
                className="ep-q__fill-input"
                type="text"
                placeholder="Type answer…"
                value={String(answers[q.id] ?? "")}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
            </div>
          </div>
        ) : null}

        {q.question_type === "essay" ? (
          <>
            <p className="ep-q__text"><strong>{globalIdx + 1}.</strong> {q.prompt}</p>
            <textarea className="ep-q__essay" rows={10} placeholder="Write your response here…"
              value={String(answers[q.id] ?? "")} onChange={(e) => setAnswer(q.id, e.target.value)} />
          </>
        ) : null}

        {q.question_type === "speaking_prompt" ? (
          <>
            <p className="ep-q__text"><strong>{globalIdx + 1}.</strong> {q.prompt}</p>
            <p className="ep-q__speaking-note">🎤 Speaking prompt — respond verbally in a real exam.</p>
          </>
        ) : null}
      </div>
    );
  };

  /* ── Main exam UI ────────────── */
  return (
    <div className="ep">
      {/* Top bar */}
      <header className="ep-top">
        <div className="ep-top__left">
          <span className="ep-top__logo">IELTS Pro</span>
        </div>
        <div className="ep-top__center">
          <Clock size={15} />
          <span className="ep-top__remaining">
            <strong>{minsLeft}</strong> minutes remaining
          </span>
        </div>
        <div className="ep-top__right">
          <button className="ep-top__submit" onClick={() => setShowConfirm(true)} disabled={submitting}>
            Submit <Send size={13} />
          </button>
        </div>
      </header>

      {/* Timer bar */}
      <div className="ep-timerbar">
        <span className={`ep-timerbar__time${timeIsLow ? " ep-timerbar__time--low" : ""}`}>{timeDisplay}</span>
        <div className="ep-timerbar__track">
          <div className="ep-timerbar__fill" style={{ width: `${timePct}%` }} />
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm ? (
        <div className="ep-modal-backdrop" onClick={() => setShowConfirm(false)}>
          <div className="ep-modal ep-fade-in" onClick={(e) => e.stopPropagation()}>
            <h2>Submit Exam?</h2>
            <p>
              You answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
              {answeredCount < questions.length ? <> <strong>{questions.length - answeredCount}</strong> unanswered will be marked wrong.</> : null}
            </p>
            <div className="ep-modal__actions">
              <button className="btn btn-outline" onClick={() => setShowConfirm(false)}>Continue Exam</button>
              <button className="btn btn-primary btn-topbar-cta" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting…" : "Confirm Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main body: questions left + navigator right */}
      <div className="ep-body">
        {/* LEFT: scrollable content */}
        {isReading ? (
          /* ── Reading: split-pane (passage left, questions right) ── */
          <div className="ep-reading-split">
            {/* LEFT: Passage */}
            <div className="ep-reading-split__passage">
              <div className="ep-reading-split__passage-inner">
                <p className="ep-reading-split__part-label ep-slide-up">{readingSectionLabel.toUpperCase()} {currentPartInfo.part}</p>
                <h2 className="ep-reading-split__title ep-slide-up">Reading {readingSectionLabel} {currentPartInfo.part}</h2>
                {(() => {
                  const passages = exam.structure_json?.reading_passages ?? [];
                  const passage = passages.find((p) => p.part === currentPartInfo.part);
                  if (!passage) return <p style={{ color: "var(--muted)" }}>No {readingSectionLabel.toLowerCase()} text available.</p>;
                  return (
                    <>
                      {passage.image_url ? (
                        <img src={passage.image_url} alt="" className="ep-reading-split__img ep-slide-up" />
                      ) : null}
                      {passage.title ? (
                        <h3 className="ep-reading-split__passage-title ep-slide-up">{passage.title}</h3>
                      ) : null}
                      <div className="ep-reading-split__text ep-slide-up">{passage.text}</div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* DIVIDER */}
            <div className="ep-reading-split__divider" />

            {/* RIGHT: Questions */}
            <div className="ep-reading-split__questions" ref={contentRef}>
              <div className="ep-reading-split__questions-inner">
                <p className="ep-part-range ep-slide-up" style={{ marginTop: 0 }}>
                  Questions {currentPartInfo.startIndex + 1}–{currentPartInfo.startIndex + currentPartInfo.questions.length}
                </p>
                <div className="ep-q-list">
                  {currentPartInfo.questions.map((q, i) =>
                    renderQuestion(q, currentPartInfo.startIndex + i)
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : isWriting ? (
          /* ── Writing: split-pane (task/image left, textarea right) ── */
          <div className="ep-reading-split">
            {/* LEFT: Task prompt + image */}
            <div className="ep-reading-split__passage">
              <div className="ep-reading-split__passage-inner">
                <p className="ep-reading-split__part-label ep-slide-up">WRITING TASK {currentPartInfo.part}</p>
                <h2 className="ep-reading-split__title ep-slide-up">
                  {currentPartInfo.part === 1 ? "Writing Task 1" : "Writing Task 2"}
                </h2>
                {(() => {
                  const tasks = exam.structure_json?.writing_tasks ?? [];
                  const task = tasks.find((t) => t.part === currentPartInfo.part);
                  if (!task) return <p style={{ color: "var(--muted)" }}>No task prompt available.</p>;
                  return (
                    <>
                      {task.image_url ? (
                        <img src={task.image_url} alt="Writing task visual" className="ep-reading-split__img ep-slide-up" />
                      ) : null}
                      <div className="ep-reading-split__text ep-slide-up" style={{ lineHeight: "1.8" }}>
                        {task.prompt}
                      </div>
                      {task.min_words ? (
                        <p className="ep-writing-min-words ep-slide-up">
                          Write at least <strong>{task.min_words}</strong> words.
                        </p>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* DIVIDER */}
            <div className="ep-reading-split__divider" />

            {/* RIGHT: Textarea + Word counter */}
            <div className="ep-reading-split__questions" ref={contentRef}>
              <div className="ep-reading-split__questions-inner">
                {currentPartInfo.questions.length > 0 ? (
                  currentPartInfo.questions.map((q) => {
                    const text = String(answers[q.id] ?? "");
                    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
                    const task = (exam.structure_json?.writing_tasks ?? []).find((t) => t.part === currentPartInfo.part);
                    const minWords = task?.min_words ?? (currentPartInfo.part === 1 ? 150 : 250);
                    return (
                      <div key={q.id} className="ep-writing-area ep-slide-up">
                        <textarea
                          className="ep-writing-area__input"
                          placeholder={`Write your ${currentPartInfo.part === 1 ? "report" : "essay"} here…`}
                          value={text}
                          onChange={(e) => setAnswer(q.id, e.target.value)}
                          rows={20}
                        />
                        <div className="ep-writing-area__footer">
                          <span className={`ep-writing-area__count${wordCount >= minWords ? " ep-writing-area__count--ok" : ""}`}>
                            {wordCount} {wordCount === 1 ? "word" : "words"}
                          </span>
                          <span className="ep-writing-area__target">
                            Target: {minWords}+ words
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="ep-writing-area ep-slide-up">
                    <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
                      No questions assigned to this task yet. Add a writing question in admin.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── Listening / other: single-column ── */
          <div className="ep-content" ref={contentRef}>
            <div className="ep-content__inner">
              <h2 className="ep-part-title ep-slide-up">{currentPartInfo.module === "speaking" ? "Speaking" : `Part ${currentPartInfo.part}`}</h2>

              {/* Audio player for this part (listening) */}
              {isListening && getAudioForPart(currentPartInfo.part) ? (
                <div className="ep-listen-bar ep-slide-up">
                  <span className="ep-listen-bar__label">
                    Questions {currentPartInfo.startIndex + 1}–{currentPartInfo.startIndex + currentPartInfo.questions.length}
                  </span>
                  <button className="ep-listen-bar__btn" onClick={() => toggleAudio(currentPartInfo.part)} type="button">
                    {playingPart === currentPartInfo.part ? <Pause size={14} /> : <Play size={14} />}
                    {playingPart === currentPartInfo.part ? "Pause" : "Listen from here"}
                  </button>
                  <audio
                    ref={(el) => { audioRefs.current[currentPartInfo.part] = el; }}
                    src={getAudioForPart(currentPartInfo.part)!.url}
                    preload="auto"
                    onTimeUpdate={(e) => {
                      const a = e.currentTarget;
                      if (a.duration) setAudioProgress((prev) => ({ ...prev, [currentPartInfo.part]: (a.currentTime / a.duration) * 100 }));
                    }}
                    onEnded={() => setPlayingPart(null)}
                  />
                  <div className="ep-listen-bar__progress">
                    <div className="ep-listen-bar__progress-fill" style={{ width: `${audioProgress[currentPartInfo.part] ?? 0}%` }} />
                  </div>
                </div>
              ) : (
                <p className="ep-part-range ep-slide-up">
                  Questions {currentPartInfo.startIndex + 1}–{currentPartInfo.startIndex + currentPartInfo.questions.length}
                </p>
              )}

              <div className="ep-q-list">
                {currentPartInfo.questions.map((q, i) =>
                  renderQuestion(q, currentPartInfo.startIndex + i)
                )}
              </div>
            </div>
          </div>
        )}

        {/* Toggle button for navigator panel — always visible */}
        <button
          className={`ep-nav-panel__toggle${navCollapsed ? " ep-nav-panel__toggle--collapsed" : ""}`}
          onClick={() => setNavCollapsed((c) => !c)}
          type="button"
          title={navCollapsed ? "Show questions panel" : "Hide questions panel"}
        >
          {navCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* RIGHT: question navigator panel */}
        <aside className={`ep-nav-panel${navCollapsed ? " ep-nav-panel--collapsed" : ""}`}>
          <h3 className="ep-nav-panel__title">Questions</h3>
          <div className="ep-nav-panel__grid">
            {currentPartInfo.questions.map((q, i) => {
              const gIdx = currentPartInfo.startIndex + i;
              const isAnswered = answers[q.id] !== undefined;
              return (
                <button
                  key={q.id}
                  className={`ep-nav-panel__dot${isAnswered ? " ep-nav-panel__dot--done" : ""}`}
                  onClick={() => scrollToQuestion(gIdx)}
                  type="button"
                >
                  {gIdx + 1}
                </button>
              );
            })}
          </div>
          <div className="ep-nav-panel__legend">
            <span><span className="ep-lg ep-lg--done" /> Answered</span>
            <span><span className="ep-lg" /> Unanswered</span>
          </div>
          <div className="ep-nav-panel__summary">
            {answeredInPart(currentPartInfo.questions)} / {currentPartInfo.questions.length} answered
          </div>
        </aside>
      </div>

      {/* Page nav arrows */}
      <div className="ep-page-nav">
        <button className="ep-page-nav__btn" disabled={activePart <= 1} onClick={() => goToPart(activePart - 1)}>
          <ChevronLeft size={20} />
        </button>
        <button className="ep-page-nav__btn" disabled={activePart >= parts.length} onClick={() => goToPart(activePart + 1)}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Bottom part tabs */}
      <nav className="ep-parts">
        {parts.map((p, idx) => {
          const tabIdx = idx + 1;
          const isActive = tabIdx === activePart;
          const answered = answeredInPart(p.questions);
          const hasAudio = p.module === "listening" && !!getAudioForPart(p.part);
          const tabLabel = p.module === "reading" ? `Passage ${p.part}`
            : p.module === "writing" ? `Task ${p.part}`
            : p.module === "speaking" ? "Speaking"
            : `Part ${p.part}`;
          return (
            <button
              key={`${p.module}-${p.part}`}
              className={`ep-parts__tab${isActive ? " ep-parts__tab--active" : ""}`}
              onClick={() => goToPart(tabIdx)}
              type="button"
            >
              <span className="ep-parts__label">
                {tabLabel}
                {hasAudio && playingPart === p.part ? <Volume2 size={11} className="ep-parts__audio-icon" /> : null}
              </span>
              {isActive ? (
                <span className="ep-parts__nums">
                  {p.questions.map((q, i) => {
                    const gIdx = p.startIndex + i + 1;
                    const isDone = answers[q.id] !== undefined;
                    return (
                      <span
                        key={gIdx}
                        className={`ep-parts__dot${isDone ? " ep-parts__dot--done" : ""}`}
                        onClick={(e) => { e.stopPropagation(); scrollToQuestion(p.startIndex + i); }}
                      >
                        {gIdx}
                      </span>
                    );
                  })}
                </span>
              ) : (
                <span className="ep-parts__count">
                  {answered} of {p.questions.length} questions
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
