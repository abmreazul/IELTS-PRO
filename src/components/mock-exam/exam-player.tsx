"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitExamAttempt } from "@/app/(site)/mock-exam/actions";
import { Flag, ChevronLeft, ChevronRight, Clock, Send, Volume2, Pause, Play } from "lucide-react";

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
        if (r <= 1) {
          clearInterval(id);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [remaining, onEnd]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const pct = totalSeconds > 0 ? (remaining / totalSeconds) * 100 : 0;
  const isLow = remaining < 300; // last 5 minutes

  return { remaining, display, pct, isLow };
}

/* ═══════════════════════════════════════════════════════════════════
   ExamPlayer
   ═══════════════════════════════════════════════════════════════════ */

export function ExamPlayer({ exam, questions, attemptId }: Props) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ overallBand: number; moduleBands: Record<string, number> } | null>(null);
  const [showNav, setShowNav] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Audio state for listening
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  const totalSeconds = exam.duration_minutes * 60;

  const handleTimeEnd = useCallback(() => {
    if (!submitted) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const { display: timeDisplay, pct: timePct, isLow: timeIsLow } = useCountdown(totalSeconds, handleTimeEnd);

  const currentQuestion = questions[currentIndex];
  const options = Array.isArray(currentQuestion?.options_json) ? (currentQuestion.options_json as string[]) : [];
  const answeredCount = Object.keys(answers).length;

  // Current module
  const currentModule = currentQuestion?.module ?? "reading";

  // Audio for current listening part
  const listeningAudio = useMemo(() => {
    if (currentModule !== "listening" || !exam.listening_audio_json) return null;
    // Find the audio for the current question's part
    // Questions are in order, so we can determine part from sort_order
    const partIndex = Math.floor(currentIndex / 10); // ~10 questions per part
    const part = partIndex + 1;
    return exam.listening_audio_json.find((a) => a.part === part) ?? exam.listening_audio_json[0] ?? null;
  }, [currentModule, currentIndex, exam.listening_audio_json]);

  // Set answer
  const setAnswer = (questionId: string, value: string | number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  // Toggle flag
  const toggleFlag = (questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  // Navigate
  const goTo = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
      setShowNav(false);
    }
  };

  // Submit
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

  // Audio controls
  const toggleAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setAudioPlaying(!audioPlaying);
  };

  /* ── Results screen ────────────────── */
  if (submitted && result) {
    return (
      <div className="ep-results">
        <div className="ep-results__card">
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
            <div>
              <span>Questions Answered</span>
              <strong>{answeredCount} / {questions.length}</strong>
            </div>
            <div>
              <span>Correct</span>
              <strong>
                {Math.round(result.overallBand / 9 * questions.length)} / {questions.length}
              </strong>
            </div>
          </div>

          <div className="ep-results__actions">
            <button
              className="btn btn-primary btn-topbar-cta"
              onClick={() => router.push("/mock-exam")}
            >
              Back to Exams
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main exam UI ────────────────── */
  return (
    <div className="ep">
      {/* ── Top bar ────────────────── */}
      <header className="ep-header">
        <div className="ep-header__left">
          <h1 className="ep-header__title">{exam.title}</h1>
          <span className="ep-header__module">{MODULE_LABELS[currentModule]}</span>
        </div>
        <div className="ep-header__center">
          <div className={`ep-timer${timeIsLow ? " ep-timer--low" : ""}`}>
            <Clock size={16} />
            <span>{timeDisplay}</span>
          </div>
          <div className="ep-timer-bar">
            <div className="ep-timer-bar__fill" style={{ width: `${timePct}%` }} />
          </div>
        </div>
        <div className="ep-header__right">
          <span className="ep-header__progress">
            Q {currentIndex + 1} / {questions.length}
          </span>
          <button
            className="ep-header__nav-btn"
            onClick={() => setShowNav(!showNav)}
          >
            {showNav ? "Hide" : "Navigator"}
          </button>
          <button
            className="btn btn-primary btn-topbar-cta ep-submit-btn"
            onClick={() => setShowConfirm(true)}
            disabled={submitting}
          >
            <Send size={14} /> Submit
          </button>
        </div>
      </header>

      {/* ── Confirm modal ────────────────── */}
      {showConfirm ? (
        <div className="ep-modal-backdrop" onClick={() => setShowConfirm(false)}>
          <div className="ep-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Submit Exam?</h2>
            <p>
              You have answered <strong>{answeredCount}</strong> out of <strong>{questions.length}</strong> questions.
              {answeredCount < questions.length ? (
                <> <strong>{questions.length - answeredCount}</strong> questions are unanswered and will be marked wrong.</>
              ) : null}
            </p>
            <div className="ep-modal__actions">
              <button className="btn btn-outline" onClick={() => setShowConfirm(false)}>
                Continue Exam
              </button>
              <button
                className="btn btn-primary btn-topbar-cta"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Confirm Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Body ────────────────── */}
      <div className="ep-body">
        {/* Question area */}
        <div className="ep-question-area">
          {/* Listening audio */}
          {currentModule === "listening" && listeningAudio ? (
            <div className="ep-audio-bar">
              <button className="ep-audio-btn" onClick={toggleAudio} type="button">
                {audioPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <div className="ep-audio-info">
                <span className="ep-audio-title">
                  <Volume2 size={14} /> {listeningAudio.title || `Part ${listeningAudio.part}`}
                </span>
                <div className="ep-audio-progress">
                  <div className="ep-audio-progress__bar" style={{ width: `${audioProgress}%` }} />
                </div>
              </div>
              <audio
                ref={audioRef}
                src={listeningAudio.url}
                preload="auto"
                onTimeUpdate={() => {
                  const a = audioRef.current;
                  if (a && a.duration) {
                    setAudioProgress((a.currentTime / a.duration) * 100);
                  }
                }}
                onEnded={() => setAudioPlaying(false)}
              />
            </div>
          ) : null}

          {/* Question */}
          <div className="ep-question">
            <span className="ep-question__num">Question {currentIndex + 1}</span>
            <p className="ep-question__prompt">{currentQuestion?.prompt || "No question text."}</p>

            {/* MCQ options */}
            {(currentQuestion?.question_type === "multiple_choice" ||
              currentQuestion?.question_type === "multiple_choice_multi") && options.length > 0 ? (
              <div className="ep-options">
                {options.map((opt, i) => {
                  const selected = answers[currentQuestion.id] === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`ep-option${selected ? " ep-option--selected" : ""}`}
                      onClick={() => setAnswer(currentQuestion.id, i)}
                    >
                      <span className="ep-option__letter">{String.fromCharCode(65 + i)}</span>
                      <span className="ep-option__text">{opt}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* True / False / Not Given */}
            {(currentQuestion?.question_type === "true_false_not_given" ||
              currentQuestion?.question_type === "yes_no_not_given") ? (
              <div className="ep-options">
                {(currentQuestion.question_type === "true_false_not_given"
                  ? ["true", "false", "not_given"]
                  : ["yes", "no", "not_given"]
                ).map((opt) => {
                  const selected = answers[currentQuestion.id] === opt;
                  const label = opt.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`ep-option${selected ? " ep-option--selected" : ""}`}
                      onClick={() => setAnswer(currentQuestion.id, opt)}
                    >
                      <span className="ep-option__text">{label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Short answer / fill-in */}
            {(currentQuestion?.question_type === "fill_in_blank" ||
              currentQuestion?.question_type === "sentence_completion" ||
              currentQuestion?.question_type === "short_answer" ||
              currentQuestion?.question_type === "matching") ? (
              <div className="ep-fill">
                <input
                  className="ep-fill__input"
                  type="text"
                  placeholder="Type your answer…"
                  value={String(answers[currentQuestion.id] ?? "")}
                  onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
                  autoFocus
                />
              </div>
            ) : null}
          </div>

          {/* Bottom nav */}
          <div className="ep-bottom-nav">
            <button
              className="ep-nav-btn"
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
            >
              <ChevronLeft size={18} /> Previous
            </button>

            <button
              className={`ep-flag-btn${flagged.has(currentQuestion?.id) ? " ep-flag-btn--active" : ""}`}
              onClick={() => currentQuestion && toggleFlag(currentQuestion.id)}
              type="button"
            >
              <Flag size={16} /> {flagged.has(currentQuestion?.id) ? "Flagged" : "Flag"}
            </button>

            <button
              className="ep-nav-btn"
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex === questions.length - 1}
            >
              Next <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Question navigator panel */}
        <aside className={`ep-navigator${showNav ? " ep-navigator--visible" : ""}`}>
          <h3 className="ep-navigator__title">Questions</h3>
          <div className="ep-navigator__grid">
            {questions.map((q, i) => {
              let cls = "ep-nav-dot";
              if (i === currentIndex) cls += " ep-nav-dot--current";
              else if (answers[q.id] !== undefined) cls += " ep-nav-dot--answered";
              if (flagged.has(q.id)) cls += " ep-nav-dot--flagged";
              return (
                <button
                  key={q.id}
                  className={cls}
                  onClick={() => goTo(i)}
                  type="button"
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="ep-navigator__legend">
            <span><span className="ep-legend-dot ep-legend-dot--current" /> Current</span>
            <span><span className="ep-legend-dot ep-legend-dot--answered" /> Answered</span>
            <span><span className="ep-legend-dot ep-legend-dot--flagged" /> Flagged</span>
            <span><span className="ep-legend-dot" /> Unanswered</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
