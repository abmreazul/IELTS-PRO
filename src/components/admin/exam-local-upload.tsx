"use client";

import { Upload } from "lucide-react";
import { useCallback, useRef, useState, useTransition } from "react";
import { uploadExamMedia } from "@/app/admin/actions";

type Props = {
  folder: "covers" | "listening";
  accept: string;
  label?: string;
  disabled?: boolean;
  onUploaded: (publicUrl: string) => void;
};

export function ExamLocalUpload({ folder, accept, label, disabled, onUploaded }: Props) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
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
    },
    [folder, onUploaded],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const isDisabled = disabled || pending;

  return (
    <div>
      {label ? <span className="admin-label" style={{ marginBottom: "0.5rem", display: "block" }}>{label}</span> : null}
      <div
        className={`admin-upload-zone${dragging ? " admin-upload-zone--active" : ""}${isDisabled ? " admin-upload-zone--disabled" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !isDisabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label="Upload file"
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={isDisabled}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) handleFile(file);
          }}
        />

        {pending ? (
          <div className="admin-upload-zone__content">
            <div className="admin-upload-zone__spinner" />
            <p className="admin-upload-zone__text">Uploading…</p>
          </div>
        ) : (
          <div className="admin-upload-zone__content">
            <div className="admin-upload-zone__icon">
              <Upload strokeWidth={1.5} />
            </div>
            <p className="admin-upload-zone__text">
              Click to upload or drag and drop
            </p>
            <p className="admin-upload-zone__hint">
              PNG, JPG up to 5MB
            </p>
          </div>
        )}
      </div>

      {err ? (
        <p style={{ fontSize: "0.78rem", color: "#c93429", margin: "0.5rem 0 0", fontWeight: 600 }}>{err}</p>
      ) : null}
    </div>
  );
}
