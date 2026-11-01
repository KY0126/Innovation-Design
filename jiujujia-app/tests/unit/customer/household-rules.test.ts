import { describe, expect, it } from "vitest";
import {
  JOIN_MESSAGES,
  decideJoin,
  precheckJoin,
  toValidHousehold,
  validateHouseholdInput,
} from "@/lib/customer/household-rules";
import type { InviteCode } from "@/lib/shared/contracts";

const valid = { elderName: "林媽媽", address: "台中市西屯區逢甲路 1 號", storeId: "dc-fengjia" };

describe("validateHouseholdInput (#2)", () => {
  it("accepts a complete household", () => {
    expect(validateHouseholdInput(valid)).toEqual({});
  });

  it("requires elder name and address (whitespace only counts as empty)", () => {
    expect(validateHouseholdInput({ ...valid, elderName: "  ", address: "" })).toEqual({
      elderName: "請填寫長輩稱呼",
      address: "請填寫地址",
    });
  });

  it("requires a pilot store", () => {
    expect(validateHouseholdInput({ ...valid, storeId: "" }).storeId).toBe("請選擇服務門市");
    expect(validateHouseholdInput({ ...valid, storeId: "dc-taipei" }).storeId).toBe("請選擇服務門市");
  });

  it("enforces length limits at the boundary", () => {
    expect(validateHouseholdInput({ ...valid, elderName: "林".repeat(20) })).toEqual({});
    expect(validateHouseholdInput({ ...valid, elderName: "林".repeat(21) }).elderName).toBeDefined();
    expect(validateHouseholdInput({ ...valid, address: "路".repeat(100) })).toEqual({});
    expect(validateHouseholdInput({ ...valid, address: "路".repeat(101) }).address).toBeDefined();
  });

  it("trims values before saving and refuses invalid input", () => {
    expect(toValidHousehold({ ...valid, elderName: " 林媽媽 " }).elderName).toBe("林媽媽");
    expect(() => toValidHousehold({ ...valid, address: "" })).toThrow();
  });
});

describe("joining a household (#2)", () => {
  const invite: InviteCode = { code: "AB3X9K", householdId: "h1", createdBy: "fam", claimedBy: null, createdAt: null };

  it("only elders may use an invite code", () => {
    expect(precheckJoin("family", "AB3X9K")).toEqual({ ok: false, reason: "not-elder" });
    expect(JOIN_MESSAGES["not-elder"]).toBe("邀請碼只供長輩本人使用");
  });

  it("rejects malformed codes before any lookup", () => {
    expect(precheckJoin("elder", "AB3")).toEqual({ ok: false, reason: "invalid-format" });
    expect(precheckJoin("elder", "ab3-x9k")).toEqual({ ok: true, code: "AB3X9K" });
  });

  it("reports unknown codes", () => {
    expect(decideJoin(null, "elder1")).toEqual({ ok: false, reason: "not-found" });
  });

  it("refuses a household another elder already joined", () => {
    expect(decideJoin({ ...invite, claimedBy: "elder2" }, "elder1")).toEqual({ ok: false, reason: "already-joined" });
  });

  it("lets the first elder join, and treats re-joining as success", () => {
    expect(decideJoin(invite, "elder1")).toEqual({ ok: true });
    expect(decideJoin({ ...invite, claimedBy: "elder1" }, "elder1")).toEqual({ ok: true });
  });
});
