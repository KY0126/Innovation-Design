// AR 量測：手機實測。照片＋尺的刻度當比例尺換算；結果帶回 AR 掃描頁同一份量測值
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

test('拍照量：開相機拍照 → 點尺上兩個刻度、輸入相差公分 → 點走道兩端 → 換算並帶回量測欄位', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  const errs = await fresh(page);
  await toArm(page);
  await expect(page.locator('#view')).toContainText('不支援網頁 AR');
  await page.click('[data-arstart="cam"]');
  await expect(page.locator('#armV')).toBeVisible();
  await page.waitForFunction(() => { const v = document.getElementById('armV'); return v && v.videoWidth > 0; });
  await page.click('[data-arshot]');
  await expect(page.locator('#view')).toContainText('點尺上');
  const [w] = await page.locator('#armC').evaluate(el => [el.width]);
  // 尺上兩個刻度相差 10 cm、佔 w/10 像素；走道佔 w*0.9 → 90 cm
  await tapPx(page, w * 0.1, 100); await tapPx(page, w * 0.2, 100);
  await expect(page.locator('#view')).toContainText('相差幾公分');
  await expect(page.locator('#armRef')).toHaveValue('10');
  await page.click('[data-arref]');
  await expect(page.locator('#view')).toContainText('點要量的走道寬度兩端');
  await tapPx(page, w * 0.05, 200); await tapPx(page, w * 0.95, 200);
  await expect(page.locator('#view')).toContainText('約 90 cm');
  await expect(page.locator('#view')).toContainText('僅供參考');
  await page.click('[data-aruse]');
  await expect(page.locator('#m_corridor_cm')).toHaveValue('90');
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
  await tapPx(page, 100, 300); await tapPx(page, 600, 300); // 尺上 0～10 cm 佔 500 px
  await page.fill('#armRef', '10'); await page.click('[data-arref]');
  await tapPx(page, 600, 200); await tapPx(page, 600, 300); // 門檻 100 px → 2 cm
  await expect(page.locator('#view')).toContainText('約 2 cm');
  await page.click('[data-aruse]');
  await expect(page.locator('#m_threshold_cm')).toHaveValue('2');
  expect(errs).toEqual([]);
});

test('Android AR（模擬 WebXR）：準心、起點、虛線與即時距離，放兩點後帶回約 90 cm', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.addInitScript(() => {
    const f = 1 / Math.tan(30 * Math.PI / 180), asp = 390 / 844, n = 0.1, fa = 100;
    const P = new Float32Array([f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]);
    const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    window.__hit = { x: -0.45, y: -0.9, z: -3 };
    window.XRWebGLLayer = function () { this.framebuffer = null; };
    const sess = { _l: {}, renderState: {}, updateRenderState(o) { this.renderState = o; }, async requestReferenceSpace() { return {}; }, async requestHitTestSource() { return {}; },
      addEventListener(t, fn) { this._l[t] = fn; }, requestAnimationFrame(fn) { window.__raf = fn; }, end() { this._l.end && this._l.end(); } };
    window.__tick = () => window.__raf && window.__raf(0, { getHitTestResults: () => [{ getPose: () => ({ transform: { position: window.__hit } }) }], getViewerPose: () => ({ views: [{ projectionMatrix: P, transform: { inverse: { matrix: I } } }] }) });
    Object.defineProperty(navigator, 'xr', { value: { isSessionSupported: async () => true, requestSession: async () => sess } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/jiujujia/app.html'); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('jjj_g_off', '1'); }); await page.goto('/jiujujia/app.html');
  await page.click('[data-demo="li@example.com"]'); await page.waitForTimeout(1500);
  await page.evaluate(() => { JJJAPP.S.stack = ['home', 'm2']; JJJAPP.S.armode = 'manual'; JJJAPP.go('ar'); });
  await page.click('[data-go="arm"]'); await page.click('[data-arstart="xr"]');
  await page.evaluate(() => __tick());
  await expect(page.locator('#xrh')).toContainText('找到地面了');
  await page.click('#xrgo');
  await page.evaluate(() => { __hit = { x: 0.45, y: -0.9, z: -3 }; __tick(); });
  await expect(page.locator('#xrh')).toContainText('已放起點');
  const ink = await page.evaluate(() => { const c = document.getElementById('xrc'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
  expect(ink).toBeGreaterThan(200);
  await page.click('#xrgo');
  await expect(page.locator('#view')).toContainText('約 90 cm');
  await expect(page.locator('#view')).toContainText('不存影像');
});

test('量測頁共用「AR 量測｜手動輸入」：量完不滿意改用手動輸入，數字先填好，改了標成手動', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  const errs = await fresh(page);
  await toArm(page);
  await expect(page.locator('.armode [aria-pressed="true"]')).toHaveText('AR 量測');
  await page.click('[data-arstart="cam"]');
  await page.waitForFunction(() => { const v = document.getElementById('armV'); return v && v.videoWidth > 0; });
  await page.click('[data-arshot]');
  const [w] = await page.locator('#armC').evaluate(el => [el.width]);
  await tapPx(page, w * 0.1, 100); await tapPx(page, w * 0.2, 100);
  await page.click('[data-arref]');
  await tapPx(page, w * 0.05, 200); await tapPx(page, w * 0.95, 200);
  await expect(page.locator('#view')).toContainText('約 90 cm');
  await page.click('[data-arman]');
  await expect(page.locator('.armode [aria-pressed="true"]')).toHaveText('手動輸入');
  await expect(page.locator('#m_corridor_cm')).toHaveValue('90');
  await expect(page.locator('#m_corridor_cm')).toBeFocused();
  await page.fill('#m_corridor_cm', '80');
  await expect(page.locator('#m_corridor_cm').locator('xpath=ancestor::label').locator('.tag')).toHaveText('手動');
  // 從手動輸入切回 AR 量測
  await page.click('.armode [data-go="arm"]');
  await expect(page.locator('#view')).toContainText('要量哪一項');
  await page.click('.armode [data-arman]');
  await expect(page.locator('#m_corridor_cm')).toHaveValue('80');
  expect(errs).toEqual([]);
});
