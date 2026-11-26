// 實用版搬遷第 3 批（技師）：工單、工作包（先夜間照明 B，再關懷設備 A）、步驟、圖面標記、差異回報、長輩驗收
// 技師只能動指派給自己的工單；驗收通過時工單完成、長輩家進入關懷中、登錄到府安裝的設備
const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
const { api, rpcs } = require('./live-db');
const { createMock } = require('./live-mock');

const desktopOnly = (info) => test.skip(info.project.name !== 'desktop');
const TECH = 'u-tech', TECH2 = 'u-tech2', FAM = 'u-family';
const now = new Date().toISOString();
const ymd = (d) => new Date(d.getTime() + 8 * 36e5).toISOString().slice(0, 10);

function techDB() {
  const R = rpcs();
  Object.assign(R, {
    user_names: (b, st) => b.p_ids.map((id) => ({ id, name: (st.db.profiles.find((p) => p.id === id) || {}).display_name || '使用者' })),
    install_finish: (b, st) => {
      const x = st.db.bookings.find((y) => y.id === b.p_booking);
      if (x.status !== '待驗收') return { __err: '全部施工完成後才能請長輩驗收' };
      st.db.acceptances.push({ id: st.nextId++, booking_id: x.id, household_id: x.household_id, result: b.p_accept ? '通過' : '退回', by_role: b.p_by_role, by_name: b.p_by_name, items: b.p_items, note: b.p_note, created_at: new Date().toISOString() });
      const h = st.db.households.find((y) => y.id === x.household_id);
      if (b.p_accept) { x.status = '已完成'; h.phase = 9; st.db.devices.push({ id: st.nextId++, household_id: h.id, home: 'parents', name: '感應小夜燈', qty: 3, source: '到府安裝', status: '正常' }); }
      else { x.status = '進行中'; st.db.work_packages.filter((p) => p.booking_id === x.id && p.code === 'B').forEach((p) => { p.status = '進行中'; }); }
      return '';
    },
  });
  const today = ymd(new Date());
  const pins = [{ id: 'L1', pkg: 'B', k: 'light', label: '感應小夜燈｜床邊', x: 3.08, y: 1, room: '臥室', st: 'plan' }, { id: 'D1', pkg: 'A', k: 'door', label: '門窗感測器｜浴室門', x: 4.75, y: 3.5, room: '浴室', st: 'plan' }];
  const db = {
    profiles: [
      { id: TECH, display_name: '李技師', role: 'tech', store: 'Digital City 高雄民族店', disabled: false },
      { id: TECH2, display_name: '張技師', role: 'tech', store: 'Digital City 高雄民族店', disabled: false },
      { id: FAM, display_name: '陳測試', role: 'family' },
    ],
    households: [{ id: 7, elder_name: '媽媽', store: 'Digital City 高雄民族店', phase: 3, address: '高雄市三民區民族一路 100 號', phone: '0912345678', contacts: [], created_by: FAM, created_at: now }],
    members: [{ household_id: 7, user_id: FAM, relation: 'child' }],
    plans: [{ id: 3, household_id: 7, sel: { mgr: 1, night: 1, alert: 1 }, plan_code: 'basic', pay: 'm', one_time: 5100, monthly: 299, status: '已確認', created_at: now }],
    assessments: [{ id: 1, household_id: 7, dims: { corridor_mm: 820, threshold_mm: 20 }, created_at: now }],
    bookings: [
      { id: 61, code: 'W-' + today.replace(/-/g, '') + '-01', household_id: 7, kind: '到府安裝', store: 'Digital City 高雄民族店', slot_start: today + 'T10:00', slot_end: today + 'T12:00', status: '已指派', assignee_id: TECH, progress: 0, steps: {}, created_at: now },
      { id: 62, code: 'M-' + today.replace(/-/g, '') + '-01', household_id: 7, kind: '設備維護', store: 'Digital City 高雄民族店', slot_start: today + 'T15:00', slot_end: today + 'T17:00', status: '已指派', assignee_id: TECH2, progress: 0, steps: {}, created_at: now },
    ],
    work_packages: [
      { id: 71, booking_id: 61, household_id: 7, code: 'B', name: '夜間照明', team: '全國電子技師', assignee_id: TECH, status: '未開始', steps: {} },
      { id: 72, booking_id: 61, household_id: 7, code: 'A', name: '關懷設備安裝', team: '全國電子技師', assignee_id: TECH, prereq: 'B', status: '未開始', steps: {} },
    ],
    plan_versions: [{ id: 81, household_id: 7, plan_id: 3, ver: 1, status: '長輩已確認', pins, created_at: now }],
    site_diffs: [], acceptances: [], acceptance_results: [], floorplans: [], audit: [], devices: [], reminders: [], notifications: [], requests: [], care_events: [], wishes: [], quotes: [], consents: [], hh_kv: [], orders: [],
  };
  return createMock({ db, rpc: R, staff: [{ id: TECH, email: 'e200001@staff.jiujujia.example', password: 'pw-5678' }] });
}
async function techLogin(page, M) {
  await M.install(page);
  await page.goto('/live/admin/');
  await page.fill('#gForm [name=email]', 'E200001'); await page.fill('#gForm [name=password]', 'pw-5678');
  await page.click('#gForm button[type=submit]');
  await page.waitForURL(/app\.html/);
  await page.waitForFunction(() => window.JJJAPP && window.JJJAPP.S.me && window.JJJAPP.S.stack[0] === 't1' && !window.JJJLIVEAPI.busy(), null, { timeout: 15000 });
}

