"use client";

import Link from "next/link";
import { BarChart3, Copy, Eye, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { deleteExam, duplicateExam } from "@/app/admin/actions";

export type AdminExamRow = {
  id: string;
  title: string;
  slug: string;
  is_published: boolean;
  exam_type: string;
  modules: string[] | null;
  price_cents: number;
  currency: string;
  created_at: string | null;
  categoryName: string | null;
  attempts: number;
  avgBand: number | null;
};

function categoryBadge(exam: AdminExamRow): { label: string; className: string } {
  if (exam.exam_type === "full") {
    return { label: "Full Test", className: "admin-badge admin-badge--full" };
  }
  const m = exam.modules ?? [];
  if (m.length === 1) {
    const mod = m[0];
    const map: Record<string, string> = {
      listening: "admin-badge--listening",
      reading: "admin-badge--reading",
      writing: "admin-badge--writing",
      speaking: "admin-badge--speaking",
    };
    return {
      label: mod.charAt(0).toUpperCase() + mod.slice(1),
      className: `admin-badge ${map[mod] ?? "admin-badge--full"}`,
    };
  }
  return { label: "Partial", className: "admin-badge admin-badge--draft" };
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

export function AdminExamsTable({ exams }: { exams: AdminExamRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return exams;
    return exams.filter(
      (e) =>
        e.title.toLowerCase().includes(t) ||
        e.slug.toLowerCase().includes(t) ||
        (e.categoryName?.toLowerCase().includes(t) ?? false),
    );
  }, [exams, q]);

  return (
    <>
      <input
        type="search"
        className="admin-search"
        placeholder="Search exams…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search exams"
      />

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: "2rem" }} aria-label="Select" />
              <th>Exam</th>
              <th>Format</th>
              <th>Status</th>
              <th>Created</th>
              <th>Attempts</th>
              <th>Avg score</th>
              <th>Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const badge = categoryBadge(row);
              const price = (row.price_cents / 100).toFixed(2);
              return (
                <tr key={row.id}>
                  <td>
                    <input type="checkbox" disabled aria-label="Bulk actions coming later" title="Placeholder" />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.title}</div>
                    {row.categoryName ? (
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                        {row.categoryName}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <span className={badge.className}>{badge.label}</span>
                  </td>
                  <td>
                    <span
                      className={
                        row.is_published ? "admin-badge admin-badge--published" : "admin-badge admin-badge--draft"
                      }
                    >
                      {row.is_published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td>{formatDate(row.created_at)}</td>
                  <td>{row.attempts}</td>
                  <td>{row.avgBand != null ? row.avgBand.toFixed(1) : "—"}</td>
                  <td>
                    {row.currency} {price}
                  </td>
                  <td>
                    <div className="admin-table-actions">
                      <Link href={`/admin/exams/${row.id}`} className="admin-icon-btn" title="Edit" aria-label="Edit">
                        <Pencil />
                      </Link>
                      <Link
                        href={`/admin/exams/${row.id}/analytics`}
                        className="admin-icon-btn"
                        title="Analytics"
                        aria-label="Analytics"
                      >
                        <BarChart3 />
                      </Link>
                      <form action={duplicateExam} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={row.id} />
                        <button type="submit" className="admin-icon-btn" title="Duplicate" aria-label="Duplicate">
                          <Copy />
                        </button>
                      </form>
                      <Link
                        href={`/mock-exam/${row.slug}/take`}
                        className="admin-icon-btn"
                        title="Preview take page"
                        aria-label="Preview take page"
                      >
                        <Eye />
                      </Link>
                      <form
                        action={deleteExam}
                        style={{ display: "inline" }}
                        onSubmit={(e) => {
                          if (!confirm(`Delete “${row.title}”?`)) e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="id" value={row.id} />
                        <button type="submit" className="admin-icon-btn" title="Delete" aria-label="Delete">
                          <Trash2 />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: "var(--muted)", marginTop: "1rem" }}>No exams match your search.</p>
      ) : null}
    </>
  );
}
