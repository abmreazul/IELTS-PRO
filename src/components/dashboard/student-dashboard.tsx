"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  Clock,
  ClipboardCheck,
  Headphones,
  PenLine,
  Target,
  Trophy,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

export type DashboardAttempt = {
  id: string;
  exam_id: string;
  status: string;
  review_status: "not_required" | "pending" | "reviewed" | null;
  overall_band: number | null;
  listening_band: number | null;
  reading_band: number | null;
  writing_band: number | null;
  completed_at: string | null;
  created_at: string;
  exam_title: string;
  exam_slug: string;
  exam_modules: string[];
};

type Props = {
  userName: string;
  attempts: DashboardAttempt[];
};

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

const MODULE_ICONS: Record<string, typeof Headphones> = {
  listening: Headphones,
  reading: BookOpen,
  writing: PenLine,
};

const MODULE_COLORS: Record<string, string> = {
  listening: "L",
  reading: "R",
  writing: "W",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

function bandPercent(band: number | null) {
  if (band == null) return 0;
  return Math.min(100, Math.max(0, (band / 9) * 100));
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

/* ═══════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */

export function StudentDashboard({ userName, attempts }: Props) {
  const completed = attempts.filter((a) => a.status === "completed" && a.overall_band != null);
  const pendingReview = attempts.filter(
    (a) => a.status === "completed" && a.review_status === "pending",
  );
  const totalAttempts = attempts.length;

  // Best scores
  const bestOverall = completed.length > 0
    ? Math.max(...completed.map((a) => a.overall_band ?? 0))
    : null;
  const bestListening = completed.length > 0
    ? Math.max(...completed.filter((a) => a.listening_band != null).map((a) => a.listening_band!))
    : null;
  const bestReading = completed.length > 0
    ? Math.max(...completed.filter((a) => a.reading_band != null).map((a) => a.reading_band!))
    : null;
  const bestWriting = completed.length > 0
    ? Math.max(...completed.filter((a) => a.writing_band != null).map((a) => a.writing_band!))
    : null;

  // Latest scores (for the overview bar)
  const latest = completed[0] ?? null;

  const firstName = userName.split(" ")[0] || "there";

  return (
    <main className="page db">
      <div className="container">
        {/* ── Header ── */}
        <motion.div
          className="db-header"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={0}
        >
          <h1 className="db-header__greeting">
            Welcome back, {firstName}
            <span>Here&apos;s your IELTS preparation at a glance</span>
          </h1>
          <div className="db-header__actions">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="/mock-exam" className="btn btn-primary btn-topbar-cta">
                Take an Exam <ArrowRight size={16} strokeWidth={2.25} />
              </Link>
            </motion.div>
          </div>
        </motion.div>

        {/* ── Stat Cards ── */}
        <div className="db-stats">
          {[
            {
              icon: ClipboardCheck,
              iconClass: "db-stat__icon--primary",
              value: totalAttempts,
              label: "Total Attempts",
            },
            {
              icon: Trophy,
              iconClass: "db-stat__icon--green",
              value: bestOverall != null ? bestOverall.toFixed(1) : "—",
              label: "Best Overall Band",
            },
            {
              icon: BarChart3,
              iconClass: "db-stat__icon--blue",
              value: completed.length,
              label: "Completed Exams",
            },
            {
              icon: Clock,
              iconClass: "db-stat__icon--amber",
              value: pendingReview.length,
              label: "Pending Review",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              className="db-stat"
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={i + 1}
            >
              <div className={`db-stat__icon ${stat.iconClass}`}>
                <stat.icon size={20} strokeWidth={2.2} />
              </div>
              <span className="db-stat__value">{stat.value}</span>
              <span className="db-stat__label">{stat.label}</span>
            </motion.div>
          ))}
        </div>

        {/* ── Band Score Overview ── */}
        {latest ? (
          <motion.div
            className="db-band-overview"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={5}
          >
            <div className="db-band-overview__head">
              <h2 className="db-band-overview__title">Best Band Scores</h2>
              {bestOverall != null ? (
                <span className="db-band-overview__badge">
                  <Target size={13} strokeWidth={2.5} />
                  Overall {bestOverall.toFixed(1)}
                </span>
              ) : null}
            </div>
            <div className="db-band-bars">
              {[
                { key: "listening", label: "Listening", band: bestListening, mod: "listening" },
                { key: "reading", label: "Reading", band: bestReading, mod: "reading" },
                { key: "writing", label: "Writing", band: bestWriting, mod: "writing" },
                { key: "overall", label: "Overall", band: bestOverall, mod: "overall" },
              ].map((item) => {
                const Icon = MODULE_ICONS[item.mod];
                return (
                  <div key={item.key} className="db-band-bar">
                    <div className="db-band-bar__label">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                        {Icon ? <Icon size={14} strokeWidth={2.2} /> : <Target size={14} strokeWidth={2.2} />}
                        {item.label}
                      </span>
                      <span className="db-band-bar__score">
                        {item.band != null ? item.band.toFixed(1) : "—"}
                      </span>
                    </div>
                    <div className="db-band-bar__track">
                      <div
                        className={`db-band-bar__fill db-band-bar__fill--${item.key}`}
                        style={{ width: `${bandPercent(item.band)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : null}

        {/* ── Recent Attempts ── */}
        <motion.div
          className="db-section"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={6}
        >
          <div className="db-section__head">
            <h2 className="db-section__title">Recent Attempts</h2>
            {attempts.length > 0 ? (
              <span className="db-section__count">{attempts.length} total</span>
            ) : null}
          </div>

          {attempts.length === 0 ? (
            <div className="db-empty">
              <div className="db-empty__icon">
                <BookOpen size={26} strokeWidth={2} />
              </div>
              <h3 className="db-empty__title">No attempts yet</h3>
              <p className="db-empty__text">
                Take your first IELTS mock exam to start tracking your band score progress.
              </p>
              <Link href="/mock-exam" className="btn btn-primary btn-topbar-cta db-empty__cta">
                Browse Mock Exams <ArrowRight size={16} strokeWidth={2.25} />
              </Link>
            </div>
          ) : (
            <div className="db-attempts">
              {attempts.map((attempt) => {
                const isCompleted = attempt.status === "completed" && attempt.overall_band != null;
                const isPending = attempt.review_status === "pending";
                const band = attempt.overall_band;
                const modules = attempt.exam_modules ?? [];

                return (
                  <div key={attempt.id} className="db-attempt">
                    <div className="db-attempt__info">
                      <h3 className="db-attempt__title">{attempt.exam_title}</h3>
                      <div className="db-attempt__meta">
                        <span>{timeAgo(attempt.completed_at || attempt.created_at)}</span>
                        <span className="db-attempt__meta-dot" />
                        <span>{formatDate(attempt.completed_at || attempt.created_at)}</span>
                      </div>
                    </div>

                    <div className="db-attempt__modules">
                      {modules.map((mod) => (
                        <span
                          key={mod}
                          className={`db-attempt__mod-pill db-attempt__mod-pill--${MODULE_COLORS[mod] ?? "L"}`}
                        >
                          {mod.charAt(0).toUpperCase() + mod.slice(1, 3)}
                        </span>
                      ))}
                    </div>

                    <div className="db-attempt__band">
                      {isCompleted && band != null ? (
                        <>
                          {band.toFixed(1)}
                          <small>Band</small>
                        </>
                      ) : isPending ? (
                        <span
                          className="db-attempt__status db-attempt__status--pending"
                        >
                          <Clock size={11} strokeWidth={2.5} />
                          Pending
                        </span>
                      ) : (
                        <span
                          className="db-attempt__status db-attempt__status--completed"
                        >
                          <Check size={11} strokeWidth={2.5} />
                          Submitted
                        </span>
                      )}
                    </div>

                    <div className="db-attempt__actions">
                      <Link
                        href={`/mock-exam/${attempt.exam_slug}/review`}
                        className="db-attempt__link"
                      >
                        Review
                      </Link>
                      <Link
                        href={`/mock-exam/${attempt.exam_slug}/take`}
                        className="db-attempt__link"
                      >
                        Retake
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
