import Link from "next/link";
import { Wallet } from "lucide-react";
import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { formatExamPrice, getManualPaymentMethod } from "@/lib/payments/manual-payment";

type PaymentRequestRow = {
  id: string;
  user_id: string;
  exam_id: string;
  payment_method: string;
  transaction_id: string;
  amount_cents: number;
  currency: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  mock_exams: { title: string; slug: string } | { title: string; slug: string }[] | null;
};

function examRelation(rel: PaymentRequestRow["mock_exams"]) {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function getStudentMaps(admin: ReturnType<typeof createServiceRoleClient>, userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const profileMap = new Map<string, string | null>();
  const emailMap = new Map<string, string | null>();

  if (uniqueUserIds.length === 0) return { profileMap, emailMap };

  const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", uniqueUserIds);
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

export default async function AdminPaymentsPage() {
  const { user } = await getAuthUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    notFound();
  }

  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("payment_requests")
    .select(`
      id,
      user_id,
      exam_id,
      payment_method,
      transaction_id,
      amount_cents,
      currency,
      status,
      created_at,
      mock_exams (
        title,
        slug
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as PaymentRequestRow[];
  const { profileMap, emailMap } = await getStudentMaps(admin, rows.map((row) => row.user_id));
  const pendingRows = rows.filter((row) => row.status === "pending");

  return (
    <>
      <div className="admin-dash-head">
        <div>
          <h1 className="admin-h1" style={{ marginBottom: "0.35rem" }}>
            Payment Queue
          </h1>
          <p className="admin-lead" style={{ marginBottom: 0 }}>
            Approve or reject manual payment submissions for premium mock exams.
          </p>
        </div>
        <Link href="/admin" className="btn btn-outline">
          Back to dashboard
        </Link>
      </div>

      <div className="admin-card">
        <div className="admin-review-grid">
          <div className="admin-review-item">
            <span className="admin-review-label">Pending payments</span>
            <span className="admin-review-value">{pendingRows.length}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Total requests</span>
            <span className="admin-review-value">{rows.length}</span>
          </div>
        </div>
      </div>

      <div className="admin-card">
        {rows.length === 0 ? (
          <div className="admin-empty-state">
            <Wallet />
            <h2>No payment requests yet</h2>
            <p>Manual payment submissions from users will show up here.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Exam</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const exam = examRelation(row.mock_exams);
                  const method = getManualPaymentMethod(row.payment_method);
                  return (
                    <tr key={row.id}>
                      <td className="admin-table-title">
                        {profileMap.get(row.user_id) || `Student ${row.user_id.slice(0, 8)}`}
                      </td>
                      <td>{emailMap.get(row.user_id) ?? "—"}</td>
                      <td>{exam?.title ?? "Unknown exam"}</td>
                      <td>{method.name}</td>
                      <td>{formatExamPrice(row.amount_cents, row.currency)}</td>
                      <td>
                        <span
                          className={`admin-badge ${
                            row.status === "approved"
                              ? "admin-badge--published"
                              : row.status === "rejected"
                                ? "admin-badge--draft"
                                : "admin-badge--full"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>{formatDateTime(row.created_at)}</td>
                      <td>
                        <Link href={`/admin/payments/${row.id}`} className="btn btn-primary btn-topbar-cta">
                          Review
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
