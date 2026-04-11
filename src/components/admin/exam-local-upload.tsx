"use client";

import { useState, useTransition } from "react";
import { uploadExamMedia } from "@/app/admin/actions";

type Props = {
  folder: "covers" | "listening";
  accept: string;
  label: string;
  disabled?: boolean;
  onUploaded: (publicUrl: string) => void;
};

export function ExamLocalUpload({ folder, accept, label, disabled, onUploaded }: Props) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <div>
      <label className="admin-label" style={{ marginBottom: "0.35rem", display: "block" }}>
        {label}
      </label>
      <input
        type="file"
        accept={accept}
        disabled={disabled || pending}
        className="admin-input"
        style={{ padding: "0.4rem", fontSize: "0.85rem" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setErr(null);
          startTransition(async () => {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("folder", folder);
            const res = await uploadExamMedia(fd);
            if (!res.ok) {
              setErr(res.message);
              return;
            }
            onUploaded(res.url);
          });
        }}
      />
      {pending ? (
        <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0.35rem 0 0" }}>Uploading…</p>
      ) : null}
      {err ? (
        <p style={{ fontSize: "0.78rem", color: "#c93429", margin: "0.35rem 0 0", fontWeight: 600 }}>{err}</p>
      ) : null}
    </div>
  );
}
