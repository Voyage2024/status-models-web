import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { href } from "@/lib/i18n/paths";

export function Gateways({ locale, t }: { locale: Locale; t: Dictionary["gateways"] }) {
  const items = [
    { ...t.clients, to: href(locale, "/models") },
    { ...t.scouts, to: href(locale, "/become-a-model?source=scout") },
    { ...t.faces, to: href(locale, "/become-a-model") },
  ];

  return (
    <section className="container-luxe py-28 md:py-40" aria-labelledby="gateways-title">
      <p className="eyebrow mb-6 text-champagne">({t.index})</p>
      <h2 id="gateways-title" className="sr-only">
        {t.title}
      </h2>
      <ul className="grid border-t border-line md:grid-cols-3">
        {items.map((item, i) => (
          <li key={item.to} className={`border-b border-line md:border-b-0 ${i > 0 ? "md:border-l" : ""}`}>
            <Link
              href={item.to}
              className="group flex h-full min-h-[22rem] flex-col justify-between gap-12 py-10 transition-colors duration-500 hover:bg-graphite md:px-10 md:py-14"
            >
              <div>
                <p className="eyebrow text-mist">{item.label}</p>
                <h3 className="display mt-8 text-[clamp(2.5rem,4vw,4rem)]">{item.title}</h3>
                <p className="mt-6 max-w-xs text-sm leading-relaxed text-mist">{item.text}</p>
              </div>
              <span className="eyebrow flex items-center gap-4 text-bone transition-colors group-hover:text-champagne">
                {item.cta}
                <span className="h-px w-10 bg-current transition-[width] duration-500 ease-luxe group-hover:w-16" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
