"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <main
          style={{
            minHeight: "100svh",
            display: "grid",
            placeItems: "center",
            padding: "2rem 1.5rem",
            background: "#fff",
            color: "#111827",
            fontFamily: "var(--font-sans, sans-serif)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "34rem",
              padding: "2rem",
              border: "1px solid #e5e7eb",
              borderRadius: "24px",
              background: "#ffffff",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, color: "#6b7280", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.08em" }}>
              Critical error
            </p>
            <h1 style={{ margin: "0.75rem 0 0", fontSize: "2rem", fontWeight: 800 }}>
              The app hit an unrecoverable error.
            </h1>
            <p style={{ margin: "0.9rem 0 0", color: "#4b5563", lineHeight: 1.7 }}>
              Reset the app state or return to the homepage.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.5rem" }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  border: 0,
                  borderRadius: "999px",
                  padding: "0.8rem 1.35rem",
                  background: "var(--primary, #c50c2f)",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Reload app
              </button>
              <Link
                href="/"
                style={{
                  borderRadius: "999px",
                  padding: "0.8rem 1.35rem",
                  border: "1px solid #d1d5db",
                  color: "#111827",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Go home
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
