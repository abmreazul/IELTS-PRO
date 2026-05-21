import "server-only";

import {
  roundBandToNearestHalf,
  type WritingAiReview,
  type WritingTaskAiReview,
} from "@/lib/ai/writing-review";

type Variant = "academic" | "general";

export type WritingTaskSubmission = {
  part: number;
  prompt: string;
  min_words: number | null;
  image_url: string | null;
  answer: string;
  test_variant: Variant;
};

type GeminiTaskPayload = {
  part?: unknown;
  estimated_band?: unknown;
  word_count?: unknown;
  criterion_scores?: Record<string, unknown>;
  feedback?: Record<string, unknown>;
};

type GeminiResponsePayload = {
  overall_band?: unknown;
  summary?: unknown;
  strengths?: unknown;
  improvements?: unknown;
  tasks?: unknown;
};

type EvaluateWritingSuccess = {
  ok: true;
  review: WritingAiReview;
};

type EvaluateWritingFailure = {
  ok: false;
  reason: string;
};

function countWords(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function clampBand(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(9, roundBandToNearestHalf(parsed)));
}

function asText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function asTextList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function weightedOverall(tasks: WritingTaskAiReview[]) {
  const task1 = tasks.find((task) => task.part === 1);
  const task2 = tasks.find((task) => task.part === 2);
  if (task1 && task2) {
    return roundBandToNearestHalf((task1.estimated_band + task2.estimated_band * 2) / 3);
  }
  if (tasks.length === 0) return 0;
  return roundBandToNearestHalf(
    tasks.reduce((sum, task) => sum + task.estimated_band, 0) / tasks.length,
  );
}

function buildEmptyReview(tasks: WritingTaskSubmission[], model: string): WritingAiReview {
  const mappedTasks = tasks.map<WritingTaskAiReview>((task) => ({
    part: task.part,
    estimated_band: 0,
    word_count: countWords(task.answer),
    criterion_scores: {
      task_response: 0,
      coherence: 0,
      lexical: 0,
      grammar: 0,
    },
    feedback: {
      task_response: "No response was submitted for this task.",
      coherence: "No response was submitted for this task.",
      lexical: "No response was submitted for this task.",
      grammar: "No response was submitted for this task.",
    },
  }));

  return {
    mode: "ai",
    provider: "gemini",
    model,
    graded_at: new Date().toISOString(),
    overall_band: 0,
    summary: "No writing response was submitted, so the writing band is 0.0.",
    strengths: [],
    improvements: ["Submit a response for each writing task to receive a real band estimate."],
    tasks: mappedTasks,
  };
}

