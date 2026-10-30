import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/env";

/**
 * Клиент от имени вошедшего сотрудника (сессия Supabase Auth в cookies).
 * Права дают RLS-политики из 0001: owner / booker / scout. Только для админки.
 */
export async function createServerSupabase() {
  const store = await cookies();
  return createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server Component не может писать cookies: токен обновит middleware на следующем запросе.
        }
      },
    },
  });
}
