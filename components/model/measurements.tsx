import type { MeasurementRow } from "@/lib/comp-card/format";

/** Таблица параметров: метрика крупно, дюймы мелко для зарубежных клиентов. */
export function Measurements({ rows, title }: { rows: MeasurementRow[]; title: string }) {
  if (!rows.length) return null;
  return (
    <section aria-label={title}>
      <p className="eyebrow mb-5 text-champagne">{title}</p>
      <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <div key={r.key} className="border-b border-line py-4 pr-4">
            <dt className="eyebrow text-mist">{r.label}</dt>
            <dd className="mt-2 flex items-baseline gap-2">
              <span className={r.key === "hair" || r.key === "eyes" ? "display text-2xl" : "display text-3xl lining-nums tabular-nums"}>
                {r.metric}
              </span>
              {r.imperial && <span className="text-xs tabular-nums text-mist">{r.imperial}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
