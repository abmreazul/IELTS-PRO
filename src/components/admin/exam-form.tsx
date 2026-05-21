import { createExam, updateExam } from "@/app/admin/actions";

type Category = { id: string; name: string; slug: string };

type Exam = {
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
  price_usd_cents: number;
  price_bdt_cents: number;
  price_myr_cents: number;
  cover_image_url: string | null;
  is_published: boolean;
};

const MODULE_OPTS = ["listening", "reading", "writing", "speaking"] as const;

export function ExamForm({
  categories,
  exam,
}: {
  categories: Category[];
  exam?: Exam;
}) {
  const action = exam ? updateExam : createExam;
  const priceUsd = exam ? (exam.price_usd_cents / 100).toFixed(2) : "9.99";
  const priceBdt = exam ? (exam.price_bdt_cents / 100).toFixed(2) : "999.00";
  const priceMyr = exam ? (exam.price_myr_cents / 100).toFixed(2) : "39.90";

  return (
    <form action={action} className="admin-form-grid">
      {exam ? <input type="hidden" name="id" value={exam.id} /> : null}

      <div>
        <label className="admin-label" htmlFor="category_id">
          Category
        </label>
        <select
          id="category_id"
          name="category_id"
          className="admin-select"
          required
          defaultValue={exam?.category_id}
        >
          <option value="">Select…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-form-grid admin-form-grid--2">
        <div>
          <label className="admin-label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            className="admin-input"
            name="title"
            required
            defaultValue={exam?.title}
            placeholder="IELTS Listening Practice Test"
          />
        </div>
        <div>
          <label className="admin-label" htmlFor="slug">
            Slug (URL)
          </label>
          <input
            id="slug"
            className="admin-input"
            name="slug"
            required
            defaultValue={exam?.slug}
            placeholder="listening-practice-1"
          />
        </div>
      </div>

      <div>
        <label className="admin-label" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          className="admin-textarea"
          name="description"
          defaultValue={exam?.description ?? ""}
          placeholder="Short summary for admins (optional)"
        />
      </div>

      <div className="admin-form-grid admin-form-grid--2">
        <div>
          <label className="admin-label" htmlFor="exam_type">
            Exam type
          </label>
          <select
            id="exam_type"
            name="exam_type"
            className="admin-select"
            defaultValue={exam?.exam_type ?? "partial"}
          >
            <option value="full">Full exam (all modules)</option>
            <option value="partial">Partial (pick modules below)</option>
          </select>
        </div>
        <div>
          <span className="admin-label">Modules (partial only)</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem 1rem" }}>
            {MODULE_OPTS.map((m) => (
              <label key={m} className="admin-check">
                <input
                  type="checkbox"
                  name="modules"
                  value={m}
                  defaultChecked={exam?.modules?.includes(m)}
                />
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-form-grid admin-form-grid--2">
        <div>
          <label className="admin-label" htmlFor="duration_minutes">
            Duration (minutes)
          </label>
          <input
            id="duration_minutes"
            className="admin-input"
            name="duration_minutes"
            type="number"
            min={1}
            defaultValue={exam?.duration_minutes ?? 30}
          />
        </div>
        <div>
          <label className="admin-label" htmlFor="question_count">
            Question count
          </label>
          <input
            id="question_count"
            className="admin-input"
            name="question_count"
            type="number"
            min={1}
            defaultValue={exam?.question_count ?? 40}
          />
        </div>
      </div>

      <div className="admin-form-grid admin-form-grid--2">
        <div>
          <label className="admin-label" htmlFor="difficulty">
            Difficulty
          </label>
          <select
            id="difficulty"
            name="difficulty"
            className="admin-select"
            defaultValue={exam?.difficulty ?? "intermediate"}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div />
      </div>

      <div>
        <span className="admin-label">Pricing (set 0 for free)</span>
        <div className="admin-form-grid admin-form-grid--3">
          <div>
            <label className="admin-label" htmlFor="price_usd" style={{ fontSize: "0.75rem" }}>
              USD ($)
            </label>
            <input
              id="price_usd"
              className="admin-input"
              name="price_usd"
              type="number"
              step="0.01"
              min={0}
              defaultValue={priceUsd}
            />
          </div>
          <div>
            <label className="admin-label" htmlFor="price_bdt" style={{ fontSize: "0.75rem" }}>
              BDT (৳)
            </label>
            <input
              id="price_bdt"
              className="admin-input"
              name="price_bdt"
              type="number"
              step="0.01"
              min={0}
              defaultValue={priceBdt}
            />
          </div>
          <div>
            <label className="admin-label" htmlFor="price_myr" style={{ fontSize: "0.75rem" }}>
              MYR (RM)
            </label>
            <input
              id="price_myr"
              className="admin-input"
              name="price_myr"
              type="number"
              step="0.01"
              min={0}
              defaultValue={priceMyr}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="admin-label" htmlFor="cover_image_url">
          Cover image URL
        </label>
        <input
          id="cover_image_url"
          className="admin-input"
          name="cover_image_url"
          type="url"
          placeholder="https://images.unsplash.com/..."
          defaultValue={exam?.cover_image_url ?? ""}
        />
      </div>

      <label className="admin-check">
        <input type="checkbox" name="is_published" defaultChecked={exam?.is_published ?? false} />
        Published (visible on catalog)
      </label>

      <div className="admin-actions">
        <button type="submit" className="btn btn-primary btn-topbar-cta">
          {exam ? "Update exam" : "Create exam"}
        </button>
      </div>
    </form>
  );
}
