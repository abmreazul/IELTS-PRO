"use client";

import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { LogoMark } from "@/components/layout/logo-mark";
import { MotionConfig, motion, useScroll, useSpring } from "framer-motion";
import { useEffect, useState } from "react";
import { fadeUp, heroImage, staggerContainer, staggerItem } from "./motion-variants";

const features = [
  {
    title: "Real-Time Practice",
    text: "Timed sections mirror official pacing so you build stamina and accuracy under pressure.",
    image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&q=80",
  },
  {
    title: "AI Speaking Evaluation",
    text: "Structured prompts with automated feedback on fluency, coherence, and lexical range.",
    image: "https://images.unsplash.com/photo-1589903308904-1010c2294adc?w=600&q=80",
  },
  {
    title: "Band Score Analytics",
    text: "See skill-level breakdowns after every mock and track improvement over time.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80",
  },
  {
    title: "Full-Length Mock Tests",
    text: "Complete Academic and General Training simulations in one uninterrupted session.",
    image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&q=80",
  },
  {
    title: "Expert-Crafted Content",
    text: "Questions aligned to IELTS task types, difficulty bands, and recent exam trends.",
    image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&q=80",
  },
  {
    title: "Personal Study Paths",
    text: "Prioritised next steps based on your weakest areas and target band.",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&q=80",
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
              <motion.p className="hero-kicker" variants={staggerItem}>
                IELTS practice platform for Academic and General Training
              </motion.p>
              <motion.h1 className="hero-title" variants={staggerItem}>
                Study Smarter. <span className="text-primary">Score Higher</span> in IELTS.
              </motion.h1>
              <motion.h2 className="hero-subtitle" variants={staggerItem}>
                Full Mock Tests, Clear Feedback, Real Exam Confidence
              </motion.h2>
              <motion.p className="hero-lead" variants={staggerItem}>
                Practice with realistic listening, reading, writing, and speaking exams built to
                feel like the real IELTS. Track your band progress, spot weak areas, and prepare
                with purpose.
              </motion.p>
              <motion.div className="hero-ctas" variants={staggerItem}>
                <motion.div
                  style={{ display: "inline-flex" }}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link href="/create-account" className="btn btn-hero-dark">
                    Start Free Practice
                  </Link>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link href="/mock-exam" className="btn btn-outline">
                    Explore Mock Exams
                  </Link>
                </motion.div>
              </motion.div>
              <motion.div className="hero-points" variants={staggerItem}>
                <div className="hero-point">
                  <span className="hero-point__dot" aria-hidden />
                  <span>Full-length IELTS simulations with section timing</span>
                </div>
                <div className="hero-point">
                  <span className="hero-point__dot" aria-hidden />
                  <span>Writing and speaking submissions ready for review</span>
                </div>
                <div className="hero-point">
                  <span className="hero-point__dot" aria-hidden />
                  <span>Academic and General Training preparation in one place</span>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              className="hero-visual"
              initial="hidden"
              animate="visible"
              variants={heroImage}
            >
              <Image
                src="/hero-section-v4.png"
                alt="Student preparing for the IELTS exam"
                width={820}
                height={820}
                className="hero-image"
                priority
                unoptimized
                sizes="(max-width: 960px) 100vw, 45vw"
              />
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
                <div className="feature-card__img">
                  <Image
                    src={f.image}
                    alt={f.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    style={{ objectFit: "cover" }}
                  />
                  <div className="feature-card__overlay" />
                </div>
                <div className="feature-card__content">
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
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
                        <Check strokeWidth={2.5} />
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
                <span className="brand-text">The IELTS Exam</span>
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
            <p>© {new Date().getFullYear()} The IELTS Exam. All rights reserved.</p>
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
