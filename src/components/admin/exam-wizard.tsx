"use client";

import Link from "next/link";
import { GripVertical, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { saveExamWizard, type ExamWizardSaveInput, type WizardQuestionInput } from "@/app/admin/actions";
import { ExamLocalUpload } from "@/components/admin/exam-local-upload";
import {
  DEFAULT_FULL_STRUCTURE,
  DEFAULT_SCORING,
  type BandRow,
  type ScoringConfig,
  type SectionStructure,
  IELTS_QUESTION_TYPES,
  structureForModules,
} from "@/lib/exam/ielts-defaults";

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

function parseStructure(raw: unknown): SectionStructure[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_FULL_STRUCTURE];
  const out: SectionStructure[] = [];
  for (const row of raw) {
    if (row && typeof row === "object") {
      const o = row as Record<string, unknown>;
      const module = o.module as SectionStructure["module"];
      if (module === "listening" || module === "reading" || module === "writing" || module === "speaking") {
        out.push({
          module,
          label: String(o.label ?? module),
          parts: Math.max(1, Number(o.parts) || 1),
          questions: Math.max(0, Number(o.questions) || 0),
          enabled: o.enabled !== false,
        });
      }
    }
  }
  return out.length ? out : [...DEFAULT_FULL_STRUCTURE];
}

function parseScoring(raw: unknown): ScoringConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SCORING, bands: [...DEFAULT_SCORING.bands] };
  const o = raw as Record<string, unknown>;
  const bandsRaw = o.bands;
  let bands: BandRow[] = [...DEFAULT_SCORING.bands];
  if (Array.isArray(bandsRaw)) {
    const next: BandRow[] = [];
    for (const b of bandsRaw) {
      if (b && typeof b === "object") {
        const r = b as Record<string, unknown>;
        next.push({
          band: Number(r.band) || 0,
          minCorrect: Number(r.minCorrect) || 0,
          maxCorrect: Number(r.maxCorrect) || 0,
        });
      }
    }
    if (next.length) bands = next;
  }
  const sm = (o.sectionMinutes && typeof o.sectionMinutes === "object"
    ? (o.sectionMinutes as Record<string, number>)
    : {}) as Partial<ScoringConfig["sectionMinutes"]>;
  return {
    bands,
    minPassingBand: Number(o.minPassingBand) || DEFAULT_SCORING.minPassingBand,
    sectionMinutes: {
      listening: sm.listening ?? DEFAULT_SCORING.sectionMinutes.listening,
      reading: sm.reading ?? DEFAULT_SCORING.sectionMinutes.reading,
      writing: sm.writing ?? DEFAULT_SCORING.sectionMinutes.writing,
      speaking: sm.speaking ?? DEFAULT_SCORING.sectionMinutes.speaking,
    },
    feedbackTemplate:
      typeof o.feedbackTemplate === "string" && o.feedbackTemplate
        ? o.feedbackTemplate
        : DEFAULT_SCORING.feedbackTemplate,
  };
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
    const k = co.kind;
    if (k === "index" && typeof co.index === "number") {
      correctIndex = co.index;
    }
    if (k === "triple" && typeof co.value === "string") {
      correctTriple = co.value;
    }
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
    const v = q.correctTriple || "not_given";
    correct_json = { kind: "triple", value: v };
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

