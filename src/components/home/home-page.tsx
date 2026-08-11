"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  ShieldCheck,
  Rocket,
  Search,
  Sparkles,
} from "lucide-react";
import { LogoMark } from "@/components/layout/logo-mark";
import { ExamCard } from "@/components/mock-exam/mock-exam-catalog";
import type { MockExamRow } from "@/components/mock-exam/types";
import {
  MotionConfig,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
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
    category: "Full Mock Tests",
    title: "Practice With Full-Length IELTS Mocks",
    text: "Take realistic IELTS mocks under timed conditions.",
    image: "/EverythingYouNeed/Full%20Mock%20Tests.png",
  },
  {
    category: "Listening",
    title: "Build Listening Confidence",
    text: "Train with realistic audio and IELTS-style tasks.",
    image: "/EverythingYouNeed/listening.png",
  },
  {
    category: "Reading",
    title: "Sharpen Reading Accuracy",
    text: "Improve passage skills and reading speed.",
    image: "/EverythingYouNeed/reading%20.png",
  },
  {
    category: "Writing",
    title: "Strengthen Writing Responses",
    text: "Practice clearer Task 1 and Task 2 responses.",
    image: "/EverythingYouNeed/writting.png",
  },
  {
    category: "Speaking",
    title: "Speak With More Confidence",
    text: "Practice spoken answers with IELTS-style prompts.",
    image: "/EverythingYouNeed/speaking.png",
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
      "The writing review workflow made it clear where my band was slipping and what to fix next.",
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
  {
    src: "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=240&q=80",
    alt: "Student portrait",
    className: "footer-cta__face footer-cta__face--5",
  },
  {
    src: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=240&q=80",
    alt: "Student portrait",
    className: "footer-cta__face footer-cta__face--6",
  },
  {
    src: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=240&q=80",
    alt: "Student portrait",
    className: "footer-cta__face footer-cta__face--7",
  },
] as const;


type HomePageProps = {
  featuredExams?: MockExamRow[];
};

