import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { reviewPaymentRequest } from "@/app/admin/actions";
import { formatExamPrice, getManualPaymentMethod } from "@/lib/payments/manual-payment";

type PaymentRequestDetail = {
  id: string;
  user_id: string;
  exam_id: string;
  payment_method: string;
  transaction_id: string;
  proof_url: string | null;
  amount_cents: number;
  currency: string;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  mock_exams: { title: string; slug: string } | { title: string; slug: string }[] | null;
};

function examRelation(rel: PaymentRequestDetail["mock_exams"]) {
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminPaymentRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { user } = await getAuthUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    notFound();
  }

  const { requestId } = await params;
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("payment_requests")
    .select(`
      id,
      user_id,
      exam_id,
      payment_method,
      transaction_id,
      proof_url,
      amount_cents,
      currency,
      status,
      admin_note,
      reviewed_at,
      created_at,
      mock_exams (
        title,
        slug
      )
    `)
    .eq("id", requestId)
    .single();

  const request = data as PaymentRequestDetail | null;
  if (!request) {
    notFound();
  }

  const exam = examRelation(request.mock_exams);
  const method = getManualPaymentMethod(request.payment_method);
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", request.user_id)
    .maybeSingle();

  let studentEmail: string | null = null;
  try {
    const { data: userData } = await admin.auth.admin.getUserById(request.user_id);
    studentEmail = userData.user?.email ?? null;
  } catch {
    studentEmail = null;
  }

  return (
    <>
      <div className="admin-dash-head">
        <div>
          <h1 className="admin-h1" style={{ marginBottom: "0.35rem" }}>
            Review Payment
          </h1>
          <p className="admin-lead" style={{ marginBottom: 0 }}>
            Check the payment details and approve access for this premium exam.
          </p>
        </div>
        <Link href="/admin/payments" className="btn btn-outline">
          Back to payments
        </Link>
      </div>

      <div className="admin-card">
        <div className="admin-review-grid">
          <div className="admin-review-item">
            <span className="admin-review-label">Student</span>
            <span className="admin-review-value">{profile?.full_name || `Student ${request.user_id.slice(0, 8)}`}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Email</span>
            <span className="admin-review-value">{studentEmail ?? "—"}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Exam</span>
            <span className="admin-review-value">{exam?.title ?? "Unknown exam"}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Amount</span>
            <span className="admin-review-value">{formatExamPrice(request.amount_cents, request.currency)}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Method</span>
            <span className="admin-review-value">{method.name}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Status</span>
            <span className="admin-review-value">{request.status}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Transaction ID</span>
            <span className="admin-review-value">{request.transaction_id}</span>
          </div>
          <div className="admin-review-item">
            <span className="admin-review-label">Submitted</span>
            <span className="admin-review-value">{formatDateTime(request.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h2>Payment proof</h2>
        {request.proof_url ? (
          <div className="admin-payment-proof">
            <a href={request.proof_url} target="_blank" rel="noreferrer" className="btn btn-outline">
              Open original proof
            </a>
            <div className="admin-payment-proof__preview">
              {request.proof_url.toLowerCase().endsWith(".pdf") ? (
                <iframe src={request.proof_url} title="Payment proof" />
              ) : (
                <Image src={request.proof_url} alt="Payment proof" fill sizes="(max-width: 768px) 100vw, 640px" style={{ objectFit: "contain" }} />
              )}
            </div>
          </div>
        ) : (
          <p className="admin-lead" style={{ marginBottom: 0 }}>
            No receipt was uploaded with this payment request.
          </p>
        )}
      </div>

      <div className="admin-card">
        <h2>Decision</h2>
        <form action={reviewPaymentRequest} className="admin-payment-review-form">
          <input type="hidden" name="request_id" value={request.id} />
          <label className="admin-label" htmlFor="payment-admin-note">
            Admin note
          </label>
          <textarea
            id="payment-admin-note"
            name="admin_note"
            className="admin-textarea"
            placeholder="Optional note for approval or rejection..."
            defaultValue={request.admin_note ?? ""}
          />
          <div className="admin-payment-review-actions">
            <button type="submit" name="decision" value="reject" className="btn btn-outline">
              Disapprove
            </button>
            <button type="submit" name="decision" value="approve" className="btn btn-primary btn-topbar-cta">
              Approve and grant access
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
