import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main
        className="page"
        style={{
          display: "grid",
          placeItems: "center",
          padding: "2rem 1.5rem",
          minHeight: "calc(100svh - 72px)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "36rem",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "7rem",
              fontWeight: 800,
              lineHeight: 1,
              fontFamily: "var(--font-display), var(--font-sans), sans-serif",
              letterSpacing: "-0.04em",
              background: "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 60%, #ff8a65) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            404
          </p>
          <h1
            style={{
              margin: "0.75rem 0 0",
              fontFamily: "var(--font-display), var(--font-sans), sans-serif",
              fontSize: "1.75rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            Page not found
          </h1>
          <p
            style={{
              margin: "0.85rem 0 0",
              color: "var(--muted)",
              fontSize: "1.05rem",
              lineHeight: 1.7,
              maxWidth: "28rem",
              marginInline: "auto",
            }}
          >
            The page you&apos;re looking for doesn&apos;t exist or may have been moved.
            Head back to the homepage or explore our mock exams.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginTop: "1.75rem",
            }}
          >
            <Link href="/" className="btn btn-primary btn-topbar-cta">
              Go home
            </Link>
            <Link href="/mock-exam" className="btn btn-outline">
              Browse exams
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
