"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveOffices } from "@/lib/admin/actions";
import type { AdminCopy } from "@/lib/admin/copy";
import { Button, Check, Panel, SaveNote } from "./ui";

export function OfficesForm({
  modelId,
  t,
  offices,
  selected,
  editable,
}: {
  modelId: string;
  t: AdminCopy;
  offices: Array<{ id: string; city: string }>;
  selected: string[];
  editable: boolean;
}) {
  const router = useRouter();
  const [ids, setIds] = useState(new Set(selected));
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const save = () =>
    start(async () => {
      setState("saving");
      const res = await saveOffices({ modelId, officeIds: [...ids] });
      setState(res.ok ? "saved" : "error");
      if (res.ok) router.refresh();
    });

  return (
    <Panel title={t.offices.title}>
      <p className="-mt-2 mb-5 text-xs text-mist">{t.offices.hint}</p>
      {offices.length === 0 ? (
        <p className="text-sm text-mist">{t.offices.none}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {offices.map((o) => (
              <Check
                key={o.id}
                label={o.city}
                disabled={!editable}
                checked={ids.has(o.id)}
                onChange={(e) =>
                  setIds((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(o.id);
                    else next.delete(o.id);
                    return next;
                  })
                }
              />
            ))}
          </div>
          {editable && (
            <div className="mt-5 flex items-center gap-4">
              <Button type="button" variant="ghost" disabled={pending} onClick={save}>
                {t.offices.save}
              </Button>
              <SaveNote state={state} saved={t.form.saved} error={t.errors.server} />
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
