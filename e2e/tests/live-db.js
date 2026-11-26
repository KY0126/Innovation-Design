// 實用版第 1 批測試用：模擬 jjj 區的資料庫函式（規則同 supabase/migrations/20261127090000_jjj_batch1_family.sql）
// 只在測試用；st.db 是 live-mock.js 的記憶體資料表，me 是目前登入的使用者 id
const { createMock } = require('./live-mock');

const ME = 'u-family';
const myHH = (st) => { const m = st.db.members.filter((x) => x.user_id === (st.me ? st.me.id : ME)).sort((a, b) => a.household_id - b.household_id)[0]; return m ? m.household_id : null; };
const err = (msg) => { const e = new Error(msg); e.pg = true; throw e; };
const STORES = { 'Digital City 高雄民族店': ['高雄民族店', ['10:30', '14:00', '16:30', '19:00']], 'Digital City 高雄澄清店': ['高雄澄清店', ['11:00', '15:00', '19:30']], 'Digital City 高雄三民中華店': ['高雄三民中華店', ['10:00', '14:30', '18:30']] };
const storeOf = (s) => Object.entries(STORES).find(([n, [sh]]) => n === s || sh === s);

function rpcs() {
  const R = {
    create_household: (b, st) => { const id = st.nextId++; st.db.households.push({ id, elder_name: b.p_elder_name, elder_note: b.p_elder_note, store: b.p_store, stage: 0, phase: 0, prefs: {}, contacts: [], created_by: st.me ? st.me.id : ME, created_at: new Date().toISOString() }); st.db.members.push({ household_id: id, user_id: st.me ? st.me.id : ME, relation: 'child' }); return id; },
    create_invite: () => 'ABC123',
    redeem_invite: (b, st) => { const h = st.db.households[0]; st.db.members.push({ household_id: h.id, user_id: st.me.id, relation: 'family' }); return h.id; },
    household_members: (b, st) => st.db.members.filter((m) => m.household_id === b.p_household).map((m) => ({ user_id: m.user_id, display_name: (st.db.profiles.find((p) => p.id === m.user_id) || {}).display_name || '家人', relation: m.relation, is_me: m.user_id === (st.me && st.me.id) })),
    wish_count: () => 0,
    slot_taken: (b, st) => b.p_slots.map((s) => ({ slot: s, n: st.db.bookings.filter((x) => x.store === b.p_store && x.slot_start === s && x.kind === '門市諮詢' && x.status !== '已取消').length })),
    book_consult: (b, st) => {
      const hid = myHH(st); if (!hid) err('尚未建立家庭資料');
      const h = st.db.households.find((x) => x.id === hid); if ((h.phase || 0) >= 2) err('已有生活顧問的方案，請直接聯絡綁定門市');
      const s = storeOf(b.p_store); if (!s) err('請選擇門市');
      if (!s[1][1].includes(String(b.p_slot).slice(11, 16))) err('這個時段無法預約，請重新選擇');
      if (st.db.bookings.some((x) => x.store === s[0] && x.slot_start === b.p_slot && x.kind === '門市諮詢' && x.status !== '已取消')) err('這個時段剛剛額滿了，請選擇其他時段');
      st.db.bookings.filter((x) => x.household_id === hid && x.kind === '門市諮詢' && ['待指派', '已指派'].includes(x.status)).forEach((x) => { x.status = '已取消'; });
      const id = st.nextId++; st.db.bookings.push({ id, code: 'B-' + b.p_slot.slice(0, 10).replace(/-/g, '') + '-01', household_id: hid, kind: '門市諮詢', store: s[0], slot_start: b.p_slot, status: '待指派', steps: {}, created_at: new Date().toISOString() });
      h.phase = Math.max(h.phase || 0, 1); h.store = s[0]; return id;
    },
    cancel_booking: (b, st) => { const hid = myHH(st), x = st.db.bookings.find((y) => y.id === b.p_id && y.household_id === hid); if (!x) err('找不到資料'); if (!['待指派', '已指派'].includes(x.status)) err('這筆預約無法取消'); x.status = '已取消'; const h = st.db.households.find((y) => y.id === hid); if (h.phase === 1) h.phase = 0; return null; },
    plan_confirm: (b, st) => { const hid = myHH(st), p = st.db.plans.filter((x) => x.household_id === hid && x.status === '待確認').pop(); if (!p) err('目前沒有待確認的方案'); if (!b.p_address) err('請填寫到府安裝地址'); p.status = '已確認'; const h = st.db.households.find((y) => y.id === hid); Object.assign(h, { phase: Math.max(h.phase, 3), address: b.p_address, phone: b.p_phone }); st.db.bookings.push({ id: st.nextId++, household_id: hid, kind: '到府安裝', store: h.store, slot_start: '', status: '待排程', steps: {}, created_at: new Date().toISOString() }); return null; },
    install_review: (b, st) => { const hid = myHH(st), x = st.db.bookings.filter((y) => y.household_id === hid && y.kind === '到府安裝' && y.status === '待驗收').pop(); if (!x) err('目前沒有待驗收的安裝'); x.status = b.p_accept ? '已完成' : '待改善'; return null; },
    reminder_act: (b, st) => { const r = st.db.reminders.find((y) => y.id === b.p_id); if (!r) err('找不到提醒'); r.status = b.p_book ? '已預約' : '已略過'; return null; },
    cancel_order: (b, st) => { const o = st.db.orders.find((y) => y.id === b.p_id); if (!o) err('找不到訂單'); if (!['待生活顧問確認', '已報名'].includes(o.status)) err('已確認的訂單請洽生活顧問'); o.status = '已取消'; return null; },
    notify_household: (b, st) => { st.db.notifications.push({ id: st.nextId++, household_id: b.p_household, audience: 'owner', channel: 'App', kind: b.p_kind, title: b.p_title, body: b.p_body, link: b.p_link, created_at: new Date().toISOString() }); return null; },
    care_drill: (b, st) => { const hid = myHH(st), id = st.nextId++; st.db.care_events.push({ id, household_id: hid, kind: b.p_kind, title: b.p_title, outcome: '處理中', timeline: b.p_timeline, source: 'drill', occurred_at: new Date().toISOString() }); (b.p_notify || []).forEach((n) => st.db.notifications.push({ id: st.nextId++, household_id: hid, care_event_id: id, ...n, link: 'ev:' + id, created_at: new Date().toISOString() })); return id; },
    care_drill_step: (b, st) => { const e = st.db.care_events.find((y) => y.id === b.p_id); if (!e) err('找不到事件'); if (b.p_outcome) e.outcome = b.p_outcome; return null; },
    user_names: (b, st) => b.p_ids.map((id) => ({ id, name: ((st.db.profiles.find((p) => p.id === id) || {}).display_name || '使用者') + '（媽媽家）' })),
    wish_support_counts: (b, st) => b.p_ids.map((id) => ({ work_id: id, n: st.db.wish_supports.filter((s) => s.work_id === id && s.kind !== 'follow').length, derivs: 0 })),
    wish_eligible: () => false,
    wish_topic_counts: (b, st) => st.db.wish_topics.map((t) => ({ topic_id: t.id, votes: st.db.wish_votes.filter((v) => v.topic_id === t.id).length, me: st.db.wish_votes.some((v) => v.topic_id === t.id && v.user_id === st.me.id) })),
    preorder_count: (b, st) => [{ n: st.db.preorders.length, me: st.db.preorders.some((v) => v.user_id === st.me.id) }],
    wish_submit: (b, st) => { const id = st.nextId++; st.db.wish_works.push({ id, owner: st.me.id, household_id: myHH(st), title: b.p_title, field: b.p_field, scene: b.p_field, story: b.p_story, build: b.p_build, status: b.p_draft ? '草稿' : '共鳴中', base: 0, created_at: new Date().toISOString() }); st.db.wish_points.push({ id: st.nextId++, user_id: st.me.id, work_id: id, reason: '送出作品', points: 50, status: '待檢核', created_at: new Date().toISOString() }); return id; },
    wish_support: (b, st) => { const w = st.db.wish_works.find((x) => x.id === b.p_work); if (!w) err('找不到作品'); if (w.owner === st.me.id) err('不能支持自己的作品'); if (!b.p_follow) err('訂閱「揪夜安」的家庭才能按「我也需要」，可以先追蹤'); st.db.wish_supports.push({ work_id: w.id, user_id: st.me.id, kind: 'follow' }); return null; },
  };
  // 資料庫函式丟出錯誤時，PostgREST 回 400 與訊息
  const wrap = {};
  for (const [k, f] of Object.entries(R)) wrap[k] = (b, st) => { try { const r = f(b, st); return r === undefined ? null : r === null ? '' : r; } catch (e) { if (e.pg) return { __err: e.message }; throw e; } };
  return wrap;
}

