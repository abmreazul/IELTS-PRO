import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Take mock exam | IELTS Pro",
};

export default async function TakeMockExamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main className="page" style={{ padding: "3rem 1.5rem" }}>
      <div className="container" style={{ maxWidth: "36rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-display), var(--font-sans), sans-serif",
            fontSize: "1.75rem",
            fontWeight: 800,
          }}
        >
          Exam session
        </h1>
        <p style={{ color: "var(--muted)", marginTop: "0.75rem", lineHeight: 1.6 }}>
          The timed exam experience for <strong>{slug}</strong> is coming soon. You can still
          browse and purchase exams from the catalog.
        </p>
        <Link href="/mock-exam" className="btn btn-primary btn-topbar-cta" style={{ marginTop: "1.5rem" }}>
          Back to mock exams
        </Link>
      </div>
    </main>
  );
}
