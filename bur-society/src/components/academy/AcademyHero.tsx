"use client";

import { Reveal } from "@/components/ui/Reveal";

export function AcademyHero() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-5 py-14 md:grid-cols-12 md:gap-6 md:px-10 md:py-24">
        <Reveal className="md:col-span-7">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted">
            Academy
          </p>
          <h1 className="mt-5 font-display text-[clamp(3rem,9vw,7rem)] leading-[0.88] tracking-tightest text-ink">
            Formare
            <br />
            la firma.
          </h1>
        </Reveal>

        <Reveal delay={0.12} className="flex items-end md:col-span-5">
          <p className="max-w-sm text-sm leading-relaxed text-muted md:ml-auto md:text-right md:text-[15px]">
            Due percorsi. Nessuna brochure. Solo pratica, standard alti e
            selezione — per chi vuole una voce riconoscibile.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
