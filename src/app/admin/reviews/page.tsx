import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { normalizeExamModules } from "@/lib/exam/ielts-defaults";

type PendingAttemptRow = {
  id: string;
  user_id: string;
  completed_at: string | null;
  created_at: string;
  writing_band: number | null;
  mock_exams: {
    title: string;
    slug: string;
    modules: string[];
  } | { title: string; slug: string; modules: string[] }[] | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function moduleBadgeClass(module: string) {
  return `admin-badge admin-badge--${module}`;
}

function examRelation(rel: PendingAttemptRow["mock_exams"]) {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

async function getStudentMaps(admin: ReturnType<typeof createServiceRoleClient>, userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const profileMap = new Map<string, string | null>();
  const emailMap = new Map<string, string | null>();

  if (uniqueUserIds.length === 0) {
    return { profileMap, emailMap };
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", uniqueUserIds);

  for (const profile of profiles ?? []) {
    profileMap.set(profile.id, profile.full_name ?? null);
  }

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      try {
        const { data } = await admin.auth.admin.getUserById(userId);
        emailMap.set(userId, data.user?.email ?? null);
      } catch {
        emailMap.set(userId, null);
      }
    }),
  );

  return { profileMap, emailMap };
}

export default async function AdminReviewsPage() {
  const { user } = await getAuthUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    notFound();
  }

  const admin = createServiceRoleClient();
  const { data: attempts } = await admin
    .from("mock_attempts")
    .select(`
      id,
      user_id,
      completed_at,
      created_at,
      writing_band,
      mock_exams (
        title,
        slug,
        modules
      )
    `)
    .eq("review_status", "pending")
    .order("completed_at", { ascending: false })
    .limit(100);

  const rows = (attempts ?? []) as PendingAttemptRow[];
  const { profileMap, emailMap } = await getStudentMaps(admin, rows.map((row) => row.user_id));

  return (
    <>
      <div className="admin-dash-head">
        <div>
          <h1 className="admin-h1" style={{ marginBottom: "0.35rem" }}>
            Review Queue
          </h1>
          <p className="admin-lead" style={{ marginBottom: 0 }}>
            Unfinished human-marking tasks for writing submissions.
          </p>
        </div>
        <Link href="/admin" className="btn btn-outline">
          Back to dashboard
        </Link>
      </div>

      <div className="admin-card">
        <div className="admin-review-grid">
          <div className="admin-review-item">
            <span className="admin-review-label">Pending tasks</span>
            <span className="admin-review-value">{rows.length}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Needs writing review</span>
            <span className="admin-review-value">
              {rows.filter((row) => {
                const exam = examRelation(row.mock_exams);
                return normalizeExamModules(exam?.modules).includes("writing");
              }).length}
            </span>
          </div>
        </div>
      </div>

      <div className="admin-card">
        {rows.length === 0 ? (
          <div className="admin-empty-state">
            <ClipboardCheck />
            <h2>Nothing waiting for review</h2>
            <p>When students submit writing answers, they will show up here.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Exam</th>
                  <th>Needs review</th>
                  <th>Submitted</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const exam = examRelation(row.mock_exams);
                  const modules = normalizeExamModules(exam?.modules);
                  const pendingModules = [
                    modules.includes("writing") && row.writing_band == null ? "writing" : null,
                  ].filter(Boolean) as string[];

                  return (
                    <tr key={row.id}>
                      <td className="admin-table-title">
                        {profileMap.get(row.user_id) || `Student ${row.user_id.slice(0, 8)}`}
                      </td>
                      <td>{emailMap.get(row.user_id) ?? "—"}</td>
                      <td>{exam?.title ?? "Unknown exam"}</td>
                      <td>
                        <div className="admin-table-actions">
                          {pendingModules.map((module) => (
                            <span key={module} className={moduleBadgeClass(module)}>
                              {module}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>{formatDateTime(row.completed_at ?? row.created_at)}</td>
                      <td>
                        <Link href={`/admin/reviews/${row.id}`} className="btn btn-primary btn-topbar-cta">
                          Review now
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
