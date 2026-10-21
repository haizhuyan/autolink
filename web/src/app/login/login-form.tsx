"use client";

import { useActionState } from "react";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { login } from "@/app/actions/auth";
import { btnPrimary } from "@/components/button-styles";

const inputClass =
  "mt-1.5 block w-full rounded-md border border-line-strong bg-card px-3 py-2.5 text-sm text-fg placeholder:text-muted/70 transition-colors duration-200 focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent aria-invalid:border-danger";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const emailError = state?.errors?.email?.[0];
  const passwordError = state?.errors?.password?.[0];

  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      {state?.message && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-danger/50 bg-danger/10 px-3 py-2.5 text-sm text-danger-text"
        >
          <WarningCircle size={18} weight="bold" aria-hidden />
          {state.message}
        </div>
      )}

      <div>
        <label htmlFor="email" className="text-sm font-medium">
          邮箱
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state?.email}
          placeholder="you@example.com"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "email-error" : undefined}
          className={inputClass}
        />
        {emailError && (
          <p id="email-error" className="mt-1.5 text-sm text-danger-text">
            {emailError}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium">
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? "password-error" : undefined}
          className={inputClass}
        />
        {passwordError && (
          <p id="password-error" className="mt-1.5 text-sm text-danger-text">
            {passwordError}
          </p>
        )}
      </div>

      <button type="submit" disabled={pending} className={`${btnPrimary} w-full py-2.5`}>
        {pending && <CircleNotch size={18} weight="bold" className="animate-spin" aria-hidden />}
        {pending ? "登录中…" : "登录"}
      </button>
    </form>
  );
}
