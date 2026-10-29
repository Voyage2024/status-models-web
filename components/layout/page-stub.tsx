import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { href } from "@/lib/i18n/paths";

/** Временная страница для роутов, которые уже есть в карте редиректов, но ещё не свёрстаны. */
export async function PageStub({ locale, title, eyebrow }: { locale: Locale; title: string; eyebrow?: string }) {
  const t = await getDictionary(locale);
  return (
    <main className="container-luxe flex min-h-[80dvh] flex-col justify-end pb-24 pt-40">
      {eyebrow && <p className="eyebrow mb-6 text-champagne">{eyebrow}</p>}
      <h1 className="display text-[clamp(3.5rem,10vw,10rem)] uppercase">{title}</h1>
      <p className="mt-8 text-mist">{t.stub.soon}</p>
      <Link href={href(locale)} className="eyebrow mt-10 text-bone hover:text-champagne">
        ← {t.stub.back}
      </Link>
    </main>
  );
}
