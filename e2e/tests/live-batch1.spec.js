// 實用版搬遷第 1 批（家庭端）：Demo 畫面發出的 /api/… 由 live-api.js 改讀寫 Supabase（模擬）
// 每支 API 的回傳格式要和 Demo 一樣，畫面才不用改；不會出現示範資料
const { test } = require('playwright/test');
const { fresh, expect } = require('./helpers');
const { familyDB, loginToApp, api, ME } = require('./live-db');

const desktopOnly = (info) => test.skip(info.project.name !== 'desktop');

test('實用版第 1 批：預約門市諮詢走 Demo 畫面，名額由資料庫函式檢查；取消後回到未預約', async ({ page }, info) => {
  desktopOnly(info);
  await page.setViewportSize({ width: 390, height: 844 });
  const errs = await fresh(page, false);
  const M = familyDB();
  await loginToApp(page, M);
  const sl = (await api(page, '/slots?store=高雄民族店')).body.slots;
  expect(sl.length).toBe(8);
  expect(sl[0]).toEqual(expect.objectContaining({ full: false, label: expect.stringMatching(/^\d+\/\d+（.）\d\d:\d\d$/) }));
  // 別家已預約第一個時段：顯示額滿
  M.st.db.bookings.push({ id: 1, household_id: 99, kind: '門市諮詢', store: 'Digital City 高雄民族店', slot_start: sl[0].slot, status: '待指派' });
  expect((await api(page, '/slots?store=高雄民族店')).body.slots[0].full).toBe(true);
  expect((await api(page, '/bookings', { method: 'POST', body: { store: '高雄民族店', slot: sl[0].slot } })).body.error).toBe('這個時段剛剛額滿了，請選擇其他時段');
  const r = await api(page, '/bookings', { method: 'POST', body: { store: '高雄民族店', slot: sl[1].slot } });
  expect(r.status).toBe(200);
  expect(r.body.booking).toMatchObject({ kind: '門市諮詢', status: '待指派', slot: sl[1].slot, label: sl[1].label });
  expect(r.body.home.household.phase).toBe(1);
  expect(r.body.home.booking.id).toBe(r.body.booking.id);
  const c = await api(page, '/bookings/' + r.body.booking.id + '/cancel', { method: 'POST' });
  expect(c.body.booking).toBeNull();
  expect(c.body.household.phase).toBe(0);
  expect(errs).toEqual([]);
});

test('實用版第 1 批：首頁資料、偏好、長輩資料、邀請碼、觀察、草稿、需求、心願、題目投票、預購、通知', async ({ page }, info) => {
  desktopOnly(info);
  const errs = await fresh(page, false);
  const M = familyDB({ extra: { notifications: [{ id: 3, household_id: 7, audience: 'owner', channel: 'App', kind: 'plan', title: '生活顧問已確認訂單', created_at: '2026-11-26T02:00:00Z' }, { id: 4, household_id: 8, audience: 'owner', title: '別家', created_at: '2026-11-26T02:00:00Z' }] } });
  await loginToApp(page, M);
  const me = (await api(page, '/me')).body;
  expect(me).toEqual({ user: { id: ME, name: '陳測試', email: '', role: 'family', store: null }, household: { id: 7, name: '媽媽家', phase: 0, store: 'Digital City 高雄民族店' } });
  const h = (await api(page, '/home')).body;
  expect(h.household).toMatchObject({ id: 7, name: '媽媽家', relation: '管理者' });
  expect(h.members).toEqual([{ name: '陳測試', relation: '管理者' }]);
  expect(h.owner).toBe('陳測試');
  for (const k of ['assessment', 'booking', 'plan', 'install', 'pv', 'acceptance']) expect(h[k]).toBeNull();
  for (const k of ['devices', 'wishes', 'care', 'requests', 'versions', 'packages', 'reminders']) expect(h[k]).toEqual([]);

  expect((await api(page, '/home/prefs', { method: 'PUT', body: { big: true, hack: 1 } })).body.prefs).toEqual({ big: true });
  expect((await api(page, '/home/profile', { method: 'PUT', body: { elder_name: '王媽媽', address: '高雄市' } })).body.household).toMatchObject({ elder_name: '王媽媽', address: '高雄市' });
  expect((await api(page, '/home/invite', { method: 'POST' })).body).toEqual({ code: 'ABC123', expires_days: 14 });
  expect((await api(page, '/home/observation', { method: 'PUT', body: { obs: { step: 2, done: true } } })).body.ok).toBe(true);
  expect(M.st.db.households[0].obs).toEqual({ step: 2, done: true });
  await api(page, '/home/assessment-draft', { method: 'PUT', body: { draft: { meas: { corridor_cm: 80 }, qi: 2 } } });
  expect((await api(page, '/home/assessment-draft')).body.draft).toEqual({ meas: { corridor_cm: 80 }, qi: 2 });
  await api(page, '/home/assessment-draft', { method: 'DELETE' });
  expect((await api(page, '/home/assessment-draft')).body.draft).toBeNull();

  expect((await api(page, '/requests', { method: 'POST', body: { kind: '夜燈調整', note: '太亮' } })).body).toEqual({ ok: true, duplicate: false });
  expect((await api(page, '/requests', { method: 'POST', body: { kind: '夜燈調整' } })).body).toEqual({ ok: true, duplicate: true });
  expect((await api(page, '/requests', { method: 'POST', body: { kind: '亂寫' } })).body.error).toBe('需求類型不正確');
  const w = (await api(page, '/wishes', { method: 'POST', body: { category: '安全', text: '浴室想要扶手', home: 'parents' } })).body;
  expect(w.wishes[0]).toMatchObject({ category: '安全', text: '浴室想要扶手', status: '待分類', code: expect.stringMatching(/^WS-\d{4}-\d{4}$/) });
  expect(w.requests[0]).toMatchObject({ kind: '夜燈調整', status: '待處理' });

  let t = (await api(page, '/wish-topics')).body;
  expect(t.topics[0]).toEqual({ id: 'dim', n: '可調光感應夜燈', d: '半夜起床夠亮、又不刺眼', c: 0, th: 100, st: 'pre', me: false });
  expect((await api(page, '/wish-topics/mat/vote', { method: 'POST' })).body.me).toBe(true);
  await api(page, '/preorders', { method: 'POST' }); await api(page, '/preorders', { method: 'POST' });
  t = (await api(page, '/wish-topics')).body;
  expect(t.topics[1]).toMatchObject({ id: 'mat', c: 1, me: true });
  expect(t.preorder).toEqual({ count: 1, me: true });

  const n = (await api(page, '/home/notifications')).body;
  expect(n.unread).toBe(1); expect(n.notifications.map((x) => x.title)).toEqual(['生活顧問已確認訂單']);
  await api(page, '/home/notifications/read', { method: 'POST', body: {} });
  expect((await api(page, '/home/notifications')).body.unread).toBe(0);
  expect(errs).toEqual([]);
});

