import Link from "next/link";
import { AdminBar } from "@/components/admin/admin-bar";
import { StatusBadge } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { adminCopy, fill } from "@/lib/admin/copy";
import { APPLICATION_STATUSES, listApplications } from "@/lib/admin/scouting";
import { href } from "@/lib/i18n/paths";
import { localeFrom } from "@/lib/i18n/params";
import { ageOn } from "@/lib/scouting/schema";

export const dynamic = "force-dynamic";

type Search = { q?: string; status?: string; mine?: string };

export default async function AdminScoutingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const locale = await localeFrom(params);
  const t = adminCopy(locale);
  const s = t.scouting;
  const { supabase, staff } = await requireStaff(locale);
  const raw = await searchParams;
  const filters = {
    q: typeof raw.q === "string" ? raw.q.slice(0, 80) : undefined,
    status: (APPLICATION_STATUSES as readonly string[]).includes(raw.status ?? "") ? raw.status : undefined,
    mine: raw.mine === "1" ? staff.id : undefined,
  };
  const apps = await listApplications(supabase, filters);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <AdminBar locale={locale} staff={staff} t={t} />
      <main className="container-luxe mt-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h1 className="display text-6xl uppercase md:text-7xl">{s.title}</h1>
          <form className="flex flex-wrap items-center gap-2 text-sm">
            <input
              name="q"
              defaultValue={filters.q}
              placeholder={s.search}
              className="w-56 border border-line bg-graphite px-3 py-2 text-bone placeholder:text-mist/60 focus:border-champagne focus:outline-none"
            />
            <select name="status" defaultValue={filters.status ?? ""} className="border border-line bg-graphite px-3 py-2 text-bone [color-scheme:dark]">
              <option value="">{s.allStatuses}</option>
              {APPLICATION_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {t.appStatus[st]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 px-2 text-xs text-mist">
              <input type="checkbox" name="mine" value="1" defaultChecked={!!filters.mine} className="size-4 accent-[#c8a96a]" />
              {s.mine}
            </label>
            <button className="border border-line px-4 py-2 text-xs tracking-[0.14em] uppercase hover:border-champagne hover:text-champagne">
              {s.filter}
            </button>
          </form>
        </div>
        <p className="mt-4 text-xs text-mist">{fill(s.count, { n: apps.length })}</p>

        {apps.length === 0 ? (
          <p className="mt-16 text-mist">{s.empty}</p>
        ) : (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {apps.map((a) => (
              <li key={a.id}>
                <Link
                  href={href(locale, `/admin/scouting/${a.id}`)}
                  className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 py-3 transition-colors hover:bg-graphite md:grid-cols-[3.5rem_2fr_8rem_5rem_9rem_10rem] md:px-2"
                >
                  <span className="block aspect-[3/4] w-14 overflow-hidden bg-graphite-2">
                    {a.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка на приватный bucket
                      <img src={a.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="display block truncate text-2xl">{a.name}</span>
                    <span className="block truncate text-xs text-mist">
                      {a.ref} · {a.place}
                      {a.source === "scout" && ` · ${s.sourceScout}`}
                    </span>
                  </span>
                  <span className="hidden text-xs text-mist md:block">
                    {a.birthDate && fill(s.age, { n: ageOn(a.birthDate) })}
                    {a.isMinor && <span className="ml-2 text-red-300">{s.minor}</span>}
                  </span>
                  <span className="hidden text-xs text-mist md:block">{a.heightCm ? `${a.heightCm} cm` : "—"}</span>
                  <span className="justify-self-end md:justify-self-start">
                    <StatusBadge status={a.status === "pending" ? "published" : a.status} label={t.appStatus[a.status]} />
                  </span>
                  <span className="hidden text-xs text-mist md:block">{date.format(new Date(a.createdAt))}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
