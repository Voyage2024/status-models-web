import Link from "next/link";
import type { Staff } from "@/lib/admin/auth";
import { signOut } from "@/lib/admin/actions";
import type { AdminCopy } from "@/lib/admin/copy";
import type { Locale } from "@/lib/i18n/config";
import { href } from "@/lib/i18n/paths";

export function AdminBar({ locale, staff, t }: { locale: Locale; staff: Staff; t: AdminCopy }) {
  return (
    <div className="container-luxe">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <nav className="flex items-center gap-6 text-xs tracking-[0.14em] uppercase">
          <Link href={href(locale, "/admin")} className="text-bone hover:text-champagne">
            {t.nav.models}
          </Link>
          <Link href={href(locale, "/admin/scouting")} className="text-bone hover:text-champagne">
            {t.nav.scouting}
          </Link>
          {staff.role === "owner" && (
            <Link href={href(locale, "/admin/models/new")} className="text-mist hover:text-champagne">
              + {t.nav.add}
            </Link>
          )}
        </nav>
        <form action={signOut} className="flex items-center gap-4 text-xs text-mist">
          <span>
            {staff.fullName} · <span className="text-champagne">{t.roles[staff.role]}</span>
          </span>
          <input type="hidden" name="locale" value={locale} />
          <button className="tracking-[0.14em] uppercase hover:text-bone">{t.nav.signOut}</button>
        </form>
      </div>
    </div>
  );
}
