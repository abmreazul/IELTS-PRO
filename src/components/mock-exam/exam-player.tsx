"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitExamAttempt } from "@/app/(site)/mock-exam/actions";
import {
  coerceTestVariant,
  getReadingSectionLabel,
  getWritingTaskPromptPlaceholder,
  getWritingTaskTitle,
  normalizeExamModules,
} from "@/lib/exam/ielts-defaults";
import { Clock, Send, Volume2, Pause, Play, ChevronLeft, ChevronRight, Headphones, BookOpen, PenLine, Check } from "lucide-react";

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
  listening_audio_json?: { url: string; title?: string } | { part: number; url: string; title?: string }[] | null;
  structure_json?: {
    exam_meta?: { test_variant?: "academic" | "general" };
    reading_passages?: { part: number; title: string; text: string; image_url?: string }[];
    writing_tasks?: { part: number; prompt: string; image_url?: string; min_words?: number }[];
    speaking?: {
      part1?: { topic_title?: string; prompts?: string[]; audio_url?: string };
      part2?: { cue_card?: string; bullet_points?: string[]; follow_up_prompt?: string; audio_url?: string };
      part3?: { topic_title?: string; prompts?: string[]; audio_url?: string };
    };
  } | null;
};

type Props = {
  exam: ExamData;
  questions: ExamQuestion[];
  attemptId: string;
};

type AnswerMap = Record<string, unknown>;
type SubmitResult = {
  overallBand: number | null;
  moduleBands: Record<string, number | null>;
  reviewPendingModules: string[];
};

const MODULE_LABELS: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
};

