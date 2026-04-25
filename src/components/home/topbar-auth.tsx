"use client";

import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

/* ── Shared auth hook ─────────────────────────────────────────────────
 * Both TopbarAuthDesktop and TopbarAuthMobile render in every layout.
 * Previously each created its own Supabase client, called getUser(),
 * and subscribed to onAuthStateChange — doubling the auth overhead.
 *
 * This module-level singleton ensures ONE client, ONE getUser() call,
 * and ONE auth listener regardless of how many components consume it.
 * ─────────────────────────────────────────────────────────────────── */

let cachedUser: User | null = null;
let listeners = new Set<() => void>();
let initialised = false;

function emitChange() {
  for (const fn of listeners) fn();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Initialise the singleton on first subscription (CSR only)
  if (!initialised) {
    initialised = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      cachedUser = data.user ?? null;
      emitChange();
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      cachedUser = session?.user ?? null;
      emitChange();
    });
  }
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return cachedUser;
}

function useAuthUser() {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function displayName(user: User) {
  const meta = user.user_metadata as Record<string, string | undefined> | undefined;
  const n = meta?.full_name?.trim() || meta?.name?.trim();
  if (n) return n;
  return user.email?.split("@")[0] ?? "Account";
}

/* ── Desktop ─────────────────────────────────────────────────────── */

export function TopbarAuthDesktop() {
  const user = useAuthUser();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = document.querySelector("[data-topbar-profile]");
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.refresh();
  }

  if (user) {
    return (
      <div className="topbar-profile nav--desktop" data-topbar-profile>
        <button
          type="button"
          className="topbar-profile__trigger"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Account menu"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setOpen((o) => !o)}
        >
          <UserRound className="topbar-profile__icon" strokeWidth={2} aria-hidden />
        </button>
        {open ? (
          <div className="topbar-profile__menu" role="menu">
            <div className="topbar-profile__meta">
              <span className="topbar-profile__name">{displayName(user)}</span>
              <span className="topbar-profile__email">{user.email}</span>
            </div>
            <Link
              href="/dashboard"
              className="topbar-profile__logout"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <LayoutDashboard size={18} strokeWidth={2} aria-hidden />
              Dashboard
            </Link>
            <button
              type="button"
              className="topbar-profile__logout"
              role="menuitem"
              onClick={() => signOut()}
            >
              <LogOut size={18} strokeWidth={2} aria-hidden />
              Log out
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <Link href="/sign-in" className="link-btn nav--desktop">
        Sign In
      </Link>
      <motion.div
        className="nav--desktop"
        style={{ display: "inline-flex" }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Link href="/create-account" className="btn btn-primary btn-topbar-cta">
          Get Started
        </Link>
      </motion.div>
    </>
  );
}

/* ── Mobile ──────────────────────────────────────────────────────── */

export function TopbarAuthMobile({ onNavigate }: { onNavigate: () => void }) {
  const user = useAuthUser();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    onNavigate();
    router.refresh();
  }

  if (user) {
    return (
      <>
        <div className="mobile-drawer__user">
          <span className="mobile-drawer__user-name">{displayName(user)}</span>
          <span className="mobile-drawer__user-email">{user.email}</span>
        </div>
        <Link href="/dashboard" className="btn btn-ghost btn-block" onClick={onNavigate} style={{ justifyContent: "center", gap: "0.5rem" }}>
          <LayoutDashboard size={18} strokeWidth={2} aria-hidden />
          Dashboard
        </Link>
        <button type="button" className="btn btn-ghost btn-block mobile-drawer__logout" onClick={signOut}>
          <LogOut size={18} strokeWidth={2} aria-hidden />
          Log out
        </button>
      </>
    );
  }

  return (
    <>
      <Link href="/sign-in" className="btn btn-ghost btn-block" onClick={onNavigate}>
        Sign In
      </Link>
      <Link
        href="/create-account"
        className="btn btn-primary btn-topbar-cta btn-block"
        onClick={onNavigate}
      >
        Get Started
      </Link>
    </>
  );
}