// 已登入、已有長輩家的家庭（或還沒有長輩家：withHH=false）
function familyDB({ withHH = true, extra = {} } = {}) {
  const db = Object.assign({
    profiles: [{ id: ME, display_name: '陳測試', role: 'family', is_friend: true }],
    households: withHH ? [{ id: 7, elder_name: '媽媽', elder_note: '獨居，晚上會起床', store: 'Digital City 高雄民族店', stage: 0, phase: 0, prefs: {}, contacts: [], created_by: ME, created_at: '2026-11-26T00:00:00Z' }] : [],
    members: withHH ? [{ household_id: 7, user_id: ME, relation: 'child' }] : [],
    bookings: [], plans: [], devices: [], reminders: [], wishes: [], requests: [], hh_kv: [], family_handoffs: [], orders: [], cart_items: [], wish_points: [],
    wish_topics: [{ id: 'dim', name: '可調光感應夜燈', descr: '半夜起床夠亮、又不刺眼', base: 0, threshold: 100, status: 'pre', sort: 1 }, { id: 'mat', name: '浴室門口止滑地墊', descr: '夜間進出浴室腳下不打滑', base: 0, threshold: 100, status: 'res', sort: 4 }],
    wish_votes: [], preorders: [], wish_themes: [], wish_updates: [], wish_comments: [], wish_cparts: [], video_tasks: [],
  }, extra);
  const M = createMock({
    functions: { 'line-login': (b) => (b.code === 'test-code' ? { data: { token_hash: 'th-1', first: false } } : { status: 401, data: { error: 'x' } }) },
    db, rpc: rpcs(),
  });
  return M;
}

// 登入並進入 App（Demo 畫面）
async function loginToApp(page, M, { expectApp = true } = {}) {
  await M.install(page);
  await page.goto('/live/app/');
  await page.click('.hg1'); await page.click('[data-lv="ok"]');
  if (expectApp) await page.waitForFunction(() => window.JJJLIVEAPI && window.JJJLIVEAPI.active() && !window.JJJLIVEAPI.busy() && window.JJJAPP.S.me, null, { timeout: 15000 });
}
// 在頁面裡呼叫 /api（走 live-api.js 攔截）
const api = (page, path, opt = {}) => page.evaluate(async ([p, o]) => { const r = await fetch('/api' + p, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json', 'X-JJJ': '1' }, body: o.body ? JSON.stringify(o.body) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; }, [path, opt]);

module.exports = { familyDB, loginToApp, api, ME, rpcs };
