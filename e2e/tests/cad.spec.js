const { test } = require('playwright/test');
const { fresh, expect, tapDemo } = require('./helpers');
const app = (page, f) => page.evaluate(new Function('return (' + f + ')(window.JJJAPP)'));
const login = async (page, email) => { await page.goto('/jiujujia/app.html'); await tapDemo(page, `[data-demo="${email}"]`); await page.waitForTimeout(1500); };

test('揪心願白板：業界平面圖、拖曳零件、移動、復原、離牆提示、3D、關燈看看、作品頁施工圖', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page); await login(page, 'li@example.com');
  await app(page, "A=>{A.S.stack=['home','m2'];A.render()}");
  await page.click('[data-wcreate]');
  await page.fill('[data-wst="hope"]', '浴室扶手');
  await page.click('[data-wnext="1"]');
  // 業界圖面：雙線牆斜線填充、門窗編號、軸線、房名坪數
  const svg = page.locator('.wcad svg');
  await expect(svg).toBeVisible();
  await expect(svg.locator('pattern#cbrk')).toHaveCount(1);
  await expect(svg).toContainText('D1'); await expect(svg).toContainText('W1'); await expect(svg).toContainText('臥室'); await expect(svg).toContainText('m²');
  // 從零件盤拖到平面圖
  await page.click('[data-wcat="止滑扶手"]');
  const tile = page.locator('.wtile[data-wsel="rail"]'), tb = await tile.boundingBox(), sb = await svg.boundingBox();
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await page.mouse.down();
  await page.mouse.move(tb.x + tb.width / 2, tb.y - 40, { steps: 4 });
  await page.mouse.move(sb.x + sb.width * .5, sb.y + sb.height * .5, { steps: 8 }); await page.mouse.up();
  await expect(page.locator('[data-wpin]')).toHaveCount(1);
  let b = await app(page, 'A=>A.S.wn.build');
  expect(b[0].part).toBe('rail'); expect(b[0].x).toBeGreaterThan(0);
  // 放在房間中間：扶手要裝牆上，會提示
  await expect(page.locator('.wpk')).toContainText('E1');
  await expect(page.locator('.wwarn')).toContainText('請拖到牆邊');
  // 拖到牆邊後提示消失
  const pin = page.locator('[data-wpin="0"]'), pb = await pin.boundingBox();
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2); await page.mouse.down();
  const wall = await page.evaluate(() => { const sv = document.querySelector('.wcad svg'), m = sv.getScreenCTM(); return [m.a * 5600 + m.e, m.d * 300 + m.f]; });
  await page.mouse.move(wall[0], wall[1], { steps: 8 }); await page.mouse.up();
  b = await app(page, 'A=>A.S.wn.build');
  expect(Math.abs(b[0].x - 5600)).toBeLessThan(120);
  await expect(page.locator('.wwarn')).toHaveCount(0);
  // 復原回到移動前
  await page.click('[data-wundo]');
  b = await app(page, 'A=>A.S.wn.build');
  expect(Math.abs(b[0].x - 5600)).toBeGreaterThan(300);
  // 還沒放燈：關燈看看不能開
  await page.click('[data-wnight]');
  expect(await app(page, 'A=>!!A.S.wn.night')).toBe(false);
  // 點選放置（無拖曳）
  await page.click('[data-wcat="照明"]'); await page.click('[data-wsel="light"]'); await page.click('[data-wcad]', { position: { x: 60, y: 70 } });
  await expect(page.locator('[data-wpin]')).toHaveCount(2);
  // 3D 與夜間
  await page.click('[data-wview="3d"]');
  await expect(page.locator('.w3d canvas, .w3d .muted').first()).toBeVisible();
  await page.click('[data-wview="2d"]');
  await expect(page.locator('[data-wpin]')).toHaveCount(2);
  // 關燈看看：左右對照、拖曳中間的軸；開啟時零件盤暫停
  await page.click('[data-wnight]');
  await expect(page.locator('.wcmp')).toBeVisible();
  await expect(page.locator('.wcmp-l')).toHaveText('裝之前'); await expect(page.locator('.wcmp-r')).toHaveText('裝之後');
  await expect(page.locator('.wpal')).toHaveClass(/dim/);
  await expect(page.locator('.wnst')).toContainText('的路照得到');
  const cb = await page.locator('.wcmp').boundingBox();
  await page.mouse.move(cb.x + cb.width * .5, cb.y + cb.height * .5); await page.mouse.down(); await page.mouse.move(cb.x + cb.width * .2, cb.y + cb.height * .5, { steps: 5 }); await page.mouse.up();
  expect(await app(page, 'A=>Math.round(A.S.wcmpPos)')).toBeLessThan(30);
  await page.focus('.wcmp-h'); await page.keyboard.press('ArrowRight');
  expect(await app(page, 'A=>Math.round(A.S.wcmpPos)')).toBeLessThan(35);
  await page.click('[data-wview="3d"]');
  await expect(page.locator('.w3d .wcmp-h, .w3d .muted').first()).toBeVisible();
  await page.click('[data-wview="2d"]'); await page.click('[data-wnight]');
  await expect(page.locator('[data-wpin]')).toHaveCount(2);
  // 做法卡：平面配置圖＋設備表
  await page.click('[data-wnext="2"]');
  await expect(page.locator('#view')).toContainText('設備表');
  await expect(page.locator('#view .wsr')).toHaveCount(2);
  await expect(page.locator('#view .wsr').first()).toContainText('技師安裝');
  await page.click('[data-wnext="3"]'); await page.click('[data-wterm="rules"]'); await page.click('[data-wterm="license"]'); await page.click('[data-wsend]');
  await expect(page.locator('.top h1')).toHaveText('作品');
  // 作品頁：座標有存下來；平面圖、3D、夜間分頁；設備施工圖
  const w = await app(page, 'A=>A.S.wkd');
  expect(w.build.every(x => x.x > 0 && x.y > 0)).toBe(true);
  await expect(page.locator('#view svg.cad')).toBeVisible();
  await page.click('[data-wkv="3d"]'); await expect(page.locator('[data-w3d]')).toBeVisible();
  await page.click('[data-wkv="2d"]');
  await page.click('[data-wkn]'); await expect(page.locator('.wcmp')).toBeVisible(); await expect(page.locator('[data-wkn]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('[data-wkn]'); await expect(page.locator('.wcmp')).toHaveCount(0);
  await page.click('[data-wsheet]');
  await expect(page.locator('.sheet')).toContainText('設備施工圖 E-01');
  await expect(page.locator('.sheet')).toContainText('H=700–1500');
  await page.click('[data-wsheetx]');
  await expect(page.locator('.sheet')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('舊作品沒有座標時，用擺放位置畫在平面圖上', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page); await login(page, 'li@example.com');
  const id = await page.evaluate(async () => { const r = await fetch('/api/wish/works?tab=all', { headers: { 'X-JJJ': '1' } }); return (await r.json()).works.find(w => w.title === '可調光感應夜燈').id; });
  await page.evaluate(i => window.JJJWISH.openWk(i), id);
  await expect(page.locator('#view svg.cad')).toBeVisible();
  await expect(page.locator('#view svg.cad')).toContainText('E4');
  expect(errs).toEqual([]);
});

test('作品沒有會發光的零件時，作品頁不放關燈看看', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page); await login(page, 'li@example.com');
  const id = await page.evaluate(async () => { const r = await fetch('/api/wish/works?tab=all', { headers: { 'X-JJJ': '1' } }); return (await r.json()).works.find(w => !w.build.some(b => b.part === 'light' || b.part === 'strip')).id; });
  await page.evaluate(i => window.JJJWISH.openWk(i), id);
  await expect(page.locator('#view svg.cad')).toBeVisible();
  await expect(page.locator('[data-wkn]')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('技師施工圖：業界畫法、依工種自動開圖層、顯示範圍、展開某區放大', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  const errs = await fresh(page); await page.goto('/jiujujia/app.html'); await tapDemo(page, '[data-demo="tech@example.com"]'); await page.waitForTimeout(1500);
  await page.locator('[data-a="tOpen"]').first().click();
  await expect(page.locator('.tcad svg.cad')).toBeVisible();
  // 吳技師負責關懷設備：預設只開弱電與感測
  await expect(page.locator('.tlhead')).toContainText('弱電與感測');
  await expect(page.locator('.tlhead')).toContainText('未開圖層');
  const n0 = await page.locator('.tcad [data-tpin]').count();
  await page.click('[data-tlayo]');
  await page.click('[data-tlay="lite"]');
  expect(await page.locator('.tcad [data-tpin]').count()).toBeGreaterThan(n0);
  await page.click('[data-tscope="all"]'); await expect(page.locator('[data-tscope="all"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('[data-tlayo]');
  await page.click('[data-tgrp="浴室"]');
  await expect(page.locator('.tlhead')).toContainText('放大：浴室');
  await page.click('[data-tzoom="0"]'); await expect(page.locator('.tlhead')).not.toContainText('放大：浴室');
  expect(errs).toEqual([]);
});
