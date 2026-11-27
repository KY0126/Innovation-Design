// 實用版搬遷第 4 批（總部後台）：總部用員工編號登入 Demo 同一套後台；總覽、指標、帳號、FAQ、客服轉真人、揪心願審核、營運設定接 Supabase（模擬）
const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
const { api, rpcs, familyDB, loginToApp } = require('./live-db');
const { createMock } = require('./live-mock');

const desktopOnly = (info) => test.skip(info.project.name !== 'desktop');
const HQ = 'u-hq', FAM = 'u-family';
const now = new Date().toISOString();

function hqDB() {
  const R = rpcs();
  Object.assign(R, {
    user_names: (b, st) => b.p_ids.map((id) => ({ id, name: (st.db.profiles.find((p) => p.id === id) || {}).display_name || '使用者' })),
    admin_overview: (b, st) => ({ families: st.db.households.length, assessed: 1, consult_open: 1, consult_unassigned: 1, plans_pending: 0, install_unscheduled: 0, install_scheduled: 0, caring: 0, wishes_open: 1, requests_open: 0, care_7d: 0, diag: { avg: null, n: 0 }, advisor: { avg: 900, n: 1 }, funnel: [['完成診斷', 1], ['預約門市', 1], ['收到方案', 0], ['確認方案', 0], ['關懷啟用', 0]], store: b.p_store || '全部門市' }),
    admin_metrics: (b) => ({ store: b.p_store || null, at: '2026-11-27 10:00:00', raw: { diag: 4, booked: 3, conf: 1, consulted: 2, inst: 0, plan_s: 1500, fp: 1, fpn: 1, diffs: 0, care: 0, self: 0, act: 0, fol: 0, noti: 3, reqd: 1, reqn: 2, ord: 0, mrr: 0, wish: 1, wishr: 0, video: 0, bot: 10, bota: 8 } }),
    wish_topic_counts: () => [],
  });
  const db = {
    profiles: [{ id: HQ, display_name: '張經理', role: 'hq', store: null, disabled: false }, { id: 'u-adv', display_name: '王顧問', role: 'advisor', store: 'Digital City 高雄民族店', disabled: false }, { id: FAM, display_name: '陳測試', role: 'family' }],
    households: [{ id: 7, elder_name: '媽媽', store: 'Digital City 高雄民族店', phase: 1, created_by: FAM, created_at: now, updated_at: now }],
    members: [{ household_id: 7, user_id: FAM, relation: 'child' }],
    bookings: [{ id: 21, code: 'B-20261127-01', household_id: 7, kind: '門市諮詢', store: 'Digital City 高雄民族店', slot_start: '2026-11-27T19:00', status: '待指派', created_at: now }],
    assessments: [{ id: 1, household_id: 7, dims: { corridor_mm: 820 }, created_at: now }],
    wishes: [{ id: 31, code: 'WS-1127-01', household_id: 7, store: 'Digital City 高雄民族店', category: '夜間照明', text: '浴室門口亮一點', source: 'App', status: '待分類', created_at: now }],
    wish_works: [{ id: 41, owner: FAM, household_id: 7, title: '床邊到浴室一路亮', field: '臥室到浴室', status: '共鳴中', base: 0, build: [], story: {}, created_at: now }],
    wish_supports: [], wish_themes: [], wish_updates: [], wish_points: [], wish_comments: [], wish_cparts: [], wish_topics: [], video_tasks: [],
    audit: [{ id: 1, user_id: 'u-adv', action: '建立方案', target: '媽媽家', detail: '一次性 5100', at: now }],
    bot_logs: [{ id: 1, line_user_id: 'U1', text: '可以幫忙換燈泡嗎', intent: 'unknown', answered: false, created_at: now }, { id: 2, line_user_id: 'U2', text: '可以幫忙換燈泡嗎', intent: 'near', answered: false, created_at: now }, { id: 3, line_user_id: 'U3', text: '月費多少', intent: 'faq', answered: true, created_at: now }],
    faq: [], config: [{ key: 'care_rules', value: { bath_min: 30, morning: '10:00', elder_wait: 5, family_wait: 5 } }], support_tickets: [], notifications: [], requests: [], plans: [], care_events: [], reminders: [], orders: [], quotes: [], acceptance_results: [], work_packages: [],
  };
  return createMock({ db, rpc: R, staff: [{ id: HQ, email: 'e900001@staff.jiujujia.example', password: 'pw-hq-1' }],
    functions: { 'staff-admin': (b, st) => {
      if (b.action === 'list') return { data: { users: st.db.profiles.filter((p) => p.role !== 'family').map((p) => ({ id: p.id, email: p.id + '@staff', name: p.display_name, role: p.role, store: p.store, disabled: 0 })) } };
      if (b.action === 'create') { const id = '00000000-0000-4000-8000-000000000009'; st.db.profiles.push({ id, display_name: b.name, role: b.role, store: b.store }); return { data: { id, email: 'e100009@staff.jiujujia.example', temp_password: 'Tmp12345ab' } }; }
      return { data: { ok: true, temp_password: b.reset_password ? 'Tmp99' : null } };
    } } });
}

