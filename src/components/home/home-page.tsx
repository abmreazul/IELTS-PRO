"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  ShieldCheck,
  Rocket,
  Search,
  Sparkles,
} from "lucide-react";
import { LogoMark } from "@/components/layout/logo-mark";
import { MotionConfig, motion, useScroll, useSpring } from "framer-motion";
import { useEffect, useState } from "react";
import { fadeUp, heroImage, staggerContainer, staggerItem } from "./motion-variants";

const heroSlides = [
  "/herosection/1.jpg",
  "/herosection/2.jpg",
  "/herosection/3.jpg",
  "/herosection/4.jpg",
  "/herosection/5.jpg",
  "/herosection/6.jpg",
] as const;

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
  {
    title: "Choose Your Test",
    text: "Pick a full mock or a single section.",
    icon: Search,
  },
  {
    title: "Practice Under Time",
    text: "Practice with real IELTS-style timing.",
    icon: BookOpen,
  },
  {
    title: "Review Your Results",
    text: "See feedback and clear band insights.",
    icon: ClipboardCheck,
  },
  {
    title: "Reach Your Band",
    text: "Keep improving until you hit your goal.",
    icon: Rocket,
  },
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

const values = [
  {
    title: "Accessibility",
    text: "Clear IELTS prep for every learner, wherever they start.",
    icon: GraduationCap,
  },
  {
    title: "Quality",
    text: "Exam-style practice built with structure, accuracy, and care.",
    icon: ShieldCheck,
  },
  {
    title: "Flexibility",
    text: "Study full tests or single sections on your own schedule.",
    icon: Sparkles,
  },
  {
    title: "Growth",
    text: "Focused feedback that helps you move toward your target band.",
    icon: HeartHandshake,
  },
] as const;

const footerFaces = [
  {
    src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&q=80",
    alt: "Student portrait",
    className: "footer-cta__face footer-cta__face--1",
  },
  {
    src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&q=80",
    alt: "Student portrait",
    className: "footer-cta__face footer-cta__face--2",
  },
  {
    src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=240&q=80",
    alt: "Student portrait",
    className: "footer-cta__face footer-cta__face--3",
  },
  {
    src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=240&q=80",
    alt: "Student portrait",
    className: "footer-cta__face footer-cta__face--4",
  },
] as const;


