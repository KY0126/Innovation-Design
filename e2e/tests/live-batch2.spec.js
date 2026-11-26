// 實用版搬遷第 2 批（生活顧問）：員工編號登入、門市電腦版與 App 顧問模式接 Supabase（模擬）
// 只看得到自己門市的家庭；方案、圖面版本、正式報價、提醒轉工單、排程派工、真實格局都寫進資料庫，家人端讀得到
const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
const { api, rpcs, familyDB, loginToApp } = require('./live-db');
const { createMock } = require('./live-mock');

const desktopOnly = (info) => test.skip(info.project.name !== 'desktop');
const ADV = 'u-adv', TECH = 'u-tech', FAM = 'u-family';
const today = () => { const d = new Date(Date.now() + 8 * 36e5); return d.toISOString().slice(0, 10); };

function staffDB() {
  const R = rpcs();
  Object.assign(R, {
    next_code: (b, st) => { const n = st.db.bookings.filter((x) => String(x.code || '').startsWith(b.p_prefix + '-')).length + 1; return b.p_prefix + '-' + String(n).padStart(2, '0'); },
    add_plan_version: (b, st) => { const L = st.db.plan_versions.filter((v) => v.household_id === b.p_hid); const ver = L.reduce((a, v) => Math.max(a, v.ver), 0) + 1; st.db.plan_versions.push({ id: st.nextId++, household_id: b.p_hid, plan_id: b.p_plan, ver, status: b.p_status, reason: b.p_reason, pins: b.p_pins, by_id: st.me.id, created_at: new Date().toISOString(), locked_at: b.p_status === '草稿' ? null : new Date().toISOString() }); return ver; },
    user_names: (b, st) => b.p_ids.map((id) => ({ id, name: (st.db.profiles.find((p) => p.id === id) || {}).display_name || '使用者' })),
  });
  const now = new Date().toISOString();
  const db = {
    profiles: [
      { id: ADV, display_name: '王顧問', role: 'advisor', store: 'Digital City 高雄民族店', disabled: false },
      { id: TECH, display_name: '李技師', role: 'tech', store: 'Digital City 高雄民族店', disabled: false, created_at: now },
      { id: FAM, display_name: '陳測試', role: 'family', is_friend: true },
    ],
    households: [
      { id: 7, elder_name: '媽媽', elder_note: '獨居，晚上會起床', store: 'Digital City 高雄民族店', phase: 1, prefs: {}, contacts: [], created_by: FAM, created_at: now },
      { id: 8, elder_name: '別家', elder_note: '', store: 'Digital City 高雄澄清店', phase: 1, prefs: {}, contacts: [], created_by: 'u-x', created_at: now },
    ],
    members: [{ household_id: 7, user_id: FAM, relation: 'child' }],
    assessments: [{ id: 1, household_id: 7, dims: { corridor_mm: 820, threshold_mm: 20, bed_bath_mm: 5200, outlets: 2 }, answers: {}, lights: [['走道', 'r', '寬 82 cm'], ['浴室', 'y', '門檻 2 cm']], created_at: now }],
    bookings: [
      { id: 21, code: 'B-' + today().replace(/-/g, '') + '-01', household_id: 7, kind: '門市諮詢', store: 'Digital City 高雄民族店', slot_start: today() + 'T19:00', status: '待指派', steps: {}, created_at: now },
      { id: 22, code: 'B-' + today().replace(/-/g, '') + '-02', household_id: 8, kind: '門市諮詢', store: 'Digital City 高雄澄清店', slot_start: today() + 'T19:30', status: '待指派', steps: {}, created_at: now },
    ],
    plans: [], plan_versions: [], work_packages: [], site_diffs: [], acceptances: [], quote_selections: [], subsidies: [], floorplans: [], audit: [], metrics: [],
    devices: [], reminders: [{ id: 31, household_id: 7, device: '感應小夜燈｜走道', kind: '更換電池', reason: '電量 15%', due: today(), status: '待處理' }],
    wishes: [], requests: [{ id: 41, household_id: 7, user_id: FAM, kind: '聯絡生活顧問', note: 'LINE 提問', status: '待處理', created_at: now }],
    care_events: [], notifications: [], quotes: [], consents: [], hh_kv: [], family_handoffs: [], orders: [], cart_items: [], wish_points: [], wish_topics: [], wish_votes: [], preorders: [],
  };
  return createMock({ db, rpc: R, staff: [{ id: ADV, email: 'e100001@staff.jiujujia.example', password: 'pw-1234' }, { id: TECH, email: 'e200001@staff.jiujujia.example', password: 'pw-5678' }],
    functions: { 'line-push': () => ({ data: { total: 1, sent: 0, line: false } }) } });
}
async function staffLogin(page, M, id = 'E100001', pw = 'pw-1234') {
  await M.install(page);
  await page.goto('/live/admin/');
  await page.fill('#gForm [name=email]', id); await page.fill('#gForm [name=password]', pw);
  await page.click('#gForm button[type=submit]');
}

