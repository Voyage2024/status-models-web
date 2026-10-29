import type { ModelMeasurements } from "@/lib/data/model";
import type { ModelDictionary } from "@/lib/i18n/model";

const cm = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const inches = (v: number) => Math.round(v / 2.54);

/** 165 → 5'5": зарубежные клиенты и агенты в Нью-Йорке читают рост в футах. */
function feet(v: number) {
  const total = Math.round(v / 2.54);
  return `${Math.floor(total / 12)}'${total % 12}"`;
}

export type MeasurementRow = { key: string; label: string; metric: string; imperial: string | null };

/** Строки параметров в порядке comp card; пустые поля пропускаются. */
export function measurementRows(m: ModelMeasurements | null, t: ModelDictionary): MeasurementRow[] {
  if (!m) return [];
  const rows: Array<MeasurementRow | null> = [
    m.heightCm != null ? { key: "height", label: t.height, metric: cm(m.heightCm), imperial: feet(m.heightCm) } : null,
    m.bustCm != null ? { key: "bust", label: t.bust, metric: cm(m.bustCm), imperial: String(inches(m.bustCm)) } : null,
    m.waistCm != null ? { key: "waist", label: t.waist, metric: cm(m.waistCm), imperial: String(inches(m.waistCm)) } : null,
    m.hipsCm != null ? { key: "hips", label: t.hips, metric: cm(m.hipsCm), imperial: String(inches(m.hipsCm)) } : null,
    m.shoeEu != null ? { key: "shoes", label: t.shoes, metric: `${cm(m.shoeEu)} EU`, imperial: null } : null,
    m.hairColor ? { key: "hair", label: t.hair, metric: m.hairColor, imperial: null } : null,
    m.eyeColor ? { key: "eyes", label: t.eyes, metric: m.eyeColor, imperial: null } : null,
  ];
  return rows.filter((r): r is MeasurementRow => r !== null);
}

/** Короткая строка для meta description: «Height 165 · 72-60-82». */
export function measurementSummary(m: ModelMeasurements | null, t: ModelDictionary): string {
  if (!m) return "";
  const parts: string[] = [];
  if (m.heightCm != null) parts.push(`${t.height} ${cm(m.heightCm)}`);
  if (m.bustCm != null && m.waistCm != null && m.hipsCm != null) parts.push(`${cm(m.bustCm)}-${cm(m.waistCm)}-${cm(m.hipsCm)}`);
  return parts.join(" · ");
}
