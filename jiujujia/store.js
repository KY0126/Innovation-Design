// 揪居家｜資料補正層（工作包 1）
// 原本 9 種存在瀏覽器 localStorage 的業務資料，全部改存進同一個資料庫（sql.js 模擬後端），
// 並以 /api/… 介面讀寫，頁面不再直接碰 localStorage 的業務資料。
// 載入順序：backend.js 之後、phase.js 之前。
(function () {
  if (!window.JJJWEB) return;
  const DBKEY = 'jjj_web_db_v7';
  const inner = window.fetch;

  // ---------- 資料表 ----------
  const SCHEMA = `
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY,
  household_id INTEGER NOT NULL,
  ver INTEGER NOT NULL,
  total INTEGER NOT NULL,
  pending INTEGER NOT NULL DEFAULT 0,
  items TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT '待長輩確認',
  by_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (household_id, ver)
);
CREATE TABLE IF NOT EXISTS quote_selections (
  household_id INTEGER PRIMARY KEY,
  sel TEXT NOT NULL DEFAULT '{}',
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS subsidies (
  household_id INTEGER PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}',
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS family_choices (
  household_id INTEGER PRIMARY KEY,
  state TEXT NOT NULL DEFAULT '{}',
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS family_handoffs (
  id INTEGER PRIMARY KEY,
  household_id INTEGER NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',
  at TEXT NOT NULL,
  by_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS assessment_drafts (
  household_id INTEGER PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}',
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS acceptance_results (
  booking_code TEXT PRIMARY KEY,
  first_pass INTEGER NOT NULL,
  by_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);`;

  let ready = null;
  function W() { return globalThis.__DBW; }
  function start() {
    if (!ready) ready = window.JJJWEB.start().then(() => { ensure(); migrate(); persist(); });
    return ready;
  }
  // 其他分頁改了資料庫時，backend.js 會整個換掉資料庫；每次處理前確認這幾張表都在
  function ensure() { if (!one0("SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name='assessment_drafts'")) W().exec(SCHEMA); }
  function one0(sql) { try { return W().prepare(sql).get(); } catch (e) { return null; } }
  function all(sql, args = []) { return W().prepare(sql).all(...args); }
  function one(sql, args = []) { return W().prepare(sql).get(...args); }
  function run(sql, args = []) { return W().prepare(sql).run(...args); }
  function persist() {
    const b = W().exportBytes(); let s = '';
    for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768));
    try { localStorage.setItem(DBKEY, btoa(s)); } catch (e) {}
  }

  // 舊版存在瀏覽器的資料，第一次載入時搬進資料庫，之後刪掉
  function migrate() {
    const take = k => { try { const v = localStorage.getItem(k); if (v != null) localStorage.removeItem(k); return v; } catch (e) { return null; } };
    let moved = false;
    const ph = take('jjj_phase');
    if (ph != null && !one('SELECT 1 AS x FROM config WHERE key=?', ['phase'])) { run("INSERT INTO config(key,value) VALUES('phase',?)", [String(Math.max(0, PHN.indexOf(ph)))]); moved = true; }
    const jp = (k, d) => { const v = take(k); if (v == null) return d; try { return JSON.parse(v); } catch (e) { return d; } };
    const Q = jp('jjj_v5_quotes', {});
    for (const hid of Object.keys(Q)) for (const q of Q[hid] || []) {
      run('INSERT OR IGNORE INTO quotes(household_id,ver,total,pending,items,created_at) VALUES(?,?,?,?,?,?)', [+hid, q.v, q.total || 0, q.pending || 0, JSON.stringify(q.items || []), q.at || '']); moved = true;
    }
    const SEL = jp('jjj_v5_csel', null);
    if (SEL) for (const hid of Object.keys(SEL)) { run('INSERT OR REPLACE INTO quote_selections(household_id,sel) VALUES(?,?)', [+hid, JSON.stringify(SEL[hid])]); moved = true; }
    const SUB = jp('jjj_v5_subsidy', null);
    if (SUB) for (const hid of Object.keys(SUB)) { run('INSERT OR REPLACE INTO subsidies(household_id,data) VALUES(?,?)', [+hid, JSON.stringify(SUB[hid])]); moved = true; }
    const H = jp('jjj_v5_handoff', []);
    for (const h of H.slice().reverse()) { run('INSERT INTO family_handoffs(household_id,items,at) VALUES(?,?,?)', [h.hid || 3, JSON.stringify(h.items || []), h.at || '']); moved = true; }
    const O2 = jp('jjj_v5_opt2', null);
    if (O2) { run('INSERT OR REPLACE INTO family_choices(household_id,state) VALUES(?,?)', [3, JSON.stringify(O2)]); moved = true; }
    const FP = jp('jjj_fp', {});
    for (const code of Object.keys(FP)) { run('INSERT OR REPLACE INTO acceptance_results(booking_code,first_pass) VALUES(?,?)', [code, FP[code] ? 1 : 0]); moved = true; }
    take('jjj_adv_drafts'); take('jjj_v5_opt');
    if (moved) persist();
  }

  const PHN = ['試點期', '擴展期', '延伸期'];
  async function me() {
    const r = await inner('/api/me', { headers: { Accept: 'application/json' } });
    if (!r.ok) return null; const d = await r.json(); return d.user || null;
  }
  async function myHousehold(u) {
    const r = await inner('/api/home', { headers: { Accept: 'application/json' } });
    if (!r.ok) return null; const d = await r.json(); return d.household ? d.household.id : null;
  }
  const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
  const ERR = (m, s) => J({ error: m }, s);
  const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };
  const staff = u => u && (u.role === 'advisor' || u.role === 'hq');

  // ---------- 路由 ----------
  // 每一支都寫成 [方法, 路徑樣式, 需要的身分, 處理]
  const R = [
    ['GET', /^\/api\/ops\/phase$/, null, () => { const r = one("SELECT value FROM config WHERE key='phase'"); return J({ phase: r ? +r.value : 2 }); }],
    ['PUT', /^\/api\/ops\/phase$/, 'any', (u, m, b) => {
      // 示範：分享連結 ?phase= 也要能切換，所以不限總部；正式版只允許總部
      const p = Math.max(0, Math.min(2, b.phase | 0));
      run("INSERT INTO config(key,value,updated_by,updated_at) VALUES('phase',?,?,datetime('now','localtime')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at", [String(p), u ? u.id : null]);
      persist(); return J({ phase: p });
    }],
    ['GET', /^\/api\/advisor\/quotes\/(\d+)$/, 'staff', (u, m) => J({ quotes: all('SELECT ver AS v,total,pending,items,status,created_at AS at FROM quotes WHERE household_id=? ORDER BY ver DESC', [+m[1]]).map(q => ({ ...q, items: parse(q.items) || [] })) })],
    ['POST', /^\/api\/advisor\/quotes\/(\d+)$/, 'staff', (u, m, b) => {
      const hid = +m[1], v = ((one('SELECT MAX(ver) AS v FROM quotes WHERE household_id=?', [hid]) || {}).v || 0) + 1;
      run('INSERT INTO quotes(household_id,ver,total,pending,items,by_id,created_at) VALUES(?,?,?,?,?,?,?)', [hid, v, b.total | 0, b.pending | 0, JSON.stringify(b.items || []), u.id, b.at || '']);
      persist(); return J({ v });
    }],
    ['GET', /^\/api\/home\/quote$/, 'family', async (u) => {
      const hid = await myHousehold(u); if (!hid) return J({ quote: null });
      const q = one('SELECT ver AS v,total,pending,items,status,created_at AS at FROM quotes WHERE household_id=? ORDER BY ver DESC LIMIT 1', [hid]);
      return J({ quote: q ? { ...q, items: parse(q.items) || [] } : null });
    }],
    ['GET', /^\/api\/advisor\/selections\/(\d+)$/, 'staff', (u, m) => { const r = one('SELECT sel FROM quote_selections WHERE household_id=?', [+m[1]]); return J({ sel: r ? parse(r.sel) : null }); }],
    ['PUT', /^\/api\/advisor\/selections\/(\d+)$/, 'staff', (u, m, b) => { run("INSERT OR REPLACE INTO quote_selections(household_id,sel,updated_by,updated_at) VALUES(?,?,?,datetime('now','localtime'))", [+m[1], JSON.stringify(b.sel || {}), u.id]); persist(); return J({ ok: true }); }],
    ['GET', /^\/api\/advisor\/subsidy\/(\d+)$/, 'staff', (u, m) => { const r = one('SELECT data FROM subsidies WHERE household_id=?', [+m[1]]); return J({ data: r ? parse(r.data) : {} }); }],
    ['PUT', /^\/api\/advisor\/subsidy\/(\d+)$/, 'staff', (u, m, b) => { run("INSERT OR REPLACE INTO subsidies(household_id,data,updated_by,updated_at) VALUES(?,?,?,datetime('now','localtime'))", [+m[1], JSON.stringify(b.data || {}), u.id]); persist(); return J({ ok: true }); }],
    ['GET', /^\/api\/home\/choices$/, 'family', async (u) => { const hid = await myHousehold(u); const r = hid && one('SELECT state FROM family_choices WHERE household_id=?', [hid]); return J({ state: r ? parse(r.state) : null }); }],
    ['PUT', /^\/api\/home\/choices$/, 'family', async (u, m, b) => { const hid = await myHousehold(u); if (!hid) return ERR('找不到家庭', 404); run("INSERT OR REPLACE INTO family_choices(household_id,state,updated_by,updated_at) VALUES(?,?,?,datetime('now','localtime'))", [hid, JSON.stringify(b.state || {}), u.id]); persist(); return J({ ok: true }); }],
    ['POST', /^\/api\/home\/handoff$/, 'family', async (u, m, b) => { const hid = await myHousehold(u); if (!hid) return ERR('找不到家庭', 404); run('INSERT INTO family_handoffs(household_id,items,at,by_id) VALUES(?,?,?,?)', [hid, JSON.stringify(b.items || []), b.at || '', u.id]); persist(); return J({ ok: true }); }],
    ['GET', /^\/api\/home\/handoffs$/, 'family', async (u) => { const hid = await myHousehold(u); return J({ handoffs: hid ? all('SELECT items,at FROM family_handoffs WHERE household_id=? ORDER BY id DESC LIMIT 5', [hid]).map(h => ({ ...h, items: parse(h.items) || [] })) : [] }); }],
    ['GET', /^\/api\/advisor\/choices\/(\d+)$/, 'staff', (u, m) => { const r = one('SELECT state FROM family_choices WHERE household_id=?', [+m[1]]); return J({ state: r ? parse(r.state) : null }); }],
    ['GET', /^\/api\/advisor\/handoffs$/, 'staff', () => J({ handoffs: all('SELECT household_id AS hid,items,at FROM family_handoffs ORDER BY id DESC LIMIT 20').map(h => ({ ...h, items: parse(h.items) || [] })) })],
    ['GET', /^\/api\/advisor\/drafts$/, 'staff', (u) => J({ drafts: all("SELECT p.household_id AS hid, h.elder_name, p.created_at FROM plans p JOIN households h ON h.id=p.household_id WHERE p.advisor_id=? AND p.status='待確認' ORDER BY p.id DESC", [u.id]) })],
    ['GET', /^\/api\/home\/assessment-draft$/, 'family', async (u) => { const hid = await myHousehold(u); const r = hid && one('SELECT data,updated_at FROM assessment_drafts WHERE household_id=?', [hid]); return J({ draft: r ? parse(r.data) : null, at: r ? r.updated_at : null }); }],
    ['PUT', /^\/api\/home\/assessment-draft$/, 'family', async (u, m, b) => { const hid = await myHousehold(u); if (!hid) return ERR('找不到家庭', 404); run("INSERT OR REPLACE INTO assessment_drafts(household_id,data,updated_by,updated_at) VALUES(?,?,?,datetime('now','localtime'))", [hid, JSON.stringify(b.draft || {}), u.id]); persist(); return J({ ok: true }); }],
    ['DELETE', /^\/api\/home\/assessment-draft$/, 'family', async (u) => { const hid = await myHousehold(u); if (hid) { run('DELETE FROM assessment_drafts WHERE household_id=?', [hid]); persist(); } return J({ ok: true }); }],
    ['POST', /^\/api\/tech\/acceptance-result$/, 'tech', (u, m, b) => { run('INSERT OR REPLACE INTO acceptance_results(booking_code,first_pass,by_id) VALUES(?,?,?)', [String(b.code || ''), b.first_pass ? 1 : 0, u.id]); persist(); return J({ ok: true }); }],
  ];

  async function handle(method, path, body) {
    await start(); ensure();
    for (const [mth, re, need, fn] of R) {
      if (mth !== method) continue; const m = path.match(re); if (!m) continue;
      let u = null;
      if (need) {
        u = await me();
        if (need !== 'any') {
          if (!u) return ERR('請先登入', 401);
          if (need === 'staff' && !staff(u)) return ERR('沒有權限', 403);
          if (need === 'family' && u.role !== 'family') return ERR('沒有權限', 403);
          if (need === 'tech' && u.role !== 'tech') return ERR('沒有權限', 403);
        }
      }
      return fn(u, m, body || {});
    }
    return null;
  }
  window.fetch = async (u, o = {}) => {
    const url = typeof u === 'string' ? u : u.url;
    if (/\/api\//.test(url)) {
      const path = new URL(url, location.href).pathname.replace(/^.*(\/api\/)/, '$1');
      const method = (o.method || 'GET').toUpperCase();
      const r = await handle(method, path, o.body ? parse(o.body) : null);
      if (r) return r;
    }
    return inner(u, o);
  };
  window.JJJSTORE = { start, persist, PHN };
  start();
})();
