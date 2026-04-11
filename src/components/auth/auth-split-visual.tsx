"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { CAROUSEL_INTERVAL_MS, CAROUSEL_SLIDES } from "./auth-carousel-constants";

export function AuthSplitVisual() {
  const [slideIndex, setSlideIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const carouselSlide = CAROUSEL_SLIDES[slideIndex];

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setTimeout(() => {
      setSlideIndex((i) => (i + 1) % CAROUSEL_SLIDES.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [slideIndex, reduceMotion]);

  return (
    <div className="ca-visual">
      <AnimatePresence mode="wait">
        <motion.div
          key={carouselSlide.src}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          style={{ position: "absolute", inset: 0 }}
        >
          <Image
            src={carouselSlide.src}
            alt=""
            fill
            className="ca-visual__img"
            sizes="(max-width: 960px) 100vw, 50vw"
            priority={slideIndex === 0}
          />
        </motion.div>
      </AnimatePresence>
      <div className="ca-visual__overlay" aria-hidden />
      <AnimatePresence mode="wait">
        <motion.div
          key={carouselSlide.title}
          className="ca-visual__copy"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="ca-visual__title">{carouselSlide.title}</h2>
          <p className="ca-visual__sub">{carouselSlide.sub}</p>
        </motion.div>
      </AnimatePresence>
      <div
        className="ca-visual__bars"
        role="group"
        aria-label="Hero image rotation progress"
      >
        {CAROUSEL_SLIDES.map((slide, i) => (
          <div key={slide.src} className="ca-visual__bar-track">
            <div className="ca-visual__bar-base" />
            {i < slideIndex ? (
              <div
                className="ca-visual__bar-fill ca-visual__bar-fill--complete"
                aria-hidden
              />
            ) : null}
            {i === slideIndex ? (
              reduceMotion ? (
                <div
                  className="ca-visual__bar-fill ca-visual__bar-fill--complete"
                  aria-hidden
                />
              ) : (
                <motion.div
                  key={slideIndex}
                  className="ca-visual__bar-fill"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{
                    duration: CAROUSEL_INTERVAL_MS / 1000,
                    ease: "linear",
                  }}
                  style={{ transformOrigin: "left center" }}
                  aria-hidden
                />
              )
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
