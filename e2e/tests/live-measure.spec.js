// 實用版居家評估：真的用手機量（拍照＋信用卡比例尺；Android 模擬 WebXR），量完帶回表單並存成 AR 來源
const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
const { createMock } = require('./live-mock');
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

function mock() {
  return createMock({
    functions: { 'line-login': (b) => (b.code === 'test-code' ? { data: { token_hash: 'th-1', first: true } } : { status: 401, data: { error: 'x' } }) },
    db: { households: [{ id: 7, elder_name: '媽媽', elder_note: null, store: '民族店', stage: 0, created_at: '2026-11-26T00:00:00Z' }],
      members: [{ household_id: 7, user_id: 'u-family', relation: 'child' }] },
    rpc: { household_members: () => [{ user_id: 'u-family', display_name: '陳測試', relation: 'child', is_me: true }], wish_count: () => 0 },
  });
}
async function toAssess(page, M) {
  await M.install(page);
  await page.goto('/live/app/');
  await page.click('.hg1'); await page.click('[data-lv="ok"]');
  await expect(page.locator('[data-lv-page="jjj"]')).toBeVisible({ timeout: 15000 });
  await page.click('[data-lv="assess"]');
  await expect(page.locator('#lvAs')).toBeVisible();
}
async function tapPx(page, x, y) {
  const c = page.locator('#lvmC'); const b = await c.boundingBox();
  const [w, h] = await c.evaluate((el) => [el.width, el.height]);
  await page.mouse.click(b.x + x * b.width / w, b.y + y * b.height / h);
}

test('實用版：走道寬用拍照量，帶回表單；門檻、距離手動填；存成 AR 來源並記錄每格量法', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  const errs = await fresh(page, false);
  const M = mock();
  await toAssess(page, M);
  await page.click('[data-lvm="corridor"]');
  await expect(page.locator('.lvm')).toContainText('不支援網頁 AR');
  await page.click('.lvm [data-m="cam"]');
  await page.waitForFunction(() => { const v = document.getElementById('lvmV'); return v && v.videoWidth > 0; });
  await page.click('.lvm [data-m="shot"]');
  const [w] = await page.locator('#lvmC').evaluate((el) => [el.width]);
  await tapPx(page, w * 0.1, 100); await tapPx(page, w * 0.2, 100);
  await expect(page.locator('.lvm')).toContainText('點要量的走道寬度兩端');
  await tapPx(page, w * 0.05, 200); await tapPx(page, w * 0.95, 200);
  await expect(page.locator('.lvm')).toContainText('約 77 cm');
  await page.click('.lvm [data-m="use"]');
  await expect(page.locator('.lvm')).toHaveCount(0);
  await expect(page.locator('#lvAs [name="corridor"]')).toHaveValue('77');
  await expect(page.locator('[data-msrc="corridor"]')).toContainText('已用照片量');
  await page.fill('#lvAs [name="threshold"]', '2');
  await page.fill('#lvAs [name="dist"]', '5');
  await page.click('#lvAs button[type="submit"]');
  await expect.poll(() => M.st.db.assessments.length).toBe(1);
  const saved = M.st.db.assessments[0];
  expect(saved.source).toBe('ar');
  expect(saved.dims).toMatchObject({ corridor_mm: 770, methods: { corridor: 'photo', threshold: 'manual', dist: 'manual' } });
  expect(errs).toEqual([]);
});

test('實用版：量完又手動改數字，標成手動；三格都手動時存成手動來源', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  const errs = await fresh(page, false);
  const M = mock();
  await toAssess(page, M);
  await page.evaluate(() => { const i = document.querySelector('#lvAs [name="corridor"]'); i.value = '90'; i.dataset.src = 'photo'; });
  await page.fill('#lvAs [name="corridor"]', '88');
  await expect(page.locator('[data-msrc="corridor"]')).toContainText('已改成手動填寫');
  await page.fill('#lvAs [name="threshold"]', '0');
  await page.fill('#lvAs [name="dist"]', '4');
  await page.click('#lvAs button[type="submit"]');
  await expect.poll(() => M.st.db.assessments.length).toBe(1);
  expect(M.st.db.assessments[0].source).toBe('manual');
  expect(errs).toEqual([]);
});

test('實用版：Android AR（模擬 WebXR）量走道寬，放兩點約 90 cm，帶回表單並記成 AR', async ({ page }, info) => {
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
  const M = mock();
  await toAssess(page, M);
  await page.click('[data-lvm="corridor"]');
  await page.click('.lvm [data-m="xr"]');
  await page.evaluate(() => __tick());
  await expect(page.locator('#lvxh')).toContainText('找到地面了');
  await page.click('#lvxgo');
  await page.evaluate(() => { __hit = { x: 0.45, y: -0.9, z: -3 }; __tick(); });
  await expect(page.locator('#lvxh')).toContainText('已放起點');
  await page.click('#lvxgo');
  await expect(page.locator('.lvm')).toContainText('約 90 cm');
  await expect(page.locator('.lvm')).toContainText('不存影像');
  await page.click('.lvm [data-m="use"]');
  await expect(page.locator('#lvAs [name="corridor"]')).toHaveValue('90');
  await expect(page.locator('[data-msrc="corridor"]')).toContainText('已用 AR 量');
});