test('實用版第 2 批：生活顧問用員工編號登入，轉到門市電腦版，只看得到自己門市的真實個案', async ({ page }, info) => {
  desktopOnly(info);
  const errs = await fresh(page, false);
  const M = staffDB();
  await staffLogin(page, M);
  await page.waitForURL(/consultant\.html\?mode=live/);
  await page.waitForFunction(() => window.JCON && window.JCON.ST.me && window.JCON.ST.plans[7], null, { timeout: 15000 });
  expect(await page.evaluate(() => window.JCON.ST.ids)).toEqual([7]);
  expect(await page.textContent('#who')).toBe('王顧問');
  const home = (await api(page, '/advisor/home')).body;
  expect(home.kpi).toMatchObject({ consults: 1, dispatch: 1 });
  expect(home.consults[0]).toMatchObject({ household: '媽媽家', owner: '陳測試', status: '待指派', assessment: { measures: { corridor_cm: 82, threshold_cm: 2 } } });
  expect(home.reminders[0]).toMatchObject({ household: '媽媽家', device: '感應小夜燈｜走道' });
  expect(home.techs).toEqual([{ id: TECH, name: '李技師' }]);
  const cs = (await api(page, '/advisor/cases')).body.cases;
  expect(cs.map((c) => c.hid)).toEqual([7]);
  expect(cs[0]).toMatchObject({ stage: '待問診', owner: '陳測試', assessed: true });
  // 別家門市：拒絕
  expect((await api(page, '/advisor/plan/8')).status).toBe(403);
  expect((await api(page, '/advisor/quotes/8')).body.error).toBe('只能處理自己門市的資料');
  // 待辦：處理家庭需求
  expect((await api(page, '/advisor/todos')).body.requests[0]).toMatchObject({ kind: '聯絡生活顧問', household: '媽媽家' });
  await api(page, '/admin/requests/41/done', { method: 'POST' });
  expect(M.st.db.requests[0]).toMatchObject({ status: '已處理', handled_by: ADV });
  expect(M.st.db.audit.map((a) => a.action)).toContain('處理門市待辦');
  // 家庭帳號不能走員工登入
  expect(errs).toEqual([]);
});

