"use client";

import { Upload, Video, Image as ImageIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { getSignedCourseUploadUrl } from "@/app/admin/actions";

type Props = {
  folder: "covers" | "videos";
  accept: string;
  label?: string;
  disabled?: boolean;
  onUploaded: (publicUrl: string) => void;
};

const MAX_COVER_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 250 * 1024 * 1024;

export function CourseMediaUpload({ folder, accept, label, disabled, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setErr(null);
      const mime = (file.type || "").toLowerCase();
      if (folder === "covers" && !mime.startsWith("image/")) {
        setErr("Course cover must be an image.");
        return;
      }
      if (folder === "videos" && !mime.startsWith("video/")) {
        setErr("Lesson uploads must be video files.");
        return;
      }

      const maxBytes = folder === "covers" ? MAX_COVER_BYTES : MAX_VIDEO_BYTES;
      if (file.size > maxBytes) {
        setErr(`File too large. Max ${Math.round(maxBytes / 1024 / 1024)} MB.`);
        return;
      }

      setUploading(true);
      setProgress(0);

      try {
        const result = await getSignedCourseUploadUrl(folder, file.name);
        if (!result.ok) {
          setErr(result.message);
          setUploading(false);
          return;
        }

        const { signedUrl, publicUrl } = result;

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", signedUrl);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setProgress(Math.round((event.loaded / event.total) * 100));
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
      } catch (error) {
        setErr(error instanceof Error ? error.message : "Upload failed");
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [folder, onUploaded],
  );

  const isDisabled = disabled || uploading;

  return (
    <div>
      {label ? <span className="admin-label" style={{ marginBottom: "0.5rem", display: "block" }}>{label}</span> : null}
      <div
        className={`admin-upload-zone${dragging ? " admin-upload-zone--active" : ""}${isDisabled ? " admin-upload-zone--disabled" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        onClick={() => !isDisabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={isDisabled}
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleFile(file);
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
              {folder === "videos" ? <Video strokeWidth={1.5} /> : <ImageIcon strokeWidth={1.5} />}
            </div>
            <p className="admin-upload-zone__text">Click to upload or drag and drop</p>
            <p className="admin-upload-zone__hint">
              {folder === "videos" ? "MP4, MOV, WebM up to 250MB" : "PNG, JPG up to 8MB"}
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
