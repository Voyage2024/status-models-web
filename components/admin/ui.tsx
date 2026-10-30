import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// Примитивы админки: рабочая плотность вместо журнальных отступов сайта, те же цвета и шрифты.
const control =
  "mt-1.5 block w-full rounded-none border border-line bg-graphite px-3 py-2 text-sm text-bone placeholder:text-mist/50 transition-colors focus:border-champagne focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-red-400/70 [color-scheme:dark]";

export function Label({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-mist">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-300">{error}</span> : hint && <span className="mt-1 block text-xs text-mist/80">{hint}</span>}
    </label>
  );
}

export function Input({ invalid, className = "", ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...rest} aria-invalid={invalid || undefined} className={`${control} ${className}`} />;
}

export function Select({ invalid, className = "", ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return <select {...rest} aria-invalid={invalid || undefined} className={`${control} ${className}`} />;
}

export function Textarea({ invalid, className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea {...rest} aria-invalid={invalid || undefined} className={`${control} min-h-28 ${className}`} />;
}

export function Check({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-bone has-[:disabled]:cursor-default has-[:disabled]:opacity-60">
      <input type="checkbox" {...rest} className="size-4 accent-[#c8a96a]" />
      {label}
    </label>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const look = {
    primary: "bg-champagne text-ink hover:bg-bone",
    ghost: "border border-line text-bone hover:border-champagne hover:text-champagne",
    danger: "border border-red-400/40 text-red-300 hover:border-red-300",
  }[variant];
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium tracking-[0.12em] uppercase transition-colors disabled:pointer-events-none disabled:opacity-50 ${look} ${className}`}
    />
  );
}

export function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border border-line bg-graphite/40 p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="display text-3xl">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone =
    status === "published" ? "border-champagne/50 text-champagne" : status === "archived" ? "border-line text-mist" : "border-white/25 text-bone";
  return <span className={`inline-block border px-2 py-0.5 text-[0.65rem] tracking-[0.14em] uppercase ${tone}`}>{label}</span>;
}

/** Строка результата под кнопкой сохранения. */
export function SaveNote({ state, saved, error }: { state: "idle" | "saving" | "saved" | "error"; saved: string; error?: string }) {
  if (state === "saved") return <span className="text-xs text-champagne">{saved}</span>;
  if (state === "error" && error) return <span className="text-xs text-red-300">{error}</span>;
  return null;
}
