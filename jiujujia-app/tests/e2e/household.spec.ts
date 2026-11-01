import { expect, test, type Page } from "@playwright/test";

// #1 + #2 — 陳小姐 registers, creates 林媽媽家, 林媽媽 joins with the invite code.
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const chen = { email: `chen-${stamp}@test.tw`, password: "chen1234", name: "陳小姐" };
const lin = { email: `lin-${stamp}@test.tw`, password: "lin12345", name: "林媽媽" };

async function register(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByRole("tab", { name: "註冊" }).click();
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("密碼").fill(user.password);
  await page.getByRole("button", { name: "註冊", exact: true }).click();
  await expect(page.getByRole("heading", { name: "選擇你的身分" })).toBeVisible();
}

async function chooseRole(page: Page, role: "家人" | "長輩", name: string) {
  await page.getByRole("radio", { name: role, exact: true }).check();
  await page.getByLabel("怎麼稱呼你").fill(name);
  await page.getByRole("button", { name: "確認身分" }).click();
  await expect(page.getByRole("heading", { name: `${name}，你好` })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("家人建立長輩家，長輩用邀請碼加入，家人看到長輩已加入", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "完整流程只在桌面版跑一次");

  // 陳小姐：註冊 → 家人 → 建立長輩家
  await register(page, chen);
  await chooseRole(page, "家人", chen.name);
  await page.getByRole("button", { name: "建立長輩家" }).click();
  await expect(page.getByText("請填寫長輩稱呼")).toBeVisible();
  await expect(page.getByText("請填寫地址")).toBeVisible();
  await expect(page.getByText("請選擇服務門市")).toBeVisible();

  await page.getByLabel("長輩稱呼").fill("林媽媽");
  await page.getByLabel("長輩家地址").fill("台中市西屯區逢甲路 1 號");
  await page.getByLabel("服務門市").selectOption({ label: "Digital City 逢甲" });
  await page.getByRole("button", { name: "建立長輩家" }).click();

  await expect(page.getByRole("heading", { name: "林媽媽家" })).toBeVisible();
  await expect(page.getByTestId("elder-status")).toHaveText("長輩尚未加入");
  const code = (await page.getByTestId("invite-code").textContent())?.trim() ?? "";
  expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  await page.getByRole("button", { name: "登出" }).click();

  // 林媽媽：註冊 → 長輩 → 錯誤邀請碼 → 正確邀請碼（小寫也可以）
  await register(page, lin);
  await chooseRole(page, "長輩", lin.name);
  await page.getByLabel("邀請碼").fill("ABC");
  await page.getByRole("button", { name: "加入" }).click();
  await expect(page.getByText("邀請碼為 6 碼")).toBeVisible();

  await page.getByLabel("邀請碼").fill("ZZZZZZ");
  await page.getByRole("button", { name: "加入" }).click();
  await expect(page.getByText("找不到這個邀請碼，請向家人確認")).toBeVisible();

  await page.getByLabel("邀請碼").fill(code.toLowerCase());
  await page.getByRole("button", { name: "加入" }).click();
  await expect(page.getByText("加入成功！")).toBeVisible();
  await expect(page.getByRole("heading", { name: "林媽媽家" })).toBeVisible();
  await page.getByRole("button", { name: "登出" }).click();

  // 陳小姐重新登入：看到長輩已加入，邀請碼不再顯示
  await page.getByLabel("Email").fill(chen.email);
  await page.getByLabel("密碼").fill(chen.password);
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page.getByTestId("elder-status")).toHaveText("長輩已加入");
  await expect(page.getByTestId("invite-code")).toHaveCount(0);
});
