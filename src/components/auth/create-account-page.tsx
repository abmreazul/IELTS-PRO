"use client";

import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Lock,
  Mail,
  Tag,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/site-url";
import { AuthSplitVisual } from "./auth-split-visual";
import { GoogleSignInIcon } from "./google-sign-in-icon";

const PROFILE_STORAGE_KEY = "ielts_ca_profile";

const STEP_LABELS = ["Personal", "Account", "Complete"] as const;

function isValidEmail(value: string): boolean {
  const t = value.trim();
  return t.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function persistProfileDraft(fullName: string, institution: string, referralName: string) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify({
      full_name: fullName.trim(),
      institution: institution.trim(),
      referral_name: referralName.trim(),
    }),
  );
}

function StepCircle({
  n,
  currentStep,
}: {
  n: 1 | 2 | 3;
  currentStep: number;
}) {
  const done = currentStep > n;
  const active = currentStep === n;

  return (
    <div
      className={`ca-stepper__circle ${done ? "is-done" : active ? "is-active" : "is-todo"}`}
      aria-hidden
    >
      {done ? (
        <Check className="ca-stepper__check" strokeWidth={2.5} size={18} aria-hidden />
      ) : (
        n
      )}
    </div>
  );
}

function Stepper({
  step,
  canGoTo,
  onSelectStep,
}: {
  step: 1 | 2 | 3;
  canGoTo: (n: 1 | 2 | 3) => boolean;
  onSelectStep: (n: 1 | 2 | 3) => void;
}) {
  return (
    <div className="ca-stepper" role="navigation" aria-label="Registration steps">
      <div className="ca-stepper__row">
        <button
          type="button"
          className={`ca-stepper__hit${step === 1 ? " is-current" : ""}`}
          disabled={!canGoTo(1)}
          onClick={() => onSelectStep(1)}
          aria-current={step === 1 ? "step" : undefined}
          title={canGoTo(1) ? "Personal details" : "Unavailable"}
        >
          <StepCircle n={1} currentStep={step} />
          <span className="ca-stepper__label">{STEP_LABELS[0]}</span>
        </button>
        <div className={`ca-stepper__connector${step >= 2 ? " is-done" : ""}`} aria-hidden />
        <button
          type="button"
          className={`ca-stepper__hit${step === 2 ? " is-current" : ""}`}
          disabled={!canGoTo(2)}
          onClick={() => onSelectStep(2)}
          aria-current={step === 2 ? "step" : undefined}
          title={
            canGoTo(2)
              ? "Email and password"
              : "Enter your name on the previous step first"
          }
        >
          <StepCircle n={2} currentStep={step} />
          <span className="ca-stepper__label">{STEP_LABELS[1]}</span>
        </button>
        <div className={`ca-stepper__connector${step >= 3 ? " is-done" : ""}`} aria-hidden />
        <button
          type="button"
          className={`ca-stepper__hit${step === 3 ? " is-current" : ""}`}
          disabled={!canGoTo(3)}
          onClick={() => onSelectStep(3)}
          aria-current={step === 3 ? "step" : undefined}
          title={
            canGoTo(3)
              ? "Done"
              : "Finish the account step first"
          }
        >
          <StepCircle n={3} currentStep={step} />
          <span className="ca-stepper__label">{STEP_LABELS[2]}</span>
        </button>
      </div>
    </div>
  );
}

