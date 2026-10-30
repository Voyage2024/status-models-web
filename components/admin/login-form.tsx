"use client";

import { useActionState } from "react";
import { signIn } from "@/lib/admin/actions";
import type { AdminCopy } from "@/lib/admin/copy";
import type { Locale } from "@/lib/i18n/config";
import { Button, Input, Label } from "./ui";

export function LoginForm({ locale, t, initialError }: { locale: Locale; t: AdminCopy["login"]; initialError: string | null }) {
  const [state, action, pending] = useActionState(signIn, { error: initialError });
  const message = state.error ? (t[state.error as keyof typeof t] ?? t.invalid) : null;
  return (
    <form action={action} className="mt-10 grid max-w-sm gap-5">
      <input type="hidden" name="locale" value={locale} />
      <Label label={t.email}>
        <Input name="email" type="email" autoComplete="username" required />
      </Label>
      <Label label={t.password}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Label>
      {message && (
        <p role="alert" className="text-sm text-red-300">
          {message}
        </p>
      )}
      <Button disabled={pending} className="justify-self-start">
        {t.submit}
      </Button>
    </form>
  );
}
