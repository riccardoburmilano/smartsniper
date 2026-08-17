"use client";

import { Reveal } from "@/components/ui/Reveal";

type ComingSoonProps = {
  eyebrow: string;
  title: string;
  body: string;
};

export function ComingSoon({ eyebrow, title, body }: ComingSoonProps) {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-[1400px] flex-col justify-end px-5 py-20 md:px-10 md:py-28">
      <Reveal>
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted">
          {eyebrow}
        </p>
        <h1 className="mt-5 max-w-4xl font-display text-[clamp(3rem,9vw,7rem)] leading-[0.88] tracking-tightest text-ink">
          {title}
        </h1>
        <p className="mt-8 max-w-md text-sm leading-relaxed text-muted md:text-[15px]">
          {body}
        </p>
      </Reveal>
    </section>
  );
}
