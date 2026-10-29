import Link from "next/link";

// not-found не получает params; язык берём из ссылки на главную по умолчанию.
export default function NotFound() {
  return (
    <main className="container-luxe flex min-h-[80dvh] flex-col justify-end pb-24 pt-40">
      <p className="eyebrow mb-6 text-champagne">404</p>
      <h1 className="display text-[clamp(3.5rem,10vw,10rem)] uppercase">Not found</h1>
      <Link href="/" className="eyebrow mt-10 text-bone hover:text-champagne">
        ← STATUS INTERNATIONAL
      </Link>
    </main>
  );
}
