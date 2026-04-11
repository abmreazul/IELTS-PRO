/** IELTS-accurate defaults for admin wizard (parts ≈ sections/tasks). */

export type SectionStructure = {
  module: "listening" | "reading" | "writing" | "speaking";
  label: string;
  parts: number;
  questions: number;
  enabled: boolean;
};

export const DEFAULT_FULL_STRUCTURE: SectionStructure[] = [
  { module: "listening", label: "Listening", parts: 4, questions: 40, enabled: true },
  { module: "reading", label: "Reading", parts: 3, questions: 40, enabled: true },
  { module: "writing", label: "Writing", parts: 2, questions: 2, enabled: true },
  { module: "speaking", label: "Speaking", parts: 3, questions: 3, enabled: true },
];

export type BandRow = { band: number; minCorrect: number; maxCorrect: number };

/** Approximate raw-score → band mapping for a 40-question Listening/Reading paper. */
export const DEFAULT_BAND_ROWS: BandRow[] = [
  { band: 9, minCorrect: 39, maxCorrect: 40 },
  { band: 8.5, minCorrect: 37, maxCorrect: 38 },
  { band: 8, minCorrect: 35, maxCorrect: 36 },
  { band: 7.5, minCorrect: 32, maxCorrect: 34 },
  { band: 7, minCorrect: 30, maxCorrect: 31 },
  { band: 6.5, minCorrect: 26, maxCorrect: 29 },
  { band: 6, minCorrect: 23, maxCorrect: 25 },
  { band: 5.5, minCorrect: 18, maxCorrect: 22 },
  { band: 5, minCorrect: 16, maxCorrect: 17 },
];

export type ScoringConfig = {
  bands: BandRow[];
  minPassingBand: number;
  sectionMinutes: {
    listening: number;
    reading: number;
    writing: number;
    speaking: number;
  };
  feedbackTemplate: string;
};

export const DEFAULT_SCORING: ScoringConfig = {
  bands: DEFAULT_BAND_ROWS,
  minPassingBand: 6,
  sectionMinutes: {
    listening: 30,
    reading: 60,
    writing: 60,
    speaking: 14,
  },
  feedbackTemplate:
    "Congratulations! You scored {score}. This result reflects your performance across the sections you completed.",
};

/** IELTS-style question types for the builder (extensible). */
export const IELTS_QUESTION_TYPES: { value: string; label: string; hint?: string }[] = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "multiple_choice_multi", label: "Multiple choice (select two)" },
  { value: "true_false_not_given", label: "True / False / Not Given" },
  { value: "yes_no_not_given", label: "Yes / No / Not Given" },
  { value: "matching_headings", label: "Matching headings" },
  { value: "matching_information", label: "Matching information" },
  { value: "matching_features", label: "Matching features" },
  { value: "sentence_endings", label: "Matching sentence endings" },
  { value: "completion", label: "Completion (summary / table / flow-chart)" },
  { value: "short_answer", label: "Short answer" },
  { value: "map_diagram_labeling", label: "Map / diagram labeling (Listening)" },
  { value: "essay", label: "Writing task (essay / report)" },
  { value: "speaking_prompt", label: "Speaking prompt (cue card / discussion)" },
];

export function structureForModules(modules: string[]): SectionStructure[] {
  const all = DEFAULT_FULL_STRUCTURE;
  return all.map((s) => ({
    ...s,
    enabled: modules.includes(s.module),
  }));
}