test('實用版第 1 批：方案確認、驗收、提醒在沒有資料時回 Demo 同樣的訊息；家庭帳號不能用員工 API', async ({ page }, info) => {
  desktopOnly(info);
  await fresh(page, false);
  const M = familyDB({ extra: { plans: [], reminders: [{ id: 31, household_id: 7, device: '感應小夜燈', kind: '換電池', reason: '電量 15%', due: '12/10', status: '待處理' }] } });
  await loginToApp(page, M);
  expect((await api(page, '/plan/confirm', { method: 'POST', body: {} })).body.error).toBe('目前沒有待確認的方案');
  expect((await api(page, '/install/accept', { method: 'POST', body: {} })).body.error).toBe('目前沒有待驗收的安裝');
  const h = (await api(page, '/home')).body;
  expect(h.reminders[0]).toMatchObject({ id: 31, device: '感應小夜燈', status: '待處理', booking: null });
  expect((await api(page, '/reminders/31/skip', { method: 'POST' })).status).toBe(200);
  expect(M.st.db.reminders[0].status).toBe('已略過');
  M.st.db.plans.push({ id: 41, household_id: 7, sel: { night: true }, status: '待確認', one_time: 5100, monthly: 299 });
  expect((await api(page, '/home')).body.plan).toMatchObject({ id: 41, status: '待確認', one_time: 5100, monthly: 299, yearly: 2990 });
  const ok = await api(page, '/plan/confirm', { method: 'POST', body: { address: '高雄市三民區', phone: '0912000000' } });
  expect(ok.body.plan.status).toBe('已確認');
  expect(ok.body.install).toMatchObject({ kind: '到府安裝', status: '待排程' });
  for (const p of ['/advisor/cases', '/tech/orders', '/admin/overview']) expect((await api(page, p)).status).toBe(403);
  expect((await api(page, '/auth/register', { method: 'POST', body: {} })).body.error).toBe('實用版請用 LINE 登入');
  expect((await api(page, '/auth/login', { method: 'POST', body: {} })).body.error).toBe('請輸入員工編號和密碼');
});