test('實用版第 4 批：總部用員工編號登入同一套後台；總覽、指標（含 LINE 小幫手）、帳號管理、營運設定', async ({ page }, info) => {
  desktopOnly(info);
  const errs = await fresh(page, false);
  const M = hqDB();
  await M.install(page);
  await page.goto('/live/admin/');
  await page.fill('#gForm [name=email]', 'E900001'); await page.fill('#gForm [name=password]', 'pw-hq-1');
  await page.click('#gForm button[type=submit]');
  await expect(page.locator('#who')).toHaveText('總部｜張經理', { timeout: 15000 });
  await expect(page.locator('#gate')).toBeHidden();
  const ov = (await api(page, '/admin/overview')).body;
  expect(ov).toMatchObject({ store: '全部門市', kpi: { families: 1, consult_unassigned: 1 }, funnel: [['完成診斷', 1], ['預約門市', 1], ['收到方案', 0], ['確認方案', 0], ['關懷啟用', 0]] });
  expect(ov.activity[0]).toMatchObject({ action: '建立方案', name: '王顧問', role: 'advisor' });
  const mt = (await api(page, '/admin/metrics')).body;
  const it = Object.fromEntries(mt.groups.flatMap((g) => g.items).map((x) => [x.k, x]));
  expect(it.book).toMatchObject({ v: 75, ok: true });
  expect(it.plan_min).toMatchObject({ v: 25, ok: true });
  expect(it.bot).toMatchObject({ l: 'LINE 小幫手答得出來', v: 80, ok: true });
  // 帳號
  expect((await api(page, '/admin/users')).body.users.map((u) => u.role)).toEqual(['hq', 'advisor']);
  const nu = (await api(page, '/admin/users', { method: 'POST', body: { email: 'E100009', name: '林技師', role: 'tech', store: 'Digital City 高雄民族店' } })).body;
  expect(nu).toEqual({ id: '00000000-0000-4000-8000-000000000009', temp_password: 'Tmp12345ab' });
  expect(M.st.calls.find((c) => c.name === 'staff-admin' && c.body.action === 'create').body).toMatchObject({ email: 'E100009', role: 'tech' });
  expect((await api(page, '/admin/users/00000000-0000-4000-8000-000000000009', { method: 'POST', body: { reset_password: true } })).body.temp_password).toBe('Tmp99');
  // 營運設定
  expect((await api(page, '/admin/settings', { method: 'PUT', body: { rules: { bath_min: 200, morning: '09:30', elder_wait: 3, family_wait: 4 } } })).body.rules).toEqual({ bath_min: 90, morning: '09:30', elder_wait: 3, family_wait: 4 });
  expect(M.st.db.config[0].value.bath_min).toBe(90);
  // 指派生活顧問
  expect((await api(page, '/admin/staff')).body.advisors).toEqual([{ id: 'u-adv', name: '王顧問', store: 'Digital City 高雄民族店' }]);
  await api(page, '/admin/bookings/21/assign', { method: 'POST', body: { assignee_id: 'u-adv' } });
  expect(M.st.db.bookings[0]).toMatchObject({ status: '已指派', assignee_id: 'u-adv' });
  expect(errs).toEqual([]);
});

