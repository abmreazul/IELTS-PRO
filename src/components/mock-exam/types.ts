export type ExamCategoryRow = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
};

export type MockExamRow = {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  description: string | null;
  exam_type: "full" | "partial";
  modules: string[];
  duration_minutes: number;
  question_count: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  price_cents: number;
  currency: string;
  cover_image_url: string | null;
  /** Public audio URLs per listening part (from DB / Supabase Storage). */
  listening_audio_json?: { part: number; url: string; title?: string }[] | null;
  is_published: boolean;
  exam_categories: ExamCategoryRow | null;
};

export type MockAttemptRow = {
  id: string;
  exam_id: string;
  status: string;
  review_status: "not_required" | "pending" | "reviewed" | null;
  overall_band: number | null;
  listening_band: number | null;
  reading_band: number | null;
  writing_band: number | null;
  speaking_band: number | null;
  completed_at: string | null;
  created_at: string;
};
