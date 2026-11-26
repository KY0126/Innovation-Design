// 實用版企業管理端（/live/admin/）：員工編號登入、門市家庭清單、送出正式報價（P1）、記錄夜間關懷（P3）、試點指標
// 只在 ?mode=live 載入。生活顧問只看得到自己門市的家庭；總部看全部（列級權限把關）。
(function () {
  if (!window.JJJ_LIVE) return;
  const C = window.JJJ_LIVE_CFG;
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    db: { schema: 'jjj' },
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'jjj-live-staff' },
  });
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m) => (window.JJJLIVE ? window.JJJLIVE.toast(m) : alert(m));
  const ROLE = { advisor: '生活顧問', hq: '總部' };
  let ME = null;

  const CSS = `#lvAdm{position:fixed;inset:0;z-index:150;background:#F6F4F2;overflow:auto;font-family:inherit;color:#1F2328}
#lvAdm header{display:flex;align-items:center;gap:12px;padding:12px 20px;background:#fff;border-bottom:1px solid #E5E1DF}
#lvAdm header b{font-size:16px}#lvAdm header .sp{flex:1}
#lvAdm main{max-width:1100px;margin:0 auto;padding:16px 20px;display:flex;flex-direction:column;gap:14px}
#lvAdm .pn{background:#fff;border:1px solid #E5E1DF;border-radius:12px;padding:14px 16px}
#lvAdm table{width:100%;border-collapse:collapse;font-size:14px}#lvAdm th,#lvAdm td{text-align:left;padding:8px 6px;border-bottom:1px solid #EEE;vertical-align:top}
#lvAdm .b{border:1px solid #C8003A;background:#fff;color:#C8003A;border-radius:8px;padding:6px 12px;cursor:pointer;font:inherit;font-size:13px}
#lvAdm .b.pri{background:#C8003A;color:#fff}#lvAdm .mu{color:#6F6670;font-size:13px}
#lvAdm .kpi{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}#lvAdm .kpi div{background:#fff;border:1px solid #E5E1DF;border-radius:10px;padding:10px 12px}#lvAdm .kpi b{display:block;font-size:22px}
#lvAdm textarea,#lvAdm input{font:inherit;border:1px solid #D0D7DE;border-radius:8px;padding:6px 8px;width:100%;box-sizing:border-box}`;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  async function login(email, pw, er) {
    if (er) er.textContent = '';
    const { error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) { if (er) er.textContent = '員工編號或密碼不正確'; return; }
    if (!(await loadMe())) { await sb.auth.signOut(); if (er) er.textContent = '這個帳號不是員工帳號；家庭請用揪居家 App（手機）。'; return; }
    render();
  }
  async function loadMe() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data } = await sb.from('profiles').select('id, display_name, role, store').eq('id', session.user.id).maybeSingle();
    ME = data && (data.role === 'advisor' || data.role === 'hq') ? data : null;
    return ME;
  }
  async function call(action, body) {
    const { data: { session } } = await sb.auth.getSession();
    const r = await fetch(C.supabaseUrl + '/functions/v1/line-push', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.supabaseKey, Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify(Object.assign({ action }, body)),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || '沒有成功');
    return d;
  }
  const sent = (d) => `已通知 ${d.total} 人${d.line ? `（LINE 送出 ${d.sent} 則）` : '（LINE 推播金鑰尚未設定，只出現在 App 通知）'}`;

  async function render() {
    let root = document.getElementById('lvAdm');
    if (!root) { root = document.createElement('div'); root.id = 'lvAdm'; document.body.appendChild(root); }
    const [{ data: hhs }, { data: mem }, { data: as }, { data: cs }, { data: sl }] = await Promise.all([
      sb.from('households').select('id, elder_name, elder_note, store, stage, created_at').order('created_at', { ascending: false }),
      sb.from('members').select('household_id'),
      sb.from('assessments').select('household_id, result, dims, created_at').order('created_at', { ascending: false }),
      sb.from('consents').select('household_id'),
      ME.role === 'hq' ? sb.from('share_logs').select('kind') : Promise.resolve({ data: null }),
    ]);
    const H = hhs || [], cnt = (arr, id) => (arr || []).filter((x) => x.household_id === id).length;
    // 評估帶來的插座數與材質（家人一次量完時填；「待顧問確認」要到府確認）
    const MATN = { bath: '浴室地板', wall: '走廊牆面', door: '大門門框' };
    const aExtra = (a) => { const d = a.dims || {}, M = d.materials || {}, ks = Object.keys(M); const p = []; if (d.outlets != null) p.push(`插座 ${d.outlets} 個`); if (ks.length) p.push(ks.map((k) => `${MATN[k] || k}：${esc(M[k])}`).join('、')); return p.length ? `<div class="mu">${p.join('｜')}</div>` : ''; };
    const lastA = (id) => (as || []).find((a) => a.household_id === id);
    const doneA = new Set((as || []).map((a) => a.household_id)), doneC = new Set((cs || []).map((c) => c.household_id));
    const conv = doneA.size ? Math.round(([...doneC].filter((x) => doneA.has(x)).length / doneA.size) * 100) + '%' : '—';
    root.innerHTML = `<header><b>揪居家企業管理端</b><span style="color:#C8003A;font-size:13px">實用版</span><span class="sp"></span><span class="mu">${esc(ROLE[ME.role])}｜${esc(ME.display_name || '')}${ME.store ? '｜' + esc(ME.store) : ''}</span><button class="b" data-la="out">登出</button></header>
      <main><div class="kpi" aria-label="試點指標（真實資料）"><div><span class="mu">家庭數</span><b>${H.length}</b></div><div><span class="mu">完成評估</span><b>${doneA.size}</b></div><div><span class="mu">長輩同意</span><b>${doneC.size}</b></div><div><span class="mu">成交轉換率</span><b>${conv}</b></div><div><span class="mu">分享次數</span><b>${sl ? sl.length : '—'}</b></div></div>
      <div class="pn"><b>${ME.role === 'hq' ? '全部家庭' : '本門市家庭'}</b>${H.length ? `<table><thead><tr><th>長輩家</th><th>家人</th><th>最近評估</th><th>門市</th><th></th></tr></thead><tbody>${H.map((h) => { const a = lastA(h.id), L = a ? a.result.lights || [] : []; return `<tr><td><b>${esc(h.elder_name)}家</b><div class="mu">${esc(h.elder_note || '')}</div></td><td>${cnt(mem, h.id)} 人</td><td>${a ? `${L.filter((x) => x.c === 'r').length} 紅 ${L.filter((x) => x.c === 'y').length} 黃<div class="mu">${new Date(a.created_at).toLocaleDateString('zh-TW')}</div>${aExtra(a)}` : '<span class="mu">未評估</span>'}</td><td>${esc(h.store || '')}</td><td style="white-space:nowrap"><button class="b pri" data-la="quote" data-id="${h.id}" data-n="${esc(h.elder_name)}">送出正式報價</button> <button class="b" data-la="care" data-id="${h.id}">記錄夜間關懷</button></td></tr>`; }).join('')}</tbody></table>` : '<p class="mu">還沒有家庭。家庭用 LINE 登入揪居家 App、建立長輩家後就會出現在這裡。</p>'}</div>
      <div class="pn" id="lvQ" hidden></div></main>`;
  }
  function quoteForm(id, name) {
    const p = document.getElementById('lvQ'); p.hidden = false;
    p.innerHTML = `<b>送出正式報價｜${esc(name)}家</b><p class="mu">一行一個品項，格式「品名,金額」。送出後會通知這個家庭的全部成員，長輩同意後才成交。</p>
      <form id="lvQF" data-id="${id}"><textarea name="items" rows="5" placeholder="感應小夜燈｜床邊,690&#10;感應小夜燈｜走道,690&#10;浴室止滑條,450" required></textarea>
      <div style="display:flex;gap:8px;margin-top:8px"><button class="b pri" type="submit">送出正式報價並通知家人</button><button class="b" type="button" data-la="qx">取消</button></div><div class="mu" id="lvQE" role="alert"></div></form>`;
    p.scrollIntoView({ behavior: 'smooth' });
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('#lvAdm [data-la]'); if (!b) return;
    const a = b.dataset.la;
    try {
      if (a === 'out') { await sb.auth.signOut(); ME = null; document.getElementById('lvAdm').remove(); return; }
      if (a === 'quote') return quoteForm(Number(b.dataset.id), b.dataset.n);
      if (a === 'qx') { document.getElementById('lvQ').hidden = true; return; }
      if (a === 'care') { b.disabled = true; const d = await call('care', { household_id: Number(b.dataset.id) }); toast('已先問長輩；' + sent(d)); b.disabled = false; return; }
    } catch (err) { toast(err.message); b.disabled = false; }
  });
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'lvQF') return;
    e.preventDefault();
    const f = e.target, hid = Number(f.dataset.id), er = document.getElementById('lvQE');
    const items = f.items.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.lastIndexOf(','); return { name: l.slice(0, i).trim(), price: Number(l.slice(i + 1)) }; });
    if (!items.length || items.some((x) => !x.name || !(x.price >= 0))) { er.textContent = '每一行要寫「品名,金額」'; return; }
    const total = items.reduce((s, x) => s + x.price, 0);
    const { data: prev } = await sb.from('quotes').select('version').eq('household_id', hid).order('version', { ascending: false }).limit(1);
    const version = ((prev && prev[0] && prev[0].version) || 0) + 1;
    const { data: q, error } = await sb.from('quotes').insert({ household_id: hid, version, items, total, is_formal: true, advisor_id: ME.id }).select('id').single();
    if (error) { er.textContent = '送出失敗（只有本門市生活顧問可以送出報價）'; return; }
    try { const d = await call('quote', { quote_id: q.id }); toast(`第 ${version} 版正式報價已送出；` + sent(d)); } catch (err) { toast('報價已存，但通知失敗：' + err.message); }
    render();
  });

  window.JJJLIVEADM = { login };
  // 已登入過就直接進後台
  (async () => { if (await loadMe()) { const g = document.getElementById('gate'); if (g) g.hidden = true; render(); } })();
})();
