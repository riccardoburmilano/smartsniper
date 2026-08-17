"use client";

import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";

export function AcademyCta() {
  return (
    <section className="mx-auto max-w-[1400px] px-5 py-20 md:px-10 md:py-28">
      <Reveal>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:items-end">
          <h2 className="font-display text-[clamp(2.4rem,5.5vw,4.5rem)] leading-[0.92] tracking-tightest text-ink md:col-span-7">
            Non ti iscrivi.
            <br />
            Ti candidi.
          </h2>
          <div className="md:col-span-5 md:text-right">
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted md:ml-auto">
              Admission è selezione, non modulo. Raccontaci perché Bur Society
              dovrebbe aprirti la porta.
            </p>
            <Link
              href="/admission"
              className="mt-8 inline-flex text-[12px] uppercase tracking-[0.24em] text-ink underline decoration-ink/30 underline-offset-8 transition-opacity hover:opacity-60"
            >
              Apply now
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
