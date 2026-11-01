import { expect, test } from "@playwright/test";

// #1 — register, choose a role once, sign out, sign back in without being asked again.
test("註冊後選擇家人身分，重新登入不會再詢問身分", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "只在桌面版跑一次");
  const email = `signup-${Date.now()}@test.tw`;

  await page.goto("/login");
  await page.getByRole("tab", { name: "註冊" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("密碼").fill("chen1234");
  await page.getByRole("button", { name: "註冊", exact: true }).click();

  await expect(page.getByRole("heading", { name: "選擇你的身分" })).toBeVisible();
  // 只開放家人、長輩自行註冊
  await expect(page.getByRole("radio")).toHaveCount(2);
  await expect(page.getByRole("radio", { name: /生活顧問|技師|協力工班|管理者/ })).toHaveCount(0);

  await page.getByRole("button", { name: "確認身分" }).click();
  await expect(page.getByText("請選擇你的身分")).toBeVisible();

  await page.getByRole("radio", { name: "家人", exact: true }).check();
  await page.getByLabel("怎麼稱呼你").fill("陳小姐");
  await page.getByRole("button", { name: "確認身分" }).click();
  await expect(page.getByRole("heading", { name: "陳小姐，你好" })).toBeVisible();
  await expect(page.getByTestId("current-user")).toContainText("家人");

  await page.getByRole("button", { name: "登出" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("密碼").fill("chen1234");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page.getByRole("heading", { name: "陳小姐，你好" })).toBeVisible();

  // 已註冊的 Email 再註冊一次
  await page.getByRole("button", { name: "登出" }).click();
  await page.getByRole("tab", { name: "註冊" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("密碼").fill("chen1234");
  await page.getByRole("button", { name: "註冊", exact: true }).click();
  await expect(page.getByText("此 Email 已註冊，請直接登入")).toBeVisible();
});
