import type { Role, SelfSignupRole } from "./contracts";

export const ROLE_LABELS: Record<Role, string> = {
  family: "家人",
  elder: "長輩",
  advisor: "生活顧問",
  technician: "全國電子技師",
  contractor: "協力工班",
  admin: "管理者",
};

/** Roles a person may pick at sign-up. Store roles are assigned by an admin. */
export const SELF_SIGNUP_ROLES: readonly SelfSignupRole[] = ["family", "elder"];

export function isSelfSignupRole(value: unknown): value is SelfSignupRole {
  return typeof value === "string" && (SELF_SIGNUP_ROLES as readonly string[]).includes(value);
}

export function isCustomerRole(role: Role): role is SelfSignupRole {
  return isSelfSignupRole(role);
}
