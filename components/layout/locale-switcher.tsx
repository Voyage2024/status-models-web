"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n/config";
import { switchLocalePath } from "@/lib/i18n/paths";

export function LocaleSwitcher({ current, label, className = "" }: { current: Locale; label: string; className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={`items-center gap-3 ${className}`}>
      {locales.map((l) => (
        <Link
          key={l}
          href={switchLocalePath(pathname, l)}
          hrefLang={l}
          aria-current={l === current ? "true" : undefined}
          className={`eyebrow transition-colors duration-300 ${l === current ? "text-champagne" : "text-mist hover:text-bone"}`}
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}
