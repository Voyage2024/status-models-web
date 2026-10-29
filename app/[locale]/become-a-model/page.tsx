import type { Metadata } from "next";
import { ScoutingForm } from "@/components/scouting/scouting-form";
import { getOffices } from "@/lib/data/home";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { alternates } from "@/lib/i18n/paths";
import { localeFrom } from "@/lib/i18n/params";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFrom(params);
  const t = await getDictionary(locale);
  return {
    title: t.scouting.metaTitle,
    description: t.scouting.metaDescription,
    alternates: alternates(locale, "/become-a-model"),
  };
}

export default async function BecomeAModelPage({ params, searchParams }: Props) {
  const locale = await localeFrom(params);
  const [t, offices, query] = await Promise.all([getDictionary(locale), getOffices(locale), searchParams]);
  const s = t.scouting;
  const scout = query.source === "scout";
  const utm = Object.fromEntries(
    UTM_KEYS.flatMap((k) => (typeof query[k] === "string" ? [[k, (query[k] as string).slice(0, 200)]] : [])),
  );

  return (
    <main className="container-luxe grid grid-cols-12 gap-y-16 pb-28 pt-32 md:gap-x-8 md:pt-40">
      <aside className="col-span-12 lg:col-span-4">
        <div className="lg:sticky lg:top-32">
          <p className="eyebrow mb-8 flex items-center gap-4 text-mist">
            <span className="h-px w-10 bg-champagne" />
            {s.eyebrow}
          </p>
          <h1 className="display text-[clamp(2.6rem,8vw,7.5rem)] uppercase [overflow-wrap:anywhere]">
            {scout ? s.scoutTitle : s.title}
          </h1>
          <p className="mt-8 max-w-sm leading-relaxed text-mist">{scout ? s.scoutLead : s.lead}</p>

          <div className="mt-14 max-w-sm border-t border-line pt-8">
            <p className="eyebrow text-champagne">{s.tipsTitle}</p>
            <ol className="mt-6 space-y-4">
              {s.tips.map((tip, i) => (
                <li key={tip} className="flex gap-4 text-sm leading-relaxed text-mist">
                  <span className="font-display text-lg italic text-bone">{i + 1}</span>
                  {tip}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </aside>

      <div className="col-span-12 lg:col-span-7 lg:col-start-6">
        <ScoutingForm
          locale={locale}
          t={s}
          offices={offices.map((o) => ({ slug: o.slug, name: o.name }))}
          initialMode={scout ? "scout" : "website"}
          landingPath={`/${locale}/become-a-model`}
          utm={utm}
        />
      </div>
    </main>
  );
}
