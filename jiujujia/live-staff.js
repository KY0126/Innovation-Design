// 實用版（Live）員工端 API：生活顧問（第 2 批）；技師（第 3 批）、總部（第 4 批）接在後面
// 接在 live-api.js 的路由表後面：同一套 Demo 畫面（app.html 顧問模式、consultant.html），回傳格式同 Demo 模擬後端（backend.js、store*.js）
// 權限由資料庫把關（jjj.is_store_staff：本門市生活顧問或總部）；這裡再檢查一次，訊息才會跟 Demo 一樣
(function () {
  if (!window.JJJ_LIVE) return;
  function boot() {
    if (!window.JJJLIVEAPI || !window.JJJLIVEAPI.H) return setTimeout(boot, 30);
    const { q, rpc, db, J, E, ls, nf, oa, u5, label, R, T, work, touch, audit, uname, ctx, OPEN } = window.JJJLIVEAPI.H;
    const routes = window.JJJLIVEAPI._routes;
    const ADV = ['advisor', 'hq'];
    const v2 = (x, n = 200) => (typeof x === 'string' ? x.trim().slice(0, n) : '');
    const Ce = (h) => `${h.elder_name}家`;
    const today = () => T().ymd(T().now());
    const short = (iso) => T().short(ls(iso));
    const nowIso = () => new Date().toISOString();

    // 門市範圍：總部可用 ?store= 篩選，生活顧問固定自己門市（同 Demo 的 c4）
    const storeOf = (c, qs) => { if (c.role === 'hq') { const s = qs && qs.get && v2(qs.get('store')); const st = s && R().storeByName(s); return st ? st.name : null; } return c.store; };
    async function hhOf(c, hid) {
      const h = await q(db('households').select('*').eq('id', Number(hid)).maybeSingle());
      if (!h) throw new E('找不到家庭', 404);
      if (c.role !== 'hq' && h.store !== c.store) throw new E('只能處理自己門市的資料', 403);
      return h;
    }
    const inStore = (qb, st, col = 'store') => (st ? qb.eq(col, st) : qb);
    async function hhMap(ids) {
      const L = [...new Set(ids.filter(Boolean))]; if (!L.length) return {};
      return Object.fromEntries((await q(db('households').select('*').in('id', L))).map((h) => [h.id, h]));
    }
    async function storeHH(st) { return q(inStore(db('households').select('*'), st)); }
    const ids = (L) => L.map((h) => h.id);
    async function nfN(b) { const o = nf(b); if (o && b.assignee_id) o.assignee = (await uname([b.assignee_id]))[b.assignee_id] || null; return o; }

    // 預約卡片（同 Demo 的 ja）：家庭、評估、聯絡人、長輩家電
    async function jaList(B) {
      if (!B.length) return [];
      const H = await hhMap(B.map((b) => b.household_id)), hids = Object.keys(H).map(Number);
      const [as, devs, mems] = await Promise.all([
        q(db('assessments').select('*').in('household_id', hids).order('id', { ascending: false })),
        q(db('devices').select('household_id, name, years, status, warn').in('household_id', hids).eq('home', 'parents').eq('source', '購買紀錄')),
        Promise.all(hids.map((id) => rpc('household_members', { p_household: id }).then((m) => [id, m]).catch(() => [id, []]))),
      ]);
      const N = await uname([...B.map((b) => b.assignee_id), ...Object.values(H).map((h) => h.created_by)]);
      const owner = Object.fromEntries(mems.map(([id, m]) => { const h = H[id]; const o = (m || []).find((x) => x.user_id === h.created_by); return [id, o ? o.display_name : N[h.created_by] || null]; }));
      return B.map((b) => { const h = H[b.household_id] || {}; const a = as.find((x) => x.household_id === h.id);
        return { ...nf(b), assignee: N[b.assignee_id] || null, household_id: h.id, household: Ce(h), elder_name: h.elder_name, elder_note: h.elder_note, owner: owner[h.id] || null, phase: h.phase || 0, assessment: u5(a), obs: h.obs || null, contacts: h.contacts || [], devices: devs.filter((d) => d.household_id === h.id).map(({ household_id, ...d }) => d) }; });
    }
    // 差異回報（同 Demo 的 $p）
    async function diffOut(L) {
      if (!L.length) return [];
      const H = await hhMap(L.map((d) => d.household_id)), bk = await q(db('bookings').select('id, code').in('id', [...new Set(L.map((d) => d.booking_id))]));
      const pv = {}; for (const hid of Object.keys(H)) pv[hid] = await work.latestVersion(+hid);
      return L.map((d) => { const v = pv[d.household_id], pin = v && (v.pins || []).find((p) => p.id === d.pin_id), b = bk.find((x) => x.id === d.booking_id);
        return { id: d.id, booking_id: d.booking_id, code: b && b.code, household_id: d.household_id, household: H[d.household_id] ? Ce(H[d.household_id]) : '', pkg: d.pkg, pin_id: d.pin_id, pin: pin ? pin.label : null, level: d.level, text: d.text, photo: !!d.photo, move: d.move || null, status: d.status, by: d.by_name, review_note: d.review_note, new_ver: d.new_ver, when: short(d.created_at) }; });
    }
    // 個案方案頁（同 Demo 的 l5）
    async function planView(h) {
      const [pl, as, ins, ds] = await Promise.all([
        q(db('plans').select('*').eq('household_id', h.id).in('status', ['待確認', '已確認']).order('id', { ascending: false }).limit(1)),
        q(db('assessments').select('*').eq('household_id', h.id).order('id', { ascending: false }).limit(1)),
        q(db('bookings').select('*').eq('household_id', h.id).eq('kind', '到府安裝').neq('status', '已取消').order('id', { ascending: false }).limit(1)),
        q(db('site_diffs').select('*').eq('household_id', h.id).order('id', { ascending: false }).limit(20)),
      ]);
      const p = oa(pl[0]); if (p && pl[0].advisor_id) p.advisor = (await uname([pl[0].advisor_id]))[pl[0].advisor_id] || null;
      const [pv, versions, fp] = await Promise.all([work.latestVersion(h.id).then(work.versionOut), work.versionsOf(h.id), q(db('floorplans').select('layout, note, updated_at').eq('household_id', h.id).maybeSingle())]);
      return { household_id: h.id, household: Ce(h), elder_name: h.elder_name, elder_note: h.elder_note, phase: h.phase || 0, plan: p, assessment: u5(as[0]), pv, versions,
        install: ins[0] ? { ...(await nfN(ins[0])), packages: await work.packagesOf(ins[0].id) } : null, diffs: await diffOut(ds), floorplan: fp ? { layout: fp.layout, note: fp.note, updated_at: ls(fp.updated_at) } : null };
    }

    // 方案圖面標記（同 Demo 的 qp、defaultPins）
    const PIN_K = ['light', 'door', 'btn', 'gw', 'motion', 'ac', 'rail', 'note'];
    const cleanPins = (L) => L.slice(0, 40).map((g, i) => ({ id: v2(g.id, 8) || `P${i + 1}`, pkg: ['A', 'B', 'C', 'S'].includes(g.pkg) ? g.pkg : 'A', k: PIN_K.includes(g.k) ? g.k : 'note', label: v2(g.label, 40) || '標記',
      x: Math.max(0, Math.min(9, Number(g.x) || 0)), y: Math.max(0, Math.min(9, Number(g.y) || 0)), room: v2(g.room, 10), st: ['plan', 'done', 'diff'].includes(g.st) ? g.st : 'plan', note: v2(g.note, 60) || undefined }));
    function defaultPins(sel, o = {}) {
      const L = [], F = (id, pkg, k, lb, x, y, room) => L.push({ id, pkg, k, label: lb, x, y, room, st: 'plan' });
      if (sel.night) { F('L1', 'B', 'light', '感應小夜燈｜床邊', 3.08, 1, '臥室'); F('L2', 'B', 'light', '感應小夜燈｜走道', 4.2, 3.66, '走道'); F('L3', 'B', 'light', '感應小夜燈｜浴室門口', 5.3, 3.25, '浴室');
        F('D1', 'A', 'door', '門窗感測器｜浴室門', 4.75, 3.5, '浴室'); F('D2', 'A', 'door', '門窗感測器｜大門', 8.1, 8, '玄關'); F('BT', 'A', 'btn', '浴室緊急按鈕', 5.8, 1, '浴室'); F('GW', 'A', 'gw', '閘道器｜客廳', 6.5, 6, '客廳'); }
      if (sel.morning) { F('M1', 'A', 'motion', '人體感測器｜客廳', 5.4, 6.4, '客廳'); F('D3', 'A', 'door', '門窗感測器｜臥室門', 2, 3.5, '臥室'); }
      if (o.threshold != null && o.threshold > 0.5) F('N1', 'B', 'strip', `門檻提示燈條｜浴室門檻 ${o.threshold} cm`, 5.15, 3.5, '浴室');
      return L;
    }
    // 工作包（同 Demo 的 ensurePackages）
    const PKG = { A: ['關懷設備安裝', '全國電子技師'], B: ['夜間照明', '全國電子技師'], S: ['設備檢修', '全國電子技師'] };
    async function ensurePackages(bid, hid, sel, o = {}) {
      const have = new Set((await q(db('work_packages').select('code').eq('booking_id', bid))).map((x) => x.code));
      const add = async (code, who) => { if (have.has(code)) return; await q(db('work_packages').insert({ booking_id: bid, household_id: hid, code, name: PKG[code][0], team: PKG[code][1], assignee_id: who || null })); have.add(code); };
      if (sel.night) await add('B', o.b); if (sel.night || sel.morning) await add('A', o.a); if (o.service) await add('S', o.a);
      if (have.has('A') && have.has('B')) await q(db('work_packages').update({ prereq: 'B' }).eq('booking_id', bid).eq('code', 'A'));
    }
    const codeFor = async (pfx) => rpc('next_code', { p_prefix: `${pfx}-${today().replace(/-/g, '')}` });
    // 提醒轉維護工單草稿（同 Demo 的 Ka）
    async function reminderDraft(r, h, uid) {
      const code = await codeFor('M');
      const [b] = await q(db('bookings').insert({ code, household_id: h.id, kind: '設備維護', store: h.store, slot_start: '', status: '待確認', note: `${r.device}｜${r.kind}`, created_by: uid }).select('*'));
      await ensurePackages(b.id, h.id, {}, { service: true });
      await q(db('reminders').update({ status: '已建立工單', booking_id: b.id, by_family: false }).eq('id', r.id));
      return b;
    }

    // 個案清單（同 store2.js 的 cases／caseDetail）
    const STAGES = ['待問診', '待報價', '待長輩確認', '施工中', '售後'];
    const fmtSlot = (t) => String(t || '').replace('T', ' ').slice(5, 16).replace('-', '/');
    async function cases(st) {
      const H = await storeHH(st); if (!H.length) return [];
      const I = ids(H);
      const [bk, pl, qt, ce, rq, as, mems] = await Promise.all([
        q(db('bookings').select('id, household_id, code, kind, status, slot_start').in('household_id', I).in('kind', ['門市諮詢', '到府安裝']).order('id', { ascending: false })),
        q(db('plans').select('id, household_id, status, one_time, monthly').in('household_id', I).order('id', { ascending: false })),
        q(db('quotes').select('household_id, version, total, status').in('household_id', I).order('version', { ascending: false })),
        q(db('care_events').select('household_id').in('household_id', I).eq('followed_up', false)),
        q(db('requests').select('household_id').in('household_id', I).eq('status', '待處理')),
        q(db('assessments').select('household_id').in('household_id', I)),
        uname(H.map((h) => h.created_by)),
      ]);
      const out = [];
      for (const h of H) {
        const cons = bk.find((b) => b.household_id === h.id && b.kind === '門市諮詢'), inst = bk.find((b) => b.household_id === h.id && b.kind === '到府安裝');
        const plan = pl.find((p) => p.household_id === h.id) || null, qq = qt.find((x) => x.household_id === h.id), quote = qq ? { ver: qq.version, total: qq.total, status: qq.status } : null;
        const care = ce.filter((x) => x.household_id === h.id).length, req = rq.filter((x) => x.household_id === h.id).length;
        let s = null, next = '';
        if (inst && inst.status === '已完成') { s = '售後'; next = care || req ? `待事後關心 ${care} 件、家庭需求 ${req} 件` : '定期關心'; }
        else if (inst) { s = '施工中'; next = `到府 ${fmtSlot(inst.slot_start)}｜${inst.status}`; }
        else if (plan && plan.status === '已確認') { s = '施工中'; next = '待排程派工'; }
        else if (quote && quote.status === '待長輩確認') { s = '待長輩確認'; next = `正式報價第 ${quote.ver} 版待長輩同意`; }
        else if (plan) { s = '待報價'; next = '方案草稿待整合成正式報價'; }
        else if (cons && cons.status !== '已完成') { s = '待問診'; next = `門市諮詢 ${fmtSlot(cons.slot_start)}${cons.status === '待指派' ? '｜待指派' : ''}`; }
        else if (cons) { s = '待報價'; next = '已問診，待建立方案'; }
        if (!s) continue;
        out.push({ hid: h.id, household: Ce(h), elder_note: h.elder_note, owner: mems[h.created_by] || null, store: h.store, stage: s, next, care, req, assessed: as.some((a) => a.household_id === h.id), booking_id: cons ? cons.id : null, plan, quote, install: inst || null });
      }
      return out.sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage));
    }
    async function caseDetail(c) {
      const [a, E2, Q2] = await Promise.all([
        q(db('assessments').select('answers, measures, dims, lights, rec, created_at').eq('household_id', c.hid).order('id', { ascending: false }).limit(1)),
        q(db('care_events').select('id, occurred_at, kind, title, outcome, followed_up').eq('household_id', c.hid).order('occurred_at', { ascending: false }).limit(5)),
        q(db('requests').select('id, kind, note, status, created_at').eq('household_id', c.hid).order('id', { ascending: false }).limit(5)),
      ]);
      const x = a[0];
      return { ...c, assessment: x ? { answers: x.answers || {}, measures: u5(x).measures, lights: x.lights || [], rec: x.rec, at: ls(x.created_at) } : null,
        care_events: E2.map((e) => ({ ...e, occurred_at: ls(e.occurred_at), followed_up: e.followed_up ? 1 : 0 })), requests: Q2.map((r) => ({ ...r, created_at: ls(r.created_at) })) };
    }

    const add = (...r) => routes.splice(routes.length, 0, r);
    // ── 生活顧問 ──
    add('GET', /^\/api\/advisor\/bookings$/, ADV, async (c, m, b, qs) => {
      const st = storeOf(c, qs), d = today();
      const B = await q(inStore(db('bookings').select('*').eq('kind', '門市諮詢').in('status', ['待指派', '已指派']).gte('slot_start', d), st).order('slot_start'));
      return J({ today: d, bookings: await jaList(B) });
    });
    add('GET', /^\/api\/advisor\/todos$/, ADV, async (c, m, b, qs) => {
      const H = await storeHH(storeOf(c, qs)), I = ids(H), name = (id) => { const h = H.find((x) => x.id === id); return h ? Ce(h) : ''; };
      if (!I.length) return J({ care: [], requests: [] });
      const [ce, rq] = await Promise.all([
        q(db('care_events').select('id, title, outcome, occurred_at, household_id').in('household_id', I).eq('followed_up', false).order('occurred_at', { ascending: false })),
        q(db('requests').select('id, kind, note, status, created_at, household_id').in('household_id', I).eq('status', '待處理').order('id', { ascending: false })),
      ]);
      return J({ care: ce.map((e) => ({ ...e, occurred_at: ls(e.occurred_at), elder_name: (H.find((h) => h.id === e.household_id) || {}).elder_name, household: name(e.household_id), when: short(e.occurred_at) })),
        requests: rq.map((r) => ({ ...r, created_at: ls(r.created_at), elder_name: (H.find((h) => h.id === r.household_id) || {}).elder_name, household: name(r.household_id), when: short(r.created_at) })) });
    });
    add('GET', /^\/api\/advisor\/home$/, ADV, async (c, m, b, qs) => {
      const st = storeOf(c, qs), d = today(), H = await storeHH(st), I = ids(H), name = (id) => { const h = H.find((x) => x.id === id); return h ? Ce(h) : ''; };
      const none = { today: d, store: st || '全部門市', kpi: { consults: 0, waiting: 0, review: 0, dispatch: 0, care: 0 }, insight: '今天的待辦都處理完了。', consults: [], diffs: [], drafts: [], reminders: [], waiting: [], installs: [], techs: [] };
      const techs = (await q(inStore(db('profiles').select('id, display_name').eq('role', 'tech').eq('disabled', false), st).order('created_at'))).map((t) => ({ id: t.id, name: t.display_name || '技師' }));
      if (!I.length) return J({ ...none, techs });
      const [cons, sd, dr, rm, wt, ins, care] = await Promise.all([
        q(db('bookings').select('*').in('household_id', I).eq('kind', '門市諮詢').in('status', ['待指派', '已指派']).like('slot_start', d + '%').order('slot_start')),
        q(db('site_diffs').select('*').in('household_id', I).eq('status', '待審核').order('id')),
        q(db('bookings').select('*').in('household_id', I).eq('kind', '設備維護').eq('status', '待確認').order('id')),
        q(db('reminders').select('*').in('household_id', I).eq('status', '待處理').order('due').order('id')),
        q(db('plans').select('*').in('household_id', I).eq('status', '待確認').order('id')),
        q(db('bookings').select('*').in('household_id', I).neq('kind', '門市諮詢').in('status', ['已指派', '進行中']).like('slot_start', d + '%').order('slot_start')),
        q(db('care_events').select('id').in('household_id', I).eq('followed_up', false)),
      ]);
      const diffs = await diffOut(sd.sort((a, b) => (a.level === '暫停' ? 0 : 1) - (b.level === '暫停' ? 0 : 1) || a.id - b.id));
      const byFam = dr.length ? await q(db('reminders').select('booking_id').in('booking_id', dr.map((x) => x.id)).eq('by_family', true)) : [];
      const drafts = await Promise.all(dr.map(async (x) => ({ ...(await nfN(x)), household_id: x.household_id, household: name(x.household_id), packages: (await work.packagesOf(x.id)).map((p) => p.name), by_family: byFam.some((r) => r.booking_id === x.id) })));
      const reminders = rm.map((x) => ({ id: x.id, household_id: x.household_id, household: name(x.household_id), device: x.device, kind: x.kind, reason: x.reason, due: x.due }));
      const waiting = await Promise.all(wt.map(async (x) => ({ household_id: x.household_id, household: name(x.household_id), since: short(x.created_at), one_time: x.one_time, monthly: x.monthly, pv: await work.versionOut(await work.latestVersion(x.household_id)) })));
      const installs = await Promise.all(ins.map(async (x) => ({ ...(await nfN(x)), household_id: x.household_id, household: name(x.household_id), packages: (await work.packagesOf(x.id)).map((p) => ({ code: p.code, name: p.name, assignee: p.assignee, status: p.status })) })));
      const kpi = { consults: cons.length, waiting: waiting.length, review: diffs.length, dispatch: drafts.length + reminders.length, care: care.length };
      const stop = diffs.find((x) => x.level === '暫停');
      const insight = stop ? `${stop.household}的技師暫停施工等您核准，請先處理差異回報。` : drafts.length ? `${drafts[0].household}已從 App 一鍵預約維護，確認時段後即可派工。`
        : diffs.length ? `有 ${diffs.length} 則技師差異回報待審核，核准後圖面會產生新版本。` : waiting.length ? `${waiting[0].household}的方案已送出 ${waiting[0].since} 起尚未確認，可以打電話關心。` : '今天的待辦都處理完了。';
      return J({ today: d, store: st || '全部門市', kpi, insight, consults: await jaList(cons), diffs, drafts, reminders, waiting, installs, techs });
    });
    add('POST', /^\/api\/advisor\/plans$/, ADV, async (c, m, body) => {
      const h = await hhOf(c, body.household_id), RL = R();
      const sel = { mgr: 1 }, later = {};
      for (const it of RL.CATALOG) if (!it.exp && !it.lock) { if (it.later) { if (body.later && body.later[it.id]) later[it.id] = 1; } else if (body.sel && body.sel[it.id]) sel[it.id] = 1; }
      if (RL.CATALOG.some((it) => it.g && it.id !== 'alert' && sel[it.id])) sel.alert = 1; else delete sel.alert;
      const plan = RL.PLANS[body.plan] && !RL.PLANS[body.plan].exp ? body.plan : 'basic', pay = body.pay === 'y' ? 'y' : 'm', tot = RL.totals(sel, plan);
      const c2n = v2(body.c2n, 20), c2p = v2(body.c2p, 20), ewish = v2(body.ewish, 200);
      if (tot.guard && !c2n) throw new E('請填寫第二聯絡人姓名');
      const dur = Math.max(0, Math.min(7200, Number(body.duration_s) || 0)) || null, bid = Number(body.booking_id) || null;
      await q(db('plans').update({ status: '已取代' }).eq('household_id', h.id).eq('status', '待確認'));
      const [p] = await q(db('plans').insert({ household_id: h.id, advisor_id: c.uid, sel, later, plan_code: plan, pay, one_time: tot.one, monthly: tot.m, escort: !!body.escort, duration_s: dur, status: '待確認' }).select('id'));
      if (bid) await q(db('bookings').update({ status: '已完成', assignee_id: c.uid, completed_at: nowIso() }).eq('id', bid).eq('household_id', h.id).eq('kind', '門市諮詢'));
      const hu = { phase: Math.max(h.phase || 0, 2), updated_at: nowIso() };
      if (c2n) { const K = (h.contacts || []).filter((x) => x.r !== '第二聯絡人'); K.unshift({ n: c2n, r: '第二聯絡人', d: '依序通知', p: c2p || undefined }); hu.contacts = K; }
      await q(db('households').update(hu).eq('id', h.id));
      if (ewish) { const d = new Date(); await q(db('wishes').insert({ code: `WS-${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(Date.now()).slice(-4)}`, household_id: h.id, user_id: c.uid, store: h.store, home: 'parents', category: '其他', text: ewish, source: '門市代記｜長輩', status: '待分類' })); }
      if (dur) { try { await db('metrics').insert({ type: 'advisor', duration_s: dur, meta: { escort: !!body.escort, items: Object.keys(sel).length } }); } catch (e) {} }
      const as = await q(db('assessments').select('measures, dims').eq('household_id', h.id).order('id', { ascending: false }).limit(1));
      const th = as[0] ? u5(as[0]).measures.threshold_cm : null;
      const pins = Array.isArray(body.pins) ? cleanPins(body.pins) : defaultPins(sel, { threshold: th });
      await rpc('add_plan_version', { p_hid: h.id, p_plan: p.id, p_pins: pins, p_status: '草稿', p_reason: '生活顧問建立方案' });
      await rpc('notify_household', { p_household: h.id, p_kind: 'plan', p_title: '生活顧問送出改善方案', p_body: `一次性 ${tot.one} 元，月費 ${tot.m} 元；請和長輩一起確認`, p_link: 'plan' });
      await audit('建立方案', Ce(h), `一次性 ${tot.one}／月費 ${tot.m}`);
      return J({ ok: true, totals: tot, household: Ce(h) });
    });
    add('GET', /^\/api\/advisor\/plan\/(\d+)$/, ADV, async (c, m) => J(await planView(await hhOf(c, m[1]))));
    add('PUT', /^\/api\/advisor\/plan\/(\d+)\/pins$/, ADV, async (c, m, body) => {
      const h = await hhOf(c, m[1]); if (!Array.isArray(body.pins)) throw new E('圖面資料不正確');
      const pins = cleanPins(body.pins), v = await work.latestVersion(h.id);
      if (v && v.status === '草稿') await q(db('plan_versions').update({ pins }).eq('id', v.id));
      else await rpc('add_plan_version', { p_hid: h.id, p_plan: v && v.plan_id, p_pins: pins, p_status: '草稿', p_reason: v2(body.reason, 60) || '生活顧問調整圖面（需長輩再確認）' });
      await audit('調整方案圖面', Ce(h), `${pins.length} 個標記`);
      return J(await planView(h));
    });
    add('POST', /^\/api\/advisor\/plan\/(\d+)\/elder-confirm$/, ADV, async (c, m) => {
      const h = await hhOf(c, m[1]), v = await work.latestVersion(h.id);
      if (!v) throw new E('尚未建立方案圖面'); if (v.status !== '草稿') throw new E(`v${v.ver} 已鎖定，不需要重複確認`);
      const nv = await rpc('add_plan_version', { p_hid: h.id, p_plan: v.plan_id, p_pins: v.pins || [], p_status: '長輩已確認', p_reason: '長輩在門市看過安裝前後對比並同意' });
      await q(db('plan_versions').update({ status: '已取代' }).eq('id', v.id));
      await audit('長輩確認方案圖面', Ce(h), `v${nv} 鎖定`);
      return J(await planView(h));
    });
    add('POST', /^\/api\/advisor\/diffs\/(\d+)$/, ADV, async (c, m, body) => {
      const d = await q(db('site_diffs').select('*').eq('id', +m[1]).maybeSingle()); if (!d) throw new E('找不到差異回報', 404);
      const h = await hhOf(c, d.household_id); if (d.status !== '待審核') throw new E('這則回報已審核');
      const ok = body.action === 'approve', note = v2(body.note, 100) || null, v = await work.latestVersion(h.id), mv = d.move;
      const pins = ((v && v.pins) || []).map((p) => (p.id !== d.pin_id ? p : ok ? { ...p, st: 'plan', note: d.text.slice(0, 60), ...(mv ? { x: Math.max(0, Math.min(9, Number(mv.x))), y: Math.max(0, Math.min(9, Number(mv.y))) } : {}) } : { ...p, st: 'plan' }));
      let nv = null;
      if (ok) nv = await rpc('add_plan_version', { p_hid: h.id, p_plan: v && v.plan_id, p_pins: pins, p_status: '差異已核准', p_reason: `差異核准：${d.text.slice(0, 40)}` });
      else if (v) await q(db('plan_versions').update({ pins }).eq('id', v.id));
      await q(db('site_diffs').update({ status: ok ? '已核准' : '已退回', reviewed_by: c.uid, review_note: note, new_ver: nv, reviewed_at: nowIso() }).eq('id', d.id));
      await q(db('work_packages').update({ status: '進行中' }).eq('booking_id', d.booking_id).eq('code', d.pkg).eq('status', '暫停'));
      const bk = await q(db('bookings').select('code').eq('id', d.booking_id).maybeSingle());
      await audit(ok ? '核准差異回報' : '退回差異回報', bk && bk.code, ok ? `圖面 v${nv}` : note);
      return J(await planView(h));
    });
    add('POST', /^\/api\/advisor\/reminders\/(\d+)\/draft$/, ADV, async (c, m) => {
      const r = await q(db('reminders').select('*').eq('id', +m[1]).maybeSingle()); if (!r) throw new E('找不到提醒', 404);
      const h = await hhOf(c, r.household_id); if (r.status !== '待處理') throw new E('這則提醒已處理');
      const b = await reminderDraft(r, h, c.uid); await audit('建立維護工單草稿', b.code, `${Ce(h)}｜${r.device}`);
      return J({ ok: true, code: b.code });
    });
    add('POST', /^\/api\/advisor\/households\/(\d+)\/draft$/, ADV, async (c, m, body) => {
      const h = await hhOf(c, m[1]), dev = v2(body.device, 30) || '感應小夜燈｜走道', kind = v2(body.kind, 20) || '年度健檢';
      const [r] = await q(db('reminders').insert({ household_id: h.id, device: dev, kind, reason: v2(body.reason, 60) || '營運平台建立', due: today(), status: '待處理' }).select('*'));
      const b = await reminderDraft(r, h, c.uid); await audit('建立維護工單草稿', b.code, `${Ce(h)}｜${dev}`);
      return J({ ok: true, code: b.code });
    });
    // 正式報價、勾選、補助、家庭交付（同 store.js）
    add('GET', /^\/api\/advisor\/quotes\/(\d+)$/, ADV, async (c, m) => {
      const h = await hhOf(c, m[1]);
      const L = await q(db('quotes').select('*').eq('household_id', h.id).order('version', { ascending: false }));
      return J({ quotes: L.map((x) => ({ v: x.version, total: x.total, pending: x.pending, items: x.items || [], status: x.status, at: x.at || ls(x.created_at) })) });
    });
    add('POST', /^\/api\/advisor\/quotes\/(\d+)$/, ADV, async (c, m, body) => {
      const h = await hhOf(c, m[1]);
      const prev = await q(db('quotes').select('version').eq('household_id', h.id).order('version', { ascending: false }).limit(1)), v = ((prev[0] && prev[0].version) || 0) + 1;
      const items = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
      const [x] = await q(db('quotes').insert({ household_id: h.id, version: v, total: body.total | 0, pending: body.pending | 0, items, is_formal: true, advisor_id: c.uid, status: '待長輩確認', at: v2(body.at, 40) || null }).select('id'));
      await q(db('households').update({ phase: Math.max(h.phase || 0, 2), updated_at: nowIso() }).eq('id', h.id));
      await rpc('notify_household', { p_household: h.id, p_kind: 'quote', p_title: `正式報價第 ${v} 版`, p_body: '生活顧問已送出正式報價，請和長輩一起確認；長輩同意後才成交', p_link: 'quote' });
      // LINE 推播（家人有加官方帳號才會收到；失敗不影響報價）
      try { const C = window.JJJ_LIVE_CFG, { data: { session } } = await window.JJJLIVEAPI.H.sb().auth.getSession();
        await fetch(C.supabaseUrl + '/functions/v1/line-push', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.supabaseKey, Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ action: 'quote', quote_id: x.id }) }); } catch (e) {}
      await audit('送出正式報價', Ce(h), `第 ${v} 版｜${body.total | 0} 元`);
      return J({ v });
    });
    const kv = (tbl, col) => [
      ['GET', new RegExp(`^\\/api\\/advisor\\/${tbl === 'quote_selections' ? 'selections' : 'subsidy'}\\/(\\d+)$`), ADV, async (c, m) => { const h = await hhOf(c, m[1]); const r = await q(db(tbl).select(col).eq('household_id', h.id).maybeSingle()); return J({ [col === 'sel' ? 'sel' : 'data']: r ? r[col] : col === 'sel' ? null : {} }); }],
      ['PUT', new RegExp(`^\\/api\\/advisor\\/${tbl === 'quote_selections' ? 'selections' : 'subsidy'}\\/(\\d+)$`), ADV, async (c, m, body) => { const h = await hhOf(c, m[1]); await q(db(tbl).upsert({ household_id: h.id, [col]: (col === 'sel' ? body.sel : body.data) || {}, updated_by: c.uid, updated_at: nowIso() })); return J({ ok: true }); }],
    ];
    [...kv('quote_selections', 'sel'), ...kv('subsidies', 'data')].forEach((r) => add(...r));
    add('GET', /^\/api\/advisor\/choices\/(\d+)$/, ADV, async (c, m) => { const h = await hhOf(c, m[1]); const r = await q(db('hh_kv').select('v').eq('household_id', h.id).eq('k', 'choices').maybeSingle()); return J({ state: r ? r.v : null }); });
    add('GET', /^\/api\/advisor\/handoffs$/, ADV, async (c, m, b, qs) => {
      const I = ids(await storeHH(storeOf(c, qs))); if (!I.length) return J({ handoffs: [] });
      return J({ handoffs: (await q(db('family_handoffs').select('household_id, items, at').in('household_id', I).order('id', { ascending: false }).limit(20))).map((x) => ({ hid: x.household_id, items: x.items || [], at: x.at })) });
    });
    add('GET', /^\/api\/advisor\/drafts$/, ADV, async (c) => {
      const L = await q(db('plans').select('household_id, created_at').eq('advisor_id', c.uid).eq('status', '待確認').order('id', { ascending: false }));
      const H = await hhMap(L.map((x) => x.household_id));
      return J({ drafts: L.map((x) => ({ hid: x.household_id, elder_name: (H[x.household_id] || {}).elder_name, created_at: ls(x.created_at) })) });
    });
    add('GET', /^\/api\/advisor\/cases$/, ADV, async (c, m, b, qs) => J({ cases: await cases(storeOf(c, qs)) }));
    add('GET', /^\/api\/advisor\/cases\/(\d+)$/, ADV, async (c, m, b, qs) => { const x = (await cases(storeOf(c, qs))).find((y) => y.hid === +m[1]); if (!x) throw new E('找不到案件', 404); return J({ case: await caseDetail(x) }); });
    add('GET', /^\/api\/advisor\/orders$/, ADV, async (c, m, b, qs) => {
      const H = await storeHH(storeOf(c, qs)), I = ids(H); if (!I.length) return J({ orders: [] });
      return J({ orders: (await q(db('orders').select('*').in('household_id', I).order('id', { ascending: false }))).map((o) => { const h = H.find((x) => x.id === o.household_id); return { ...o, created_at: ls(o.created_at), confirmed_at: ls(o.confirmed_at), items: o.items || [], elder_name: h.elder_name, store: h.store, household: Ce(h) }; }) });
    });
    add('POST', /^\/api\/advisor\/orders\/(\d+)\/confirm$/, ADV, async (c, m) => {
      const o = await q(db('orders').select('*').eq('id', +m[1]).maybeSingle()); if (!o) throw new E('找不到訂單', 404);
      await hhOf(c, o.household_id);
      await q(db('orders').update({ status: '已確認', confirmed_at: nowIso() }).eq('id', o.id));
      await rpc('notify_household', { p_household: o.household_id, p_kind: 'plan', p_title: '生活顧問已確認訂單 ' + o.code, p_body: '', p_link: 'order:' + o.id });
      return J({ ok: true });
    });
    // 門市待辦（生活顧問與總部共用；同 Demo 的 /api/admin/*）
    add('POST', /^\/api\/admin\/requests\/(\d+)\/done$/, ADV, async (c, m) => {
      const r = await q(db('requests').select('*').eq('id', +m[1]).maybeSingle()); if (!r) throw new E('找不到資料', 404);
      await hhOf(c, r.household_id);
      await q(db('requests').update({ status: '已處理', handled_by: c.uid, handled_at: nowIso() }).eq('id', r.id));
      await audit('處理門市待辦', r.kind); return J({ ok: true });
    });
    add('POST', /^\/api\/admin\/care\/(\d+)\/followup$/, ADV, async (c, m) => {
      const e = await q(db('care_events').select('id, title, household_id').eq('id', +m[1]).maybeSingle()); if (!e) throw new E('找不到資料', 404);
      await hhOf(c, e.household_id);
      await q(db('care_events').update({ followed_up: true }).eq('id', e.id));
      await audit('完成事後關心', e.title); return J({ ok: true });
    });
    add('POST', /^\/api\/admin\/installs\/(\d+)\/schedule$/, ADV, async (c, m, body) => {
      const g = await q(db('bookings').select('*').eq('id', +m[1]).in('kind', ['到府安裝', '設備維護']).maybeSingle()); if (!g) throw new E('找不到資料', 404);
      const h = await hhOf(c, g.household_id);
      if (!['待排程', '待確認', '已指派'].includes(g.status)) throw new E('這張工單已開始或完成，無法重新排程');
      const dd = v2(body.date, 10), tt = v2(body.time, 5), S = T().parseSlot(`${dd}T${tt}`);
      if (!S) throw new E('請選擇日期與時間'); if (S < T().now()) throw new E('到府時間不能早於現在');
      const tech = await q(db('profiles').select('id, display_name, store, role, disabled').eq('id', String(body.tech_id || '')).maybeSingle());
      if (!tech || tech.role !== 'tech' || tech.disabled) throw new E('請選擇技師');
      const x = `${dd}T${tt}`, end = new Date(S.getTime() + 2 * 36e5), y = T().slotOf(end, T().hm(end));
      const clash = await q(db('bookings').select('code').eq('assignee_id', tech.id).neq('id', g.id).in('status', ['已指派', '進行中']).lt('slot_start', y).gt('slot_end', x).limit(1));
      if (clash.length) throw new E(`${tech.display_name} 在這個時段已有工單 ${clash[0].code}`, 409);
      await q(db('bookings').update({ slot_start: x, slot_end: y, assignee_id: tech.id, status: '已指派' }).eq('id', g.id));
      // 工作包：A／S 給主技師，B（夜間照明）給第二位技師或同門市另一位（同 Demo 的 wD）
      await q(db('work_packages').update({ assignee_id: tech.id }).eq('booking_id', g.id).in('code', ['A', 'S']));
      const pb = await q(db('work_packages').select('id, assignee_id').eq('booking_id', g.id).eq('code', 'B').maybeSingle());
      if (pb) { let who = body.tech_b_id ? String(body.tech_b_id) : null;
        if (!who && !pb.assignee_id) { const o = await q(db('profiles').select('id').eq('role', 'tech').eq('disabled', false).eq('store', g.store).neq('id', tech.id).limit(1)); who = o[0] ? o[0].id : tech.id; }
        if (who) await q(db('work_packages').update({ assignee_id: who }).eq('id', pb.id)); }
      await q(db('reminders').update({ status: '已派工' }).eq('booking_id', g.id));
      await touch(h.id);
      await rpc('notify_household', { p_household: h.id, p_kind: 'install', p_title: g.kind === '設備維護' ? '維護已排定' : '到府安裝已排定', p_body: `${label(x, y)}｜技師 ${tech.display_name || ''}`, p_link: 'install' });
      await audit(g.kind === '設備維護' ? '派工' : '排定到府安裝', g.code, `${label(x, y)}｜${tech.display_name || ''}`);
      return J({ ok: true, label: label(x, y) });
    });
    // 真實格局（第 2 批新增；Demo 沒有這支，畫面在 live-layout.js 的編輯器）
    add('GET', /^\/api\/advisor\/floorplan\/(\d+)$/, ADV, async (c, m) => {
      const h = await hhOf(c, m[1]);
      const [fp, as] = await Promise.all([q(db('floorplans').select('layout, note, updated_at, updated_by').eq('household_id', h.id).maybeSingle()), q(db('assessments').select('measures, dims').eq('household_id', h.id).order('id', { ascending: false }).limit(1))]);
      return J({ household: Ce(h), layout: fp ? fp.layout : null, note: fp ? fp.note : null, updated_at: fp ? ls(fp.updated_at) : null, measures: as[0] ? u5(as[0]).measures : {} });
    });
    add('PUT', /^\/api\/advisor\/floorplan\/(\d+)$/, ADV, async (c, m, body) => {
      const h = await hhOf(c, m[1]), L = window.JJJLAYOUT ? window.JJJLAYOUT.norm(body.layout) : null;
      if (!L) throw new E('格局資料不正確');
      const note = v2(body.note, 100); if (/門牌|地址|號|巷|弄|路|街/.test(note)) throw new E('備註不寫地址或門牌');
      const layout = { bed: L.bed, bath: L.bath, ldy: L.ldy, kit: L.kit, top: L.top, hall: L.hall, bot: L.bot, fin: L.fin, ceil: L.ceil };
      await q(db('floorplans').upsert({ household_id: h.id, layout, note: note || null, updated_by: c.uid, updated_at: nowIso() }));
      await touch(h.id);
      await rpc('notify_household', { p_household: h.id, p_kind: 'plan', p_title: '生活顧問畫好您家的格局了', p_body: '2D 施工圖、3D 鳥瞰和夜間模擬已換成您家的格局', p_link: 'plan' });
      await audit('更新真實格局', Ce(h), `總寬 ${L.W}｜走道 ${L.hall} mm`);
      return J({ ok: true, layout });
    });
    add('DELETE', /^\/api\/advisor\/floorplan\/(\d+)$/, ADV, async (c, m) => { const h = await hhOf(c, m[1]); await q(db('floorplans').delete().eq('household_id', h.id)); await audit('改回範本格局', Ce(h)); return J({ ok: true }); });

    // 格局編輯入口：App 顧問模式的「案件詳情」、門市電腦版的個案頁
    const fpCard = (hid, fp) => `<div class="card lv-fp" style="margin-top:12px;display:flex;align-items:center;gap:10px;justify-content:space-between"><span><b>真實格局</b><span class="muted" style="display:block;font-size:.85em">${fp ? '已畫好｜家人與技師看到的施工圖、3D 都用這份' : '尚未畫｜家人目前看到的是示意格局'}</span></span><button class="btn" style="width:auto;padding:8px 14px" data-lvfp="${hid}">${fp ? '修改格局' : '到府畫格局'}</button></div>`;
    const fpState = {};
    async function fpLoad(hid) { if (fpState[hid] === undefined) { try { const r = await q(db('floorplans').select('household_id').eq('household_id', hid).maybeSingle()); fpState[hid] = !!r; } catch (e) { fpState[hid] = false; } } return fpState[hid]; }
    (window.JJJHOOKS || (window.JJJHOOKS = [])).push((v, view) => {
      if (v !== 'acase') return; const S = window.JJJAPP && window.JJJAPP.S, c = S && S.acase; if (!c || view.querySelector('.lv-fp')) return;
      fpLoad(c.hid).then((fp) => { const sc = view.querySelector('.scroll'); if (sc && !sc.querySelector('.lv-fp')) sc.insertAdjacentHTML('afterbegin', fpCard(c.hid, fp)); });
    });
    if (/consultant\.html/.test(location.pathname)) new MutationObserver(() => {
      const J0 = window.JCON, v = document.getElementById('view'); if (!J0 || !v || J0.ST.view !== 'case' || !J0.ST.hid || v.querySelector('.lv-fp')) return;
      const hid = J0.ST.hid; fpLoad(hid).then((fp) => { if (!v.querySelector('.lv-fp') && J0.ST.view === 'case') v.insertAdjacentHTML('afterbegin', fpCard(hid, fp).replace('class="card lv-fp"', 'class="panel lv-fp" style="padding:12px 14px;margin-bottom:12px"').replace('class="btn"', 'class="b pri"')); });
    }).observe(document.getElementById('view') || document.body, { childList: true, subtree: true });
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lvfp]'); if (!b || !window.JJJLAYOUT) return;
      const hid = +b.dataset.lvfp;
      window.JJJLAYOUT.editor(hid, (L) => { fpState[hid] = !!L; document.querySelectorAll('.lv-fp').forEach((x) => x.remove()); if (window.JJJAPP && window.JJJAPP.render) window.JJJAPP.render(); else if (window.JCON) window.JCON.render(); }).catch((x) => alert(x.message));
    });

    // 有人登入就記錄計時（Demo 的 /api/metrics）
    const mi = routes.findIndex((r) => r[0] === 'POST' && String(r[1]) === String(/^\/api\/metrics$/));
    if (mi >= 0) routes.splice(mi, 1);
    routes.unshift(['POST', /^\/api\/metrics$/, OPEN, async (c0, m, body) => {
      try { await ctx(false); } catch (e) { return J({ ok: true }); }
      const type = ['diag', 'advisor'].includes(body.type) ? body.type : null, d = Math.round(Number(body.duration_s));
      if (!type || !(d > 0 && d < 7200)) throw new E('紀錄格式不正確');
      await q(db('metrics').insert({ type, duration_s: d, meta: body.meta || {} })); return J({ ok: true });
    }]);
    window.JJJLIVEAPI.install(); if (window.JJJLIVEREADY_DONE) window.JJJLIVEREADY_DONE();
    window.JJJLIVESTAFF = { cases, planView, defaultPins, cleanPins, ensurePackages, hhOf, storeOf, jaList, diffOut, PKG };
  }
  boot();
})();
