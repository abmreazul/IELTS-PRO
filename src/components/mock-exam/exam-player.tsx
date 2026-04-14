"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitExamAttempt } from "@/app/(site)/mock-exam/actions";
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
  structure_json?: { reading_passages?: { part: number; title: string; text: string; image_url?: string }[] } | null;
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
  part: number;
  questions: ExamQuestion[];
  startIndex: number;
};

function groupByPart(questions: ExamQuestion[], modules: string[]): PartInfo[] {
  const isListening = modules.includes("listening");
  const isReading = modules.includes("reading") && !isListening;

  // Part-based modules: listening (4 parts), reading (3 parts)
  const partCount = isListening ? 4 : isReading ? 3 : 0;

  if (partCount > 0) {
    const partMap: Record<number, ExamQuestion[]> = {};
    for (let i = 1; i <= partCount; i++) partMap[i] = [];

    for (const q of questions) {
      const decodedPart = q.sort_order >= 100 ? Math.floor(q.sort_order / 100) : 1;
      const p = Math.max(1, Math.min(partCount, decodedPart));
      if (!partMap[p]) partMap[p] = [];
      partMap[p].push(q);
    }

    const parts: PartInfo[] = [];
    let runningIdx = 0;
    for (let p = 1; p <= partCount; p++) {
      const pQuestions = partMap[p] ?? [];
      parts.push({ part: p, questions: pQuestions, startIndex: runningIdx });
      runningIdx += pQuestions.length;
    }
    return parts;
  }

  // Non-part modules: single part
  if (questions.length === 0) {
    return [{ part: 1, questions: [], startIndex: 0 }];
  }
  return [{ part: 1, questions, startIndex: 0 }];
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

  const totalSeconds = exam.duration_minutes * 60;
  const handleTimeEnd = useCallback(() => {
    if (!submitted) handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const { display: timeDisplay, pct: timePct, isLow: timeIsLow, minutes: minsLeft } = useCountdown(totalSeconds, handleTimeEnd);

  const parts = useMemo(() => groupByPart(questions, exam.modules), [questions, exam.modules]);
  const currentPartInfo = parts.find((p) => p.part === activePart) ?? parts[0];
  const answeredCount = Object.keys(answers).length;
  const isReading = exam.modules.includes("reading") && !exam.modules.includes("listening");

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
        {/* LEFT: scrollable questions */}
        <div className="ep-content" ref={contentRef}>
          <div className="ep-content__inner">
            <h2 className="ep-part-title ep-slide-up">
              {isReading ? `Passage ${activePart}` : `Part ${activePart}`}
            </h2>

            {/* Reading passage text */}
            {isReading && (() => {
              const passages = exam.structure_json?.reading_passages ?? [];
              const passage = passages.find((p) => p.part === activePart);
              if (!passage) return null;
              return (
                <div className="ep-passage ep-slide-up">
                  {passage.title ? <h3 className="ep-passage__title">{passage.title}</h3> : null}
                  {passage.image_url ? (
                    <img src={passage.image_url} alt="" className="ep-passage__img" />
                  ) : null}
                  <div className="ep-passage__text">{passage.text}</div>
                </div>
              );
            })()}

            {/* Audio player for this part (listening) */}
            {getAudioForPart(activePart) ? (
              <div className="ep-listen-bar ep-slide-up">
                <span className="ep-listen-bar__label">
                  Questions {currentPartInfo.startIndex + 1}–{currentPartInfo.startIndex + currentPartInfo.questions.length}
                </span>
                <button className="ep-listen-bar__btn" onClick={() => toggleAudio(activePart)} type="button">
                  {playingPart === activePart ? <Pause size={14} /> : <Play size={14} />}
                  {playingPart === activePart ? "Pause" : "Listen from here"}
                </button>
                <audio
                  ref={(el) => { audioRefs.current[activePart] = el; }}
                  src={getAudioForPart(activePart)!.url}
                  preload="auto"
                  onTimeUpdate={(e) => {
                    const a = e.currentTarget;
                    if (a.duration) setAudioProgress((prev) => ({ ...prev, [activePart]: (a.currentTime / a.duration) * 100 }));
                  }}
                  onEnded={() => setPlayingPart(null)}
                />
                {/* Audio progress */}
                <div className="ep-listen-bar__progress">
                  <div className="ep-listen-bar__progress-fill" style={{ width: `${audioProgress[activePart] ?? 0}%` }} />
                </div>
              </div>
            ) : !isReading ? (
              <p className="ep-part-range ep-slide-up">
                Questions {currentPartInfo.startIndex + 1}–{currentPartInfo.startIndex + currentPartInfo.questions.length}
              </p>
            ) : (
              <p className="ep-part-range ep-slide-up">
                Questions {currentPartInfo.startIndex + 1}–{currentPartInfo.startIndex + currentPartInfo.questions.length}
              </p>
            )}

            {/* Questions */}
            <div className="ep-q-list">
              {currentPartInfo.questions.map((q, i) =>
                renderQuestion(q, currentPartInfo.startIndex + i)
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: question navigator panel */}
        <aside className="ep-nav-panel">
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
        {parts.map((p) => {
          const isActive = p.part === activePart;
          const answered = answeredInPart(p.questions);
          const hasAudio = !!getAudioForPart(p.part);
          return (
            <button
              key={p.part}
              className={`ep-parts__tab${isActive ? " ep-parts__tab--active" : ""}`}
              onClick={() => goToPart(p.part)}
              type="button"
            >
              <span className="ep-parts__label">
                Part {p.part}
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
