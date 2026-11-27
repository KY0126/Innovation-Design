// 實用版測試用：模擬 Supabase（REST、Auth、Edge Function）與 LINE 登入頁，不連真的雲端
// 只在測試裡用；資料都在記憶體，每個測試重新建立
const SB = 'https://mmownoqzrhvgguxpukgl.supabase.co';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': '*' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub, role = 'authenticated') => b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub, role, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }) + '.sig';

function session(user) {
  return { access_token: jwt(user.id), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r-' + user.id, user };
}
function userObj(id, email) {
  return { id, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
}

// state.calls 記錄 Edge Function 呼叫，方便驗證
function createMock(opts = {}) {
  const db = Object.assign({
    profiles: [], households: [], members: [], assessments: [], notifications: [], share_logs: [],
    quotes: [], consents: [], care_events: [], wish_works: [], wish_supports: [],
  }, opts.db || {});
  const st = { db, calls: [], nextId: 100, me: null, functions: opts.functions || {}, rpc: opts.rpc || {} };

  // PostgREST 篩選：eq、neq、is、in、gt、gte、lt、lte、like、not.is；order 欄位排序（沒指定時新的在前）
  const cmp = (a, b) => (a == null ? -1 : b == null ? 1 : typeof a === 'number' && typeof b === 'number' ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
  const filt = (rows, sp, keepOrder) => {
    let out = rows;
    for (const [k, v] of sp.entries()) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
      const m = /^(not\.)?(eq|neq|is|in|gt|gte|lt|lte|like)\.(.*)$/.exec(v); if (!m) continue;
      const neg = !!m[1], op = m[2], raw = m[3], val = raw === 'null' ? null : raw;
      const test = (r) => {
        const x = r[k];
        if (op === 'eq') return String(x) === val;
        if (op === 'neq') return String(x) !== val;
        if (op === 'is') return val === null ? x == null : String(x) === val;
        if (op === 'in') { const L = raw.replace(/^\(|\)$/g, '').split(',').map((y) => y.replace(/^"|"$/g, '')); return L.includes(String(x)); }
        if (op === 'like') { const re = new RegExp('^' + raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*') + '$'); return re.test(String(x == null ? '' : x)); }
        const c = cmp(isNaN(+x) || isNaN(+val) ? x : +x, isNaN(+x) || isNaN(+val) ? val : +val);
        return op === 'gt' ? c > 0 : op === 'gte' ? c >= 0 : op === 'lt' ? c < 0 : c <= 0;
      };
      out = out.filter((r) => (neg ? !test(r) : test(r)));
    }
    const ord = sp.get('order');
    if (ord) { const parts = ord.split(',').map((x) => x.split('.')); out = out.slice().sort((a, b) => { for (const [c0, dir] of parts) { const r = cmp(a[c0], b[c0]); if (r) return dir === 'desc' ? -r : r; } return 0; }); }
    else if (!keepOrder) out = out.slice().reverse();
    const lim = sp.get('limit'); if (lim) out = out.slice(0, Number(lim));
    return out;
  };
  // 資料表預設值（同 migration）
  const DEF = { requests: { status: '待處理' }, wishes: { status: '待分類' }, wish_comments: { status: '待審核' }, video_tasks: { status: '待審核' }, consents: { agreed: true, revoked_at: null }, preorders: { status: '意向登記' } };
  const PK = { hh_kv: ['household_id', 'k'], cart_items: ['user_id', 'sku'], wish_votes: ['topic_id', 'user_id'], preorders: ['topic_id', 'user_id'], members: ['household_id', 'user_id'], wish_supports: ['work_id', 'user_id'] };

  async function handle(route) {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const u = new URL(req.url());
    const body = (() => { try { return req.postDataJSON(); } catch (e) { return null; } })();
    const send = (status, data, extra = {}) => route.fulfill({ status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra }, body: data === undefined ? '' : JSON.stringify(data) });
    const p = u.pathname;

    if (p.startsWith('/functions/v1/')) {
      const name = p.split('/').pop();
      st.calls.push({ name, body, auth: req.headers()['authorization'] || '' });
      const f = st.functions[name];
      const r = f ? f(body, st) : { status: 404, data: { error: 'no mock' } };
      return send(r.status || 200, r.data);
    }
    if (p === '/auth/v1/verify') {
      const user = userObj('u-family', 'line_test@line.jiujujia.example');
      st.me = user;
      if (!db.profiles.some((x) => x.id === user.id)) db.profiles.push({ id: user.id, display_name: '陳測試', role: 'family', is_friend: true });
      return send(200, session(user));
    }
    if (p === '/auth/v1/token') {
      if (u.searchParams.get('grant_type') === 'password') {
        const staff = (opts.staff || []).find((s) => s.email === body.email && s.password === body.password);
        if (!staff) return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
        const user = userObj(staff.id, staff.email); st.me = user; return send(200, session(user));
      }
      return send(200, session(st.me));
    }
    if (p === '/auth/v1/user') return st.me ? send(200, st.me) : send(401, { msg: 'no' });
    if (p === '/auth/v1/logout') { st.me = null; return send(204); }

    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.split('/').pop();
      const r = st.rpc[fn] ? st.rpc[fn](body, st) : null;
      if (r === null || r === undefined) return send(404, { message: 'no rpc mock: ' + fn });
      if (r && r.__err) return send(400, { code: 'P0001', message: r.__err, details: null, hint: null });
      return send(200, r);
    }
    if (p.startsWith('/rest/v1/')) {
      const t = p.split('/').pop(); const rows = db[t] || (db[t] = []);
      const accept = req.headers()['accept'] || '';
      const one = /vnd\.pgrst\.object/.test(accept);
      if (req.method() === 'GET' || req.method() === 'HEAD') {
        const out = filt(rows, u.searchParams);
        if (one) return out.length ? send(200, out[0]) : send(406, { code: 'PGRST116', message: 'no rows', details: '', hint: null });
        return send(200, out);
      }
      if (req.method() === 'POST') {
        const prefer = req.headers()['prefer'] || '';
        const keys = (u.searchParams.get('on_conflict') || '').split(',').filter(Boolean).length ? u.searchParams.get('on_conflict').split(',') : PK[t];
        const list = [];
        for (const r of (Array.isArray(body) ? body : [body])) {
          const ex = keys && rows.find((x) => keys.every((k) => String(x[k]) === String(r[k])));
          if (ex && /merge-duplicates/.test(prefer)) { Object.assign(ex, r); list.push(ex); continue; }
          if (ex && keys) return send(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
          const row = { id: st.nextId++, created_at: new Date().toISOString(), ...(DEF[t] || {}), ...r }; rows.push(row); list.push(row);
        }
        if (/return=representation/.test(prefer)) return send(201, one ? list[0] : list);
        return send(201);
      }
      if (req.method() === 'PATCH') {
        filt(rows, u.searchParams, true).forEach((r) => Object.assign(r, body));
        return send(204);
      }
      if (req.method() === 'DELETE') {
        const gone = new Set(filt(rows, u.searchParams, true));
        db[t] = rows.filter((r) => !gone.has(r));
        return send(204);
      }
      return send(405, {});
    }
    return send(404, {});
  }

  async function install(page, { channel = 'TEST-CHANNEL' } = {}) {
    await page.addInitScript((c) => { window.JJJ_LIVE_CFG_OVERRIDE = { lineLoginChannelId: c, callback: location.origin + '/live/app/', base: location.origin + '/live/' }; window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; }, channel);
    await page.route(SB + '/**', handle);
    // LINE 登入頁：直接同意，帶 code 回到 Callback
    await page.route('https://access.line.me/**', (route) => {
      const u = new URL(route.request().url());
      st.authorize = Object.fromEntries(u.searchParams);
      const back = u.searchParams.get('redirect_uri') + '?code=test-code&state=' + u.searchParams.get('state');
      return route.fulfill({ status: 302, headers: { Location: back } });
    });
  }
  return { st, install, session, userObj };
}
module.exports = { createMock };
