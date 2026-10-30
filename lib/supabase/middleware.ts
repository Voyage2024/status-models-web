import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Продлевает сессию сотрудника на запросах к /[locale]/admin: обновлённые токены
 * кладутся и в запрос (их увидит страница), и в ответ (их сохранит браузер).
 */
export async function refreshStaffSession(req: NextRequest): Promise<NextResponse> {
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return res;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers ?? {})) res.headers.set(name, value);
      },
    },
  });
  await supabase.auth.getUser();
  return res;
}
