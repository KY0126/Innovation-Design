"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { INVITE_CODE_LENGTH } from "@/lib/customer/invite-code";

export function JoinHouseholdForm({
  onSubmit,
  error,
  submitting,
}: {
  onSubmit: (code: string) => void;
  error?: string | null;
  submitting: boolean;
}) {
  const [code, setCode] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(code);
  }

  return (
    <Card>
      <h2 className="mb-2 text-xl font-bold">加入長輩家</h2>
      <p className="mb-6 text-muted-foreground">請輸入家人給你的 {INVITE_CODE_LENGTH} 碼邀請碼，英文大小寫都可以。</p>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Field id="inviteCode" label="邀請碼" error={error}>
          <Input
            id="inviteCode"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={INVITE_CODE_LENGTH + 2}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono text-2xl tracking-[0.3em]"
            aria-invalid={Boolean(error)}
          />
        </Field>
        <Button type="submit" disabled={submitting}>
          {submitting ? "加入中…" : "加入"}
        </Button>
      </form>
    </Card>
  );
}

export function JoinedNotice() {
  return <Notice tone="success">加入成功！</Notice>;
}
