// 實用版 AR 量測：Demo 畫面「用手機實際量」打開 live-measure.js（一次量完；Android 模擬 WebXR、iPhone 拍照＋尺），
// 量完帶回 Demo 的手動輸入欄，做完評估後存進 Supabase（模擬），記錄每格量法、插座、材質
const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
const { familyDB, loginToApp } = require('./live-db');
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

const desktopOnly = (info) => test.skip(info.project.name !== 'desktop');
// 進到 Demo 的 AR 量測畫面（揪居家 › 開始 AR 量測 › 幫長輩填）
async function toAR(page, M) {
  await loginToApp(page, M);
  await page.click('.hg1');
  await page.click('[data-go="b1"] >> nth=0');
  await page.click('[data-a="loginChild"]');
  await expect(page.locator('#arBtn')).toBeVisible();
}
// 帶回手動輸入欄後：補齊數字、按下一步、回答題目到結果頁
async function finish(page, fill = {}) {
  for (const [k, v] of Object.entries(fill)) await page.fill('#m_' + k, v);
  await page.click('#view [data-a="arNext"]');
  for (let i = 0; i < 12; i++) {
    if ((await page.evaluate(() => window.JJJAPP.S.stack.slice(-1)[0])) !== 'b2') break;
    const a = page.locator('#view [data-ans]').first(); if (await a.count()) await a.click();
    const nx = page.locator('#view [data-a="next"]'); if (!(await nx.count())) break;
    await nx.click(); await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => window.JJJAPP.S.stack.slice(-1)[0] === 'b3', null, { timeout: 10000 });
}
async function tapPx(page, x, y) {
  const c = page.locator('#lvmC'); const b = await c.boundingBox();
  const [w, h] = await c.evaluate((el) => [el.width, el.height]);
  await page.mouse.click(b.x + x * b.width / w, b.y + y * b.height / h);
}
async function xrInit(page) {
  await page.addInitScript(() => {
    const f = 1 / Math.tan(30 * Math.PI / 180), asp = 390 / 844, n = 0.1, fa = 100;
    const P = new Float32Array([f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]);
    const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    window.__hit = { x: -0.45, y: -0.9, z: -3 };
    window.XRWebGLLayer = function () { this.framebuffer = null; };
    const sess = { _l: {}, renderState: {}, updateRenderState(o) { this.renderState = o; }, async requestReferenceSpace() { return {}; }, async requestHitTestSource() { return {}; },
      addEventListener(t, fn) { this._l[t] = fn; }, requestAnimationFrame(fn) { window.__raf = fn; }, end() { this._l.end && this._l.end(); } };
    window.__tick = () => window.__raf && window.__raf(0, { getHitTestResults: () => [{ getPose: () => ({ transform: { position: window.__hit } }) }], getViewerPose: () => ({ transform: { matrix: window.__cam || I }, views: [{ projectionMatrix: P, transform: { inverse: { matrix: I } } }] }) });
    Object.defineProperty(navigator, 'xr', { value: { isSessionSupported: async () => true, requestSession: async () => sess } });
  });
}

test('實用版：走道寬用拍照量（尺的刻度定比例）帶回 Demo 欄位；門檻、距離手填；存成 AR 來源並記錄每格量法', async ({ page }, info) => {
  desktopOnly(info);
  await page.setViewportSize({ width: 390, height: 844 });
  const errs = await fresh(page, false);
  const M = familyDB();
  await toAR(page, M);
  await page.click('#arBtn');
  await expect(page.locator('.lvm')).toContainText('不支援網頁 AR');
  await page.click('.lvm [data-w="one"][data-k="corridor"]');
  await page.click('.lvm >> nth=-1 >> [data-m="cam"]');
  await page.waitForFunction(() => { const v = document.getElementById('lvmV'); return v && v.videoWidth > 0; });
  await page.click('.lvm [data-m="shot"]');
  const [w] = await page.locator('#lvmC').evaluate((el) => [el.width]);
  await tapPx(page, w * 0.1, 100); await tapPx(page, w * 0.2, 100);
  await expect(page.locator('.lvm').last()).toContainText('相差幾公分');
  await page.click('.lvm [data-m="ref"]');
  await tapPx(page, w * 0.05, 200); await tapPx(page, w * 0.95, 200);
  await expect(page.locator('.lvm').last()).toContainText('約 90 cm');
  await page.click('.lvm [data-m="use"]');
  await expect(page.locator('[data-wv="corridor"]')).toContainText('90 cm');
  await page.click('.lvm [data-w="use"]');
  await expect(page.locator('.lvm')).toHaveCount(0);
  await expect(page.locator('#m_corridor_cm')).toHaveValue('90');
  await finish(page, { threshold_cm: '2', bed_bath_m: '5' });
  await expect.poll(() => M.st.db.assessments.length).toBe(1);
  const saved = M.st.db.assessments[0];
  expect(saved.source).toBe('ar');
  expect(saved.dims).toMatchObject({ corridor_mm: 900, threshold_mm: 20, bed_bath_mm: 5000, methods: { corridor: 'photo', threshold: 'manual', dist: 'manual' } });
  expect(saved.lights.find((x) => x[0] === '浴室')[1]).toBe('y');
  expect(errs).toEqual([]);
});

