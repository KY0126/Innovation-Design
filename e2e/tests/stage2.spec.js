// 決選對齊：企業管理端「投資效益」財務模擬與 App 階段路線
const { test } = require('@playwright/test');
const { fresh, expect } = require('./helpers');

test('投資效益：基準情境與計畫書一致（194 戶、第 11 月轉正、第 27 月回本），拖動參數會重算', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/admin.html');
  await page.click('#gate [data-demo="manager@example.com"]'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.JJJA.go('vc')); await page.waitForTimeout(500);
  const v = page.locator('#view');
  await expect(v).toContainText('194 戶（加顧問後 310 戶）');
  await expect(v).toContainText('第 11 月');
  await expect(v).toContainText('第 27 月');
  await expect(v).toContainText('−22.4 萬');
  await page.locator('#fm-n').fill('30'); await page.waitForTimeout(300);
  await expect(v).toContainText('第 17 月');
  await page.click('[data-a="fmReset"]');
  await expect(v).toContainText('第 27 月');
  expect(errs).toEqual([]);
});

test('預約門市：後端門市清單含三民中華店', async ({ page }) => {
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html');
  const js = await page.evaluate(() => fetch('/jiujujia/backend.js').then(r => r.text()));
  const esc = t => [...t].map(c => c.charCodeAt(0) < 128 ? c : '\\u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join('');
  expect(js).toContain(esc('Digital City 高雄三民中華店'));
  expect(errs).toEqual([]);
});

test('營運階段開關：企業管理端切到擴展期後，App 揪全家可選、全家場域可加購；商用版依階段顯示', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/admin.html');
  await page.click('#gate [data-demo="manager@example.com"]'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.JJJA.go('phase')); await page.waitForTimeout(400);
  const v = page.locator('#view');
  await expect(v).toContainText('營運階段開關');
  await page.click('[data-ph="擴展期"]');
  await expect(page.locator('[data-ph="擴展期"]')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.JJJA.go('biz')); await page.waitForTimeout(400);
  await expect(v).toContainText('產險公司');
  await expect(v.locator('tr', { hasText: '產險公司' })).toContainText('合作中');
  await expect(v.locator('tr', { hasText: '建商' })).toContainText('洽談中');

  const app = await context.newPage(); const aerr = []; app.on('pageerror', e => aerr.push(e.message));
  await app.goto('/jiujujia/app.html');
  await app.click('[data-demo="chen@example.com"]'); await app.waitForTimeout(3000);
  for (const x of ['x0', 'x24', 'x25', 'x26', 'x27', 'x28', 'x29', 'x30', 'x31', 'x32', 'x33', 'x34']) {
    await app.evaluate(x => window.JJJ.go(x), x); await app.waitForTimeout(150);
    await expect(app.locator('#view h1').last()).not.toBeEmpty();
  }
  await app.evaluate(() => window.JJJ.go('x24')); await app.waitForTimeout(200);
  await expect(app.locator('#view')).toContainText('擴展期已開放');
  for (const k of ['food', 'tv', 'wash']) await app.click(`[data-x24="${k}"]`);
  await expect(app.locator('#view')).toContainText('每月可省 200 元');
  await app.evaluate(() => window.JJJ.go('x33')); await app.waitForTimeout(200);
  await expect(app.locator('#view')).toContainText('延伸期開放');

  const biz = await context.newPage(); const berr = []; biz.on('pageerror', e => berr.push(e.message));
  await biz.goto('/jiujujia/business.html');
  await expect(biz.locator('#ban')).toContainText('示範預覽');
  await expect(biz.locator('#who')).toContainText('日照據點');
  await expect(biz.locator('#desk')).toContainText('午休室');
  await page.evaluate(() => window.JJJA.go('phase')); await page.waitForTimeout(300);
  await page.click('[data-ph="延伸期"]');
  await biz.reload();
  await expect(biz.locator('#ban')).toContainText('延伸期已開放');
  await page.click('[data-ph="試點期"]');
  expect([...errs, ...aerr, ...berr]).toEqual([]);
});