const STEPS = ["Basic Info", "Exam Structure", "Questions", "Scoring", "Preview"] as const;

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

  const [categoryId, setCategoryId] = useState(initialExam?.category_id ?? categories[0]?.id ?? "");
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

  const [structure, setStructure] = useState<SectionStructure[]>(() => {
    if (initialExam?.structure_json != null) {
      const base = parseStructure(initialExam.structure_json);
      return base.map((s) => ({ ...s, enabled: modules.includes(s.module) }));
    }
    return structureForModules(modulesFromSurface(initialSurface).modules);
  });

  const [scoring, setScoring] = useState<ScoringConfig>(() =>
    initialExam?.scoring_json != null ? parseScoring(initialExam.scoring_json) : { ...DEFAULT_SCORING, bands: [...DEFAULT_SCORING.bands] },
  );

  const [questions, setQuestions] = useState<QuestionDraft[]>(() =>
    initialQuestions.length ? initialQuestions.map(dbQuestionToDraft) : [],
  );

  const [listeningClips, setListeningClips] = useState<ListeningClip[]>(() =>
    parseListeningClips(initialExam?.listening_audio_json),
  );

  const hasListening = modules.includes("listening");
  const listeningPartCount = structure.find((s) => s.module === "listening")?.parts ?? 4;

  useEffect(() => {
    const max = structure.find((s) => s.module === "listening")?.parts ?? 4;
    setListeningClips((prev) => prev.filter((c) => c.part >= 1 && c.part <= max));
  }, [structure]);

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

  const syncStructureModules = useCallback(
    (mods: string[]) => {
      setStructure((prev) => {
        const template = prev.length ? prev : parseStructure(undefined);
        return template.map((s) => ({
          ...s,
          enabled: mods.includes(s.module),
        }));
      });
    },
    [],
  );

  const defaultModuleForNewQuestion = useMemo(() => {
    const en = structure.find((s) => s.enabled);
    return (en?.module ?? modules[0] ?? "reading") as QuestionDraft["module"];
  }, [structure, modules]);

  const handleSurface = (s: Surface) => {
    setSurface(s);
    const { modules: m } = modulesFromSurface(s);
    syncStructureModules(m);
  };

  const questionCountTotal = useMemo(() => {
    return structure.filter((s) => s.enabled).reduce((acc, s) => acc + (s.questions || 0), 0);
  }, [structure]);

  const addQuestion = () => {
    const mod = defaultModuleForNewQuestion;
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

  const buildPayload = (published: boolean): ExamWizardSaveInput => {
    const price_cents = Math.round(Number.parseFloat(priceDollars || "0") * 100) || 0;
    const structureOut = structure.map((s) => ({
      ...s,
      enabled: exam_type === "full" ? true : s.enabled && modules.includes(s.module),
    }));
    const qCount =
      questionCountTotal > 0 ? questionCountTotal : Math.max(questions.length, Number(initialExam?.question_count) || 1);

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
      structure_json: structureOut,
      scoring_json: scoring,
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

  return (
    <div>
      <div className="admin-wizard-toolbar">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/admin/exams" className="admin-wizard-back">
            ← Back to Dashboard
          </Link>
          <span style={{ color: "var(--border)", fontWeight: 300 }}>|</span>
          <span className="admin-wizard-title">{isEdit ? "Edit exam" : "Create New Exam"}</span>
        </div>
        <div className="admin-wizard-actions">
          <button type="button" className="btn btn-outline" disabled={pending} onClick={() => runSave(isPublished)}>
            Save Draft
          </button>
          <button
            type="button"
            className="btn btn-primary btn-topbar-cta"
            disabled={pending}
            onClick={() => {
              setIsPublished(true);
              runSave(true);
              setStep(4);
            }}
          >
            Preview &amp; Publish
          </button>
        </div>
      </div>

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
              <label className="admin-label" htmlFor="ew-cat">
                Catalog category
              </label>
              <select
                id="ew-cat"
                className="admin-select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="admin-label">Exam type (required)</span>
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
              <span className="admin-label">Difficulty (required)</span>
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
                <label className="admin-label" htmlFor="ew-qhint">
                  Questions (hint)
                </label>
                <input
                  id="ew-qhint"
                  type="number"
                  min={0}
                  className="admin-input"
                  value={questionCountTotal || questions.length}
                  readOnly
                  title="Derived from exam structure and question bank"
                />
              </div>
            </div>
            <div className="admin-form-grid admin-form-grid--2">
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
                <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0.35rem 0 0" }}>
                  Enter 0 for free exams.
                </p>
              </div>
              <div>
                <label className="admin-label" htmlFor="ew-cur">
                  Currency
                </label>
                <input
                  id="ew-cur"
                  className="admin-input"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="admin-label">Thumbnail</label>
              <div className="admin-dropzone">
                <label className="admin-label" htmlFor="ew-cover" style={{ marginBottom: "0.5rem" }}>
                  Image URL (optional — or upload from disk)
                </label>
                <input
                  id="ew-cover"
                  className="admin-input"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://…"
                />
                <div style={{ marginTop: "0.85rem" }}>
                  <ExamLocalUpload
                    folder="covers"
                    accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                    label="Upload cover image"
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
                  <input
                    type="radio"
                    name="pub"
                    checked={!isPublished}
                    onChange={() => setIsPublished(false)}
                  />
                  <span>Draft</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="pub"
                    checked={isPublished}
                    onChange={() => setIsPublished(true)}
                  />
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

      {step === 1 ? (
        <div className="admin-wizard-card">
          <h2>Exam structure</h2>
          <p>
            Full tests follow IELTS timing: Listening 4 parts, Reading 3 passages, Writing 2 tasks, Speaking 3 parts.
            Adjust counts to match your content.
          </p>
          <div className="admin-structure-grid" style={{ marginTop: "1rem" }}>
            {structure.map((s, idx) => (
              <div key={s.module} className="admin-section-card">
                <div className="admin-section-card__head">
                  <label>
                    <input
                      type="checkbox"
                      checked={exam_type === "full" ? true : s.enabled}
                      disabled={exam_type === "full"}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setStructure((prev) => prev.map((x, i) => (i === idx ? { ...x, enabled: on } : x)));
                      }}
                    />
                    {s.label}
                  </label>
                  <span className={`admin-tag admin-tag--${s.module}`}>{s.module}</span>
                </div>
                <div className="admin-form-grid admin-form-grid--2">
                  <div>
                    <label className="admin-label">Parts</label>
                    <input
                      type="number"
                      min={1}
                      className="admin-input"
                      value={s.parts}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 1;
                        setStructure((prev) => prev.map((x, i) => (i === idx ? { ...x, parts: v } : x)));
                      }}
                    />
                  </div>
                  <div>
                    <label className="admin-label">Questions / tasks</label>
                    <input
                      type="number"
                      min={0}
                      className="admin-input"
                      value={s.questions}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 0;
                        setStructure((prev) => prev.map((x, i) => (i === idx ? { ...x, questions: v } : x)));
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasListening ? (
            <div
              style={{
                marginTop: "1.5rem",
                paddingTop: "1.25rem",
                borderTop: "1px solid var(--border)",
              }}
            >
              <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.05rem", fontWeight: 800 }}>Listening audio</h3>
              <p style={{ margin: "0 0 1rem", color: "var(--muted)", fontSize: "0.9rem" }}>
                Upload MP3/WAV/WebM from your computer or paste a URL. Files go to Supabase Storage; the public link is
                stored on this exam (one per part — typical IELTS listening has four parts).
              </p>
              {Array.from({ length: listeningPartCount }, (_, i) => i + 1).map((part) => {
                const clip = listeningClips.find((c) => c.part === part);
                return (
                  <div
                    key={part}
                    style={{
                      display: "grid",
                      gap: "0.65rem",
                      marginBottom: "1rem",
                      padding: "0.85rem 1rem",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      background: "color-mix(in srgb, var(--bg-alt) 70%, var(--surface))",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: "0.92rem" }}>Part {part}</div>
                    {clip?.url ? (
                      <audio controls src={clip.url} style={{ width: "100%", maxWidth: "480px" }} preload="metadata" />
                    ) : null}
                    <ExamLocalUpload
                      folder="listening"
                      accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/webm,audio/ogg,.mp3,.wav,.webm,.ogg"
                      label="Upload audio file"
                      disabled={pending}
                      onUploaded={(url) => setListeningPartUrl(part, url)}
                    />
                    <div>
                      <label className="admin-label" htmlFor={`listen-url-${part}`}>
                        Or paste audio URL
                      </label>
                      <input
                        id={`listen-url-${part}`}
                        className="admin-input"
                        value={clip?.url ?? ""}
                        onChange={(e) => setListeningPartUrl(part, e.target.value)}
                        placeholder="https://…"
                      />
                    </div>
                    {clip?.url ? (
                      <button
                        type="button"
                        className="admin-btn-ghost"
                        style={{ justifySelf: "start", fontSize: "0.82rem" }}
                        onClick={() => setListeningPartUrl(part, "")}
                      >
                        Clear part {part}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="admin-wizard-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <h2 style={{ margin: 0 }}>Questions</h2>
            <button type="button" className="btn btn-primary btn-topbar-cta" onClick={addQuestion}>
              + Add question
            </button>
          </div>
          <p style={{ marginTop: "0.5rem" }}>
            Use IELTS-style task types (multiple choice, TFNG, matching, completion, etc.). The take flow will use this
            bank next.
          </p>
          {questions.length === 0 ? (
            <p style={{ color: "var(--muted)", marginTop: "1rem" }}>No questions yet. Add one to build your test.</p>
          ) : null}
          {questions.map((q) => (
            <div key={q.tempId} className="admin-question-card">
              <div className="admin-question-card__bar">
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    color: "var(--muted)",
                    fontSize: "0.85rem",
                  }}
                >
                  <GripVertical style={{ width: "1rem", height: "1rem", opacity: 0.65 }} aria-hidden />
                  Drag order (coming soon)
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
              <div className="admin-form-grid admin-form-grid--2">
                <div>
                  <label className="admin-label">Module</label>
                  <select
                    className="admin-select"
                    value={q.module}
                    onChange={(e) =>
                      updateQuestion(q.tempId, { module: e.target.value as QuestionDraft["module"] })
                    }
                  >
                    {modules.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
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
              </div>
              <div style={{ marginTop: "0.65rem" }}>
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
              ) : q.question_type === "multiple_choice" || q.question_type === "multiple_choice_multi" ? (
                <>
                  <p className="admin-label" style={{ marginTop: "0.65rem" }}>
                    Options (multiple choice)
                  </p>
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
                  <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Select the correct answer.</p>
                </>
              ) : (
                <div style={{ marginTop: "0.65rem" }}>
                  <label className="admin-label" htmlFor={`extra-${q.tempId}`}>
                    Stimulus / pairs / acceptable answers (one per line, optional)
                  </label>
                  <textarea
                    id={`extra-${q.tempId}`}
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
              <div style={{ marginTop: "0.65rem", maxWidth: "8rem" }}>
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
          ))}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="admin-wizard-card">
          <h2>Scoring &amp; results</h2>
          <p>Map raw scores to IELTS bands and set per-section timing (used when the player ships).</p>
          <p className="admin-label" style={{ marginTop: "1rem" }}>
            Band score mapping (raw correct → band)
          </p>
          <div className="admin-table-wrap" style={{ maxWidth: "520px", marginTop: "0.5rem" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Band</th>
                  <th>Min correct (raw)</th>
                  <th>Max correct (raw)</th>
                </tr>
              </thead>
              <tbody>
                {scoring.bands.map((b, i) => (
                  <tr key={`${b.band}-${i}`}>
                    <td style={{ fontWeight: 700 }}>{b.band}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        className="admin-input"
                        value={b.minCorrect}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          setScoring((prev) => ({
                            ...prev,
                            bands: prev.bands.map((x, j) => (j === i ? { ...x, minCorrect: v } : x)),
                          }));
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        className="admin-input"
                        value={b.maxCorrect}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          setScoring((prev) => ({
                            ...prev,
                            bands: prev.bands.map((x, j) => (j === i ? { ...x, maxCorrect: v } : x)),
                          }));
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: "1rem", maxWidth: "12rem" }}>
            <label className="admin-label">Minimum passing band</label>
            <input
              type="number"
              step="0.5"
              min={0}
              max={9}
              className="admin-input"
              value={scoring.minPassingBand}
              onChange={(e) =>
                setScoring((s) => ({ ...s, minPassingBand: Number(e.target.value) || 0 }))
              }
            />
          </div>
          <p className="admin-label" style={{ marginTop: "1rem" }}>
            Time limits per section (minutes)
          </p>
          <div className="admin-form-grid admin-form-grid--2">
            {(["listening", "reading", "writing", "speaking"] as const).map((k) => (
              <div key={k}>
                <label className="admin-label">{k}</label>
                <input
                  type="number"
                  min={1}
                  className="admin-input"
                  value={scoring.sectionMinutes[k]}
                  onChange={(e) =>
                    setScoring((s) => ({
                      ...s,
                      sectionMinutes: { ...s.sectionMinutes, [k]: Number(e.target.value) || 1 },
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <label className="admin-label">Result feedback template</label>
            <textarea
              className="admin-textarea"
              rows={4}
              value={scoring.feedbackTemplate}
              onChange={(e) => setScoring((s) => ({ ...s, feedbackTemplate: e.target.value }))}
            />
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0.35rem 0 0" }}>
              Use {"{score}"} to insert the student&apos;s score.
            </p>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="admin-wizard-card">
          <h2>Preview</h2>
          <p>Summary before students see this on the catalog.</p>
          <ul style={{ lineHeight: 1.85, paddingLeft: "1.2rem" }}>
            <li>
              <strong>{title || "(Untitled)"}</strong> — {surface === "full" ? "Full test" : surface}
            </li>
            <li>
              {isPublished ? "Published" : "Draft"} · {difficulty} · {durationMinutes} min · {currency}{" "}
              {priceDollars}
            </li>
            <li>{questions.length} question(s) in bank</li>
            {hasListening ? (
              <li>
                Listening audio: {listeningClips.filter((c) => c.url).length} / {listeningPartCount} part(s) with a URL
              </li>
            ) : null}
            <li>
              Sections:{" "}
              {structure
                .filter((s) => s.enabled)
                .map((s) => `${s.label} (${s.questions} Q)`)
                .join(", ") || "—"}
            </li>
          </ul>
          <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <Link href="/mock-exam" className="btn btn-outline">
              View catalog
            </Link>
            {slug ? (
              <Link href={`/mock-exam/${slug}/take`} className="btn btn-outline">
                Open take page
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

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
