import { redirect } from "next/navigation";
import { AdminBar } from "@/components/admin/admin-bar";
import { ModelForm } from "@/components/admin/model-form";
import { requireStaff } from "@/lib/admin/auth";
import { adminCopy } from "@/lib/admin/copy";
import { href } from "@/lib/i18n/paths";
import { localeFrom } from "@/lib/i18n/params";

export const dynamic = "force-dynamic";

export default async function NewModelPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await localeFrom(params);
  const t = adminCopy(locale);
  const { staff } = await requireStaff(locale);
  // Заводить модели может только Owner (RLS models_owner_all).
  if (staff.role !== "owner") redirect(href(locale, "/admin"));

  return (
    <>
      <AdminBar locale={locale} staff={staff} t={t} />
      <main className="container-luxe mt-10 max-w-5xl">
        <h1 className="display mb-8 text-6xl uppercase">{t.form.newTitle}</h1>
        <ModelForm locale={locale} t={t} model={null} editable />
        <p className="mt-6 text-xs text-mist">{t.media.saveFirst}</p>
      </main>
    </>
  );
}