test('實用版第 1 批：訂單（目錄價格以 Demo 目錄為準）、取消、同意書、購物車結帳、家電連結、保固、影片任務', async ({ page }, info) => {
  desktopOnly(info);
  const errs = await fresh(page, false);
  const M = familyDB({ extra: { devices: [{ id: 51, household_id: 7, home: 'parents', name: '冷氣', warranty: '已過保', source: '自有' }] } });
  await loginToApp(page, M);
  const cat = (await api(page, '/catalog')).body;
  const paid = cat.items.find((x) => x.monthly > 0 && x.phase <= cat.phase && x.id !== 'cam');
  expect((await api(page, '/home/orders', { method: 'POST', body: { items: [paid.id] } })).body.error).toBe('請選擇付款方式');
  const o = (await api(page, '/home/orders', { method: 'POST', body: { items: [paid.id], pay: cat.pay[0], monthly: 1 } })).body;
  expect(o).toMatchObject({ monthly: paid.monthly, one_time: paid.one, code: expect.stringMatching(/^OD-/) });
  expect(M.st.db.orders[0]).toMatchObject({ status: '待生活顧問確認', household_id: 7 });
  expect(M.st.db.notifications.some((x) => /已送出/.test(x.title))).toBe(true);
  if (cat.items.some((x) => x.id === 'cam' && x.phase <= cat.phase)) expect((await api(page, '/home/orders', { method: 'POST', body: { items: ['cam'], pay: cat.pay[0] } })).body.error).toBe('需要長輩本人同意後才能訂購進階影像版');
  expect((await api(page, '/home/orders/' + o.id + '/cancel', { method: 'POST' })).body.ok).toBe(true);
  expect((await api(page, '/home/orders')).body.orders[0].status).toBe('已取消');

  const cs = (await api(page, '/home/consents', { method: 'POST', body: { kind: '進階影像版', items: ['只在異常時錄影'], agreed: true, by: '長輩本人' } })).body;
  expect((await api(page, '/home/consents')).body.consents[0]).toMatchObject({ id: cs.id, kind: '進階影像版', agreed: 1, by_name: '長輩本人', revoked_at: null });
  await api(page, '/home/consents/' + cs.id + '/revoke', { method: 'POST' });
  expect((await api(page, '/home/consents')).body.consents[0].revoked_at).toBeTruthy();

  const P = (await api(page, '/shop/products')).body.products;
  expect((await api(page, '/cart', { method: 'POST', body: { items: [{ sku: P[0].sku, qty: 2 }, { sku: 'NOPE' }] } })).body).toEqual({ added: 2, count: 2 });
  M.st.db.cart_items[0].price = 1; // 自己改價格無效：結帳以商品目錄價格計
  expect((await api(page, '/cart/checkout', { method: 'POST', body: { name: '陳', phone: '09', address: '高雄', pay: '信用卡' } })).body.total).toBe(P[0].price * 2);
  expect((await api(page, '/cart')).body.items).toEqual([]);

  await api(page, '/home/device-links', { method: 'PUT', body: { links: { 冷氣: true } } });
  expect((await api(page, '/home/device-links')).body.links).toEqual([{ name: '冷氣', linked: 1 }]);
  const wr = (await api(page, '/home/warranty')).body;
  expect(wr.parents[0]).toMatchObject({ name: '冷氣', expired: true, repairing: false });
  expect((await api(page, '/home/repair', { method: 'POST', body: { device_id: 51, note: '不冷' } })).body.ok).toBe(true);
  expect((await api(page, '/home/warranty')).body.parents[0].repairing).toBe(true);
  expect((await api(page, '/videos', { method: 'POST', body: { topic: '夜燈開箱', checks: { a: 1, b: 1, c: 1 } } })).body.error).toBe('四項隱私確認都要勾選');
  expect((await api(page, '/videos', { method: 'POST', body: { topic: '夜燈開箱', checks: { a: 1, b: 1, c: 1, d: 1 } } })).status).toBe(200);
  expect((await api(page, '/videos')).body.videos[0]).toMatchObject({ topic: '夜燈開箱' });
  expect(errs).toEqual([]);
});

