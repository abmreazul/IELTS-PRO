"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deletePaymentRequest } from "@/app/admin/actions";

export function DeletePaymentButton({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this payment request?\n\n" +
        "• If it was approved, the student's exam access will be revoked.\n" +
        "• This action cannot be undone.",
    );
    if (!confirmed) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.set("request_id", requestId);
      await deletePaymentRequest(fd);
    });
  }

  return (
    <button
      type="button"
      className="admin-icon-btn"
      title="Delete payment request"
      disabled={isPending}
      onClick={handleDelete}
      style={isPending ? { opacity: 0.4 } : undefined}
    >
      <Trash2 size={15} />
    </button>
  );
}
