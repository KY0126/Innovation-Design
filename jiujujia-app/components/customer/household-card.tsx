import { Card } from "@/components/ui/card";
import type { Household } from "@/lib/shared/contracts";
import { storeName } from "@/lib/shared/stores";

export function HouseholdCard({ household, viewer }: { household: Household; viewer: "family" | "elder" }) {
  const joined = Boolean(household.elderUid);
  return (
    <Card data-testid="household-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-2xl font-bold">{household.elderName}家</h2>
        <span
          data-testid="elder-status"
          className={`rounded-full px-3 py-1 text-base font-semibold ${joined ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
        >
          {joined ? "長輩已加入" : "長輩尚未加入"}
        </span>
      </div>
      <dl className="mt-4 grid gap-2 text-base sm:grid-cols-[6rem_1fr]">
        <dt className="text-muted-foreground">地址</dt>
        <dd>{household.address}</dd>
        <dt className="text-muted-foreground">服務門市</dt>
        <dd>{storeName(household.storeId)}</dd>
      </dl>

      {viewer === "family" && !joined && (
        <div className="mt-6 rounded-lg bg-muted p-5">
          <p className="font-semibold">邀請{household.elderName}加入</p>
          <p className="mt-1 text-muted-foreground">
            請{household.elderName}用自己的手機註冊，身分選「長輩」，再輸入這組邀請碼。之後報價要由長輩本人同意。
          </p>
          <p data-testid="invite-code" className="mt-4 font-mono text-4xl font-bold tracking-[0.3em] text-primary">
            {household.inviteCode}
          </p>
        </div>
      )}

      {viewer === "elder" && (
        <p className="mt-6 rounded-lg bg-muted p-5 text-base">
          你已加入這個長輩家。之後生活顧問送來的報價，會由你本人決定是否同意施工。
        </p>
      )}
    </Card>
  );
}
