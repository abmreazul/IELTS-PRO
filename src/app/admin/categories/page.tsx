import { createClient } from "@/lib/supabase/server";
import { createCategory, deleteCategory, updateCategory } from "../actions";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("exam_categories")
    .select("id, slug, name, sort_order")
    .order("sort_order", { ascending: true });

  return (
    <>
      <h1 className="admin-h1">Categories</h1>
      <p className="admin-lead">Used to group mock exams on the public catalog.</p>

      <div className="admin-card">
        <h2>Add category</h2>
        <form action={createCategory} className="admin-form-grid admin-form-grid--2">
          <div>
            <label className="admin-label" htmlFor="new-name">
              Name
            </label>
            <input id="new-name" className="admin-input" name="name" required placeholder="Listening" />
          </div>
          <div>
            <label className="admin-label" htmlFor="new-slug">
              Slug
            </label>
            <input id="new-slug" className="admin-input" name="slug" required placeholder="listening" />
          </div>
          <div>
            <label className="admin-label" htmlFor="new-sort">
              Sort order
            </label>
            <input
              id="new-sort"
              className="admin-input"
              name="sort_order"
              type="number"
              defaultValue={0}
            />
          </div>
          <div className="admin-actions" style={{ alignSelf: "end" }}>
            <button type="submit" className="btn btn-primary btn-topbar-cta">
              Create
            </button>
          </div>
        </form>
      </div>

      <div className="admin-card">
        <h2>Existing categories</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Order</th>
                <th style={{ width: "200px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(categories ?? []).map((c) => (
                <tr key={c.id}>
                  <td colSpan={4} style={{ padding: "0.75rem", verticalAlign: "top" }}>
                    <form action={updateCategory} className="admin-form-grid admin-form-grid--2">
                      <input type="hidden" name="id" value={c.id} />
                      <div>
                        <label className="admin-label">Name</label>
                        <input className="admin-input" name="name" defaultValue={c.name} required />
                      </div>
                      <div>
                        <label className="admin-label">Slug</label>
                        <input className="admin-input" name="slug" defaultValue={c.slug} required />
                      </div>
                      <div>
                        <label className="admin-label">Sort order</label>
                        <input
                          className="admin-input"
                          name="sort_order"
                          type="number"
                          defaultValue={c.sort_order}
                        />
                      </div>
                      <div className="admin-actions">
                        <button type="submit" className="btn btn-primary btn-topbar-cta">
                          Save
                        </button>
                      </div>
                    </form>
                    <form action={deleteCategory} style={{ marginTop: "0.5rem" }}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="btn btn-outline" style={{ fontSize: "0.8125rem" }}>
                        Delete category
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
