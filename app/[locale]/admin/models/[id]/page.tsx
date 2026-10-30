import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminBar } from "@/components/admin/admin-bar";
import { MeasurementsForm } from "@/components/admin/measurements-form";
import { MediaManager } from "@/components/admin/media-manager";
import { ModelForm } from "@/components/admin/model-form";
import { OfficesForm } from "@/components/admin/offices-form";
import { StatusBadge } from "@/components/admin/ui";
import { canEdit, editableModels, requireStaff } from "@/lib/admin/auth";
import { colorOptions } from "@/lib/admin/colors";
import { adminCopy } from "@/lib/admin/copy";
import { getAdminModel, listOffices } from "@/lib/admin/data";
import { href } from "@/lib/i18n/paths";
import { localeFrom } from "@/lib/i18n/params";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditModelPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const locale = await localeFrom(params);
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const t = adminCopy(locale);
  const { supabase, staff } = await requireStaff(locale);

  const [model, editable, offices] = await Promise.all([
    getAdminModel(supabase, id),
    editableModels(staff, supabase),
    staff.role === "owner" ? listOffices(supabase) : Promise.resolve([]),
  ]);
  if (!model) notFound();
  const mayEdit = canEdit(editable, model.id);
  const colors = colorOptions(locale);
  const name = [model.firstName, model.lastName].filter(Boolean).join(" ");

  return (
    <>
      <AdminBar locale={locale} staff={staff} t={t} />
      <main className="container-luxe mt-10 max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-mist">
              {model.code} · <StatusBadge status={model.status} label={t.status[model.status]} />
            </p>
            <h1 className="display mt-3 text-6xl uppercase md:text-7xl">{name}</h1>
          </div>
          {model.status === "published" && (
            <div className="flex gap-5 text-xs tracking-[0.14em] uppercase">
              <Link href={href(locale, `/models/${model.slug}`)} target="_blank" className="text-mist hover:text-champagne">
                {t.form.viewOnSite} ↗
              </Link>
              <a href={href(locale, `/models/${model.slug}/comp-card`)} target="_blank" rel="noreferrer" className="text-mist hover:text-champagne">
                {t.form.compCard} ↗
              </a>
            </div>
          )}
        </div>
        {!mayEdit && <p className="mb-6 border border-line p-3 text-sm text-mist">{t.form.readOnly}</p>}

        <div className="grid gap-6">
          <ModelForm key={model.id} locale={locale} t={t} model={model} editable={mayEdit} />
          <MeasurementsForm
            key={`m-${model.measurements[0]?.measuredAt ?? "none"}`}
            modelId={model.id}
            t={t}
            history={model.measurements}
            hairOptions={colors.hair}
            eyeOptions={colors.eyes}
            editable={mayEdit}
          />
          <MediaManager modelId={model.id} t={t} media={model.media} editable={mayEdit} />
          {staff.role === "owner" && <OfficesForm modelId={model.id} t={t} offices={offices} selected={model.officeIds} editable />}
        </div>
      </main>
    </>
  );
}
