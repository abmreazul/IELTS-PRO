"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { TopbarAuthDesktop, TopbarAuthMobile } from "@/components/home/topbar-auth";
import { LogoMark } from "./logo-mark";
import { ThemeToggle } from "./theme-toggle";

type SiteHeaderProps = {
  /** Highlights Admin when you are in /admin (marketing-style top bar). */
  adminNavActive?: boolean;
  showAdminLink?: boolean;
};

export function SiteHeader({ adminNavActive = false, showAdminLink = false }: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand-link">
            <LogoMark size="header" />
          </Link>

          <nav className="nav nav--desktop" aria-label="Primary">
            <Link href="/">Home</Link>
            <Link href="/courses">Courses</Link>
            <Link href="/mock-exam">Mock Exams</Link>
            <a href="/#features">Features</a>
            {showAdminLink ? (
              <Link href="/admin" className={adminNavActive ? "topbar-link--active" : undefined}>
                Admin
              </Link>
            ) : null}
          </nav>

          <div className="topbar-actions">
            <ThemeToggle />
            <TopbarAuthDesktop />
            <motion.button
              type="button"
              className="menu-btn nav--mobile"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen((o) => !o)}
              whileTap={{ scale: 0.95 }}
            >
              <span className="menu-btn__line" data-open={mobileOpen ? "true" : "false"} />
              <span className="menu-btn__line" data-open={mobileOpen ? "true" : "false"} />
              <span className="menu-btn__line" data-open={mobileOpen ? "true" : "false"} />
            </motion.button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            className="mobile-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.nav
            className="mobile-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            aria-label="Mobile"
          >
            <Link href="/" onClick={() => setMobileOpen(false)}>
              Home
            </Link>
            <Link href="/courses" onClick={() => setMobileOpen(false)}>
              Courses
            </Link>
            <Link href="/mock-exam" onClick={() => setMobileOpen(false)}>
              Mock Exams
            </Link>
            <a href="/#features" onClick={() => setMobileOpen(false)}>
              Features
            </a>
            {showAdminLink ? (
              <Link
                href="/admin"
                className={adminNavActive ? "topbar-link--active" : undefined}
                onClick={() => setMobileOpen(false)}
              >
                Admin
              </Link>
            ) : null}
            <hr className="mobile-drawer__rule" />
            <TopbarAuthMobile onNavigate={() => setMobileOpen(false)} />
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </>
  );
}
