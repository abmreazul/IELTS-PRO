"use client";

import { Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { getSignedUploadUrl } from "@/app/admin/actions";

type Props = {
  folder: "covers" | "listening";
  accept: string;
  label?: string;
  disabled?: boolean;
  onUploaded: (publicUrl: string) => void;
};

const MAX_COVER_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 45 * 1024 * 1024;

export function ExamLocalUpload({ folder, accept, label, disabled, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setErr(null);

      // Client-side validation
      const mime = (file.type || "").toLowerCase();
      if (folder === "covers" && !mime.startsWith("image/")) {
        setErr("Cover must be an image (JPEG, PNG, WebP, or GIF).");
        return;
      }
      if (folder === "listening" && !mime.startsWith("audio/")) {
        setErr("Listening files must be audio (MP3, WAV, WebM, OGG).");
        return;
      }

      const maxBytes = folder === "covers" ? MAX_COVER_BYTES : MAX_AUDIO_BYTES;
      if (file.size > maxBytes) {
        setErr(`File too large. Max ${Math.round(maxBytes / 1024 / 1024)} MB.`);
        return;
      }

      setUploading(true);
      setProgress(0);

      try {
        // Step 1: Get signed upload URL from server (tiny request — no file data)
        const result = await getSignedUploadUrl(folder, file.name, file.type);
        if (!result.ok) {
          setErr(result.message);
          setUploading(false);
          return;
        }

        // Step 2: Upload directly to Supabase Storage from the browser
        const { signedUrl, publicUrl } = result;

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", signedUrl);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          };

          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.send(file);
        });

        onUploaded(publicUrl);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
        setProgress(0);
      }
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

  const isDisabled = disabled || uploading;

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

        {uploading ? (
          <div className="admin-upload-zone__content">
            <div className="admin-upload-zone__spinner" />
            <p className="admin-upload-zone__text">Uploading… {progress}%</p>
            <div className="admin-upload-progress">
              <div className="admin-upload-progress__bar" style={{ width: `${progress}%` }} />
            </div>
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
              {folder === "covers" ? "PNG, JPG up to 8MB" : "MP3, WAV up to 45MB"}
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
