"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { href } from "@/lib/i18n/paths";
import { LocaleSwitcher } from "./locale-switcher";

export function SiteHeader({ locale, t }: { locale: Locale; t: Dictionary["nav"] }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const links = [
    { href: href(locale, "/models"), label: t.models },
    { href: href(locale, "/agency"), label: t.agency },
    { href: href(locale, "/offices"), label: t.offices },
    { href: href(locale, "/contact"), label: t.contact },
  ];

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-500 ease-luxe ${
        scrolled || open ? "border-b border-line bg-ink/85 backdrop-blur-md" : "border-b border-transparent"
      }`}
    >
      <div className="container-luxe flex h-16 items-center justify-between md:h-20">
        <Link href={href(locale)} className="display text-xl tracking-[0.28em] uppercase md:text-2xl" aria-label="STATUS INTERNATIONAL">
          Status<span className="text-champagne">.</span>
        </Link>

        <nav className="hidden items-center gap-10 lg:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`eyebrow transition-colors duration-300 hover:text-bone ${
                pathname.startsWith(l.href) ? "text-bone" : "text-mist"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-6">
          <LocaleSwitcher current={locale} label={t.language} className="hidden lg:flex" />
          <Link
            href={href(locale, "/become-a-model")}
            className="eyebrow hidden border border-champagne/60 px-5 py-3 text-champagne transition-colors duration-300 hover:bg-champagne hover:text-ink sm:inline-block"
          >
            {t.becomeModel}
          </Link>
          <button
            type="button"
            className="eyebrow text-bone lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? t.close : t.menu}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="container-luxe flex h-[calc(100dvh-4rem)] flex-col justify-between pb-10 lg:hidden">
          <nav className="flex flex-col gap-2 pt-10" aria-label="Mobile">
            {[...links, { href: href(locale, "/become-a-model"), label: t.becomeModel }].map((l) => (
              <Link key={l.href} href={l.href} className="display text-5xl uppercase">
                {l.label}
              </Link>
            ))}
          </nav>
          <LocaleSwitcher current={locale} label={t.language} className="flex" />
        </div>
      )}
    </header>
  );
}
