import type { Metadata } from "next";

// Админка всегда рендерится на запросе: cookies сессии, данные под RLS сотрудника.
// Пререндер на сборке ломал деплой на Vercel без ключей Supabase.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[80dvh] pb-24 pt-24 md:pt-28">{children}</div>;
}
