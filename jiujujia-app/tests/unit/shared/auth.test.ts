import { describe, expect, it } from "vitest";
import { DEFAULT_AUTH_ERROR, authErrorMessage } from "@/lib/shared/auth-errors";
import { validateDisplayName, validateEmail, validatePassword } from "@/lib/shared/auth-validation";
import { ROLE_LABELS, isSelfSignupRole } from "@/lib/shared/roles";
import { STORES, isStoreId, storeName } from "@/lib/shared/stores";

describe("sign-up validation (#1)", () => {
  it("validates email format", () => {
    expect(validateEmail("")).toBe("請輸入 Email");
    expect(validateEmail("chen@")).toBe("Email 格式不正確");
    expect(validateEmail("chen@example.com")).toBeNull();
  });

  it("requires at least 6 password characters (boundary)", () => {
    expect(validatePassword("")).toBe("請輸入密碼");
    expect(validatePassword("12345")).toBe("密碼至少需要 6 碼");
    expect(validatePassword("123456")).toBeNull();
  });

  it("validates display name length", () => {
    expect(validateDisplayName(" ")).toBe("請輸入稱呼");
    expect(validateDisplayName("陳小姐")).toBeNull();
    expect(validateDisplayName("陳".repeat(21))).not.toBeNull();
  });
});

describe("auth error messages (#1)", () => {
  it("does not reveal whether email or password was wrong", () => {
    for (const code of ["auth/wrong-password", "auth/user-not-found", "auth/invalid-credential"]) {
      expect(authErrorMessage({ code })).toBe("Email 或密碼不正確");
    }
  });

  it("tells people an email is already registered", () => {
    expect(authErrorMessage({ code: "auth/email-already-in-use" })).toBe("此 Email 已註冊，請直接登入");
  });

  it("falls back to a generic message", () => {
    expect(authErrorMessage(new Error("boom"))).toBe(DEFAULT_AUTH_ERROR);
    expect(authErrorMessage(null)).toBe(DEFAULT_AUTH_ERROR);
  });
});

describe("roles and stores", () => {
  it("only family and elder can self sign up", () => {
    expect(isSelfSignupRole("family")).toBe(true);
    expect(isSelfSignupRole("elder")).toBe(true);
    expect(isSelfSignupRole("advisor")).toBe(false);
    expect(isSelfSignupRole("admin")).toBe(false);
    expect(ROLE_LABELS.advisor).toBe("生活顧問");
  });

  it("knows the three Digital City pilot stores", () => {
    expect(STORES).toHaveLength(3);
    expect(isStoreId("dc-beitun")).toBe(true);
    expect(storeName("dc-gongyi")).toBe("Digital City 公益");
  });
});
