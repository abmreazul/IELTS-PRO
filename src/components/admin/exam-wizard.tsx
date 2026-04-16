"use client";

import Link from "next/link";
import { BookOpen, ChevronDown, ChevronRight, Headphones, Mic, PenLine, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { saveExamWizard, type ExamWizardSaveInput, type WizardQuestionInput } from "@/app/admin/actions";
import { ExamLocalUpload } from "@/components/admin/exam-local-upload";
import {
  coerceTestVariant,
  DEFAULT_SCORING,
  getReadingIntro,
  getReadingSectionLabel,
  getWritingImageLabel,
  getWritingTaskPromptPlaceholder,
  getWritingTaskTitle,
  type ScoringConfig,
  type SectionStructure,
  type TestVariant,
  IELTS_QUESTION_TYPES,
  structureForModules,
} from "@/lib/exam/ielts-defaults";

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

type Category = { id: string; name: string; slug: string };

export type ExamWizardInitialExam = {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  description: string | null;
  exam_type: "full" | "partial";
  modules: string[];
  duration_minutes: number;
  question_count: number;
  difficulty: string;
  price_cents: number;
  currency: string;
  cover_image_url: string | null;
  is_published: boolean;
  structure_json?: unknown;
  scoring_json?: unknown;
  listening_audio_json?: unknown;
};

type ListeningClip = { part: number; url: string; title: string };
type ListeningAudioAsset = { url: string; title: string };
type ReadingPassage = { part: number; title: string; text: string; image_url: string };
type WritingTask = { part: number; prompt: string; image_url: string; min_words: number };

type DbQuestion = {
  id: string;
  module: string;
  question_type: string;
  prompt: string;
  options_json: unknown;
  correct_json: unknown;
  points: number;
  sort_order: number;
};

type QuestionDraft = {
  tempId: string;
  module: "listening" | "reading" | "writing" | "speaking";
  part?: number; // 1-4 for listening, 1-3 for reading, 1-2 for writing
  question_type: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  correctTriple: string;
  correctText: string; // for fill-in/completion/short-answer/matching
  points: number;
};

type Surface = "full" | "listening" | "reading" | "writing" | "speaking";

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function surfaceFromExam(exam_type: string, modules: string[]): Surface {
  if (exam_type === "full") return "full";
  if (modules?.length === 1 && modules[0]) {
    const m = modules[0] as Surface;
    if (m === "listening" || m === "reading" || m === "writing" || m === "speaking") return m;
  }
  return "full";
}

function modulesFromSurface(s: Surface): { exam_type: "full" | "partial"; modules: string[] } {
  if (s === "full") {
    return { exam_type: "full", modules: ["listening", "reading", "writing", "speaking"] };
  }
  return { exam_type: "partial", modules: [s] };
}

function categoryForSurface(s: Surface, categories: Category[]): string | undefined {
  const slug = s === "full" ? "full-exams" : s;
  return categories.find((c) => c.slug === slug)?.id;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseTestVariant(raw: unknown): TestVariant {
  if (raw && typeof raw === "object" && "exam_meta" in (raw as Record<string, unknown>)) {
    const meta = (raw as { exam_meta?: unknown }).exam_meta;
    if (meta && typeof meta === "object" && "test_variant" in (meta as Record<string, unknown>)) {
      return coerceTestVariant((meta as { test_variant?: unknown }).test_variant);
    }
  }
  return "academic";
}

function parseListeningClips(raw: unknown): ListeningClip[] {
  if (!Array.isArray(raw)) return [];
  const out: ListeningClip[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const part = Math.max(1, Math.min(20, Math.floor(Number(o.part)) || 1));
    const url = String(o.url ?? "").trim();
    if (!url) continue;
    const title = String(o.title ?? "").trim() || `Part ${part}`;
    out.push({ part, url, title });
  }
  out.sort((a, b) => a.part - b.part);
  return out;
}

function parseListeningAudioAsset(raw: unknown): ListeningAudioAsset | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const url = String(value.url ?? "").trim();
  if (!url) return null;
  return {
    url,
    title: String(value.title ?? "").trim() || "IELTS Listening Paper",
  };
}

function dbQuestionToDraft(q: DbQuestion): QuestionDraft {
  const rawOpts = Array.isArray(q.options_json) ? (q.options_json as string[]).map(String) : [];
  const normalizedType = q.question_type === "multiple_choice_multi" ? "multiple_choice" : q.question_type;
  const isMcq = normalizedType === "multiple_choice";
  const opts = isMcq ? [...rawOpts, "", "", "", ""].slice(0, 4) : rawOpts.length > 0 ? rawOpts : ["", "", "", ""];
  let correctIndex = 0;
  let correctTriple = "";
  let correctText = "";
  const c = q.correct_json;
  if (c && typeof c === "object" && "kind" in c) {
    const co = c as unknown as { kind?: string; index?: number; value?: string };
    if (co.kind === "index" && typeof co.index === "number") correctIndex = co.index;
    if (co.kind === "triple" && typeof co.value === "string") correctTriple = co.value;
    if (co.kind === "rubric" && typeof co.value === "string") correctText = co.value;
  }
  // Decode part from sort_order: Part N = sort_order in [N*100, (N+1)*100)
  let part: number | undefined = undefined;
  const mod = (["listening", "reading", "writing", "speaking"].includes(q.module)
    ? q.module
    : "reading") as QuestionDraft["module"];
  if (mod === "listening") {
    part = q.sort_order >= 100 ? Math.floor(q.sort_order / 100) : 1;
    part = Math.max(1, Math.min(4, part));
  } else if (mod === "reading") {
    part = q.sort_order >= 100 ? Math.floor(q.sort_order / 100) : 1;
    part = Math.max(1, Math.min(3, part));
  } else if (mod === "writing") {
    part = q.sort_order >= 100 ? Math.floor(q.sort_order / 100) : 1;
    part = Math.max(1, Math.min(2, part));
  }
  return {
    tempId: q.id,
    module: mod,
    part,
    question_type: normalizedType || "multiple_choice",
    prompt: q.prompt || "",
    options: opts,
    correctIndex,
    correctTriple,
    correctText,
    points: q.points ?? 1,
  };
}

const TEXT_ANSWER_TYPES = new Set([
  "completion", "short_answer", "fill_in_blank", "sentence_completion",
  "matching_headings", "matching_information", "matching_features",
  "sentence_endings", "map_diagram_labeling", "matching",
]);

function toWizardQuestion(q: QuestionDraft): WizardQuestionInput {
  let options_json: unknown = q.options.map((s) => s.trim()).filter(Boolean);
  let correct_json: unknown = null;

  if (q.question_type === "true_false_not_given") {
    options_json = ["True", "False", "Not Given"];
    correct_json = { kind: "triple", value: q.correctTriple || "not_given" };
  } else if (q.question_type === "yes_no_not_given") {
    options_json = ["Yes", "No", "Not Given"];
    correct_json = { kind: "triple", value: q.correctTriple || "not_given" };
  } else if (q.question_type === "multiple_choice") {
    correct_json = { kind: "index", index: Math.max(0, q.correctIndex) };
  } else if (TEXT_ANSWER_TYPES.has(q.question_type)) {
    correct_json = { kind: "rubric", value: q.correctText.trim() };
  }

  return {
    module: q.module,
    part: q.part,
    question_type: q.question_type,
    prompt: q.prompt,
    options_json,
    correct_json,
    points: q.points,
  };
}

const MODULE_LABELS: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

const MODULE_ICONS: Record<string, typeof Headphones> = {
  listening: Headphones,
  reading: BookOpen,
  writing: PenLine,
  speaking: Mic,
};

/* ═══════════════════════════════════════════════════════════════════
   Steps: Basic Info → Questions → Review
   ═══════════════════════════════════════════════════════════════════ */
const STEPS = ["Basic Info", "Questions", "Review"] as const;

export function ExamWizard({
  categories,
  initialExam,
  initialQuestions = [],
}: {
  categories: Category[];
  initialExam?: ExamWizardInitialExam;
  initialQuestions?: DbQuestion[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const isEdit = Boolean(initialExam?.id);
  const [examId, setExamId] = useState<string | undefined>(initialExam?.id);

  const initialSurface = initialExam
    ? surfaceFromExam(initialExam.exam_type, initialExam.modules ?? [])
    : "full";
  const [surface, setSurface] = useState<Surface>(initialSurface);

  const [categoryId, setCategoryId] = useState(
    initialExam?.category_id ?? categoryForSurface(initialSurface, categories) ?? categories[0]?.id ?? "",
  );
  const [title, setTitle] = useState(initialExam?.title ?? "");
  const [slug, setSlug] = useState(initialExam?.slug ?? "");
  const [isSlugManual] = useState(Boolean(initialExam?.id || initialExam?.slug));
  const [description, setDescription] = useState(initialExam?.description ?? "");
  const [difficulty, setDifficulty] = useState(initialExam?.difficulty ?? "intermediate");
  const [durationMinutes, setDurationMinutes] = useState(initialExam?.duration_minutes ?? 60);
  const [priceDollars, setPriceDollars] = useState(
    initialExam ? (initialExam.price_cents / 100).toFixed(2) : "29.99",
  );
  const [pricingMode, setPricingMode] = useState<"free" | "paid">(
    initialExam?.price_cents && initialExam.price_cents > 0 ? "paid" : "free",
  );
  const [currency, setCurrency] = useState(initialExam?.currency ?? "USD");
  const [coverUrl, setCoverUrl] = useState(initialExam?.cover_image_url ?? "");
  const [isPublished, setIsPublished] = useState(initialExam?.is_published ?? false);
  const [testVariant, setTestVariant] = useState<TestVariant>(() =>
    parseTestVariant(initialExam?.structure_json),
  );

  const { exam_type, modules } = useMemo(() => modulesFromSurface(surface), [surface]);
  const currentCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const readingSectionLabel = getReadingSectionLabel(testVariant);
  const readingIntro = getReadingIntro(testVariant);

  useEffect(() => {
    if (isSlugManual) return;
    setSlug(slugify(title));
  }, [title, isSlugManual]);

  const [questions, setQuestions] = useState<QuestionDraft[]>(() =>
    initialQuestions.length ? initialQuestions.map(dbQuestionToDraft) : [],
  );

  const [legacyListeningClips] = useState<ListeningClip[]>(() =>
    parseListeningClips(initialExam?.listening_audio_json),
  );
  const [listeningAudio, setListeningAudio] = useState<ListeningAudioAsset | null>(() =>
    parseListeningAudioAsset(initialExam?.listening_audio_json),
  );

  // Reading passages (stored in structure_json)
  const [readingPassages, setReadingPassages] = useState<ReadingPassage[]>(() => {
    const sj = initialExam?.structure_json;
    if (sj && typeof sj === "object" && "reading_passages" in (sj as Record<string, unknown>)) {
      const rp = (sj as Record<string, unknown>).reading_passages;
      if (Array.isArray(rp)) {
        return rp.map((p: Record<string, unknown>) => ({
          part: Number(p.part) || 1,
          title: String(p.title ?? ""),
          text: String(p.text ?? ""),
          image_url: String(p.image_url ?? ""),
        }));
      }
    }
    return [
      { part: 1, title: "", text: "", image_url: "" },
      { part: 2, title: "", text: "", image_url: "" },
      { part: 3, title: "", text: "", image_url: "" },
    ];
  });

  // Writing tasks (stored in structure_json)
  const [writingTasks, setWritingTasks] = useState<WritingTask[]>(() => {
    const sj = initialExam?.structure_json;
    if (sj && typeof sj === "object" && "writing_tasks" in (sj as Record<string, unknown>)) {
      const wt = (sj as Record<string, unknown>).writing_tasks;
      if (Array.isArray(wt)) {
        return wt.map((t: Record<string, unknown>) => ({
          part: Number(t.part) || 1,
          prompt: String(t.prompt ?? ""),
          image_url: String(t.image_url ?? ""),
          min_words: Number(t.min_words) || 150,
        }));
      }
    }
    return [
      { part: 1, prompt: "", image_url: "", min_words: 150 },
      { part: 2, prompt: "", image_url: "", min_words: 250 },
    ];
  });

  /* Active module tab for the Questions step (for "full" exams only) */
  const [activeModuleTab, setActiveModuleTab] = useState<string>(modules[0] ?? "listening");

  const hasListening = modules.includes("listening");
  const hasReading = modules.includes("reading");
  const hasWriting = modules.includes("writing");

  const generatedWritingQuestions = useMemo<QuestionDraft[]>(() => {
    if (!hasWriting) return [];
    const existingWritingQuestions = questions.filter((question) => question.module === "writing");
    return [1, 2].map((part) => {
      const existing = existingWritingQuestions.find((question) => question.part === part);
      const task = writingTasks.find((row) => row.part === part);
      return {
        tempId: existing?.tempId ?? `writing-task-${part}`,
        module: "writing",
        part,
        question_type: "essay",
        prompt: task?.prompt ?? existing?.prompt ?? "",
        options: ["", "", "", ""],
        correctIndex: 0,
        correctTriple: "",
        correctText: "",
        points: existing?.points ?? 1,
      };
    });
  }, [hasWriting, questions, writingTasks]);

  const payloadQuestions = useMemo(
    () => [...questions.filter((question) => question.module !== "writing"), ...generatedWritingQuestions],
    [generatedWritingQuestions, questions],
  );

  const setListeningAudioUrl = useCallback((url: string) => {
    const trimmed = url.trim();
    if (!trimmed) {
      setListeningAudio(null);
      return;
    }
    setListeningAudio({ url: trimmed, title: "IELTS Listening Paper" });
  }, []);

  const updateReadingPassage = useCallback((part: number, patch: Partial<ReadingPassage>) => {
    setReadingPassages((prev) =>
      prev.map((p) => (p.part === part ? { ...p, ...patch } : p)),
    );
  }, []);

  const handleSurface = (s: Surface) => {
    setSurface(s);
    const { modules: m } = modulesFromSurface(s);
    const catId = categoryForSurface(s, categories);
    if (catId) setCategoryId(catId);
    setActiveModuleTab(m[0] ?? "listening");
  };

  const addQuestion = (mod: QuestionDraft["module"], part?: number) => {
    setQuestions((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        module: mod,
        part: (mod === "listening" || mod === "reading" || mod === "writing") ? (part ?? 1) : undefined,
        question_type: "multiple_choice",
        prompt: "",
        options: ["", "", "", ""],
        correctIndex: 0,
        correctTriple: "true",
        correctText: "",
        points: 1,
      },
    ]);
  };

  /* Expanded/collapsed state for listening parts */
  const [expandedParts, setExpandedParts] = useState<Record<number, boolean>>({ 1: true, 2: true, 3: true, 4: true });
  const togglePart = (part: number) => {
    setExpandedParts((prev) => ({ ...prev, [part]: !prev[part] }));
  };

  const removeQuestion = (tempId: string) => {
    setQuestions((prev) => prev.filter((q) => q.tempId !== tempId));
  };

  const updateQuestion = (tempId: string, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) => prev.map((q) => (q.tempId === tempId ? { ...q, ...patch } : q)));
  };

  /* ── Build payload ────────────────────────────────────── */
  const buildPayload = (published: boolean): ExamWizardSaveInput => {
    const price_cents =
      pricingMode === "free"
        ? 0
        : Math.max(0, Math.round(Number.parseFloat(priceDollars || "0") * 100) || 0);
    // Auto-derive structure from questions added
    const structure: SectionStructure[] = structureForModules(modules).map((s) => ({
      ...s,
      questions: payloadQuestions.filter((q) => q.module === s.module).length,
      enabled: modules.includes(s.module),
    }));
    const qCount = payloadQuestions.length;

    return {
      id: examId,
      category_id: categoryId,
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      exam_type,
      modules,
      duration_minutes: durationMinutes,
      question_count: qCount,
      difficulty: difficulty === "beginner" || difficulty === "advanced" ? difficulty : "intermediate",
      price_cents,
      currency: (currency.trim() || "USD").toUpperCase(),
      cover_image_url: coverUrl.trim() || null,
      is_published: published,
      structure_json: {
        exam_meta: {
          test_variant: testVariant,
        },
        reading_passages: hasReading ? readingPassages : [],
        writing_tasks: hasWriting ? writingTasks : [],
        sections: structure,
      },
      scoring_json: DEFAULT_SCORING,
      listening_audio_json: hasListening
        ? (listeningAudio?.url ? listeningAudio : legacyListeningClips)
        : null,
      questions: payloadQuestions.map(toWizardQuestion),
    };
  };

  const runSave = (published: boolean) => {
    setMessage(null);
    if (!categoryId || !title.trim()) {
      setMessage({ type: "err", text: "Category and title are required." });
      return;
    }
    startTransition(async () => {
      const res = await saveExamWizard(buildPayload(published));
      if (!res.ok) {
        setMessage({ type: "err", text: res.message });
        return;
      }
      setExamId(res.id);
      setIsPublished(published);
      setMessage({ type: "ok", text: published ? "Published successfully." : "Draft saved." });
      if (!isEdit && res.id) {
        router.replace(`/admin/exams/${res.id}`);
      }
      router.refresh();
    });
  };

  const canNext = step < STEPS.length - 1;
  const canPrev = step > 0;

  /* ── Question counts per module ─────────────────────── */
  const questionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of modules) counts[m] = 0;
    for (const q of payloadQuestions) {
      if (counts[q.module] !== undefined) counts[q.module]++;
    }
    return counts;
  }, [payloadQuestions, modules]);

  /* ── Reusable question card renderer ────────────────── */
  const renderQuestionCard = (q: QuestionDraft, qIdx: number) => (
    <div key={q.tempId} className="admin-question-card">
      <div className="admin-question-card__bar">
        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--muted)" }}>
          Q{qIdx + 1}
        </span>
        <button
          type="button"
          className="admin-icon-btn"
          onClick={() => removeQuestion(q.tempId)}
          title="Remove"
          aria-label="Remove question"
        >
          <Trash2 />
        </button>
      </div>

      <div className="admin-form-grid admin-form-grid--2" style={{ marginBottom: "0.65rem" }}>
        <div>
          <label className="admin-label">Question type</label>
          <select
            className="admin-select"
            value={q.question_type}
            onChange={(e) => updateQuestion(q.tempId, { question_type: e.target.value })}
          >
            {IELTS_QUESTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="admin-label">Points</label>
          <input
            type="number"
            min={1}
            className="admin-input"
            value={q.points}
            onChange={(e) => updateQuestion(q.tempId, { points: Number(e.target.value) || 1 })}
          />
        </div>
      </div>

      <div>
        <label className="admin-label">Question text</label>
        <textarea
          className="admin-textarea"
          rows={3}
          value={q.prompt}
          onChange={(e) => updateQuestion(q.tempId, { prompt: e.target.value })}
          placeholder="Enter your question here…"
        />
      </div>

      {q.question_type === "true_false_not_given" || q.question_type === "yes_no_not_given" ? (
        <div style={{ marginTop: "0.65rem" }}>
          <span className="admin-label">Correct answer</span>
          <div className="admin-segment" style={{ marginTop: "0.35rem" }}>
            {(q.question_type === "true_false_not_given"
              ? (["true", "false", "not_given"] as const)
              : (["yes", "no", "not_given"] as const)
            ).map((opt) => (
              <label key={opt}>
                <input
                  type="radio"
                  name={`tf-${q.tempId}`}
                  checked={q.correctTriple === opt}
                  onChange={() => updateQuestion(q.tempId, { correctTriple: opt })}
                />
                <span>
                  {opt.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : q.question_type === "multiple_choice" ? (
        <div style={{ marginTop: "0.65rem" }}>
          <p className="admin-label">Options (select the correct answer)</p>
          {q.options.map((opt, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <input
                type="radio"
                name={`mc-${q.tempId}`}
                checked={q.correctIndex === i}
                onChange={() => updateQuestion(q.tempId, { correctIndex: i })}
                aria-label={`Correct option ${i + 1}`}
              />
              <span style={{ width: "1.25rem", fontWeight: 700 }}>{String.fromCharCode(65 + i)}</span>
              <input
                className="admin-input"
                value={opt}
                onChange={(e) => {
                  const next = [...q.options];
                  next[i] = e.target.value;
                  updateQuestion(q.tempId, { options: next });
                }}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
              />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: "0.65rem" }}>
          <label className="admin-label">Correct answer</label>
          <input
            className="admin-input"
            value={q.correctText}
            onChange={(e) => updateQuestion(q.tempId, { correctText: e.target.value })}
            placeholder="The exact correct answer (case-insensitive matching)"
          />
          {q.question_type === "completion" || q.question_type === "sentence_endings" || q.question_type === "matching_headings" || q.question_type === "matching_information" || q.question_type === "matching_features" ? (
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.35rem" }}>
              💡 For form completion, enter the expected word(s). Students type their answer and it&apos;s matched case-insensitively.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════════ */

  return (
    <div>
      {/* ── Toolbar ────────────────────────────── */}
      <div className="admin-wizard-toolbar">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/admin" className="admin-wizard-back">
            ← Back to Dashboard
          </Link>
          <span style={{ color: "var(--border)", fontWeight: 300 }}>|</span>
          <span className="admin-wizard-title">{isEdit ? "Edit exam" : "Create New Exam"}</span>
        </div>
        <div className="admin-wizard-actions">
          <button type="button" className="btn btn-outline" disabled={pending} onClick={() => runSave(false)}>
            Save Draft
          </button>
          <button
            type="button"
            className="btn btn-primary btn-topbar-cta"
            disabled={pending}
            onClick={() => runSave(true)}
          >
            Publish
          </button>
        </div>
      </div>

      {/* ── Stepper ────────────────────────────── */}
      <div className="admin-stepper" role="tablist" aria-label="Exam steps">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            role="tab"
            className={`admin-stepper__step ${step === i ? "admin-stepper__step--active" : ""}`}
            aria-selected={step === i}
            onClick={() => setStep(i)}
          >
            <span className="admin-stepper__num">{i + 1}</span>
            {label}
          </button>
        ))}
      </div>

      {message ? (
        <div className={message.type === "ok" ? "admin-msg admin-msg--ok" : "admin-msg admin-msg--err"}>
          {message.text}
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════
         Step 0: Basic Info
         ═══════════════════════════════════════════════════════════ */}
      {step === 0 ? (
        <div className="admin-wizard-card">
          <h2>Basic information</h2>
          <p>Title, pricing, and how this mock appears in the catalog.</p>

          <div className="admin-form-grid" style={{ marginTop: "1rem" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="admin-review-grid" style={{ marginTop: "-0.1rem", marginBottom: "1.1rem" }}>
                <div className="admin-review-item admin-review-item--format">
                  <span className="admin-review-label">IELTS Format</span>
                  <span className="admin-review-value">
                    {testVariant === "academic" ? "Academic" : "General Training"}
                  </span>
                </div>
                <div className="admin-review-item admin-review-item--surface">
                  <span className="admin-review-label">Mock Surface</span>
                  <span className="admin-review-value">
                    {surface === "full" ? "Full Test" : MODULE_LABELS[surface] ?? surface}
                  </span>
                </div>
                <div className="admin-review-item admin-review-item--category">
                  <span className="admin-review-label">Catalog Category</span>
                  <span className="admin-review-value">{currentCategory?.name ?? "Not mapped"}</span>
                </div>
                <div className="admin-review-item admin-review-item--state">
                  <span className="admin-review-label">Save State</span>
                  <span className={`admin-badge ${isPublished ? "admin-badge--published" : "admin-badge--draft"}`}>
                    {isPublished ? "Published" : "Draft"}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="admin-label" htmlFor="ew-title">
                Exam title (required)
              </label>
              <input
                id="ew-title"
                className="admin-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., IELTS Academic Full Mock Test #1"
              />
            </div>
            <div>
              <span className="admin-label">Exam Category</span>
              <div className="admin-segment" style={{ marginTop: "0.35rem" }}>
                {(["full", "listening", "reading", "writing", "speaking"] as Surface[]).map((s) => (
                  <label key={s}>
                    <input
                      type="radio"
                      name="surface"
                      checked={surface === s}
                      onChange={() => handleSurface(s)}
                    />
                    <span>
                      {s === "full"
                        ? "Full Test"
                        : s.charAt(0).toUpperCase() + s.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="admin-label">Difficulty</span>
              <div className="admin-segment" style={{ marginTop: "0.35rem" }}>
                {(["beginner", "intermediate", "advanced"] as const).map((d) => (
                  <label key={d}>
                    <input
                      type="radio"
                      name="difficulty"
                      checked={difficulty === d}
                      onChange={() => setDifficulty(d)}
                    />
                    <span>{d.charAt(0).toUpperCase() + d.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="admin-form-grid admin-form-grid--2">
              <div>
                <label className="admin-label" htmlFor="ew-dur">
                  Duration (minutes)
                </label>
                <input
                  id="ew-dur"
                  type="number"
                  min={1}
                  className="admin-input"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value) || 1)}
                />
              </div>
              <div>
                <span className="admin-label">Access</span>
                <div className="admin-segment" style={{ marginTop: "0.35rem" }}>
                  {(["free", "paid"] as const).map((mode) => (
                    <label key={mode}>
                      <input
                        type="radio"
                        name="pricing"
                        checked={pricingMode === mode}
                        onChange={() => setPricingMode(mode)}
                      />
                      <span>{mode === "free" ? "Free Mock" : "Paid Mock"}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {pricingMode === "paid" ? (
              <div className="admin-form-grid admin-form-grid--2">
                <div>
                  <label className="admin-label" htmlFor="ew-price">
                    Price
                  </label>
                  <input
                    id="ew-price"
                    type="number"
                    step="0.01"
                    min={0}
                    className="admin-input"
                    value={priceDollars}
                    onChange={(e) => setPriceDollars(e.target.value)}
                  />
                </div>
                <div>
                  <label className="admin-label" htmlFor="ew-currency">
                    Currency
                  </label>
                  <input
                    id="ew-currency"
                    className="admin-input"
                    value={currency}
                    maxLength={3}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    placeholder="USD"
                  />
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: "0.9rem 1rem",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "color-mix(in srgb, #22c55e 7%, var(--surface))",
                  color: "var(--muted)",
                  fontSize: "0.86rem",
                  fontWeight: 600,
                }}
              >
                This mock will appear as free in the public catalog.
              </div>
            )}
            <div>
              <span className="admin-label">Thumbnail Image</span>
              <div className="admin-thumb-grid">
                <div className="admin-thumb-card">
                  <p className="admin-thumb-card__title">Image URL</p>
                  <input
                    id="ew-cover"
                    className="admin-input"
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/…"
                  />
                  {coverUrl.trim() ? (
                    <div className="admin-thumb-preview">
                      <img src={coverUrl.trim()} alt="Cover preview" />
                    </div>
                  ) : null}
                </div>
                <div className="admin-thumb-card">
                  <p className="admin-thumb-card__title">Upload from device</p>
                  <ExamLocalUpload
                    folder="covers"
                    accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                    disabled={pending}
                    onUploaded={(url) => setCoverUrl(url)}
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="admin-label" htmlFor="ew-desc">
                Description
              </label>
              <textarea
                id="ew-desc"
                className="admin-textarea"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p style={{ margin: "0.45rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                Save state is controlled by the toolbar buttons above: <strong>Save Draft</strong> or <strong>Publish</strong>.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════
         Step 1: Questions (per-module)
         ═══════════════════════════════════════════════════════════ */}
      {step === 1 ? (
        <div className="admin-wizard-card">
          <h2>Questions</h2>
          <p>
            Add questions for {surface === "full" ? "each section" : MODULE_LABELS[surface] ?? surface}.
            {modules.length > 1 ? " Switch between module tabs below." : ""}
          </p>

          {/* Module tabs — only shown for full test */}
          {modules.length > 1 ? (
            <div className="admin-module-tabs">
              {modules.map((m) => (
                (() => {
                  const Icon = MODULE_ICONS[m] ?? BookOpen;
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`admin-module-tab admin-module-tab--${m}${activeModuleTab === m ? " admin-module-tab--active" : ""}`}
                      onClick={() => setActiveModuleTab(m)}
                    >
                      <span className="admin-module-tab__icon" aria-hidden>
                        <Icon />
                      </span>
                      <span>{MODULE_LABELS[m] ?? m}</span>
                      <span className="admin-module-tab__count">{questionCounts[m] ?? 0}</span>
                    </button>
                  );
                })()
              ))}
            </div>
          ) : null}

          {/* ── Listening: part-based layout ─────────── */}
          {(() => {
            const isListeningActive = modules.length === 1 ? modules[0] === "listening" : activeModuleTab === "listening";
            if (!isListeningActive || !hasListening) return null;

            return (
              <div style={{ marginTop: "1rem" }}>
                <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
                  IELTS Listening uses one master audio recording. Keep the 4 parts below only for question grouping.
                </p>

                <div className="admin-part-card" style={{ marginBottom: "1rem" }}>
                  <div className="admin-part-card__body">
                    <div className="admin-part-audio">
                      <span className="admin-label">Listening Audio Recording</span>
                      <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0.35rem 0 0.75rem" }}>
                        Upload one full listening paper audio file. The 4 parts below are only for assigning questions.
                      </p>
                      {listeningAudio?.url ? (
                        <div style={{ marginBottom: "0.5rem" }}>
                          <audio controls src={listeningAudio.url} style={{ width: "100%", maxWidth: "560px" }} preload="metadata" />
                          <button
                            type="button"
                            className="admin-btn-ghost"
                            style={{ marginTop: "0.35rem", fontSize: "0.78rem" }}
                            onClick={() => setListeningAudio(null)}
                          >
                            Remove audio
                          </button>
                        </div>
                      ) : (
                        <div className="admin-form-grid admin-form-grid--2" style={{ marginTop: "0.5rem" }}>
                          <ExamLocalUpload
                            folder="listening"
                            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/webm,audio/ogg,.mp3,.wav,.webm,.ogg"
                            disabled={pending}
                            onUploaded={(url) => setListeningAudioUrl(url)}
                          />
                          <div>
                            <label className="admin-label" htmlFor="listen-master-url">Or paste URL</label>
                            <input
                              id="listen-master-url"
                              className="admin-input"
                              value={listeningAudio?.url ?? ""}
                              onChange={(e) => setListeningAudioUrl(e.target.value)}
                              placeholder="https://…"
                            />
                          </div>
                        </div>
                      )}

                      {!listeningAudio?.url && legacyListeningClips.length > 0 ? (
                        <div
                          style={{
                            marginTop: "0.85rem",
                            padding: "0.85rem 1rem",
                            borderRadius: "12px",
                            border: "1px solid color-mix(in srgb, #f59e0b 35%, var(--border))",
                            background: "color-mix(in srgb, #f59e0b 10%, var(--surface))",
                            color: "var(--text)",
                            fontSize: "0.82rem",
                            lineHeight: 1.6,
                          }}
                        >
                          This exam still has legacy part-by-part listening audio saved. Upload one master listening file here to replace that older setup.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {[1, 2, 3, 4].map((part) => {
                  const partQuestions = questions.filter((q) => q.module === "listening" && q.part === part);
                  const isExpanded = expandedParts[part] !== false;

                  return (
                    <div key={part} className="admin-part-card">
                      {/* Part header (collapsible) */}
                      <button
                        type="button"
                        className="admin-part-card__header"
                        onClick={() => togglePart(part)}
                      >
                        <div className="admin-part-card__left">
                          {isExpanded
                            ? <ChevronDown style={{ width: "1rem", height: "1rem" }} />
                            : <ChevronRight style={{ width: "1rem", height: "1rem" }} />
                          }
                          <span className="admin-part-card__title">Part {part}</span>
                          <span className="admin-part-card__meta">
                            {partQuestions.length} Q
                          </span>
                        </div>
                      </button>

                      {isExpanded ? (
                        <div className="admin-part-card__body">
                          {/* Questions for this part */}
                          <div style={{ marginTop: "1rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", position: "sticky", top: 0, background: "var(--surface)", zIndex: 2, padding: "0.5rem 0" }}>
                              <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                                Questions ({partQuestions.length})
                              </span>
                              <button
                                type="button"
                                className="btn btn-primary btn-topbar-cta"
                                style={{ fontSize: "0.78rem", padding: "0.35rem 0.7rem" }}
                                onClick={() => addQuestion("listening", part)}
                              >
                                <Plus style={{ width: "0.8rem", height: "0.8rem" }} /> Add
                              </button>
                            </div>

                            {partQuestions.length === 0 ? (
                              <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No questions for Part {part} yet.</p>
                            ) : null}

                            {partQuestions.map((q, qIdx) => renderQuestionCard(q, qIdx))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── Reading: part-based layout (3 passages) ─── */}
          {(() => {
            const mod = (modules.length === 1 ? modules[0] : activeModuleTab) as QuestionDraft["module"];
            if (mod !== "reading") return null;

            return (
              <div style={{ marginTop: "1.25rem" }}>
                <div
                  style={{
                    display: "grid",
                    gap: "1rem",
                    gridTemplateColumns: "minmax(220px, 320px) minmax(0, 1fr)",
                    alignItems: "start",
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <span className="admin-label">Reading format</span>
                    <div className="admin-segment" style={{ marginTop: "0.35rem" }}>
                      {(["academic", "general"] as const).map((variant) => (
                        <label key={variant}>
                          <input
                            type="radio"
                            name="reading-variant"
                            checked={testVariant === variant}
                            onChange={() => setTestVariant(variant)}
                          />
                          <span>{variant === "academic" ? "Academic" : "General Training"}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>
                    {readingIntro}
                  </p>
                </div>

                {[1, 2, 3].map((part) => {
                  const passage = readingPassages.find((p) => p.part === part) ?? { part, title: "", text: "", image_url: "" };
                  const partQuestions = questions.filter((q) => q.module === "reading" && q.part === part);
                  const isExpanded = expandedParts[part] !== false;

                  return (
                    <div key={part} className="admin-part-card">
                      <button
                        type="button"
                        className="admin-part-card__header"
                        onClick={() => togglePart(part)}
                      >
                        <div className="admin-part-card__left">
                          <span style={{ transition: "transform 0.2s", display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
                            <ChevronRight style={{ width: "1rem", height: "1rem" }} />
                          </span>
                          <span className="admin-part-card__title">{readingSectionLabel} {part}</span>
                          <span className="admin-part-card__meta">
                            {passage.title ? `"${passage.title}"` : "No title"} · {partQuestions.length} Q
                          </span>
                        </div>
                      </button>

                      {isExpanded ? (
                        <div className="admin-part-card__body">
                          {/* Passage fields */}
                          <div style={{ marginBottom: "1rem" }}>
                            <label className="admin-label">{readingSectionLabel} title</label>
                            <input
                              className="admin-input"
                              value={passage.title}
                              onChange={(e) => updateReadingPassage(part, { title: e.target.value })}
                              placeholder={`${readingSectionLabel} ${part} title…`}
                            />
                          </div>
                          <div style={{ marginBottom: "1rem" }}>
                            <label className="admin-label">{readingSectionLabel} text</label>
                            <textarea
                              className="admin-textarea"
                              rows={8}
                              value={passage.text}
                              onChange={(e) => updateReadingPassage(part, { text: e.target.value })}
                              placeholder={testVariant === "general" ? "Paste the full General Training reading section text here…" : "Paste the full academic reading passage here…"}
                            />
                          </div>
                          <div style={{ marginBottom: "1rem" }}>
                            <label className="admin-label">{readingSectionLabel} image URL (optional)</label>
                            <input
                              className="admin-input"
                              value={passage.image_url}
                              onChange={(e) => updateReadingPassage(part, { image_url: e.target.value })}
                              placeholder="https://…"
                            />
                            {passage.image_url ? (
                              <img src={passage.image_url} alt="" style={{ marginTop: "0.5rem", maxWidth: "200px", borderRadius: "8px", border: "1px solid var(--border)" }} />
                            ) : null}
                          </div>

                          {/* Questions for this passage */}
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.65rem", position: "sticky", top: 0, background: "var(--surface)", zIndex: 2, padding: "0.5rem 0" }}>
                              <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                                Questions ({partQuestions.length})
                              </span>
                              <button
                                type="button"
                                className="btn btn-primary btn-topbar-cta"
                                style={{ fontSize: "0.78rem", padding: "0.35rem 0.75rem" }}
                                onClick={() => addQuestion("reading", part)}
                              >
                                <Plus style={{ width: "0.85rem", height: "0.85rem" }} /> Add Question
                              </button>
                            </div>
                            {partQuestions.length === 0 ? (
                              <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No questions for {readingSectionLabel} {part} yet.</p>
                            ) : null}
                            {partQuestions.map((q, qIdx) => renderQuestionCard(q, qIdx))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── Writing module: 2-part layout ── */}
          {(() => {
            const mod = (modules.length === 1 ? modules[0] : activeModuleTab) as QuestionDraft["module"];
            if (mod !== "writing") return null;

            return (
              <div style={{ marginTop: "1.25rem" }}>
                {[1, 2].map((part) => {
                  const task = writingTasks.find((t) => t.part === part) ?? { part, prompt: "", image_url: "", min_words: part === 1 ? 150 : 250 };
                  const isExpanded = expandedParts[part + 10] !== false; // offset to not conflict with listening

                  return (
                    <div key={part} style={{ marginBottom: "1.25rem", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
                      {/* Task header */}
                      <button
                        type="button"
                        onClick={() => setExpandedParts((prev) => ({ ...prev, [part + 10]: !(prev[part + 10] !== false) }))}
                        style={{
                          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "0.85rem 1rem", background: "color-mix(in srgb, var(--primary) 6%, var(--surface))",
                          border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.95rem", color: "var(--text)",
                        }}
                      >
                        <span>{getWritingTaskTitle(testVariant, part)}</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                          1 response slot · Min {task.min_words} words
                        </span>
                      </button>

                      {isExpanded ? (
                        <div style={{ padding: "1rem" }}>
                          {/* Task prompt */}
                          <label style={{ display: "block", marginBottom: "0.4rem", fontWeight: 600, fontSize: "0.85rem" }}>
                            Task Prompt
                          </label>
                          <textarea
                            rows={4}
                            value={task.prompt}
                            onChange={(e) => {
                              const val = e.target.value;
                              setWritingTasks((prev) => prev.map((t) => t.part === part ? { ...t, prompt: val } : t));
                            }}
                            placeholder={getWritingTaskPromptPlaceholder(testVariant, part)}
                            style={{ width: "100%", padding: "0.65rem", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "0.9rem", resize: "vertical", boxSizing: "border-box" }}
                          />

                          {/* Image URL */}
                          <label style={{ display: "block", marginTop: "0.75rem", marginBottom: "0.4rem", fontWeight: 600, fontSize: "0.85rem" }}>
                            {getWritingImageLabel(testVariant, part)}
                          </label>
                          <input
                            type="url"
                            value={task.image_url}
                            onChange={(e) => {
                              const val = e.target.value;
                              setWritingTasks((prev) => prev.map((t) => t.part === part ? { ...t, image_url: val } : t));
                            }}
                            placeholder="https://example.com/chart.png"
                            style={{ width: "100%", padding: "0.55rem 0.65rem", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "0.9rem", boxSizing: "border-box" }}
                          />

                          {/* Min words */}
                          <label style={{ display: "block", marginTop: "0.75rem", marginBottom: "0.4rem", fontWeight: 600, fontSize: "0.85rem" }}>
                            Minimum Words
                          </label>
                          <input
                            type="number"
                            value={task.min_words}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setWritingTasks((prev) => prev.map((t) => t.part === part ? { ...t, min_words: val } : t));
                            }}
                            style={{ width: "120px", padding: "0.55rem 0.65rem", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "0.9rem" }}
                          />

                          <div
                            style={{
                              marginTop: "1rem",
                              padding: "0.9rem 1rem",
                              borderRadius: "12px",
                              background: "color-mix(in srgb, var(--primary) 6%, var(--surface))",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem", color: "var(--text)" }}>
                              Candidate response slot
                            </p>
                            <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.84rem", lineHeight: 1.6 }}>
                              IELTS Writing uses one typed response for each task. This response field is generated automatically on save and will be sent for review instead of exact-answer grading.
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── Speaking / other: flat question list ── */}
          {(() => {
            const mod = (modules.length === 1 ? modules[0] : activeModuleTab) as QuestionDraft["module"];
            if (mod === "listening" || mod === "reading" || mod === "writing") return null;
            const modQuestions = questions.filter((q) => q.module === mod);

            return (
              <div style={{ marginTop: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", position: "sticky", top: 0, background: "var(--surface)", zIndex: 2, padding: "0.5rem 0" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                    {MODULE_LABELS[mod]} Questions ({modQuestions.length})
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary btn-topbar-cta"
                    style={{ fontSize: "0.82rem", padding: "0.45rem 0.85rem" }}
                    onClick={() => addQuestion(mod)}
                  >
                    <Plus style={{ width: "0.9rem", height: "0.9rem" }} /> Add Question
                  </button>
                </div>

                {modQuestions.length === 0 ? (
                  <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                    No questions yet. Add one to build the {MODULE_LABELS[mod]?.toLowerCase()} section.
                  </p>
                ) : null}

                {modQuestions.map((q, qIdx) => renderQuestionCard(q, qIdx))}
              </div>
            );
          })()}
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════
         Step 2: Review
         ═══════════════════════════════════════════════════════════ */}
      {step === 2 ? (
        <div className="admin-wizard-card">
          <h2>Review</h2>
          <p>Summary before saving or publishing.</p>

          <div className="admin-review-grid">
            <div className="admin-review-item">
              <span className="admin-review-label">Title</span>
              <span className="admin-review-value">{title || "(Untitled)"}</span>
            </div>
            <div className="admin-review-item">
              <span className="admin-review-label">IELTS Format</span>
              <span className="admin-review-value">
                {testVariant === "academic" ? "Academic" : "General Training"}
              </span>
            </div>
            <div className="admin-review-item">
              <span className="admin-review-label">Category</span>
              <span className="admin-review-value">{surface === "full" ? "Full Test" : MODULE_LABELS[surface] ?? surface}</span>
            </div>
            <div className="admin-review-item">
              <span className="admin-review-label">Difficulty</span>
              <span className="admin-review-value">{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</span>
            </div>
            <div className="admin-review-item">
              <span className="admin-review-label">Duration</span>
              <span className="admin-review-value">{durationMinutes} minutes</span>
            </div>
            <div className="admin-review-item">
              <span className="admin-review-label">Price</span>
              <span className="admin-review-value">
                {pricingMode === "free" ? "Free" : `${currency.toUpperCase()} ${priceDollars}`}
              </span>
            </div>
            <div className="admin-review-item">
              <span className="admin-review-label">Status</span>
              <span className={`admin-badge ${isPublished ? "admin-badge--published" : "admin-badge--draft"}`}>
                {isPublished ? "Published" : "Draft"}
              </span>
            </div>
          </div>

          <div style={{ marginTop: "1.25rem" }}>
            <span className="admin-label" style={{ marginBottom: "0.5rem", display: "block" }}>
              Questions by section
            </span>
            <div className="admin-review-grid">
              {modules.map((m) => (
                <div key={m} className="admin-review-item">
                  <span className="admin-review-label">{MODULE_LABELS[m]}</span>
                  <span className="admin-review-value">{questionCounts[m] ?? 0} question(s)</span>
                </div>
              ))}
              <div className="admin-review-item" style={{ fontWeight: 700 }}>
                <span className="admin-review-label">Total</span>
                <span className="admin-review-value">{payloadQuestions.length} question(s)</span>
              </div>
            </div>
          </div>

          {hasListening ? (
            <div style={{ marginTop: "1rem" }}>
              <span className="admin-review-label">Listening audio</span>
              <span className="admin-review-value" style={{ marginLeft: "0.5rem" }}>
                {listeningAudio?.url
                  ? "1 master audio file uploaded"
                  : legacyListeningClips.length > 0
                    ? `${legacyListeningClips.filter((clip) => clip.url).length} legacy part files saved`
                    : "No listening audio uploaded"}
              </span>
            </div>
          ) : null}

          {coverUrl ? (
            <div style={{ marginTop: "1rem" }}>
              <span className="admin-review-label">Cover image</span>
              <div className="admin-thumb-preview" style={{ maxWidth: "280px", marginTop: "0.5rem" }}>
                <img src={coverUrl} alt="Cover" />
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: "1.5rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-primary btn-topbar-cta"
              disabled={pending}
              onClick={() => runSave(true)}
            >
              Publish Now
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={pending}
              onClick={() => runSave(false)}
            >
              Save as Draft
            </button>
            {slug ? (
              <Link href={`/mock-exam/${slug}/take`} className="btn btn-outline">
                Preview take page
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ── Navigation ────────────────────────── */}
      <div className="admin-wizard-nav">
        <button type="button" className="admin-btn-ghost" disabled={!canPrev || pending} onClick={() => setStep((s) => s - 1)}>
          Previous
        </button>
        <button
          type="button"
          className="btn btn-primary btn-topbar-cta"
          disabled={!canNext || pending}
          onClick={() => setStep((s) => s + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
