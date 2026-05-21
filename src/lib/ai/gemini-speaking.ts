import "server-only";

import { roundBandToNearestHalf } from "@/lib/ai/writing-review";
import type {
  SpeakingCriterionFeedback,
  SpeakingCriterionScores,
  SpeakingQuestionReview,
  SpeakingReview,
} from "@/lib/ai/speaking-review";

export type SpeakingRecordingSubmission = {
  question_id: string;
  part: number;
  prompt: string;
  mime_type: string;
  audio_base64: string;
  duration_seconds: number | null;
};

type GeminiQuestionPayload = {
  question_id?: unknown;
  part?: unknown;
  estimated_band?: unknown;
  transcript?: unknown;
  feedback?: unknown;
};

type GeminiSpeakingPayload = {
  overall_band?: unknown;
  summary?: unknown;
  strengths?: unknown;
  improvements?: unknown;
  criterion_scores?: Record<string, unknown>;
  criterion_feedback?: Record<string, unknown>;
  questions?: unknown;
};

type EvaluateSpeakingSuccess = {
  ok: true;
  review: SpeakingReview;
};

type EvaluateSpeakingFailure = {
  ok: false;
  reason: string;
};

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

function stripCodeFence(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function normalizeMimeType(mimeType: string) {
  const clean = mimeType.split(";")[0]?.trim().toLowerCase() || "audio/webm";
  if (clean === "audio/mpeg") return "audio/mp3";
  if (clean === "audio/x-wav") return "audio/wav";
  return clean;
}

function sanitizeCriterionScores(payload: Record<string, unknown> | undefined): SpeakingCriterionScores {
  return {
    fluency: clampBand(payload?.fluency),
    lexical: clampBand(payload?.lexical),
    grammar: clampBand(payload?.grammar),
    pronunciation: clampBand(payload?.pronunciation),
  };
}

function sanitizeCriterionFeedback(payload: Record<string, unknown> | undefined): SpeakingCriterionFeedback {
  return {
    fluency: asText(payload?.fluency, "Fluency and coherence were reviewed."),
    lexical: asText(payload?.lexical, "Vocabulary range and accuracy were reviewed."),
    grammar: asText(payload?.grammar, "Grammar range and accuracy were reviewed."),
    pronunciation: asText(payload?.pronunciation, "Pronunciation clarity was reviewed."),
  };
}

function sanitizeQuestionReview(
  fallback: SpeakingRecordingSubmission,
  payload: GeminiQuestionPayload | undefined,
): SpeakingQuestionReview {
  return {
    question_id: String(payload?.question_id ?? fallback.question_id),
    part: Number(payload?.part) || fallback.part,
    prompt: fallback.prompt,
    estimated_band: clampBand(payload?.estimated_band),
    transcript: asText(payload?.transcript, "Transcript unavailable."),
    feedback: asText(payload?.feedback, "Response reviewed."),
  };
}

function buildPrompt(recordings: SpeakingRecordingSubmission[]) {
  return [
    "You are an IELTS Speaking examiner.",
    "Assess the candidate's speaking responses using IELTS-style band criteria.",
    "Listen to each audio response, consider the question prompt, transcribe the answer briefly, and return JSON only.",
    "Score fluency, lexical resource, grammar, and pronunciation from 0.0 to 9.0 in 0.5 increments.",
    "Return valid JSON in this exact shape:",
    JSON.stringify({
      overall_band: 0,
      summary: "Short speaking performance summary",
      strengths: ["Point 1", "Point 2"],
      improvements: ["Point 1", "Point 2"],
      criterion_scores: {
        fluency: 0,
        lexical: 0,
        grammar: 0,
        pronunciation: 0,
      },
      criterion_feedback: {
        fluency: "Feedback",
        lexical: "Feedback",
        grammar: "Feedback",
        pronunciation: "Feedback",
      },
      questions: [
        {
          question_id: "id",
          part: 1,
          estimated_band: 0,
          transcript: "Brief transcript",
          feedback: "Question-specific feedback",
        },
      ],
    }),
    "Question metadata:",
    JSON.stringify(
      recordings.map((recording) => ({
        question_id: recording.question_id,
        part: recording.part,
        prompt: recording.prompt,
        duration_seconds: recording.duration_seconds,
      })),
    ),
  ].join("\n\n");
}

export async function evaluateSpeakingWithGemini(
  recordings: SpeakingRecordingSubmission[],
): Promise<EvaluateSpeakingSuccess | EvaluateSpeakingFailure> {
  const apiKey = process.env.GEMINI_API_KEY;
  const configuredModel = process.env.GEMINI_MODEL?.trim();
  const model = !configuredModel || configuredModel === "gemini-2.0-flash"
    ? "gemini-2.5-flash"
    : configuredModel;

  if (!apiKey) return { ok: false, reason: "Missing GEMINI_API_KEY." };
  if (recordings.length === 0) return { ok: false, reason: "No speaking recordings were provided." };

  const parts = [
    { text: buildPrompt(recordings) },
    ...recordings.flatMap((recording, index) => [
      { text: `Audio response ${index + 1}: question_id=${recording.question_id}, part=${recording.part}` },
      {
        inline_data: {
          mime_type: normalizeMimeType(recording.mime_type),
          data: recording.audio_base64,
        },
      },
    ]),
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
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
    return { ok: false, reason: `Speaking evaluation failed (${response.status}): ${errorText.slice(0, 240)}` };
  }

  const raw = await response.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = raw.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) return { ok: false, reason: "Speaking evaluation returned an empty response." };

  let parsed: GeminiSpeakingPayload;
  try {
    parsed = JSON.parse(stripCodeFence(text)) as GeminiSpeakingPayload;
  } catch {
    return { ok: false, reason: "Speaking evaluation returned invalid JSON." };
  }

  const questionPayloads = Array.isArray(parsed.questions)
    ? parsed.questions as GeminiQuestionPayload[]
    : [];
  const questions = recordings.map((recording, index) => {
    const payload =
      questionPayloads.find((item) => String(item?.question_id ?? "") === recording.question_id) ??
      questionPayloads[index];
    return sanitizeQuestionReview(recording, payload);
  });

  const criterionScores = sanitizeCriterionScores(parsed.criterion_scores);
  const computedOverall = roundBandToNearestHalf(
    (criterionScores.fluency + criterionScores.lexical + criterionScores.grammar + criterionScores.pronunciation) / 4,
  );
  const overallBand = clampBand(parsed.overall_band) || computedOverall;

  return {
    ok: true,
    review: {
      mode: "automated",
      provider: "gemini",
      model,
      graded_at: new Date().toISOString(),
      overall_band: overallBand,
      summary: asText(parsed.summary, "Speaking assessment completed successfully."),
      strengths: asTextList(parsed.strengths),
      improvements: asTextList(parsed.improvements),
      criterion_scores: criterionScores,
      criterion_feedback: sanitizeCriterionFeedback(parsed.criterion_feedback),
      questions,
    },
  };
}