test('實用版：量完又在 Demo 欄位手動改數字，那一格記成手動；全部手動時來源是 App', async ({ page }, info) => {
  desktopOnly(info);
  await page.setViewportSize({ width: 390, height: 844 });
  const errs = await fresh(page, false);
  const M = familyDB();
  await toAR(page, M);
  await page.evaluate(() => { const S = window.JJJAPP.S; S.meas = { corridor_cm: 90 }; S.measSrc = { corridor: 'photo' }; S.measVal = { corridor: 90 }; });
  await page.click('#view [data-armode="manual"] >> nth=0');
  await page.fill('#m_corridor_cm', '88');
  await finish(page, { threshold_cm: '0', bed_bath_m: '4' });
  await expect.poll(() => M.st.db.assessments.length).toBe(1);
  expect(M.st.db.assessments[0].source).toBe('app');
  expect(M.st.db.assessments[0].dims.methods).toEqual({ corridor: 'manual', threshold: 'manual', dist: 'manual' });
  expect(errs).toEqual([]);
});

test('實用版：Android AR（模擬 WebXR）單獨量走道寬，放兩點約 90 cm，帶回 Demo 欄位並記成 AR', async ({ page }, info) => {
  desktopOnly(info);
  await xrInit(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const M = familyDB();
  await toAR(page, M);
  await page.click('#arBtn');
  await page.click('.lvm [data-w="one"][data-k="corridor"]');
  await page.click('.lvm >> nth=-1 >> [data-m="xr"]');
  await page.evaluate(() => __tick());
  await expect(page.locator('#lvxh')).toContainText('找到平面了');
  await page.click('#lvxgo');
  await page.evaluate(() => { __hit = { x: 0.45, y: -0.9, z: -3 }; __tick(); });
  await expect(page.locator('#lvxh')).toContainText('已放起點');
  await page.click('#lvxgo');
  await expect(page.locator('.lvm').last()).toContainText('約 90 cm');
  await expect(page.locator('.lvm').last()).toContainText('不存影像');
  await page.click('.lvm >> nth=-1 >> [data-m="use"]');
  await page.click('.lvm [data-w="use"]');
  await expect(page.locator('#m_corridor_cm')).toHaveValue('90');
  await finish(page, { threshold_cm: '1', bed_bath_m: '3' });
  await expect.poll(() => M.st.db.assessments.length).toBe(1);
  expect(M.st.db.assessments[0].dims.methods.corridor).toBe('xr');
});

test('實用版：一次量完（模擬 WebXR）依序量走道寬、門檻高（量高度）、床到浴室，標 2 個插座、選材質，帶回 Demo 並存檔', async ({ page }, info) => {
  desktopOnly(info);
  await xrInit(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const errs = await fresh(page, false);
  const M = familyDB();
  await toAR(page, M);
  await page.click('#arBtn');
  await expect(page.locator('.lvm')).toContainText('開始 AR 量測（3 項依序）');
  await page.click('.lvm [data-w="xr"]');
  await page.evaluate(() => __tick());
  await expect(page.locator('#lvxch')).toContainText('走道寬');
  await page.click('#lvxgo');
  await page.evaluate(() => { __hit = { x: 0.45, y: -0.9, z: -3 }; __tick(); });
  await page.click('#lvxgo');
  await expect(page.locator('#lvxh')).toContainText('走道寬量好了');
  await expect(page.locator('#lvxch .cu')).toContainText('門檻高');
  await page.evaluate(() => { __hit = { x: 0, y: -0.9, z: -3 }; __tick(); });
  await page.click('#lvxgo');
  await expect(page.locator('#lvxh')).toContainText('往上移到');
  await page.evaluate(() => { __cam = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -0.875, 0, 1]); __tick(); });
  await page.click('#lvxgo');
  await expect(page.locator('#lvxch .cu')).toContainText('床到浴室');
  await page.click('#lvxol'); await page.click('#lvxol');
  await expect(page.locator('#lvxol')).toContainText('（2）');
  await page.evaluate(() => { __cam = null; __hit = { x: 0, y: -0.9, z: -1 }; __tick(); });
  await page.click('#lvxgo');
  await page.evaluate(() => { __hit = { x: 0, y: -0.9, z: -5.2 }; __tick(); });
  await page.click('#lvxgo');
  await expect(page.locator('.xrov')).toHaveCount(0);
  await expect(page.locator('[data-wv="threshold"]')).toContainText('2.5 cm');
  await expect(page.locator('[data-wv="dist"]')).toContainText('4.2 公尺');
  await expect(page.locator('[data-wv="outlets"]')).toContainText('2 個');
  await page.click('.lvm [data-w="mat"][data-k="bath"][data-v="磁磚"]');
  await page.click('.lvm [data-w="mat"][data-k="wall"][data-v="待顧問確認"]');
  await page.click('.lvm [data-w="use"]');
  await expect(page.locator('#m_threshold_cm')).toHaveValue('2.5');
  await expect(page.locator('#m_bed_bath_m')).toHaveValue('4.2');
  await finish(page);
  await expect.poll(() => M.st.db.assessments.length).toBe(1);
  const d = M.st.db.assessments[0];
  expect(d.source).toBe('ar');
  expect(d.dims).toMatchObject({ corridor_mm: 900, threshold_mm: 25, bed_bath_mm: 4200, outlets: 2, materials: { bath: '磁磚', wall: '待顧問確認' }, methods: { corridor: 'xr', threshold: 'xr', dist: 'xr' } });
  expect(d.measures).toMatchObject({ corridor_cm: 90, threshold_cm: 2.5, bed_bath_m: 4.2, outlets: 2 });
  expect(errs).toEqual([]);
});

