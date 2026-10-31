import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminBar } from "@/components/admin/admin-bar";
import { Button, Check, Label, Panel, Select, StatusBadge, Textarea } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { adminCopy, fill } from "@/lib/admin/copy";
import { APPLICATION_STATUSES, getApplication } from "@/lib/admin/scouting";
import { updateApplication } from "@/lib/admin/scouting-actions";
import { getModelDictionary } from "@/lib/i18n/model";
import { href } from "@/lib/i18n/paths";
import { localeFrom } from "@/lib/i18n/params";
import { ageOn } from "@/lib/scouting/schema";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminApplicationPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const locale = await localeFrom(params);
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const t = adminCopy(locale);
  const s = t.scouting;
  const { supabase, staff } = await requireStaff(locale);
  const [app, m] = await Promise.all([getApplication(supabase, id), getModelDictionary(locale)]);
  if (!app) notFound();

  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const color = (dict: Record<string, string>, v: string | null) => (v ? (dict[v.toLowerCase()] ?? v) : "—");
  const n = (v: number | null) => (v == null ? "—" : String(Number(v)));
  const digits = app.phone?.replace(/\D/g, "");

  const rows = (items: Array<[string, React.ReactNode]>) => (
    <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-3 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-mist">{k}</dt>
          <dd className="text-bone">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
  const link = (url: string, text: string) => (
    <a href={url} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-4 hover:text-champagne">
      {text}
    </a>
  );

  return (
    <>
      <AdminBar locale={locale} staff={staff} t={t} />
      <main className="container-luxe mt-10 max-w-6xl">
        <Link href={href(locale, "/admin/scouting")} className="text-xs tracking-[0.14em] text-mist uppercase hover:text-champagne">
          ← {s.back}
        </Link>
        <div className="mt-6 mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-mist">
              {app.ref} · <StatusBadge status={app.status === "pending" ? "published" : app.status} label={t.appStatus[app.status]} /> ·{" "}
              {s.received} {date.format(new Date(app.createdAt))}
            </p>
            <h1 className="display mt-3 text-6xl uppercase md:text-7xl">{app.name}</h1>
            <p className="mt-2 text-sm text-mist">
              {app.birthDate && fill(s.age, { n: ageOn(app.birthDate) })}
              {app.isMinor && <span className="ml-3 border border-red-400/50 px-2 py-0.5 text-xs text-red-300">{s.minor}</span>}
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          <Panel title={s.photos}>
            {app.photos.length === 0 ? (
              <p className="text-sm text-mist">{s.noPhotos}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {app.photos.map((p) => (
                  <figure key={p.slot}>
                    <a href={p.url ?? "#"} target="_blank" rel="noreferrer" className="block aspect-[3/4] overflow-hidden bg-graphite-2">
                      {p.url && (
                        // eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка на приватный bucket
                        <img src={p.url} alt={s.slots[p.slot]} className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]" />
                      )}
                    </a>
                    <figcaption className="mt-2 flex justify-between text-xs text-mist">
                      {s.slots[p.slot]}
                      {p.url && link(p.url, `${s.original} ↗`)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </Panel>

          <div className="grid gap-6 md:grid-cols-2">
            <Panel title={s.about}>
              {rows([
                [t.form.firstName, app.firstName ?? app.name],
                [t.form.lastName, app.lastName],
                [s.birthDate, app.birthDate?.split("-").reverse().join(".")],
                [s.place, [app.city, app.country].filter(Boolean).join(", ")],
                [s.market, app.office ?? s.marketAny],
                [s.source, `${app.source === "scout" ? s.sourceScout : s.sourceWebsite} · ${app.uiLocale.toUpperCase()}${Object.keys(app.utm).length ? ` · ${Object.entries(app.utm).map(([k, v]) => `${k}=${v}`).join(", ")}` : ""}`],
              ])}
            </Panel>
            <Panel title={s.contacts}>
              {rows([
                ["Email", link(`mailto:${app.email}`, app.email)],
                ["Phone / WhatsApp", app.phone && digits ? <>{link(`tel:+${digits}`, app.phone)} · {link(`https://wa.me/${digits}`, "WhatsApp")}</> : null],
                ["Instagram", app.instagram && link(`https://instagram.com/${app.instagram}`, `@${app.instagram}`)],
                ["Telegram", app.telegram && link(`https://t.me/${app.telegram}`, `@${app.telegram}`)],
              ])}
            </Panel>
            <Panel title={s.params}>
              {rows([
                [s.height, app.heightCm ? `${n(app.heightCm)} cm` : null],
                [s.bwh, [app.bustCm, app.waistCm, app.hipsCm].some((v) => v != null) ? [app.bustCm, app.waistCm, app.hipsCm].map(n).join(" / ") : null],
                [s.shoes, app.shoeEu != null ? n(app.shoeEu) : null],
                [s.eyes, color(m.eyeColors, app.eyeColor)],
                [s.hair, color(m.hairColors, app.hairColor)],
              ])}
            </Panel>
            <Panel title={s.status}>
              <form action={updateApplication} className="grid gap-4">
                <input type="hidden" name="id" value={app.id} />
                <p className="text-sm text-mist">
                  {s.assigned}: <span className="text-bone">{app.assignee ?? s.nobody}</span>
                </p>
                <Label label={s.status}>
                  <Select name="status" defaultValue={app.status}>
                    {APPLICATION_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {t.appStatus[st]}
                      </option>
                    ))}
                  </Select>
                </Label>
                <Label label={s.note}>
                  <Textarea name="note" maxLength={2000} className="min-h-20" />
                </Label>
                {!app.assignedTo && <Check name="take" value="1" label={s.take} />}
                <div>
                  <Button type="submit">{s.save}</Button>
                </div>
              </form>
            </Panel>
          </div>

          {app.events.length > 0 && (
            <Panel title={s.history}>
              <ol className="space-y-3 text-sm">
                {app.events.map((ev) => (
                  <li key={ev.id} className="flex flex-wrap gap-x-3 border-b border-line pb-3 last:border-0">
                    <span className="text-xs text-mist">{date.format(new Date(ev.created_at))}</span>
                    <span className="text-mist">{ev.actor?.full_name ?? "—"}</span>
                    {ev.to_status && (
                      <span className="text-bone">
                        {ev.from_status ? `${t.appStatus[ev.from_status as keyof typeof t.appStatus] ?? ev.from_status} → ` : ""}
                        {t.appStatus[ev.to_status as keyof typeof t.appStatus] ?? ev.to_status}
                      </span>
                    )}
                    {ev.note && <span className="basis-full text-bone/90">{ev.note}</span>}
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </div>
      </main>
    </>
  );
}
