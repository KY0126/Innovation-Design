import { describe, expect, it } from "vitest";
import {
  INVITE_ALPHABET,
  generateInviteCode,
  isValidInviteCode,
  normalizeInviteCode,
} from "@/lib/customer/invite-code";

describe("invite code (#2)", () => {
  it("has 6 characters from the safe alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(6);
      expect(isValidInviteCode(code)).toBe(true);
    }
  });

  it("never contains easily confused characters 0, O, 1, I", () => {
    expect(INVITE_ALPHABET).not.toMatch(/[0O1I]/);
    expect(isValidInviteCode("AB0CDE")).toBe(false);
    expect(isValidInviteCode("ABOCDE")).toBe(false);
    expect(isValidInviteCode("AB1CDE")).toBe(false);
    expect(isValidInviteCode("ABICDE")).toBe(false);
  });

  it("uses the injected random source", () => {
    expect(generateInviteCode(() => 0)).toBe("222222");
    expect(generateInviteCode((n) => n - 1)).toBe("ZZZZZZ");
  });

  it("is case-insensitive and ignores spaces and dashes", () => {
    expect(normalizeInviteCode(" ab3-x9k ")).toBe("AB3X9K");
  });

  it("rejects codes that are not exactly 6 characters", () => {
    expect(isValidInviteCode("AB3X9")).toBe(false);
    expect(isValidInviteCode("AB3X9KK")).toBe(false);
    expect(isValidInviteCode("")).toBe(false);
  });
});
