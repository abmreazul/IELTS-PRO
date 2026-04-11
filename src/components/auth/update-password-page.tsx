"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MotionConfig, motion } from "framer-motion";
import { ArrowRight, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthSplitVisual } from "./auth-split-visual";

const formVariants = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
};

export function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error: userError } = await supabase.auth.getUser();
        if (cancelled) return;
        if (userError || !data.user) {
          setError("This link is invalid or has expired. Request a new reset email.");
        }
      } catch {
        if (!cancelled) {
          setError("This link is invalid or has expired. Request a new reset email.");
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      router.replace("/sign-in");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update password.");
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
                <h1 className="ca-title">Set new password</h1>
                <p className="ca-subtitle">Choose a strong password for your account.</p>

                {checking ? (
                  <p className="ca-subtitle">Verifying session…</p>
                ) : null}

                {error ? (
                  <p className="ca-form-alert ca-form-alert--error" role="alert">
                    {error}
                  </p>
                ) : null}

                {!checking && !error?.includes("invalid or has expired") ? (
                  <form className="ca-fields" onSubmit={handleSubmit}>
                    <div className="ca-field">
                      <span className="ca-label">New password</span>
                      <div className="ca-input-shell">
                        <Lock className="ca-input-icon" strokeWidth={2} />
                        <input
                          type="password"
                          name="password"
                          placeholder="At least 8 characters"
                          required
                          minLength={8}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="new-password"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="ca-field">
                      <span className="ca-label">Confirm password</span>
                      <div className="ca-input-shell">
                        <Lock className="ca-input-icon" strokeWidth={2} />
                        <input
                          type="password"
                          name="confirm"
                          placeholder="Repeat password"
                          required
                          minLength={8}
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                          autoComplete="new-password"
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
                      Update password
                      <ArrowRight size={18} strokeWidth={2.25} />
                    </motion.button>
                  </form>
                ) : null}

                {error?.includes("invalid or has expired") ? (
                  <p className="ca-footer-link">
                    <Link href="/forgot-password">Request a new link</Link>
                  </p>
                ) : null}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
