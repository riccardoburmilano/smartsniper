"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { nav, site } from "@/lib/site";

export function SiteNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (isHome) {
    return null;
  }

  return (
    <header className="relative z-40 border-b border-line">
      <div className="mx-auto flex max-w-[1400px] items-end justify-between gap-6 px-5 py-5 md:px-10 md:py-7">
        <Link
          href="/"
          className="font-display text-2xl leading-none tracking-tightest text-ink transition-opacity duration-300 hover:opacity-60 md:text-3xl"
        >
          {site.name}
        </Link>

        <nav aria-label="Primary" className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 md:gap-x-8">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative font-sans text-[11px] uppercase tracking-[0.22em] text-ink"
              >
                <span className={active ? "opacity-100" : "opacity-55 transition-opacity duration-300 hover:opacity-100"}>
                  {item.label}
                </span>
                {active ? (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute -bottom-1 left-0 h-px w-full bg-ink"
                    transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