test('實用版第 4 批：FAQ 缺口來自 LINE 小幫手答不出來的問題；總部新增的題目家人看得到；揪心願回覆與審核通知家人', async ({ page }, info) => {
  desktopOnly(info);
  const errs = await fresh(page, false);
  const M = hqDB();
  await M.install(page);
  await page.goto('/live/admin/');
  await page.fill('#gForm [name=email]', 'E900001'); await page.fill('#gForm [name=password]', 'pw-hq-1');
  await page.click('#gForm button[type=submit]');
  await expect(page.locator('#who')).toHaveText('總部｜張經理', { timeout: 15000 });
  const f = (await api(page, '/admin/faq')).body;
  expect(f.gaps[0]).toMatchObject({ q: '可以幫忙換燈泡嗎', n: 2 });
  expect(f.stats).toEqual({ asked: 3, matched: 1, handed: 0 });
  expect(f.faq.length).toBeGreaterThan(10);
  expect((await api(page, '/admin/faq', { method: 'POST', body: { cat: '家電保固與報修', q: '可以幫忙換燈泡嗎？', a: '揪夜安的夜燈由技師免費更換；一般燈泡請到門市購買。' } })).body.ok).toBe(true);
  expect((await api(page, '/faq')).body.faq.some((x) => x.q === '可以幫忙換燈泡嗎？')).toBe(true);
  // 心願：回覆會通知家人
  await api(page, '/admin/wishes/31', { method: 'POST', body: { class: '夜間照明', reply: '已排入下次到府時加裝門口夜燈' } });
  expect(M.st.db.wishes[0]).toMatchObject({ status: '已回覆', class: '夜間照明', replied_by: HQ });
  expect((await api(page, '/admin/wishes')).body.wishes[0]).toMatchObject({ household: '媽媽家', replied_by: '張經理' });
  // 作品審核：不通過要寫理由；通過通知設計者家庭
  expect((await api(page, '/admin/wish/works/41/status', { method: 'POST', body: { status: '不通過' } })).body.error).toBe('不通過要寫理由');
  expect((await api(page, '/admin/wish/works/41/status', { method: 'POST', body: { status: '評估中', note: '送選品評估' } })).body).toEqual({ ok: true, notified: 1 });
  expect(M.st.db.wish_updates[0].text).toBe('狀態更新：評估中｜送選品評估');
  expect(M.st.db.notifications.map((n) => n.title)).toEqual(['門市回覆了您的心願', '揪心願「床邊到浴室一路亮」評估中']);
  expect((await api(page, '/admin/wish/board')).body.works[0]).toMatchObject({ id: 41, status: '評估中', review_note: '送選品評估' });
  // 試點沒有校園大使、商用客戶：回空清單，不放示範資料
  expect((await api(page, '/admin/amb-visits')).body).toEqual({ visits: [] });
  expect(errs).toEqual([]);
});

test('實用版第 4 批：家人在揪問 AI 按「找真人」，總部客服清單看得到並可結案', async ({ page }, info) => {
  desktopOnly(info);
  const errs = await fresh(page, false);
  const M = familyDB({ extra: { support_tickets: [] } });
  M.st.rpc.support_handoff = (b, st) => { const id = st.nextId++; st.db.support_tickets.push({ id, user_id: st.me.id, household_id: 7, target: b.p_target === 'cs' ? '全國電子客服' : '綁定門市生活顧問', topic: b.p_topic, transcript: b.p_transcript, status: '待回覆', created_at: new Date().toISOString() }); return { id, target: '綁定門市生活顧問', eta: '生活顧問 1 個工作天內聯絡您' }; };
  await loginToApp(page, M);
  const r = (await api(page, '/support/handoff', { method: 'POST', body: { target: 'store', topic: '夜燈一直亮', transcript: ['使用者：夜燈一直亮', '阿國：…'] } })).body;
  expect(r).toMatchObject({ target: '綁定門市生活顧問', eta: '生活顧問 1 個工作天內聯絡您' });
  expect(M.st.db.support_tickets[0]).toMatchObject({ topic: '夜燈一直亮', transcript: ['使用者：夜燈一直亮', '阿國：…'] });
  expect((await api(page, '/admin/support')).status).toBe(403);
  expect(errs).toEqual([]);
});
