import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import "../legal/legal.css";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "Read the Terms & Conditions that govern your use of The IELTS Exam platform.",
};

export default function TermsPage() {
  return (
    <main className="page legal">
      <div className="container legal__inner">
        <Link href="/" className="legal__back">
          <ChevronLeft size={16} strokeWidth={2.2} />
          Back to home
        </Link>

        <h1 className="legal__title">Terms &amp; Conditions</h1>
        <p className="legal__updated">Last updated: 28 April 2026</p>

        <hr className="legal__divider" />

        <div className="legal__body">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using The IELTS Exam platform (&ldquo;Service&rdquo;), operated by
            The IELTS Exam (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), you agree to be bound by
            these Terms &amp; Conditions. If you do not agree to all terms, you may not
            use the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            The IELTS Exam provides online IELTS preparation materials, including
            full-length mock exams (Listening, Reading, and Writing modules),
            AI-powered writing feedback, band score analytics, and video courses.
            The Service is intended for personal educational use only.
          </p>

          <h2>3. User Accounts</h2>
          <ul>
            <li>
              You must provide accurate information when creating an account and
              keep your login credentials secure.
            </li>
            <li>
              You are responsible for all activity under your account.
            </li>
            <li>
              We reserve the right to suspend or terminate accounts that violate
              these terms or show fraudulent activity.
            </li>
          </ul>

          <h2>4. Payments &amp; Refunds</h2>
          <p>
            Certain mock exams may require a one-time payment. Payments are processed
            through manual methods (bKash, Touch n Go, EBL, Maybank) and are subject
            to admin verification. Once an exam purchase has been verified and access
            granted, refunds are not available unless required by applicable consumer
            protection laws.
          </p>

          <h2>5. Intellectual Property</h2>
          <p>
            All content on the platform — including exam questions, reading passages,
            writing prompts, course materials, design assets, and branding — is owned
            by The IELTS Exam or its content partners. You may not reproduce,
            distribute, or commercially exploit any material without prior written
            consent.
          </p>

          <h2>6. AI Writing Evaluation</h2>
          <p>
            Writing submissions may be evaluated using AI (Gemini). AI-generated band
            scores and feedback are <strong>estimates only</strong> and are not
            official IELTS results. They are provided as a study aid and should not be
            relied upon as the sole indicator of exam readiness.
          </p>

          <h2>7. Prohibited Conduct</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Share your account with others or use shared accounts.</li>
            <li>Attempt to extract, scrape, or download exam content programmatically.</li>
            <li>Circumvent payment or entitlement checks.</li>
            <li>Disrupt the platform through automated tools, bots, or attacks.</li>
            <li>Submit plagiarised or AI-generated answers for evaluation purposes.</li>
          </ul>

          <h2>8. Disclaimers</h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We do
            not guarantee that the platform will be error-free or uninterrupted.
            IELTS is a registered trademark of the British Council, IDP, and Cambridge
            Assessment. The IELTS Exam is an independent preparation platform and is
            not affiliated with, endorsed by, or connected to any official IELTS body.
          </p>

          <h2>9. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, The IELTS Exam shall not be liable
            for any indirect, incidental, or consequential damages arising from your
            use of the Service — including but not limited to lost exam opportunities,
            band score inaccuracies, or service interruptions.
          </p>

          <h2>10. Changes to These Terms</h2>
          <p>
            We may update these terms from time to time. Continued use of the platform
            after changes are posted constitutes acceptance of the updated terms. We
            will note the &ldquo;Last updated&rdquo; date at the top of this page.
          </p>

          <h2>11. Governing Law</h2>
          <p>
            These terms are governed by and construed in accordance with the laws of
            your local jurisdiction. Any disputes shall be resolved through good-faith
            negotiation before formal proceedings.
          </p>

          <div className="legal__contact">
            <p>
              <strong>Questions about these terms?</strong> Contact us at{" "}
              <a href="mailto:support@theieltsexam.com">support@theieltsexam.com</a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
