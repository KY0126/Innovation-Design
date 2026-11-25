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
  S.cases = cases; S.summary = summary; S.now = now; S.lastId = lastId;
})();
