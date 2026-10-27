const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
const PW = 'demo1234';
async function appLogin(page, email) {
  await page.goto('/jiujujia/app.html');
  await page.fill('#lgEmail', email); await page.fill('#lgPw', PW); await page.click('#lgBtn');
}
// 2. 一個 App 依身分分流；帳號放錯入口會被擋下並提示正確入口
test.describe('放錯入口會被擋下', () => {
  test('揪居家 App 拒絕總部帳號，提示改用企業管理端（電腦版）', async ({ page }) => {
    await fresh(page); await appLogin(page, 'manager@example.com');
    await expect(page.locator('#loginForm .err')).toContainText('企業管理端（電腦版）');
    await expect(page.locator('#loginForm')).toBeVisible();
  });
  test('企業管理端拒絕家庭帳號，提示改用揪居家 App', async ({ page }) => {
    await fresh(page); await page.goto('/jiujujia/admin.html');
    await page.fill('#gEmail', 'chen@example.com'); await page.fill('#gPw', PW); await page.click('#gBtn');
    await expect(page.locator('#gate .gerr')).toContainText('揪居家 App');
    await expect(page.locator('#gate')).toBeVisible();
  });
  test('企業管理端拒絕技師帳號，提示改用揪居家 App', async ({ page }) => {
    await fresh(page); await page.goto('/jiujujia/admin.html');
    await page.fill('#gEmail', 'tech@example.com'); await page.fill('#gPw', PW); await page.click('#gBtn');
    await expect(page.locator('#gate .gerr')).toContainText('揪居家 App');
  });
  test('生活顧問（門市電腦）拒絕總部帳號', async ({ page }) => {
    await fresh(page); await page.goto('/jiujujia/consultant.html');
    await page.fill('#cLogin [name=email]', 'manager@example.com'); await page.fill('#cLogin [name=password]', PW);
    await page.click('#cLogin button[type=submit]');
    await expect(page.locator('#cLogin .er')).toContainText('企業管理端（電腦版）');
    await expect(page.locator('#cGate')).toBeVisible();
  });
  test('生活顧問（門市電腦）拒絕家庭帳號，提示改用揪居家 App', async ({ page }) => {
    await fresh(page); await page.goto('/jiujujia/consultant.html');
    await page.fill('#cLogin [name=email]', 'chen@example.com'); await page.fill('#cLogin [name=password]', PW);
    await page.click('#cLogin button[type=submit]');
    await expect(page.locator('#cLogin .er')).toContainText('揪居家 App');
  });
  test('密碼錯誤顯示錯誤訊息', async ({ page }) => {
    await fresh(page); await page.goto('/jiujujia/app.html');
    await page.fill('#lgEmail', 'chen@example.com'); await page.fill('#lgPw', 'wrong'); await page.click('#lgBtn');
    await expect(page.locator('#loginForm .err')).not.toBeEmpty();
  });
});
// 3. 一鍵登入：同一個 App 依身分進到各自首頁；電腦版兩個入口
test.describe('一鍵示範登入', () => {
  for (const [who, email, text] of [['家庭｜陳小姐', 'chen@example.com', 'AI 顧問阿國'], ['生活顧問｜王小明（手機）', 'advisor@example.com', '生活顧問・今天'], ['技師｜吳技師', 'tech@example.com', '我的工單']]) {
    test(`揪居家 App：${who}`, async ({ page }) => {
      const errs = await fresh(page); await page.goto('/jiujujia/app.html');
      await page.click(`[data-demo="${email}"]`);
      await expect(page.locator('#view')).toContainText(text);
      expect(errs).toEqual([]);
    });
  }
  test('揪居家 App 登入頁列出三種身分的示範帳號', async ({ page }) => {
    await fresh(page); await page.goto('/jiujujia/app.html');
    for (const e of ['chen@example.com', 'li@example.com', 'advisor@example.com', 'tech@example.com']) await expect(page.locator(`[data-demo="${e}"]`)).toBeVisible();
    await expect(page.locator('#view')).toContainText('企業管理端（電腦版）');
  });
  test('企業管理端：總部／門市主管｜張經理', async ({ page }) => {
    const errs = await fresh(page); await page.goto('/jiujujia/admin.html');
    await page.click('#gate [data-demo="manager@example.com"]');
    await expect(page.locator('#gate')).toBeHidden();
    await expect(page.locator('#title')).toHaveText('即時總覽');
    expect(errs).toEqual([]);
  });
  test('企業管理端：生活顧問（門市電腦）｜王小明 → 生活顧問電腦版', async ({ page }) => {
    const errs = await fresh(page); await page.goto('/jiujujia/admin.html');
    await page.click('#gate [data-demo="advisor@example.com"]');
    await expect(page).toHaveURL(/consultant\.html/);
    await expect(page.locator('.panel', { hasText: '新進案件與 AI 分析' })).toBeVisible();
    await expect(page.locator('#who')).toHaveText('王小明');
    expect(errs).toEqual([]);
  });
  test('生活顧問電腦版直接登入｜王小明', async ({ page }) => {
    await fresh(page); await page.goto('/jiujujia/consultant.html');
    await page.click('#cLogin [data-demo]');
    await expect(page.locator('#cGate')).toBeHidden();
    await expect(page.locator('#who')).toHaveText('王小明');
  });
  test('家庭登入 App 後打開企業管理端，不會沿用家庭登入', async ({ page }) => {
    await fresh(page); await page.goto('/jiujujia/app.html');
    await page.click('[data-demo="chen@example.com"]');
    await expect(page.locator('#view')).toContainText('AI 顧問阿國');
    await page.goto('/jiujujia/admin.html');
    await expect(page.locator('#gate')).toBeVisible();
    await expect(page.locator('#gate .gerr')).toContainText('揪居家 App');
  });
});
// 4. 生活顧問分工：手機＝面對面、電腦＝後台，報價以電腦版為正式版本
test.describe('生活顧問：手機版與電腦版分工', () => {
  const H = { 'Content-Type': 'application/json', 'X-JJJ': '1' };
  test('技師回報差異 → 手機「今天」顯示待審差異，提示到電腦版核准（手機上不能核准）', async ({ page }) => {
    await fresh(page); await page.goto('/jiujujia/app.html');
    await page.evaluate(async H => {
      await fetch('/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'tech@example.com', password: 'demo1234' }) });
      const o = (await (await fetch('/api/tech/orders', { headers: H })).json()).orders.find(x => x.household === '林媽媽家');
      await fetch(`/api/tech/orders/${o.id}/diffs`, { method: 'POST', headers: H, body: JSON.stringify({ pin_id: 'D1', level: '輕微', text: '浴室門是推拉門，門窗感測器改用側裝支架', photo: true }) });
      await fetch('/api/auth/logout', { method: 'POST', headers: H });
    }, H);
    await page.reload();
    await page.click('[data-demo="advisor@example.com"]');
    const card = page.locator('#advD');
    await expect(card).toContainText('待審差異 1 則');
    await expect(card).toContainText('電腦版');
    await expect(page.locator('#view [data-dfok]')).toHaveCount(0);
  });
  test('把手機轉給長輩：顯示電腦版整合好的正式版本，按「同意這一版」', async ({ page }) => {
    await fresh(page); await page.goto('/jiujujia/app.html');
    await page.evaluate(() => localStorage.setItem('jjj_v5_quotes', JSON.stringify({ 3: [{ v: 2, at: '10/27', total: 9900, items: ['示範'] }, { v: 1, at: '10/26', total: 9100, items: ['示範'] }] })));
    await page.click('[data-demo="advisor@example.com"]');
    await expect(page.locator('#view')).toContainText('生活顧問・今天');
    await page.locator('#view [data-board="3"]').first().click();
    await page.waitForTimeout(1500);
    await page.evaluate(() => JJJ.go('aec'));
    await expect(page.locator('#view')).toContainText('報價版本 v2（正式）');
    await expect(page.locator('#view [data-a="elderOk"]')).toContainText('同意這一版');
  });
});
