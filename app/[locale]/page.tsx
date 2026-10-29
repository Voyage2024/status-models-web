import { notFound } from "next/navigation";
import { Gateways } from "@/components/home/gateways";
import { GlobalNetwork } from "@/components/home/global-network";
import { Hero } from "@/components/home/hero";
import { SelectedTalent } from "@/components/home/selected-talent";
import { getOffices, getSelectedTalent } from "@/lib/data/home";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

// ISR: борд обновляется из Supabase раз в 5 минут.
export const revalidate = 300;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [t, talent, offices] = await Promise.all([getDictionary(locale), getSelectedTalent(locale), getOffices(locale)]);

  return (
    <main>
      <Hero locale={locale} t={t.hero} feature={talent[0]} offices={offices} />
      <SelectedTalent locale={locale} t={t.talent} talent={talent} />
      <GlobalNetwork locale={locale} t={t.network} offices={offices} />
      <Gateways locale={locale} t={t.gateways} />
    </main>
  );
}
