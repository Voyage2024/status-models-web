import { PageStub } from "@/components/layout/page-stub";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localeFrom } from "@/lib/i18n/params";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await localeFrom(params);
  const t = await getDictionary(locale);
  return <PageStub locale={locale} title={t.nav.agency} />;
}