test('實用版第 1 批：揪心願作品送出（資料庫函式記點數）、列表與單件、留言、追蹤；關懷演練事件與通知', async ({ page }, info) => {
  desktopOnly(info);
  const errs = await fresh(page, false);
  const M = familyDB({ extra: { profiles: [{ id: ME, display_name: '陳測試', role: 'family' }, { id: 'u-other', display_name: '林小姐', role: 'family' }], wish_works: [{ id: 61, owner: 'u-other', title: '浴室夜燈扶手組', field: '臥室到浴室', status: '共鳴中', base: 0, build: [{ slot: '床邊', part: 'light' }], story: {}, created_at: new Date().toISOString() }] } });
  await loginToApp(page, M);
  expect((await api(page, '/wish/works', { method: 'POST', body: { title: '夜裡不怕黑', field: '臥室到浴室', story: { hope: '夜裡不怕黑' }, terms: { rules: 1, license: 1 }, build: [] } })).body.error).toBe('至少擺一個零件');
  expect((await api(page, '/wish/works', { method: 'POST', body: { title: '小米夜燈', field: '臥室到浴室', terms: { rules: 1, license: 1 }, build: [{ slot: '床邊', part: 'light' }] } })).body.error).toBe('內容要修改：不指名品牌');
  const nw = (await api(page, '/wish/works', { method: 'POST', body: { title: '夜裡不怕黑', field: '臥室到浴室', story: { hope: '夜裡不怕黑' }, terms: { rules: 1, license: 1 }, build: [{ slot: '床邊', part: 'light', x: 3080, y: 1000 }] } })).body;
  expect(nw.status).toBe('共鳴中');
  const L = (await api(page, '/wish/works?tab=all&sort=new')).body.works;
  expect(L.map((x) => x.title)).toEqual(['夜裡不怕黑', '浴室夜燈扶手組']);
  expect(L[1]).toMatchObject({ designer: '林小姐（媽媽家）', count: 0, stage: { i: 0, need: 20 }, mine: null });
  expect((await api(page, '/wish/works?tab=mine')).body.works.map((x) => x.id)).toEqual([nw.id]);
  const d = (await api(page, '/wish/works/61')).body.work;
  expect(d).toMatchObject({ id: 61, eligible: false, plan: '揪夜安', updates: [], comments: [], derivatives: [] });
  expect((await api(page, '/wish/works/61/support', { method: 'POST', body: {} })).body.error).toBe('訂閱「揪夜安」的家庭才能按「我也需要」，可以先追蹤');
  expect((await api(page, '/wish/works/61/support', { method: 'POST', body: { follow: true } })).body).toEqual({ follow: true });
  expect((await api(page, '/wish/works/61/comments', { method: 'POST', body: { text: '好想要' } })).body).toEqual({ ok: true, status: '待審核' });
  expect((await api(page, '/wish/works/61')).body.work.comments[0]).toMatchObject({ text: '好想要', status: '待審核' });
  const pts = (await api(page, '/points')).body;
  expect(pts).toMatchObject({ total: 0, pending: 50 }); expect(pts.items[0]).toMatchObject({ reason: '送出作品', title: '夜裡不怕黑' });

  const ev = (await api(page, '/care/drill', { method: 'POST', body: { kind: 'act', title: '浴室停留過久', timeline: [['22:10', '長輩未回應']], notify: [{ audience: 'owner', channel: 'LINE', title: '媽媽浴室停留過久' }] } })).body;
  expect(ev.hid).toBe(7);
  await api(page, '/care/drill/' + ev.id, { method: 'PUT', body: { outcome: '長輩確認' } });
  const e = (await api(page, '/care/events/' + ev.id)).body;
  expect(e.event).toMatchObject({ title: '浴室停留過久', outcome: '長輩確認', elder_name: '媽媽' });
  expect(e.notifications[0]).toMatchObject({ channel: 'LINE', title: '媽媽浴室停留過久' });
  expect((await api(page, '/home')).body.care[0]).toMatchObject({ title: '浴室停留過久', when: expect.stringMatching(/^\d+\/\d+ \d\d:\d\d$/) });
  const sum = (await api(page, '/home/summary')).body;
  expect(sum).toMatchObject({ asked: 1, self: 1, fam: 0, dev: 0 });
  expect(errs).toEqual([]);
});

test('實用版第 1 批：2D／3D 圖面標「示意格局」；Demo 的示範帳號與示範標記不出現', async ({ page }, info) => {
  desktopOnly(info);
  await page.setViewportSize({ width: 390, height: 844 });
  await fresh(page, false);
  const M = familyDB();
  await loginToApp(page, M);
  await page.evaluate(() => { const v = document.getElementById('view'); v.insertAdjacentHTML('beforeend', '<div class="tcad" id="t2d"></div><div class="hpw" id="t3d"></div>'); (window.JJJHOOKS || []).forEach((f) => f('gl', v)); });
  await expect(page.locator('#t2d .lv-demo-layout')).toContainText('示意格局');
  await expect(page.locator('#t3d .lv-demo-layout')).toContainText('生活顧問到府後換成您家的格局');
  const cfg = (await api(page, '/config')).body;
  expect([cfg.demo, cfg.demo_accounts.length, cfg.demo_password]).toEqual([false, 0, null]);
  await expect(page.locator('#webDemo')).toBeHidden();
});

test('實用版第 1 批：未登入時 /api 回 401，不會拿到 Demo 的示範資料', async ({ page }, info) => {
  desktopOnly(info);
  await fresh(page, false);
  const M = familyDB(); await M.install(page);
  await page.goto('/live/app/');
  await page.waitForFunction(() => window.JJJLIVEAPI);
  const r = await api(page, '/home');
  expect(r.status).toBe(401);
  expect((await api(page, '/home/notifications')).status).toBe(401);
});
