import { PageStub } from "@/components/layout/page-stub";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localeFrom } from "@/lib/i18n/params";

export default async function Page({ params }: { params: Promise<{ locale: string; city: string }> }) {
  const [locale, { city }] = await Promise.all([localeFrom(params), params]);
  const t = await getDictionary(locale);
  const title = city.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
  return <PageStub locale={locale} title={title} eyebrow={t.nav.offices} />;
}
