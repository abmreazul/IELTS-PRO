export type WritingCriterionScores = {
  task_response: number;
  coherence: number;
  lexical: number;
  grammar: number;
};

export type WritingCriterionFeedback = {
  task_response: string;
  coherence: string;
  lexical: string;
  grammar: string;
};

export type WritingTaskAiReview = {
  part: number;
  estimated_band: number;
  word_count: number;
  criterion_scores: WritingCriterionScores;
  feedback: WritingCriterionFeedback;
};

export type WritingAiReview = {
  mode: "ai";
  provider: "gemini";
  model: string;
  graded_at: string;
  overall_band: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  tasks: WritingTaskAiReview[];
};

export function roundBandToNearestHalf(value: number) {
  return Math.round(value * 2) / 2;
}
