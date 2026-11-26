// L2 整合：不點畫面，直接經 /api 走「建作品、存座標、共鳴資格、門檻」（R8、R10、M9）
const { test, expect, fresh, J, login } = require('../_pw.cjs');

test('建作品：零件 mm 座標原樣存回，新作品在第 1 關（30 天 20 戶）', async ({ page }) => {
  const errs = await fresh(page); await login(page, 'li@example.com');
  const build = [{ slot: 0, part: 'light', x: 2800, y: 700 }, { slot: 1, part: 'rail', x: 6050, y: 1500 }];
  const r = await J(page, '/wish/works', { method: 'POST', body: { title: '整合測試作品', field: '臥室到浴室', story: { who: '長輩', when: '晚上', stuck: '找不到開關', hope: '整合測試作品' }, build, cparts: [], terms: { rules: true, license: true } } });
  expect(r._s).toBeLessThan(300); expect(r.id).toBeTruthy();
  const w = (await J(page, '/wish/works/' + r.id)).work;
  expect(w.build.map(b => [b.part, b.x, b.y])).toEqual([['light', 2800, 700], ['rail', 6050, 1500]]);
  expect(w.stage.label).toContain('第 1 關：30 天內 20 戶');
  expect(errs).toEqual([]);
});

test('R8：全屋作品需要訂閱揪全家，沒訂閱的家庭按「我也需要」回 403', async ({ page }) => {
  await fresh(page); await login(page, 'li@example.com');
  const whole = (await J(page, '/wish/works?tab=all')).works.find(w => w.field === '全屋');
  expect(whole).toBeTruthy();
  const r = await J(page, `/wish/works/${whole.id}/support`, { method: 'POST', body: { buy: '會', price: '500 元內' } });
  expect(r._s).toBe(403);
});

test('R8：補到 99 戶後再一戶，作品進入「已達 100 戶，進入每季審查」', async ({ page }) => {
  await fresh(page); await login(page, 'li@example.com');
  const dim = (await J(page, '/wish/works?tab=all')).works.find(w => w.title === '可調光感應夜燈');
  await page.evaluate(id => { __DBW.prepare('UPDATE wish_works SET base=99 WHERE id=?').run(id); }, dim.id);
  const r = await J(page, `/wish/works/${dim.id}/support`, { method: 'POST', body: { buy: '會', price: '500–1,000 元' } });
  expect(r._s).toBeLessThan(300);
  const w = (await J(page, '/wish/works/' + dim.id)).work;
  expect(w.count).toBe(100); expect(w.stage.label).toContain('進入每季審查');
});
