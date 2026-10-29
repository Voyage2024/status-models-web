import type { Metadata } from "next";
import Link from "next/link";
import { isLocale, locales, type Locale } from "@/lib/i18n/config";
import { href } from "@/lib/i18n/paths";

// Заглушка входа для команды: никаких обращений к Supabase и cookies на этапе сборки.
// Настоящая админка (Supabase Auth, роли owner/booker/scout) будет рендериться динамически.
export const dynamic = "force-static";

export const metadata: Metadata = { title: "Staff", robots: { index: false, follow: false } };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const copy: Record<Locale, { title: string; text: string; back: string }> = {
  en: { title: "Staff login", text: "The admin area is being built.", back: "Back to home" },
  ru: { title: "Вход для команды", text: "Админка в разработке.", back: "На главную" },
  es: { title: "Acceso del equipo", text: "El panel está en desarrollo.", back: "Volver al inicio" },
  pt: { title: "Acesso da equipe", text: "O painel está em desenvolvimento.", back: "Voltar ao início" },
};

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "en";
  const t = copy[locale];
  return (
    <main className="container-luxe flex min-h-[80dvh] flex-col justify-end pb-24 pt-40">
      <h1 className="display text-[clamp(3rem,10vw,10rem)] uppercase">{t.title}</h1>
      <p className="mt-8 text-mist">{t.text}</p>
      <Link href={href(locale)} className="eyebrow mt-10 text-bone hover:text-champagne">
        ← {t.back}
      </Link>
    </main>
  );
}
