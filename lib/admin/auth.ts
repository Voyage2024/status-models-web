import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { hasSupabase } from "@/lib/env";
import type { Locale } from "@/lib/i18n/config";
import { href } from "@/lib/i18n/paths";
import { createServerSupabase } from "@/lib/supabase/server";

export type StaffRole = "owner" | "booker" | "scout";
export type Staff = { id: string; email: string; role: StaffRole; fullName: string };

/**
 * Сотрудник = пользователь Supabase Auth со строкой в staff (is_active).
 * user без staff — вошёл, но доступа нет. Роль читаем с его же JWT: политика staff_self_or_owner.
 */
export const getSession = cache(async () => {
  if (!hasSupabase()) return null;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("staff").select("role, full_name, is_active").eq("id", user.id).maybeSingle();
  const staff: Staff | null =
    data && data.is_active ? { id: user.id, email: user.email ?? "", role: data.role as StaffRole, fullName: data.full_name } : null;
  return { supabase, user, staff };
});

/** Для страниц админки: без сотрудника — на вход. */
export async function requireStaff(locale: Locale) {
  const session = await getSession();
  if (!session?.staff) redirect(href(locale, "/admin/login"));
  return { supabase: session.supabase, staff: session.staff };
}

/**
 * Какие модели сотрудник может править (те же правила, что в RLS):
 * owner — все, booker — представленные в его офисах, scout — никакие.
 */
export async function editableModels(staff: Staff, supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  if (staff.role === "owner") return "all" as const;
  if (staff.role === "scout") return new Set<string>();
  const { data: offices } = await supabase.from("staff_offices").select("office_id").eq("staff_id", staff.id);
  const ids = (offices ?? []).map((o) => o.office_id as string);
  if (!ids.length) return new Set<string>();
  const { data } = await supabase.from("model_representations").select("model_id").in("office_id", ids);
  return new Set((data ?? []).map((r) => r.model_id as string));
}

export const canEdit = (editable: "all" | Set<string>, modelId: string) => editable === "all" || editable.has(modelId);
