// 實用版：各家真實格局（docs/design/實用版_Live版全功能搬遷設計.md 3-1 節）
// 生活顧問到府量好每個房間的寬深、地板材質、天花高度，存進 jjj.floorplans；家人、技師的 2D 施工圖、3D 鳥瞰、夜間模擬改用這份格局。
// 做法：cad.js 的住宅模板是 3 排（上排臥室／浴室／洗衣陽台、中間走道、下排廚房／客廳＋玄關），
// 依顧問量的尺寸把模板座標分段等比例換算（牆、門窗、家具、電器、動線、裁切範圍一起換），2D、3D、夜間模擬不用重寫。
// 範圍（設計文件「要做」）：房間尺寸、地板材質、天花高度；門窗位置跟著房間移動；不做斜牆、多樓層。
(function () {
  if (!window.JJJ_LIVE) return;
  const XT = [0, 4000, 6200, 9000], XB = [0, 3800, 9000], YK = [0, 3500, 4600, 8000, 9000];
  const DEF = { bed: 4000, bath: 2200, ldy: 2800, kit: 3800, top: 3500, hall: 1100, bot: 3400, fin: { bed: 'wood', bath: 'tile', ldy: 'tile', hall: 'wood', kit: 'tile', liv: 'wood', door: 'tile' }, ceil: { bed: 2600, bath: 2400, ldy: 2600, hall: 2400, kit: 2400, liv: 2600, door: 2400 } };
  const NAME = { bed: '臥室', bath: '浴室', ldy: '洗衣陽台', hall: '走道', kit: '廚房', liv: '客廳', door: '玄關' };
  const LIM = { bed: [2400, 6000], bath: [1200, 3600], ldy: [1000, 4000], kit: [1800, 6000], top: [2400, 5500], hall: [800, 2000], bot: [2400, 5500] };
  let orig = null, cur = null;
  const C = () => window.JJJCAD;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  // 整理顧問輸入：限制合理範圍，客廳寬 = 總寬 − 廚房
  function norm(L) {
    const o = Object.assign({}, DEF, L || {});
    for (const k of Object.keys(LIM)) o[k] = Math.round(Math.max(LIM[k][0], Math.min(LIM[k][1], Number(o[k]) || DEF[k])) / 10) * 10;
    o.fin = Object.assign({}, DEF.fin, (L && L.fin) || {}); o.ceil = Object.assign({}, DEF.ceil, (L && L.ceil) || {});
    for (const k of Object.keys(o.fin)) if (!['wood', 'tile'].includes(o.fin[k])) o.fin[k] = DEF.fin[k];
    for (const k of Object.keys(o.ceil)) o.ceil[k] = Math.max(2100, Math.min(3600, Number(o.ceil[k]) || DEF.ceil[k]));
    const W = o.bed + o.bath + o.ldy; if (o.kit > W - 1800) o.kit = W - 1800;
    o.W = W; o.liv = W - o.kit;
    return o;
  }
  const pw = (v, K, K2) => { for (let i = 1; i < K.length; i++) if (v <= K[i] || i === K.length - 1) { const t = (v - K[i - 1]) / (K[i] - K[i - 1]); return K2[i - 1] + t * (K2[i] - K2[i - 1]); } return v; };
  function mapper(o) {
    const XT2 = [0, o.bed, o.bed + o.bath, o.W], XB2 = [0, o.kit, o.W], Y2 = [0, o.top, o.top + o.hall, o.top + o.hall + o.bot, o.top + o.hall + o.bot + 1000];
    return (x, y) => [Math.round(y <= 3500 ? pw(x, XT, XT2) : y >= 4600 ? pw(x, XB, XB2) : x * o.W / 9000), Math.round(pw(y, YK, Y2))];
  }
  // 換成某一家的格局（null = 回到範本）
  function apply(L) {
    const K = C(); if (!K) return false;
    if (!orig) orig = { ROOMS: clone(K.ROOMS), WALLS: clone(K.WALLS), WINS: clone(K.WINS), DOORS: clone(K.DOORS), FURN: clone(K.FURN), ELEC: clone(K.ELEC), CROP: clone(K.CROP || {}), ROUTE: clone(K.ROUTE || {}), TAGAT: clone(K.TAGAT || {}) };
    const O = orig; cur = L ? norm(L) : null;
    const M = cur ? mapper(cur) : (x, y) => [x, y];
    for (const [k, r] of Object.entries(O.ROOMS)) {
      const [x1, y1] = M(r[1], r[2]), [x2, y2] = M(r[1] + r[3], r[2] + r[4]);
      K.ROOMS[k].splice(0, 7, r[0], x1, y1, x2 - x1, y2 - y1, cur ? cur.fin[k] || r[5] : r[5], cur ? cur.ceil[k] || r[6] : r[6]);
    }
    O.WALLS.forEach((w, i) => { const [a, b] = M(w[0], w[1]), [c, d] = M(w[2], w[3]); K.WALLS[i].splice(0, 4, a, b, c, d); });
    O.WINS.forEach((w, i) => { const [a, b] = M(w[0], w[1]), [c, d] = M(w[2], w[3]); K.WINS[i].splice(0, 4, a, b, c, d); });
    O.DOORS.forEach((d, i) => { const [[hx, hy], dir, , w] = d, [a, b] = M(hx, hy), [e, f] = M(hx + dir[0] * w, hy + dir[1] * w); K.DOORS[i][0] = [a, b]; K.DOORS[i][3] = Math.max(600, Math.round(Math.hypot(e - a, f - b))); });
    O.FURN.forEach((f, i) => {
      const [cx, cy] = M(f[1] + f[3] / 2, f[2] + f[4] / 2), room = Object.entries(K.ROOMS).find(([, r]) => cx >= r[1] && cx <= r[1] + r[3] && cy >= r[2] && cy <= r[2] + r[4]);
      let x = cx - f[3] / 2, y = cy - f[4] / 2;
      if (room) { const r = room[1]; x = Math.max(r[1] + 60, Math.min(r[1] + r[3] - f[3] - 60, x)); y = Math.max(r[2] + 60, Math.min(r[2] + r[4] - f[4] - 60, y)); }
      K.FURN[i][1] = Math.round(x); K.FURN[i][2] = Math.round(y);
    });
    O.ELEC.forEach((e, i) => { const [a, b] = M(e[1], e[2]); K.ELEC[i][1] = a; K.ELEC[i][2] = b; });
    for (const [k, r] of Object.entries(O.CROP)) { const [a, b] = M(r[0], r[1]), [c, d] = M(r[2], r[3]); K.CROP[k].splice(0, 4, a, b, c, d); }
    for (const [k, R0] of Object.entries(O.ROUTE)) R0.forEach((p, i) => { const [a, b] = M(p[0], p[1]); K.ROUTE[k][i] = [a, b]; });
    for (const [k, p] of Object.entries(O.TAGAT)) { const [a, b] = M(p[0], p[1]); K.TAGAT[k] = [a, b]; }
    return true;
  }
  // 設備、作品零件的座標（範本 mm）換到這一家
  const mapItem = (it) => { if (!cur || !it || !Number.isFinite(+it.x)) return it; const [x, y] = mapper(cur)(+it.x, +it.y); return Object.assign({}, it, { x, y }); };
  // 揪心願（拼作品）是大家共用的範本房子，不套各家格局；其他畫面（施工圖、3D、夜間模擬）套自己家的
  let home = null;
  const wishView = () => { const S = window.JJJAPP && window.JJJAPP.S, v = S && S.stack && S.stack[S.stack.length - 1]; return /^w/.test(v || '') || v === 'pre'; };
  function sync() { const want = wishView() ? null : home; if (JSON.stringify(want) !== JSON.stringify(cur ? cur.__src : null)) { apply(want); if (cur) cur.__src = want; } }
  const mapAll = (items) => (cur ? (items || []).map(mapItem) : items);
  function hookPlan() {
    const K = C(); if (!K || K.__lvWrapped) return;
    const plan0 = K.plan, night0 = K.night, cov0 = K.coverage;
    K.plan = (f, items, o) => { sync(); return plan0(f, mapAll(items), o); };
    K.night = (f, items, id, o) => { sync(); return night0(f, mapAll(items), id, o); };
    K.coverage = (f, items) => { sync(); return cov0(f, mapAll(items)); };
    K.__lvWrapped = true;
  }
  function setHome(L) { home = L || null; if (C()) sync(); }
  function loadCad() {
    if (C()) { hookPlan(); return Promise.resolve(); }
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'cad.js?v=20261127b'; s.onload = () => { hookPlan(); res(); }; s.onerror = rej; document.head.appendChild(s); });
  }

  // ── 生活顧問的格局編輯器（門市電腦版、App 顧問模式都可以開） ──
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CSS = `.lvfp{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:inherit}
.lvfp>div{background:#fff;border-radius:14px;width:min(980px,96vw);max-height:94vh;overflow:auto;padding:16px 18px;color:#1F2328}
.lvfp h3{margin:0 0 4px;font-size:18px}.lvfp .mu{color:#6F6670;font-size:13px}
.lvfp .g{display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:16px;margin-top:10px}
.lvfp fieldset{border:1px solid #E5E1DF;border-radius:10px;padding:8px 10px;margin:0 0 8px}.lvfp legend{font-size:13px;font-weight:700;padding:0 4px}
.lvfp label{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;margin:4px 0}
.lvfp input,.lvfp select{font:inherit;font-size:13px;border:1px solid #D0D7DE;border-radius:8px;padding:4px 6px;width:96px}
.lvfp .pv{border:1px solid #E5E1DF;border-radius:10px;padding:6px;min-height:300px}.lvfp .pv svg{width:100%;height:auto}
.lvfp .bt{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}.lvfp .bt button{font:inherit;border-radius:8px;padding:8px 14px;cursor:pointer;border:1px solid #C8003A;background:#fff;color:#C8003A}
.lvfp .bt .pri{background:#C8003A;color:#fff}.lvfp .er{color:#C8003A;font-size:13px;min-height:18px}
@media (max-width:720px){.lvfp .g{grid-template-columns:1fr}}`;
  function css() { if (document.getElementById('lvfpCss')) return; const s = document.createElement('style'); s.id = 'lvfpCss'; s.textContent = CSS; document.head.appendChild(s); }
  const num = (k, v, lb) => `<label>${lb}<input type="number" step="10" min="${LIM[k][0]}" max="${LIM[k][1]}" data-k="${k}" value="${v}"> mm</label>`;
  async function editor(hid, onSaved) {
    css(); await loadCad();
    const api = async (p, o = {}) => { const r = await fetch('/api' + p, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: o.body ? JSON.stringify(o.body) : undefined }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || '沒有成功'); return d; };
    const d = await api('/advisor/floorplan/' + hid);
    let L = norm(d.layout || null);
    const m = document.createElement('div'); m.className = 'lvfp'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'lvfpT');
    const meas = d.measures || {};
    m.innerHTML = `<div><h3 id="lvfpT">${esc(d.household)}｜真實格局</h3><div class="mu">到府時用捲尺或 AR 量每個房間的內寬、內深（mm）。存檔後家人、技師看到的 2D 施工圖、3D 鳥瞰、夜間模擬都會換成這份格局。${meas.corridor_cm != null ? `家人 AR 量到走道寬 ${meas.corridor_cm} cm` : ''}${meas.threshold_cm != null ? `、浴室門檻 ${meas.threshold_cm} cm` : ''}</div>
      <div class="g"><form id="lvfpF" novalidate>
        <fieldset><legend>上排（臥室、浴室、洗衣陽台）</legend>${num('bed', L.bed, '臥室寬')}${num('bath', L.bath, '浴室寬')}${num('ldy', L.ldy, '洗衣陽台寬')}${num('top', L.top, '上排深')}</fieldset>
        <fieldset><legend>走道</legend>${num('hall', L.hall, '走道寬')}</fieldset>
        <fieldset><legend>下排（廚房、客廳）</legend>${num('kit', L.kit, '廚房寬')}<label>客廳寬<span id="lvfpLiv">${L.liv} mm</span></label>${num('bot', L.bot, '下排深')}</fieldset>
        <fieldset><legend>地板與天花高度</legend>${Object.keys(NAME).map((k) => `<label>${NAME[k]}<span style="display:flex;gap:4px"><select data-fin="${k}" aria-label="${NAME[k]}地板"><option value="wood" ${L.fin[k] === 'wood' ? 'selected' : ''}>木地板</option><option value="tile" ${L.fin[k] === 'tile' ? 'selected' : ''}>止滑磚</option></select><input type="number" step="10" min="2100" max="3600" data-ceil="${k}" value="${L.ceil[k]}" aria-label="${NAME[k]}天花高度（mm）" style="width:72px"></span></label>`).join('')}</fieldset>
        <label style="display:block">備註（不寫地址、門牌）<input name="note" maxlength="100" value="${esc(d.note || '')}" style="width:100%;margin-top:4px"></label>
      </form><div><div class="pv" id="lvfpPv" aria-label="格局預覽"></div><div class="mu" style="margin-top:6px">總寬 <b id="lvfpW">${L.W}</b> mm｜總深 <b id="lvfpD">${L.top + L.hall + L.bot + 1000}</b> mm（含玄關 1000）</div></div></div>
      <div class="er" role="alert" id="lvfpE"></div><div class="bt">${d.layout ? '<button type="button" data-x="reset">改回範本格局</button>' : ''}<button type="button" data-x="close">取消</button><button type="button" class="pri" data-x="save">存檔</button></div></div>`;
    document.body.appendChild(m);
    const prev = cur ? clone(cur) : null;
    const read = () => { const f = m.querySelector('#lvfpF'), o = { fin: {}, ceil: {} }; f.querySelectorAll('[data-k]').forEach((i) => { o[i.dataset.k] = +i.value; }); f.querySelectorAll('[data-fin]').forEach((i) => { o.fin[i.dataset.fin] = i.value; }); f.querySelectorAll('[data-ceil]').forEach((i) => { o.ceil[i.dataset.ceil] = +i.value; }); return norm(o); };
    const draw = () => { L = read(); apply(L); m.querySelector('#lvfpLiv').textContent = L.liv + ' mm'; m.querySelector('#lvfpW').textContent = L.W; m.querySelector('#lvfpD').textContent = L.top + L.hall + L.bot + 1000; m.querySelector('#lvfpPv').innerHTML = C().plan('全屋', [], { px: 560 }); };
    draw();
    m.addEventListener('input', draw);
    const close = () => { apply(prev); if (cur) cur.__src = prev && prev.__src; m.remove(); };
    m.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-x]'); if (!b) { if (e.target === m) close(); return; }
      const er = m.querySelector('#lvfpE'); er.textContent = '';
      try {
        if (b.dataset.x === 'close') return close();
        b.disabled = true;
        if (b.dataset.x === 'reset') { await api('/advisor/floorplan/' + hid, { method: 'DELETE' }); apply(null); m.remove(); if (onSaved) onSaved(null); return; }
        const lay = read(), note = m.querySelector('[name=note]').value.trim();
        if (/門牌|地址|號|巷|弄|路|街/.test(note)) { er.textContent = '備註不寫地址或門牌'; b.disabled = false; return; }
        const keep = { bed: lay.bed, bath: lay.bath, ldy: lay.ldy, kit: lay.kit, top: lay.top, hall: lay.hall, bot: lay.bot, fin: lay.fin, ceil: lay.ceil };
        await api('/advisor/floorplan/' + hid, { method: 'PUT', body: { layout: keep, note } });
        apply(keep); m.remove(); if (onSaved) onSaved(keep);
      } catch (x) { er.textContent = x.message; b.disabled = false; }
    });
    m.querySelector('input').focus();
  }
  window.JJJLAYOUT = { apply, norm, mapper, editor, loadCad, setHome, current: () => cur, home: () => home, DEF, NAME };
  (window.JJJHOOKS || (window.JJJHOOKS = [])).push(() => { if (C()) sync(); });
  if (C()) hookPlan(); else window.addEventListener('load', () => { if (C()) hookPlan(); });
})();
