// 揪居家｜資料補正層 第二部分（工作包 2～6）
// 依 store.js 的 JJJSTORE.add 登記資料表與 /api 路由；載入順序：store.js 之後。
(function () {
  const S = window.JJJSTORE; if (!S) return;
  const { all, one, run, persist, myHousehold, J, ERR, parse } = S;
  const now = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
  const lastId = () => one('SELECT last_insert_rowid() AS id').id;
  async function hidOf(u, b) { if (u.role === 'family') return myHousehold(u); return (b && +b.hid) || 4; }
  function storeOf(u) { return u.role === 'advisor' ? u.store : null; }

  // ===================== 工作包 2｜通知與關懷 =====================
  // care_events 是原本就有的資料表（家庭關懷紀錄、門市事後關心、總部都讀它）；
  // 事件模擬器寫進同一張表（source='drill'），通知另存 notifications。
  S.add('notifications', `
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  household_id INTEGER NOT NULL,
  care_event_id INTEGER,
  audience TEXT NOT NULL,        -- elder 長輩｜owner 主要聯絡人｜second 第二聯絡人｜near 就近聯絡人｜store 門市｜family 全家
  channel TEXT NOT NULL,         -- 燈光語音｜家中電話｜LINE｜語音電話｜App
  kind TEXT NOT NULL DEFAULT 'care', -- care 關懷｜summary 每月摘要｜device 設備｜plan 方案
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  created_at TEXT NOT NULL,
  read_at TEXT
);`, [
    // 模擬器：建立一筆異常事件
    ['POST', /^\/api\/care\/drill$/, ['family', 'advisor', 'hq'], async (u, m, b) => {
      const hid = await hidOf(u, b); if (!hid) return ERR('找不到家庭', 404);
      const t = now();
      run("INSERT INTO care_events(household_id,occurred_at,kind,title,outcome,timeline,source) VALUES(?,?,?,?,?,?, 'drill')", [hid, t, b.kind === 'dev' ? 'dev' : 'act', String(b.title || '異常事件'), '處理中', JSON.stringify(b.timeline || [])]);
      const id = lastId();
      for (const n of b.notify || []) run('INSERT INTO notifications(household_id,care_event_id,audience,channel,title,body,link,created_at) VALUES(?,?,?,?,?,?,?,?)', [hid, id, n.audience, n.channel, n.title, n.body || '', 'ev:' + id, t]);
      persist(); return J({ id, hid });
    }],
    // 模擬器：事件往下一步（更新時間軸、結果、送出通知）
    ['PUT', /^\/api\/care\/drill\/(\d+)$/, ['family', 'advisor', 'hq'], (u, m, b) => {
      const e = one('SELECT * FROM care_events WHERE id=?', [+m[1]]); if (!e) return ERR('找不到事件', 404);
      const t = now();
      run('UPDATE care_events SET timeline=?, outcome=? WHERE id=?', [JSON.stringify(b.timeline || parse(e.timeline) || []), String(b.outcome || e.outcome), e.id]);
      for (const n of b.notify || []) run('INSERT INTO notifications(household_id,care_event_id,audience,channel,title,body,link,created_at) VALUES(?,?,?,?,?,?,?,?)', [e.household_id, e.id, n.audience, n.channel, n.title, n.body || '', 'ev:' + e.id, t]);
      persist(); return J({ ok: true });
    }],
    // 單一事件（LINE 通知直接連進來的頁面用）
    ['GET', /^\/api\/care\/events\/(\d+)$/, ['family', 'advisor', 'hq'], async (u, m) => {
      const e = one('SELECT e.*, h.elder_name, h.store FROM care_events e JOIN households h ON h.id=e.household_id WHERE e.id=?', [+m[1]]); if (!e) return ERR('找不到事件', 404);
      if (u.role === 'family' && (await myHousehold(u)) !== e.household_id) return ERR('沒有權限', 403);
      const N = all('SELECT audience,channel,title,created_at,read_at FROM notifications WHERE care_event_id=? ORDER BY id', [e.id]);
      return J({ event: { ...e, timeline: parse(e.timeline) || [] }, notifications: N });
    }],
    ['GET', /^\/api\/home\/bookings$/, 'family', async (u) => { const hid = await myHousehold(u); return J({ bookings: hid ? all('SELECT id,code,kind,store,slot_start,status,note,created_at FROM bookings WHERE household_id=? ORDER BY slot_start DESC', [hid]) : [] }); }],
    ['GET', /^\/api\/home\/requests$/, 'family', async (u) => { const hid = await myHousehold(u); return J({ requests: hid ? all('SELECT id,kind,note,status,created_at,handled_at FROM requests WHERE household_id=? ORDER BY id DESC', [hid]) : [] }); }],
    ['GET', /^\/api\/home\/notifications$/, 'family', async (u) => {
      const hid = await myHousehold(u); if (!hid) return J({ notifications: [], unread: 0 });
      const L = all("SELECT id,care_event_id,audience,channel,kind,title,body,link,created_at,read_at FROM notifications WHERE household_id=? AND audience IN ('owner','second','family') ORDER BY id DESC LIMIT 50", [hid]);
      return J({ notifications: L, unread: L.filter(n => !n.read_at).length });
    }],
    ['POST', /^\/api\/home\/notifications\/read$/, 'family', async (u, m, b) => {
      const hid = await myHousehold(u); if (!hid) return J({ ok: true });
      if (b.id) run('UPDATE notifications SET read_at=? WHERE id=? AND household_id=?', [now(), +b.id, hid]);
      else run('UPDATE notifications SET read_at=? WHERE household_id=? AND read_at IS NULL', [now(), hid]);
      persist(); return J({ ok: true });
    }],
    // 每月摘要：數字全部由資料計算
    ['GET', /^\/api\/home\/summary$/, 'family', async (u, m, b, q) => {
      const hid = await myHousehold(u); if (!hid) return ERR('找不到家庭', 404);
      const d = new Date(), mon = (q && q.get('m')) || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return J(summary(hid, mon));
    }],
    // 生活顧問：案件依狀態分區
    ['GET', /^\/api\/advisor\/cases$/, ['advisor', 'hq'], (u) => J({ cases: cases(storeOf(u)) })],
    ['GET', /^\/api\/advisor\/cases\/(\d+)$/, ['advisor', 'hq'], (u, m) => { const c = cases(storeOf(u)).find(x => x.hid === +m[1]); return c ? J({ case: caseDetail(c) }) : ERR('找不到案件', 404); }],
  ]);

  function summary(hid, mon) {
    const E = all("SELECT kind,outcome,occurred_at,source FROM care_events WHERE household_id=? AND substr(occurred_at,1,7)=?", [hid, mon]);
    const act = E.filter(e => e.kind === 'act'), dev = E.filter(e => e.kind === 'dev');
    const self = act.filter(e => e.outcome === '長輩確認').length;
    const fam = act.filter(e => /家人|聯絡人|119/.test(e.outcome)).length;
    const y = +mon.slice(0, 4), mm = +mon.slice(5, 7), dim = new Date(y, mm, 0).getDate();
    const td = new Date(), days = (td.getFullYear() === y && td.getMonth() + 1 === mm) ? td.getDate() : dim;
    const eventDays = new Set(act.map(e => e.occurred_at.slice(0, 10))).size;
    const D = all('SELECT name,home,warn,warranty,status FROM devices WHERE household_id=?', [hid]);
    const R = all("SELECT device,kind,reason,due,status FROM reminders WHERE household_id=? AND status='待處理'", [hid]);
    const Q = all('SELECT kind,status FROM requests WHERE household_id=? AND substr(created_at,1,7)=?', [hid, mon]);
    const nN = one("SELECT COUNT(*) AS n FROM notifications WHERE household_id=? AND substr(created_at,1,7)=? AND audience IN ('owner','second','near')", [hid, mon]).n;
    return {
      month: mon, days, quiet: days - eventDays, asked: act.length, self, fam, dev: dev.length, notified: nN,
      devices: { total: D.length, warn: D.filter(x => x.warn).map(x => ({ name: x.name, home: x.home, status: x.status })) },
      reminders: R, requests: Q.length,
    };
  }

  const fmtSlot = t => String(t || '').replace('T', ' ').slice(5, 16).replace('-', '/');
  const STAGES = ['待問診', '待報價', '待長輩確認', '施工中', '售後'];
  function cases(store) {
    const H = all('SELECT h.id, h.elder_name, h.elder_note, h.store, h.address, h.phase, u.name AS owner FROM households h JOIN users u ON u.id=h.owner_id' + (store ? ' WHERE h.store=?' : ''), store ? [store] : []);
    const out = [];
    for (const h of H) {
      const cons = one("SELECT id,code,status,slot_start FROM bookings WHERE household_id=? AND kind='門市諮詢' ORDER BY id DESC LIMIT 1", [h.id]);
      const inst = one("SELECT id,code,status,slot_start FROM bookings WHERE household_id=? AND kind='到府安裝' ORDER BY id DESC LIMIT 1", [h.id]);
      const plan = one('SELECT id,status,one_time,monthly FROM plans WHERE household_id=? ORDER BY id DESC LIMIT 1', [h.id]);
      const quote = one('SELECT ver,total,status FROM quotes WHERE household_id=? ORDER BY ver DESC LIMIT 1', [h.id]);
      const care = one('SELECT COUNT(*) AS n FROM care_events WHERE household_id=? AND followed_up=0', [h.id]).n;
      const req = one("SELECT COUNT(*) AS n FROM requests WHERE household_id=? AND status='待處理'", [h.id]).n;
      const asm = one('SELECT id FROM assessments WHERE household_id=? ORDER BY id DESC LIMIT 1', [h.id]);
      let st = null, next = '';
      if (inst && inst.status === '已完成') { st = '售後'; next = care || req ? `待事後關心 ${care} 件、家庭需求 ${req} 件` : '定期關心'; }
      else if (inst) { st = '施工中'; next = `到府 ${fmtSlot(inst.slot_start)}｜${inst.status}`; }
      else if (plan && plan.status === '已確認') { st = '施工中'; next = '待排程派工'; }
      else if (quote && quote.status === '待長輩確認') { st = '待長輩確認'; next = `正式報價第 ${quote.ver} 版待長輩同意`; }
      else if (plan) { st = '待報價'; next = '方案草稿待整合成正式報價'; }
      else if (cons && cons.status !== '已完成') { st = '待問診'; next = `門市諮詢 ${fmtSlot(cons.slot_start)}${cons.status === '待指派' ? '｜待指派' : ''}`; }
      else if (cons) { st = '待報價'; next = '已問診，待建立方案'; }
      if (!st) continue;
      out.push({ hid: h.id, household: h.elder_name + '家', elder_note: h.elder_note, owner: h.owner, store: h.store, stage: st, next, care, req, assessed: !!asm, booking_id: cons ? cons.id : null, plan, quote, install: inst });
    }
    return out.sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage));
  }
  function caseDetail(c) {
    const a = one('SELECT answers,measures,lights,rec,created_at FROM assessments WHERE household_id=? ORDER BY id DESC LIMIT 1', [c.hid]);
    const E = all('SELECT id,occurred_at,kind,title,outcome,followed_up FROM care_events WHERE household_id=? ORDER BY occurred_at DESC LIMIT 5', [c.hid]);
    const Q = all('SELECT id,kind,note,status,created_at FROM requests WHERE household_id=? ORDER BY id DESC LIMIT 5', [c.hid]);
    return { ...c, assessment: a ? { answers: parse(a.answers) || {}, measures: parse(a.measures) || {}, lights: parse(a.lights) || [], rec: parse(a.rec), at: a.created_at } : null, care_events: E, requests: Q };
  }

  // ===================== 工作包 4｜擴展期家庭 =====================
  // 價目由這裡統一給（家庭端、生活顧問、總部讀同一份）；phase：0 試點、1 擴展、2 延伸
  const CATALOG = [
    { id: 'night_basic', n: '揪夜安｜基本方案', field: 'night', monthly: 299, one: 0, phase: 0, g: '方案' },
    { id: 'night_plus', n: '揪夜安｜安心方案', field: 'night', monthly: 449, one: 0, phase: 0, g: '方案' },
    { id: 'food', n: '揪食光｜廚房', field: 'food', monthly: 200, one: 0, phase: 1, g: '場域加購' },
    { id: 'tv', n: '揪團聚｜客廳', field: 'tv', monthly: 150, one: 0, phase: 1, g: '場域加購' },
    { id: 'wash', n: '揪清爽｜洗衣陽台', field: 'wash', monthly: 100, one: 0, phase: 1, g: '場域加購' },
    { id: 'all', n: '揪全家｜全屋方案', field: 'all', monthly: 699, one: 0, phase: 1, g: '方案', note: '四個場域一起顧，比分開訂每月省 200 元；首年設定費減免' },
    { id: 'rent_washer_36', n: '以租代買｜洗脫烘洗衣機 36 期', monthly: 890, one: 0, phase: 1, g: '以租代買', note: '免押金；含安裝、每年清洗、耗材與保固；期滿歸您' },
    { id: 'rent_washer_60', n: '以租代買｜洗脫烘洗衣機 60 期', monthly: 590, one: 0, phase: 1, g: '以租代買', note: '免押金；含安裝、每年清洗、耗材與保固；期滿歸您' },
    { id: 'ins', n: '延保搭居家意外險', monthly: 99, one: 0, phase: 1, g: '異業加購', note: '合作產險；保費計算不使用長輩關懷資料' },
    { id: 'clean', n: '冷氣清洗搭居家打掃', monthly: 0, one: 1800, phase: 1, g: '異業加購', note: '合作清潔業者；生活顧問統一排程，同一天到府' },
    { id: 'cam', n: '揪夜安進階影像版｜門口攝影機', monthly: 100, one: 2490, phase: 1, g: '方案', note: '長輩本人同意才裝；本機錄影不上傳' },
    { id: 'link', n: '長輩關懷 2.0｜既有家電接入', monthly: 0, one: 0, phase: 1, g: '服務', note: '支援共通標準的家電直接接入，免費' },
    { id: 'cook', n: '節氣共煮｜Digital City 高雄民族店', monthly: 0, one: 0, phase: 1, g: '活動', note: '12/21（日）14:00；可帶長輩一起來' },
    { id: 'reno', n: '新家與老宅翻修｜AR 全屋配置', monthly: 0, one: 0, phase: 2, g: '新客群', note: '生活顧問到府 AR 掃描後報價' },
    { id: 'baby', n: '育兒模式｜嬰兒房溫濕度', monthly: 99, one: 0, phase: 2, g: '新客群' },
    { id: 'pet', n: '寵物模式｜出門模式', monthly: 99, one: 0, phase: 2, g: '新客群' },
  ];
  const PAY = ['信用卡每月扣款', '門市付款', '全國電子點數折抵＋信用卡'];
  const phaseNow = () => { const r = one("SELECT value FROM config WHERE key='phase'"); return r ? +r.value : 2; };
  const code = p => p + Date.now().toString(36).slice(-5).toUpperCase();
  S.add('orders', `
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  household_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  items TEXT NOT NULL DEFAULT '[]',
  monthly INTEGER NOT NULL DEFAULT 0,
  one_time INTEGER NOT NULL DEFAULT 0,
  pay TEXT,
  status TEXT NOT NULL DEFAULT '待生活顧問確認',
  note TEXT,
  by_id INTEGER,
  created_at TEXT NOT NULL,
  confirmed_at TEXT
);
CREATE TABLE IF NOT EXISTS consents (
  id INTEGER PRIMARY KEY,
  household_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',
  agreed INTEGER NOT NULL,
  by_name TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS device_links (
  household_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  linked INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (household_id, name)
);
CREATE TABLE IF NOT EXISTS video_tasks (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  household_id INTEGER,
  topic TEXT NOT NULL,
  checks TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT '審核中',
  review_note TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);`, [
    ['GET', /^\/api\/catalog$/, null, () => J({ items: CATALOG, pay: PAY, phase: phaseNow() })],
    ['GET', /^\/api\/home\/orders$/, 'family', async (u) => { const hid = await myHousehold(u); return J({ orders: hid ? all('SELECT * FROM orders WHERE household_id=? ORDER BY id DESC', [hid]).map(o => ({ ...o, items: parse(o.items) || [] })) : [] }); }],
    ['POST', /^\/api\/home\/orders$/, 'family', async (u, m, b) => {
      const hid = await myHousehold(u); if (!hid) return ERR('找不到家庭', 404);
      const ph = phaseNow(), ids = (b.items || []).map(String), L = CATALOG.filter(c => ids.includes(c.id));
      if (!L.length) return ERR('請先選擇方案', 400);
      const lock = L.find(c => c.phase > ph); if (lock) return ERR(`「${lock.n}」${lock.phase === 1 ? '擴展期' : '延伸期'}才開放`, 400);
      if (!PAY.includes(b.pay) && L.some(c => c.monthly || c.one)) return ERR('請選擇付款方式', 400);
      if (L.some(c => c.id === 'cam') && !one("SELECT id FROM consents WHERE household_id=? AND kind='進階影像版' AND agreed=1 AND revoked_at IS NULL", [hid])) return ERR('需要長輩本人同意後才能訂購進階影像版', 400);
      const c = code('OD'), mo = L.reduce((a, x) => a + x.monthly, 0), on = L.reduce((a, x) => a + x.one, 0), free = !mo && !on;
      run('INSERT INTO orders(household_id,code,items,monthly,one_time,pay,status,note,by_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', [hid, c, JSON.stringify(L.map(x => ({ id: x.id, n: x.n, monthly: x.monthly, one: x.one, g: x.g }))), mo, on, free ? null : b.pay, free && L.every(x => x.g === '活動') ? '已報名' : '待生活顧問確認', String(b.note || ''), u.id, now()]);
      const id = lastId();
      run('INSERT INTO notifications(household_id,audience,channel,kind,title,body,link,created_at) VALUES(?,?,?,?,?,?,?,?)', [hid, 'owner', 'App', 'plan', '已送出：' + L.map(x => x.n.split('｜')[0]).join('、'), '生活顧問 1 個工作天內與您聯絡確認', 'order:' + id, now()]);
      persist(); return J({ id, code: c, monthly: mo, one_time: on });
    }],
    ['POST', /^\/api\/home\/orders\/(\d+)\/cancel$/, 'family', async (u, m) => {
      const hid = await myHousehold(u), o = one('SELECT * FROM orders WHERE id=? AND household_id=?', [+m[1], hid]); if (!o) return ERR('找不到訂單', 404);
      if (!['待生活顧問確認', '已報名'].includes(o.status)) return ERR('已確認的訂單請洽生活顧問', 400);
      run("UPDATE orders SET status='已取消' WHERE id=?", [o.id]); persist(); return J({ ok: true });
    }],
    ['GET', /^\/api\/advisor\/orders$/, ['advisor', 'hq'], (u) => J({ orders: all("SELECT o.*, h.elder_name, h.store FROM orders o JOIN households h ON h.id=o.household_id" + (u.role === 'advisor' ? ' WHERE h.store=?' : '') + ' ORDER BY o.id DESC', u.role === 'advisor' ? [u.store] : []).map(o => ({ ...o, items: parse(o.items) || [], household: o.elder_name + '家' })) })],
    ['POST', /^\/api\/advisor\/orders\/(\d+)\/confirm$/, ['advisor', 'hq'], (u, m) => {
      const o = one('SELECT * FROM orders WHERE id=?', [+m[1]]); if (!o) return ERR('找不到訂單', 404);
      run("UPDATE orders SET status='已確認', confirmed_at=? WHERE id=?", [now(), o.id]);
      run('INSERT INTO notifications(household_id,audience,channel,kind,title,link,created_at) VALUES(?,?,?,?,?,?,?)', [o.household_id, 'owner', 'App', 'plan', '生活顧問已確認訂單 ' + o.code, 'order:' + o.id, now()]);
      persist(); return J({ ok: true });
    }],
    ['GET', /^\/api\/home\/consents$/, 'family', async (u) => { const hid = await myHousehold(u); return J({ consents: hid ? all('SELECT * FROM consents WHERE household_id=? ORDER BY id DESC', [hid]).map(c => ({ ...c, items: parse(c.items) || [] })) : [] }); }],
    ['POST', /^\/api\/home\/consents$/, 'family', async (u, m, b) => {
      const hid = await myHousehold(u); if (!hid) return ERR('找不到家庭', 404);
      run('INSERT INTO consents(household_id,kind,items,agreed,by_name,created_at) VALUES(?,?,?,?,?,?)', [hid, String(b.kind || ''), JSON.stringify(b.items || []), b.agreed ? 1 : 0, String(b.by || '長輩本人'), now()]);
      persist(); return J({ id: lastId() });
    }],
    ['POST', /^\/api\/home\/consents\/(\d+)\/revoke$/, 'family', async (u, m) => { const hid = await myHousehold(u); run('UPDATE consents SET revoked_at=? WHERE id=? AND household_id=?', [now(), +m[1], hid]); persist(); return J({ ok: true }); }],
    ['GET', /^\/api\/home\/device-links$/, 'family', async (u) => { const hid = await myHousehold(u); return J({ links: hid ? all('SELECT name,linked FROM device_links WHERE household_id=?', [hid]) : [] }); }],
    ['PUT', /^\/api\/home\/device-links$/, 'family', async (u, m, b) => {
      const hid = await myHousehold(u); if (!hid) return ERR('找不到家庭', 404);
      for (const [n, v] of Object.entries(b.links || {})) run('INSERT OR REPLACE INTO device_links(household_id,name,linked,updated_at) VALUES(?,?,?,?)', [hid, n, v ? 1 : 0, now()]);
      persist(); return J({ ok: true });
    }],
    ['GET', /^\/api\/videos$/, 'any', (u) => J({ videos: u ? all('SELECT * FROM video_tasks WHERE user_id=? ORDER BY id DESC', [u.id]).map(v => ({ ...v, checks: parse(v.checks) || {} })) : [] })],
    ['POST', /^\/api\/videos$/, 'any', async (u, m, b) => {
      if (!u) return ERR('請先登入', 401);
      const ck = b.checks || {}; if (!['a', 'b', 'c', 'd'].every(k => ck[k])) return ERR('四項隱私確認都要勾選', 400);
      run('INSERT INTO video_tasks(user_id,household_id,topic,checks,created_at) VALUES(?,?,?,?,?)', [u.id, u.role === 'family' ? await myHousehold(u) : null, String(b.topic || ''), JSON.stringify(ck), now()]);
      persist(); return J({ id: lastId() });
    }],
    ['GET', /^\/api\/admin\/videos$/, ['hq', 'advisor'], () => J({ videos: all('SELECT v.*, u.name FROM video_tasks v JOIN users u ON u.id=v.user_id ORDER BY v.id DESC') })],
    ['POST', /^\/api\/admin\/videos\/(\d+)\/review$/, ['hq', 'advisor'], (u, m, b) => { run('UPDATE video_tasks SET status=?, review_note=?, reviewed_at=? WHERE id=?', [b.ok ? '已上架' : '需修改', String(b.note || ''), now(), +m[1]]); persist(); return J({ ok: true }); }],
  ]);

  // 示範資料：全國電子購買紀錄帶入的家電（家電檔案、家電詳情、換新建議用）
  S.add('seed_devices_v1', `CREATE TABLE IF NOT EXISTS seed_devices_v1 (done INTEGER);`, [], () => {
    if (one("SELECT COUNT(*) AS n FROM devices WHERE source='購買紀錄'").n) return;
    const D = [['parents', '客廳冷氣', 11, 3, '用電比去年多約 18%', 1, 1100, '已過保'], ['parents', '洗衣機', 13, 3, '脫水異音', 1, 420, '已過保'], ['parents', '冰箱', 6, 1, '正常', 0, 380, '2027-03 到期'], ['parents', '電視', 10, 2, '正常', 0, 210, '已過保'], ['parents', '除濕機', 3, 1, '正常', 0, 260, '2027-08 到期'],
      ['mine', '冷氣', 4, 1, '正常', 0, 820, '2028-06 到期'], ['mine', '洗脫烘洗衣機', 2, 1, '正常', 0, 300, '2029-01 到期']];
    for (const h of all('SELECT id FROM households')) for (const [home, n, y, g, st, w, k, wr] of D)
      run("INSERT INTO devices(household_id,home,name,years,grade,status,warn,kwh,warranty,old,source) VALUES(?,?,?,?,?,?,?,?,?,?,'購買紀錄')", [h.id, home, n, y, g, st, w, k, wr, y >= 10 ? 1 : 0]);
    run('INSERT INTO seed_devices_v1(done) VALUES(1)');
  });
  S.CATALOG = CATALOG;

  // ===================== 工作包 6｜總部真資料 =====================
  // 指標依「資料來源」登記：每個指標寫明讀哪張表、怎麼算；新身分（工作包 5）登記新來源，總部不用改畫面。
  const n1 = (sql, a = []) => { try { return one(sql, a).n || 0; } catch (e) { return 0; } };
  const pct = (a, b) => b ? Math.round(a * 1000 / b) / 10 : null;
  const STW = st => st ? ' AND h.store=?' : '';
  const SA = st => st ? [st] : [];
  const METRICS = [];
  function metric(d) { METRICS.push(d); }
  S.metric = metric;
  metric({ g: '試點漏斗', k: 'diag', l: '完成居家評估的家庭', u: '戶', src: 'assessments', f: st => n1('SELECT COUNT(DISTINCT a.household_id) AS n FROM assessments a JOIN households h ON h.id=a.household_id WHERE 1=1' + STW(st), SA(st)) });
  metric({ g: '試點漏斗', k: 'book', l: '評估後預約門市', u: '%', t: 60, hi: 1, src: 'assessments、bookings', f: st => pct(n1("SELECT COUNT(DISTINCT b.household_id) AS n FROM bookings b JOIN households h ON h.id=b.household_id WHERE b.kind='門市諮詢' AND b.household_id IN (SELECT household_id FROM assessments)" + STW(st), SA(st)), n1('SELECT COUNT(DISTINCT a.household_id) AS n FROM assessments a JOIN households h ON h.id=a.household_id WHERE 1=1' + STW(st), SA(st))) });
  metric({ g: '試點漏斗', k: 'conv', l: '問診後確認方案', u: '%', t: 20, hi: 1, src: 'bookings、plans', f: st => pct(n1("SELECT COUNT(DISTINCT p.household_id) AS n FROM plans p JOIN households h ON h.id=p.household_id WHERE p.status='已確認'" + STW(st), SA(st)), n1("SELECT COUNT(DISTINCT b.household_id) AS n FROM bookings b JOIN households h ON h.id=b.household_id WHERE b.kind='門市諮詢' AND b.status='已完成'" + STW(st), SA(st))) });
  metric({ g: '試點漏斗', k: 'inst', l: '到府安裝完成', u: '戶', src: 'bookings', f: st => n1("SELECT COUNT(DISTINCT b.household_id) AS n FROM bookings b JOIN households h ON h.id=b.household_id WHERE b.kind='到府安裝' AND b.status='已完成'" + STW(st), SA(st)) });
  metric({ g: '服務品質', k: 'plan_min', l: '單次規劃時間（平均）', u: '分', t: 30, hi: 0, src: 'metrics（生活顧問計時）', f: () => { const r = one("SELECT AVG(duration_s) AS v FROM metrics WHERE type='advisor'"); return r && r.v ? Math.round(r.v / 6) / 10 : null; } });
  metric({ g: '服務品質', k: 'first_pass', l: '驗收一次通過率', u: '%', t: 90, hi: 1, src: 'acceptance_results', f: () => pct(n1('SELECT COUNT(*) AS n FROM acceptance_results WHERE first_pass=1'), n1('SELECT COUNT(*) AS n FROM acceptance_results')) });
  metric({ g: '服務品質', k: 'diff', l: '技師現場差異（待核准）', u: '件', src: 'site_diffs', f: () => n1("SELECT COUNT(*) AS n FROM site_diffs WHERE status='待審核'") });
  metric({ g: '長輩關懷', k: 'care', l: '關懷事件', u: '件', src: 'care_events', f: st => n1('SELECT COUNT(*) AS n FROM care_events e JOIN households h ON h.id=e.household_id WHERE 1=1' + STW(st), SA(st)) });
  metric({ g: '長輩關懷', k: 'self', l: '長輩自己按「我很好」', u: '%', t: 60, hi: 1, src: 'care_events', f: st => pct(n1("SELECT COUNT(*) AS n FROM care_events e JOIN households h ON h.id=e.household_id WHERE e.outcome='長輩確認'" + STW(st), SA(st)), n1("SELECT COUNT(*) AS n FROM care_events e JOIN households h ON h.id=e.household_id WHERE e.kind='act'" + STW(st), SA(st))) });
  metric({ g: '長輩關懷', k: 'follow', l: '事後關心完成率', u: '%', t: 90, hi: 1, src: 'care_events', f: st => pct(n1('SELECT COUNT(*) AS n FROM care_events e JOIN households h ON h.id=e.household_id WHERE e.followed_up=1' + STW(st), SA(st)), n1('SELECT COUNT(*) AS n FROM care_events e JOIN households h ON h.id=e.household_id WHERE 1=1' + STW(st), SA(st))) });
  metric({ g: '長輩關懷', k: 'notify', l: '送出的通知', u: '則', src: 'notifications', f: st => n1('SELECT COUNT(*) AS n FROM notifications x JOIN households h ON h.id=x.household_id WHERE 1=1' + STW(st), SA(st)) });
  metric({ g: '家庭與營收', k: 'req', l: '門市需求處理率', u: '%', t: 90, hi: 1, src: 'requests', f: st => pct(n1("SELECT COUNT(*) AS n FROM requests r JOIN households h ON h.id=r.household_id WHERE r.status<>'待處理'" + STW(st), SA(st)), n1('SELECT COUNT(*) AS n FROM requests r JOIN households h ON h.id=r.household_id WHERE 1=1' + STW(st), SA(st))) });
  metric({ g: '家庭與營收', k: 'orders', l: '加購與訂閱訂單', u: '筆', src: 'orders', f: st => n1("SELECT COUNT(*) AS n FROM orders o JOIN households h ON h.id=o.household_id WHERE o.status<>'已取消'" + STW(st), SA(st)) });
  metric({ g: '家庭與營收', k: 'mrr', l: '加購月費合計', u: '元', src: 'orders', f: st => n1("SELECT COALESCE(SUM(o.monthly),0) AS n FROM orders o JOIN households h ON h.id=o.household_id WHERE o.status<>'已取消'" + STW(st), SA(st)) });
  metric({ g: '家庭與營收', k: 'wish', l: '揪心願', u: '件', src: 'wishes', f: st => n1('SELECT COUNT(*) AS n FROM wishes w WHERE 1=1' + (st ? ' AND w.store=?' : ''), SA(st)) });
  metric({ g: '家庭與營收', k: 'wish_reply', l: '心願已回覆', u: '%', t: 80, hi: 1, src: 'wishes', f: st => pct(n1("SELECT COUNT(*) AS n FROM wishes w WHERE w.status='已回覆'" + (st ? ' AND w.store=?' : ''), SA(st)), n1('SELECT COUNT(*) AS n FROM wishes w WHERE 1=1' + (st ? ' AND w.store=?' : ''), SA(st))) });
  metric({ g: '家庭與營收', k: 'video', l: '校園大使短影音送審', u: '支', src: 'video_tasks', f: () => n1('SELECT COUNT(*) AS n FROM video_tasks') });

  S.add('settings_v1', `CREATE TABLE IF NOT EXISTS settings_v1 (done INTEGER);`, [
    ['GET', /^\/api\/admin\/metrics$/, ['hq', 'advisor'], (u, m, b, q) => {
      const st = u.role === 'advisor' ? u.store : (q && q.get('store')) || null;
      const G = [];
      for (const d of METRICS) { let v = null; try { v = d.f(st); } catch (e) { v = null; } let g = G.find(x => x.g === d.g); if (!g) G.push(g = { g: d.g, items: [] }); g.items.push({ k: d.k, l: d.l, u: d.u, v, t: d.t, ok: d.t == null || v == null ? null : (d.hi ? v >= d.t : v <= d.t), src: d.src }); }
      return J({ groups: G, store: st, at: now() });
    }],
    ['GET', /^\/api\/admin\/wish-summary$/, ['hq', 'advisor'], () => {
      const by = col => all(`SELECT COALESCE(${col},'未填') AS k, COUNT(*) AS n FROM wishes GROUP BY k ORDER BY n DESC`);
      const topics = (() => { try { return all('SELECT t.id, t.name AS n, t.status, t.threshold, t.base + (SELECT COUNT(*) FROM wish_votes v WHERE v.topic_id=t.id) AS votes FROM wish_topics t ORDER BY votes DESC LIMIT 8'); } catch (e) { try { return all('SELECT * FROM wish_topics LIMIT 8'); } catch (e2) { return []; } } })();
      return J({ total: n1('SELECT COUNT(*) AS n FROM wishes'), byStatus: by('status'), byCat: by('category'), byClass: by('class'), byStore: by('store'), bySource: by('source'), topics, recent: all('SELECT code,category,text,status,store,source,created_at FROM wishes ORDER BY id DESC LIMIT 6') });
    }],
    ['GET', /^\/api\/admin\/staff-stats$/, ['hq', 'advisor'], () => {
      const U = all("SELECT id,name,role,store,disabled,last_login FROM users WHERE role IN ('advisor','tech','hq') ORDER BY role,id");
      return J({ staff: U.map(x => x.role === 'advisor' ? { ...x, cases: n1('SELECT COUNT(*) AS n FROM bookings WHERE assignee_id=?', [x.id]), plans: n1('SELECT COUNT(*) AS n FROM plans WHERE advisor_id=?', [x.id]), quotes: n1('SELECT COUNT(*) AS n FROM quotes WHERE by_id=?', [x.id]) }
        : x.role === 'tech' ? { ...x, pk: n1('SELECT COUNT(*) AS n FROM work_packages WHERE assignee_id=?', [x.id]), pkDone: n1("SELECT COUNT(*) AS n FROM work_packages WHERE assignee_id=? AND status='已完成'", [x.id]), acc: n1('SELECT COUNT(*) AS n FROM acceptance_results WHERE by_id=?', [x.id]) } : x) });
    }],
    ['GET', /^\/api\/care\/rules$/, 'any', () => { const r = one("SELECT value FROM config WHERE key='care_rules'"); return J({ rules: r ? parse(r.value) : { bath_min: 30, morning: '10:00', elder_wait: 5, family_wait: 5 } }); }],
    ['GET', /^\/api\/admin\/settings$/, ['hq', 'advisor'], () => { const r = one("SELECT value FROM config WHERE key='care_rules'"); return J({ rules: r ? parse(r.value) : { bath_min: 30, morning: '10:00', elder_wait: 5, family_wait: 5 } }); }],
    ['PUT', /^\/api\/admin\/settings$/, ['hq'], (u, m, b) => {
      const r = b.rules || {}, v = { bath_min: Math.max(10, Math.min(90, r.bath_min | 0)), morning: /^\d\d:\d\d$/.test(r.morning) ? r.morning : '10:00', elder_wait: Math.max(1, Math.min(15, r.elder_wait | 0)), family_wait: Math.max(1, Math.min(15, r.family_wait | 0)) };
      run("INSERT INTO config(key,value,updated_by,updated_at) VALUES('care_rules',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at", [JSON.stringify(v), u.id, now()]);
      persist(); return J({ rules: v });
    }],
  ]);

  // ===================== 工作包 5｜延伸期與商用：新身分 =====================
  // users 原本只允許 family／advisor／tech／hq；重建資料表把 ambassador（校園大使）、business（商用客戶）加進去
  S.add('roles_v2', `CREATE TABLE IF NOT EXISTS roles_v2 (done INTEGER);
CREATE TABLE IF NOT EXISTS amb_visits (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, family TEXT NOT NULL, store TEXT,
  checks TEXT NOT NULL DEFAULT '{}', note TEXT, status TEXT NOT NULL DEFAULT '待門市確認', points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, reviewed_at TEXT
);
CREATE TABLE IF NOT EXISTS biz_sites (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, store TEXT);
CREATE TABLE IF NOT EXISTS biz_assets (id INTEGER PRIMARY KEY, site_id INTEGER NOT NULL, space TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ok', note TEXT, due TEXT);
CREATE TABLE IF NOT EXISTS biz_repairs (id INTEGER PRIMARY KEY, site_id INTEGER NOT NULL, asset_id INTEGER, kind TEXT NOT NULL, note TEXT, status TEXT NOT NULL DEFAULT '待派工', eta TEXT, created_at TEXT NOT NULL, done_at TEXT);`, [
    // 校園大使
    ['GET', /^\/api\/amb\/summary$/, ['ambassador'], (u) => {
      const V = all('SELECT * FROM video_tasks WHERE user_id=? ORDER BY id DESC', [u.id]), O = all('SELECT * FROM amb_visits WHERE user_id=? ORDER BY id DESC', [u.id]);
      const pts = O.reduce((a, x) => a + x.points, 0) + V.filter(v => v.status === '已上架').length * 100;
      return J({ videos: V.map(v => ({ ...v, checks: parse(v.checks) || {} })), visits: O.map(v => ({ ...v, checks: parse(v.checks) || {} })), points: pts, code: 'WZU-' + String(u.id).padStart(4, '0') });
    }],
    ['POST', /^\/api\/amb\/visits$/, ['ambassador'], (u, m, b) => {
      const ck = b.checks || {}; if (!['a', 'b', 'c'].every(k => ck[k])) return ERR('三項同意都要確認', 400);
      if (!String(b.family || '').trim()) return ERR('請填寫家庭', 400);
      run('INSERT INTO amb_visits(user_id,family,store,checks,note,created_at) VALUES(?,?,?,?,?,?)', [u.id, String(b.family).slice(0, 40), u.store, JSON.stringify(ck), String(b.note || '').slice(0, 200), now()]);
      persist(); return J({ id: lastId() });
    }],
    ['GET', /^\/api\/admin\/amb-visits$/, ['hq', 'advisor'], () => J({ visits: all('SELECT v.*, u.name FROM amb_visits v JOIN users u ON u.id=v.user_id ORDER BY v.id DESC') })],
    ['POST', /^\/api\/admin\/amb-visits\/(\d+)\/ok$/, ['hq', 'advisor'], (u, m) => { run("UPDATE amb_visits SET status='已確認', points=50, reviewed_at=? WHERE id=?", [now(), +m[1]]); persist(); return J({ ok: true }); }],
    // 商用客戶
    ['GET', /^\/api\/biz\/site$/, ['business'], (u) => {
      const st = one('SELECT * FROM biz_sites WHERE user_id=?', [u.id]); if (!st) return ERR('找不到據點', 404);
      return J({ site: st, assets: all('SELECT * FROM biz_assets WHERE site_id=? ORDER BY id', [st.id]), repairs: all('SELECT r.*, a.space, a.name FROM biz_repairs r LEFT JOIN biz_assets a ON a.id=r.asset_id WHERE r.site_id=? ORDER BY r.id DESC', [st.id]) });
    }],
    ['POST', /^\/api\/biz\/repairs$/, ['business'], (u, m, b) => {
      const st = one('SELECT * FROM biz_sites WHERE user_id=?', [u.id]); if (!st) return ERR('找不到據點', 404);
      const ids = (b.asset_ids || [b.asset_id]).filter(Boolean).map(Number), kind = b.kind === '保養' ? '保養' : b.kind === '合併到府' ? '合併到府' : '報修';
      const A = ids.map(i => one('SELECT * FROM biz_assets WHERE id=? AND site_id=?', [i, st.id])).filter(Boolean); if (!A.length) return ERR('請選擇設備', 400);
      const open = A.find(a => one("SELECT id FROM biz_repairs WHERE asset_id=? AND status<>'已完成'", [a.id])); if (open && A.length === 1) return J({ duplicate: true });
      for (const a of A) run('INSERT INTO biz_repairs(site_id,asset_id,kind,note,created_at) VALUES(?,?,?,?,?)', [st.id, a.id, kind, String(b.note || a.note || ''), now()]);
      persist(); return J({ ok: true, n: A.length });
    }],
    ['GET', /^\/api\/admin\/biz-repairs$/, ['hq', 'advisor'], () => J({ repairs: all('SELECT r.*, a.space, a.name, s.name AS site FROM biz_repairs r JOIN biz_sites s ON s.id=r.site_id LEFT JOIN biz_assets a ON a.id=r.asset_id ORDER BY r.id DESC') })],
    ['POST', /^\/api\/admin\/biz-repairs\/(\d+)$/, ['hq', 'advisor'], (u, m, b) => {
      const st = ['已派工', '已完成'].includes(b.status) ? b.status : '已派工';
      run('UPDATE biz_repairs SET status=?, eta=COALESCE(?,eta), done_at=? WHERE id=?', [st, b.eta || null, st === '已完成' ? now() : null, +m[1]]);
      if (st === '已完成') { const r = one('SELECT asset_id FROM biz_repairs WHERE id=?', [+m[1]]); if (r && r.asset_id) run("UPDATE biz_assets SET status='ok', note='正常', due=NULL WHERE id=?", [r.asset_id]); }
      persist(); return J({ ok: true });
    }],
    ['GET', /^\/api\/admin\/partner-orders$/, ['hq', 'advisor'], () => J({ orders: all("SELECT o.*, h.elder_name FROM orders o JOIN households h ON h.id=o.household_id WHERE o.items LIKE '%異業加購%' ORDER BY o.id DESC").map(o => ({ ...o, items: parse(o.items) || [], household: o.elder_name + '家' })) })],
  ], () => {
    const cur = one("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
    if (cur && !/ambassador/.test(cur.sql)) {
      run('PRAGMA foreign_keys=OFF');
      run(cur.sql.replace(/CREATE TABLE (IF NOT EXISTS )?"?users"?/, 'CREATE TABLE users_v2').replace("('family','advisor','tech','hq')", "('family','advisor','tech','hq','ambassador','business')"));
      run('INSERT INTO users_v2 SELECT * FROM users'); run('DROP TABLE users'); run('ALTER TABLE users_v2 RENAME TO users');
      run('PRAGMA foreign_keys=ON');
    }
    const pw = (one("SELECT pw_hash FROM users WHERE email='advisor@example.com'") || {}).pw_hash;
    if (pw) {
      run("INSERT OR IGNORE INTO users(email,name,role,store,pw_hash) VALUES('amb@example.com','林同學','ambassador','Digital City 高雄民族店',?)", [pw]);
      run("INSERT OR IGNORE INTO users(email,name,role,store,pw_hash) VALUES('biz@example.com','王主任','business','Digital City 高雄民族店',?)", [pw]);
    }
    const bz = one("SELECT id FROM users WHERE email='biz@example.com'");
    if (bz && !one('SELECT id FROM biz_sites WHERE user_id=?', [bz.id])) {
      run("INSERT INTO biz_sites(user_id,name,kind,store) VALUES(?,'高雄樂齡日照中心（虛構）','日照據點','Digital City 高雄民族店')", [bz.id]);
      const sid = lastId();
      for (const [sp, n, st, note, due] of [['活動室', '冷氣 ×2', 'am', '保養到期', '12/05'], ['活動室', '空氣清淨機', 'ok', '正常', null], ['用餐區', '冰箱', 'ok', '正常', null], ['用餐區', '電鍋與飲水機', 'am', '濾心到期', '12/10'], ['浴室', '電熱水器', 'rd', '待修：溫度不穩', null], ['午休室', '除濕機', 'ok', '正常', null]])
        run('INSERT INTO biz_assets(site_id,space,name,status,note,due) VALUES(?,?,?,?,?,?)', [sid, sp, n, st, note, due]);
    }
  });
  metric({ g: '延伸期與商用', k: 'amb', l: '校園大使陪同居家觀察', u: '次', src: 'amb_visits', f: () => n1('SELECT COUNT(*) AS n FROM amb_visits') });
  metric({ g: '延伸期與商用', k: 'biz_rep', l: '商用客戶報修與保養', u: '件', src: 'biz_repairs', f: () => n1('SELECT COUNT(*) AS n FROM biz_repairs') });
  metric({ g: '延伸期與商用', k: 'biz_open', l: '商用待派工', u: '件', src: 'biz_repairs', f: () => n1("SELECT COUNT(*) AS n FROM biz_repairs WHERE status='待派工'") });
  S.cases = cases; S.summary = summary; S.now = now; S.lastId = lastId;
})();
