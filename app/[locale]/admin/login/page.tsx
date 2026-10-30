import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { getSession } from "@/lib/admin/auth";
import { adminCopy } from "@/lib/admin/copy";
import { hasSupabase } from "@/lib/env";
import { href } from "@/lib/i18n/paths";
import { localeFrom } from "@/lib/i18n/params";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await localeFrom(params);
  const t = adminCopy(locale);
  const session = await getSession();
  if (session?.staff) redirect(href(locale, "/admin"));

  // Вошёл, но строки в staff нет или is_active = false.
  const initialError = !hasSupabase() ? "notConfigured" : session?.user ? "noAccess" : null;
  return (
    <main className="container-luxe pt-12">
      <h1 className="display text-[clamp(3rem,8vw,7rem)] uppercase">{t.login.title}</h1>
      <LoginForm locale={locale} t={t.login} initialError={initialError} />
    </main>
  );
}
