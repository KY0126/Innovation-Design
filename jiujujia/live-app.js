// 實用版 App（登入後）：LINE 登入、長輩家、居家評估（手動輸入）、分享 S1／S3、方案同意、關懷紀錄、家人、通知
// 只在 ?mode=live 載入；資料存 Supabase 的 jjj 區（docs/design/實用版_資料表權限與LINE循環.md）。
// 畫面沿用 App 既有樣式（.top、.scroll、.card、.btn）；不放示範資料，沒資料就顯示空白提示（R15）。
(function () {
  if (!window.JJJ_LIVE) return;
  const C = window.JJJ_LIVE_CFG;
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    db: { schema: 'jjj' },
    // 自訂儲存名稱：同一個網域還有永信旅遊（同一個 Supabase 專案），避免兩邊登入狀態互相干擾
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'jjj-live-auth' },
  });
  const LV = { user: null, me: null, hhs: [], hh: null, ready: false };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $view = () => document.getElementById('view');
  const toast = (m) => { const t = document.createElement('div'); t.className = 'lv-toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); };
  const fnUrl = (n) => C.supabaseUrl + '/functions/v1/' + n;
  const SS = { get(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { sessionStorage.removeItem(k); } catch (e) {} } };

  // ── 登入 ──
  function login(target, extra) {
    if (!C.lineLoginChannelId) { toast('LINE 登入設定尚未完成'); return; }
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    const state = Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('');
    SS.set('lv_login', Object.assign({ state, target: target || 'jjj' }, extra || {}));
    const q = new URLSearchParams({ response_type: 'code', client_id: C.lineLoginChannelId, redirect_uri: C.callback, state, scope: 'profile openid', bot_prompt: 'normal' });
    location.href = 'https://access.line.me/oauth2/v2.1/authorize?' + q.toString();
  }
  async function callback(code, state) {
    const saved = SS.get('lv_login'); SS.del('lv_login');
    const clean = location.pathname + '?mode=live';
    history.replaceState(null, '', clean);
    if (!saved || saved.state !== state) { toast('登入逾時，請再試一次'); return null; }
    const r = await fetch(fnUrl('line-login'), { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.supabaseKey }, body: JSON.stringify({ code, redirect_uri: C.callback }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.token_hash) { toast(d.error || 'LINE 登入失敗，請再試一次'); return null; }
    const { error } = await sb.auth.verifyOtp({ token_hash: d.token_hash, type: 'magiclink' });
    if (error) { toast('登入失敗，請再試一次'); return null; }
    return saved;
  }
  async function loadMe() {
    const { data: { session } } = await sb.auth.getSession();
    LV.user = session ? session.user : null;
    if (!LV.user) { LV.me = null; LV.hhs = []; LV.hh = null; return; }
    const { data: me } = await sb.from('profiles').select('id, display_name, role, is_friend').eq('id', LV.user.id).maybeSingle();
    LV.me = me || { id: LV.user.id, display_name: '', role: 'family' };
    await loadHouseholds();
  }
  async function loadHouseholds() {
    const { data } = await sb.from('households').select('id, elder_name, elder_note, store, stage, created_at').order('created_at');
    LV.hhs = data || [];
    if (!LV.hh || !LV.hhs.some((h) => h.id === LV.hh.id)) LV.hh = LV.hhs[0] || null;
    else LV.hh = LV.hhs.find((h) => h.id === LV.hh.id);
  }
  async function logout() { await sb.auth.signOut(); await loadMe(); home(); }

  // ── 共用版面 ──
  function page(title, body, opts = {}) {
    const v = $view();
    v.innerHTML = `<div class="lv-page" data-lv-page="${esc(opts.key || '')}" style="display:contents"><div class="top"><button class="back" data-lv="back" aria-label="返回上一頁">‹ 返回</button><h1>${esc(title)}</h1><span class="tsp"></span></div><div class="scroll" style="padding-top:12px"><div class="pad">${body}</div></div></div>`;
    const sc = v.querySelector('.scroll'); if (sc) sc.scrollTop = 0;
  }
  const STEPS = [['先評估', '居家評估、燈號報告'], ['再改善', '到府施工與安裝'], ['後關心', '夜間關懷、主動提醒']];
  function timeline(stage) {
    return `<ol class="lv-tl" aria-label="服務進度">${STEPS.map(([n, d], i) => `<li class="${i < stage ? 'done' : i === stage ? 'now' : ''}"><b>${n}</b><span>${d}</span></li>`).join('')}</ol>`;
  }
  function home() { if (window.JJJAPP) window.JJJAPP.render(); }

  // ── 揪居家主頁 ──
  async function jjj() {
    await loadHouseholds();
    const name = (LV.me && LV.me.display_name) || '';
    if (!LV.hh) {
      page('揪居家', `<div class="card lv-hero"><div class="lv-red"><div class="s">歡迎${name ? '，' + esc(name) : ''}</div><div class="b">先建立長輩家</div><div class="s">建立後可以邀請兄弟姊妹一起看</div></div>
        <div class="lv-in"><div class="lv-em">免費居家評估：量尺寸＋燈號報告＋生活顧問解說</div>${timeline(0)}
        <button class="btn" data-lv="newhh">建立長輩家，開始免費評估</button><button class="btn ghost" data-lv="join">我有邀請碼</button></div></div>
        <div class="sec">要處理的事</div><div class="card muted" style="text-align:center">目前沒有要處理的事</div>`, { key: 'jjj' });
      return;
    }
    const h = LV.hh;
    const [{ data: as }, { data: nt }] = await Promise.all([
      sb.from('assessments').select('id, result, created_at').eq('household_id', h.id).order('created_at', { ascending: false }).limit(1),
      sb.from('notifications').select('id, title, link, created_at').is('read_at', null).order('created_at', { ascending: false }).limit(5),
    ]);
    const a = as && as[0];
    const lightsHtml = a ? lightRow(a.result.lights || []) : '';
    page('揪居家', `${LV.hhs.length > 1 ? `<div class="seg" role="group" aria-label="切換長輩家" style="margin:0 0 10px">${LV.hhs.map((x) => `<button data-lv="pickhh" data-id="${x.id}" aria-pressed="${x.id === h.id}">${esc(x.elder_name)}</button>`).join('')}</div>` : ''}
      <div class="card lv-hero"><div class="lv-red"><div class="s">長輩家</div><div class="b">${esc(h.elder_name)}家</div><div class="s">${a ? '最近一次評估：' + new Date(a.created_at).toLocaleDateString('zh-TW') : '還沒做居家評估'}</div></div>
      <div class="lv-in">${timeline(h.stage || 0)}${a ? lightsHtml + `<button class="btn" data-lv="assess">重新評估</button><button class="btn ghost" data-lv="shareS1">分享評估結果給家人</button>` : `<div class="lv-em">免費居家評估：量尺寸＋燈號報告＋生活顧問解說</div><button class="btn" data-lv="assess">開始免費評估</button>`}</div></div>
      <div class="card lv-inv"><div><b>邀家人一起加入</b><div class="muted" style="font-size:.88em">兄弟姊妹加入同一個長輩家，雙方各得一份小禮（禮品待定）</div></div><button class="btn ghost" data-lv="invite" style="width:auto;margin:0;padding:8px 16px">邀請</button></div>
      <div class="lv-grid">${[['care', '長輩關懷'], ['wish', '揪心願'], ['quote', '方案與訂單'], ['family', '家人']].map(([k, n]) => `<button data-lv="${k}"><span class="i" aria-hidden="true"></span>${n}</button>`).join('')}</div>
      <div class="sec">要處理的事　${(nt || []).length}</div>${(nt || []).length ? `<div class="glist">${nt.map((n) => `<button class="gi" data-lv="note" data-id="${n.id}" data-link="${esc(n.link || '')}"><span><b>${esc(n.title)}</b><span class="muted" style="display:block;font-size:.85em">${new Date(n.created_at).toLocaleString('zh-TW')}</span></span><span class="chev">›</span></button>`).join('')}</div>` : '<div class="card muted" style="text-align:center">目前沒有要處理的事</div>'}`, { key: 'jjj' });
  }
  const LC = { g: ['綠', '#1A7F37'], y: ['黃', '#9A6700'], r: ['紅', '#C8003A'] };
  function lightRow(L) {
    return `<div class="lv-lights">${L.map((x) => `<div class="lv-l"><span class="dot" style="background:${LC[x.c][1]}" aria-hidden="true"></span><b>${esc(x.k)}</b><span>${esc(x.v)}｜${LC[x.c][0]}燈</span>${x.c !== 'g' ? `<div class="muted" style="font-size:.85em;width:100%">${esc(x.fix)}</div>` : ''}</div>`).join('')}</div>`;
  }

  // ── 建立／加入長輩家 ──
  function newhh() {
    page('建立長輩家', `<form class="card" id="lvHH" novalidate>
      <label class="muted">長輩的稱呼<input class="fld" name="elder" placeholder="例如：媽媽、張媽媽" required maxlength="20"></label>
      <label class="muted" style="display:block;margin-top:10px">長輩狀況（選填）<input class="fld" name="note" placeholder="例如：剛開始一個人住" maxlength="60"></label>
      <label class="muted" style="display:block;margin-top:10px">綁定門市<select class="fld" name="store">${C.stores.map((s) => `<option>${esc(s)}</option>`).join('')}</select></label>
      <div class="err" role="alert"></div><button class="btn" type="submit" style="margin-top:12px">建立長輩家</button>
      <p class="muted" style="font-size:.85em;margin:10px 0 0">資料只用於試點服務，只有您的家人與綁定門市看得到，可隨時要求刪除。</p></form>`, { key: 'newhh' });
  }
  function join(code) {
    page('加入長輩家', `<form class="card" id="lvJoin" novalidate><label class="muted">邀請碼（6 碼）<input class="fld" name="code" value="${esc(code || '')}" maxlength="6" autocapitalize="characters" placeholder="例如：A1B2C3" required></label>
      <div class="err" role="alert"></div><button class="btn" type="submit" style="margin-top:12px">加入</button></form>`, { key: 'join' });
  }

  // ── 居家評估：每一格都可以「用手機量」（live-measure.js），也可以用捲尺量好手動填 ──
  const MEAS = { corridor: ['走道寬度', 'cm', 1, 'dist'], threshold: ['浴室門檻高度', 'cm', 1, 'height'], dist: ['床邊到浴室門口的距離', '公尺', 1, 'dist'] };
  const measBtn = (k) => `<button type="button" class="btn ghost lv-meas" data-lvm="${k}" style="margin-top:6px">用手機量${MEAS[k][0]}</button><span class="muted lv-msrc" data-msrc="${k}" style="display:block;font-size:.85em"></span>`;
  function assessForm() {
    page('居家評估', `<form class="card" id="lvAs" novalidate>
      <div class="card" style="border:1px solid #D4003C;margin:0 0 12px"><b>用手機 AR 一次量完</b><div class="muted" style="font-size:.9em">走道寬、門檻高、床到浴室，順路標插座、確認材質，約 3 分鐘</div><button type="button" class="btn" data-lvwalk="1" style="margin-top:8px;width:100%">開始 AR 量測</button><div class="muted" style="font-size:.85em;text-align:center;margin-top:4px">iPhone 會改用照片＋尺</div><div class="muted" id="lvWalkSum" style="font-size:.85em;margin-top:6px"></div></div>
      <p class="muted" style="margin:0 0 8px">每一格也可以單獨按「用手機量」，或用捲尺量好直接填。量不準的地方，生活顧問到府時會再確認。</p>
      <label class="muted">床邊到浴室的走道寬度（公分）<input class="fld" name="corridor" type="number" inputmode="decimal" min="30" max="300" step="0.5" required></label>${measBtn('corridor')}
      <label class="muted" style="display:block;margin-top:10px">浴室門檻高度（公分，沒有門檻填 0）<input class="fld" name="threshold" type="number" inputmode="decimal" min="0" max="30" step="0.1" required></label>${measBtn('threshold')}
      <label class="muted" style="display:block;margin-top:10px">床邊到浴室門口的距離（公尺）<input class="fld" name="dist" type="number" inputmode="decimal" min="0.5" max="30" step="0.1" required></label>${measBtn('dist')}
      <fieldset style="border:0;padding:0;margin:12px 0 0"><legend class="muted">半夜關燈後，走道看得清楚嗎？</legend>
        <label style="margin-right:16px"><input type="radio" name="dark" value="0" checked> 看得清楚</label><label><input type="radio" name="dark" value="1"> 偏暗</label></fieldset>
      <div class="err" role="alert"></div><button class="btn" type="submit" style="margin-top:12px">看燈號結果</button></form>`, { key: 'assess' });
  }
  // 燈號規則（依《建築物無障礙設施設計規範》）：門檻 ≤0.5 cm 綠、0.5–3 cm 黃、>3 cm 紅；走道 <80 cm 紅；走道偏暗又有門檻紅
  function lights(d) {
    const th = d.threshold_cm, cw = d.corridor_cm;
    const thC = th <= 0.5 ? 'g' : th <= 3 ? 'y' : 'r';
    return [
      { k: '浴室門檻', v: th + ' cm', c: d.dark && th > 0.5 ? 'r' : thC, fix: '揪夜安夜燈照出門檻；門檻較高時加斜坡或止滑條' },
      { k: '走道寬度', v: cw + ' cm', c: cw < 80 ? 'r' : 'g', fix: '移開走道上的家具或雜物，必要時加扶手' },
      { k: '夜間照明', v: d.dark ? '偏暗' : '看得清楚', c: d.dark ? (th > 0.5 ? 'r' : 'y') : 'g', fix: '揪夜安感應夜燈：起身自動亮，一路照到浴室' },
    ];
  }
  window.JJJLIVE_RULES = { lights };   // 單元測試用

  // ── 分享（先用 LINE 內建分享連結；第 6 步設定好 LIFF 後換成卡片） ──
  async function share(kind, text, url, target) {
    try { await sb.from('share_logs').insert({ user_id: LV.user.id, kind, target_id: target ? String(target) : null }); } catch (e) {}
    const u = 'https://line.me/R/share?text=' + encodeURIComponent(text + '\n' + url);
    window.open(u, '_blank', 'noopener');
  }
  async function newInvite() {
    const { data, error } = await sb.rpc('create_invite', { p_household: LV.hh.id });
    if (error) throw new Error('邀請碼產生失敗');
    return data;
  }
  async function shareS1() {
    const { data: as } = await sb.from('assessments').select('result').eq('household_id', LV.hh.id).order('created_at', { ascending: false }).limit(1);
    const L = (as && as[0] && as[0].result.lights) || [];
    if (!L.length) { toast('先完成居家評估'); return; }
    const r = L.filter((x) => x.c === 'r').length, y = L.filter((x) => x.c === 'y').length;
    const code = await newInvite();
    await share('S1', `爸媽家的居家安全評估好了：${r} 紅 ${y} 黃，一起看看怎麼改善\n加入一起看（邀請碼 ${code}）`, C.base + 'app/?invite=' + code, LV.hh.id);
  }
  async function invite() {
    const code = await newInvite();
    page('邀家人一起加入', `<div class="card" style="text-align:center"><div class="muted">邀請碼（14 天內有效，用一次）</div><div class="lv-code">${esc(code)}</div>
      <button class="btn" data-lv="shareInv" data-code="${esc(code)}">用 LINE 傳給家人</button><p class="muted" style="font-size:.85em">家人加入後，雙方各得一份小禮（禮品待定）。</p></div>`, { key: 'invite' });
  }

  // ── 方案與訂單（P1 點進來的地方） ──
  async function quotes() {
    const { data: qs } = await sb.from('quotes').select('id, version, items, total, created_at').eq('household_id', LV.hh.id).eq('is_formal', true).order('version', { ascending: false });
    const { data: cs } = await sb.from('consents').select('quote_id, on_behalf, created_at').eq('household_id', LV.hh.id);
    const done = new Map((cs || []).map((c) => [c.quote_id, c]));
    page('方案與訂單', (qs || []).length ? qs.map((q) => `<div class="card"><b>正式報價 第 ${q.version} 版</b><div class="muted" style="font-size:.85em">${new Date(q.created_at).toLocaleDateString('zh-TW')}</div>
      <div class="glist" style="margin:8px 0">${(q.items || []).map((it) => `<div class="gi" style="cursor:default"><span>${esc(it.name)}</span><span>${Number(it.price || 0).toLocaleString()} 元</span></div>`).join('')}</div>
      <div style="text-align:right"><b>合計 ${Number(q.total || 0).toLocaleString()} 元</b></div>
      ${done.has(q.id) ? `<p class="muted">已同意（${new Date(done.get(q.id).created_at).toLocaleString('zh-TW')}${done.get(q.id).on_behalf ? '，由家人代為操作' : ''}）</p>`
        : `<button class="btn" data-lv="consent" data-q="${q.id}" data-b="0">我是長輩本人，我同意</button><button class="btn ghost" data-lv="consent" data-q="${q.id}" data-b="1">長輩本人已親口同意，由我代為操作</button><p class="muted" style="font-size:.82em">一定要長輩本人同意才成交；長輩不同意，家人不能代為下單。</p>`}</div>`).join('')
      : '<div class="card muted" style="text-align:center">生活顧問送出正式報價後會出現在這裡，也會用 LINE 通知您。</div>', { key: 'quote' });
  }
  // ── 長輩關懷（P3／P4 點進來的地方） ──
  async function care() {
    const { data: ev } = await sb.from('care_events').select('id, kind, detected_at, elder_ok, elder_replied_at, family_notified').eq('household_id', LV.hh.id).order('detected_at', { ascending: false }).limit(20);
    const st = (e) => e.elder_ok === true ? '長輩回覆：我很好' : e.elder_ok === false ? '長輩回覆：需要幫忙' : e.family_notified ? '長輩還沒回覆，已通知家人' : '已問長輩，等待回覆';
    page('長輩關懷', (ev || []).length ? `<div class="glist">${ev.map((e) => `<div class="gi" style="cursor:default;flex-wrap:wrap"><span><b>${esc(e.kind)}</b><span class="muted" style="display:block;font-size:.85em">${new Date(e.detected_at).toLocaleString('zh-TW')}｜${st(e)}</span></span>${e.elder_ok == null ? `<button class="btn ghost" data-lv="careok" data-id="${e.id}" style="width:auto;margin:6px 0 0;padding:6px 12px">我已聯絡長輩，沒事</button>` : ''}</div>`).join('')}</div>`
      : '<div class="card muted" style="text-align:center">還沒有關懷紀錄。異常時會先問長輩，長輩沒回覆才通知您。</div>', { key: 'care' });
  }
  // ── 家人 ──
  async function family() {
    const { data: m } = await sb.rpc('household_members', { p_household: LV.hh.id });
    const R = { child: '子女', family: '家人', elder: '長輩' };
    page('家人', `<div class="glist">${(m || []).map((x) => `<div class="gi" style="cursor:default"><span><b>${esc(x.display_name || '（未命名）')}${x.is_me ? '（我）' : ''}</b></span><span class="muted">${R[x.relation] || ''}</span></div>`).join('')}</div><button class="btn" data-lv="invite">邀家人一起加入</button>`, { key: 'family' });
  }
  // ── 揪心願（先做寫下心願與分享；拼出來白板在第三階段接上） ──
  async function wish() {
    const { data: ws } = await sb.from('wish_works').select('id, title, scene, is_public, created_at').eq('owner', LV.user.id).order('created_at', { ascending: false });
    const counts = await Promise.all((ws || []).map((w) => sb.rpc('wish_count', { p_work: w.id }).then((r) => r.data || 0)));
    page('揪心願', `<form class="card" id="lvWish" novalidate><b>寫下心願</b><label class="muted" style="display:block;margin-top:8px">想要什麼？<input class="fld" name="title" maxlength="30" placeholder="例如：浴室夜燈扶手組" required></label>
      <label class="muted" style="display:block;margin-top:8px">用在哪裡<select class="fld" name="scene">${['臥室到浴室', '廚房', '客廳', '陽台'].map((s) => `<option>${s}</option>`).join('')}</select></label>
      <label style="display:block;margin-top:8px"><input type="checkbox" name="pub" checked> 公開，讓大家按「我也需要」</label><div class="err" role="alert"></div><button class="btn" type="submit" style="margin-top:10px">送出心願</button></form>
      <div class="sec">我的心願</div>${(ws || []).length ? `<div class="glist">${ws.map((w, i) => `<div class="gi" style="cursor:default;flex-wrap:wrap"><span><b>${esc(w.title)}</b><span class="muted" style="display:block;font-size:.85em">${esc(w.scene)}｜${counts[i]} 人也需要${w.is_public ? '' : '｜未公開'}</span></span>${w.is_public ? `<button class="btn ghost" data-lv="shareS3" data-id="${w.id}" data-n="${counts[i]}" data-t="${esc(w.title)}" style="width:auto;margin:6px 0 0;padding:6px 12px">分享</button>` : ''}</div>`).join('')}</div>` : '<div class="card muted" style="text-align:center">還沒有心願</div>'}`, { key: 'wish' });
  }
  function nextGap(n) { const s = C.wishStages.find((x) => x > n); return s ? s - n : 0; }
  // ── 會員中心、通知 ──
  function me() {
    page('會員中心', `<div class="card"><b>${esc((LV.me && LV.me.display_name) || '')}</b><div class="muted">LINE 登入${LV.me && LV.me.is_friend ? '｜已加入五子登科好友' : ''}</div></div>
      <p class="muted" style="font-size:.88em">實用版試點只開放揪居家；會員點數、折價券沿用全國電子既有會員服務。</p><button class="btn ghost" data-lv="logout" style="border-color:#C8003A;color:#C8003A">登出</button>`, { key: 'me' });
  }
  async function inbox() {
    const { data: nt } = await sb.from('notifications').select('id, title, link, created_at, read_at').order('created_at', { ascending: false }).limit(30);
    page('通知', (nt || []).length ? `<div class="glist">${nt.map((n) => `<button class="gi" data-lv="note" data-id="${n.id}" data-link="${esc(n.link || '')}"><span><b style="${n.read_at ? 'font-weight:500' : ''}">${esc(n.title)}</b><span class="muted" style="display:block;font-size:.85em">${new Date(n.created_at).toLocaleString('zh-TW')}</span></span><span class="chev">›</span></button>`).join('')}</div>` : '<div class="card muted" style="text-align:center">目前沒有通知</div>', { key: 'inbox' });
  }

  // ── 路由 ──
  const NEED_HH = { assess: assessForm, quote: quotes, care, family, invite };
  // 第 1 批起：已登入、有長輩家就進 Demo 同一套畫面（資料由 live-api.js 接 Supabase）；沒有長輩家先建立或加入
  const toApp = (key) => window.JJJLIVEAPI.enter(key);
  async function open(key) {
    if (!LV.user) { if (window.JJJLIVE) window.JJJLIVE.needLogin(key); return; }
    if (LV.me && LV.me.role !== 'family' && window.JJJLIVEAPI) return toApp('staff');
    if (window.JJJLIVEAPI) { await loadHouseholds(); if (LV.hh) return toApp(key); return jjj(); }
    try {
      if (key === 'me') return me();
      if (key === 'inbox') return inbox();
      if (key === 'wish') return wish();
      if (NEED_HH[key]) { await loadHouseholds(); if (!LV.hh) return jjj(); return NEED_HH[key](); }
      if (key === 'jjj') return jjj();
      toast('實用版試點只開放揪居家');
    } catch (e) { toast(e.message || '讀取失敗，請稍後再試'); }
  }
  async function afterLogin(saved) {
    if (saved && saved.invite) { join(saved.invite); return; }
    if (saved && saved.wish) { await supportWish(saved.wish); return; }
    await open((saved && saved.target) || 'jjj');
  }
  async function supportWish(id) {
    // 訂閱對應方案的家庭算「我也需要」，其他人先追蹤（同 Demo 規則，由資料庫函式判斷）
    let { error } = await sb.rpc('wish_support', { p_work: Number(id), p_follow: false, p_buy: '', p_price: '' });
    if (error) ({ error } = await sb.rpc('wish_support', { p_work: Number(id), p_follow: true, p_buy: '', p_price: '' }));
    if (error) toast('沒有成功，請再試一次');
    location.href = C.base + 'wish/?id=' + encodeURIComponent(id);
  }

  // ── 事件 ──
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('.lv-page [data-lv]');
    if (!b) return;
    e.preventDefault();
    const a = b.dataset.lv;
    try {
      if (a === 'back') { const k = b.closest('[data-lv-page]').dataset.lvPage; return ['jjj', 'me', 'inbox'].includes(k) ? home() : jjj(); }
      if (a === 'newhh') return newhh();
      if (a === 'join') return join();
      if (a === 'pickhh') { LV.hh = LV.hhs.find((h) => String(h.id) === b.dataset.id) || LV.hh; return jjj(); }
      if (a === 'shareS1') return shareS1();
      if (a === 'shareInv') return share('S1', '邀你一起看爸媽家的居家安全（邀請碼 ' + b.dataset.code + '）', C.base + 'app/?invite=' + b.dataset.code, LV.hh.id);
      if (a === 'shareS3') { const n = Number(b.dataset.n), g = nextGap(n); return share('S3', `我拼了一個心願：${b.dataset.t}${g ? `，還差 ${g} 人就能預購` : ''}，你也需要嗎？`, C.base + 'wish/?id=' + b.dataset.id, b.dataset.id); }
      if (a === 'consent') {
        const { error } = await sb.from('consents').insert({ household_id: LV.hh.id, quote_id: Number(b.dataset.q), consented_by: LV.user.id, on_behalf: b.dataset.b === '1' });
        if (error) throw new Error('沒有成功，請再試一次'); toast('已記錄同意'); return quotes();
      }
      if (a === 'careok') {
        const { error } = await sb.from('care_events').update({ elder_ok: true, elder_replied_at: new Date().toISOString() }).eq('id', Number(b.dataset.id));
        if (error) throw new Error('沒有成功，請再試一次'); return care();
      }
      if (a === 'note') { await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', Number(b.dataset.id)); const h = (b.dataset.link.split('#')[1] || 'jjj'); return open(h); }
      if (a === 'logout') return logout();
      return open(a);
    } catch (err) { toast(err.message || '讀取失敗，請稍後再試'); }
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target; if (!f.closest || !f.closest('.lv-page')) return;
    e.preventDefault();
    const er = f.querySelector('.err'); if (er) er.textContent = '';
    const btn = f.querySelector('button[type=submit]'); if (btn) btn.disabled = true;
    const fail = (m) => { if (er) er.textContent = m; if (btn) btn.disabled = false; };
    try {
      if (f.id === 'lvHH') {
        const elder = f.elder.value.trim(); if (!elder) return fail('請填長輩的稱呼');
        const { data, error } = await sb.rpc('create_household', { p_elder_name: elder, p_elder_note: f.note.value.trim() || null, p_store: f.store.value });
        if (error) return fail('建立失敗，請再試一次');
        await loadHouseholds(); LV.hh = LV.hhs.find((h) => h.id === data) || LV.hh; return window.JJJLIVEAPI ? toApp('jjj') : jjj();
      }
      if (f.id === 'lvJoin') {
        const code = f.code.value.trim().toUpperCase(); if (!/^[A-Z0-9]{6}$/.test(code)) return fail('邀請碼是 6 碼英文或數字');
        const { data, error } = await sb.rpc('redeem_invite', { p_code: code });
        if (error) return fail('邀請碼無效或已使用');
        await loadHouseholds(); LV.hh = LV.hhs.find((h) => h.id === data) || LV.hh; toast('已加入長輩家'); return window.JJJLIVEAPI ? toApp('jjj') : jjj();
      }
      if (f.id === 'lvAs') {
        const d = { corridor_cm: Number(f.corridor.value), threshold_cm: Number(f.threshold.value), bed_bath_m: Number(f.dist.value), dark: f.dark.value === '1' };
        if (!(d.corridor_cm >= 30 && d.corridor_cm <= 300) || !(d.threshold_cm >= 0 && d.threshold_cm <= 30) || !(d.bed_bath_m > 0)) return fail('請確認三個數字都填了，單位是公分／公尺');
        const L = lights(d);
        const dims = { corridor_mm: Math.round(d.corridor_cm * 10), threshold_mm: Math.round(d.threshold_cm * 10), bed_bath_mm: Math.round(d.bed_bath_m * 1000), dark: d.dark };
        const methods = {}; ['corridor', 'threshold', 'dist'].forEach((k) => { methods[k] = f[k].dataset.src || 'manual'; });
        dims.methods = methods;
        if (f.dataset.outlets != null) dims.outlets = Number(f.dataset.outlets);
        if (f.dataset.mats) dims.materials = JSON.parse(f.dataset.mats);
        const source = Object.values(methods).some((m) => m !== 'manual') ? 'ar' : 'manual';
        const { error } = await sb.from('assessments').insert({ household_id: LV.hh.id, source, dims, result: { lights: L }, created_by: LV.user.id });
        if (error) return fail('儲存失敗，請再試一次');
        return jjj();
      }
      if (f.id === 'lvWish') {
        const title = f.title.value.trim(); if (!title) return fail('請寫下想要什麼');
        const { error } = await sb.from('wish_works').insert({ owner: LV.user.id, title, scene: f.scene.value, is_public: f.pub.checked, build: [] });
        if (error) return fail('送出失敗，請再試一次');
        return wish();
      }
    } catch (err) { fail(err.message || '沒有成功，請再試一次'); }
  });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-lvm]'); if (!t || !window.JJJMeasure) return;
    const k = t.dataset.lvm, [label, unit, xrFit, kind] = MEAS[k], f = t.closest('form');
    window.JJJMeasure.open({ key: k, label, unit, kind, xrFit: !!xrFit, onDone: (v, mode) => {
      const inp = f && f[k]; if (!inp) return;
      inp.value = String(v); inp.dataset.src = mode;
      const m = f.querySelector(`[data-msrc="${k}"]`); if (m) m.textContent = mode === 'xr' ? '已用 AR 量（約 ±1～3 cm）；可直接改' : '已用照片量（約 ±3–5 cm，僅供參考）；可直接改';
      toast('已帶入：' + label + ' ' + v + ' ' + unit);
    } });
  });
  // 一次量完：帶回 3 個數字、插座數、材質（材質「待顧問確認」也照存，顧問到府時確認）
  const srcTxt = (mode) => (mode === 'xr' ? '已用 AR 量（約 ±1～3 cm）；可直接改' : '已用照片量（約 ±3–5 cm，僅供參考）；可直接改');
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-lvwalk]'); if (!t || !window.JJJMeasure) return;
    const f = t.closest('form'); if (!f) return;
    const vals = {}, modes = {};
    ['corridor', 'threshold', 'dist'].forEach((k) => { if (f[k].dataset.src && f[k].value !== '') { vals[k] = Number(f[k].value); modes[k] = f[k].dataset.src; } });
    window.JJJMeasure.walk({ init: { vals, modes, outlets: f.dataset.outlets != null ? Number(f.dataset.outlets) : 0, mats: f.dataset.mats ? JSON.parse(f.dataset.mats) : {} }, onDone: (r) => {
      Object.keys(r.vals).forEach((k) => {
        const inp = f[k]; if (!inp) return; inp.value = String(r.vals[k]); inp.dataset.src = r.modes[k] || 'photo';
        const m = f.querySelector(`[data-msrc="${k}"]`); if (m) m.textContent = srcTxt(inp.dataset.src);
      });
      f.dataset.outlets = String(r.outlets); f.dataset.mats = JSON.stringify(r.mats);
      const nm = Object.keys(r.mats).length, sum = f.querySelector('#lvWalkSum');
      if (sum) sum.textContent = `已帶入：${Object.keys(r.vals).length}／3 項尺寸、沿路插座 ${r.outlets} 個、材質 ${nm}／3 項`;
      toast('已帶入評估表');
    } });
  });
  document.addEventListener('input', (e) => {
    const inp = e.target; if (!inp.closest || !inp.closest('#lvAs') || !inp.dataset.src) return;
    delete inp.dataset.src; const m = inp.form.querySelector(`[data-msrc="${inp.name}"]`); if (m) m.textContent = '已改成手動填寫';
  });

  // ── 啟動 ──
  async function init() {
    const u = new URL(location.href);
    const code = u.searchParams.get('code'), state = u.searchParams.get('state');
    const invite = (u.searchParams.get('invite') || '').toUpperCase(), wishId = u.searchParams.get('wish');
    let saved = null;
    if (code && state) saved = await callback(code, state);
    await loadMe();
    LV.ready = true;
    if (window.JJJAPP) window.JJJAPP.render();
    // 員工（生活顧問、技師）在後台用員工編號登入後回到 App：直接進員工畫面（顧問 a1、技師 t1）
    if (LV.user && LV.me && LV.me.role !== 'family' && window.JJJLIVEAPI) return toApp('staff');
    if (saved && LV.user) return afterLogin(saved);
    if (invite || wishId) {
      history.replaceState(null, '', location.pathname + '?mode=live');
      if (LV.user) return invite ? join(invite) : supportWish(wishId);
      if (window.JJJLIVE) window.JJJLIVE.needLogin(invite ? 'join' : 'wish', invite ? { invite } : { wish: wishId });
      return;
    }
    const h = (location.hash || '').slice(1);
    if (LV.user && ['quote', 'care', 'inbox', 'jjj', 'wish'].includes(h)) return open(h);
    // 已登入又有長輩家：直接進 App 畫面
    if (LV.user && LV.hh && window.JJJLIVEAPI) return toApp('jjj');
  }

  window.JJJLIVEAPP = {
    loggedIn: () => !!LV.user,
    ready: () => LV.ready,
    summary: () => (LV.hh ? LV.hh.elder_name + '家' : LV.user ? '先建立長輩家' : ''),
    name: () => (LV.me && LV.me.display_name) || '',
    open, login, sb,
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
