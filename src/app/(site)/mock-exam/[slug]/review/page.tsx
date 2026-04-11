import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Review results | IELTS Pro",
};

export default async function ReviewMockExamPage({
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
          Review results
        </h1>
        <p style={{ color: "var(--muted)", marginTop: "0.75rem", lineHeight: 1.6 }}>
          Detailed breakdown for <strong>{slug}</strong> will appear here after the exam player
          ships.
        </p>
        <Link href="/mock-exam" className="btn btn-outline" style={{ marginTop: "1.5rem" }}>
          Back to mock exams
        </Link>
      </div>
    </main>
  );
}