const MODULE_ICONS: Record<string, typeof Headphones> = {
  listening: Headphones,
  reading: BookOpen,
  writing: PenLine,
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

type ListeningClip = { part: number; url: string; title: string };
type ListeningAudioSource =
  | { mode: "none" }
  | { mode: "master"; asset: { url: string; title: string } }
  | { mode: "legacy"; clips: ListeningClip[] };

const MODULE_PART_COUNTS: Record<string, number> = {
  listening: 4,
  reading: 3,
  writing: 2,
};

const MODULE_ORDER = ["listening", "reading", "writing"];

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

function parseListeningAudioSource(raw: ExamData["listening_audio_json"]): ListeningAudioSource {
  if (!raw) return { mode: "none" };
  if (Array.isArray(raw)) {
    const clips = raw
      .map((row) => ({
        part: Math.max(1, Math.min(4, Math.floor(Number(row?.part)) || 1)),
        url: String(row?.url ?? "").trim(),
        title: String(row?.title ?? "").trim() || `Part ${Math.max(1, Math.min(4, Math.floor(Number(row?.part)) || 1))}`,
      }))
      .filter((row) => row.url)
      .sort((a, b) => a.part - b.part);
    return clips.length > 0 ? { mode: "legacy", clips } : { mode: "none" };
  }
  const url = String(raw.url ?? "").trim();
  if (!url) return { mode: "none" };
  return {
    mode: "master",
    asset: {
      url,
      title: String(raw.title ?? "").trim() || "IELTS Listening Paper",
    },
  };
}

function getPartLabel(module: string, part: number, readingSectionLabel: "Passage" | "Section") {
  if (module === "reading") return `${readingSectionLabel} ${part}`;
  if (module === "writing") return `Task ${part}`;
  return `Part ${part}`;
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
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  // Audio
  const masterAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({});
  const [playingPart, setPlayingPart] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<number, number>>({});
  const [pendingAutoplayPart, setPendingAutoplayPart] = useState<number | null>(null);
  const [listeningStarted, setListeningStarted] = useState(false);
  const [completedListeningParts, setCompletedListeningParts] = useState<number[]>([]);
  const [masterAudioPlaying, setMasterAudioPlaying] = useState(false);
  const [masterAudioProgress, setMasterAudioProgress] = useState(0);
  const [masterAudioEnded, setMasterAudioEnded] = useState(false);
  const [furthestListeningPart, setFurthestListeningPart] = useState(1);

  const contentRef = useRef<HTMLDivElement>(null);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [trayCollapsed, setTrayCollapsed] = useState(false);
  const activeModules = useMemo(() => normalizeExamModules(exam.modules), [exam.modules]);
  const [expandedModule, setExpandedModule] = useState<string>(activeModules[0] ?? "listening");

  const totalSeconds = exam.duration_minutes * 60;
  const handleTimeEnd = useCallback(() => {
    if (!submitted) handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const { display: timeDisplay, pct: timePct, isLow: timeIsLow, minutes: minsLeft } = useCountdown(totalSeconds, handleTimeEnd);

  const visibleQuestions = useMemo(
    () => questions.filter((question) => activeModules.includes(question.module as "listening" | "reading" | "writing")),
    [activeModules, questions],
  );
  const parts = useMemo(() => groupByPart(visibleQuestions, activeModules), [activeModules, visibleQuestions]);
  const currentPartInfo = parts[activePart - 1] ?? parts[0];
  const answeredCount = Object.keys(answers).length;
  const isReading = currentPartInfo.module === "reading";
  const isListening = currentPartInfo.module === "listening";
  const isWriting = currentPartInfo.module === "writing";
  const readingVariant = coerceTestVariant(exam.structure_json?.exam_meta?.test_variant);
  const readingSectionLabel = getReadingSectionLabel(readingVariant);
  const listeningAudioSource = useMemo(
    () => parseListeningAudioSource(exam.listening_audio_json),
    [exam.listening_audio_json],
  );
  const moduleGroups = useMemo(
    () =>
      MODULE_ORDER.filter((module) => activeModules.includes(module as "listening" | "reading" | "writing")).map((module) => ({
        module,
        items: parts
          .map((part, idx) => ({ ...part, tabIndex: idx + 1 }))
          .filter((part) => part.module === module),
      })),
    [activeModules, parts],
  );
  const currentModuleParts = useMemo(
    () => parts
      .map((part, idx) => ({ ...part, tabIndex: idx + 1 }))
      .filter((part) => part.module === currentPartInfo.module),
    [currentPartInfo.module, parts],
  );
  const isMasterListeningAudio = listeningAudioSource.mode === "master";

  // Get audio for a specific part
  const getAudioForPart = (partNum: number) => {
    if (listeningAudioSource.mode !== "legacy") return null;
    return listeningAudioSource.clips.find((a) => a.part === partNum) ?? null;
  };

  const listeningTabIndices = useMemo(
    () => parts
      .map((part, idx) => ({ idx: idx + 1, part }))
      .filter(({ part }) => part.module === "listening"),
    [parts],
  );
  const listeningPartNumbers = useMemo(
    () => listeningTabIndices.map(({ part }) => part.part),
    [listeningTabIndices],
  );
  const listeningFinished = isMasterListeningAudio
    ? masterAudioEnded
    : listeningPartNumbers.length > 0
      && listeningPartNumbers.every((partNum) => completedListeningParts.includes(partNum));

  const stopListeningAudio = useCallback(() => {
    masterAudioRef.current?.pause();
    for (const audio of Object.values(audioRefs.current)) {
      audio?.pause();
    }
    setPlayingPart(null);
    setPendingAutoplayPart(null);
    setMasterAudioPlaying(false);
  }, []);

  const getNextListeningTab = useCallback((partNum: number) => {
    const current = listeningTabIndices.find(({ part }) => part.part === partNum);
    if (!current) return null;
    return listeningTabIndices.find(({ idx }) => idx === current.idx + 1) ?? null;
  }, [listeningTabIndices]);

  const canNavigateToPart = useCallback((targetPartIndex: number) => {
    const targetPart = parts[targetPartIndex - 1];
    if (!targetPart) return false;
    return true;
  }, [parts]);

  const setAnswer = (questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const goToPart = (part: number) => {
    if (!canNavigateToPart(part)) return;
    const targetPart = parts[part - 1];
    const shouldKeepMasterAudioPlaying =
      isMasterListeningAudio &&
      currentPartInfo.module === "listening" &&
      targetPart?.module === "listening";
    if (!shouldKeepMasterAudioPlaying) {
      stopListeningAudio();
    }
    setActivePart(part);
    if (isMasterListeningAudio && targetPart?.module === "listening") {
      setFurthestListeningPart((prev) => Math.max(prev, targetPart.part));
    }
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
      setResult(res.result);
    } else {
      alert(res.message);
    }
  };

  const toggleAudio = async (partNum: number) => {
    if (isMasterListeningAudio) {
      const audio = masterAudioRef.current;
      if (!audio || currentPartInfo.module !== "listening" || masterAudioEnded) return;
      if (masterAudioPlaying) {
        audio.pause();
        setMasterAudioPlaying(false);
      } else {
        try {
          setListeningStarted(true);
          setFurthestListeningPart((prev) => Math.max(prev, currentPartInfo.part));
          await audio.play();
          setMasterAudioPlaying(true);
        } catch {
          setMasterAudioPlaying(false);
        }
      }
      return;
    }

    const audio = audioRefs.current[partNum];
    if (!audio) return;
    if (completedListeningParts.includes(partNum)) return;
    if (partNum !== currentPartInfo.part || currentPartInfo.module !== "listening") return;

    // If another part's audio is playing, pause it first
    if (playingPart !== null && playingPart !== partNum) {
      audioRefs.current[playingPart]?.pause();
    }

    if (playingPart === partNum) {
      audio.pause();
      setPlayingPart(null);
      setPendingAutoplayPart(null);
    } else {
      try {
        setListeningStarted(true);
        await audio.play();
        setPlayingPart(partNum);
      } catch {
        setPlayingPart(null);
      }
    }
  };

  useEffect(() => {
    if (isMasterListeningAudio) return;
    if (!pendingAutoplayPart || currentPartInfo.module !== "listening" || currentPartInfo.part !== pendingAutoplayPart) {
      return;
    }
    const audio = audioRefs.current[pendingAutoplayPart];
    if (!audio) return;

    audio.currentTime = 0;
    void audio.play()
      .then(() => {
        setPlayingPart(pendingAutoplayPart);
        setPendingAutoplayPart(null);
      })
      .catch(() => {
        setPlayingPart(null);
      });
  }, [currentPartInfo.module, currentPartInfo.part, isMasterListeningAudio, pendingAutoplayPart]);

  useEffect(() => stopListeningAudio, [stopListeningAudio]);

  const answeredInPart = (partQuestions: ExamQuestion[]) =>
    partQuestions.filter((q) => answers[q.id] !== undefined).length;

  const isPartFinished = useCallback(
    (partQuestions: ExamQuestion[]) => partQuestions.length > 0 && answeredInPart(partQuestions) === partQuestions.length,
    [answers],
  );

  const isModuleFinished = useCallback(
    (module: string) => {
      const moduleQuestions = visibleQuestions.filter((question) => question.module === module);
      return moduleQuestions.length > 0 && moduleQuestions.every((question) => answers[question.id] !== undefined);
    },
    [answers, visibleQuestions],
  );

  /* ── Results screen ────────────── */
  if (submitted && result) {
    const reviewPending = result.reviewPendingModules.length > 0;
    return (
      <div className="ep-results">
        <div className="ep-results__card ep-fade-in">
          <div className="ep-results__badge">✓</div>
          <h1 className="ep-results__title">{reviewPending ? "Submission Received" : "Exam Completed!"}</h1>
          <p className="ep-results__sub">{exam.title}</p>
          {reviewPending ? (
            <div className="ep-results__stats" style={{ marginBottom: "1rem" }}>
              <div>
                <span>Review status</span>
                <strong>{result.reviewPendingModules.map((mod) => MODULE_LABELS[mod] ?? mod).join(" + ")} pending review</strong>
              </div>
            </div>
          ) : null}
          {result.overallBand != null ? (
            <div className="ep-results__band-main">
              <span className="ep-results__band-label">Overall Band Score</span>
              <span className="ep-results__band-value">{result.overallBand.toFixed(1)}</span>
            </div>
          ) : null}
          <div className="ep-results__modules">
            {Object.entries(result.moduleBands).map(([mod, band]) => (
              <div key={mod} className="ep-results__module">
                <span>{MODULE_LABELS[mod] ?? mod}</span>
                <strong>{band != null ? band.toFixed(1) : "Pending review"}</strong>
              </div>
            ))}
          </div>
          <div className="ep-results__stats">
            <div><span>Questions Answered</span><strong>{answeredCount} / {visibleQuestions.length}</strong></div>
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
                  <label
                    key={i}
                    className={`ep-q__radio${selected ? " ep-q__radio--sel" : ""}`}
                    onClick={() => setAnswer(q.id, selected ? undefined : i)}
                  >
                    <input type="radio" name={`q-${q.id}`} checked={selected} onChange={() => setAnswer(q.id, selected ? undefined : i)} />
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

      </div>
    );
  };

  /* ── Main exam UI ────────────── */
  return (
    <div className="ep">
      {/* Top bar */}
      <header className="ep-top">
        <div className="ep-top__timer">
          <Clock size={15} />
          <span className={`ep-top__time${timeIsLow ? " ep-top__time--low" : ""}`}>{timeDisplay}</span>
        </div>
        <div className="ep-top__track">
          <div className="ep-top__fill" style={{ width: `${timePct}%` }} />
        </div>
        <div className="ep-top__right">
          <button className="ep-top__submit" onClick={() => setShowConfirm(true)} disabled={submitting}>
            Submit <Send size={13} />
          </button>
        </div>
      </header>

      {/* Confirm modal */}
      {showConfirm ? (
        <div className="ep-modal-backdrop" onClick={() => setShowConfirm(false)}>
          <div className="ep-modal ep-fade-in" onClick={(e) => e.stopPropagation()}>
            <h2>Submit Exam?</h2>
            <p>
              You answered <strong>{answeredCount}</strong> of <strong>{visibleQuestions.length}</strong> questions.
              {answeredCount < visibleQuestions.length ? <> <strong>{visibleQuestions.length - answeredCount}</strong> unanswered will be marked wrong.</> : null}
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
                  {getWritingTaskTitle(readingVariant, currentPartInfo.part)}
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
                          placeholder={getWritingTaskPromptPlaceholder(readingVariant, currentPartInfo.part)}
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
              <h2 className="ep-part-title ep-slide-up">{`Part ${currentPartInfo.part}`}</h2>

              {/* Audio player for this part */}
              {isListening && getAudioForPart(currentPartInfo.part) ? (
                <div className="ep-listen-bar ep-slide-up">
                  <span className="ep-listen-bar__label">
                    <Volume2 size={15} />
                    IELTS Listening Paper
                  </span>
                  <span className="ep-listen-bar__meta">
                    Part {currentPartInfo.part} of 4
                    <span className="ep-listen-bar__meta-divider">•</span>
                    Questions {currentPartInfo.startIndex + 1}–{currentPartInfo.startIndex + currentPartInfo.questions.length}
                  </span>
                  <div className="ep-listen-bar__controls">
                    <button className="ep-listen-bar__btn" onClick={() => void toggleAudio(currentPartInfo.part)} type="button">
                      {playingPart === currentPartInfo.part ? <Pause size={14} /> : <Play size={14} />}
                      {playingPart === currentPartInfo.part ? "Pause paper" : currentPartInfo.part === 1 ? "Start paper" : `Play Part ${currentPartInfo.part}`}
                    </button>
                    <div className="ep-listen-bar__progress">
                      <div className="ep-listen-bar__progress-fill" style={{ width: `${audioProgress[currentPartInfo.part] ?? 0}%` }} />
                    </div>
                  </div>
                  <audio
                    ref={(el) => { audioRefs.current[currentPartInfo.part] = el; }}
                    src={getAudioForPart(currentPartInfo.part)!.url}
                    preload="auto"
                    onTimeUpdate={(e) => {
                      const a = e.currentTarget;
                      if (a.duration) setAudioProgress((prev) => ({ ...prev, [currentPartInfo.part]: (a.currentTime / a.duration) * 100 }));
                    }}
                    onEnded={() => {
                      setCompletedListeningParts((prev) =>
                        prev.includes(currentPartInfo.part) ? prev : [...prev, currentPartInfo.part],
                      );

                      const nextListeningTab = getNextListeningTab(currentPartInfo.part);
                      if (!nextListeningTab) {
                        setPlayingPart(null);
                        setPendingAutoplayPart(null);
                        const nextOverallPart = parts[activePart];
                        if (nextOverallPart) {
                          setActivePart(activePart + 1);
                          contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                        }
                        return;
                      }

                      setPendingAutoplayPart(nextListeningTab.part.part);
                      setActivePart(nextListeningTab.idx);
                      contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  />
                </div>
              ) : isListening && listeningAudioSource.mode === "master" ? (
                <div className="ep-listen-bar ep-slide-up">
                  <span className="ep-listen-bar__label">
                    <Volume2 size={15} />
                    {listeningAudioSource.asset.title}
                  </span>
                  <span className="ep-listen-bar__meta">
                    Part {currentPartInfo.part} of 4
                    <span className="ep-listen-bar__meta-divider">•</span>
                    Questions {currentPartInfo.startIndex + 1}–{currentPartInfo.startIndex + currentPartInfo.questions.length}
                  </span>
                  <div className="ep-listen-bar__controls">
                    <button className="ep-listen-bar__btn" onClick={() => void toggleAudio(currentPartInfo.part)} type="button">
                      {masterAudioPlaying ? <Pause size={14} /> : <Play size={14} />}
                      {masterAudioPlaying ? "Pause paper" : "Start paper"}
                    </button>
                    <div className="ep-listen-bar__progress">
                      <div className="ep-listen-bar__progress-fill" style={{ width: `${masterAudioProgress}%` }} />
                    </div>
                  </div>
                  <audio
                    ref={masterAudioRef}
                    src={listeningAudioSource.asset.url}
                    preload="auto"
                    onTimeUpdate={(e) => {
                      const audio = e.currentTarget;
                      if (audio.duration) {
                        setMasterAudioProgress((audio.currentTime / audio.duration) * 100);
                      }
                    }}
                    onEnded={() => {
                      setMasterAudioPlaying(false);
                      setMasterAudioEnded(true);
                      const lastListeningPart = listeningTabIndices[listeningTabIndices.length - 1];
                      if (lastListeningPart) {
                        setFurthestListeningPart(lastListeningPart.part.part);
                        const nextOverallPart = parts[lastListeningPart.idx];
                        if (nextOverallPart) {
                          setActivePart(lastListeningPart.idx + 1);
                          contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }
                    }}
                  />
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
          <div className="ep-nav-panel__modules">
            {moduleGroups.map((group) => {
              const isActive = currentPartInfo.module === group.module;
              const isDone = isModuleFinished(group.module);
              const Icon = MODULE_ICONS[group.module] ?? BookOpen;
              return (
                <button
                  key={group.module}
                  type="button"
                  className={`ep-nav-panel__module-btn${isActive ? " ep-nav-panel__module-btn--active" : ""}${isDone ? " ep-nav-panel__module-btn--done" : ""}`}
                  onClick={() => group.items[0] && goToPart(group.items[0].tabIndex)}
                >
                  <span className="ep-nav-panel__module-btn-label">
                    <Icon size={14} />
                    {MODULE_LABELS[group.module] ?? group.module}
                  </span>
                  {isDone ? <Check size={14} className="ep-nav-panel__check" /> : null}
                </button>
              );
            })}
          </div>
          <div className="ep-nav-panel__sections">
            {currentModuleParts.map((part) => {
              const isActive = part.tabIndex === activePart;
              const isDone = isPartFinished(part.questions);
              return (
                <button
                  key={`${part.module}-${part.part}`}
                  type="button"
                  className={`ep-nav-panel__section-btn${isActive ? " ep-nav-panel__section-btn--active" : ""}${isDone ? " ep-nav-panel__section-btn--done" : ""}`}
                  onClick={() => goToPart(part.tabIndex)}
                >
                  <span className="ep-nav-panel__section-btn-label">
                    {getPartLabel(part.module, part.part, readingSectionLabel)}
                  </span>
                  {isDone ? <Check size={13} className="ep-nav-panel__check" /> : null}
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Page nav arrows */}
      <div className="ep-page-nav">
        <button className="ep-page-nav__btn" disabled={activePart <= 1 || !canNavigateToPart(activePart - 1)} onClick={() => goToPart(activePart - 1)}>
          <ChevronLeft size={20} />
        </button>
        <button className="ep-page-nav__btn" disabled={activePart >= parts.length || !canNavigateToPart(activePart + 1)} onClick={() => goToPart(activePart + 1)}>
          <ChevronRight size={20} />
        </button>
      </div>

    </div>
  );
}
