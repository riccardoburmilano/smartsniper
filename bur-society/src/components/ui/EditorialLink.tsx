"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ComponentProps } from "react";

type EditorialLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  underline?: boolean;
} & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">;

export function EditorialLink({
  href,
  children,
  className = "",
  underline = true,
  ...props
}: EditorialLinkProps) {
  return (
    <Link
      href={href}
      className={`group relative inline-flex items-baseline gap-3 text-ink transition-opacity duration-300 hover:opacity-70 ${className}`}
      {...props}
    >
      <span className="relative">
        {children}
        {underline ? (
          <motion.span
            aria-hidden
            className="absolute -bottom-1 left-0 h-px w-full origin-left bg-ink"
            initial={{ scaleX: 1 }}
            whileHover={{ scaleX: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          />
        ) : null}
      </span>
    </Link>
  );
}
