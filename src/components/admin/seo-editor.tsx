"use client";

import { useState, useTransition } from "react";
import {
  Globe,
  Check,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import {
  saveSeoMetadata,
  deleteSeoMetadata,
  type SeoMetadataRow,
  type SeoSaveInput,
} from "@/app/admin/seo-actions";

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

export type SeoPageInfo = {
  path: string;
  label: string;
};

type Props = {
  pages: SeoPageInfo[];
  seoMap: Record<string, SeoMetadataRow>;
};

/* ═══════════════════════════════════════════════════════════════════
   SERP Preview
   ═══════════════════════════════════════════════════════════════════ */

function SerpPreview({
  path,
  title,
  description,
  label,
}: {
  path: string;
  title: string;
  description: string;
  label: string;
}) {
  const breadcrumb =
    path === "/"
      ? ""
      : ` › ${path
          .slice(1)
          .split("/")
          .map((s) => s.replace(/-/g, " "))
          .join(" › ")}`;

  return (
    <div className="seo-serp">
      <p className="seo-serp__tag">Google Search Preview</p>
      <div className="seo-serp__url">theieltsexam.com{breadcrumb}</div>
      <div className="seo-serp__title">
        {title || `${label} | The IELTS Exam`}
      </div>
      <div className="seo-serp__desc">
        {description ||
          "No custom description set. Google will use auto-generated content from the page."}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Character counter badge
   ═══════════════════════════════════════════════════════════════════ */

function CharCount({ current, max }: { current: number; max: number }) {
  const over = current > max;
  return (
    <span
      className={`seo-char-count${over ? " seo-char-count--over" : ""}`}
    >
      {current}/{max}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Single page row (expandable)
   ═══════════════════════════════════════════════════════════════════ */

function SeoPageRow({
  page,
  seo,
  isActive,
  onToggle,
  onMessage,
}: {
  page: SeoPageInfo;
  seo: SeoMetadataRow | null;
  isActive: boolean;
  onToggle: () => void;
  onMessage: (msg: { type: "ok" | "err"; text: string }) => void;
}) {
  const [title, setTitle] = useState(seo?.meta_title ?? "");
  const [description, setDescription] = useState(seo?.meta_description ?? "");
  const [ogImage, setOgImage] = useState(seo?.og_image_url ?? "");
  const [canonical, setCanonical] = useState(seo?.canonical_url ?? "");
  const [noIndex, setNoIndex] = useState(seo?.no_index ?? false);
  const [configured, setConfigured] = useState(Boolean(seo));
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function handleSave() {
    startSave(async () => {
      const input: SeoSaveInput = {
        page_path: page.path,
        meta_title: title.trim() || null,
        meta_description: description.trim() || null,
        og_image_url: ogImage.trim() || null,
        canonical_url: canonical.trim() || null,
        no_index: noIndex,
      };
      const res = await saveSeoMetadata(input);
      onMessage({ type: res.ok ? "ok" : "err", text: res.message });
      if (res.ok) setConfigured(true);
    });
  }

  function handleDelete() {
    startDelete(async () => {
      const res = await deleteSeoMetadata(page.path);
      onMessage({ type: res.ok ? "ok" : "err", text: res.message });
      if (res.ok) {
        setTitle("");
        setDescription("");
        setOgImage("");
        setCanonical("");
        setNoIndex(false);
        setConfigured(false);
      }
    });
  }

  return (
    <div className="seo-row">
      <button
        type="button"
        className="seo-row__header"
        onClick={onToggle}
      >
        <span className="seo-row__chevron">
          {isActive ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </span>
        <span className="seo-row__info">
          <span className="seo-row__label">{page.label}</span>
          <span className="seo-row__path">{page.path}</span>
        </span>
        <span
          className={`admin-badge ${
            configured ? "admin-badge--published" : "admin-badge--draft"
          }`}
        >
          {configured ? "Configured" : "Default"}
        </span>
      </button>

      {isActive ? (
        <div className="seo-row__body">
          <SerpPreview
            path={page.path}
            title={title}
            description={description}
            label={page.label}
          />

          <div className="admin-form-grid">
            <div>
              <label className="admin-label">
                Meta Title <CharCount current={title.length} max={60} />
              </label>
              <input
                className="admin-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${page.label} | The IELTS Exam`}
                maxLength={120}
              />
            </div>
            <div>
              <label className="admin-label">
                Meta Description{" "}
                <CharCount current={description.length} max={160} />
              </label>
              <textarea
                className="admin-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write a compelling description for search results…"
                maxLength={320}
                rows={3}
              />
            </div>
            <div>
              <label className="admin-label">OG Image URL</label>
              <input
                className="admin-input"
                value={ogImage}
                onChange={(e) => setOgImage(e.target.value)}
                placeholder="https://example.com/og-image.jpg"
              />
            </div>
            <div>
              <label className="admin-label">Canonical URL</label>
              <input
                className="admin-input"
                value={canonical}
                onChange={(e) => setCanonical(e.target.value)}
                placeholder="https://theieltsexam.com/…"
              />
            </div>
            <div>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={noIndex}
                  onChange={(e) => setNoIndex(e.target.checked)}
                />
                <span className="seo-noindex-label">
                  {noIndex ? (
                    <EyeOff size={14} />
                  ) : (
                    <Eye size={14} />
                  )}
                  No-index — hide this page from search engines
                </span>
              </label>
            </div>
          </div>

          <div className="admin-actions">
            <button
              type="button"
              className="btn btn-primary btn-topbar-cta"
              disabled={isSaving}
              onClick={handleSave}
            >
              <Check size={14} />
              {isSaving ? "Saving…" : "Save SEO"}
            </button>
            {configured ? (
              <button
                type="button"
                className="btn btn-outline"
                disabled={isDeleting}
                onClick={handleDelete}
              >
                <Trash2 size={14} />
                {isDeleting ? "Removing…" : "Reset to defaults"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main editor
   ═══════════════════════════════════════════════════════════════════ */

export function SeoEditor({ pages, seoMap }: Props) {
  const [search, setSearch] = useState("");
  const [activePath, setActivePath] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const filtered = pages.filter(
    (p) =>
      p.path.toLowerCase().includes(search.toLowerCase()) ||
      p.label.toLowerCase().includes(search.toLowerCase()),
  );

  const configuredCount = pages.filter((p) => seoMap[p.path]).length;

  function handleMessage(msg: { type: "ok" | "err"; text: string }) {
    setMessage(msg);
    if (msg.type === "ok") {
      setTimeout(() => setMessage(null), 3000);
    }
  }

  return (
    <>
      {/* Stats */}
      <div className="admin-stat-grid">
        <div className="admin-stat-card admin-stat-card--blue">
          <div className="admin-stat-card__body">
            <span className="admin-stat-card__label">Total pages</span>
            <span className="admin-stat-card__value">{pages.length}</span>
          </div>
          <div className="admin-stat-card__icon">
            <Globe size={20} />
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--green">
          <div className="admin-stat-card__body">
            <span className="admin-stat-card__label">SEO configured</span>
            <span className="admin-stat-card__value">{configuredCount}</span>
          </div>
          <div className="admin-stat-card__icon">
            <Check size={20} />
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--orange">
          <div className="admin-stat-card__body">
            <span className="admin-stat-card__label">Using defaults</span>
            <span className="admin-stat-card__value">
              {pages.length - configuredCount}
            </span>
          </div>
          <div className="admin-stat-card__icon">
            <Eye size={20} />
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "1rem" }}>
        <Search
          size={16}
          style={{
            position: "absolute",
            left: "0.85rem",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--muted)",
            pointerEvents: "none",
          }}
        />
        <input
          className="admin-search"
          style={{ marginBottom: 0 }}
          placeholder="Search pages…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Message */}
      {message ? (
        <div className={`admin-msg admin-msg--${message.type}`}>
          {message.text}
        </div>
      ) : null}

      {/* Page list */}
      <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <p
            style={{
              color: "var(--muted)",
              textAlign: "center",
              padding: "2.5rem 1rem",
            }}
          >
            No pages match your search.
          </p>
        ) : (
          filtered.map((page) => (
            <SeoPageRow
              key={page.path}
              page={page}
              seo={seoMap[page.path] ?? null}
              isActive={activePath === page.path}
              onToggle={() =>
                setActivePath(
                  activePath === page.path ? null : page.path,
                )
              }
              onMessage={handleMessage}
            />
          ))
        )}
      </div>
    </>
  );
}
