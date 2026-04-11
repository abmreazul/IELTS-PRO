"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { TopbarAuthDesktop, TopbarAuthMobile } from "@/components/home/topbar-auth";
import { LogoMark } from "./logo-mark";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
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
            <LogoMark />
            <span className="brand-text">IELTS Pro</span>
          </Link>

          <nav className="nav nav--desktop" aria-label="Primary">
            <a href="/#features">Features</a>
            <a href="/#how">How it Works</a>
            <a href="/#pricing">Pricing</a>
            <a href="/#testimonials">Testimonials</a>
            <Link href="/mock-exam">Mock Exam</Link>
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
            <a href="/#features" onClick={() => setMobileOpen(false)}>
              Features
            </a>
            <a href="/#how" onClick={() => setMobileOpen(false)}>
              How it Works
            </a>
            <a href="/#pricing" onClick={() => setMobileOpen(false)}>
              Pricing
            </a>
            <a href="/#testimonials" onClick={() => setMobileOpen(false)}>
              Testimonials
            </a>
            <Link href="/mock-exam" onClick={() => setMobileOpen(false)}>
              Mock Exam
            </Link>
            <hr className="mobile-drawer__rule" />
            <TopbarAuthMobile onNavigate={() => setMobileOpen(false)} />
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </>
  );
}
