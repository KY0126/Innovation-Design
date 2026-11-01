"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { validateEmail, validatePassword } from "@/lib/shared/auth-validation";

export type AuthMode = "signin" | "signup";

export function AuthForm({
  mode,
  onModeChange,
  onSubmit,
  onGoogle,
  error,
  submitting,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (email: string, password: string) => void;
  onGoogle: () => void;
  error?: string | null;
  submitting: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string | null; password?: string | null }>({});

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next = { email: validateEmail(email), password: validatePassword(password) };
    setFieldErrors(next);
    if (!next.email && !next.password) onSubmit(email, password);
  }

  const isSignup = mode === "signup";

  return (
    <Card className="mx-auto w-full max-w-md">
      <div className="mb-6 grid grid-cols-2 rounded-lg bg-muted p-1" role="tablist" aria-label="登入或註冊">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => onModeChange(m)}
            className={`min-h-11 rounded-md text-base font-semibold ${mode === m ? "bg-card shadow-sm" : "text-muted-foreground"}`}
          >
            {m === "signin" ? "登入" : "註冊"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Field id="email" label="Email" error={fieldErrors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
          />
        </Field>
        <Field id="password" label="密碼" error={fieldErrors.password} hint={isSignup ? "至少 6 碼" : undefined}>
          <Input
            id="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
          />
        </Field>

        {error && <Notice tone="error">{error}</Notice>}

        <Button type="submit" disabled={submitting}>
          {submitting ? "處理中…" : isSignup ? "註冊" : "登入"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />或<span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" className="w-full" onClick={onGoogle} disabled={submitting}>
        使用 Google 帳號{isSignup ? "註冊" : "登入"}
      </Button>
    </Card>
  );
}
