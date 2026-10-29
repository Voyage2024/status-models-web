import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { href } from "@/lib/i18n/paths";

export function SiteFooter({ locale, t }: { locale: Locale; t: Dictionary }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line">
      <div className="container-luxe grid gap-12 py-16 md:grid-cols-12 md:py-24">
        <div className="md:col-span-6">
          <p className="display text-[clamp(3rem,8vw,7.5rem)] uppercase">
            Status <br />
            <span className="italic text-champagne normal-case">International</span>
          </p>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-mist">{t.footer.tagline}</p>
        </div>
        <nav className="grid grid-cols-1 gap-x-8 gap-y-4 self-end sm:grid-cols-2 md:col-span-6 md:grid-cols-3" aria-label="Footer">
          {[
            [href(locale, "/models"), t.nav.models],
            [href(locale, "/agency"), t.nav.agency],
            [href(locale, "/offices"), t.nav.offices],
            [href(locale, "/become-a-model"), t.nav.becomeModel],
            [href(locale, "/contact"), t.nav.contact],
            [href(locale, "/privacy"), t.footer.privacy],
          ].map(([to, label]) => (
            <Link key={to} href={to} className="eyebrow text-mist transition-colors hover:text-bone">
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="container-luxe flex flex-col gap-3 border-t border-line py-6 text-xs text-mist sm:flex-row sm:justify-between">
        <span>
          © {year} STATUS INTERNATIONAL. {t.footer.rights}
        </span>
        <Link href={href(locale, "/admin")} className="transition-colors hover:text-bone">
          {t.footer.staff}
        </Link>
      </div>
    </footer>
  );
}
