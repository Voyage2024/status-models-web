import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label,
  error,
  optional,
  children,
}: {
  label: string;
  error?: string;
  optional?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow flex items-baseline gap-2 text-mist">
        {label}
        {optional && <span className="normal-case tracking-normal text-mist/70">({optional})</span>}
      </span>
      {children}
      {error && <span className="mt-2 block text-xs text-red-300">{error}</span>}
    </label>
  );
}

export const inputClass =
  "mt-3 block w-full rounded-none border-0 border-b border-white/20 bg-transparent px-0 py-3 text-base text-bone placeholder:text-mist/50 transition-colors focus:border-champagne focus:outline-none focus:ring-0 aria-[invalid=true]:border-red-400/70 [color-scheme:dark]";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const { invalid, className = "", ...rest } = props;
  return <input {...rest} aria-invalid={invalid || undefined} className={`${inputClass} ${className}`} />;
}
