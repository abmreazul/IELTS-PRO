"use client";

import Image from "next/image";
import Link from "next/link";
import { LogoMark } from "@/components/layout/logo-mark";
import { MotionConfig, motion, useScroll, useSpring } from "framer-motion";
import { useEffect, useState } from "react";
import { fadeUp, floatCard, heroImage, staggerContainer, staggerItem } from "./motion-variants";

const features = [
  {
    title: "Real-Time Practice",
    text: "Timed sections mirror official pacing so you build stamina and accuracy under pressure.",
    icon: "clock",
  },
  {
    title: "AI Speaking Evaluation",
    text: "Structured prompts with automated feedback on fluency, coherence, and lexical range.",
    icon: "mic",
  },
  {
    title: "Band Score Analytics",
    text: "See skill-level breakdowns after every mock and track improvement over time.",
    icon: "chart",
  },
  {
    title: "Full-Length Mock Tests",
    text: "Complete Academic and General Training simulations in one uninterrupted session.",
    icon: "doc",
  },
  {
    title: "Expert-Crafted Content",
    text: "Questions aligned to IELTS task types, difficulty bands, and recent exam trends.",
    icon: "pen",
  },
  {
    title: "Personal Study Paths",
    text: "Prioritised next steps based on your weakest areas and target band.",
    icon: "path",
  },
] as const;

const steps = [
  { n: 1, title: "Sign Up", text: "Create your profile and set your exam date and target band." },
  { n: 2, title: "Take Mock Tests", text: "Sit full exams or focus on one module at a time." },
  { n: 3, title: "Review & Improve", text: "Read explanations, model answers, and tailored tips." },
  { n: 4, title: "Achieve Your Goal", text: "Retest until you are consistently hitting your band." },
] as const;

const plans = [
  {
    name: "Starter",
    monthly: 29,
    yearly: 249,
    features: ["4 full mock tests", "Basic score reports", "Email support"],
    popular: false,
  },
  {
    name: "Professional",
    monthly: 59,
    yearly: 499,
    features: [
      "Unlimited mock tests",
      "Detailed analytics",
      "Speaking AI feedback",
      "Priority support",
    ],
    popular: true,
  },
  {
    name: "Premium",
    monthly: 99,
    yearly: 799,
    features: [
      "Everything in Professional",
      "1:1 tutor review credits",
      "Custom study plan",
      "Exam-day checklist",
    ],
    popular: false,
  },
] as const;

const testimonials = [
  {
    quote:
      "The full test simulation removed my anxiety. I walked into the real exam knowing exactly what to expect.",
    name: "Priya Sharma",
    place: "Mumbai",
    band: "8.5",
  },
  {
    quote:
      "Analytics showed I was losing marks on Task 1. Two weeks of focused practice and I cleared my target.",
    name: "James Okonkwo",
    place: "London",
    band: "7.5",
  },
  {
    quote:
      "Speaking feedback was surprisingly detailed. It felt like having a coach available 24/7.",
    name: "Elena Vasquez",
    place: "Barcelona",
    band: "8.0",
  },
] as const;

function FeatureIcon({ name }: { name: (typeof features)[number]["icon"] }) {
  const common = { width: 22, height: 22, fill: "none", stroke: "currentColor", strokeWidth: 1.7 };
  switch (name) {
    case "clock":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6l4 2" strokeLinecap="round" />
        </svg>
      );
    case "mic":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3z" />
          <path d="M8 11v1a4 4 0 008 0v-1M12 18v3M9 21h6" strokeLinecap="round" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M4 19V5M8 19v-6M12 19V9M16 19v-4M20 19v-9" strokeLinecap="round" />
        </svg>
      );
    case "doc":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M7 4h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z" />
          <path d="M14 4v5h5M9 12h6M9 16h6" strokeLinecap="round" />
        </svg>
      );
    case "pen":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M12 20h7M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z" strokeLinejoin="round" />
        </svg>
      );
    case "path":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M4 19c3-6 5-9 8-9s4 3 8 9" strokeLinecap="round" />
          <circle cx="12" cy="7" r="2.5" />
        </svg>
      );
    default:
      return null;
  }
}

