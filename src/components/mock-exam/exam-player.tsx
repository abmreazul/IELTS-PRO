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
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Headphones,
  Pause,
  PenLine,
  Play,
  Send,
  Sparkles,
  Volume2,
} from "lucide-react";

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
    question_media?: { module: string; part: number; index: number; image_url: string }[];
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
  aiWritingReview: {
    overall_band: number;
    summary: string;
    strengths: string[];
    improvements: string[];
    tasks: {
      part: number;
      estimated_band: number;
      word_count: number;
      criterion_scores: { task_response: number; coherence: number; lexical: number; grammar: number };
      feedback: { task_response: string; coherence: string; lexical: string; grammar: string };
    }[];
  } | null;
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

type ExamDraft = {
  answers: AnswerMap;
  activePart: number;
  expandedModule: string;
  savedAt: number;
};

function getExamDraftKey(examId: string) {
  return `ielts-exam-draft:${examId}`;
}

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
  const [submitError, setSubmitError] = useState<string | null>(null);
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
  const [audioBoost, setAudioBoost] = useState(100);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodesRef = useRef(new WeakMap<HTMLAudioElement, GainNode>());
  const sourceNodesRef = useRef(new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>());
  const boostUnsupportedRef = useRef(new WeakSet<HTMLAudioElement>());
  const autoplayAttemptedPartsRef = useRef(new Set<number>());
  const masterAutoplayAttemptedRef = useRef(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [trayCollapsed, setTrayCollapsed] = useState(false);
  const activeModules = useMemo(() => normalizeExamModules(exam.modules), [exam.modules]);
  const [expandedModule, setExpandedModule] = useState<string>(activeModules[0] ?? "listening");
  const hydratedDraftRef = useRef(false);

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
  const questionMedia = useMemo(() => {
    const rows = exam.structure_json?.question_media;
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const value = row as Record<string, unknown>;
        const module = String(value.module ?? "").trim();
        const part = Math.floor(Number(value.part) || 0);
        const index = Math.floor(Number(value.index) || -1);
        const image_url = String(value.image_url ?? "").trim();
        if (!module || part < 1 || index < 0 || !image_url) return null;
        return { module, part, index, image_url };
      })
      .filter((row): row is { module: string; part: number; index: number; image_url: string } => Boolean(row));
  }, [exam.structure_json?.question_media]);
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

  const getPlayableAudioSrc = useCallback((src: string) => {
    if (!src || typeof window === "undefined") return src;
    try {
      const parsed = new URL(src, window.location.origin);
      if (parsed.origin === window.location.origin) return parsed.toString();
      return `/api/audio-proxy?src=${encodeURIComponent(parsed.toString())}`;
    } catch {
      return src;
    }
  }, []);

  const ensureAudioGainNode = useCallback((audio: HTMLAudioElement) => {
    if (typeof window === "undefined") return null;
    if (boostUnsupportedRef.current.has(audio)) return null;
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextCtor();
      }

      const context = audioContextRef.current;
      let source = sourceNodesRef.current.get(audio);
      if (!source) {
        source = context.createMediaElementSource(audio);
        sourceNodesRef.current.set(audio, source);
      }

      let gainNode = gainNodesRef.current.get(audio);
      if (!gainNode) {
        gainNode = context.createGain();
        source.connect(gainNode);
        gainNode.connect(context.destination);
        gainNodesRef.current.set(audio, gainNode);
      }

      return gainNode;
    } catch {
      boostUnsupportedRef.current.add(audio);
      return null;
    }
  }, []);

  const applyAudioBoost = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio) return;

    const boundedBoost = Math.max(0, Math.min(200, audioBoost));
    if (boundedBoost <= 100) {
      audio.volume = boundedBoost / 100;
      const gainNode = gainNodesRef.current.get(audio);
      if (gainNode) gainNode.gain.value = 1;
      return;
    }

    audio.volume = 1;
    const gainNode = ensureAudioGainNode(audio);
    if (gainNode) {
      gainNode.gain.value = boundedBoost / 100;
    } else {
      audio.volume = 1;
    }
  }, [audioBoost, ensureAudioGainNode]);

  const tryResumeAudioContext = useCallback(async () => {
    const context = audioContextRef.current;
    if (context?.state === "suspended") {
      try {
        await context.resume();
      } catch {
        /* ignore browser policy failures */
      }
    }
  }, []);

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

  useEffect(() => {
    if (hydratedDraftRef.current || typeof window === "undefined") return;
    hydratedDraftRef.current = true;

    try {
      const raw = window.localStorage.getItem(getExamDraftKey(exam.id));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ExamDraft> | null;
      if (!parsed || typeof parsed !== "object") return;

      const nextAnswers =
        parsed.answers && typeof parsed.answers === "object"
          ? Object.fromEntries(
              Object.entries(parsed.answers).filter(([questionId]) =>
                questions.some((question) => question.id === questionId),
              ),
            )
          : {};

      setAnswers(nextAnswers);

      const nextActivePart =
        typeof parsed.activePart === "number" && parsed.activePart >= 1 && parsed.activePart <= parts.length
          ? parsed.activePart
          : 1;
      setActivePart(nextActivePart);

      const nextExpandedModule =
        typeof parsed.expandedModule === "string" &&
        activeModules.includes(parsed.expandedModule as "listening" | "reading" | "writing")
          ? parsed.expandedModule
          : activeModules[0] ?? "listening";
      setExpandedModule(nextExpandedModule);
    } catch {
      window.localStorage.removeItem(getExamDraftKey(exam.id));
    }
  }, [activeModules, exam.id, parts.length, questions]);

  useEffect(() => {
    if (typeof window === "undefined" || !hydratedDraftRef.current || submitted) return;
    const draft: ExamDraft = {
      answers,
      activePart,
      expandedModule,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(getExamDraftKey(exam.id), JSON.stringify(draft));
  }, [activePart, answers, exam.id, expandedModule, submitted]);

  useEffect(() => {
    if (typeof window === "undefined" || !submitted) return;
    window.localStorage.removeItem(getExamDraftKey(exam.id));
  }, [exam.id, submitted]);

  const getQuestionImageUrl = useCallback((question: ExamQuestion) => {
    const localIndex = currentPartInfo.questions.findIndex((candidate) => candidate.id === question.id);
    if (localIndex < 0) return "";
    return (
      questionMedia.find(
        (entry) =>
          entry.module === currentPartInfo.module &&
          entry.part === currentPartInfo.part &&
          entry.index === localIndex,
      )?.image_url ?? ""
    );
  }, [currentPartInfo.module, currentPartInfo.part, currentPartInfo.questions, questionMedia]);

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
    setSubmitError(null);
    try {
      const res = await submitExamAttempt(attemptId, answers);
      if (res.ok) {
        setSubmitted(true);
        setResult(res.result);
      } else {
        setSubmitError(res.message);
      }
    } catch {
      setSubmitError("AI evaluation could not finish right now. Your answers are still here, so please try submitting again.");
    } finally {
      setSubmitting(false);
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
          applyAudioBoost(audio);
          await tryResumeAudioContext();
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
        applyAudioBoost(audio);
        await tryResumeAudioContext();
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
    applyAudioBoost(audio);
    void tryResumeAudioContext()
      .then(() => audio.play())
      .then(() => {
        setPlayingPart(pendingAutoplayPart);
        setPendingAutoplayPart(null);
      })
      .catch(() => {
        setPlayingPart(null);
      });
  }, [applyAudioBoost, currentPartInfo.module, currentPartInfo.part, isMasterListeningAudio, pendingAutoplayPart, tryResumeAudioContext]);

  useEffect(() => stopListeningAudio, [stopListeningAudio]);

  useEffect(() => {
    if (masterAudioRef.current) applyAudioBoost(masterAudioRef.current);
    Object.values(audioRefs.current).forEach((audio) => applyAudioBoost(audio));
  }, [applyAudioBoost, currentPartInfo.part, listeningAudioSource.mode]);

  useEffect(() => {
    if (!isListening) return;

    if (isMasterListeningAudio) {
      if (masterAudioEnded || masterAudioPlaying || masterAutoplayAttemptedRef.current) return;
      const audio = masterAudioRef.current;
      if (!audio) return;

      masterAutoplayAttemptedRef.current = true;
      applyAudioBoost(audio);
      void tryResumeAudioContext()
        .then(() => audio.play())
        .then(() => {
          setListeningStarted(true);
          setMasterAudioPlaying(true);
          setFurthestListeningPart((prev) => Math.max(prev, currentPartInfo.part));
        })
        .catch(() => {
          setMasterAudioPlaying(false);
        });
      return;
    }

    if (completedListeningParts.includes(currentPartInfo.part) || pendingAutoplayPart) return;
    if (autoplayAttemptedPartsRef.current.has(currentPartInfo.part)) return;

    const audio = audioRefs.current[currentPartInfo.part];
    if (!audio) return;

    autoplayAttemptedPartsRef.current.add(currentPartInfo.part);
    applyAudioBoost(audio);
    void tryResumeAudioContext()
      .then(() => audio.play())
      .then(() => {
        setListeningStarted(true);
        setPlayingPart(currentPartInfo.part);
      })
      .catch(() => {
        setPlayingPart((prev) => (prev === currentPartInfo.part ? null : prev));
      });
  }, [
    applyAudioBoost,
    completedListeningParts,
    currentPartInfo.part,
    isListening,
    isMasterListeningAudio,
    masterAudioEnded,
    masterAudioPlaying,
    pendingAutoplayPart,
    tryResumeAudioContext,
  ]);

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

  /* ── Submitting overlay ────────────── */
  if (submitting && !submitted) {
    const hasWriting = activeModules.includes("writing");
    return (
      <div className="ep-submitting">
        <div className="ep-submitting__card ep-fade-in">
          <div className="ep-submitting__spinner">
            <div className="ep-submitting__ring" />
          </div>
          <h2 className="ep-submitting__title">
            {hasWriting ? "Gemini is marking your writing" : "Scoring your answers"}
          </h2>
          <p className="ep-submitting__sub">
            {hasWriting
              ? "Your response is being checked against IELTS writing criteria. Keep this tab open while the band score and feedback are prepared."
              : "Calculating your band scores across all modules. Please wait a moment."}
          </p>
          {hasWriting ? (
            <div className="ep-submitting__steps" aria-label="AI marking progress">
              <span>Reading responses</span>
              <span>Scoring criteria</span>
              <span>Preparing feedback</span>
            </div>
          ) : null}
          <div className="ep-submitting__dots" aria-hidden>
            <span /><span /><span />
          </div>
        </div>
      </div>
    );
  }

  /* ── Results screen ────────────── */
  if (submitted && result) {
    const reviewPending = result.reviewPendingModules.length > 0;
    const ai = result.aiWritingReview;
    const CRITERIA_LABELS: Record<string, string> = {
      task_response: "Task Response",
      coherence: "Coherence & Cohesion",
      lexical: "Lexical Resource",
      grammar: "Grammar & Accuracy",
    };

    return (
      <div className="ep-results ep-fade-in">
        <div className="ep-results__scroll">
          {/* Hero header */}
          <div className="ep-results__hero">
            <div className="ep-results__badge">✓</div>
            <h1 className="ep-results__title">{reviewPending ? "Submission Received" : "Exam Completed!"}</h1>
            <p className="ep-results__sub">{exam.title}</p>
          </div>

          <div className="ep-results__body">
            {/* Overall band */}
            {result.overallBand != null ? (
              <div className="ep-results__band-main">
                <span className="ep-results__band-label">Overall Band Score</span>
                <span className="ep-results__band-value">{result.overallBand.toFixed(1)}</span>
              </div>
            ) : null}

            {/* Module bands grid */}
            <div className="ep-results__modules">
              {Object.entries(result.moduleBands).map(([mod, band]) => (
                <div key={mod} className="ep-results__module">
                  <span>{MODULE_LABELS[mod] ?? mod}</span>
                  <strong>{band != null ? band.toFixed(1) : "Pending"}</strong>
                </div>
              ))}
              <div className="ep-results__module">
                <span>Questions Answered</span>
                <strong>{answeredCount} / {visibleQuestions.length}</strong>
              </div>
            </div>

            {/* AI Writing Review Section */}
            {ai && ai.tasks.length > 0 ? (
              <div className="ep-results__ai">
                <div className="ep-results__ai-header">
                  <div className="ep-results__ai-icon">
                    <Sparkles size={22} strokeWidth={2.2} aria-hidden />
                  </div>
                  <div>
                    <h2 className="ep-results__ai-title">AI Writing Assessment</h2>
                    <p className="ep-results__ai-sub">Evaluated by Gemini AI examiner</p>
                  </div>
                </div>

                {/* Summary */}
                <div className="ep-results__ai-summary">
                  <p>{ai.summary}</p>
                </div>

                {/* Strengths & Improvements */}
                {ai.strengths.length > 0 || ai.improvements.length > 0 ? (
                  <div className="ep-results__ai-insights">
                    {ai.strengths.length > 0 ? (
                      <div className="ep-results__insight ep-results__insight--strength">
                        <h3 className="ep-results__insight-title">
                          <span className="ep-results__insight-dot ep-results__insight-dot--green" />
                          Strengths
                        </h3>
                        <ul className="ep-results__insight-list">
                          {ai.strengths.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    ) : null}
                    {ai.improvements.length > 0 ? (
                      <div className="ep-results__insight ep-results__insight--improve">
                        <h3 className="ep-results__insight-title">
                          <span className="ep-results__insight-dot ep-results__insight-dot--amber" />
                          Areas to Improve
                        </h3>
                        <ul className="ep-results__insight-list">
                          {ai.improvements.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Per-task detailed feedback */}
                {ai.tasks.map((task) => (
                  <div key={task.part} className="ep-results__task-card">
                    <div className="ep-results__task-head">
                      <h3>Writing Task {task.part}</h3>
                      <span className="ep-results__task-band">Band {task.estimated_band.toFixed(1)}</span>
                    </div>
                    <div className="ep-results__task-meta">
                      <span>{task.word_count} words</span>
                    </div>

                    {/* Criterion score bars */}
                    <div className="ep-results__criteria">
                      {(Object.entries(task.criterion_scores) as [string, number][]).map(([key, score]) => (
                        <div key={key} className="ep-results__criterion">
                          <div className="ep-results__criterion-head">
                            <span className="ep-results__criterion-label">{CRITERIA_LABELS[key] ?? key}</span>
                            <span className="ep-results__criterion-score">{score.toFixed(1)}</span>
                          </div>
                          <div className="ep-results__criterion-track">
                            <div
                              className={`ep-results__criterion-fill${score >= 7 ? " ep-results__criterion-fill--high" : score >= 5 ? " ep-results__criterion-fill--mid" : " ep-results__criterion-fill--low"}`}
                              style={{ width: `${Math.min(100, (score / 9) * 100)}%` }}
                            />
                          </div>
                          <p className="ep-results__criterion-feedback">
                            {(task.feedback as Record<string, string>)[key]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {reviewPending ? (
              <div className="ep-results__pending-note">
                <strong>{result.reviewPendingModules.map((mod) => MODULE_LABELS[mod] ?? mod).join(" + ")}</strong> review is still pending. Check back later for your full results.
              </div>
            ) : null}

            {/* Actions */}
            <div className="ep-results__actions">
              <button className="btn btn-primary btn-topbar-cta" onClick={() => router.push(`/mock-exam/${exam.slug}/review`)}>
                View Full Review
              </button>
              <button className="btn btn-outline" onClick={() => router.push("/mock-exam")}>
                Back to Exams
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Render single question ────────────── */
  const renderQuestion = (q: ExamQuestion, globalIdx: number) => {
    const options = Array.isArray(q.options_json) ? (q.options_json as string[]) : [];
    const questionImageUrl = getQuestionImageUrl(q);

    return (
      <div key={q.id} className="ep-q ep-slide-up" id={`q-${globalIdx + 1}`}>
        {(q.question_type === "multiple_choice" || q.question_type === "multiple_choice_multi") && options.length > 0 ? (
          <>
            <p className="ep-q__text"><strong>{globalIdx + 1}.</strong> {q.prompt}</p>
            {questionImageUrl ? <img src={questionImageUrl} alt="" className="ep-q__img" /> : null}
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
            {questionImageUrl ? <img src={questionImageUrl} alt="" className="ep-q__img" /> : null}
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
            {questionImageUrl ? <img src={questionImageUrl} alt="" className="ep-q__img" /> : null}
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
            {questionImageUrl ? <img src={questionImageUrl} alt="" className="ep-q__img" /> : null}
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

      {submitError ? (
        <div className="ep-submit-error" role="alert">
          <AlertCircle size={18} strokeWidth={2.2} aria-hidden />
          <div>
            <strong>Writing evaluation did not complete</strong>
            <span>{submitError}</span>
          </div>
          <button type="button" onClick={() => setSubmitError(null)} aria-label="Dismiss evaluation error">
            ×
          </button>
        </div>
      ) : null}

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
                    <label className="ep-listen-bar__volume" aria-label="Audio boost">
                      <Volume2 size={14} />
                      <input
                        type="range"
                        min={0}
                        max={200}
                        step={5}
                        value={audioBoost}
                        onChange={(e) => setAudioBoost(Number(e.target.value))}
                      />
                      <span>{audioBoost}%</span>
                    </label>
                    <div className="ep-listen-bar__progress">
                      <div className="ep-listen-bar__progress-fill" style={{ width: `${audioProgress[currentPartInfo.part] ?? 0}%` }} />
                    </div>
                  </div>
                  <audio
                    ref={(el) => { audioRefs.current[currentPartInfo.part] = el; }}
                    src={getPlayableAudioSrc(getAudioForPart(currentPartInfo.part)!.url)}
                    crossOrigin="anonymous"
                    preload="auto"
                    onLoadedMetadata={(e) => applyAudioBoost(e.currentTarget)}
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
                    <label className="ep-listen-bar__volume" aria-label="Audio boost">
                      <Volume2 size={14} />
                      <input
                        type="range"
                        min={0}
                        max={200}
                        step={5}
                        value={audioBoost}
                        onChange={(e) => setAudioBoost(Number(e.target.value))}
                      />
                      <span>{audioBoost}%</span>
                    </label>
                    <div className="ep-listen-bar__progress">
                      <div className="ep-listen-bar__progress-fill" style={{ width: `${masterAudioProgress}%` }} />
                    </div>
                  </div>
                  <audio
                    ref={masterAudioRef}
                    src={getPlayableAudioSrc(listeningAudioSource.asset.url)}
                    crossOrigin="anonymous"
                    preload="auto"
                    onLoadedMetadata={(e) => applyAudioBoost(e.currentTarget)}
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
