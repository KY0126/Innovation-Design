// Pure business rules for issue #2 (no Firestore calls) — covered by tests/unit/customer.
import type { InviteCode, Role, StoreId } from "@/lib/shared/contracts";
import { isStoreId } from "@/lib/shared/stores";
import { INVITE_CODE_LENGTH, isValidInviteCode, normalizeInviteCode } from "./invite-code";

export const MAX_ELDER_NAME_LENGTH = 20;
export const MAX_ADDRESS_LENGTH = 100;

export interface HouseholdInput {
  elderName: string;
  address: string;
  storeId: string;
}

export type HouseholdInputErrors = Partial<Record<keyof HouseholdInput, string>>;

export function validateHouseholdInput(input: HouseholdInput): HouseholdInputErrors {
  const errors: HouseholdInputErrors = {};
  const name = input.elderName.trim();
  const address = input.address.trim();
  if (!name) errors.elderName = "請填寫長輩稱呼";
  else if (name.length > MAX_ELDER_NAME_LENGTH) errors.elderName = `長輩稱呼最多 ${MAX_ELDER_NAME_LENGTH} 個字`;
  if (!address) errors.address = "請填寫地址";
  else if (address.length > MAX_ADDRESS_LENGTH) errors.address = `地址最多 ${MAX_ADDRESS_LENGTH} 個字`;
  if (!isStoreId(input.storeId)) errors.storeId = "請選擇服務門市";
  return errors;
}

export function toValidHousehold(input: HouseholdInput): { elderName: string; address: string; storeId: StoreId } {
  if (Object.keys(validateHouseholdInput(input)).length > 0) throw new Error("長輩家資料不完整");
  return { elderName: input.elderName.trim(), address: input.address.trim(), storeId: input.storeId as StoreId };
}

export type JoinRejection = "not-elder" | "invalid-format" | "not-found" | "already-joined";

export const JOIN_MESSAGES: Record<JoinRejection, string> = {
  "not-elder": "邀請碼只供長輩本人使用",
  "invalid-format": `邀請碼為 ${INVITE_CODE_LENGTH} 碼`,
  "not-found": "找不到這個邀請碼，請向家人確認",
  "already-joined": "這個長輩家已有長輩加入",
};

/** Checks that can run before the invite-code document is fetched. Returns the normalized code. */
export function precheckJoin(role: Role, rawCode: string): { ok: true; code: string } | { ok: false; reason: JoinRejection } {
  if (role !== "elder") return { ok: false, reason: "not-elder" };
  const code = normalizeInviteCode(rawCode);
  if (!isValidInviteCode(code)) return { ok: false, reason: "invalid-format" };
  return { ok: true, code };
}

/** Decide after fetching inviteCodes/{code}. Re-joining the same household is treated as success. */
export function decideJoin(invite: InviteCode | null, uid: string): { ok: true } | { ok: false; reason: JoinRejection } {
  if (!invite) return { ok: false, reason: "not-found" };
  if (invite.claimedBy && invite.claimedBy !== uid) return { ok: false, reason: "already-joined" };
  return { ok: true };
}
