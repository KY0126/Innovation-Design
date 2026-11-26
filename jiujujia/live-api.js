// 實用版（Live）資料層：在 ?mode=live 時攔截 Demo 畫面發出的 /api/… 請求，改讀寫 Supabase（jjj 區）
// 畫面沿用 Demo（app.html、family.js、wish.js、ext.js…），回傳格式與 Demo 模擬後端相同（docs/design/實用版_Live版全功能搬遷設計.md）
// 規則：門市、時段、方案、診斷燈號用 live-rules.js（從 Demo 後端抽出的同一份）；名額、方案確認、點數等由資料庫函式把關
// 純展示的固定內容（商品目錄、拼圖零件、常見問題、關懷規則）沿用 Demo 內建資料，不涉及個人資料
// 第 1 批只開放家庭端；生活顧問、技師、總部的 API 在後續批次接上
(function () {
  if (!window.JJJ_LIVE) return;
  const R = () => window.JJJRULES, T = () => window.JJJRULES.T;
  // 家庭頁用 live-app.js 的連線；員工頁（後台、生活顧問電腦版）用 live-admin.js 的連線
  const sb = () => window.JJJLIVESB || (window.JJJLIVEAPP && window.JJJLIVEAPP.sb);
  let active = false;           // 已登入、有長輩家，進入 Demo 畫面
  const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
  const ERR = (m, s = 400) => J({ error: m }, s);
  class E extends Error { constructor(m, s = 400) { super(m); this.status = s; } }
  const parse = (s) => { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch (e) { return null; } };
  const p2 = (n) => String(n).padStart(2, '0');
  // 資料庫時間（timestamptz）轉成 Demo 用的本地字串「YYYY-MM-DD HH:MM:SS」
  const ls = (iso) => { if (!iso) return null; const d = new Date(iso); if (isNaN(d)) return iso; return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
  const REL = { child: '管理者', family: '家人', elder: '長輩' };
  const REQ_KINDS = ['設備檢修', '夜燈調整', '方案升級', '改為年繳', '取消方案', '修改第二聯絡人', '聯絡生活顧問', '加選門口攝影機', '設備問題'];
  const WISH_CATS = ['安全', '方便', '夜間照明', '設備', '其他'];
  const FIELDS = ['臥室到浴室', '廚房', '客廳', '洗衣陽台', '全屋'];
  const STAGES = [[20, 30], [50, 90], [100, 0]];
  const PLAN_NAME = { '臥室到浴室': '揪夜安', '廚房': '揪食光', '客廳': '揪團聚', '洗衣陽台': '揪清爽', '全屋': '揪全家' };
  const BAN = [[/治療|療效|醫療|保證不跌|防止中風/, '不寫醫療效果'], [/飛利浦|Philips|小米|國際牌|Panasonic|大金|日立|三星|LG|Tapo/i, '不指名品牌'], [/門牌|地址|住址/, '不放地址或門牌']];

  async function q(p) { const { data, error } = await p; if (error) throw new E(dbMsg(error)); return data; }
  async function rpc(fn, args) { const { data, error } = await sb().rpc(fn, args || {}); if (error) throw new E(dbMsg(error)); return data; }
  // 資料庫函式丟出的中文訊息直接給使用者看；其他錯誤不外露細節
  function dbMsg(e) { const m = String((e && e.message) || ''); return /[一-鿿]/.test(m) ? m : '系統忙碌中，請稍後再試'; }
  const db = (t) => sb().from(t);

  // ── 目前使用者與長輩家 ──
  async function ctx(needHH = true) {
    const { data: { session } } = await sb().auth.getSession();
    if (!session) throw new E('請先登入', 401);
    const uid = session.user.id;
    const prof = (await q(db('profiles').select('id, display_name, role, store, disabled').eq('id', uid).maybeSingle())) || { id: uid, display_name: '', role: 'family' };
    if (prof.disabled) { await sb().auth.signOut(); throw new E('這個帳號已停用，請洽總部', 401); }
    if (prof.role !== 'family') return { uid, email: session.user.email, prof, h: null, hid: null, staff: true, role: prof.role, store: prof.role === 'hq' ? null : prof.store };
    const mem = await q(db('members').select('household_id, relation').eq('user_id', uid).order('household_id').limit(1));
    let h = null;
    if (mem.length) { h = await q(db('households').select('*').eq('id', mem[0].household_id).maybeSingle()); if (h) h.relation = REL[mem[0].relation] || '家人'; }
    if (needHH && !h) throw new E('尚未建立家庭資料', 404);
    return { uid, email: session.user.email, prof, h, hid: h ? h.id : null };
  }
  const meUser = (c) => ({ id: c.uid, name: c.prof.display_name || (c.staff ? '同仁' : '家人'), email: c.email && !/@line\.jiujujia/.test(c.email) ? c.email : '', role: c.prof.role || 'family', store: c.prof.store || null });

  // ── 輸出格式（同 Demo 後端） ──
  const label = (a, b) => T().label(a, b);
  const nf = (b) => b ? { id: b.id, code: b.code, kind: b.kind, store: b.store, slot: b.slot_start, slot_end: b.slot_end, label: label(b.slot_start, b.slot_end), status: b.status, assignee: null, assignee_id: b.assignee_id, progress: b.progress, steps: b.steps || {}, diff: b.diff, note: b.note, created_at: ls(b.created_at), completed_at: ls(b.completed_at) } : null;
  const oa = (p) => p ? { id: p.id, sel: p.sel || {}, later: p.later || {}, plan: p.plan_code, pay: p.pay, one_time: p.one_time, monthly: p.monthly, yearly: p.monthly * 10, status: p.status, advisor: null, created_at: ls(p.created_at), confirmed_at: ls(p.confirmed_at), escort: !!p.escort } : null;
  const u5 = (a) => a ? { id: a.id, filled_by: a.filled_by || 'child', answers: a.answers || {}, measures: a.measures || mmToCm(a.dims), lights: a.lights || [], rec: a.rec || null, created_at: ls(a.created_at) } : null;
  const mmToCm = (d) => { d = d || {}; const o = {}; if (d.corridor_mm != null) o.corridor_cm = d.corridor_mm / 10; if (d.threshold_mm != null) o.threshold_cm = d.threshold_mm / 10; if (d.bed_bath_mm != null) o.bed_bath_m = d.bed_bath_mm / 1000; if (d.outlets != null) o.outlets = d.outlets; return o; };

  // ── 方案圖面版本、工作包、驗收（同 Demo 的 Ya 模組；第 2 批起由生活顧問與技師寫入） ──
  async function uname(ids) {
    const L = [...new Set((ids || []).filter(Boolean))]; if (!L.length) return {};
    const r = await rpc('user_names', { p_ids: L }); return Object.fromEntries((r || []).map((x) => [x.id, x.name]));
  }
  const PKG_STEPS = {
    B: ['確認床邊與走道插座', '安裝感應小夜燈 ×3', '安裝門檻提示燈條', '關燈測試感應距離與亮度', '拍照回報'],
    S: ['到場確認', '檢測設備與連線', '更換電池或零件', '測試事件回傳', '拍照回報'],
  };
  async function latestVersion(hid) { const r = await q(db('plan_versions').select('*').eq('household_id', hid).order('ver', { ascending: false }).limit(1)); return r[0] || null; }
  async function versionOut(v) { if (!v) return null; const N = await uname([v.by_id]); return { id: v.id, ver: v.ver, status: v.status, reason: v.reason, pins: v.pins || [], created_at: ls(v.created_at), locked_at: ls(v.locked_at), by: N[v.by_id] || null }; }
  async function versionsOf(hid) { return (await q(db('plan_versions').select('ver, status, reason, created_at, locked_at').eq('household_id', hid).order('ver'))).map((v) => ({ ...v, created_at: ls(v.created_at), locked_at: ls(v.locked_at) })); }
  async function packagesOf(bid) {
    const L = await q(db('work_packages').select('*').eq('booking_id', bid));
    const ord = { B: 0, A: 1 }; L.sort((a, b) => (ord[a.code] ?? 2) - (ord[b.code] ?? 2));
    const N = await uname(L.map((x) => x.assignee_id)), st = Object.fromEntries(L.map((x) => [x.code, x.status]));
    return L.map((g) => { const pre = g.prereq && st[g.prereq], locked = !!(pre && pre !== '已完成') && g.status !== '已完成';
      return { id: g.id, code: g.code, name: g.name, team: g.team, assignee_id: g.assignee_id, assignee: N[g.assignee_id] || null, prereq: g.prereq && pre ? g.prereq : null, locked, status: locked && g.status === '未開始' ? '等待前置' : g.status, steps: g.steps || {}, step_names: PKG_STEPS[g.code] || null, started_at: ls(g.started_at), done_at: ls(g.done_at) }; });
  }
  async function acceptanceOf(bid) { const r = await q(db('acceptances').select('*').eq('booking_id', bid).order('id', { ascending: false }).limit(1)); const g = r[0]; return g ? { result: g.result, by_role: g.by_role, by_name: g.by_name, items: g.items || [], note: g.note, when: T().short(ls(g.created_at)) } : null; }
  async function work(hid, inst) {
    const [v, vs, acc, pk] = await Promise.all([latestVersion(hid).then(versionOut), versionsOf(hid), inst ? acceptanceOf(inst.id) : null, inst ? packagesOf(inst.id) : []]);
    return { pv: v, versions: vs, acceptance: acc, packages: pk.map((x) => ({ code: x.code, name: x.name, team: x.team, assignee: x.assignee, status: x.status, done_at: x.done_at })) };
  }
  // 員工操作紀錄（總部「最近動態」）
  async function audit(action, target, detail) { try { await db('audit').insert({ action, target: target || null, detail: detail || null }); } catch (e) {} }
  Object.assign(work, { latestVersion, versionOut, versionsOf, packagesOf, acceptanceOf, PKG_STEPS });

  let FP = null; // 這一家的真實格局（生活顧問到府畫）
  async function home(c) {
    const hid = c.hid, h = c.h;
    const [mems, as, bks, pls, devs, wis, care, reqs, rems] = await Promise.all([
      rpc('household_members', { p_household: hid }),
      q(db('assessments').select('*').eq('household_id', hid).order('id', { ascending: false }).limit(1)),
      q(db('bookings').select('*').eq('household_id', hid).neq('status', '已取消').order('id', { ascending: false })),
      q(db('plans').select('*').eq('household_id', hid).in('status', ['待確認', '已確認']).order('id', { ascending: false }).limit(1)),
      q(db('devices').select('id, home, name, years, grade, status, warn, kwh, warranty, old, source, qty').eq('household_id', hid).order('id')),
      q(db('wishes').select('id, code, category, text, status, reply, created_at').eq('household_id', hid).order('id', { ascending: false })),
      q(db('care_events').select('id, occurred_at, kind, title, outcome, timeline').eq('household_id', hid).order('occurred_at', { ascending: false }).limit(20)),
      q(db('requests').select('id, kind, note, status, created_at').eq('household_id', hid).order('id', { ascending: false }).limit(20)),
      q(db('reminders').select('id, device, kind, reason, due, status, booking_id').eq('household_id', hid).neq('status', '已略過').order('id')),
    ]);
    const fp = await q(db('floorplans').select('layout, updated_at').eq('household_id', hid).maybeSingle());
    FP = fp ? { at: ls(fp.updated_at) } : null;
    if (window.JJJLAYOUT) window.JJJLAYOUT.setHome(fp ? fp.layout : null);
    const consult = bks.filter((b) => b.kind === '門市諮詢'), inst = bks.find((b) => b.kind === '到府安裝') || null;
    const owner = (mems || []).find((m) => m.user_id === h.created_by);
    const byId = Object.fromEntries(bks.map((b) => [b.id, b]));
    return {
      household: { id: h.id, name: h.elder_name + '家', elder_name: h.elder_name, elder_note: h.elder_note, store: h.store, phase: h.phase || 0, address: h.address, phone: h.phone, prefs: h.prefs || {}, contacts: h.contacts || [], obs: h.obs || null, relation: h.relation },
      owner: owner ? owner.display_name : null,
      members: (mems || []).map((m) => ({ name: m.display_name || '家人', relation: REL[m.relation] || '家人' })).sort((a, b) => (a.relation === '管理者' ? -1 : b.relation === '管理者' ? 1 : 0)),
      assessment: u5(as[0]), booking: nf(consult[0]), plan: oa(pls[0]), install: nf(inst),
      devices: devs.map((d) => ({ ...d, old: d.old ? 1 : 0 })),
      wishes: wis.map((w) => ({ ...w, created_at: ls(w.created_at) })),
      care: care.map((e) => { const t = ls(e.occurred_at); return { ...e, occurred_at: t, timeline: e.timeline || [], when: T().short(t) }; }),
      requests: reqs.map((r) => ({ ...r, created_at: ls(r.created_at) })),
      ...(await work(hid, inst)),
      reminders: rems.sort((a, b) => (a.status === '待處理' ? 0 : 1) - (b.status === '待處理' ? 0 : 1)).map((r) => { const b = r.booking_id && byId[r.booking_id]; return { id: r.id, device: r.device, kind: r.kind, reason: r.reason, due: r.due, status: r.status, booking: b ? { status: b.status, label: label(b.slot_start, b.slot_end) } : null }; }),
    };
  }
  const touch = (hid) => db('households').update({ updated_at: new Date().toISOString() }).eq('id', hid);

  // ── 透傳：Demo 內建的固定內容（不含個人資料） ──
  let inner = null;
  async function pass(url, o) { const r = await inner(url, o); return r; }
  async function passJSON(url) { const r = await inner(url, { headers: { Accept: 'application/json' } }); return r.json(); }

  // ── 門市時段（同 Demo：7 天內、2 小時後、最多 8 個；名額由資料庫算） ──
  async function slots(store) {
    const st = R().storeByName(store); if (!st) throw new E('門市不存在');
    const now = T().now(), out = [];
    for (let d = 0; d < 7 && out.length < 8; d++) for (const tm of st.times) {
      const s = T().slotOf(T().addDays(now, d), tm);
      if (T().parseSlot(s) - now < 2 * 36e5) continue;
      out.push(s); if (out.length >= 8) break;
    }
    const taken = out.length ? await rpc('slot_taken', { p_store: st.name, p_slots: out }) : [];
    const n = Object.fromEntries((taken || []).map((x) => [x.slot, x.n]));
    return out.map((s) => ({ slot: s, label: label(s), full: (n[s] || 0) >= st.cap }));
  }

  // ── 揪心願作品（同 store3.js 的 brief） ──
  async function briefs(L, uid) {
    if (!L.length) return [];
    const ids = L.map((w) => w.id), owners = [...new Set(L.map((w) => w.owner))];
    const [cnt, names, mine] = await Promise.all([
      rpc('wish_support_counts', { p_ids: ids }), rpc('user_names', { p_ids: owners }),
      uid ? q(db('wish_supports').select('work_id, kind').eq('user_id', uid).in('work_id', ids)) : [],
    ]);
    const C = Object.fromEntries((cnt || []).map((x) => [x.work_id, x])), N = Object.fromEntries((names || []).map((x) => [x.id, x.name])), M = Object.fromEntries((mine || []).map((x) => [x.work_id, x.kind]));
    return L.map((w) => {
      const c = C[w.id] ? C[w.id].n : w.base || 0, created = ls(w.created_at);
      const days = Math.floor((Date.now() - new Date(w.created_at).getTime()) / 864e5), i = STAGES.findIndex(([n]) => c < n);
      let st; if (i < 0) st = { i: 3, left: null, need: 0, label: '已達 100 戶，進入每季審查' };
      else { const [n, dd] = STAGES[i], left = dd ? Math.max(0, dd - days) : null; st = { i, left, need: n - c, label: `第 ${i + 1} 關：${dd ? dd + ' 天內 ' : ''}${n} 戶，還差 ${n - c} 戶${left != null ? `、剩 ${left} 天` : ''}` }; }
      return { id: w.id, title: w.title, field: w.field || w.scene, status: w.status, theme_id: w.theme_id, parent_id: w.parent_id, designer: N[w.owner] || '使用者', user_id: w.owner, count: c, stage: st, build: w.build || [], story: w.story || {}, mine: M[w.id] || null, created_at: created, derivs: C[w.id] ? C[w.id].derivs : 0 };
    });
  }

  // ── 路由：[方法, 路徑, 處理(c, m, body, query)]；c=null 表示不需要登入 ──
  const OPEN = Symbol('open'), NOHH = Symbol('nohh');
  const routes = [
    // 固定內容透傳（Demo 內建資料，不含個人資料）
    ['GET', /^\/api\/config$/, OPEN, async () => { const d = await passJSON('/api/config'); return J(Object.assign(d, { demo: false, demo_accounts: [], demo_password: null })); }],
    ['GET', /^\/api\/(catalog|shop\/products|wish\/parts|ops\/phase|care\/rules|faq|faq\/match)$/, 'pass'],
    ['POST', /^\/api\/(faq\/log|faq\/helpful)$/, 'pass'],
    ['POST', /^\/api\/metrics$/, OPEN, () => J({ ok: true })],
    ['GET', /^\/api\/health$/, OPEN, () => J({ ok: true, demo: false })],

    // 帳號
    ['GET', /^\/api\/me$/, NOHH, async (c) => J({ user: meUser(c), household: c.h ? { id: c.h.id, name: c.h.elder_name + '家', phase: c.h.phase || 0, store: c.h.store } : null })],
    ['POST', /^\/api\/auth\/logout$/, OPEN, async () => { try { await sb().auth.signOut(); } catch (e) {} setTimeout(() => location.replace(location.pathname + '?mode=live'), 50); return J({ ok: true }); }],
    // 員工：員工編號＋密碼（E100001 → e100001@staff.jiujujia.example；帳號由總部建立）；家庭一律用 LINE 登入
    ['POST', /^\/api\/auth\/login$/, OPEN, async (c, m, b) => {
      const id = String(b.email || '').trim(), pw = String(b.password || '');
      if (!id || !pw) throw new E('請輸入員工編號和密碼');
      const email = id.includes('@') ? id : id.toLowerCase() + '@staff.jiujujia.example';
      const { error } = await sb().auth.signInWithPassword({ email, password: pw });
      if (error) throw new E('員工編號或密碼不正確', 401);
      const c2 = await ctx(false);
      if (!c2.staff) { await sb().auth.signOut(); throw new E('家庭帳號請用 LINE 登入揪居家 App', 403); }
      try { await db('profiles').update({ last_login: new Date().toISOString() }).eq('id', c2.uid); } catch (e) {}
      return J({ user: meUser(c2) });
    }],
    ['POST', /^\/api\/auth\/register$/, OPEN, () => ERR('實用版請用 LINE 登入', 400)],
    ['POST', /^\/api\/me\/password$/, OPEN, () => ERR('實用版用 LINE 登入，不需要密碼', 400)],

    // 揪居家首頁
    ['GET', /^\/api\/home$/, async (c) => J(await home(c))],
    ['PUT', /^\/api\/home\/prefs$/, async (c, m, b) => {
      const p = Object.assign({}, c.h.prefs || {}); for (const k of ['big', 'ns', 'fam', 'consent', 'grand']) if (k in b) p[k] = b[k];
      if (JSON.stringify(p).length > 4000) throw new E('設定內容過長');
      await q(db('households').update({ prefs: p, updated_at: new Date().toISOString() }).eq('id', c.hid)); return J({ prefs: p });
    }],
    ['PUT', /^\/api\/home\/profile$/, async (c, m, b) => {
      const cut = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
      const u = { elder_name: cut(b.elder_name, 20) || c.h.elder_name, elder_note: cut(b.elder_note, 40) || c.h.elder_note, updated_at: new Date().toISOString() };
      if ('address' in b) u.address = cut(b.address, 120) || null; if ('phone' in b) u.phone = cut(b.phone, 20) || null;
      await q(db('households').update(u).eq('id', c.hid)); return J(await home(await ctx()));
    }],
    ['POST', /^\/api\/home\/invite$/, async (c) => J({ code: await rpc('create_invite', { p_household: c.hid }), expires_days: 14 })],
    ['PUT', /^\/api\/home\/observation$/, async (c, m, b) => {
      const o = b && typeof b === 'object' ? b.obs : null; if (JSON.stringify(o || null).length > 3000) throw new E('觀察內容過長');
      await q(db('households').update({ obs: o || null, updated_at: new Date().toISOString() }).eq('id', c.hid)); return J({ ok: true });
    }],
    ['GET', /^\/api\/home\/summary$/, async (c, m, b, qs) => {
      const d = new Date(), mon = (qs && qs.get('m')) || `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
      const y = +mon.slice(0, 4), mm = +mon.slice(5, 7), from = new Date(y, mm - 1, 1).toISOString(), to = new Date(y, mm, 1).toISOString();
      const [E0, D, Rm, Q, N] = await Promise.all([
        q(db('care_events').select('kind, outcome, occurred_at, source').eq('household_id', c.hid).gte('occurred_at', from).lt('occurred_at', to)),
        q(db('devices').select('name, home, warn, warranty, status').eq('household_id', c.hid)),
        q(db('reminders').select('device, kind, reason, due, status').eq('household_id', c.hid).eq('status', '待處理')),
        q(db('requests').select('kind, status').eq('household_id', c.hid).gte('created_at', from).lt('created_at', to)),
        q(db('notifications').select('id', { count: 'exact' }).eq('household_id', c.hid).gte('created_at', from).lt('created_at', to).in('audience', ['owner', 'second'])),
      ]);
      const act = E0.filter((e) => e.kind === 'act'), dev = E0.filter((e) => e.kind === 'dev');
      const dim = new Date(y, mm, 0).getDate(), td = new Date(), days = td.getFullYear() === y && td.getMonth() + 1 === mm ? td.getDate() : dim;
      const eventDays = new Set(act.map((e) => ls(e.occurred_at).slice(0, 10))).size;
      return J({ month: mon, days, quiet: days - eventDays, asked: act.length, self: act.filter((e) => e.outcome === '長輩確認').length, fam: act.filter((e) => /家人|聯絡人|119/.test(e.outcome || '')).length, dev: dev.length, notified: (N || []).length,
        devices: { total: D.length, warn: D.filter((x) => x.warn).map((x) => ({ name: x.name, home: x.home, status: x.status })) }, reminders: Rm, requests: Q.length });
    }],

    // 居家評估（燈號規則同 Demo）
    ['POST', /^\/api\/assessments$/, async (c, m, b) => {
      let r; try { r = R().assess(b.answers, b.measures); } catch (e) { throw new E(e.message); }
      // 量法（AR／照片／手動）與材質來自 live-measure.js 一次量完
      const AS = (window.JJJAPP && window.JJJAPP.S) || {};
      // 量完又手動改過的格子算手動
      const KM = { corridor: 'corridor_cm', threshold: 'threshold_cm', dist: 'bed_bath_m' };
      if (!b.methods && AS.measSrc) b.methods = Object.fromEntries(Object.entries(KM).map(([k, mk]) => [k, AS.measSrc[k] && AS.measVal && Number(AS.measVal[k]) === Number((b.measures || {})[mk]) ? AS.measSrc[k] : 'manual']));
      const dur = Math.max(0, Math.min(7200, Number(b.duration_s) || 0)) || null, M = r.measures;
      const dims = { corridor_mm: M.corridor_cm != null ? Math.round(M.corridor_cm * 10) : null, threshold_mm: M.threshold_cm != null ? Math.round(M.threshold_cm * 10) : null, bed_bath_mm: M.bed_bath_m != null ? Math.round(M.bed_bath_m * 1000) : null, outlets: M.outlets != null ? M.outlets : null, methods: b.methods || undefined, materials: AS.liveMats && Object.keys(AS.liveMats).length ? AS.liveMats : undefined };
      const lights = r.lights.map(([k, cc, v]) => ({ k, c: cc === 'n' ? 'g' : cc, v }));
      await q(db('assessments').insert({ household_id: c.hid, source: b.methods && Object.values(b.methods).some((x) => x && x !== 'manual') ? 'ar' : 'app', dims, result: { lights }, filled_by: b.filled_by === 'self' ? 'self' : 'child', answers: r.answers, measures: r.measures, lights: r.lights, rec: r.rec, duration_s: dur, created_by: c.uid }));
      await touch(c.hid); return J(await home(c));
    }],
    ['GET', /^\/api\/home\/assessment-draft$/, async (c) => { const r = await q(db('hh_kv').select('v, updated_at').eq('household_id', c.hid).eq('k', 'assessment_draft').maybeSingle()); return J({ draft: r ? r.v : null, at: r ? ls(r.updated_at) : null }); }],
    ['PUT', /^\/api\/home\/assessment-draft$/, async (c, m, b) => { await q(db('hh_kv').upsert({ household_id: c.hid, k: 'assessment_draft', v: b.draft || {}, updated_by: c.uid, updated_at: new Date().toISOString() })); return J({ ok: true }); }],
    ['DELETE', /^\/api\/home\/assessment-draft$/, async (c) => { await q(db('hh_kv').delete().eq('household_id', c.hid).eq('k', 'assessment_draft')); return J({ ok: true }); }],
    ['GET', /^\/api\/home\/choices$/, async (c) => { const r = await q(db('hh_kv').select('v').eq('household_id', c.hid).eq('k', 'choices').maybeSingle()); return J({ state: r ? r.v : null }); }],
    ['PUT', /^\/api\/home\/choices$/, async (c, m, b) => { await q(db('hh_kv').upsert({ household_id: c.hid, k: 'choices', v: b.state || {}, updated_by: c.uid, updated_at: new Date().toISOString() })); return J({ ok: true }); }],
    ['POST', /^\/api\/home\/handoff$/, async (c, m, b) => { await q(db('family_handoffs').insert({ household_id: c.hid, items: b.items || [], at: String(b.at || ''), by_id: c.uid })); return J({ ok: true }); }],
    ['GET', /^\/api\/home\/handoffs$/, async (c) => J({ handoffs: (await q(db('family_handoffs').select('items, at').eq('household_id', c.hid).order('id', { ascending: false }).limit(5))) })],
    ['GET', /^\/api\/home\/quote$/, async (c) => {
      const Q = await q(db('quotes').select('id, version, total, items, created_at').eq('household_id', c.hid).order('version', { ascending: false }).limit(1));
      if (!Q.length) return J({ quote: null });
      const ok = await q(db('consents').select('id').eq('household_id', c.hid).eq('quote_id', Q[0].id).limit(1));
      return J({ quote: { v: Q[0].version, total: Q[0].total, pending: 0, items: Q[0].items || [], status: ok.length ? '已同意' : '待長輩確認', at: ls(Q[0].created_at) } });
    }],

    // 預約、需求、驗收、提醒
    ['GET', /^\/api\/slots$/, async (c, m, b, qs) => J({ slots: await slots((qs && qs.get('store')) || c.h.store) })],
    ['POST', /^\/api\/bookings$/, async (c, m, b) => {
      const id = await rpc('book_consult', { p_store: String(b.store || ''), p_slot: String(b.slot || '') });
      const bk = await q(db('bookings').select('*').eq('id', id).single());
      return J({ booking: nf(bk), home: await home(await ctx()) });
    }],
    ['POST', /^\/api\/bookings\/(\d+)\/cancel$/, async (c, m) => { await rpc('cancel_booking', { p_id: +m[1] }); return J(await home(await ctx())); }],
    ['GET', /^\/api\/home\/bookings$/, async (c) => J({ bookings: (await q(db('bookings').select('id, code, kind, store, slot_start, status, note, created_at').eq('household_id', c.hid).order('slot_start', { ascending: false }))).map((x) => ({ ...x, created_at: ls(x.created_at) })) })],
    ['POST', /^\/api\/requests$/, async (c, m, b) => {
      if (!REQ_KINDS.includes(b.kind)) throw new E('需求類型不正確');
      const dup = await q(db('requests').select('id').eq('household_id', c.hid).eq('kind', b.kind).eq('status', '待處理').limit(1));
      if (!dup.length) await q(db('requests').insert({ household_id: c.hid, user_id: c.uid, kind: b.kind, note: String(b.note || '').slice(0, 200) || null }));
      return J({ ok: true, duplicate: !!dup.length });
    }],
    ['GET', /^\/api\/home\/requests$/, async (c) => J({ requests: (await q(db('requests').select('id, kind, note, status, created_at, handled_at').eq('household_id', c.hid).order('id', { ascending: false }))).map((x) => ({ ...x, created_at: ls(x.created_at), handled_at: ls(x.handled_at) })) })],
    ['POST', /^\/api\/preorders$/, async (c) => { const { error } = await db('preorders').insert({ topic_id: 'bath', user_id: c.uid, household_id: c.hid }); if (error && !/duplicate|23505/.test(error.code + error.message)) throw new E(dbMsg(error)); return J({ ok: true }); }],
    ['POST', /^\/api\/plan\/confirm$/, async (c, m, b) => { await rpc('plan_confirm', { p_address: String(b.address || ''), p_phone: String(b.phone || '') }); return J(await home(await ctx())); }],
    ['POST', /^\/api\/install\/accept$/, async (c, m, b) => { await rpc('install_review', { p_accept: true, p_note: String(b.note || '') }); return J(await home(await ctx())); }],
    ['POST', /^\/api\/install\/reject$/, async (c, m, b) => { await rpc('install_review', { p_accept: false, p_note: String(b.note || '') }); return J(await home(await ctx())); }],
    ['POST', /^\/api\/reminders\/(\d+)\/(book|skip)$/, async (c, m) => { await rpc('reminder_act', { p_id: +m[1], p_book: m[2] === 'book' }); return J(await home(await ctx())); }],

    // 通知
    ['GET', /^\/api\/home\/notifications$/, async (c) => {
      const L = (await q(db('notifications').select('id, care_event_id, audience, channel, kind, title, body, link, created_at, read_at').eq('household_id', c.hid).in('audience', ['owner', 'second', 'family']).order('id', { ascending: false }).limit(50)))
        .map((n) => ({ ...n, created_at: ls(n.created_at), read_at: ls(n.read_at) }));
      return J({ notifications: L, unread: L.filter((n) => !n.read_at).length });
    }],
    ['POST', /^\/api\/home\/notifications\/read$/, async (c, m, b) => {
      let x = db('notifications').update({ read_at: new Date().toISOString() }).eq('household_id', c.hid);
      x = b.id ? x.eq('id', +b.id) : x.is('read_at', null); await q(x); return J({ ok: true });
    }],

    // 揪心願（文字心願、題目投票）
    ['POST', /^\/api\/wishes$/, async (c, m, b) => {
      const text = String(b.text || '').trim().slice(0, 200); if (!text) throw new E('請寫下您的心願');
      const d = new Date(), code = `WS-${p2(d.getMonth() + 1)}${p2(d.getDate())}-${String(Date.now()).slice(-4)}`;
      await q(db('wishes').insert({ code, household_id: c.hid, user_id: c.uid, store: c.h.store, home: b.home === 'mine' ? 'mine' : 'parents', category: WISH_CATS.includes(b.category) ? b.category : '其他', text, source: 'App｜家人' }));
      return J(await home(c));
    }],
    ['GET', /^\/api\/wish-topics$/, async () => {
      const [t, cnt, pre] = await Promise.all([q(db('wish_topics').select('*').order('sort')), rpc('wish_topic_counts'), rpc('preorder_count', { p_topic: 'bath' })]);
      const C = Object.fromEntries((cnt || []).map((x) => [x.topic_id, x])), P = (pre && pre[0]) || { n: 0, me: false };
      return J({ topics: t.map((x) => ({ id: x.id, n: x.name, d: x.descr, c: x.base + (C[x.id] ? C[x.id].votes : 0), th: x.threshold, st: x.status, me: !!(C[x.id] && C[x.id].me) })), preorder: { count: P.n, me: !!P.me } });
    }],
    ['POST', /^\/api\/wish-topics\/([\w-]+)\/vote$/, async (c, m) => {
      const ex = await q(db('wish_votes').select('topic_id').eq('topic_id', m[1]).eq('user_id', c.uid).limit(1));
      if (ex.length) await q(db('wish_votes').delete().eq('topic_id', m[1]).eq('user_id', c.uid)); else await q(db('wish_votes').insert({ topic_id: m[1], user_id: c.uid }));
      return J({ me: !ex.length });
    }],

    // 長輩關懷
    ['GET', /^\/api\/care\/events\/(\d+)$/, async (c, m) => {
      const e = await q(db('care_events').select('id, household_id, occurred_at, kind, title, outcome, timeline, source').eq('id', +m[1]).maybeSingle());
      if (!e || e.household_id !== c.hid) throw new E('找不到事件', 404);
      const N = await q(db('notifications').select('audience, channel, title, created_at, read_at').eq('care_event_id', e.id).order('id'));
      return J({ event: { ...e, occurred_at: ls(e.occurred_at), elder_name: c.h.elder_name, store: c.h.store, timeline: e.timeline || [] }, notifications: N.map((n) => ({ ...n, created_at: ls(n.created_at), read_at: ls(n.read_at) })) });
    }],
    ['POST', /^\/api\/care\/drill$/, async (c, m, b) => J({ id: await rpc('care_drill', { p_kind: b.kind === 'dev' ? 'dev' : 'act', p_title: String(b.title || '異常事件'), p_timeline: b.timeline || [], p_notify: b.notify || [] }), hid: c.hid })],
    ['PUT', /^\/api\/care\/drill\/(\d+)$/, async (c, m, b) => { await rpc('care_drill_step', { p_id: +m[1], p_timeline: b.timeline || null, p_outcome: b.outcome ? String(b.outcome) : null, p_notify: b.notify || [] }); return J({ ok: true }); }],

    // 訂單、同意書、家電連結
    ['GET', /^\/api\/home\/orders$/, async (c) => J({ orders: (await q(db('orders').select('*').eq('household_id', c.hid).order('id', { ascending: false }))).map((o) => ({ ...o, created_at: ls(o.created_at), confirmed_at: ls(o.confirmed_at) })) })],
    ['POST', /^\/api\/home\/orders$/, async (c, m, b) => {
      const cat = await passJSON('/api/catalog'), ph = cat.phase, ids = (b.items || []).map(String), L = cat.items.filter((x) => ids.includes(x.id));
      if (!L.length) throw new E('請先選擇方案');
      const lock = L.find((x) => x.phase > ph); if (lock) throw new E(`「${lock.n}」${lock.phase === 1 ? '擴展期' : '延伸期'}才開放`);
      if (!cat.pay.includes(b.pay) && L.some((x) => x.monthly || x.one)) throw new E('請選擇付款方式');
      if (L.some((x) => x.id === 'cam')) { const ok = await q(db('consents').select('id').eq('household_id', c.hid).eq('kind', '進階影像版').eq('agreed', true).is('revoked_at', null).limit(1)); if (!ok.length) throw new E('需要長輩本人同意後才能訂購進階影像版'); }
      const mo = L.reduce((a, x) => a + x.monthly, 0), on = L.reduce((a, x) => a + x.one, 0), free = !mo && !on;
      const code = 'OD-' + Date.now().toString(36).slice(-6).toUpperCase();
      const o = await q(db('orders').insert({ household_id: c.hid, code, items: L.map((x) => ({ id: x.id, n: x.n, monthly: x.monthly, one: x.one, g: x.g })), monthly: mo, one_time: on, pay: free ? null : b.pay, status: free && L.every((x) => x.g === '活動') ? '已報名' : '待生活顧問確認', note: String(b.note || ''), by_id: c.uid }).select('id').single());
      await rpc('notify_household', { p_household: c.hid, p_kind: 'plan', p_title: '已送出：' + L.map((x) => x.n.split('｜')[0]).join('、'), p_body: '生活顧問 1 個工作天內與您聯絡確認', p_link: 'order:' + o.id });
      return J({ id: o.id, code, monthly: mo, one_time: on });
    }],
    ['POST', /^\/api\/home\/orders\/(\d+)\/cancel$/, async (c, m) => { await rpc('cancel_order', { p_id: +m[1] }); return J({ ok: true }); }],
    ['GET', /^\/api\/home\/consents$/, async (c) => J({ consents: (await q(db('consents').select('id, household_id, kind, items, agreed, by_name, created_at, revoked_at').eq('household_id', c.hid).not('kind', 'is', null).order('id', { ascending: false }))).map((x) => ({ ...x, agreed: x.agreed ? 1 : 0, by: x.by_name, created_at: ls(x.created_at), revoked_at: ls(x.revoked_at) })) })],
    ['POST', /^\/api\/home\/consents$/, async (c, m, b) => { const r = await q(db('consents').insert({ household_id: c.hid, kind: String(b.kind || ''), items: b.items || [], agreed: !!b.agreed, by_name: String(b.by || '長輩本人'), consented_by: c.uid }).select('id').single()); return J({ id: r.id }); }],
    ['POST', /^\/api\/home\/consents\/(\d+)\/revoke$/, async (c, m) => { await q(db('consents').update({ revoked_at: new Date().toISOString() }).eq('id', +m[1]).eq('household_id', c.hid)); return J({ ok: true }); }],
    ['GET', /^\/api\/home\/device-links$/, async (c) => { const r = await q(db('hh_kv').select('v').eq('household_id', c.hid).eq('k', 'device_links').maybeSingle()); return J({ links: Object.entries((r && r.v) || {}).map(([name, linked]) => ({ name, linked: linked ? 1 : 0 })) }); }],
    ['PUT', /^\/api\/home\/device-links$/, async (c, m, b) => {
      const r = await q(db('hh_kv').select('v').eq('household_id', c.hid).eq('k', 'device_links').maybeSingle());
      const v = Object.assign({}, (r && r.v) || {}); for (const [n, x] of Object.entries(b.links || {})) v[String(n).slice(0, 40)] = !!x;
      await q(db('hh_kv').upsert({ household_id: c.hid, k: 'device_links', v, updated_by: c.uid, updated_at: new Date().toISOString() })); return J({ ok: true });
    }],

    // 家電保固、報修
    ['GET', /^\/api\/home\/warranty$/, async (c) => {
      const [D, open] = await Promise.all([q(db('devices').select('id, home, name, years, status, warn, warranty, source').eq('household_id', c.hid).order('id')), q(db('requests').select('note').eq('household_id', c.hid).eq('kind', '線上報修').eq('status', '待處理'))]);
      const o = open.map((r) => String(r.note || '').split('｜')[0]), mk = (d) => ({ ...d, repairing: o.includes(d.name), expired: /已過保/.test(d.warranty || '') });
      return J({ mine: D.filter((d) => d.home === 'mine').map(mk), parents: D.filter((d) => d.home === 'parents' && d.source !== '到府安裝').map(mk), care: D.filter((d) => d.source === '到府安裝').map(mk) });
    }],
    ['POST', /^\/api\/home\/repair$/, async (c, m, b) => {
      const d = await q(db('devices').select('*').eq('id', +b.device_id).eq('household_id', c.hid).maybeSingle()); if (!d) throw new E('找不到家電', 404);
      if (d.source === '到府安裝') throw new E('揪夜安關懷設備請找生活顧問處理');
      const dup = await q(db('requests').select('id').eq('household_id', c.hid).eq('kind', '線上報修').eq('status', '待處理').like('note', d.name + '｜%').limit(1));
      if (dup.length) return J({ duplicate: true });
      await q(db('requests').insert({ household_id: c.hid, user_id: c.uid, kind: '線上報修', note: d.name + '｜' + String(b.note || '待技師聯絡').slice(0, 60) })); return J({ ok: true });
    }],

    // 購物車、線上購物
    ['GET', /^\/api\/cart$/, NOHH, async (c) => J({ items: await q(db('cart_items').select('sku, name, price, qty, src').eq('user_id', c.uid)) })],
    ['POST', /^\/api\/cart$/, NOHH, async (c, m, b) => {
      const P = (await passJSON('/api/shop/products')).products; let n = 0;
      const cur = Object.fromEntries((await q(db('cart_items').select('sku, qty').eq('user_id', c.uid))).map((x) => [x.sku, x.qty]));
      for (const it of b.items || []) { const p = P.find((x) => x.sku === it.sku); if (!p) continue; const k = Math.max(1, Math.min(20, it.qty | 0 || 1)); await q(db('cart_items').upsert({ user_id: c.uid, sku: p.sku, name: p.n, price: p.price, qty: Math.min(20, (cur[p.sku] || 0) + k), src: String(it.src || '') })); cur[p.sku] = Math.min(20, (cur[p.sku] || 0) + k); n += k; }
      return J({ added: n, count: Object.values(cur).reduce((a, x) => a + x, 0) });
    }],
    ['PUT', /^\/api\/cart\/(\w+)$/, NOHH, async (c, m, b) => { const k = b.qty | 0; if (k <= 0) await q(db('cart_items').delete().eq('user_id', c.uid).eq('sku', m[1])); else await q(db('cart_items').update({ qty: Math.min(20, k) }).eq('user_id', c.uid).eq('sku', m[1])); return J({ ok: true }); }],
    ['POST', /^\/api\/cart\/checkout$/, NOHH, async (c, m, b) => {
      const L = await q(db('cart_items').select('sku, name, price, qty').eq('user_id', c.uid)); if (!L.length) throw new E('購物車是空的');
      if (!String(b.name || '').trim() || !String(b.phone || '').trim() || !String(b.address || '').trim()) throw new E('請填寫收件人、電話與地址');
      if (!b.pay) throw new E('請選擇付款方式');
      const P = (await passJSON('/api/shop/products')).products, price = (x) => { const p = P.find((y) => y.sku === x.sku); return p ? p.price : x.price; };
      const total = L.reduce((a, x) => a + price(x) * x.qty, 0), code = 'EC' + Date.now().toString(36).slice(-6).toUpperCase();
      await q(db('orders').insert({ household_id: c.hid, code, items: L.map((x) => ({ id: x.sku, n: x.name + (x.qty > 1 ? ' ×' + x.qty : ''), monthly: 0, one: price(x) * x.qty, g: '商品' })), monthly: 0, one_time: total, pay: String(b.pay), status: '已成立', note: JSON.stringify({ name: b.name, phone: b.phone, address: b.address, kind: '線上購物' }), by_id: c.uid }));
      await q(db('cart_items').delete().eq('user_id', c.uid));
      if (c.hid) await rpc('notify_household', { p_household: c.hid, p_kind: 'order', p_title: '線上購物訂單已成立 ' + code, p_body: '商品將依物流配送；大型家電由技師到府安裝', p_link: null });
      return J({ code, total });
    }],

    // 影片任務
    ['GET', /^\/api\/videos$/, NOHH, async (c) => J({ videos: (await q(db('video_tasks').select('*').eq('user_id', c.uid).order('id', { ascending: false }))).map((v) => ({ ...v, created_at: ls(v.created_at) })) })],
    ['POST', /^\/api\/videos$/, NOHH, async (c, m, b) => {
      const ck = b.checks || {}; if (!['a', 'b', 'c', 'd'].every((k) => ck[k])) throw new E('四項隱私確認都要勾選');
      const r = await q(db('video_tasks').insert({ user_id: c.uid, household_id: c.hid, topic: String(b.topic || '').slice(0, 80), checks: ck }).select('id').single()); return J({ id: r.id });
    }],

    // 揪心願作品、點數
    ['GET', /^\/api\/points$/, NOHH, async (c) => {
      const L = await q(db('wish_points').select('id, user_id, work_id, reason, points, status, created_at, checked_at').eq('user_id', c.uid).order('id', { ascending: false }));
      const ids = [...new Set(L.map((x) => x.work_id).filter(Boolean))], W = ids.length ? await q(db('wish_works').select('id, title').in('id', ids)) : [];
      const t = Object.fromEntries(W.map((w) => [w.id, w.title]));
      const items = L.map((x) => ({ ...x, title: t[x.work_id] || null, created_at: ls(x.created_at) }));
      return J({ items, total: items.filter((x) => x.status === '已入帳').reduce((a, x) => a + x.points, 0), pending: items.filter((x) => x.status === '待檢核').reduce((a, x) => a + x.points, 0) });
    }],
    ['GET', /^\/api\/wish\/works$/, NOHH, async (c, m, b, qs) => {
      const tab = (qs && qs.get('tab')) || 'all', f = (qs && qs.get('field')) || '', sort = (qs && qs.get('sort')) || 'near', hid = qs && qs.get('hid');
      let L = await q(db('wish_works').select('*').order('id', { ascending: false }).limit(200));
      if (tab === 'mine') L = L.filter((w) => w.owner === c.uid); else if (tab === 'theme') L = L.filter((w) => w.theme_id); else if (tab === 'all') L = L.filter((w) => w.status !== '草稿');
      if (hid) L = L.filter((w) => w.household_id === +hid); if (f) L = L.filter((w) => (w.field || w.scene) === f);
      const Rw = await briefs(L, c.uid);
      if (sort === 'near') Rw.sort((a, x) => (a.stage.need || 999) - (x.stage.need || 999)); else Rw.sort((a, x) => x.id - a.id);
      return J({ works: Rw, themes: await q(db('wish_themes').select('*').order('id')) });
    }],
    ['GET', /^\/api\/wish\/works\/(\d+)$/, NOHH, async (c, m) => {
      const w = await q(db('wish_works').select('*').eq('id', +m[1]).maybeSingle()); if (!w) throw new E('找不到作品', 404);
      const [d] = await briefs([w], c.uid);
      const [par, der, upd, com, cp, eli, th] = await Promise.all([
        w.parent_id ? q(db('wish_works').select('id, title, owner').eq('id', w.parent_id).maybeSingle()) : null,
        q(db('wish_works').select('*').eq('parent_id', w.id).order('id')),
        q(db('wish_updates').select('by_name, text, created_at').eq('work_id', w.id).order('id', { ascending: false })),
        q(db('wish_comments').select('id, name, text, status, created_at, user_id').eq('work_id', w.id).order('id', { ascending: false })),
        q(db('wish_cparts').select('id, name, purpose, photo, status').eq('work_id', w.id)),
        c.hid && (c.prof.role || 'family') === 'family' ? rpc('wish_eligible', { p_field: w.field || w.scene }) : false,
        w.theme_id ? q(db('wish_themes').select('*').eq('id', w.theme_id).maybeSingle()) : null,
      ]);
      if (par) { const [pn] = await briefs([{ ...par, status: '共鳴中', created_at: w.created_at }], c.uid); d.parent = { id: par.id, title: par.title, user_id: par.owner, designer: pn.designer }; } else d.parent = null;
      d.derivatives = await briefs(der.filter((x) => x.status !== '草稿' || x.owner === c.uid), c.uid);
      d.updates = upd.map((x) => ({ ...x, created_at: ls(x.created_at) }));
      d.comments = com.filter((x) => x.status === '顯示' || x.user_id === c.uid).map((x) => ({ ...x, created_at: ls(x.created_at) }));
      d.cparts = cp; d.eligible = !!eli; d.plan = PLAN_NAME[w.field || w.scene]; d.theme = th || null;
      return J({ work: d });
    }],
    ['POST', /^\/api\/wish\/works$/, NOHH, async (c, m, b) => {
      const s = b.story || {}, title = String(b.title || s.hope || '').trim().slice(0, 40), field = FIELDS.includes(b.field) ? b.field : '';
      if (!title || !field) throw new E('請寫下希望，並選擇場域');
      const bad = BAN.filter(([re]) => re.test([s.when, s.stuck, s.hope, title].join(' '))).map((x) => x[1]); if (bad.length) throw new E('內容要修改：' + bad.join('、'));
      if (!b.terms || !b.terms.rules || !b.terms.license) throw new E('送出前要勾選投稿規範與授權');
      const build = (b.build || []).filter((x) => x && (x.part || x.cpart != null)).slice(0, 12); if (!build.length) throw new E('至少擺一個零件');
      const xy = (x) => (Number.isFinite(+x.x) && Number.isFinite(+x.y) && x.x !== null && x.y !== null ? { x: Math.max(0, Math.min(9000, Math.round(+x.x))), y: Math.max(0, Math.min(9000, Math.round(+x.y))) } : {});
      const ph = (await passJSON('/api/ops/phase')).phase, draft = ph < 1 && field !== '臥室到浴室';
      const id = await rpc('wish_submit', { p_title: title, p_field: field, p_story: s, p_build: build.map((x) => (x.cpart != null ? { slot: x.slot, cpart: String(x.cpart), ...xy(x) } : { slot: x.slot, part: x.part, ...xy(x) })), p_cparts: (b.cparts || []).map((x) => ({ ...x, tmp: String(x.tmp) })), p_theme: b.theme_id || null, p_parent: b.parent_id || null, p_draft: draft });
      return J({ id, status: draft ? '草稿' : '共鳴中' });
    }],
    ['POST', /^\/api\/wish\/works\/(\d+)\/support$/, NOHH, async (c, m, b) => { const n = await rpc('wish_support', { p_work: +m[1], p_follow: !!b.follow, p_buy: String(b.buy || ''), p_price: String(b.price || '') }); return J(b.follow ? { follow: true } : { count: n }); }],
    ['POST', /^\/api\/wish\/works\/(\d+)\/comments$/, NOHH, async (c, m, b) => {
      const t = String(b.text || '').trim().slice(0, 200); if (!t) throw new E('請寫下留言');
      const bad = BAN.filter(([re]) => re.test(t)).map((x) => x[1]); if (bad.length) throw new E('留言要修改：' + bad.join('、'));
      await q(db('wish_comments').insert({ work_id: +m[1], user_id: c.uid, text: t })); return J({ ok: true, status: '待審核' });
    }],
  ];
  // 其他角色（生活顧問、技師、總部、大使、企業）與 AI 轉真人：後續批次接上
  const LATER = /^\/api\/(tech|admin|amb|biz|support)\//;

  async function handle(method, path, body, qs, url, o) {
    for (const [mth, re, need, fn] of routes) {
      if (mth !== method) continue; const m = path.match(re); if (!m) continue;
      if (need === 'pass') return pass(url, o);
      try {
        if (need === OPEN) return await fn(null, m, body || {}, qs);
        if (Array.isArray(need)) {
          const c = await ctx(false);
          if (!need.includes(c.role)) throw new E(c.staff ? '這個帳號沒有權限' : '請用員工帳號登入', 403);
          return await fn(c, m, body || {}, qs);
        }
        const c = await ctx(need !== NOHH);
        if (c.staff && need !== NOHH) throw new E('這是員工帳號，請改用員工畫面', 403);
        return await (typeof need === 'function' ? need : fn)(c, m, body || {}, qs);
      } catch (e) {
        if (e instanceof E) return ERR(e.message, e.status);
        console.warn('[實用版 API]', path, e); return ERR('系統忙碌中，請稍後再試', 500);
      }
    }
    if (LATER.test(path)) return ERR('實用版這個功能還沒開放', 403);
    return ERR('實用版這個功能還沒開放', 404);
  }

  function install() {
    if (inner) return;
    inner = window.fetch;
    window.fetch = async (u, o = {}) => {
      const url = typeof u === 'string' ? u : u.url;
      const U = new URL(url, location.href);
      if (U.origin === location.origin && /\/api\//.test(U.pathname)) {
        const path = U.pathname.replace(/^.*(\/api\/)/, '$1'), method = (o.method || 'GET').toUpperCase();
        return handle(method, path, o.body ? parse(o.body) : null, U.searchParams, url, o);
      }
      return inner(u, o);
    };
  }

  // ── 進入 Demo 畫面：已登入、有長輩家才進來（沒有長輩家時由 live-app.js 先建立或加入） ──
  const KEY_VIEW = { inbox: 'inbox' };
  let busy = false; // 進入畫面、載入首頁資料中：先不接受點擊，避免畫面用到還沒載入的資料
  async function enter(key) {
    install(); busy = true;
    try { await enter0(key); } finally { busy = false; }
  }
  async function enter0(key) {
    const A = window.JJJAPP; if (!A) return;
    const S = A.S;
    S.cfg = await (await window.fetch('/api/config')).json();
    const me = await (await window.fetch('/api/me')).json();
    S.me = me.user; active = true;
    document.documentElement.classList.add('jjj-live-in');
    // 同 app.html 的 enter()：家庭進首頁、生活顧問進今日行程（a1）、技師進今日工單（t1）
    const r = S.me.role;
    if (r === 'advisor') { await A.LOAD.a1(); S.stack = ['a1']; A.render(); }
    else if (r === 'tech') { await A.LOAD.t1(); S.stack = ['t1']; A.render(); }
    else if (r === 'hq') { location.href = 'admin.html?mode=live'; return; }
    else if (typeof window.enter === 'function') await window.enter(); else { await A.LOAD.gl(); A.render(); }
    const v = KEY_VIEW[key];
    if (v && v !== 'home' && A.go) { try { A.go(v); } catch (e) {} }
  }

  // 2D／3D 圖面：顧問到府前用範本格局，標「示意格局」（第 2 批起換成各家真實格局）
  const css = document.createElement('style');
  css.textContent = `.jjj-live-in .tcad,.jjj-live-in .hpw,.jjj-live-in [data-w3d]{position:relative}
.lv-demo-layout{position:absolute;left:8px;top:8px;z-index:3;background:rgba(212,0,60,.92);color:#fff;font-size:12px;font-weight:700;border-radius:8px;padding:4px 8px;pointer-events:none;max-width:calc(100% - 16px);line-height:1.4}`;
  document.head.appendChild(css);
  (window.JJJHOOKS || (window.JJJHOOKS = [])).push((v, view) => {
    if (!active) return;
    view.querySelectorAll('.tcad, .hpw, [data-w3d]').forEach((el) => {
      if (el.querySelector(':scope > .lv-demo-layout')) return;
      el.insertAdjacentHTML('afterbegin', FP ? `<span class="lv-demo-layout" style="background:rgba(31,35,40,.85)">您家的格局｜生活顧問 ${String(FP.at || '').slice(5, 10).replace('-', '/')} 更新</span>` : '<span class="lv-demo-layout">示意格局｜生活顧問到府後換成您家的格局</span>');
    });
  });

  // AR 量測：Demo 的「用手機實際量」在實用版打開 live-measure.js（一次量完，結果帶回評估表）
  document.addEventListener('click', (e) => {
    if (!active) return;
    // 只接「用手機實際量」主按鈕；上方「AR 量測／手動輸入」切換與「先看示範怎麼量」照 Demo
    const t = e.target.closest('#arBtn[data-go="arm"]'); if (!t || !window.JJJMeasure) return;
    e.preventDefault(); e.stopPropagation();
    const S = window.JJJAPP.S, M = S.meas || (S.meas = {});
    const vals = {}, modes = {};
    if (M.corridor_cm != null) { vals.corridor = M.corridor_cm; modes.corridor = (S.measSrc || {}).corridor || 'manual'; }
    if (M.threshold_cm != null) { vals.threshold = M.threshold_cm; modes.threshold = (S.measSrc || {}).threshold || 'manual'; }
    if (M.bed_bath_m != null) { vals.dist = M.bed_bath_m; modes.dist = (S.measSrc || {}).dist || 'manual'; }
    window.JJJMeasure.walk({ init: { vals, modes, outlets: M.outlets != null ? +M.outlets : 0, mats: S.liveMats || {} }, onDone: (r) => {
      if (r.vals.corridor != null) M.corridor_cm = r.vals.corridor; if (r.vals.threshold != null) M.threshold_cm = r.vals.threshold; if (r.vals.dist != null) M.bed_bath_m = r.vals.dist;
      M.outlets = String(r.outlets); S.measSrc = Object.assign(S.measSrc || {}, r.modes); S.measVal = Object.assign(S.measVal || {}, r.vals); S.liveMats = r.mats;
      S.mat = {}; const MAP = { bath: '磁磚', wall: '水泥牆', door: '鋁框' };
      for (const [k, v] of Object.entries(r.mats || {})) S.mat[k] = v === '待顧問確認' ? 'u' : v === MAP[k] ? 1 : v;
      if (typeof window.saveDraft === 'function') window.saveDraft();
      window.JJJAPP.render();
      // 量完切到「手動輸入」畫面，數字已帶入，可以檢查、修改後按下一步
      const man = document.querySelector('#view [data-armode="manual"]'); if (man) man.click();
    } });
  }, true);

  // 要包在 Demo 模擬後端（backend.js、store*.js）的外層，等頁面上的腳本都跑完再接手
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
    // 給 live-staff.js（生活顧問、技師、總部）共用
  const H = { OPEN, NOHH, q, rpc, db, sb, J, ERR, E, ctx, ls, nf, oa, u5, label, parse, R, T, work, touch, audit, uname, passJSON };
  window.JJJLIVEAPI = { enter, active: () => active, busy: () => busy, install, _routes: routes, H, ready: (fn) => fn(H, routes) };
})();
