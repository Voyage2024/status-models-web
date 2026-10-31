"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "./auth";
import { APPLICATION_STATUSES } from "./scouting";

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(APPLICATION_STATUSES),
  note: z.string().trim().max(2000).optional(),
  take: z.literal("1").optional(),
});

/**
 * Статус, комментарий и «взять в работу» одной формой. Права проверяет RLS (0001 + 0005):
 * Owner — любая заявка, Scout/Booker — свои и неназначенные в своих офисах. Пустой ответ update = нет прав.
 */
export async function updateApplication(form: FormData) {
  const session = await getSession();
  if (!session?.staff) return;
  const parsed = updateSchema.safeParse({
    id: form.get("id"),
    status: form.get("status"),
    note: form.get("note") || undefined,
    take: form.get("take") || undefined,
  });
  if (!parsed.success) return;
  const { id, status, note, take } = parsed.data;
  const { supabase, staff } = session;

  const { data: current } = await supabase.from("scouting_applications").select("status, assigned_to").eq("id", id).maybeSingle();
  if (!current) return;

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (take && !current.assigned_to) {
    patch.assigned_to = staff.id;
    if (status === "pending") patch.status = "in_review";
  }
  const { data: updated, error } = await supabase.from("scouting_applications").update(patch).eq("id", id).select("status");
  if (error || !updated?.length) {
    console.error("admin.updateApplication", error?.message ?? "no rows (RLS)");
    return;
  }

  const to = updated[0].status as string;
  if (to !== current.status || note || patch.assigned_to) {
    const { error: eventError } = await supabase.from("application_events").insert({
      application_id: id,
      actor_id: staff.id,
      from_status: to !== current.status ? current.status : null,
      to_status: to !== current.status ? to : null,
      note: note ?? (patch.assigned_to ? "Взято в работу" : null),
    });
    if (eventError) console.error("admin.updateApplication.event", eventError.message);
  }
  revalidatePath("/[locale]/admin/scouting", "page");
  revalidatePath("/[locale]/admin/scouting/[id]", "page");
}
