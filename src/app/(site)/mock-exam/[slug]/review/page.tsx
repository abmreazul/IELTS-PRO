import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, CircleHelp, Mic, Sparkles, XCircle } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { WritingAiReview } from "@/lib/ai/writing-review";
import type { SpeakingReview } from "@/lib/ai/speaking-review";
import { normalizeExamModules } from "@/lib/exam/ielts-defaults";
import "./review.css";

export const metadata: Metadata = {
  title: "Review results | The IELTS Exam",
};

const CRITERIA_LABELS: Record<string, string> = {
  task_response: "Task Response",
  coherence: "Coherence & Cohesion",
  lexical: "Lexical Resource",
  grammar: "Grammar & Accuracy",
};

const MODULE_LABELS: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: "Multiple choice",
  multiple_choice_multi: "Multiple choice",
  true_false_not_given: "True / False / Not Given",
  yes_no_not_given: "Yes / No / Not Given",
  completion: "Completion",
  short_answer: "Short answer",
  fill_in_blank: "Fill in the blank",
  sentence_completion: "Sentence completion",
  matching_headings: "Matching headings",
  matching_information: "Matching information",
  matching_features: "Matching features",
  sentence_endings: "Sentence endings",
  map_diagram_labeling: "Map / diagram labelling",
  matching: "Matching",
  essay: "Writing task",
  speaking_prompt: "Speaking prompt",
};

type CorrectJson =
  | { kind: "index"; index?: unknown }
  | { kind: "triple"; value?: unknown }
  | { kind: "rubric"; value?: unknown }
  | Record<string, unknown>
  | null;

type QuestionReviewRow = {
  id: string;
  module: string;
  question_type: string;
  prompt: string | null;
  options_json: unknown;
  correct_json: CorrectJson;
  points: number | null;
  sort_order: number;
};

type ObjectiveReview = {
  status: "correct" | "incorrect" | "unanswered" | "unscored";
  earned: number;
  possible: number;
  userAnswer: string;
  correctAnswer: string;
  hasAnswerKey: boolean;
};

function normalizeText(value: unknown) {
  return String(value ?? "").toLowerCase().trim();
}

