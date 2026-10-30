"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ButtonHTMLAttributes } from "react";
import { deleteMedia, prepareMediaUpload, registerMedia, reorderMedia, updateMedia } from "@/lib/admin/actions";
import { fill, type AdminCopy } from "@/lib/admin/copy";
import type { AdminMedia } from "@/lib/admin/data";
import { MEDIA_BUCKET, MEDIA_EXT, MEDIA_MAX_BYTES, PHOTO_KINDS, type MediaMime, type PhotoKind } from "@/lib/admin/schema";
import { uploadToSignedUrl } from "@/lib/scouting/upload";
import { Button, Check, Panel, Select } from "./ui";

async function dimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: null, height: null }; // формат, который браузер не декодирует (бывает с AVIF)
  }
}

export function MediaManager({ modelId, t, media, editable }: { modelId: string; t: AdminCopy; media: AdminMedia[]; editable: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState(media);
  const [kind, setKind] = useState<PhotoKind>(media.some((m) => m.kind === "cover") ? "portfolio" : "cover");
  const [progress, setProgress] = useState<{ n: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [, start] = useTransition();
  const m = t.media;

  useEffect(() => setItems(media), [media]);

  const failMessage = (code: string) => t.errors[code as keyof AdminCopy["errors"]] ?? t.errors.server;
  const refresh = () => start(() => router.refresh());

  async function upload(list: FileList | File[]) {
    const files = Array.from(list);
    const problems: string[] = [];
    const ok = files.filter((f) => {
      if (!(f.type in MEDIA_EXT)) problems.push(fill(t.errors.fileType, { name: f.name }));
      else if (f.size > MEDIA_MAX_BYTES) problems.push(fill(t.errors.fileSize, { name: f.name }));
      else return true;
      return false;
    });
    setErrors(problems);
    if (!ok.length) return;

    setProgress({ n: 0, total: ok.length });
    const prepared = await prepareMediaUpload({ modelId, files: ok.map((f) => ({ mime: f.type as MediaMime, size: f.size })) });
    if (!prepared.ok) {
      setProgress(null);
      setErrors((e) => [...e, failMessage(prepared.error)]);
      return;
    }

    const done: Array<{ path: string; width: number | null; height: number | null }> = [];
    for (const [i, file] of ok.entries()) {
      setProgress({ n: i + 1, total: ok.length });
      const { path, token } = prepared.uploads[i];
      try {
        const [size] = await Promise.all([dimensions(file), uploadToSignedUrl(MEDIA_BUCKET, path, token, file)]);
        done.push({ path, ...size });
      } catch {
        setErrors((e) => [...e, fill(t.errors.upload, { name: file.name })]);
      }
    }
    if (done.length) {
      const res = await registerMedia({ modelId, kind, items: done });
      if (!res.ok) setErrors((e) => [...e, failMessage(res.error)]);
      if (kind === "cover") setKind("portfolio");
    }
    setProgress(null);
    if (input.current) input.current.value = "";
    refresh();
  }

  async function patch(id: string, change: Partial<AdminMedia>) {
    const before = items;
    const next = items.map((x) => (x.id === id ? { ...x, ...change } : x));
    setItems(next);
    const item = next.find((x) => x.id === id)!;
    const res = await updateMedia({
      id,
      modelId,
      kind: item.kind,
      alt: item.alt,
      credits: item.credits,
      isPublic: item.isPublic,
      inCompCard: item.inCompCard,
    });
    if (!res.ok) {
      setItems(before);
      setErrors([failMessage(res.error)]);
    } else refresh();
  }

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const before = items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    const res = await reorderMedia({ modelId, ids: next.map((x) => x.id) });
    if (!res.ok) {
      setItems(before);
      setErrors([failMessage(res.error)]);
    } else refresh();
  }

  async function remove(id: string) {
    setConfirming(null);
    const before = items;
    setItems(items.filter((x) => x.id !== id));
    const res = await deleteMedia({ id, modelId });
    if (!res.ok) {
      setItems(before);
      setErrors([failMessage(res.error)]);
    } else refresh();
  }

  const busy = progress !== null;

  return (
    <Panel title={m.title} aside={<span className="text-xs text-mist">{items.length}</span>}>
      {editable && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy && e.dataTransfer.files.length) void upload(e.dataTransfer.files);
          }}
          className={`mb-6 flex flex-wrap items-center gap-4 border border-dashed p-4 transition-colors ${
            dragging ? "border-champagne bg-champagne/5" : "border-white/20"
          }`}
        >
          <label className="text-xs text-mist">
            {m.uploadAs}
            <Select value={kind} onChange={(e) => setKind(e.target.value as PhotoKind)} className="w-40" disabled={busy}>
              {PHOTO_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t.kinds[k]}
                </option>
              ))}
            </Select>
          </label>
          <input
            ref={input}
            type="file"
            accept={Object.keys(MEDIA_EXT).join(",")}
            multiple
            hidden
            onChange={(e) => e.target.files?.length && void upload(e.target.files)}
          />
          <Button type="button" variant="ghost" disabled={busy} onClick={() => input.current?.click()} className="self-end">
            {busy ? fill(m.uploading, { n: progress.n, total: progress.total }) : m.choose}
          </Button>
          <span className="self-end pb-2 text-xs text-mist">{m.drop}</span>
        </div>
      )}

      {errors.length > 0 && (
        <ul role="alert" className="mb-5 space-y-1 text-xs text-red-300">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-mist">{m.empty}</p>
      ) : (
        <>
          <p className="mb-4 text-xs text-mist">{m.hint}</p>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {items.map((x, i) => (
              <li key={x.id} className="flex flex-col border border-line bg-graphite">
                <div className="relative aspect-[3/4] overflow-hidden bg-graphite-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- превью в админке, без оптимизатора */}
                  <img src={x.src} alt={x.alt} loading="lazy" className={`h-full w-full object-cover ${x.isPublic ? "" : "opacity-40"}`} />
                  <span className="absolute left-2 top-2 bg-ink/80 px-1.5 py-0.5 text-[0.65rem] text-bone">
                    {i + 1}
                    {x.width && x.height ? ` · ${x.width}×${x.height}` : ""}
                  </span>
                </div>
                <fieldset disabled={!editable} className="grid gap-2 p-3 text-xs">
                  <Select value={x.kind} onChange={(e) => void patch(x.id, { kind: e.target.value as PhotoKind })} className="mt-0 py-1.5 text-xs">
                    {PHOTO_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t.kinds[k]}
                      </option>
                    ))}
                  </Select>
                  <BlurInput placeholder={m.alt} value={x.alt} onCommit={(alt) => void patch(x.id, { alt })} />
                  <BlurInput placeholder={m.credits} value={x.credits} onCommit={(credits) => void patch(x.id, { credits })} />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    <Check label={m.isPublic} checked={x.isPublic} onChange={(e) => void patch(x.id, { isPublic: e.target.checked })} />
                    <Check label={m.inCompCard} checked={x.inCompCard} onChange={(e) => void patch(x.id, { inCompCard: e.target.checked })} />
                  </div>
                  {editable && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="flex gap-1">
                        <IconButton label={m.moveLeft} disabled={i === 0} onClick={() => void move(i, -1)}>
                          ←
                        </IconButton>
                        <IconButton label={m.moveRight} disabled={i === items.length - 1} onClick={() => void move(i, 1)}>
                          →
                        </IconButton>
                      </span>
                      {confirming === x.id ? (
                        <span className="flex gap-2">
                          <button type="button" onClick={() => void remove(x.id)} className="text-red-300 hover:text-red-200">
                            {m.confirmDelete}
                          </button>
                          <button type="button" onClick={() => setConfirming(null)} className="text-mist hover:text-bone">
                            ✕
                          </button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirming(x.id)} className="text-mist hover:text-red-300">
                          {m.delete}
                        </button>
                      )}
                    </div>
                  )}
                </fieldset>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function IconButton({ label, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className="border border-line px-2 py-0.5 text-bone hover:border-champagne disabled:opacity-30">
      {children}
    </button>
  );
}

/** Текстовое поле, которое сохраняет значение при уходе фокуса, а не на каждую букву. */
function BlurInput({ value, placeholder, onCommit }: { value: string; placeholder: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      value={draft}
      placeholder={placeholder}
      maxLength={200}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() !== value && onCommit(draft.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      className="w-full border border-line bg-ink/40 px-2 py-1.5 text-bone placeholder:text-mist/50 focus:border-champagne focus:outline-none"
    />
  );
}
