import { expect, test } from "@playwright/test";

// #1 — form validation and route guard (Auth emulator only).
test.describe("登入頁（#1）", () => {
  test("未登入開啟首頁會被導到登入頁", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "讓不同住的子女，也能顧好爸媽家" })).toBeVisible();
  });

  test("Email 格式錯誤與密碼太短會顯示錯誤且不送出", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("tab", { name: "註冊" }).click();
    await page.getByLabel("Email").fill("chen@");
    await page.getByLabel("密碼").fill("123");
    await page.getByRole("button", { name: "註冊", exact: true }).click();
    await expect(page.getByText("Email 格式不正確")).toBeVisible();
    await expect(page.getByText("密碼至少需要 6 碼")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("密碼錯誤時不透露是哪一項錯", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(`nobody-${Date.now()}@test.tw`);
    await page.getByLabel("密碼").fill("wrongpass");
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await expect(page.getByText("Email 或密碼不正確")).toBeVisible();
  });
});
