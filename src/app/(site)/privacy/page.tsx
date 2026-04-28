import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import "../legal/legal.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how The IELTS Exam collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <main className="page legal">
      <div className="container legal__inner">
        <Link href="/" className="legal__back">
          <ChevronLeft size={16} strokeWidth={2.2} />
          Back to home
        </Link>

        <h1 className="legal__title">Privacy Policy</h1>
        <p className="legal__updated">Last updated: 28 April 2026</p>

        <hr className="legal__divider" />

        <div className="legal__body">
          <h2>1. Introduction</h2>
          <p>
            The IELTS Exam (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is committed to protecting your
            privacy. This Privacy Policy explains how we collect, use, store, and
            protect your personal information when you use our platform.
          </p>

          <h2>2. Information We Collect</h2>
          <p>We collect the following categories of information:</p>
          <ul>
            <li>
              <strong>Account information:</strong> Name, email address, and
              authentication data (password hash or OAuth provider ID).
            </li>
            <li>
              <strong>Exam data:</strong> Your answers, band scores, writing
              submissions, and AI-generated feedback.
            </li>
            <li>
              <strong>Payment information:</strong> Transaction IDs, payment method
              used, and uploaded payment proof images.
            </li>
            <li>
              <strong>Usage data:</strong> Pages visited, exam attempts started and
              completed, device type, and browser information.
            </li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <p>Your information is used to:</p>
          <ul>
            <li>Provide and personalise the IELTS preparation experience.</li>
            <li>Score your exam attempts and display band analytics.</li>
            <li>Process and verify payment requests for premium exams.</li>
            <li>Send AI-generated writing evaluations via Gemini.</li>
            <li>Improve the platform based on aggregate usage patterns.</li>
            <li>Communicate account-related updates (e.g., password reset).</li>
          </ul>

          <h2>4. Data Storage &amp; Security</h2>
          <p>
            Your data is stored securely using <strong>Supabase</strong> (hosted on
            cloud infrastructure with encryption at rest and in transit). We implement
            Row Level Security (RLS) policies to ensure users can only access their
            own data. Payment proof images are stored in private buckets accessible
            only to administrators.
          </p>

          <h2>5. Third-Party Services</h2>
          <p>We integrate with the following third-party services:</p>
          <ul>
            <li>
              <strong>Supabase:</strong> Authentication, database, and file storage.
            </li>
            <li>
              <strong>Google Gemini AI:</strong> Writing submissions are sent to the
              Gemini API for band estimation and feedback. Only the writing prompt and
              your written response are transmitted — no personal identifiers are
              included.
            </li>
            <li>
              <strong>Vercel:</strong> Application hosting and edge delivery.
            </li>
          </ul>
          <p>
            Each third-party service operates under its own privacy policy. We
            encourage you to review their policies independently.
          </p>

          <h2>6. Cookies &amp; Local Storage</h2>
          <p>
            We use cookies for authentication session management (Supabase auth
            tokens). We also use browser <strong>localStorage</strong> to save
            in-progress exam drafts so you don&apos;t lose work if you navigate away.
            Draft data is cleared when you submit the exam.
          </p>

          <h2>7. Data Retention</h2>
          <p>
            Your account data and exam history are retained as long as your account
            remains active. If you delete your account, your personal data will be
            removed within 30 days. Anonymised, aggregate analytics data may be
            retained indefinitely.
          </p>

          <h2>8. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate information.</li>
            <li>Request deletion of your account and associated data.</li>
            <li>Withdraw consent for data processing where applicable.</li>
            <li>Export your exam results and band score history.</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at the email address below.
          </p>

          <h2>9. Children&apos;s Privacy</h2>
          <p>
            The Service is not intended for children under the age of 13. We do not
            knowingly collect personal information from children under 13. If you
            believe we have inadvertently collected such information, please contact
            us immediately.
          </p>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy periodically. Changes will be reflected
            with an updated &ldquo;Last updated&rdquo; date. Continued use of the platform
            after changes are posted constitutes acceptance of the revised policy.
          </p>

          <div className="legal__contact">
            <p>
              <strong>Privacy questions?</strong> Contact us at{" "}
              <a href="mailto:privacy@theieltsexam.com">privacy@theieltsexam.com</a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
