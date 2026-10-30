"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { saveMeasurements } from "@/lib/admin/actions";
import type { AdminCopy } from "@/lib/admin/copy";
import type { AdminMeasurement } from "@/lib/admin/data";
import type { FieldErrors } from "@/lib/admin/schema";
import { Button, Input, Label, Panel, SaveNote, Select } from "./ui";

export type ColorOption = { value: string; label: string };

const NUMBERS = [
  ["heightCm", "height", 100, 230, 0.5],
  ["bustCm", "bust", 50, 150, 0.5],
  ["waistCm", "waist", 40, 130, 0.5],
  ["hipsCm", "hips", 50, 160, 0.5],
  ["shoeEu", "shoes", 30, 50, 0.5],
] as const;
type NumberKey = (typeof NUMBERS)[number][0];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const toNumber = (v: string) => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || Number.isNaN(n) ? null : n;
};

/** Цвет из базы может быть не из словаря (старые данные): оставляем его в списке как есть. */
function withCurrent(options: ColorOption[], current: string | null) {
  if (!current || options.some((o) => o.value.toLowerCase() === current.toLowerCase())) return options;
  return [...options, { value: current, label: current }];
}

export function MeasurementsForm({
  modelId,
  t,
  history,
  hairOptions,
  eyeOptions,
  editable,
}: {
  modelId: string;
  t: AdminCopy;
  history: AdminMeasurement[];
  hairOptions: ColorOption[];
  eyeOptions: ColorOption[];
  editable: boolean;
}) {
  const router = useRouter();
  const latest = history[0];
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<FieldErrors>({});
  const [values, setValues] = useState<Record<NumberKey, string>>(() =>
    Object.fromEntries(NUMBERS.map(([key]) => [key, latest?.[key] == null ? "" : String(latest[key])])) as Record<NumberKey, string>,
  );
  const match = (options: ColorOption[], v: string | null | undefined) =>
    options.find((o) => o.value.toLowerCase() === v?.toLowerCase())?.value ?? v ?? "";
  const hairList = withCurrent(hairOptions, latest?.hairColor ?? null);
  const eyeList = withCurrent(eyeOptions, latest?.eyeColor ?? null);
  const [hair, setHair] = useState(match(hairList, latest?.hairColor));
  const [eyes, setEyes] = useState(match(eyeList, latest?.eyeColor));
  const [measuredAt, setMeasuredAt] = useState(today);

  function submit(e: FormEvent) {
    e.preventDefault();
    setState("saving");
    setFields({});
    start(async () => {
      const res = await saveMeasurements({
        modelId,
        ...(Object.fromEntries(NUMBERS.map(([key]) => [key, toNumber(values[key])])) as Record<NumberKey, number | null>),
        hairColor: hair,
        eyeColor: eyes,
        measuredAt,
      });
      if (!res.ok) {
        setState("error");
        setFields(res.fields ?? {});
        setError(t.errors[res.error as keyof AdminCopy["errors"]] ?? t.errors.server);
        return;
      }
      setState("saved");
      router.refresh();
    });
  }

  const m = t.measurements;
  return (
    <Panel title={m.title}>
      <form onSubmit={submit}>
        <fieldset disabled={!editable} className="grid gap-5">
          <div className="grid grid-cols-2 gap-5 md:grid-cols-5">
            {NUMBERS.map(([key, label, min, max, step]) => (
              <Label key={key} label={m[label]} error={fields[key] ? t.errors.invalid : undefined}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={min}
                  max={max}
                  step={step}
                  value={values[key]}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  invalid={!!fields[key]}
                />
              </Label>
            ))}
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <Label label={m.hair}>
              <Select value={hair} onChange={(e) => setHair(e.target.value)}>
                <option value="">{m.none}</option>
                {hairList.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Label>
            <Label label={m.eyes}>
              <Select value={eyes} onChange={(e) => setEyes(e.target.value)}>
                <option value="">{m.none}</option>
                {eyeList.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Label>
            <Label label={m.measuredAt} error={fields.measuredAt ? t.errors.invalid : undefined}>
              <Input type="date" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} required />
            </Label>
          </div>
          <p className="text-xs text-mist">{m.hint}</p>
        </fieldset>
        {editable && (
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Button disabled={pending}>{pending ? t.form.saving : m.save}</Button>
            <SaveNote state={state} saved={t.form.saved} error={error} />
          </div>
        )}
      </form>

      {history.length > 0 && (
        <details className="mt-6 text-xs text-mist">
          <summary className="cursor-pointer hover:text-bone">
            {m.history} ({history.length})
          </summary>
          <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left">
            <thead>
              <tr className="text-mist/70">
                <th className="py-1 font-normal">{m.measuredAt}</th>
                {NUMBERS.map(([key, label]) => (
                  <th key={key} className="py-1 font-normal">
                    {m[label].split(",")[0]}
                  </th>
                ))}
                <th className="py-1 font-normal">{m.hair}</th>
                <th className="py-1 font-normal">{m.eyes}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.measuredAt} className="border-t border-line text-bone/80">
                  <td className="py-1.5">{h.measuredAt}</td>
                  {NUMBERS.map(([key]) => (
                    <td key={key}>{h[key] ?? "—"}</td>
                  ))}
                  <td>{h.hairColor ?? "—"}</td>
                  <td>{h.eyeColor ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </details>
      )}
    </Panel>
  );
}
