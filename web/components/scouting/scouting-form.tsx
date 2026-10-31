"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { href } from "@/lib/i18n/paths";
import { compressPhoto } from "@/lib/scouting/image";
import { uploadToSignedUrl } from "@/lib/scouting/upload";
import {
  ADULT_AGE,
  ageOn,
  ALLOWED_MIME,
  MAX_PHOTO_BYTES,
  MIN_AGE,
  PHOTO_SLOTS,
  REQUIRED_PHOTOS,
  SCOUTING_BUCKET,
  type FieldErrors,
  type PhotoSlot as Slot,
  type SubmitResponse,
  type UploadsResponse,
} from "@/lib/scouting/schema";
import { Field, inputClass, TextInput } from "./field";
import { PhotoSlot } from "./photo-slot";

type T = Dictionary["scouting"];
type Status = "idle" | "uploading" | "submitting";
type Option = { value: string; label: string };

const REQUIRED_TEXT = ["firstName", "lastName", "birthDate", "country", "city", "email", "phone", "heightCm"];

export function ScoutingForm({
  locale,
  t,
  offices,
  colors,
  initialMode,
  landingPath,
  utm,
}: {
  locale: Locale;
  t: T;
  offices: Array<{ slug: string; name: string }>;
  colors: { hair: Option[]; eyes: Option[] };
  initialMode: "website" | "scout";
  landingPath: string;
  utm: Record<string, string>;
}) {
  const [mode, setMode] = useState(initialMode);
  const [photos, setPhotos] = useState<Partial<Record<Slot, File>>>({});
  const [birthDate, setBirthDate] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [done, setDone] = useState<{ ref: string; name: string } | null>(null);
  const startedAt = useRef(Date.now());
  // id заявки переживает повторную попытку после ошибки, чтобы не плодить папки в Storage
  const prepared = useRef<{ applicationId: string; uploaded: Set<Slot> } | null>(null);

  const err = (key: string) => {
    const code = errors[key];
    return code ? (t.errors[code as keyof T["errors"]] ?? t.errors.generic) : undefined;
  };
  const clearError = (key: string) => {
    if (!errors[key]) return;
    const { [key]: _, ...rest } = errors;
    setErrors(rest);
    if (!Object.values(rest).some(Boolean)) setFormError(null);
  };
  const age = birthDate.length === 10 ? ageOn(birthDate) : null;
  const isMinor = age !== null && age < ADULT_AGE;
  const scout = mode === "scout";
  const photoCount = PHOTO_SLOTS.filter((s) => photos[s]).length;

  const slots: Array<{ slot: Slot; label: string; hint: string }> = [
    { slot: "portrait", label: t.photoPortrait, hint: t.photoPortraitHint },
    { slot: "profile", label: t.photoProfile, hint: t.photoProfileHint },
    { slot: "full_length", label: t.photoFull, hint: t.photoFullHint },
    { slot: "extra_1", label: t.photoOther, hint: t.photoOtherHint },
    { slot: "extra_2", label: t.photoOther2, hint: t.photoOther2Hint },
  ];

  function selectPhoto(slot: Slot, file: File) {
    let code: string | undefined;
    if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) code = "fileType";
    else if (file.size > MAX_PHOTO_BYTES) code = "fileSize";
    if (code) return setErrors((e) => ({ ...e, [`photo_${slot}`]: code }));
    clearError(`photo_${slot}`);
    setPhotos((p) => ({ ...p, [slot]: file }));
    prepared.current?.uploaded.delete(slot);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status !== "idle") return;
    setFormError(null);
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");

    // Быстрая проверка в браузере, до загрузки фото. Окончательная — на сервере той же zod-схемой.
    const local: FieldErrors = {};
    for (const name of REQUIRED_TEXT) if (!text(name).trim()) local[name] = "required";
    if (scout && !text("scoutName").trim()) local.scoutName = "required";
    if (age !== null && age < MIN_AGE) local.birthDate = "tooYoung";
    if (form.get("consent") !== "on") local.consent = "consent";
    if (isMinor && form.get("guardianConsent") !== "on") local.guardianConsent = "guardian";
    const missingPhotos = REQUIRED_PHOTOS.filter((k) => !photos[k]);
    for (const k of missingPhotos) local[`photo_${k}`] = "required";
    if (Object.keys(local).length) {
      setErrors(local);
      setFormError(missingPhotos.length && Object.keys(local).length === missingPhotos.length ? t.errors.photos : t.errors.checkFields);
      focusFirstError();
      return;
    }

    try {
      setStatus("uploading");
      const chosen = PHOTO_SLOTS.filter((k) => photos[k]);
      const blobs = await Promise.all(chosen.map((k) => compressPhoto(photos[k]!)));

      if (!prepared.current || chosen.some((k) => !prepared.current!.uploaded.has(k))) {
        const res = await postJson<UploadsResponse>("/api/scouting/uploads", {
          photos: chosen.map((slot, i) => ({ slot, mime: blobs[i].type || "image/jpeg", size: blobs[i].size })),
          website: text("website"),
        });
        if (!res.ok) throw new FormFail(res.error);
        prepared.current = { applicationId: res.applicationId, uploaded: new Set() };
        await Promise.all(
          res.uploads.map(async (u) => {
            const blob = blobs[chosen.indexOf(u.slot)];
            await uploadToSignedUrl(SCOUTING_BUCKET, u.path, u.token, blob).catch(() => {
              throw new FormFail("upload");
            });
            prepared.current!.uploaded.add(u.slot);
          }),
        );
      }

      setStatus("submitting");
      const res = await postJson<SubmitResponse>("/api/scouting", {
        applicationId: prepared.current.applicationId,
        firstName: text("firstName"),
        lastName: text("lastName"),
        email: text("email"),
        phone: text("phone"),
        instagram: text("instagram"),
        telegram: text("telegram"),
        birthDate: text("birthDate"),
        country: text("country"),
        city: text("city"),
        market: text("market"),
        heightCm: text("heightCm"),
        bustCm: text("bustCm"),
        waistCm: text("waistCm"),
        hipsCm: text("hipsCm"),
        shoeEu: text("shoeEu"),
        eyeColor: text("eyeColor"),
        hairColor: text("hairColor"),
        consent: form.get("consent") === "on",
        guardianConsent: form.get("guardianConsent") === "on",
        source: mode,
        scoutName: text("scoutName"),
        scoutContact: text("scoutContact"),
        website: text("website"),
        startedAt: startedAt.current,
        landingPath,
        utm,
        locale,
      });
      if (!res.ok) {
        if (res.fields) {
          setErrors(res.fields);
          focusFirstError();
        }
        throw new FormFail(res.error === "fields" ? "checkFields" : res.error);
      }
      setDone({ ref: res.ref, name: text("firstName").trim() });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (x) {
      const code = x instanceof FormFail ? x.code : "server";
      setFormError(t.errors[code as keyof T["errors"]] ?? t.errors.server);
      if (code === "photos") prepared.current = null;
    } finally {
      setStatus("idle");
    }
  }

  if (done) return <ThankYou locale={locale} t={t} name={done.name} reference={done.ref} />;

  const busy = status !== "idle";
  const section = (n: string, title: string, aside?: string) => (
    <legend className="mb-8 flex w-full items-baseline gap-4 border-t border-line pt-6">
      <span className="eyebrow text-champagne">{n}</span>
      <span className="display text-3xl md:text-4xl">{title}</span>
      {aside && <span className="ml-auto text-xs tabular-nums text-mist">{aside}</span>}
    </legend>
  );
  const colorSelect = (name: string, label: string, options: Option[]) => (
    <Field label={label}>
      <select name={name} defaultValue="" className={`${inputClass} appearance-none`}>
        <option value="" className="bg-ink">
          {t.choose}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink">
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
  const number = (name: string, label: string, min: number, max: number, required = false, step?: number) => (
    <Field label={label} error={err(name)}>
      <TextInput
        name={name}
        type="number"
        inputMode={step ? "decimal" : "numeric"}
        min={min}
        max={max}
        step={step}
        required={required}
        invalid={!!errors[name]}
      />
    </Field>
  );

  return (
    <form
      onSubmit={onSubmit}
      onInput={(e) => clearError((e.target as HTMLInputElement).name)}
      noValidate
      className="space-y-16"
    >
      <div role="radiogroup" className="grid grid-cols-2 border border-line">
        {(["website", "scout"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`eyebrow px-4 py-4 transition-colors ${mode === m ? "bg-bone text-ink" : "text-mist hover:text-bone"}`}
          >
            {m === "website" ? t.modeSelf : t.modeScout}
          </button>
        ))}
      </div>

      {scout && (
        <fieldset>
          {section("00", t.secScout)}
          <div className="grid gap-8 md:grid-cols-2">
            <Field label={t.scoutName} error={err("scoutName")}>
              <TextInput name="scoutName" autoComplete="organization" invalid={!!errors.scoutName} />
            </Field>
            <Field label={t.scoutContact} optional={t.optional}>
              <TextInput name="scoutContact" />
            </Field>
          </div>
        </fieldset>
      )}

      <fieldset>
        {section("01", scout ? t.secAboutScout : t.secAbout)}
        <div className="grid gap-8 md:grid-cols-2">
          <Field label={t.firstName} error={err("firstName")}>
            <TextInput name="firstName" autoComplete={scout ? "off" : "given-name"} required invalid={!!errors.firstName} />
          </Field>
          <Field label={t.lastName} error={err("lastName")}>
            <TextInput name="lastName" autoComplete={scout ? "off" : "family-name"} required invalid={!!errors.lastName} />
          </Field>
          <Field label={t.birthDate} error={err("birthDate")}>
            <TextInput
              name="birthDate"
              type="date"
              required
              min="1950-01-01"
              max={new Date().toISOString().slice(0, 10)}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              invalid={!!errors.birthDate}
            />
          </Field>
          {/* Возраст не вводится, а считается по дате рождения: так он не расходится с ней и не устаревает в базе. */}
          <div>
            <span className="eyebrow text-mist">{t.age}</span>
            <output aria-live="polite" className={`${inputClass} border-white/10 text-mist`}>
              {age !== null && age >= 0 ? <span className="tabular-nums text-bone">{age}</span> : t.ageAuto}
            </output>
          </div>
          <Field label={t.country} error={err("country")}>
            <TextInput name="country" autoComplete={scout ? "off" : "country-name"} required invalid={!!errors.country} />
          </Field>
          <Field label={t.city} error={err("city")}>
            <TextInput name="city" autoComplete={scout ? "off" : "address-level2"} required invalid={!!errors.city} />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        {section("02", t.secContacts)}
        <div className="grid gap-8 md:grid-cols-2">
          <Field label={t.email} error={err("email")}>
            <TextInput name="email" type="email" inputMode="email" autoComplete={scout ? "off" : "email"} required invalid={!!errors.email} />
          </Field>
          <Field label={t.phone} error={err("phone")}>
            <TextInput name="phone" type="tel" inputMode="tel" placeholder="+" autoComplete={scout ? "off" : "tel"} required invalid={!!errors.phone} />
          </Field>
          <Field label={t.instagram} optional={t.optional} error={err("instagram")}>
            <TextInput name="instagram" placeholder="@username" autoCapitalize="none" spellCheck={false} invalid={!!errors.instagram} />
          </Field>
          <Field label={t.telegram} optional={t.optional} error={err("telegram")}>
            <TextInput name="telegram" placeholder="@username" autoCapitalize="none" spellCheck={false} invalid={!!errors.telegram} />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        {section("03", t.secBody)}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {number("heightCm", t.heightCm, 140, 210, true)}
          {number("bustCm", t.bust, 60, 140)}
          {number("waistCm", t.waist, 45, 110)}
          {number("hipsCm", t.hips, 60, 140)}
        </div>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {number("shoeEu", t.shoeEu, 33, 48, false, 0.5)}
          {colorSelect("eyeColor", t.eyeColor, colors.eyes)}
          {colorSelect("hairColor", t.hairColor, colors.hair)}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-mist">{t.measuresHint}</p>
        <div className="mt-8 md:w-1/2">
          <Field label={t.market}>
            <select name="market" defaultValue="" className={`${inputClass} appearance-none`}>
              <option value="" className="bg-ink">
                {t.marketAny}
              </option>
              {offices.map((o) => (
                <option key={o.slug} value={o.slug} className="bg-ink">
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset>
        {section("04", t.secPhotos, `${photoCount} / ${PHOTO_SLOTS.length}`)}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {slots.map((s) => (
            <PhotoSlot
              key={s.slot}
              label={s.label}
              hint={s.hint}
              required={REQUIRED_PHOTOS.includes(s.slot)}
              file={photos[s.slot] ?? null}
              error={err(`photo_${s.slot}`)}
              t={{ add: t.add, replace: t.replace, remove: t.remove, optional: t.optional }}
              onSelect={(f) => selectPhoto(s.slot, f)}
              onRemove={() => {
                setPhotos(({ [s.slot]: _, ...rest }) => rest);
                prepared.current?.uploaded.delete(s.slot);
              }}
            />
          ))}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-mist">{t.photosNote}</p>
      </fieldset>

      <fieldset>
        {section("05", t.secConsent)}
        <div className="space-y-5">
          <Checkbox name="consent" error={err("consent")}>
            {t.consent}{" "}
            <Link href={href(locale, "/privacy")} target="_blank" className="text-bone underline underline-offset-4">
              {t.consentLink}
            </Link>
            .
          </Checkbox>
          {(isMinor || errors.guardianConsent) && (
            <Checkbox name="guardianConsent" error={err("guardianConsent")}>
              {t.guardian}
            </Checkbox>
          )}
        </div>
      </fieldset>

      {/* Ловушка для ботов: человек это поле не видит */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-6 border-t border-line pt-10 sm:flex-row sm:items-center sm:justify-between">
        <p role="alert" className="min-h-5 text-sm text-red-300">
          {formError}
        </p>
        <button
          type="submit"
          disabled={busy}
          className="eyebrow w-full bg-champagne px-10 py-5 text-ink transition-colors hover:bg-bone disabled:cursor-wait disabled:opacity-70 sm:w-auto"
        >
          {status === "uploading" ? t.uploading : status === "submitting" ? t.submitting : t.submit}
        </button>
      </div>
    </form>
  );
}

function ThankYou({ locale, t, name, reference }: { locale: Locale; t: T; name: string; reference: string }) {
  return (
    <div className="border-t border-line pt-12" role="status">
      <p className="eyebrow flex items-center gap-4 text-mist">
        <span className="h-px w-10 bg-champagne" />
        {t.successEyebrow}
      </p>
      <h2 className="display mt-8 text-[clamp(3rem,7vw,6rem)] leading-[0.95] italic text-champagne">
        {name ? t.successTitle.replace("{name}", name) : t.successTitleNoName}
      </h2>
      <p className="mt-6 max-w-md leading-relaxed text-mist">{t.successText}</p>

      <ol className="mt-12 grid gap-px border border-line bg-line sm:grid-cols-3">
        {t.successSteps.map((step, i) => (
          <li key={step} className="bg-ink p-5">
            <span className="font-display text-2xl italic text-champagne">{i + 1}</span>
            <p className="mt-3 text-sm leading-relaxed text-mist">{step}</p>
          </li>
        ))}
      </ol>

      <p className="eyebrow mt-12 text-mist">{t.successRef}</p>
      <p className="display mt-3 text-4xl tabular-nums">{reference}</p>
      <div className="mt-12 flex flex-wrap gap-8">
        <Link href={href(locale)} className="eyebrow text-bone hover:text-champagne">
          ← {t.successBack}
        </Link>
        <Link href={href(locale, "/models")} className="eyebrow text-mist hover:text-champagne">
          {t.successBoard} →
        </Link>
      </div>
    </div>
  );
}

function Checkbox({ name, error, children }: { name: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-4 text-sm leading-relaxed text-mist">
      <input
        type="checkbox"
        name={name}
        aria-invalid={!!error || undefined}
        className="mt-0.5 size-5 shrink-0 cursor-pointer appearance-none border border-white/30 bg-transparent checked:border-champagne checked:bg-champagne checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22><path d=%22M5 10.5l3 3 7-7%22 fill=%22none%22 stroke=%22%230a0a0a%22 stroke-width=%222%22/></svg>')] aria-[invalid=true]:border-red-400/70"
      />
      <span>
        {children}
        {error && <span className="mt-1 block text-xs text-red-300">{error}</span>}
      </span>
    </label>
  );
}

function focusFirstError() {
  requestAnimationFrame(() => document.querySelector<HTMLElement>("form [aria-invalid=true]")?.focus());
}

async function postJson<R>(url: string, body: unknown): Promise<R> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as R | null;
  if (!json) throw new FormFail("server");
  return json;
}

class FormFail extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
