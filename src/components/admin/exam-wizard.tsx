"use client";

import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { saveExamWizard, type ExamWizardSaveInput, type WizardQuestionInput } from "@/app/admin/actions";
import { ExamLocalUpload } from "@/components/admin/exam-local-upload";
import {
  DEFAULT_SCORING,
  type ScoringConfig,
  type SectionStructure,
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

type DbQuestion = {
  id: string;
  module: string;
  question_type: string;
  prompt: string;
  options_json: unknown;
  correct_json: unknown;
  points: number;
};

type QuestionDraft = {
  tempId: string;
  module: "listening" | "reading" | "writing" | "speaking";
  question_type: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  correctTriple: string;
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

function dbQuestionToDraft(q: DbQuestion): QuestionDraft {
  const rawOpts = Array.isArray(q.options_json) ? (q.options_json as string[]).map(String) : [];
  const isMcq = q.question_type === "multiple_choice" || q.question_type === "multiple_choice_multi";
  const opts = isMcq ? [...rawOpts, "", "", "", ""].slice(0, 4) : rawOpts.length > 0 ? rawOpts : ["", "", "", ""];
  let correctIndex = 0;
  let correctTriple = "";
  const c = q.correct_json;
  if (c && typeof c === "object" && "kind" in c) {
    const co = c as unknown as { kind?: string; index?: number; value?: string };
    if (co.kind === "index" && typeof co.index === "number") correctIndex = co.index;
    if (co.kind === "triple" && typeof co.value === "string") correctTriple = co.value;
  }
  return {
    tempId: q.id,
    module: (["listening", "reading", "writing", "speaking"].includes(q.module)
      ? q.module
      : "reading") as QuestionDraft["module"],
    question_type: q.question_type || "multiple_choice",
    prompt: q.prompt || "",
    options: opts,
    correctIndex,
    correctTriple,
    points: q.points ?? 1,
  };
}

function toWizardQuestion(q: QuestionDraft): WizardQuestionInput {
  let options_json: unknown = q.options.map((s) => s.trim()).filter(Boolean);
  let correct_json: unknown = { kind: "rubric", value: "" };

  if (q.question_type === "true_false_not_given") {
    options_json = ["True", "False", "Not Given"];
    correct_json = { kind: "triple", value: q.correctTriple || "not_given" };
  } else if (q.question_type === "yes_no_not_given") {
    options_json = ["Yes", "No", "Not Given"];
    correct_json = { kind: "triple", value: q.correctTriple || "not_given" };
  } else if (q.question_type === "multiple_choice" || q.question_type === "multiple_choice_multi") {
    correct_json = { kind: "index", index: Math.max(0, q.correctIndex) };
  }

  return {
    module: q.module,
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
  const [description, setDescription] = useState(initialExam?.description ?? "");
  const [difficulty, setDifficulty] = useState(initialExam?.difficulty ?? "intermediate");
  const [durationMinutes, setDurationMinutes] = useState(initialExam?.duration_minutes ?? 60);
  const [priceDollars, setPriceDollars] = useState(
    initialExam ? (initialExam.price_cents / 100).toFixed(2) : "29.99",
  );
  const [currency, setCurrency] = useState(initialExam?.currency ?? "USD");
  const [coverUrl, setCoverUrl] = useState(initialExam?.cover_image_url ?? "");
  const [isPublished, setIsPublished] = useState(initialExam?.is_published ?? false);

  const { exam_type, modules } = useMemo(() => modulesFromSurface(surface), [surface]);

  const [questions, setQuestions] = useState<QuestionDraft[]>(() =>
    initialQuestions.length ? initialQuestions.map(dbQuestionToDraft) : [],
  );

  const [listeningClips, setListeningClips] = useState<ListeningClip[]>(() =>
    parseListeningClips(initialExam?.listening_audio_json),
  );

  /* Active module tab for the Questions step (for "full" exams only) */
  const [activeModuleTab, setActiveModuleTab] = useState<string>(modules[0] ?? "listening");

  const hasListening = modules.includes("listening");

  const setListeningPartUrl = useCallback((part: number, url: string) => {
    const t = url.trim();
    if (!t) {
      setListeningClips((prev) => prev.filter((c) => c.part !== part));
      return;
    }
    setListeningClips((prev) => {
      const rest = prev.filter((c) => c.part !== part);
      return [...rest, { part, url: t, title: `Part ${part}` }].sort((a, b) => a.part - b.part);
    });
  }, []);

  const handleSurface = (s: Surface) => {
    setSurface(s);
    const { modules: m } = modulesFromSurface(s);
    const catId = categoryForSurface(s, categories);
    if (catId) setCategoryId(catId);
    setActiveModuleTab(m[0] ?? "listening");
  };

  const addQuestion = (mod: QuestionDraft["module"]) => {
    setQuestions((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        module: mod,
        question_type: "multiple_choice",
        prompt: "",
        options: ["", "", "", ""],
        correctIndex: 0,
        correctTriple: "true",
        points: 1,
      },
    ]);
  };

  const removeQuestion = (tempId: string) => {
    setQuestions((prev) => prev.filter((q) => q.tempId !== tempId));
  };

  const updateQuestion = (tempId: string, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) => prev.map((q) => (q.tempId === tempId ? { ...q, ...patch } : q)));
  };

  /* ── Build payload ────────────────────────────────────── */
  const buildPayload = (published: boolean): ExamWizardSaveInput => {
    const price_cents = Math.round(Number.parseFloat(priceDollars || "0") * 100) || 0;
    // Auto-derive structure from questions added
    const structure: SectionStructure[] = structureForModules(modules).map((s) => ({
      ...s,
      questions: questions.filter((q) => q.module === s.module).length,
      enabled: modules.includes(s.module),
    }));
    const qCount = questions.length || 1;

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
      currency: currency.trim() || "USD",
      cover_image_url: coverUrl.trim() || null,
      is_published: published,
      structure_json: structure,
      scoring_json: DEFAULT_SCORING,
      listening_audio_json: hasListening ? listeningClips : [],
      questions: questions.map(toWizardQuestion),
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
    for (const q of questions) {
      if (counts[q.module] !== undefined) counts[q.module]++;
    }
    return counts;
  }, [questions, modules]);

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
              <label className="admin-label" htmlFor="ew-slug">
                URL slug (required)
              </label>
              <input
                id="ew-slug"
                className="admin-input"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                placeholder="academic-full-mock-1"
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
                <label className="admin-label" htmlFor="ew-price">
                  Price (USD)
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
            </div>
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
              <span className="admin-label">Status</span>
              <div className="admin-segment" style={{ marginTop: "0.35rem" }}>
                <label>
                  <input type="radio" name="pub" checked={!isPublished} onChange={() => setIsPublished(false)} />
                  <span>Draft</span>
                </label>
                <label>
                  <input type="radio" name="pub" checked={isPublished} onChange={() => setIsPublished(true)} />
                  <span>Published</span>
                </label>
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
            Switch between module tabs to manage questions per section.
          </p>

          {/* Module tabs — only shown for full test */}
          {modules.length > 1 ? (
            <div className="admin-module-tabs">
              {modules.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`admin-module-tab${activeModuleTab === m ? " admin-module-tab--active" : ""}`}
                  onClick={() => setActiveModuleTab(m)}
                >
                  {MODULE_LABELS[m] ?? m}
                  <span className="admin-module-tab__count">{questionCounts[m] ?? 0}</span>
                </button>
              ))}
            </div>
          ) : null}

          {/* Listening audio section */}
          {(modules.length === 1 ? modules[0] === "listening" : activeModuleTab === "listening") && hasListening ? (
            <div className="admin-wizard-card" style={{ marginTop: "1rem", background: "var(--bg)" }}>
              <h3 style={{ margin: "0 0 0.35rem", fontSize: "0.95rem", fontWeight: 800 }}>
                Listening Audio Files
              </h3>
              <p style={{ margin: "0 0 1rem", color: "var(--muted)", fontSize: "0.85rem" }}>
                Upload MP3/WAV per part or paste a URL. Typical IELTS listening has 4 parts.
              </p>
              {Array.from({ length: 4 }, (_, i) => i + 1).map((part) => {
                const clip = listeningClips.find((c) => c.part === part);
                return (
                  <div key={part} className="admin-question-card" style={{ marginBottom: "0.75rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.5rem" }}>Part {part}</div>
                    {clip?.url ? (
                      <audio controls src={clip.url} style={{ width: "100%", maxWidth: "480px", marginBottom: "0.5rem" }} preload="metadata" />
                    ) : null}
                    <div className="admin-form-grid admin-form-grid--2">
                      <div>
                        <ExamLocalUpload
                          folder="listening"
                          accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/webm,audio/ogg,.mp3,.wav,.webm,.ogg"
                          disabled={pending}
                          onUploaded={(url) => setListeningPartUrl(part, url)}
                        />
                      </div>
                      <div>
                        <label className="admin-label" htmlFor={`listen-url-${part}`}>Audio URL</label>
                        <input
                          id={`listen-url-${part}`}
                          className="admin-input"
                          value={clip?.url ?? ""}
                          onChange={(e) => setListeningPartUrl(part, e.target.value)}
                          placeholder="https://…"
                        />
                        {clip?.url ? (
                          <button
                            type="button"
                            className="admin-btn-ghost"
                            style={{ marginTop: "0.5rem", fontSize: "0.78rem" }}
                            onClick={() => setListeningPartUrl(part, "")}
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Question list for active module */}
          {(() => {
            const mod = (modules.length === 1 ? modules[0] : activeModuleTab) as QuestionDraft["module"];
            const modQuestions = questions.filter((q) => q.module === mod);

            return (
              <div style={{ marginTop: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
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

                {modQuestions.map((q, qIdx) => (
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

                    {/* Answer options based on question type */}
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
                    ) : q.question_type === "multiple_choice" || q.question_type === "multiple_choice_multi" ? (
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
                        <label className="admin-label">Acceptable answers (one per line)</label>
                        <textarea
                          className="admin-textarea"
                          rows={3}
                          value={q.options.join("\n")}
                          onChange={(e) =>
                            updateQuestion(q.tempId, {
                              options: e.target.value.split("\n").concat(["", "", "", ""]).slice(0, 8),
                            })
                          }
                          placeholder="For matching or completion, list pairs or acceptable short answers."
                        />
                      </div>
                    )}
                  </div>
                ))}
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
              <span className="admin-review-value">{currency} {priceDollars}</span>
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
                <span className="admin-review-value">{questions.length} question(s)</span>
              </div>
            </div>
          </div>

          {hasListening ? (
            <div style={{ marginTop: "1rem" }}>
              <span className="admin-review-label">Listening audio</span>
              <span className="admin-review-value" style={{ marginLeft: "0.5rem" }}>
                {listeningClips.filter((c) => c.url).length} / 4 parts uploaded
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
