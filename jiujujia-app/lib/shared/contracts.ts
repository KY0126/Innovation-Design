// Shared data contracts between the customer and store domains (ARCHITECTURE.md §3–§4).
// Owned by the contract-architect agent: change this file only together with ARCHITECTURE.md and firestore.rules.
import type { Timestamp } from "firebase/firestore";

export type Role = "family" | "elder" | "advisor" | "technician" | "contractor" | "admin";
export type SelfSignupRole = Extract<Role, "family" | "elder">;
export type StoreId = "dc-fengjia" | "dc-gongyi" | "dc-beitun";

export interface UserProfile {
  uid: string;
  role: Role;
  displayName: string;
  email: string;
  createdAt: Timestamp | null;
}

export interface Household {
  id: string;
  elderName: string;
  address: string;
  familyUids: string[];
  elderUid: string | null;
  storeId: StoreId;
  inviteCode: string;
  createdBy: string;
  createdAt: Timestamp | null;
  elderJoinedAt?: Timestamp | null;
  joinCode?: string;
}

export interface InviteCode {
  code: string;
  householdId: string;
  createdBy: string;
  claimedBy: string | null;
  createdAt: Timestamp | null;
}
