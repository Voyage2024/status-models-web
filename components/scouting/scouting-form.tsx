"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { href } from "@/lib/i18n/paths";
import { prepareUploads, submitApplication } from "@/lib/scouting/actions";
import { compressPhoto } from "@/lib/scouting/image";
import { uploadToSignedUrl } from "@/lib/scouting/upload";
import {
  ADULT_AGE,
  ageOn,
  ALLOWED_MIME,
  MAX_PHOTO_BYTES,
  PHOTO_KINDS,
  REQUIRED_PHOTOS,
  type FieldErrors,
  type PhotoKind,
} from "@/lib/scouting/schema";
import { Field, inputClass, TextInput } from "./field";
import { PhotoSlot } from "./photo-slot";

type T = Dictionary["scouting"];
type Status = "idle" | "uploading" | "submitting";

export function ScoutingForm({
  locale,
  t,
  offices,
  initialMode,
  landingPath,
  utm,
}: {
  locale: Locale;
  t: T;
  offices: Array<{ slug: string; name: string }>;
  initialMode: "website" | "scout";
  landingPath: string;
  utm: Record<string, string>;
}) {
  const [mode, setMode] = useState(initialMode);
  const [photos, setPhotos] = useState<Partial<Record<PhotoKind, File>>>({});
  const [birthDate, setBirthDate] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [done, setDone] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  // id заявки переживает повторную попытку после ошибки, чтобы не плодить папки в Storage
  const prepared = useRef<{ applicationId: string; uploaded: Set<PhotoKind> } | null>(null);

  const err = (key: string) => {
    const code = errors[key];
    return code ? (t.errors[code as keyof T["errors"]] ?? t.errors.generic) : undefined;
  };
  const isMinor = birthDate.length === 10 && ageOn(birthDate) < ADULT_AGE;
  const scout = mode === "scout";

  const slots: Array<{ kind: PhotoKind; label: string; hint: string }> = [
    { kind: "portrait", label: t.photoPortrait, hint: t.photoPortraitHint },
    { kind: "profile", label: t.photoProfile, hint: t.photoProfileHint },
    { kind: "full_length", label: t.photoFull, hint: t.photoFullHint },
    { kind: "other", label: t.photoOther, hint: t.photoOtherHint },
  ];

  function selectPhoto(kind: PhotoKind, file: File) {
    let code: string | undefined;
    if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) code = "fileType";
    else if (file.size > MAX_PHOTO_BYTES) code = "fileSize";
    setErrors((e) => ({ ...e, [`photo_${kind}`]: code }));
    if (code) return;
    setPhotos((p) => ({ ...p, [kind]: file }));
    prepared.current?.uploaded.delete(kind);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status !== "idle") return;
    setFormError(null);
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");

    const missing = REQUIRED_PHOTOS.filter((k) => !photos[k]);
    if (missing.length) {
      setErrors((x) => ({ ...x, ...Object.fromEntries(missing.map((k) => [`photo_${k}`, "required"])) }));
      setFormError(t.errors.photos);
      return;
    }

    try {
      setStatus("uploading");
      const kinds = PHOTO_KINDS.filter((k) => photos[k]);
      const blobs = await Promise.all(kinds.map((k) => compressPhoto(photos[k]!)));

      if (!prepared.current || kinds.some((k) => !prepared.current!.uploaded.has(k))) {
        const res = await prepareUploads({
          photos: kinds.map((kind, i) => ({ kind, mime: blobs[i].type || "image/jpeg", size: blobs[i].size })),
          website: text("website"),
        });
        if (!res.ok) throw new FormFail(res.error);
        prepared.current = { applicationId: res.applicationId, uploaded: new Set() };
        await Promise.all(
          res.uploads.map(async (u) => {
            const blob = blobs[kinds.indexOf(u.kind)];
            await uploadToSignedUrl("scouting", u.path, u.token, blob).catch(() => {
              throw new FormFail("upload");
            });
            prepared.current!.uploaded.add(u.kind);
          }),
        );
      }

      setStatus("submitting");
      const res = await submitApplication({
        applicationId: prepared.current.applicationId,
        fullName: text("fullName"),
        email: text("email"),
        phone: text("phone"),
        instagram: text("instagram"),
        birthDate: text("birthDate"),
        heightCm: text("heightCm"),
        country: text("country"),
        city: text("city"),
        market: text("market"),
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
        if (res.fields) setErrors(res.fields);
        throw new FormFail(res.error === "fields" ? "generic" : res.error);
      }
      setDone(res.ref);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (x) {
      const code = x instanceof FormFail ? x.code : "server";
      setFormError(code === "generic" ? null : (t.errors[code as keyof T["errors"]] ?? t.errors.server));
      if (code === "photos") prepared.current = null;
    } finally {
      setStatus("idle");
    }
  }

  if (done) {
    return (
      <div className="border-t border-line pt-12">
        <h2 className="display text-[clamp(3rem,7vw,6rem)] italic text-champagne">{t.successTitle}</h2>
        <p className="mt-6 max-w-md leading-relaxed text-mist">{t.successText}</p>
        <p className="eyebrow mt-10 text-mist">{t.successRef}</p>
        <p className="display mt-3 text-4xl tabular-nums">{done}</p>
        <Link href={href(locale)} className="eyebrow mt-12 inline-block text-bone hover:text-champagne">
          ← {t.successBack}
        </Link>
      </div>
    );
  }

  const busy = status !== "idle";
  const section = (n: string, title: string) => (
    <legend className="mb-8 flex w-full items-baseline gap-4 border-t border-line pt-6">
      <span className="eyebrow text-champagne">{n}</span>
      <span className="display text-3xl md:text-4xl">{title}</span>
    </legend>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-16">
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
          <Field label={t.fullName} error={err("fullName")}>
            <TextInput name="fullName" autoComplete={scout ? "off" : "name"} required invalid={!!errors.fullName} />
          </Field>
          <Field label={t.email} error={err("email")}>
            <TextInput name="email" type="email" inputMode="email" autoComplete={scout ? "off" : "email"} required invalid={!!errors.email} />
          </Field>
          <Field label={t.phone} optional={t.optional}>
            <TextInput name="phone" type="tel" inputMode="tel" autoComplete={scout ? "off" : "tel"} />
          </Field>
          <Field label={t.instagram} optional={t.optional}>
            <TextInput name="instagram" placeholder="@" autoCapitalize="none" />
          </Field>
          <Field label={t.country} error={err("country")}>
            <TextInput name="country" autoComplete={scout ? "off" : "country-name"} required invalid={!!errors.country} />
          </Field>
          <Field label={t.city} optional={t.optional}>
            <TextInput name="city" autoComplete={scout ? "off" : "address-level2"} />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        {section("02", t.secBody)}
        <div className="grid gap-8 md:grid-cols-3">
          <Field label={t.birthDate} error={err("birthDate")}>
            <TextInput
              name="birthDate"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              invalid={!!errors.birthDate}
            />
          </Field>
          <Field label={t.heightCm} error={err("heightCm")}>
            <TextInput name="heightCm" type="number" inputMode="numeric" min={140} max={210} required invalid={!!errors.heightCm} />
          </Field>
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
        {section("03", t.secPhotos)}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {slots.map((s) => (
            <PhotoSlot
              key={s.kind}
              label={s.label}
              hint={s.hint}
              required={REQUIRED_PHOTOS.includes(s.kind)}
              file={photos[s.kind] ?? null}
              error={err(`photo_${s.kind}`)}
              t={{ add: t.add, replace: t.replace, remove: t.remove, optional: t.optional }}
              onSelect={(f) => selectPhoto(s.kind, f)}
              onRemove={() => {
                setPhotos(({ [s.kind]: _, ...rest }) => rest);
                prepared.current?.uploaded.delete(s.kind);
              }}
            />
          ))}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-mist">{t.photosNote}</p>
      </fieldset>

      <fieldset>
        {section("04", t.secConsent)}
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

class FormFail extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
