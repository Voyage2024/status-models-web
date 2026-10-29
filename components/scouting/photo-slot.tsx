"use client";

import { useEffect, useId, useRef, useState } from "react";

export function PhotoSlot({
  label,
  hint,
  required,
  file,
  error,
  t,
  onSelect,
  onRemove,
}: {
  label: string;
  hint: string;
  required: boolean;
  file: File | null;
  error?: string;
  t: { add: string; replace: string; remove: string; optional: string };
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      <label
        htmlFor={id}
        className={`group relative flex aspect-[3/4] cursor-pointer flex-col justify-end overflow-hidden border transition-colors duration-300 ${
          error ? "border-red-400/70" : file ? "border-line" : "border-dashed border-white/20 hover:border-champagne/70"
        } bg-graphite`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- локальный blob, next/image тут не нужен
          <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="display text-5xl text-white/10 transition-colors group-hover:text-champagne/40">+</span>
          </span>
        )}
        <span className="relative bg-gradient-to-t from-ink/95 via-ink/70 to-transparent p-3 pt-10">
          <span className="eyebrow block tracking-[0.2em] text-bone">
            {label}
            {!required && <span className="mt-1 block text-mist normal-case tracking-normal">({t.optional})</span>}
          </span>
          <span className="mt-1 block text-xs text-mist">{hint}</span>
        </span>
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
          e.target.value = "";
        }}
      />
      <div className="mt-2 flex min-h-5 items-center justify-between gap-2 text-xs">
        {error ? (
          <span className="text-red-300">{error}</span>
        ) : file ? (
          <button type="button" className="text-mist hover:text-bone" onClick={() => input.current?.click()}>
            {t.replace}
          </button>
        ) : (
          <span className="text-mist">{t.add}</span>
        )}
        {file && (
          <button type="button" className="text-mist hover:text-red-300" onClick={onRemove}>
            {t.remove}
          </button>
        )}
      </div>
    </div>
  );
}
