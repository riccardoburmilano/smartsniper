"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/site";

export function SiteFooter() {
  const pathname = usePathname();

  if (pathname === "/") {
    return null;
  }

  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-5 py-8 md:flex-row md:items-end md:justify-between md:px-10 md:py-10">
        <div>
          <p className="font-display text-3xl tracking-tightest text-ink md:text-4xl">
            {site.name}
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Accademia. Community. Culto creativo — {site.location}.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-3 text-[11px] uppercase tracking-[0.2em] text-ink">
          <Link
            href="/admission"
            className="opacity-60 transition-opacity hover:opacity-100"
          >
            Apply
          </Link>
          <Link
            href="/society"
            className="opacity-60 transition-opacity hover:opacity-100"
          >
            Society
          </Link>
          <span className="opacity-40">© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