function titleCaseChoice(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAnswerValue(value: unknown, question: QuestionReviewRow) {
  if (value === undefined || value === null || value === "") return "Not answered";
  const options = Array.isArray(question.options_json) ? question.options_json.map(String) : [];
  const correct = question.correct_json;

  if (correct && typeof correct === "object" && "kind" in correct && correct.kind === "index") {
    const index = Number(value);
    const option = Number.isFinite(index) ? options[index] : null;
    return option ? `${String.fromCharCode(65 + index)}. ${option}` : String(value);
  }

  if (correct && typeof correct === "object" && "kind" in correct && correct.kind === "triple") {
    return titleCaseChoice(value);
  }

  if (typeof value === "object") {
    const ref = value as Record<string, unknown>;
    if (ref.kind === "audio_recording") {
      const duration = Math.max(0, Number(ref.durationSeconds) || 0);
      return duration > 0 ? `Audio recording (${Math.round(duration)}s)` : "Audio recording";
    }
    return "Submitted";
  }

  return String(value);
}

function formatCorrectAnswer(question: QuestionReviewRow) {
  const correct = question.correct_json;
  if (!correct || typeof correct !== "object" || !("kind" in correct)) return "No answer key";
  const options = Array.isArray(question.options_json) ? question.options_json.map(String) : [];

  if (correct.kind === "index") {
    const index = Number(correct.index);
    const option = Number.isFinite(index) ? options[index] : null;
    return option ? `${String.fromCharCode(65 + index)}. ${option}` : "No answer key";
  }

  if (correct.kind === "triple") {
    return titleCaseChoice(correct.value);
  }

  if (correct.kind === "rubric") {
    const value = String(correct.value ?? "").trim();
    return value || "No answer key";
  }

  return "No answer key";
}

function scoreObjectiveQuestion(question: QuestionReviewRow, rawAnswer: unknown): ObjectiveReview {
  const possible = Math.max(0, Number(question.points) || 1);
  const correct = question.correct_json;
  const userAnswer = formatAnswerValue(rawAnswer, question);
  const correctAnswer = formatCorrectAnswer(question);

  if (rawAnswer === undefined || rawAnswer === null || rawAnswer === "") {
    return {
      status: "unanswered",
      earned: 0,
      possible,
      userAnswer,
      correctAnswer,
      hasAnswerKey: Boolean(correct && typeof correct === "object" && "kind" in correct),
    };
  }

  if (!correct || typeof correct !== "object" || !("kind" in correct)) {
    return {
      status: "unscored",
      earned: 0,
      possible,
      userAnswer,
      correctAnswer,
      hasAnswerKey: false,
    };
  }

  let isCorrect = false;
  if (correct.kind === "index") {
    isCorrect = Number(rawAnswer) === Number(correct.index);
  } else if (correct.kind === "triple") {
    isCorrect = normalizeText(rawAnswer) === normalizeText(correct.value);
  } else if (correct.kind === "rubric") {
    isCorrect = normalizeText(rawAnswer) === normalizeText(correct.value);
  }

  return {
    status: isCorrect ? "correct" : "incorrect",
    earned: isCorrect ? possible : 0,
    possible,
    userAnswer,
    correctAnswer,
    hasAnswerKey: true,
  };
}

function decodeQuestionPart(sortOrder: number, fallback = 1) {
  if (sortOrder >= 100) return Math.max(1, Math.floor(sortOrder / 100));
  return fallback;
}

function questionImageUrl(question: QuestionReviewRow) {
  if (!question.options_json || typeof question.options_json !== "object" || Array.isArray(question.options_json)) {
    return "";
  }
  const value = question.options_json as Record<string, unknown>;
  return typeof value.image_url === "string" ? value.image_url.trim() : "";
}

function isObjectiveQuestion(questionType: string) {
  return !["essay", "speaking_prompt"].includes(questionType);
}

export default async function ReviewMockExamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ user }, supabase] = await Promise.all([getAuthUser(), createClient()]);

  const { data: exam } = await supabase
    .from("mock_exams")
    .select("id, title, modules")
    .eq("slug", slug)
    .maybeSingle();

  if (!exam) {
    return (
      <main className="rv">
        <div className="rv__inner">
          <div className="rv__header">
            <h1 className="rv__title">Review results</h1>
            <p className="rv__exam-name">This exam could not be found.</p>
          </div>
          <div className="rv__actions">
            <Link href="/mock-exam" className="btn btn-outline">Back to mock exams</Link>
          </div>
        </div>
      </main>
    );
  }

  let attempt: {
    id: string;
    status: string;
    review_status: string | null;
    overall_band: number | null;
    listening_band: number | null;
    reading_band: number | null;
    writing_band: number | null;
    speaking_band: number | null;
    answers_json: Record<string, unknown> | null;
    completed_at: string | null;
    created_at: string;
    ai_review_json?: WritingAiReview | null;
    speaking_review_json?: SpeakingReview | null;
  } | null = null;

  if (user) {
    const primary = await supabase
      .from("mock_attempts")
      .select("id, status, review_status, overall_band, listening_band, reading_band, writing_band, speaking_band, answers_json, completed_at, created_at, ai_review_json, speaking_review_json")
      .eq("exam_id", exam.id)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (primary.error && (primary.error.message.includes("ai_review_json") || primary.error.message.includes("speaking_review_json"))) {
      const fallback = await supabase
        .from("mock_attempts")
        .select("id, status, review_status, overall_band, listening_band, reading_band, writing_band, speaking_band, answers_json, completed_at, created_at")
        .eq("exam_id", exam.id)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      attempt = fallback.data;
    } else {
      attempt = primary.data;
    }
  }

  const questionsRaw = attempt
    ? (await createServiceRoleClient()
        .from("exam_questions")
        .select("id, module, question_type, prompt, options_json, correct_json, points, sort_order")
        .eq("exam_id", exam.id)
        .order("sort_order")).data
    : [];

  const reviewPending = attempt?.review_status === "pending";
  const answers = attempt?.answers_json && typeof attempt.answers_json === "object"
    ? attempt.answers_json as Record<string, unknown>
    : {};
  const aiReview = attempt?.ai_review_json && typeof attempt.ai_review_json === "object"
    ? attempt.ai_review_json as WritingAiReview
    : null;
  const speakingReview = attempt?.speaking_review_json && typeof attempt.speaking_review_json === "object"
    ? attempt.speaking_review_json as SpeakingReview
    : null;
  const activeModules = normalizeExamModules(exam.modules);
  const activeModuleSet = new Set(activeModules);
  const questions = ((questionsRaw ?? []) as QuestionReviewRow[]).filter((question) =>
    activeModuleSet.has(question.module as never),
  );
  const questionsByModule = activeModules
    .map((module) => ({
      module,
      questions: questions.filter((question) => {
        if (question.module !== module) return false;
        // Skip speaking questions when a full speaking review exists —
        // the detailed assessment is rendered in its own section below.
        if (question.module === "speaking" && speakingReview) return false;
        return true;
      }),
    }))
    .filter((section) => section.questions.length > 0);

  const objectiveReviews = new Map<string, ObjectiveReview>();
  for (const question of questions) {
    if (isObjectiveQuestion(question.question_type)) {
      objectiveReviews.set(question.id, scoreObjectiveQuestion(question, answers[question.id]));
    }
  }
  const objectiveRows = Array.from(objectiveReviews.values()).filter((row) => row.hasAnswerKey);
  const objectiveCorrect = objectiveRows.filter((row) => row.status === "correct").length;
  const objectiveTotal = objectiveRows.length;
  const objectiveEarnedMarks = objectiveRows.reduce((sum, row) => sum + row.earned, 0);
  const objectivePossibleMarks = objectiveRows.reduce((sum, row) => sum + row.possible, 0);

  type SummaryCard = { label: string; value: number | string | null };
  const summaryCards: SummaryCard[] = attempt
    ? ([
        activeModules.length > 1
          ? { label: "Overall", value: attempt.overall_band }
          : null,
        activeModules.includes("listening")
          ? { label: "Listening", value: attempt.listening_band }
          : null,
        activeModules.includes("reading")
          ? { label: "Reading", value: attempt.reading_band }
          : null,
        activeModules.includes("writing")
          ? {
              label: "Writing",
              value: reviewPending ? "Pending" : attempt.writing_band,
            }
          : null,
        activeModules.includes("speaking")
          ? {
              label: "Speaking",
              value: reviewPending ? "Pending" : attempt.speaking_band,
            }
          : null,
      ].filter(Boolean) as SummaryCard[])
    : [];

  return (
    <main className="rv">
      <div className="rv__inner">
        {/* Header */}
        <div className="rv__header">
          <h1 className="rv__title">Review results</h1>
          <p className="rv__exam-name">{exam.title}</p>
        </div>

        {!attempt ? (
          <p className="rv__empty">No completed submission was found for this exam yet.</p>
        ) : (
          <>
            {/* Overall band hero */}
            {attempt.overall_band != null ? (
              <div className="rv__band-hero">
                <span className="rv__band-label">Overall Band Score</span>
                <span className="rv__band-value">{attempt.overall_band.toFixed(1)}</span>
              </div>
            ) : null}

            {/* Module bands */}
            <div className="rv__modules">
              {summaryCards.map((card) => (
                <div key={card.label} className="rv__module-card">
                  <span className="rv__module-name">{card.label}</span>
                  {typeof card.value === "number" ? (
                    <span className="rv__module-score">{card.value.toFixed(1)}</span>
                  ) : (
                    <span className="rv__module-score rv__module-score--pending">{card.value ?? "—"}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Pending message */}
            {reviewPending ? (
              <div className="rv__pending-msg">
                Your submission was saved, but the assessment did not finish for this older attempt. Retake the exam to receive instant marking.
              </div>
            ) : null}

            {/* Question-by-question review */}
            {questionsByModule.length > 0 ? (
              <section className="rv__answers" aria-labelledby="question-review-title">
                <div className="rv__section-head">
                  <div>
                    <h2 id="question-review-title" className="rv__section-title">Question Review</h2>
                    <p className="rv__section-sub">
                      See your submitted answers, correct answers, and marks for every scored question.
                    </p>
                  </div>
                  {objectiveTotal > 0 ? (
                    <div className="rv__raw-score">
                      <span>{objectiveCorrect} / {objectiveTotal}</span>
                      <small>{objectiveEarnedMarks} / {objectivePossibleMarks} marks</small>
                    </div>
                  ) : null}
                </div>

                {questionsByModule.map((section) => {
                  const sectionObjective = section.questions
                    .map((question) => objectiveReviews.get(question.id))
                    .filter((row): row is ObjectiveReview => Boolean(row?.hasAnswerKey));
                  const sectionEarned = sectionObjective.reduce((sum, row) => sum + row.earned, 0);
                  const sectionPossible = sectionObjective.reduce((sum, row) => sum + row.possible, 0);

                  return (
                    <div key={section.module} className="rv__answer-section">
                      <div className="rv__answer-section-head">
                        <h3>{MODULE_LABELS[section.module] ?? section.module}</h3>
                        {sectionObjective.length > 0 ? (
                          <span>{sectionEarned} / {sectionPossible} marks</span>
                        ) : (
                          <span>Criterion marked</span>
                        )}
                      </div>

                      <div className="rv__answer-list">
                        {section.questions.map((question, index) => {
                          const objective = objectiveReviews.get(question.id);
                          const part = decodeQuestionPart(question.sort_order, 1);
                          const imageUrl = questionImageUrl(question);
                          const writingTask = aiReview?.tasks.find((task) => task.part === part);
                          const speakingQuestion = speakingReview?.questions.find((item) => item.question_id === question.id)
                            ?? speakingReview?.questions.find((item) => item.part === part && item.prompt === question.prompt);

                          const status = objective?.status ?? (question.question_type === "essay" || question.question_type === "speaking_prompt" ? "assessed" : "unscored");
                          const statusClass = status === "correct"
                            ? "rv__status--correct"
                            : status === "incorrect"
                              ? "rv__status--incorrect"
                              : status === "unanswered"
                                ? "rv__status--unanswered"
                                : "rv__status--neutral";
                          const statusIcon = status === "correct"
                            ? <CheckCircle2 size={18} aria-hidden />
                            : status === "incorrect"
                              ? <XCircle size={18} aria-hidden />
                              : <CircleHelp size={18} aria-hidden />;

                          return (
                            <article key={question.id} className="rv__answer-card">
                              <div className="rv__answer-top">
                                <div>
                                  <p className="rv__answer-kicker">
                                    Question {index + 1} · {QUESTION_TYPE_LABELS[question.question_type] ?? question.question_type}
                                  </p>
                                  <h4>{question.prompt || "Untitled question"}</h4>
                                </div>
                                <span className={`rv__status ${statusClass}`}>
                                  {statusIcon}
                                  {status === "correct"
                                    ? "Correct"
                                    : status === "incorrect"
                                      ? "Incorrect"
                                      : status === "unanswered"
                                        ? "Unanswered"
                                        : status === "assessed"
                                          ? "Assessed"
                                          : "Not scored"}
                                </span>
                              </div>

                              {imageUrl ? <img src={imageUrl} alt="" className="rv__answer-img" /> : null}

                              {objective ? (
                                <div className="rv__answer-grid">
                                  <div>
                                    <span>Your answer</span>
                                    <strong className={objective.status === "unanswered" ? "rv__muted-answer" : ""}>
                                      {objective.userAnswer}
                                    </strong>
                                  </div>
                                  <div>
                                    <span>Correct answer</span>
                                    <strong>{objective.correctAnswer}</strong>
                                  </div>
                                  <div>
                                    <span>Marks</span>
                                    <strong>{objective.earned} / {objective.possible}</strong>
                                  </div>
                                </div>
                              ) : question.question_type === "essay" ? (
                                <div className="rv__answer-grid rv__answer-grid--wide">
                                  <div>
                                    <span>Your response</span>
                                    <strong className="rv__long-answer">
                                      {formatAnswerValue(answers[question.id], question)}
                                    </strong>
                                  </div>
                                  <div>
                                    <span>Assessment</span>
                                    <strong>{writingTask ? `Band ${writingTask.estimated_band.toFixed(1)} · ${writingTask.word_count} words` : "Saved for assessment"}</strong>
                                  </div>
                                </div>
                              ) : question.question_type === "speaking_prompt" ? (
                                <div className="rv__answer-grid rv__answer-grid--wide">
                                  <div>
                                    <span>Your answer</span>
                                    <strong>{formatAnswerValue(answers[question.id], question)}</strong>
                                  </div>
                                  <div>
                                    <span>Assessment</span>
                                    <strong>{speakingQuestion ? `Band ${speakingQuestion.estimated_band.toFixed(1)}` : "Saved for assessment"}</strong>
                                  </div>
                                  {speakingQuestion?.transcript ? (
                                    <div>
                                      <span>Transcript</span>
                                      <strong className="rv__long-answer">{speakingQuestion.transcript}</strong>
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="rv__answer-grid">
                                  <div>
                                    <span>Your answer</span>
                                    <strong>{formatAnswerValue(answers[question.id], question)}</strong>
                                  </div>
                                  <div>
                                    <span>Correct answer</span>
                                    <strong>No answer key</strong>
                                  </div>
                                  <div>
                                    <span>Marks</span>
                                    <strong>Not scored</strong>
                                  </div>
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </section>
            ) : null}

            {/* Writing Review */}
            {aiReview ? (
              <div className="rv__ai">
                <div className="rv__ai-header">
                  <div className="rv__ai-icon">
                    <Sparkles size={22} strokeWidth={2.2} aria-hidden />
                  </div>
                  <div>
                    <h2 className="rv__ai-title">Writing Assessment</h2>
                    <p className="rv__ai-sub">Marked against IELTS writing criteria</p>
                  </div>
                </div>

                {/* Summary */}
                <div className="rv__summary">
                  <p>{aiReview.summary}</p>
                </div>

                {/* Strengths & Improvements */}
                {aiReview.strengths.length > 0 || aiReview.improvements.length > 0 ? (
                  <div className="rv__insights">
                    {aiReview.strengths.length > 0 ? (
                      <div className="rv__insight-card rv__insight-card--strength">
                        <h3 className="rv__insight-label">
                          <span className="rv__insight-dot rv__insight-dot--green" />
                          Strengths
                        </h3>
                        <ul className="rv__insight-list">
                          {aiReview.strengths.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    ) : null}
                    {aiReview.improvements.length > 0 ? (
                      <div className="rv__insight-card rv__insight-card--improve">
                        <h3 className="rv__insight-label">
                          <span className="rv__insight-dot rv__insight-dot--amber" />
                          Areas to Improve
                        </h3>
                        <ul className="rv__insight-list">
                          {aiReview.improvements.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Per-task detailed cards */}
                {aiReview.tasks.map((task) => (
                  <div key={task.part} className="rv__task-card">
                    <div className="rv__task-head">
                      <h3 className="rv__task-name">Writing Task {task.part}</h3>
                      <span className="rv__task-band-pill">Band {task.estimated_band.toFixed(1)}</span>
                    </div>
                    <div className="rv__task-meta">{task.word_count} words</div>

                    <div className="rv__criteria">
                      {(Object.entries(task.criterion_scores) as [string, number][]).map(([key, score]) => (
                        <div key={key}>
                          <div className="rv__crit-head">
                            <span className="rv__crit-label">{CRITERIA_LABELS[key] ?? key}</span>
                            <span className="rv__crit-score">{score.toFixed(1)}</span>
                          </div>
                          <div className="rv__crit-track">
                            <div
                              className={`rv__crit-fill${score >= 7 ? " rv__crit-fill--high" : score >= 5 ? " rv__crit-fill--mid" : " rv__crit-fill--low"}`}
                              style={{ width: `${Math.min(100, (score / 9) * 100)}%` }}
                            />
                          </div>
                          <p className="rv__crit-feedback">
                            {(task.feedback as Record<string, string>)[key]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {speakingReview ? (
              <div className="rv__ai">
                <div className="rv__ai-header">
                  <div className="rv__ai-icon">
                    <Mic size={22} strokeWidth={2.2} aria-hidden />
                  </div>
                  <div>
                    <h2 className="rv__ai-title">Speaking Assessment</h2>
                    <p className="rv__ai-sub">Marked against IELTS speaking criteria</p>
                  </div>
                </div>

                <div className="rv__summary">
                  <p>{speakingReview.summary}</p>
                </div>

                {speakingReview.strengths.length > 0 || speakingReview.improvements.length > 0 ? (
                  <div className="rv__insights">
                    {speakingReview.strengths.length > 0 ? (
                      <div className="rv__insight-card rv__insight-card--strength">
                        <h3 className="rv__insight-label">
                          <span className="rv__insight-dot rv__insight-dot--green" />
                          What went well
                        </h3>
                        <ul className="rv__insight-list">
                          {speakingReview.strengths.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                        </ul>
                      </div>
                    ) : null}
                    {speakingReview.improvements.length > 0 ? (
                      <div className="rv__insight-card rv__insight-card--improve">
                        <h3 className="rv__insight-label">
                          <span className="rv__insight-dot rv__insight-dot--amber" />
                          Areas to Improve
                        </h3>
                        <ul className="rv__insight-list">
                          {speakingReview.improvements.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="rv__criteria">
                  {(Object.entries(speakingReview.criterion_scores) as [string, number][]).map(([key, score]) => {
                    const label = {
                      fluency: "Fluency & Coherence",
                      lexical: "Lexical Resource",
                      grammar: "Grammar Range & Accuracy",
                      pronunciation: "Pronunciation",
                    }[key] ?? key;
                    return (
                      <div key={key}>
                        <div className="rv__crit-head">
                          <span className="rv__crit-label">{label}</span>
                          <span className="rv__crit-score">{score.toFixed(1)}</span>
                        </div>
                        <div className="rv__crit-track">
                          <div
                            className={`rv__crit-fill${score >= 7 ? " rv__crit-fill--high" : score >= 5 ? " rv__crit-fill--mid" : " rv__crit-fill--low"}`}
                            style={{ width: `${Math.min(100, (score / 9) * 100)}%` }}
                          />
                        </div>
                        <p className="rv__crit-feedback">
                          {(speakingReview.criterion_feedback as Record<string, string>)[key]}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {speakingReview.questions.map((question, index) => (
                  <div key={`${question.question_id}-${index}`} className="rv__task-card">
                    <div className="rv__task-head">
                      <h3 className="rv__task-name">Speaking Part {question.part}</h3>
                      <span className="rv__task-band-pill">Band {question.estimated_band.toFixed(1)}</span>
                    </div>
                    <div className="rv__task-meta">{question.prompt}</div>
                    <p className="rv__crit-feedback"><strong>Transcript:</strong> {question.transcript}</p>
                    <p className="rv__crit-feedback">{question.feedback}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}

        {/* Actions */}
        <div className="rv__actions">
          <Link href={`/mock-exam/${slug}/take`} className="btn btn-primary btn-topbar-cta">
            Retake exam
          </Link>
          <Link href="/mock-exam" className="btn btn-outline">
            Back to mock exams
          </Link>
        </div>
      </div>
    </main>
  );
}