test('分享連結 ?phase= 帶入階段；顧問端與 App 既有畫面入口依階段顯示', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  // 企業管理端營運階段頁有分享連結
  const adm = await context.newPage(); const aerr = []; adm.on('pageerror', e => aerr.push(e.message));
  await adm.goto('/jiujujia/admin.html');
  await adm.click('#gate [data-demo="manager@example.com"]'); await adm.waitForTimeout(2500);
  await adm.evaluate(() => window.JJJA.go('phase')); await adm.waitForTimeout(300);
  // 營運階段存在資料庫，預設全部開放（延伸期）
  await expect(adm.locator('[data-plink="business.html"]')).toHaveAttribute('href', /phase=ext/);
  expect(await adm.evaluate(() => Object.keys(localStorage).filter(k => k === 'jjj_phase'))).toEqual([]);
  await adm.close();
  // 網址參數帶入擴展期
  await page.goto('/jiujujia/app.html?phase=exp');
  expect(await page.evaluate(async () => { await window.JJJPHASE_READY; return window.JJJPHASE(); })).toBe(1);
  await page.click('[data-demo="chen@example.com"]'); await page.waitForTimeout(3000);
  // F01／F02 → 揪居家主頁（長輩家）有其他場域入口；切到我家有育兒與寵物
  await page.evaluate(() => window.JJJ.go('m2')); await page.waitForTimeout(300);
  await expect(page.locator('#view')).toContainText('揪居家接下來會開放');
  await expect(page.locator('#view [data-go="x24"]')).toBeVisible();
  await page.click('[data-home="mine"]'); await page.waitForTimeout(300);
  await expect(page.locator('#view [data-go="x34"]')).toBeVisible();
  // F15 家電健康卡 → F27
  const id = await page.evaluate(() => (window.JJJ.S.hh.devices[0] || {}).id);
  if (id !== undefined) {
    await page.evaluate(i => { window.JJJ.S.hc = i; window.JJJ.go('hc'); }, id); await page.waitForTimeout(300);
    await page.click('#view [data-go="x27"]');
    await expect(page.locator('#view')).toContainText('先保養延壽');
  }
  // 生活顧問（電腦版）顯示目前階段與擴展期加購提示
  const con = await context.newPage(); const cerr = []; con.on('pageerror', e => cerr.push(e.message));
  await con.goto('/jiujujia/consultant.html');
  await con.click('#cLogin [data-demo]'); await con.waitForTimeout(2500);
  await expect(con.locator('#phaseChip')).toContainText('擴展期');
  // 網址參數切回試點期
  await con.goto('/jiujujia/consultant.html?phase=pilot'); await con.waitForTimeout(2000);
  await expect(con.locator('#phaseChip')).toContainText('試點期');
  expect([...errs, ...cerr, ...aerr]).toEqual([]);
});

test('U3 校園大使短影音：試點期不可上傳；擴展期勾滿四項才可送審；企業管理端有審核清單', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html?phase=pilot');
  await page.click('[data-demo="chen@example.com"]'); await page.waitForTimeout(3000);
  await page.evaluate(() => window.JJJ.go('u3')); await page.waitForTimeout(300);
  await expect(page.locator('#view')).toContainText('擴展期開放後即可上傳');
  await page.goto('/jiujujia/app.html?phase=exp'); await page.waitForTimeout(2500);
  await page.evaluate(() => window.JJJ.go('u3')); await page.waitForTimeout(300);
  await page.click('[data-u3t="t1"]');
  for (const k of ['a', 'b', 'c']) await page.click(`[data-u3="${k}"]`);
  await expect(page.locator('[data-u3send]')).toHaveCount(0);
  await page.click('[data-u3="d"]');
  await page.click('[data-u3send]');
  await expect(page.locator('#view')).toContainText('已送審');
  const adm = await context.newPage(); const aerr = []; adm.on('pageerror', e => aerr.push(e.message));
  await adm.goto('/jiujujia/admin.html');
  await adm.click('#gate [data-demo="manager@example.com"]'); await adm.waitForTimeout(2500);
  await adm.evaluate(() => window.JJJA.go('amb')); await adm.waitForTimeout(400);
  await expect(adm.locator('#view')).toContainText('短影音審核');
  expect([...errs, ...aerr]).toEqual([]);
});