export function HomePage({ featuredExams = [] }: HomePageProps) {
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const aboutRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const { scrollYProgress: featureScrollProgress } = useScroll({
    target: featuresRef,
    offset: ["start end", "end start"],
  });
  const { scrollYProgress: aboutScrollProgress } = useScroll({
    target: aboutRef,
    offset: ["start end", "end start"],
  });
  const heroMediaY = useTransform(heroScrollProgress, [0, 1], [0, 150]);
  const heroMediaScale = useTransform(heroScrollProgress, [0, 1], [1, 1.1]);
  const heroCopyY = useTransform(heroScrollProgress, [0, 1], [0, -72]);
  const heroCopyOpacity = useTransform(heroScrollProgress, [0, 0.72, 1], [1, 0.82, 0]);
  const featureMarqueeX = useTransform(featureScrollProgress, [0, 1], ["8%", "-38%"]);
  const featureLeadY = useTransform(featureScrollProgress, [0, 1], [-28, 34]);
  const aboutLeftY = useTransform(aboutScrollProgress, [0, 1], [-54, 64]);
  const aboutRightY = useTransform(aboutScrollProgress, [0, 1], [72, -48]);
  const aboutImageScale = useTransform(aboutScrollProgress, [0, 0.5, 1], [1.06, 1, 1.04]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % heroSlides.length);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden />

      <main className="page home-motion-page">
        <section ref={heroRef} className="hero">
          <motion.div
            className="hero-media"
            initial="hidden"
            animate="visible"
            variants={heroImage}
            style={prefersReducedMotion ? undefined : { y: heroMediaY, scale: heroMediaScale }}
          >
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
              style={prefersReducedMotion ? undefined : { y: heroCopyY, opacity: heroCopyOpacity }}
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
          <motion.div
            className="hero-scroll-cue"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            style={prefersReducedMotion ? undefined : { opacity: heroCopyOpacity }}
            aria-hidden
          >
            <span>Scroll to explore</span>
            <ChevronDown size={17} strokeWidth={2.2} />
          </motion.div>
        </section>

        {featuredExams.length > 0 ? (
          <section className="section home-mock-row">
            <div className="container section-head home-mock-row__head">
              <motion.h2
                className="section-title"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                variants={fadeUp}
                custom={0}
              >
                Start with a Mock Test
              </motion.h2>
            </div>
            <div className="container">
              <div className="me-grid home-mock-row__grid">
                {featuredExams.map((exam, index) => (
                  <motion.div
                    key={exam.id}
                    className="home-mock-row__item"
                    initial={{ opacity: 0, y: 38, scale: 0.97 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ delay: index * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <ExamCard
                      exam={exam}
                      latestAttempt={null}
                      entitled
                      isLoggedIn
                      actionHrefOverride="/mock-exam"
                      actionLabelOverride="Open in Mock Exams"
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section ref={featuresRef} id="features" className="section section--alt feature-story">
          <motion.div
            className="feature-story__marquee"
            style={prefersReducedMotion ? undefined : { x: featureMarqueeX }}
            aria-hidden
          >
            LISTEN · READ · WRITE · SPEAK · PRACTISE · IMPROVE
          </motion.div>
          <div className="container feature-intro">
            <div className="feature-intro__title-group">
              <motion.h2
                className="feature-title"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                variants={fadeUp}
                custom={0}
              >
                <span className="text-primary">Everything</span> You Need
                <br />
                To Ace <span className="text-primary">IELTS</span>
              </motion.h2>
            </div>
            <motion.div
              className="feature-intro__copy"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              custom={1}
            >
              <p className="feature-intro__text">
                Explore the tools that make IELTS practice clearer and more focused.
              </p>
              <Link href="/mock-exam" className="feature-intro__link">
                Explore Mock Exams
              </Link>
            </motion.div>
          </div>
          <div className="container feature-showcase">
            <motion.article
              className="feature-lead"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              variants={fadeUp}
              custom={0}
              style={prefersReducedMotion ? undefined : { y: featureLeadY }}
              whileHover={{ y: -4, transition: { duration: 0.25 } }}
            >
              <div className="feature-lead__image">
                <Image
                  src={features[0].image}
                  alt={features[0].title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className="feature-lead__content">
                <span className="feature-meta">{features[0].category}</span>
                <h3>{features[0].title}</h3>
                <p>{features[0].text}</p>
              </div>
            </motion.article>

            <div className="feature-rail">
              {features.slice(1).map((feature, index) => (
                <motion.article
                  key={feature.title}
                  className="feature-mini"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-40px" }}
                  variants={fadeUp}
                  custom={index + 1}
                  whileHover={{ y: -4, transition: { duration: 0.25 } }}
                >
                  <div className="feature-mini__image">
                    <Image
                      src={feature.image}
                      alt={feature.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 22vw"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <div className="feature-mini__content">
                    <span className="feature-meta">{feature.category}</span>
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                  </div>
                </motion.article>
              ))}
            </div>
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
                <path
                  className="steps__curve-ghost"
                  d="M90 70 C190 130, 310 130, 410 70 S630 10, 730 70 S950 130, 1050 70"
                />
                <motion.path
                  className="steps__curve-progress"
                  d="M90 70 C190 130, 310 130, 410 70 S630 10, 730 70 S950 130, 1050 70"
                  initial={prefersReducedMotion ? false : { pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 1.65,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
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

        <section ref={aboutRef} id="about" className="section about-showcase">
          <div className="container about-intro">
            <motion.div
              className="about-intro__media about-intro__media--left"
              style={prefersReducedMotion ? { rotate: -9 } : { y: aboutLeftY, rotate: -9 }}
            >
              <Image
                src="/About%20Us/aboutus1.jpg"
                alt="Student holding books"
                fill
                sizes="220px"
                style={{ objectFit: "cover" }}
              />
            </motion.div>
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
            <motion.div
              className="about-intro__media about-intro__media--right"
              style={prefersReducedMotion ? { rotate: 9 } : { y: aboutRightY, rotate: 9 }}
            >
              <Image
                src="/About%20Us/aboutus2.jpg"
                alt="Smiling student"
                fill
                sizes="220px"
                style={{ objectFit: "cover" }}
              />
            </motion.div>
          </div>

          <div className="container about-values">
            <motion.div
              className="about-values__image"
              style={prefersReducedMotion ? undefined : { scale: aboutImageScale }}
            >
              <Image
                src="/Our%20Values/our%20values.jpg"
                alt="Students studying together"
                fill
                sizes="(max-width: 1024px) 100vw, 44vw"
                style={{ objectFit: "cover" }}
              />
            </motion.div>
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
          <motion.div
            className="container footer-cta"
            initial={{ opacity: 0, y: 46, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-70px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="footer-cta__rings footer-cta__rings--left" aria-hidden />
            <div className="footer-cta__rings footer-cta__rings--right" aria-hidden />
            {footerFaces.map((face, index) => (
              <motion.div
                key={face.src}
                className={face.className}
                initial={{ opacity: 0, scale: 0.55 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: 0.15 + index * 0.055, type: "spring", stiffness: 220, damping: 18 }}
              >
                <Image src={face.src} alt={face.alt} fill sizes="96px" style={{ objectFit: "cover" }} />
              </motion.div>
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
          </motion.div>

          <div className="container footer-grid">
            <div className="footer-brand">
              <a href="#" className="brand-link brand-link--footer">
                <LogoMark size="footer" />
              </a>
              <p>
                Realistic IELTS practice for listening, reading, and writing in one focused
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
              <Link href="/terms">Terms &amp; Conditions</Link>
              <Link href="/privacy">Privacy Policy</Link>
            </div>
          </div>
        </footer>
      </main>
    </MotionConfig>
  );
}
