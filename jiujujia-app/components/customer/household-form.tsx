"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { STORES } from "@/lib/shared/stores";
import { validateHouseholdInput, type HouseholdInput, type HouseholdInputErrors } from "@/lib/customer/household-rules";

export function HouseholdForm({
  onSubmit,
  error,
  submitting,
}: {
  onSubmit: (input: HouseholdInput) => void;
  error?: string | null;
  submitting: boolean;
}) {
  const [input, setInput] = useState<HouseholdInput>({ elderName: "", address: "", storeId: "" });
  const [errors, setErrors] = useState<HouseholdInputErrors>({});

  function update<K extends keyof HouseholdInput>(key: K, value: string) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validateHouseholdInput(input);
    setErrors(next);
    if (Object.keys(next).length === 0) onSubmit(input);
  }

  return (
    <Card>
      <h2 className="mb-2 text-xl font-bold">建立長輩家</h2>
      <p className="mb-6 text-muted-foreground">先建立爸媽家的基本資料，之後的居家評估與報價都會記在這裡。</p>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Field id="elderName" label="長輩稱呼" error={errors.elderName} hint="例如：林媽媽">
          <Input
            id="elderName"
            value={input.elderName}
            onChange={(e) => update("elderName", e.target.value)}
            aria-invalid={Boolean(errors.elderName)}
          />
        </Field>
        <Field id="address" label="長輩家地址" error={errors.address}>
          <Input
            id="address"
            autoComplete="street-address"
            value={input.address}
            onChange={(e) => update("address", e.target.value)}
            aria-invalid={Boolean(errors.address)}
          />
        </Field>
        <Field id="storeId" label="服務門市" error={errors.storeId}>
          <Select
            id="storeId"
            value={input.storeId}
            onChange={(e) => update("storeId", e.target.value)}
            aria-invalid={Boolean(errors.storeId)}
          >
            <option value="">請選擇</option>
            {STORES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" disabled={submitting}>
          {submitting ? "建立中…" : "建立長輩家"}
        </Button>
      </form>
    </Card>
  );
}