test('實用版第 2 批：建立方案、圖面版本、長輩確認、正式報價、勾選與補助；家人端讀得到', async ({ page }, info) => {
  desktopOnly(info);
  const errs = await fresh(page, false);
  const M = staffDB();
  await staffLogin(page, M);
  await page.waitForFunction(() => window.JCON && window.JCON.ST.me, null, { timeout: 15000 });
  expect((await api(page, '/advisor/plans', { method: 'POST', body: { household_id: 7, sel: { night: 1, strip: 1 }, plan: 'two', booking_id: 21 } })).body.error).toBe('請填寫第二聯絡人姓名');
  const r = await api(page, '/advisor/plans', { method: 'POST', body: { household_id: 7, sel: { night: 1, strip: 1 }, plan: 'two', booking_id: 21, c2n: '陳小弟', ewish: '希望浴室門口亮一點', duration_s: 900 } });
  expect(r.body).toMatchObject({ ok: true, household: '媽媽家', totals: { one: 3900 + 800 + 1200, m: 449, guard: true } });
  expect(M.st.db.plans[0]).toMatchObject({ household_id: 7, advisor_id: ADV, status: '待確認', plan_code: 'two', sel: { mgr: 1, night: 1, strip: 1, alert: 1 } });
  expect(M.st.db.bookings.find((b) => b.id === 21)).toMatchObject({ status: '已完成', assignee_id: ADV });
  expect(M.st.db.households[0]).toMatchObject({ phase: 2, contacts: [{ n: '陳小弟', r: '第二聯絡人' }] });
  expect(M.st.db.wishes[0]).toMatchObject({ source: '門市代記｜長輩', text: '希望浴室門口亮一點' });
  expect(M.st.db.metrics[0]).toMatchObject({ type: 'advisor', duration_s: 900 });
  let pv = (await api(page, '/advisor/plan/7')).body;
  expect(pv.pv).toMatchObject({ ver: 1, status: '草稿', by: '王顧問' });
  expect(pv.pv.pins.map((p) => p.id)).toEqual(['L1', 'L2', 'L3', 'D1', 'D2', 'BT', 'GW', 'N1']);
  expect(pv.pv.pins.find((p) => p.id === 'N1').label).toBe('門檻提示燈條｜浴室門檻 2 cm');
  // 調整標記（仍是草稿）→ 長輩確認鎖定 v2
  pv = (await api(page, '/advisor/plan/7/pins', { method: 'PUT', body: { pins: pv.pv.pins.slice(0, 3) } })).body;
  expect(pv.versions.length).toBe(1);
  pv = (await api(page, '/advisor/plan/7/elder-confirm', { method: 'POST' })).body;
  expect(pv.pv).toMatchObject({ ver: 2, status: '長輩已確認' });
  expect(pv.versions.map((v) => v.status)).toEqual(['已取代', '長輩已確認']);
  expect((await api(page, '/advisor/plan/7/elder-confirm', { method: 'POST' })).body.error).toBe('v2 已鎖定，不需要重複確認');
  // 勾選、補助、正式報價
  await api(page, '/advisor/selections/7', { method: 'PUT', body: { sel: { 走道: [1] } } });
  expect((await api(page, '/advisor/selections/7')).body.sel).toEqual({ 走道: [1] });
  await api(page, '/advisor/subsidy/7', { method: 'PUT', body: { data: { 長照: true } } });
  expect((await api(page, '/advisor/subsidy/7')).body.data).toEqual({ 長照: true });
  expect((await api(page, '/advisor/quotes/7', { method: 'POST', body: { total: 6700, pending: 1, items: [{ n: '感應夜燈', p: 900 }], at: '11/27 15:00' } })).body).toEqual({ v: 1 });
  expect((await api(page, '/advisor/quotes/7')).body.quotes[0]).toMatchObject({ v: 1, total: 6700, pending: 1, status: '待長輩確認', at: '11/27 15:00' });
  expect(M.st.calls.some((c) => c.name === 'line-push' && c.body.action === 'quote')).toBe(true);
  expect(M.st.db.notifications.map((n) => n.title)).toEqual(['生活顧問送出改善方案', '正式報價第 1 版']);
  const dr = (await api(page, '/advisor/drafts')).body.drafts;
  expect(dr).toEqual([expect.objectContaining({ hid: 7, elder_name: '媽媽' })]);
  expect(errs).toEqual([]);
});