test('右下角浮動元件不蓋住主要按鈕（捲到底後）', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html');
  await page.click('[data-demo="chen@example.com"]'); await page.waitForTimeout(3000);
  for (const v of ['b4', 'm2', 'pl', 'x24', 'u3']) {
    await page.evaluate(v => { window.JJJ.S.stack = ['home']; window.JJJ.go(v); }, v); await page.waitForTimeout(300);
    const hit = await page.evaluate(() => {
      document.querySelectorAll('.scroll').forEach(s => s.scrollTop = 1e6);
      const fl = ['#jgOpen', '#webDemo'].map(s => document.querySelector(s)).filter(e => e && e.getClientRects().length).map(e => e.getBoundingClientRect());
      return [...document.querySelectorAll('#view .btn')].filter(b => { const r = b.getBoundingClientRect(); return r.height && fl.some(f => r.left < f.right && f.left < r.right && r.top < f.bottom && f.top < r.bottom); }).map(b => b.textContent.trim());
    });
    expect(hit, v).toEqual([]);
  }
  expect(errs).toEqual([]);
});

test('揪心願（參考 LEGO Ideas）：寫作模板＋標籤、阿國比對相似心願與四不提醒、三段門檻、企業管理端每季審查與標籤統計', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html?phase=pilot');
  await page.click('[data-demo="chen@example.com"]'); await page.waitForTimeout(3000);
  await page.evaluate(() => window.JJJ.go('wish')); await page.waitForTimeout(300);
  const v = page.locator('#view');
  await expect(v).toContainText('官方寫作模板');
  // 未填希望不能送出
  await page.click('[data-a="wishSend"]');
  await expect(page.locator('#view')).toContainText('官方寫作模板');
  // 相似心願：寫到夜燈 → 阿國建議去共鳴
  await page.fill('[data-wf="stuck"]', '感應夜燈太亮，很刺眼'); await page.waitForTimeout(900);
  await expect(v).toContainText('找到相似心願');
  // 四不：寫品牌 → 提醒並停用送出
  await page.fill('[data-wf="hope"]', '想要飛利浦的夜燈'); await page.waitForTimeout(900);
  await expect(v).toContainText('不指名品牌');
  await expect(page.locator('[data-a="wishSend"]')).toBeDisabled();
  await page.fill('[data-wf="hope"]', '亮度可以調低的感應夜燈'); await page.waitForTimeout(900);
  await page.click('[data-wneed="防跌照明"]');
  // 試點期選廚房 → 說明會累積為擴展期證據
  await page.click('[data-wfield="廚房"]');
  await expect(v).toContainText('擴展期開放新場域的需求證據');
  await page.click('[data-wfield="臥室到浴室"]');
  await page.click('[data-a="wishSend"]'); await page.waitForTimeout(1200);
  await expect(page.locator('#view')).not.toContainText('官方寫作模板');
  // 心願牆：標籤、三段門檻、擴展期證據卡、標籤篩選
  await page.evaluate(() => window.JJJ.go('wall')); await page.waitForTimeout(1200);
  await expect(v).toContainText('#防跌照明');
  await expect(v).toContainText('第 2 關：90 天內 50 戶');
  await expect(v).toContainText('擴展期證據');
  await page.click('[data-wtag="聯絡與陪伴"]');
  await expect(v).toContainText('睡前語音報平安');
  await expect(v).not.toContainText('浴室門口止滑地墊');
  // 企業管理端
  const adm = await context.newPage(); const aerr = []; adm.on('pageerror', e => aerr.push(e.message));
  await adm.goto('/jiujujia/admin.html');
  await adm.click('#gate [data-demo="manager@example.com"]'); await adm.waitForTimeout(2500);
  await adm.evaluate(() => window.JJJA.go('wish')); await adm.waitForTimeout(500);
  await expect(adm.locator('#view')).toContainText('每季審查');
  await expect(adm.locator('#view')).toContainText('標籤統計');
  expect([...errs, ...aerr]).toEqual([]);
});