test('實用版第 3 批：技師用員工編號登入進今日工單；只看得到自己的工單，地址電話到府當天才完整', async ({ page }, info) => {
  desktopOnly(info);
  const errs = await fresh(page, false);
  const M = techDB();
  await techLogin(page, M);
  await expect(page.locator('#view')).toContainText('媽媽家');
  const L = (await api(page, '/tech/orders')).body.orders;
  expect(L.map((o) => o.id)).toEqual([61]);
  expect(L[0]).toMatchObject({ household: '媽媽家', owner: '陳測試', phone: '0912345678', address: '高雄市三民區民族一路 100 號', plan: { status: '已確認' }, measures: { corridor_cm: 82 } });
  expect(L[0].packages.map((p) => [p.code, p.status, p.mine])).toEqual([['B', '未開始', true], ['A', '等待前置', true]]);
  expect((await api(page, '/tech/orders/62')).body.error).toBe('這不是您的工單');
  expect((await api(page, '/advisor/cases')).status).toBe(403);
  expect(errs).toEqual([]);
});

test('實用版第 3 批：先做夜間照明 B 再做關懷設備 A；暫停差異擋住完工；長輩驗收通過後進入關懷中', async ({ page }, info) => {
  desktopOnly(info);
  const errs = await fresh(page, false);
  const M = techDB();
  await techLogin(page, M);
  const P = (p, o) => api(page, '/tech/orders/61' + p, Object.assign({ method: 'POST' }, o || {}));
  expect((await P('/start')).body.error).toBe('請等前置工作包 B 完成');
  let o = (await P('/packages/B/start')).body;
  expect(o.status).toBe('進行中');
  expect((await P('/packages/B/complete')).body.error).toBe('請完成全部步驟');
  await api(page, '/tech/orders/61/packages/B/steps', { method: 'PUT', body: { steps: [1, 1, 1, 1, 1] } });
  o = (await P('/pins/L1')).body;
  expect(o.pv.pins.find((x) => x.id === 'L1').st).toBe('done');
  o = (await P('/packages/B/complete')).body;
  expect(o.packages.map((p) => [p.code, p.status])).toEqual([['B', '已完成'], ['A', '未開始']]);
  o = (await P('/start')).body;
  expect(o.packages.find((p) => p.code === 'A').status).toBe('進行中');
  // 現場差異：暫停施工，等生活顧問核准
  o = (await P('/diffs', { body: { text: '浴室門框是鋁框，感測器改用黏貼', pin_id: 'D1', level: '暫停' } })).body;
  expect(o.diffs[0]).toMatchObject({ pkg: 'A', level: '暫停', status: '待審核', by_name: '李技師' });
  expect(M.st.db.work_packages.find((p) => p.code === 'A').status).toBe('暫停');
  const all = { m: 1, ph0: 1, g: 1, s: 1, b: 1, scan: 1, fine: 1, test: 1, ph1: 1, rc: 1, teach: 1 };
  await api(page, '/tech/orders/61/steps', { method: 'PUT', body: { steps: all } });
  expect((await P('/complete', { body: { steps: all } })).body.error).toBe('有暫停中的差異回報，請等生活顧問核准');
  M.st.db.site_diffs[0].status = '已核准'; M.st.db.work_packages.find((p) => p.code === 'A').status = '進行中';
  expect((await P('/complete', { body: { steps: { m: 1 } } })).body.error).toBe('請完成全部安裝步驟');
  o = (await P('/complete', { body: { steps: all, diff: '感測器改黏貼' } })).body;
  expect(o.status).toBe('待驗收');
  o = (await P('/accept', { body: { items: ['走道夜燈', '浴室門感測器'] } })).body;
  expect(o.status).toBe('已完成');
  expect(o.acceptance).toMatchObject({ result: '通過', by_role: '長輩', by_name: '媽媽' });
  expect(M.st.db.households[0].phase).toBe(9);
  expect(M.st.db.devices.length).toBeGreaterThan(0);
  expect(M.st.db.audit.map((a) => a.action)).toEqual(['開始工作包 B', '完成夜間照明', '開始安裝', '回報差異（暫停施工）', '完工', '長輩驗收通過']);
  await api(page, '/tech/acceptance-result', { method: 'POST', body: { code: o.code, first_pass: true } });
  expect(M.st.db.acceptance_results[0]).toMatchObject({ booking_code: o.code, first_pass: true });
  expect(errs).toEqual([]);
});