test('實用版第 2 批：提醒轉維護工單、排程派工（工作包指派技師）、差異回報核准產生新版本', async ({ page }, info) => {
  desktopOnly(info);
  const errs = await fresh(page, false);
  const M = staffDB();
  await staffLogin(page, M);
  await page.waitForFunction(() => window.JCON && window.JCON.ST.me, null, { timeout: 15000 });
  const d = (await api(page, '/advisor/reminders/31/draft', { method: 'POST' })).body;
  expect(d).toEqual({ ok: true, code: 'M-' + today().replace(/-/g, '') + '-01' });
  const b = M.st.db.bookings.find((x) => x.code === d.code);
  expect(b).toMatchObject({ kind: '設備維護', status: '待確認', household_id: 7, created_by: ADV });
  expect(M.st.db.work_packages).toEqual([expect.objectContaining({ booking_id: b.id, code: 'S', name: '設備檢修' })]);
  expect(M.st.db.reminders[0]).toMatchObject({ status: '已建立工單', booking_id: b.id });
  expect((await api(page, '/advisor/home')).body.drafts[0]).toMatchObject({ household: '媽媽家', packages: ['設備檢修'], by_family: false });
  // 排程：日期不能早於現在；選技師
  expect((await api(page, '/admin/installs/' + b.id + '/schedule', { method: 'POST', body: { date: '2020-01-01', time: '10:00', tech_id: TECH } })).body.error).toBe('到府時間不能早於現在');
  const day = new Date(Date.now() + 3 * 864e5 + 8 * 36e5).toISOString().slice(0, 10);
  const s = (await api(page, '/admin/installs/' + b.id + '/schedule', { method: 'POST', body: { date: day, time: '10:00', tech_id: TECH } })).body;
  expect(s.ok).toBe(true);
  expect(b).toMatchObject({ status: '已指派', assignee_id: TECH, slot_start: day + 'T10:00' });
  expect(M.st.db.work_packages[0].assignee_id).toBe(TECH);
  expect(M.st.db.reminders[0].status).toBe('已派工');
  // 技師回報差異（第 3 批由技師送出；這裡直接放進資料庫）→ 核准
  await api(page, '/advisor/plans', { method: 'POST', body: { household_id: 7, sel: { night: 1 }, c2n: '陳小弟' } });
  M.st.db.site_diffs.push({ id: 51, booking_id: b.id, household_id: 7, pkg: 'B', pin_id: 'L2', level: '暫停', text: '走道插座被鞋櫃擋住，夜燈改裝對面', move: { x: 4.6, y: 3.9 }, status: '待審核', by_name: '李技師', created_at: new Date().toISOString() });
  expect((await api(page, '/advisor/home')).body.insight).toBe('媽媽家的技師暫停施工等您核准，請先處理差異回報。');
  const pv = (await api(page, '/advisor/diffs/51', { method: 'POST', body: { action: 'approve', note: '同意' } })).body;
  expect(pv.pv).toMatchObject({ ver: 2, status: '差異已核准' });
  expect(pv.pv.pins.find((p) => p.id === 'L2')).toMatchObject({ x: 4.6, y: 3.9, note: '走道插座被鞋櫃擋住，夜燈改裝對面' });
  expect(M.st.db.site_diffs[0]).toMatchObject({ status: '已核准', new_ver: 2, reviewed_by: ADV });
  expect((await api(page, '/advisor/diffs/51', { method: 'POST', body: { action: 'approve' } })).body.error).toBe('這則回報已審核');
  expect(errs).toEqual([]);
});

