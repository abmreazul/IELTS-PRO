"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MotionConfig, motion } from "framer-motion";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/site-url";
import { AuthSplitVisual } from "./auth-split-visual";
import { GoogleSignInIcon } from "./google-sign-in-icon";

const formVariants = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
};

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "auth") {
      setAuthError("Sign-in failed. Try again or use another method.");
    } else if (err === "config") {
      setAuthError("App configuration error. Check environment variables.");
    }
  }, [searchParams]);

  async function signInWithGoogle() {
    setAuthError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${getSiteUrl()}/auth/callback?next=/`,
        },
      });
      if (error) throw error;
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not start Google sign-in.";
      setAuthError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      router.replace("/");
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid email or password. Please try again.";
      setAuthError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      className="ca-step-body"
      variants={formVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <h1 className="ca-title">Sign in</h1>
      <p className="ca-subtitle">
        Welcome back — continue your IELTS preparation and mock tests.
      </p>

      {authError ? (
        <p className="ca-form-alert ca-form-alert--error" role="alert">
          {authError}
        </p>
      ) : null}

      <div className="ca-stack">
        <motion.button
          type="button"
          className="ca-btn ca-btn-social"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => signInWithGoogle()}
          disabled={loading}
        >
          <span className="ca-social-inner">
            <GoogleSignInIcon />
            Continue with Google
          </span>
        </motion.button>
      </div>

      <p className="ca-divider">Or continue with email</p>

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
        <div className="ca-field">
          <div className="ca-label-row">
            <span className="ca-label">Password</span>
            <Link href="/forgot-password" className="ca-inline-link">
              Forgot password?
            </Link>
          </div>
          <div className="ca-input-shell">
            <Lock className="ca-input-icon" strokeWidth={2} />
            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
          Sign in
          <ArrowRight size={18} strokeWidth={2.25} />
        </motion.button>
      </form>

      <p className="ca-footer-link">
        Don&apos;t have an account? <Link href="/create-account">Create account</Link>
      </p>
    </motion.div>
  );
}

function SignInFallback() {
  return (
    <div className="ca-step-body">
      <h1 className="ca-title">Sign in</h1>
      <p className="ca-subtitle">Loading…</p>
    </div>
  );
}

export function SignInPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="ca-page">
        <AuthSplitVisual />

        <div className="ca-form-panel">
          <div className="ca-form-scroll">
            <div className="ca-form-toolbar">
              <Link href="/" className="ca-back-home">
                ← Back to home
              </Link>
            </div>

            <div className="ca-form-inner">
              <Suspense fallback={<SignInFallback />}>
                <SignInForm />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
