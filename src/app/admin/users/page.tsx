import Link from "next/link";
import { Search, Tag, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";

type UserListRow = {
  id: string;
  email: string | null;
  name: string | null;
  referralName: string | null;
  joinedAt: string | null;
  lastSignInAt: string | null;
  attempts: number;
  purchasedExams: number;
  bestBand: number | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function listAllUsers(admin: ReturnType<typeof createServiceRoleClient>) {
  const rows: Array<{
    id: string;
    email: string | null;
    created_at?: string | null;
    last_sign_in_at?: string | null;
    user_metadata?: Record<string, unknown> | null;
  }> = [];

  let page = 1;
  const perPage = 100;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users ?? [];
    rows.push(
      ...batch.map((user) => ({
        id: user.id,
        email: user.email ?? null,
        created_at: user.created_at ?? null,
        last_sign_in_at: user.last_sign_in_at ?? null,
        user_metadata: (user.user_metadata ?? null) as Record<string, unknown> | null,
      })),
    );
    if (batch.length < perPage) break;
    page += 1;
  }

  return rows;
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function includesText(haystack: string | null | undefined, needle: string) {
  if (!needle) return true;
  return normalize(haystack).includes(needle);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; referral?: string }>;
}) {
  const { user } = await getAuthUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    notFound();
  }

  const params = searchParams ? await searchParams : {};
  const query = normalize(params.q);
  const referralQuery = normalize(params.referral);

  const admin = createServiceRoleClient();
  const authUsers = await listAllUsers(admin);
  const userIds = authUsers.map((row) => row.id);

  const [{ data: profiles }, { data: attempts }, { data: entitlements }] = await Promise.all([
    userIds.length
      ? admin.from("profiles").select("id, full_name, referral_name").in("id", userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; referral_name: string | null }> }),
    userIds.length
      ? admin.from("mock_attempts").select("user_id, overall_band, status").in("user_id", userIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; overall_band: number | null; status: string }> }),
    userIds.length
      ? admin.from("exam_entitlements").select("user_id, exam_id").in("user_id", userIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; exam_id: string }> }),
  ]);

  const profileMap = new Map<string, string | null>();
  const referralMap = new Map<string, string | null>();
  for (const profile of profiles ?? []) {
    profileMap.set(profile.id, profile.full_name ?? null);
    referralMap.set(profile.id, profile.referral_name ?? null);
  }

  const attemptStats = new Map<string, { attempts: number; bestBand: number | null }>();
  for (const attempt of attempts ?? []) {
    const current = attemptStats.get(attempt.user_id) ?? { attempts: 0, bestBand: null };
    current.attempts += 1;
    if (attempt.status === "completed" && attempt.overall_band != null) {
      current.bestBand = current.bestBand == null
        ? Number(attempt.overall_band)
        : Math.max(current.bestBand, Number(attempt.overall_band));
    }
    attemptStats.set(attempt.user_id, current);
  }

  const entitlementCounts = new Map<string, Set<string>>();
  for (const entitlement of entitlements ?? []) {
    const current = entitlementCounts.get(entitlement.user_id) ?? new Set<string>();
    current.add(entitlement.exam_id);
    entitlementCounts.set(entitlement.user_id, current);
  }

  const allRows: UserListRow[] = authUsers
    .map((authUser) => {
      const meta = authUser.user_metadata;
      const metaName =
        typeof meta?.full_name === "string"
          ? meta.full_name
          : typeof meta?.name === "string"
            ? meta.name
            : null;
      const metaReferral =
        typeof meta?.referral_name === "string"
          ? meta.referral_name
          : typeof meta?.referral === "string"
            ? meta.referral
            : null;
      const stats = attemptStats.get(authUser.id);
      return {
        id: authUser.id,
        email: authUser.email,
        name: profileMap.get(authUser.id) || metaName || null,
        referralName: referralMap.get(authUser.id) || metaReferral || null,
        joinedAt: authUser.created_at ?? null,
        lastSignInAt: authUser.last_sign_in_at ?? null,
        attempts: stats?.attempts ?? 0,
        purchasedExams: entitlementCounts.get(authUser.id)?.size ?? 0,
        bestBand: stats?.bestBand ?? null,
      };
    })
    .sort((a, b) => {
      const aTime = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
      const bTime = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
      return bTime - aTime;
    });

  const rows = allRows.filter((row) => {
    const generalMatch =
      includesText(row.name, query) ||
      includesText(row.email, query) ||
      includesText(row.id, query);
    const referralMatch = referralQuery
      ? normalize(row.referralName).includes(referralQuery)
      : true;
    return generalMatch && referralMatch;
  });

  return (
    <>
      <div className="admin-dash-head">
        <div>
          <h1 className="admin-h1" style={{ marginBottom: "0.35rem" }}>
            Users
          </h1>
          <p className="admin-lead" style={{ marginBottom: 0 }}>
            View account details, purchased exams, recent attempts, and performance at a glance.
          </p>
        </div>
        <Link href="/admin" className="btn btn-outline">
          Back to dashboard
        </Link>
      </div>

      <div className="admin-card">
        <div className="admin-review-grid">
          <div className="admin-review-item">
            <span className="admin-review-label">Total users</span>
            <span className="admin-review-value">{allRows.length}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Users with attempts</span>
            <span className="admin-review-value">{allRows.filter((row) => row.attempts > 0).length}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Users with purchased exams</span>
            <span className="admin-review-value">{allRows.filter((row) => row.purchasedExams > 0).length}</span>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <form className="admin-user-filters" method="get">
          <label className="admin-user-filter">
            <span className="admin-label">Search users</span>
            <div className="admin-user-filter__field">
              <Search className="admin-user-filter__icon" strokeWidth={2} />
              <input
                type="search"
                name="q"
                className="admin-user-filter__input"
                placeholder="Search by email, name, or user ID..."
                defaultValue={params.q ?? ""}
              />
            </div>
          </label>
          <label className="admin-user-filter">
            <span className="admin-label">Referral</span>
            <div className="admin-user-filter__field">
              <Tag className="admin-user-filter__icon" strokeWidth={2} />
              <input
                type="search"
                name="referral"
                className="admin-user-filter__input"
                placeholder="Filter by referral name..."
                defaultValue={params.referral ?? ""}
              />
            </div>
          </label>
          <div className="admin-user-filters__actions">
            <button type="submit" className="btn btn-primary btn-topbar-cta">
              Search
            </button>
            {params.q || params.referral ? (
              <Link href="/admin/users" className="btn btn-outline">
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        <div className="admin-user-filters__meta">
          Showing {rows.length} of {allRows.length} user{allRows.length === 1 ? "" : "s"}
        </div>

        {rows.length === 0 ? (
          <div className="admin-empty-state">
            <Users />
            <h2>{allRows.length === 0 ? "No users yet" : "No matching users"}</h2>
            <p>
              {allRows.length === 0
                ? "Accounts created by students will appear here automatically."
                : "Try clearing one of the filters to see the full list again."}
            </p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Referral</th>
                  <th>Email</th>
                  <th>Joined</th>
                  <th>Attempts</th>
                  <th>Purchased exams</th>
                  <th>Best band</th>
                  <th>Last sign-in</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="admin-table-index">{index + 1}</td>
                    <td className="admin-table-title">{row.name || `Student ${row.id.slice(0, 8)}`}</td>
                    <td>{row.referralName ?? "—"}</td>
                    <td>{row.email ?? "—"}</td>
                    <td>{formatDateTime(row.joinedAt)}</td>
                    <td>{row.attempts}</td>
                    <td>{row.purchasedExams}</td>
                    <td>{row.bestBand != null ? row.bestBand.toFixed(1) : "—"}</td>
                    <td>{formatDateTime(row.lastSignInAt)}</td>
                    <td>
                      <Link href={`/admin/users/${row.id}`} className="btn btn-primary btn-topbar-cta">
                        View user
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
