"use client";

import Link from "next/link";
import { ChevronDown, Copy, Eye, GripVertical, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { deleteExam, duplicateExam, reorderExamsInFolder } from "@/app/admin/actions";

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
  display_order: number;
  categoryName: string | null;
  attempts: number;
  avgBand: number | null;
};

type ExamFolder = {
  key: string;
  label: string;
  className: string;
  rows: AdminExamRow[];
};

function folderMeta(exam: Pick<AdminExamRow, "exam_type" | "modules">): { key: string; label: string; className: string } {
  if (exam.exam_type === "full") {
    return { key: "full", label: "Full Test", className: "admin-badge admin-badge--full" };
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
      key: mod,
      label: mod.charAt(0).toUpperCase() + mod.slice(1),
      className: `admin-badge ${map[mod] ?? "admin-badge--full"}`,
    };
  }
  return { key: "partial", label: "Partial", className: "admin-badge admin-badge--draft" };
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

export function AdminExamsTable({ exams }: { exams: AdminExamRow[] }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState(exams);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState<{ id: string; folderKey: string } | null>(null);
  const [sortMessage, setSortMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isSearching = q.trim().length > 0;

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter(
      (e) =>
        e.title.toLowerCase().includes(t) ||
        e.slug.toLowerCase().includes(t) ||
        (e.categoryName?.toLowerCase().includes(t) ?? false),
    );
  }, [items, q]);

  const folders = useMemo(() => {
    const order = ["full", "listening", "reading", "writing", "speaking", "partial"];
    const labels: Record<string, { label: string; className: string }> = {
      full: { label: "Full Test", className: "admin-badge admin-badge--full" },
      listening: { label: "Listening", className: "admin-badge admin-badge--listening" },
      reading: { label: "Reading", className: "admin-badge admin-badge--reading" },
      writing: { label: "Writing", className: "admin-badge admin-badge--writing" },
      speaking: { label: "Speaking", className: "admin-badge admin-badge--speaking" },
      partial: { label: "Partial", className: "admin-badge admin-badge--draft" },
    };
    const map = new Map<string, AdminExamRow[]>();
    for (const exam of filtered) {
      const meta = folderMeta(exam);
      const rows = map.get(meta.key) ?? [];
      rows.push(exam);
      map.set(meta.key, rows);
    }

    return order
      .filter((key) => map.has(key))
      .map((key): ExamFolder => ({
        key,
        label: labels[key]?.label ?? key,
        className: labels[key]?.className ?? "admin-badge admin-badge--draft",
        rows: [...(map.get(key) ?? [])].sort((a, b) => {
          if (a.display_order !== b.display_order) return a.display_order - b.display_order;
          return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
        }),
      }));
  }, [filtered]);

  function moveWithinFolder(folderKey: string, draggedId: string, targetId: string) {
    if (draggedId === targetId || isSearching) return;
    const folderIds = items
      .filter((item) => folderMeta(item).key === folderKey)
      .sort((a, b) => {
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      })
      .map((item) => item.id);
    const fromIndex = folderIds.indexOf(draggedId);
    const toIndex = folderIds.indexOf(targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextFolderIds = [...folderIds];
    const [moved] = nextFolderIds.splice(fromIndex, 1);
    nextFolderIds.splice(toIndex, 0, moved);
    const orderById = new Map(nextFolderIds.map((id, index) => [id, (index + 1) * 1000]));
    setItems((prev) =>
      prev.map((item) =>
        orderById.has(item.id) ? { ...item, display_order: orderById.get(item.id)! } : item,
      ),
    );
    setSortMessage(null);
    startTransition(async () => {
      const result = await reorderExamsInFolder(folderKey, nextFolderIds);
      if (!result.ok) setSortMessage(result.message);
    });
  }

  return (
    <>
      <input
        type="search"
        className="admin-search"
        placeholder="Search exams..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search exams"
      />
      {isSearching ? (
        <p className="admin-exam-folders__hint">Sorting is paused while search is active.</p>
      ) : (
        <p className="admin-exam-folders__hint">Drag exams inside a folder to change their serial order.</p>
      )}
      {sortMessage ? <p className="admin-exam-folders__error">{sortMessage}</p> : null}

      <div className="admin-exam-folders" aria-busy={isPending}>
        {folders.map((folder) => {
          const isClosed = collapsed[folder.key] ?? false;
          return (
            <section key={folder.key} className="admin-exam-folder">
              <button
                type="button"
                className="admin-exam-folder__head"
                onClick={() => setCollapsed((prev) => ({ ...prev, [folder.key]: !isClosed }))}
              >
                <span className={`admin-exam-folder__chevron${isClosed ? " admin-exam-folder__chevron--closed" : ""}`}>
                  <ChevronDown />
                </span>
                <span className={folder.className}>{folder.label}</span>
                <strong>{folder.rows.length}</strong>
              </button>

              {!isClosed ? (
                <div className="admin-exam-folder__list">
                  <div className="admin-exam-row admin-exam-row--head" role="row">
                    <span aria-label="Drag" />
                    <span>No.</span>
                    <span>Exam Title</span>
                    <span>Status</span>
                    <span>Created</span>
                    <span>Attempts</span>
                    <span>Avg Score</span>
                    <span>Actions</span>
                  </div>
                  {folder.rows.map((row, index) => (
                    <article
                      key={row.id}
                      className={`admin-exam-row${dragging?.id === row.id ? " admin-exam-row--dragging" : ""}`}
                      onDragOver={(event) => {
                        if (dragging?.folderKey === folder.key && dragging.id !== row.id && !isSearching) {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (!dragging || dragging.folderKey !== folder.key) return;
                        moveWithinFolder(folder.key, dragging.id, row.id);
                        setDragging(null);
                      }}
                      onDragEnd={() => setDragging(null)}
                    >
                      <button
                        type="button"
                        className="admin-exam-row__drag"
                        draggable={!isSearching}
                        onDragStart={(event) => {
                          if (isSearching) {
                            event.preventDefault();
                            return;
                          }
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", row.id);
                          setDragging({ id: row.id, folderKey: folder.key });
                        }}
                        onDragEnd={() => setDragging(null)}
                        aria-label={`Drag ${row.title}`}
                        title="Drag to reorder"
                      >
                        <GripVertical aria-hidden />
                      </button>
                      <span className="admin-exam-row__serial">{index + 1}</span>
                      <div className="admin-exam-row__main">
                        <div className="admin-table-title">{row.title}</div>
                        <div className="admin-exam-row__meta">
                          <span>{row.categoryName ?? "Unmapped"}</span>
                        </div>
                      </div>
                      <span
                        className={
                          row.is_published ? "admin-badge admin-badge--published" : "admin-badge admin-badge--draft"
                        }
                      >
                        {row.is_published ? "Published" : "Draft"}
                      </span>
                      <span className="admin-exam-row__cell">{formatDate(row.created_at)}</span>
                      <span className="admin-exam-row__cell">{row.attempts}</span>
                      <span className="admin-exam-row__cell">{row.avgBand != null ? row.avgBand.toFixed(1) : "-"}</span>
                      <div className="admin-table-actions">
                        <Link href={`/admin/exams/${row.id}`} className="admin-icon-btn" title="Edit" aria-label="Edit">
                          <Pencil />
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
                            if (!confirm(`Delete "${row.title}"?`)) e.preventDefault();
                          }}
                        >
                          <input type="hidden" name="id" value={row.id} />
                          <button type="submit" className="admin-icon-btn" title="Delete" aria-label="Delete">
                            <Trash2 />
                          </button>
                        </form>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: "var(--muted)", marginTop: "1rem" }}>No exams match your search.</p>
      ) : null}
    </>
  );
}