export function HomePage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  return (
    <MotionConfig reducedMotion="user">
      <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden />

      <main className="page">
        <section className="hero">
          <div className="container hero-grid">
            <motion.div
              className="hero-copy-wrap"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.h1 className="hero-title" variants={staggerItem}>
                Master Your IELTS Exam with <span className="text-primary">Confidence</span>
              </motion.h1>
              <motion.p className="hero-lead" variants={staggerItem}>
                Full-length mock tests, band-accurate scoring, and personalised learning paths—so
                you walk into test day prepared, not guessing.
              </motion.p>
              <motion.div className="hero-ctas" variants={staggerItem}>
                <motion.div
                  style={{ display: "inline-flex" }}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link href="/create-account" className="btn btn-hero-dark">
                    Start Free Trial
                  </Link>
                </motion.div>
                <motion.button
                  type="button"
                  className="btn btn-outline"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  View Sample Test
                </motion.button>
              </motion.div>
              <motion.div className="hero-stats" variants={staggerItem}>
                <div>
                  <strong>50K+</strong>
                  <span>Active Students</span>
                </div>
                <div>
                  <strong>100+</strong>
                  <span>Mock Tests</span>
                </div>
                <div>
                  <strong>95%</strong>
                  <span>Success Rate</span>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              className="hero-visual"
              initial="hidden"
              animate="visible"
              variants={heroImage}
            >
              <div className="hero-image-frame">
                <Image
                  src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&q=85"
                  alt="Students collaborating in a classroom"
                  width={640}
                  height={480}
                  className="hero-image"
                  priority
                  sizes="(max-width: 960px) 100vw, 45vw"
                />
              </div>
              <motion.div
                className="hero-float-card"
                variants={floatCard}
                initial="hidden"
                animate="visible"
                whileHover={{ y: -4, boxShadow: "0 20px 50px rgba(0,0,0,0.12)" }}
              >
                <span className="hero-float-card__check" aria-hidden>
                  ✓
                </span>
                <div>
                  <p className="hero-float-card__name">Sarah M.</p>
                  <p className="hero-float-card__band">Band 8.5 Achieved!</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section id="features" className="section section--alt">
          <div className="container section-head">
            <motion.h2
              className="section-title"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              custom={0}
            >
              Everything You Need to Ace IELTS
            </motion.h2>
            <motion.p
              className="section-sub"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              custom={1}
            >
              One platform for realistic practice, clear feedback, and steady progress toward your
              target band.
            </motion.p>
          </div>
          <div className="container feature-grid">
            {features.map((f, i) => (
              <motion.article
                key={f.title}
                className="feature-card"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
              >
                <div className="feature-card__icon">
                  <FeatureIcon name={f.icon} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="how" className="section">
          <div className="container section-head">
            <motion.h2
              className="section-title"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              custom={0}
            >
              How It Works
            </motion.h2>
            <motion.p
              className="section-sub"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              custom={1}
            >
              From signup to your goal band in four clear steps.
            </motion.p>
          </div>
          <div className="container steps">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                className="step"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={fadeUp}
                custom={i}
              >
                {i < steps.length - 1 ? <span className="step__connector" aria-hidden /> : null}
                <motion.div
                  className="step__circle"
                  whileHover={{ scale: 1.06 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                >
                  {s.n}
                </motion.div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="pricing" className="section section--alt">
          <div className="container section-head">
            <motion.h2
              className="section-title"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              custom={0}
            >
              Choose Your Perfect Plan
            </motion.h2>
            <motion.p
              className="section-sub"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              custom={1}
            >
              Flexible billing. Upgrade or cancel anytime.
            </motion.p>
            <motion.div
              className="billing-toggle"
              role="group"
              aria-label="Billing period"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <button
                type="button"
                className={billing === "monthly" ? "is-active" : ""}
                onClick={() => setBilling("monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={billing === "yearly" ? "is-active" : ""}
                onClick={() => setBilling("yearly")}
              >
                Yearly
                <span className="billing-save">Save 20%</span>
              </button>
            </motion.div>
          </div>
          <div className="container pricing-grid">
            {plans.map((plan, i) => (
              <motion.article
                key={plan.name}
                className={`pricing-card${plan.popular ? " pricing-card--popular" : ""}`}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -8, transition: { duration: 0.25 } }}
              >
                {plan.popular ? <span className="pricing-badge">Most Popular</span> : null}
                <h3>{plan.name}</h3>
                <p className="pricing-price">
                  <span className="pricing-amount">
                    ${billing === "monthly" ? plan.monthly : Math.round(plan.yearly / 12)}
                  </span>
                  <span className="pricing-period">/month</span>
                </p>
                {billing === "yearly" ? (
                  <p className="pricing-billed">${plan.yearly} billed yearly</p>
                ) : null}
                <ul className="pricing-features">
                  {plan.features.map((line) => (
                    <li key={line}>
                      <span className="pricing-check" aria-hidden>
                        ✓
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
                <motion.div
                  style={{ width: "100%" }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    href="/create-account"
                    className={plan.popular ? "btn btn-primary btn-block" : "btn btn-outline btn-block"}
                  >
                    Get Started
                  </Link>
                </motion.div>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="testimonials" className="section">
          <div className="container section-head">
            <motion.h2
              className="section-title"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              custom={0}
            >
              Success Stories from Our Students
            </motion.h2>
            <motion.p
              className="section-sub"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              custom={1}
            >
              Real outcomes from learners who trained with full mock exams.
            </motion.p>
          </div>
          <div className="container testimonial-grid">
            {testimonials.map((t, i) => (
              <motion.blockquote
                key={t.name}
                className="testimonial-card"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -4 }}
              >
                <div className="stars" aria-label="5 out of 5 stars">
                  {"★★★★★"}
                </div>
                <p className="testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
                <footer className="testimonial-footer">
                  <div className="testimonial-avatar" aria-hidden>
                    {t.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")}
                  </div>
                  <div>
                    <cite className="testimonial-name">{t.name}</cite>
                    <p className="testimonial-place">{t.place}</p>
                  </div>
                  <span className="testimonial-band">{t.band} Band Score</span>
                </footer>
              </motion.blockquote>
            ))}
          </div>
        </section>

        <footer className="site-footer">
          <div className="container footer-grid">
            <div className="footer-brand">
              <a href="#" className="brand-link brand-link--footer">
                <LogoMark />
                <span className="brand-text">IELTS Pro</span>
              </a>
              <p>
                Full-length IELTS mock exams, analytics, and study paths trusted by students in over
                80 countries.
              </p>
              <div className="social-row" aria-label="Social links">
                {["Facebook", "Twitter", "Instagram", "LinkedIn"].map((label) => (
                  <motion.a
                    key={label}
                    href="#"
                    className="social-link"
                    aria-label={label}
                    whileHover={{ y: -2, scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {label[0]}
                  </motion.a>
                ))}
              </div>
            </div>
            <div>
              <p className="footer-heading">Quick Links</p>
              <ul className="footer-links">
                <li>
                  <a href="#features">Features</a>
                </li>
                <li>
                  <a href="#pricing">Pricing</a>
                </li>
                <li>
                  <a href="#testimonials">Testimonials</a>
                </li>
                <li>
                  <Link href="/sign-in">Sign In</Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="footer-heading">Resources</p>
              <ul className="footer-links">
                <li>
                  <a href="#">Blog</a>
                </li>
                <li>
                  <a href="#">Band Descriptors</a>
                </li>
                <li>
                  <a href="#">Help Center</a>
                </li>
                <li>
                  <a href="#">API</a>
                </li>
              </ul>
            </div>
            <div>
              <p className="footer-heading">Contact Us</p>
              <ul className="footer-contact">
                <li>hello@ieltspro.com</li>
                <li>+1 (555) 010-2040</li>
                <li>Dublin, Ireland</li>
              </ul>
            </div>
          </div>
          <div className="container footer-bar">
            <p>© {new Date().getFullYear()} IELTS Pro. All rights reserved.</p>
            <div className="footer-legal">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
          </div>
        </footer>
      </main>
    </MotionConfig>
  );
}
