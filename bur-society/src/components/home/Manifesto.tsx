"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { site } from "@/lib/site";

export function Manifesto() {
  const reduce = useReducedMotion();

  return (
    <section className="relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="bw-plane absolute inset-y-0 right-0 w-full md:w-[46%]"
      />

      <div className="relative mx-auto grid min-h-dvh max-w-[1400px] grid-cols-1 md:grid-cols-12">
        <div className="flex flex-col justify-between px-5 py-8 md:col-span-7 md:px-10 md:py-10">
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-[11px] uppercase tracking-[0.28em] text-muted"
          >
            Milano · Accademia & Community
          </motion.p>

          <div className="my-16 md:my-0">
            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-[clamp(3.4rem,12vw,8.5rem)] leading-[0.86] tracking-tightest text-ink"
            >
              Bur
              <br />
              Society
            </motion.h1>

            <motion.p
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 max-w-md font-display text-2xl leading-tight tracking-display text-ink md:text-3xl"
            >
              {site.tagline}
            </motion.p>

            <motion.p
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 max-w-sm text-sm leading-relaxed text-muted md:text-[15px]"
            >
              Non una scuola. Un culto creativo: voce, ritmo, presenza —
              selezionati, non iscritti.
            </motion.p>
          </div>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex items-center gap-8"
          >
            <Link
              href="/academy"
              className="group inline-flex items-center gap-3 text-[12px] uppercase tracking-[0.24em] text-ink"
            >
              <span className="relative">
                Enter
                <span className="absolute -bottom-1 left-0 h-px w-full origin-left bg-ink transition-transform duration-500 group-hover:scale-x-0" />
              </span>
              <span
                aria-hidden
                className="translate-x-0 transition-transform duration-500 group-hover:translate-x-1"
              >
                →
              </span>
            </Link>

            <Link
              href="/admission"
              className="text-[12px] uppercase tracking-[0.24em] text-muted transition-colors duration-300 hover:text-ink"
            >
              Apply
            </Link>
          </motion.div>
        </div>

        <div className="relative hidden md:col-span-5 md:block">
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <div className="absolute inset-0 bw-plane" />
            <div className="absolute inset-0 flex items-end justify-start p-10">
              <p className="max-w-[12rem] font-display text-4xl leading-[0.95] tracking-tightest text-cream">
                Cult
                <br />
                first.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