export function HomePage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % heroSlides.length);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden />

      <main className="page">
        <section className="hero">
          <motion.div className="hero-media" initial="hidden" animate="visible" variants={heroImage}>
            {heroSlides.map((slide, index) => (
              <Image
                key={slide}
                src={slide}
                alt=""
                width={1600}
                height={900}
                className={`hero-image${activeHeroSlide === index ? " hero-image--active" : ""}`}
                priority={index === 0}
                unoptimized
                sizes="100vw"
              />
            ))}
          </motion.div>

          <div className="container hero-grid">
            <motion.div
              className="hero-copy-wrap"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.h1 className="hero-title" variants={staggerItem}>
                Planning to Ace <span className="text-primary">IELTS</span>
              </motion.h1>
              <motion.h2 className="hero-subtitle" variants={staggerItem}>
                Full mock tests built to raise your IELTS score.
              </motion.h2>
              <motion.div className="hero-ctas" variants={staggerItem}>
                <motion.div
                  style={{ display: "inline-flex" }}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link href="/mock-exam" className="btn btn-hero-light">
                    Start Exam
                    <ArrowRight size={18} strokeWidth={2.25} />
                  </Link>
                </motion.div>
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
            <div className="steps__curve" aria-hidden>
              <svg viewBox="0 0 1200 180" preserveAspectRatio="none">
                <path d="M90 70 C190 130, 310 130, 410 70 S630 10, 730 70 S950 130, 1050 70" />
              </svg>
            </div>
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                className="step"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={fadeUp}
                custom={i}
              >
                <motion.div
                  className="step__icon-wrap"
                  whileHover={{ scale: 1.06 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                >
                  <s.icon className="step__icon" strokeWidth={2.2} />
                </motion.div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="about" className="section about-showcase">
          <div className="container about-intro">
            <div className="about-intro__media about-intro__media--left">
              <Image
                src="https://images.unsplash.com/photo-1544717305-2782549b5136?w=640&q=80"
                alt="Student holding books"
                fill
                sizes="220px"
                style={{ objectFit: "cover" }}
              />
            </div>
            <div className="about-intro__content">
              <span className="about-chip">About Us</span>
              <motion.h2
                className="about-intro__title"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                variants={fadeUp}
                custom={0}
              >
                Gateway To Better
                <br />
                <span>IELTS Growth</span>
              </motion.h2>
              <motion.p
                className="about-intro__text"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                variants={fadeUp}
                custom={1}
              >
                We built The IELTS Exam to make serious preparation feel clearer, more realistic,
                and more achievable. From full mock tests to focused review, the platform helps
                learners prepare with confidence for the score they need.
              </motion.p>
            </div>
            <div className="about-intro__accent about-intro__accent--star" aria-hidden />
            <div className="about-intro__accent about-intro__accent--spark" aria-hidden />
            <div className="about-intro__media about-intro__media--right">
              <Image
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=640&q=80"
                alt="Smiling student"
                fill
                sizes="220px"
                style={{ objectFit: "cover" }}
              />
            </div>
          </div>

          <div className="container about-values">
            <div className="about-values__image">
              <Image
                src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=900&q=80"
                alt="Students studying together"
                fill
                sizes="(max-width: 1024px) 100vw, 44vw"
                style={{ objectFit: "cover" }}
              />
            </div>
            <div className="about-values__content">
              <span className="about-chip">Our Values</span>
              <motion.h2
                className="about-values__title"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                variants={fadeUp}
                custom={0}
              >
                What We <span>Stand For</span>
              </motion.h2>
              <div className="about-values__grid">
                {values.map((value, i) => (
                  <motion.article
                    key={value.title}
                    className="about-value"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-60px" }}
                    variants={fadeUp}
                    custom={i}
                  >
                    <div className="about-value__icon">
                      <value.icon strokeWidth={2.2} />
                    </div>
                    <h3>{value.title}</h3>
                    <p>{value.text}</p>
                  </motion.article>
                ))}
              </div>
            </div>
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
          <div className="container footer-cta">
            <div className="footer-cta__rings footer-cta__rings--left" aria-hidden />
            <div className="footer-cta__rings footer-cta__rings--right" aria-hidden />
            {footerFaces.map((face) => (
              <div key={face.src} className={face.className}>
                <Image src={face.src} alt={face.alt} fill sizes="96px" style={{ objectFit: "cover" }} />
              </div>
            ))}
            <div className="footer-cta__content">
              <h2>
                Ready to Start <span>Practising?</span>
              </h2>
              <p>
                Take a full mock exam, review your result, and move one step closer to your target
                band.
              </p>
              <Link href="/mock-exam" className="btn footer-cta__button">
                Explore Mock Exams
              </Link>
            </div>
          </div>

          <div className="container footer-grid">
            <div className="footer-brand">
              <a href="#" className="brand-link brand-link--footer">
                <LogoMark />
                <span className="brand-text">The IELTS Exam</span>
              </a>
              <p>
                Realistic IELTS practice for listening, reading, writing, and speaking in one focused
                platform.
              </p>
            </div>
            <div>
              <p className="footer-heading">Menu</p>
              <ul className="footer-links">
                <li>
                  <a href="#features">Features</a>
                </li>
                <li>
                  <a href="#how">How It Works</a>
                </li>
                <li>
                  <a href="#pricing">Pricing</a>
                </li>
                <li>
                  <Link href="/sign-in">Sign In</Link>
                </li>
              </ul>
            </div>
            <div className="footer-mock">
              <p className="footer-heading">Mock Exams</p>
              <p className="footer-mock__text">
                Jump into full-length practice tests, track band progress, and review your weak areas.
              </p>
              <Link href="/mock-exam" className="footer-mock__link">
                Browse Mock Exams
                <ArrowRight size={16} strokeWidth={2.2} />
              </Link>
            </div>
          </div>
          <div className="container footer-bar">
            <p>© {new Date().getFullYear()} The IELTS Exam. All rights reserved.</p>
            <div className="footer-legal">
              <a href="#">Terms & Conditions</a>
              <a href="#">Privacy Policy</a>
            </div>
          </div>
        </footer>
      </main>
    </MotionConfig>
  );
}
