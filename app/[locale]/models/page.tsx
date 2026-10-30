import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Board } from "@/components/model/board";
import { getBoard } from "@/lib/data/model";
import { isLocale } from "@/lib/i18n/config";
import { getModelDictionary } from "@/lib/i18n/model";
import { alternates } from "@/lib/i18n/paths";

// ISR: новые модели и фото из админки появляются на борде через 5 минут.
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getModelDictionary(locale);
  return {
    title: t.board.title,
    description: t.board.metaDescription,
    alternates: alternates(locale, "/models"),
  };
}

export default async function BoardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [t, talent] = await Promise.all([getModelDictionary(locale), getBoard(locale)]);

  return (
    <main className="container-luxe pb-28 pt-32 md:pb-40 md:pt-44">
      <header className="mb-16 grid grid-cols-12 items-end gap-y-6 md:mb-24 md:gap-x-8">
        <div className="col-span-12 md:col-span-8">
          <p className="eyebrow mb-6 text-champagne">{t.board.count(talent.length)}</p>
          <h1 className="display text-[clamp(3.5rem,10vw,10rem)] uppercase">{t.board.title}</h1>
        </div>
        <p className="col-span-12 max-w-sm text-sm leading-relaxed text-mist md:col-span-4 md:justify-self-end">{t.board.lead}</p>
      </header>

      {talent.length === 0 ? (
        <p className="text-mist">{t.board.empty}</p>
      ) : (
        <Board
          locale={locale}
          talent={talent}
          t={{ all: t.board.all, height: t.height, newFace: t.newFace, categories: t.categories }}
        />
      )}
    </main>
  );
}
