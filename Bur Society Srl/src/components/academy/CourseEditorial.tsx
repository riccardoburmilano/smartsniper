"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Course } from "@/lib/courses";
import { Reveal } from "@/components/ui/Reveal";

type CourseEditorialProps = {
  course: Course;
  reverse?: boolean;
};

export function CourseEditorial({ course, reverse = false }: CourseEditorialProps) {
  return (
    <article className="border-b border-line">
      <div
        className={`mx-auto grid max-w-[1400px] grid-cols-1 items-stretch md:grid-cols-12 ${
          reverse ? "md:[&>*:first-child]:order-2" : ""
        }`}
      >
        <Reveal className="relative min-h-[42vh] md:col-span-5 md:min-h-[70vh]">
          <div className="absolute inset-0 bw-plane" />
          <div className="absolute inset-0 flex flex-col justify-between p-6 md:p-10">
            <span className="font-display text-5xl tracking-tightest text-cream/90 md:text-7xl">
              {course.index}
            </span>
            <p className="max-w-[10rem] font-display text-2xl leading-tight tracking-display text-cream md:text-3xl">
              {course.subtitle}
            </p>
          </div>
        </Reveal>

        <div className="flex flex-col justify-between gap-12 px-5 py-12 md:col-span-7 md:px-12 md:py-16 lg:px-16">
          <Reveal delay={0.08}>
            <h2 className="font-display text-[clamp(2.6rem,6vw,5.5rem)] leading-[0.9] tracking-tightest text-ink">
              {course.title}
            </h2>
            <p className="mt-8 max-w-md text-[15px] leading-relaxed text-muted">
              {course.statement}
            </p>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
              <ul className="grid grid-cols-2 gap-x-8 gap-y-3">
                {course.focus.map((item) => (
                  <li
                    key={item}
                    className="border-t border-line pt-3 text-[11px] uppercase tracking-[0.18em] text-ink"
                  >
                    {item}
                  </li>
                ))}
              </ul>

              <div className="sm:text-right">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
                  Durata
                </p>
                <p className="mt-2 font-display text-2xl tracking-display text-ink">
                  {course.duration}
                </p>
              </div>
            </div>

            <motion.div className="mt-10" whileHover={{ x: 4 }}>
              <Link
                href="/admission"
                className="group inline-flex items-center gap-3 text-[12px] uppercase tracking-[0.22em] text-ink"
              >
                <span className="relative">
                  Candidati
                  <span className="absolute -bottom-1 left-0 h-px w-full origin-left bg-ink transition-transform duration-500 group-hover:scale-x-0" />
                </span>
                <span aria-hidden>→</span>
              </Link>
            </motion.div>
          </Reveal>
        </div>
      </div>
    </article>
  );
}
