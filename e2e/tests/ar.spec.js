// AR 量測：手機實測。照片＋信用卡比例尺換算；結果帶回 AR 掃描頁同一份量測值
const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

async function toArm(page) {
  await page.goto('/jiujujia/app.html');
  await page.click('[data-demo="chen@example.com"]'); await page.waitForTimeout(1500);
  await page.evaluate(() => { const S = JJJAPP.S; S.stack = ['home', 'm2', 'b1', 'ar']; S.armode = 'manual'; JJJAPP.render(); });
  await page.click('[data-go="arm"]');
}
// 依畫布上的像素位置點擊
async function tapPx(page, x, y) {
  const c = page.locator('#armC'); const b = await c.boundingBox();
  const [w, h] = await c.evaluate(el => [el.width, el.height]);
  await page.mouse.click(b.x + x * b.width / w, b.y + y * b.height / h);
}

test('拍照量：開相機拍照 → 點卡片長邊 → 點走道兩端 → 換算並帶回量測欄位', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  const errs = await fresh(page);
  await toArm(page);
  await expect(page.locator('#view')).toContainText('不支援網頁 AR');
  await page.click('[data-arstart="cam"]');
  await expect(page.locator('#armV')).toBeVisible();
  await page.waitForFunction(() => { const v = document.getElementById('armV'); return v && v.videoWidth > 0; });
  await page.click('[data-arshot]');
  await expect(page.locator('#view')).toContainText('點信用卡');
  const [w] = await page.locator('#armC').evaluate(el => [el.width]);
  // 卡片長邊佔 w/10 像素；走道佔 w*0.9 → 8.56 × 9 ≈ 77 cm
  await tapPx(page, w * 0.1, 100); await tapPx(page, w * 0.2, 100);
  await expect(page.locator('#view')).toContainText('點要量的走道寬度兩端');
  await tapPx(page, w * 0.05, 200); await tapPx(page, w * 0.95, 200);
  await expect(page.locator('#view')).toContainText('約 77 cm');
  await expect(page.locator('#view')).toContainText('僅供參考');
  await page.click('[data-aruse]');
  await expect(page.locator('#m_corridor_cm')).toHaveValue('77');
  await expect(page.locator('#view')).toContainText('照片比例尺');
  expect(errs).toEqual([]);
});

test('從相簿選照片量門檻高度（iPhone 也能用）', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  const errs = await fresh(page);
  await toArm(page);
  await page.click('[data-armk="threshold_cm"]');
  // 產生一張 1000×600 的測試照片
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1000; c.height = 600; const g = c.getContext('2d'); g.fillStyle = '#ddd'; g.fillRect(0, 0, 1000, 600); return c.toDataURL('image/png').split(',')[1]; });
  await page.setInputFiles('[data-arfile]', { name: 'door.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.locator('#armC')).toBeVisible();
  await tapPx(page, 100, 300); await tapPx(page, 528, 300); // 卡片長邊 428 px
  await tapPx(page, 600, 200); await tapPx(page, 600, 300); // 門檻 100 px → 2 cm
  await expect(page.locator('#view')).toContainText('約 2 cm');
  await page.click('[data-aruse]');
  await expect(page.locator('#m_threshold_cm')).toHaveValue('2');
  expect(errs).toEqual([]);
});
