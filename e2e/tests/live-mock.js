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

  const filt = (rows, sp) => {
    let out = rows;
    for (const [k, v] of sp.entries()) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
      const m = /^(eq|is)\.(.*)$/.exec(v); if (!m) continue;
      const val = m[2] === 'null' ? null : m[2];
      out = out.filter((r) => (val === null ? r[k] == null : String(r[k]) === val));
    }
    const lim = sp.get('limit'); if (lim) out = out.slice(0, Number(lim));
    return out;
  };

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
      return send(200, r);
    }
    if (p.startsWith('/rest/v1/')) {
      const t = p.split('/').pop(); const rows = db[t] || (db[t] = []);
      const accept = req.headers()['accept'] || '';
      const one = /vnd\.pgrst\.object/.test(accept);
      if (req.method() === 'GET') {
        const out = filt(rows, u.searchParams).slice().reverse();
        if (one) return out.length ? send(200, out[0]) : send(406, { code: 'PGRST116', message: 'no rows', details: '', hint: null });
        return send(200, out);
      }
      if (req.method() === 'POST') {
        const list = (Array.isArray(body) ? body : [body]).map((r) => ({ id: st.nextId++, created_at: new Date().toISOString(), ...r }));
        rows.push(...list);
        const prefer = req.headers()['prefer'] || '';
        if (/return=representation/.test(prefer)) return send(201, one ? list[0] : list);
        return send(201);
      }
      if (req.method() === 'PATCH') {
        filt(rows, u.searchParams).forEach((r) => Object.assign(r, body));
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