const formVariants = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export function CreateAccountPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [institution, setInstitution] = useState("");
  const [referralName, setReferralName] = useState("");
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [completeReached, setCompleteReached] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

  const personalValid = useMemo(() => fullName.trim().length > 0, [fullName]);
  const accountValid = useMemo(
    () => isValidEmail(email) && password.length >= 8,
    [email, password],
  );

  const finishedWithSession = step === 3 && !needsEmailVerification;

  const canGoTo = useMemo(
    () => (n: 1 | 2 | 3) => {
      if (finishedWithSession) {
        return n === 3;
      }
      if (n === 1) return true;
      if (n === 2) return personalValid;
      if (n === 3) return completeReached;
      return false;
    },
    [finishedWithSession, personalValid, completeReached],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled || !user) return;
        const raw =
          typeof sessionStorage !== "undefined"
            ? sessionStorage.getItem(PROFILE_STORAGE_KEY)
            : null;
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          full_name?: string;
          institution?: string;
          referral_name?: string;
        };
        await supabase
          .from("profiles")
          .update({
            full_name: parsed.full_name?.trim() || null,
            institution: parsed.institution?.trim() || null,
            referral_name: parsed.referral_name?.trim() || null,
          })
          .eq("id", user.id);
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem(PROFILE_STORAGE_KEY);
        }
        if (!cancelled) {
          setCompleteReached(true);
          setNeedsEmailVerification(false);
          setStep(3);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSelectStep(n: 1 | 2 | 3) {
    if (!canGoTo(n)) return;
    if (n === 2 && step === 3 && needsEmailVerification) {
      setCompleteReached(false);
      setNeedsEmailVerification(false);
    }
    setStep(n);
  }

  async function signInWithGoogle() {
    if (!personalValid) return;
    setAuthError(null);
    setLoading(true);
    persistProfileDraft(fullName, institution, referralName);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${getSiteUrl()}/auth/callback?next=/create-account`,
          queryParams: {
            prompt: "select_account",
          },
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

  function handleStep1Continue(e: React.FormEvent) {
    e.preventDefault();
    if (!personalValid) return;
    setAuthError(null);
    persistProfileDraft(fullName, institution, referralName);
    setStep(2);
  }

  async function handleStep2Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountValid || !personalValid) return;
    setAuthError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const meta: { full_name: string; institution?: string; referral_name?: string } = {
        full_name: fullName.trim(),
      };
      const inst = institution.trim();
      if (inst) meta.institution = inst;
      const ref = referralName.trim();
      if (ref) meta.referral_name = ref;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${getSiteUrl()}/auth/callback`,
          data: meta,
        },
      });
      if (error) throw error;
      setCompleteReached(true);
      if (data.session) {
        setNeedsEmailVerification(false);
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            full_name: fullName.trim(),
            institution: inst || null,
            referral_name: ref || null,
          })
          .eq("id", data.session.user.id);
        if (profileError) throw profileError;
      } else {
        setNeedsEmailVerification(true);
      }
      setStep(3);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Sign up failed. Please try again.";
      setAuthError(message);
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
              <Link href="/" className="ca-back-home">
                ← Back to home
              </Link>
            </div>

            <div className="ca-form-inner">
              <Stepper step={step} canGoTo={canGoTo} onSelectStep={handleSelectStep} />

              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="s1"
                    variants={formVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="ca-step-body"
                  >
                    <h1 className="ca-title">Personal information</h1>
                    <p className="ca-subtitle">Tell us a bit about you — then you&apos;ll set up your login.</p>

                    {authError ? (
                      <p className="ca-form-alert ca-form-alert--error" role="alert">
                        {authError}
                      </p>
                    ) : null}

                    <form className="ca-fields" onSubmit={handleStep1Continue}>
                      <div className="ca-field">
                        <span className="ca-label">Full name</span>
                        <div className="ca-input-shell">
                          <User className="ca-input-icon" strokeWidth={2} />
                          <input
                            type="text"
                            name="fullName"
                            placeholder="John Doe"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            autoComplete="name"
                          />
                        </div>
                      </div>
                      <div className="ca-field">
                        <span className="ca-label">Institution (optional)</span>
                        <div className="ca-input-shell">
                          <Building2 className="ca-input-icon" strokeWidth={2} />
                          <input
                            type="text"
                            name="institution"
                            placeholder="e.g. City Language Institute"
                            value={institution}
                            onChange={(e) => setInstitution(e.target.value)}
                            autoComplete="organization"
                          />
                        </div>
                      </div>
                      <div className="ca-field">
                        <span className="ca-label">Referral name (optional)</span>
                        <div className="ca-input-shell">
                          <Tag className="ca-input-icon" strokeWidth={2} />
                          <input
                            type="text"
                            name="referralName"
                            placeholder="Who referred you?"
                            value={referralName}
                            onChange={(e) => setReferralName(e.target.value)}
                            autoComplete="off"
                          />
                        </div>
                        <p className="ca-hint">Optional. Used only for referral tracking in admin.</p>
                      </div>
                      <motion.button
                        type="submit"
                        className="ca-btn ca-btn-primary"
                        whileHover={{ scale: 1.01, y: -1 }}
                        whileTap={{ scale: 0.99 }}
                        disabled={!personalValid}
                      >
                        Continue
                        <ArrowRight size={18} strokeWidth={2.25} />
                      </motion.button>
                    </form>

                    <p className="ca-footer-link">
                      Already have an account? <Link href="/sign-in">Sign in</Link>
                    </p>
                  </motion.div>
                ) : null}

                {step === 2 ? (
                  <motion.div
                    key="s2"
                    variants={formVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="ca-step-body"
                  >
                    <h1 className="ca-title">Create your account</h1>
                    <p className="ca-subtitle">Use Google or your email and a password.</p>

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
                        disabled={loading || !personalValid}
                      >
                        <span className="ca-social-inner">
                          <GoogleSignInIcon />
                          Continue with Google
                        </span>
                      </motion.button>
                    </div>

                    <p className="ca-divider">Or sign up with email</p>

                    <form className="ca-fields" onSubmit={handleStep2Submit}>
                      <div className="ca-field">
                        <span className="ca-label">Email</span>
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
                        <span className="ca-label">Password</span>
                        <div className="ca-input-shell">
                          <Lock className="ca-input-icon" strokeWidth={2} />
                          <input
                            type="password"
                            name="password"
                            placeholder="At least 8 characters"
                            minLength={8}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            disabled={loading}
                          />
                        </div>
                        <p className="ca-hint">Must be at least 8 characters</p>
                      </div>

                      <div className="ca-btn-row">
                        <motion.button
                          type="button"
                          className="ca-btn ca-btn-outline"
                          onClick={() => setStep(1)}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          disabled={loading}
                        >
                          <ArrowLeft size={18} strokeWidth={2.25} />
                          Back
                        </motion.button>
                        <motion.button
                          type="submit"
                          className="ca-btn ca-btn-primary"
                          whileHover={{ scale: 1.01, y: -1 }}
                          whileTap={{ scale: 0.99 }}
                          disabled={loading || !accountValid}
                        >
                          Create account
                          <ArrowRight size={18} strokeWidth={2.25} />
                        </motion.button>
                      </div>
                    </form>

                    <p className="ca-footer-link">
                      Already have an account? <Link href="/sign-in">Sign in</Link>
                    </p>
                  </motion.div>
                ) : null}

                {step === 3 ? (
                  <motion.div
                    key="s3"
                    variants={formVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="ca-step-body ca-success-wrap"
                  >
                    {needsEmailVerification ? (
                      <>
                        <motion.div
                          className="ca-success-icon ca-success-icon--mail"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 22 }}
                        >
                          <Mail size={34} strokeWidth={2.25} />
                        </motion.div>
                        <h1 className="ca-title">Check your email</h1>
                        <p className="ca-subtitle ca-verify-copy">
                          We sent a verification link to <strong>{email.trim()}</strong>. Open that
                          message and click the link to confirm your account. After that, sign in to
                          start using The IELTS Exam.
                        </p>
                        <div className="ca-stack">
                          <Link href="/sign-in" className="ca-btn ca-btn-primary">
                            Sign in
                            <ArrowRight size={18} strokeWidth={2.25} />
                          </Link>
                          <Link href="/" className="ca-btn ca-btn-outline">
                            Back to home
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        <motion.div
                          className="ca-success-icon"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 22 }}
                        >
                          <Check size={36} strokeWidth={2.5} />
                        </motion.div>
                        <h1 className="ca-title">You&apos;re all set</h1>
                        <p className="ca-subtitle">
                          Your account is ready. Your name, institution, and referral details are saved to your profile.
                        </p>
                        <div className="ca-stack">
                          <Link href="/" className="ca-btn ca-btn-primary">
                            Go to dashboard
                            <ArrowRight size={18} strokeWidth={2.25} />
                          </Link>
                          <Link href="/" className="ca-btn ca-btn-outline">
                            Back to home
                          </Link>
                        </div>
                      </>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
