export type SpeakingCriterionScores = {
  fluency: number;
  lexical: number;
  grammar: number;
  pronunciation: number;
};

export type SpeakingCriterionFeedback = {
  fluency: string;
  lexical: string;
  grammar: string;
  pronunciation: string;
};

export type SpeakingQuestionReview = {
  question_id: string;
  part: number;
  prompt: string;
  estimated_band: number;
  transcript: string;
  feedback: string;
};

export type SpeakingReview = {
  mode: "automated";
  provider: "gemini";
  model: string;
  graded_at: string;
  overall_band: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  criterion_scores: SpeakingCriterionScores;
  criterion_feedback: SpeakingCriterionFeedback;
  questions: SpeakingQuestionReview[];
};