function stripCodeFence(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function sanitizeTaskReview(
  fallbackTask: WritingTaskSubmission,
  payload: GeminiTaskPayload | undefined,
): WritingTaskAiReview {
  const criterionScores = payload?.criterion_scores ?? {};
  const feedback = payload?.feedback ?? {};

  return {
    part: Number(payload?.part) === fallbackTask.part ? fallbackTask.part : fallbackTask.part,
    estimated_band: clampBand(payload?.estimated_band),
    word_count: Math.max(0, Math.floor(Number(payload?.word_count) || countWords(fallbackTask.answer))),
    criterion_scores: {
      task_response: clampBand(criterionScores.task_response),
      coherence: clampBand(criterionScores.coherence),
      lexical: clampBand(criterionScores.lexical),
      grammar: clampBand(criterionScores.grammar),
    },
    feedback: {
      task_response: asText(
        feedback.task_response,
        fallbackTask.answer.trim()
          ? "Task response reviewed."
          : "No response was submitted for this task.",
      ),
      coherence: asText(
        feedback.coherence,
        fallbackTask.answer.trim()
          ? "Organisation and coherence reviewed."
          : "No response was submitted for this task.",
      ),
      lexical: asText(
        feedback.lexical,
        fallbackTask.answer.trim()
          ? "Vocabulary use reviewed."
          : "No response was submitted for this task.",
      ),
      grammar: asText(
        feedback.grammar,
        fallbackTask.answer.trim()
          ? "Grammar and sentence control reviewed."
          : "No response was submitted for this task.",
      ),
    },
  };
}

function buildPrompt(tasks: WritingTaskSubmission[]) {
  return [
    "You are an IELTS Writing examiner.",
    "Grade the student's IELTS Writing submission and respond with JSON only.",
    "Use official-style IELTS band logic.",
    "If a task answer is blank, that task must receive band 0.0.",
    "Task 2 is weighted double when calculating the overall writing band.",
    "Return valid JSON in this shape:",
    JSON.stringify({
      overall_band: 0,
      summary: "Short summary",
      strengths: ["Point 1", "Point 2"],
      improvements: ["Point 1", "Point 2"],
      tasks: [
        {
          part: 1,
          estimated_band: 0,
          word_count: 0,
          criterion_scores: {
            task_response: 0,
            coherence: 0,
            lexical: 0,
            grammar: 0,
          },
          feedback: {
            task_response: "Feedback",
            coherence: "Feedback",
            lexical: "Feedback",
            grammar: "Feedback",
          },
        },
      ],
    }),
    "Use concise feedback and keep all band values between 0.0 and 9.0 in 0.5 increments.",
    "Writing submission:",
    JSON.stringify(
      tasks.map((task) => ({
        part: task.part,
        test_variant: task.test_variant,
        prompt: task.prompt,
        min_words: task.min_words,
        image_url: task.image_url,
        student_answer: task.answer,
        actual_word_count: countWords(task.answer),
      })),
    ),
  ].join("\n\n");
}

export async function evaluateWritingWithGemini(
  tasks: WritingTaskSubmission[],
): Promise<EvaluateWritingSuccess | EvaluateWritingFailure> {
  const apiKey = process.env.GEMINI_API_KEY;
  const configuredModel = process.env.GEMINI_MODEL?.trim();
  const model = !configuredModel || configuredModel === "gemini-2.0-flash"
    ? "gemini-2.5-flash"
    : configuredModel;

  if (tasks.length === 0) {
    return { ok: false, reason: "No writing tasks were provided." };
  }

  if (!apiKey) {
    return { ok: false, reason: "Missing GEMINI_API_KEY." };
  }

  const hasAnyResponse = tasks.some((task) => task.answer.trim());
  if (!hasAnyResponse) {
    return { ok: true, review: buildEmptyReview(tasks, model) };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(tasks) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      reason: `Gemini request failed (${response.status}): ${errorText.slice(0, 240)}`,
    };
  }

  const raw = await response.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = raw.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    return { ok: false, reason: "Gemini returned an empty response." };
  }

  let parsed: GeminiResponsePayload;
  try {
    parsed = JSON.parse(stripCodeFence(text)) as GeminiResponsePayload;
  } catch {
    return { ok: false, reason: "Gemini returned invalid JSON." };
  }

  const payloadTasks = Array.isArray(parsed.tasks) ? parsed.tasks as GeminiTaskPayload[] : [];
  const normalizedTasks = tasks.map((task, index) => {
    const payload = payloadTasks.find((item) => Number(item?.part) === task.part) ?? payloadTasks[index];
    return sanitizeTaskReview(task, payload);
  });

  const computedOverall = weightedOverall(normalizedTasks);
  const overallBand = clampBand(parsed.overall_band) || computedOverall;

  return {
    ok: true,
    review: {
      mode: "ai",
      provider: "gemini",
      model,
      graded_at: new Date().toISOString(),
      overall_band: overallBand,
      summary: asText(
        parsed.summary,
        "AI writing evaluation completed successfully.",
      ),
      strengths: asTextList(parsed.strengths),
      improvements: asTextList(parsed.improvements),
      tasks: normalizedTasks,
    },
  };
}
