import Link from "next/link";
import { AdminBar } from "@/components/admin/admin-bar";
import { StatusBadge } from "@/components/admin/ui";
import { canEdit, editableModels, requireStaff } from "@/lib/admin/auth";
import { adminCopy, fill } from "@/lib/admin/copy";
import { listModels } from "@/lib/admin/data";
import { MODEL_CATEGORIES, MODEL_STATUSES } from "@/lib/admin/schema";
import { locales } from "@/lib/i18n/config";
import { href } from "@/lib/i18n/paths";
import { localeFrom } from "@/lib/i18n/params";

export const dynamic = "force-dynamic";

type Search = { q?: string; status?: string; category?: string };

export default async function AdminModelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const locale = await localeFrom(params);
  const t = adminCopy(locale);
  const { supabase, staff } = await requireStaff(locale);
  const raw = await searchParams;
  const filters: Search = {
    q: typeof raw.q === "string" ? raw.q.slice(0, 80) : undefined,
    status: (MODEL_STATUSES as readonly string[]).includes(raw.status ?? "") ? raw.status : undefined,
    category: (MODEL_CATEGORIES as readonly string[]).includes(raw.category ?? "") ? raw.category : undefined,
  };
  const [models, editable] = await Promise.all([listModels(supabase, filters), editableModels(staff, supabase)]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <AdminBar locale={locale} staff={staff} t={t} />
      <main className="container-luxe mt-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h1 className="display text-6xl uppercase md:text-7xl">{t.list.title}</h1>
          <form className="flex flex-wrap items-center gap-2 text-sm">
            <input
              name="q"
              defaultValue={filters.q}
              placeholder={t.list.search}
              className="w-56 border border-line bg-graphite px-3 py-2 text-bone placeholder:text-mist/60 focus:border-champagne focus:outline-none"
            />
            <select name="status" defaultValue={filters.status ?? ""} className="border border-line bg-graphite px-3 py-2 text-bone [color-scheme:dark]">
              <option value="">{t.list.allStatuses}</option>
              {MODEL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.status[s]}
                </option>
              ))}
            </select>
            <select name="category" defaultValue={filters.category ?? ""} className="border border-line bg-graphite px-3 py-2 text-bone [color-scheme:dark]">
              <option value="">{t.list.allCategories}</option>
              {MODEL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t.categories[c]}
                </option>
              ))}
            </select>
            <button className="border border-line px-4 py-2 text-xs tracking-[0.14em] uppercase hover:border-champagne hover:text-champagne">
              {t.list.filter}
            </button>
          </form>
        </div>
        <p className="mt-4 text-xs text-mist">{fill(t.list.count, { n: models.length })}</p>

        {models.length === 0 ? (
          <p className="mt-16 text-mist">{t.list.empty}</p>
        ) : (
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {models.map((m) => (
              <li key={m.id}>
                <Link
                  href={href(locale, `/admin/models/${m.id}`)}
                  className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 py-3 transition-colors hover:bg-graphite md:grid-cols-[3.5rem_2fr_6rem_8rem_8rem_9rem_10rem] md:px-2"
                >
                  <span className="block aspect-[3/4] w-14 overflow-hidden bg-graphite-2">
                    {m.thumb && (
                      // eslint-disable-next-line @next/next/no-img-element -- превью в админке, без оптимизатора
                      <img src={m.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="display block truncate text-2xl">{m.name}</span>
                    <span className="block truncate text-xs text-mist">
                      /{m.slug}
                      {!canEdit(editable, m.id) && <span className="ml-2 text-mist/70">· {t.list.readOnly}</span>}
                    </span>
                  </span>
                  <span className="hidden text-xs text-mist md:block">{m.code}</span>
                  <span className="hidden text-xs text-mist md:block">{t.categories[m.category as keyof typeof t.categories] ?? m.category}</span>
                  <span className="justify-self-end md:justify-self-start">
                    <StatusBadge status={m.status} label={t.status[m.status]} />
                  </span>
                  <span className="hidden gap-1 md:flex" title={t.list.translations}>
                    {locales.map((l) => {
                      const tr = m.locales.find((x) => x.locale === l);
                      return (
                        <span
                          key={l}
                          className={`px-1 text-[0.65rem] uppercase ${tr?.reviewed ? "text-champagne" : tr ? "text-bone/70 line-through" : "text-mist/40"}`}
                        >
                          {l}
                        </span>
                      );
                    })}
                  </span>
                  <span className="hidden text-xs text-mist md:block">{date.format(new Date(m.updatedAt))}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
