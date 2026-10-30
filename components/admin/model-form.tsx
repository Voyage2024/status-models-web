"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { saveModel } from "@/lib/admin/actions";
import type { AdminCopy } from "@/lib/admin/copy";
import type { AdminModel } from "@/lib/admin/data";
import { MODEL_CATEGORIES, MODEL_STATUSES, type FieldErrors, type TranslationInput } from "@/lib/admin/schema";
import { localeLabels, locales, type Locale } from "@/lib/i18n/config";
import { href } from "@/lib/i18n/paths";
import { Button, Check, Input, Label, Panel, SaveNote, Select, Textarea } from "./ui";

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y",
  ь: "", э: "e", ю: "iu", я: "ia",
};

/** «Кира Рааб» / «Kira Raab» → kira-raab. */
export function slugify(...parts: string[]) {
  return parts
    .join(" ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[а-яё]/g, (ch) => TRANSLIT[ch] ?? "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const emptyTranslation = (locale: Locale): TranslationInput => ({
  locale,
  displayName: "",
  bio: "",
  seoTitle: "",
  seoDescription: "",
  isReviewed: false,
});

export function ModelForm({
  locale,
  t,
  model,
  editable,
}: {
  locale: Locale;
  t: AdminCopy;
  model: AdminModel | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<FieldErrors>({});

  const [firstName, setFirstName] = useState(model?.firstName ?? "");
  const [lastName, setLastName] = useState(model?.lastName ?? "");
  const [slug, setSlug] = useState(model?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(model));
  const [category, setCategory] = useState<AdminModel["category"]>(model?.category ?? "women");
  const [status, setStatus] = useState<AdminModel["status"]>(model?.status ?? "draft");
  const [isNewFace, setIsNewFace] = useState(model?.isNewFace ?? false);
  const [instagram, setInstagram] = useState(model?.instagram ?? "");
  const [tab, setTab] = useState<Locale>(locale);
  const [translations, setTranslations] = useState<TranslationInput[]>(() =>
    locales.map((l) => model?.translations.find((x) => x.locale === l) ?? emptyTranslation(l)),
  );

  const slugLocked = Boolean(model?.publishedAt);
  const err = (key: string) => (fields[key] ? (t.errors[fields[key] as keyof AdminCopy["errors"]] ?? t.errors.invalid) : undefined);
  const trIndex = locales.indexOf(tab);
  const tr = translations[trIndex];

  const setTr = (patch: Partial<TranslationInput>) =>
    setTranslations((all) => all.map((x, i) => (i === trIndex ? { ...x, ...patch } : x)));

  const fillNames = () => {
    const name = [firstName, lastName].filter(Boolean).join(" ").trim();
    if (name) setTranslations((all) => all.map((x) => (x.displayName ? x : { ...x, displayName: name })));
  };

  const onName = (first: string, last: string) => {
    setFirstName(first);
    setLastName(last);
    if (!slugTouched) setSlug(slugify(first, last));
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    setState("saving");
    setFields({});
    start(async () => {
      const res = await saveModel({
        id: model?.id ?? null,
        firstName,
        lastName,
        slug,
        category,
        status,
        isNewFace,
        instagram,
        translations,
      });
      if (!res.ok) {
        setState("error");
        setFields(res.fields ?? {});
        setError(t.errors[res.error as keyof AdminCopy["errors"]] ?? t.errors.server);
        // Ошибка в переводе: показываем вкладку с ней.
        const bad = Object.keys(res.fields ?? {}).find((k) => k.startsWith("translations."));
        if (bad) setTab(locales[Number(bad.split(".")[1])] ?? tab);
        return;
      }
      setState("saved");
      if (!model) router.push(href(locale, `/admin/models/${res.id}`));
      else router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <fieldset disabled={!editable} className="grid gap-6">
        <Panel title={t.form.basics}>
          <div className="grid gap-5 md:grid-cols-2">
            <Label label={t.form.firstName} error={err("firstName")}>
              <Input value={firstName} onChange={(e) => onName(e.target.value, lastName)} required maxLength={80} invalid={!!fields.firstName} />
            </Label>
            <Label label={t.form.lastName} error={err("lastName")}>
              <Input value={lastName} onChange={(e) => onName(firstName, e.target.value)} maxLength={80} />
            </Label>
            <Label label={t.form.slug} error={err("slug")} hint={slugLocked ? t.form.slugLocked : t.form.slugHint}>
              <Input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                readOnly={slugLocked}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={80}
                invalid={!!fields.slug}
                className="font-mono"
              />
            </Label>
            <Label label={t.form.code}>
              <Input value={model?.code ?? t.form.codeAuto} readOnly disabled className="font-mono" />
            </Label>
            <Label label={t.form.category}>
              <Select value={category} onChange={(e) => setCategory(e.target.value as AdminModel["category"])}>
                {MODEL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t.categories[c]}
                  </option>
                ))}
              </Select>
            </Label>
            <Label label={t.form.status}>
              <Select value={status} onChange={(e) => setStatus(e.target.value as AdminModel["status"])}>
                {MODEL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t.status[s]}
                  </option>
                ))}
              </Select>
            </Label>
            <Label label={t.form.instagram} error={err("instagram")}>
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle" maxLength={200} invalid={!!fields.instagram} />
            </Label>
            <div className="flex items-end pb-2">
              <Check label={t.form.isNewFace} checked={isNewFace} onChange={(e) => setIsNewFace(e.target.checked)} />
            </div>
          </div>
        </Panel>

        <Panel
          title={t.form.translations}
          aside={
            <button type="button" onClick={fillNames} className="text-xs text-mist underline-offset-4 hover:text-champagne hover:underline">
              {t.form.fillFromName}
            </button>
          }
        >
          <p className="-mt-2 mb-5 text-xs text-mist">{t.form.trHint}</p>
          <div role="tablist" className="mb-5 flex flex-wrap gap-1 border-b border-line">
            {locales.map((l, i) => {
              const x = translations[i];
              const bad = Object.keys(fields).some((k) => k.startsWith(`translations.${i}.`));
              return (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  aria-selected={tab === l}
                  onClick={() => setTab(l)}
                  className={`-mb-px border-b px-3 py-2 text-xs tracking-[0.12em] uppercase ${
                    tab === l ? "border-champagne text-bone" : "border-transparent text-mist hover:text-bone"
                  } ${bad ? "text-red-300" : ""}`}
                >
                  {l}
                  <span className={`ml-1.5 inline-block size-1.5 rounded-full ${x.displayName ? (x.isReviewed ? "bg-champagne" : "bg-bone/40") : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>
          <div className="grid gap-5" lang={tab}>
            <Label label={`${t.form.displayName} · ${localeLabels[tab]}`} error={err(`translations.${trIndex}.displayName`)}>
              <Input value={tr.displayName} onChange={(e) => setTr({ displayName: e.target.value })} maxLength={120} />
            </Label>
            <Label label={t.form.bio} error={err(`translations.${trIndex}.bio`)}>
              <Textarea value={tr.bio} onChange={(e) => setTr({ bio: e.target.value })} maxLength={4000} rows={5} />
            </Label>
            <div className="grid gap-5 md:grid-cols-2">
              <Label label={t.form.seoTitle} hint={`${tr.seoTitle.length}/120`}>
                <Input value={tr.seoTitle} onChange={(e) => setTr({ seoTitle: e.target.value })} maxLength={120} />
              </Label>
              <Label label={t.form.seoDescription} hint={`${tr.seoDescription.length}/320`}>
                <Input value={tr.seoDescription} onChange={(e) => setTr({ seoDescription: e.target.value })} maxLength={320} />
              </Label>
            </div>
            <Check label={t.form.isReviewed} checked={tr.isReviewed} onChange={(e) => setTr({ isReviewed: e.target.checked })} />
          </div>
        </Panel>
      </fieldset>

      {editable && (
        <div className="flex flex-wrap items-center gap-4">
          <Button disabled={pending}>{pending ? t.form.saving : model ? t.form.save : t.form.create}</Button>
          <SaveNote state={state} saved={t.form.saved} error={error} />
        </div>
      )}
    </form>
  );
}