test('揪心願完整版：拼預覽圖→做法卡→照做／改版闖關→新心願；我家出題／全國出題；闖關點數與提示音；包裝與標語；企業管理端出題與點數檢核', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page);
  await page.goto('/jiujujia/app.html?phase=pilot');
  await page.click('[data-demo="chen@example.com"]'); await page.waitForTimeout(3000);
  const v = page.locator('#view');
  // 標語
  await page.evaluate(() => window.JJJ.go('m2')); await page.waitForTimeout(300);
  await expect(v).toContainText('揪居家，讓家更有電');
  // 拼出預覽圖
  await page.evaluate(() => window.JJJ.go('wish')); await page.waitForTimeout(300);
  await page.click('#view button[data-go="wbuild"]'); await page.waitForTimeout(300);
  await expect(v).toContainText('先擺一個零件');
  await page.click('[data-bitem="light"]');
  await page.click('[data-bslot="0"]'); await page.click('[data-bslot="2"]');
  await page.click('[data-bitem="rail"]'); await page.click('[data-bslot="5"]');
  await page.click('[data-bnight="1"]');
  await page.click('#view button[data-go="wcard"]'); await page.waitForTimeout(300);
  // 做法卡：零件清單、步驟、需技師、分享 QR
  await expect(v).toContainText('感應夜燈 ×2');
  await expect(v).toContainText('含需技師步驟');
  await expect(v).toContainText('請生活顧問安排技師照這份做法施工');
  await expect(v.locator('svg[aria-label*="QR"]')).toHaveCount(1);
  await page.click('[data-wdo="2"]');
  // 改版：必填、換角度、轉成新心願
  await page.click('#view button[data-go="wremix"]'); await page.waitForTimeout(300);
  await page.click('[data-wdo="3"]');
  await expect(v).toContainText('我改了這樣做');
  await page.fill('[data-rm="what"]', '把床邊夜燈換成床底燈條');
  await page.fill('[data-rm="why"]', '光從下面來比較不刺眼');
  await page.click('[data-rang]');
  await expect(v).toContainText('💡');
  await page.click('[data-wdo="3"]');
  await page.fill('[data-rm="q3"]', '可以貼在床底的長條感應燈');
  await page.click('[data-wnew="1"]'); await page.waitForTimeout(300);
  await expect(page.locator('[data-wf="hope"]')).toHaveValue('可以貼在床底的長條感應燈');
  await expect(v).toContainText('已附 3 個零件的做法卡');
  // 闖關：點數 150，提示音可按
  await page.evaluate(() => window.JJJ.go('wquest')); await page.waitForTimeout(300);
  await expect(v).toContainText('150');
  await expect(v).toContainText('擴展期開放');
  await page.click('[data-chime]');
  // 全國出題
  await page.evaluate(() => window.JJJ.go('wall')); await page.waitForTimeout(1200);
  await expect(v).toContainText('做過 62 戶');
  await expect(v).toContainText('從自己家遇到的問題出發');
  await page.click('[data-wline="hq"]');
  await expect(v).toContainText('全國電子出題，揪全國的家庭一起想');
  await expect(v).toContainText('好鄰居題');
  await expect(v).not.toContainText('床邊大按鍵開關');
  await page.click('[data-wtheme="nb"]'); await page.waitForTimeout(300);
  await expect(v).toContainText('全國出題｜全國電子｜揪感心');
  // 預購頁包裝示意
  await page.evaluate(() => window.JJJ.go('pre')); await page.waitForTimeout(1200);
  await expect(v).toContainText('揪心願｜由陳小姐家庭提案');
  // 企業管理端
  const adm = await context.newPage(); const aerr = []; adm.on('pageerror', e => aerr.push(e.message));
  await adm.goto('/jiujujia/admin.html');
  await adm.click('#gate [data-demo="manager@example.com"]'); await adm.waitForTimeout(2500);
  await adm.evaluate(() => window.JJJA.go('wish')); await adm.waitForTimeout(500);
  await expect(adm.locator('#view')).toContainText('全國出題');
  await expect(adm.locator('#view')).toContainText('做過／改版');
  await adm.locator('[data-a="ptOk"]').first().click();
  await expect(adm.locator('#view')).toContainText('已入帳');
  expect([...errs, ...aerr]).toEqual([]);
});
