"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { SelfSignupRole } from "@/lib/shared/contracts";
import { validateDisplayName } from "@/lib/shared/auth-validation";
import { cn } from "@/lib/utils";

const OPTIONS: { role: SelfSignupRole; title: string; description: string }[] = [
  { role: "family", title: "家人", description: "幫爸媽建立長輩家、填寫居家評估、和生活顧問聯絡" },
  { role: "elder", title: "長輩", description: "用家人給的邀請碼加入長輩家，並由自己決定是否同意施工" },
];

export function RolePicker({
  defaultName,
  onSubmit,
  error,
  submitting,
}: {
  defaultName: string;
  onSubmit: (role: SelfSignupRole, displayName: string) => void;
  error?: string | null;
  submitting: boolean;
}) {
  const [role, setRole] = useState<SelfSignupRole | null>(null);
  const [name, setName] = useState(defaultName);
  const [errors, setErrors] = useState<{ role?: string; name?: string | null }>({});

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next = { role: role ? undefined : "請選擇你的身分", name: validateDisplayName(name) };
    setErrors(next);
    if (role && !next.name) onSubmit(role, name);
  }

  return (
    <Card className="mx-auto w-full max-w-xl">
      <h1 className="mb-2 text-2xl font-bold">選擇你的身分</h1>
      <p className="mb-6 text-muted-foreground">身分選好後就不能自己更改，請確認後再送出。</p>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 font-semibold">我是</legend>
          {OPTIONS.map((o) => (
            <label
              key={o.role}
              className={cn(
                "flex cursor-pointer gap-4 rounded-lg border-2 p-4 transition",
                role === o.role ? "border-primary bg-primary/5" : "border-border bg-card",
              )}
            >
              <input
                type="radio"
                name="role"
                value={o.role}
                checked={role === o.role}
                onChange={() => setRole(o.role)}
                className="mt-1 h-5 w-5 accent-primary"
              />
              <span>
                <span className="block text-lg font-bold">{o.title}</span>
                <span className="text-muted-foreground">{o.description}</span>
              </span>
            </label>
          ))}
          {errors.role && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {errors.role}
            </p>
          )}
        </fieldset>
        <Field id="displayName" label="怎麼稱呼你" error={errors.name} hint="例如：陳小姐、林媽媽">
          <Input id="displayName" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" disabled={submitting}>
          {submitting ? "儲存中…" : "確認身分"}
        </Button>
      </form>
    </Card>
  );
}
