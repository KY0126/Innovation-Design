import type { StoreId } from "./contracts";

/** Pilot stores for the MVP (Taichung Digital City). Keep in sync with validStore() in firestore.rules. */
export const STORES: readonly { id: StoreId; name: string }[] = [
  { id: "dc-fengjia", name: "Digital City 逢甲" },
  { id: "dc-gongyi", name: "Digital City 公益" },
  { id: "dc-beitun", name: "Digital City 北屯總站" },
];

export function isStoreId(value: unknown): value is StoreId {
  return STORES.some((s) => s.id === value);
}

export function storeName(id: StoreId): string {
  return STORES.find((s) => s.id === id)?.name ?? "未知門市";
}