test('實用版第 2 批：生活顧問畫真實格局，家人的施工圖改用自己家的格局', async ({ page }, info) => {
  desktopOnly(info);
  const errs = await fresh(page, false);
  const M = staffDB();
  await staffLogin(page, M);
  await page.waitForFunction(() => window.JCON && window.JCON.ST.me && window.JJJLAYOUT, null, { timeout: 15000 });
  await page.evaluate(() => { window.JCON.ST.view = 'case'; window.JCON.ST.hid = 7; window.JCON.render(); });
  await page.click('.lv-fp [data-lvfp="7"]');
  await expect(page.locator('.lvfp [role=dialog], .lvfp')).toBeVisible();
  await expect(page.locator('#lvfpPv svg')).toBeVisible();
  await page.fill('.lvfp [data-k="hall"]', '820');
  await page.fill('.lvfp [data-k="bed"]', '3600');
  await page.selectOption('.lvfp [data-fin="bath"]', 'wood');
  await page.fill('.lvfp [name=note]', '中山路 12 號');
  await page.click('.lvfp [data-x="save"]');
  await expect(page.locator('#lvfpE')).toHaveText('備註不寫地址或門牌');
  await page.fill('.lvfp [name=note]', '浴室門往內開');
  await page.click('.lvfp [data-x="save"]');
  await expect(page.locator('.lvfp')).toHaveCount(0);
  expect(M.st.db.floorplans[0]).toMatchObject({ household_id: 7, updated_by: ADV, note: '浴室門往內開', layout: { hall: 820, bed: 3600, fin: { bath: 'wood' } } });
  await expect(page.locator('.lv-fp')).toContainText('已畫好');
  // 換算：走道改 82 cm、臥室 3.6 m，模板的牆跟著移動
  const r = await page.evaluate(() => { const K = window.JJJCAD; return { hall: K.ROOMS.hall.slice(1, 5), bath: K.ROOMS.bath.slice(1, 6) }; });
  expect(r.hall).toEqual([0, 3500, 9000 - 400, 820]);
  expect(r.bath).toEqual([3600, 0, 2200, 3500, 'wood']);
  expect(errs).toEqual([]);
});

test('實用版第 2 批：家人首頁讀到真實格局，施工圖與 3D 標示「您家的格局」', async ({ page }, info) => {
  desktopOnly(info);
  const errs = await fresh(page, false);
  const M = familyDB({ extra: { floorplans: [{ household_id: 7, layout: { bed: 3600, bath: 2000, ldy: 2400, kit: 3000, top: 3200, hall: 900, bot: 3000 }, updated_at: '2026-11-27T03:00:00Z' }], plan_versions: [], work_packages: [], acceptances: [] } });
  await loginToApp(page, M);
  await page.waitForFunction(() => window.JJJLAYOUT && window.JJJLAYOUT.home());
  expect(await page.evaluate(() => window.JJJLAYOUT.home().hall)).toBe(900);
  // 打開施工圖會載入 cad.js，牆跟著換算；揪心願回到範本房子
  const r = await page.evaluate(() => { const K = window.JJJCAD; K.plan('全屋', []); return K.ROOMS.hall.slice(1, 5); });
  expect(r).toEqual([0, 3200, 8000, 900]);
  await page.evaluate(() => { window.JJJAPP.S.stack.push('wk'); window.JJJCAD.plan('全屋', []); });
  expect(await page.evaluate(() => window.JJJCAD.ROOMS.hall.slice(1, 5))).toEqual([0, 3500, 9000, 1100]);
  expect(errs).toEqual([]);
});

test('實用版第 2 批：生活顧問在手機 App 進入顧問模式（今日行程、案件）', async ({ page }, info) => {
  desktopOnly(info);
  await page.setViewportSize({ width: 390, height: 844 });
  const errs = await fresh(page, false);
  const M = staffDB();
  await staffLogin(page, M);
  await page.waitForURL(/consultant\.html/);
  await page.goto('/live/app/');
  await page.waitForFunction(() => window.JJJAPP && window.JJJAPP.S.me && window.JJJAPP.S.stack[0] === 'a1', null, { timeout: 15000 });
  await expect(page.locator('#view')).toContainText('媽媽家');
  expect(await page.evaluate(() => window.JJJAPP.S.me.role)).toBe('advisor');
  // 家庭端 API 拒絕員工帳號
  expect((await api(page, '/home')).body.error).toBe('這是員工帳號，請改用員工畫面');
  expect(errs).toEqual([]);
});