test('實用版：不支援 AR 的手機（iPhone）一次量完改逐項拍照；插座＋－、材質點選，帶回 Demo 欄位', async ({ page }, info) => {
  desktopOnly(info);
  await page.setViewportSize({ width: 390, height: 844 });
  const errs = await fresh(page, false);
  const M = familyDB();
  await toAR(page, M);
  await page.click('#arBtn');
  await expect(page.locator('.lvm')).toContainText('不支援網頁 AR');
  await expect(page.locator('.lvm [data-w="xr"]')).toHaveCount(0);
  await page.click('.lvm [data-w="one"][data-k="threshold"]');
  await expect(page.locator('.lvm').last()).toContainText('尺要立在門檻旁邊');
  await page.click('.lvm >> nth=-1 >> [data-m="close"]');
  await page.click('.lvm [data-w="ol+"]'); await page.click('.lvm [data-w="ol+"]'); await page.click('.lvm [data-w="ol-"]');
  await expect(page.locator('[data-wv="outlets"]')).toContainText('1 個');
  await page.click('.lvm [data-w="mat"][data-k="bath"][data-v="待顧問確認"]');
  await page.click('.lvm [data-w="use"]');
  await finish(page, { corridor_cm: '85', threshold_cm: '1', bed_bath_m: '3' });
  await expect.poll(() => M.st.db.assessments.length).toBe(1);
  expect(M.st.db.assessments[0].source).toBe('app');
  expect(M.st.db.assessments[0].dims).toMatchObject({ outlets: 1, materials: { bath: '待顧問確認' } });
  expect(errs).toEqual([]);
});
