"use client";

import Link from "next/link";
import { MotionConfig, motion } from "framer-motion";
import { ArrowRight, Mail } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/site-url";
import { AuthSplitVisual } from "./auth-split-visual";

const formVariants = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
};

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${getSiteUrl()}/auth/callback?next=/update-password`,
        },
      );
      if (resetError) throw resetError;
      setMessage("Check your email for a link to reset your password.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="ca-page">
        <AuthSplitVisual />

        <div className="ca-form-panel">
          <div className="ca-form-scroll">
            <div className="ca-form-toolbar">
              <Link href="/sign-in" className="ca-back-home">
                ← Back to sign in
              </Link>
            </div>

            <div className="ca-form-inner">
              <motion.div
                className="ca-step-body"
                variants={formVariants}
                initial="initial"
                animate="animate"
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <h1 className="ca-title">Forgot password</h1>
                <p className="ca-subtitle">
                  Enter your account email and we&apos;ll send you a reset link.
                </p>

                {error ? (
                  <p className="ca-form-alert ca-form-alert--error" role="alert">
                    {error}
                  </p>
                ) : null}
                {message ? (
                  <p className="ca-form-alert ca-form-alert--info" role="status">
                    {message}
                  </p>
                ) : null}

                <form className="ca-fields" onSubmit={handleSubmit}>
                  <div className="ca-field">
                    <span className="ca-label">Email Address</span>
                    <div className="ca-input-shell">
                      <Mail className="ca-input-icon" strokeWidth={2} />
                      <input
                        type="email"
                        name="email"
                        placeholder="you@example.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <motion.button
                    type="submit"
                    className="ca-btn ca-btn-primary"
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    disabled={loading}
                  >
                    Send reset link
                    <ArrowRight size={18} strokeWidth={2.25} />
                  </motion.button>
                </form>

                <p className="ca-footer-link">
                  Remember your password? <Link href="/sign-in">Sign in</Link>
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
