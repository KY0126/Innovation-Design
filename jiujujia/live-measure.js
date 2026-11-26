// 實用版：真的用手機量尺寸（居家評估的走道寬、門檻高、床到浴室距離），並順路標插座、確認材質
// 和示範版 ar.js 同一套量法，改成獨立的全螢幕畫面，量完把數字交回呼叫的人：
//   1. Android（Chrome）：WebXR 找地面或牆邊，點起點、終點量距離；量高度時先點底部，再把準心往上移到頂端（約 ±1～3 cm）
//   2. iPhone 與其他手機：拍一張旁邊放了尺的照片，點尺上兩個刻度、輸入相差幾公分定比例，再點要量的兩端（約 ±3–5 cm，僅供參考）
//   3. 都不行：關掉回到表單手動填
// JJJMeasure.open()：量單一項；JJJMeasure.walk()：一次量完 3 項＋插座＋材質（示範版「AR 量測」的實用版）
// 不上傳照片、不存影像，只回傳數字與選項（docs/design/實用版_資料表權限與LINE循環.md M3）
(function () {
  if (!window.JJJ_LIVE) return;
  const REF_CM = 10; // 尺上兩個刻度預設相差 10 公分（可改）
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let xrOK = false;
  if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-ar').then((ok) => { xrOK = ok; }).catch(() => { xrOK = false; });

  // 一次量完的 3 項（順序同示範版：走道寬、門檻高、床到浴室）
  const ITEMS = [
    { key: 'corridor', label: '走道寬度', short: '走道寬', unit: 'cm', kind: 'dist' },
    { key: 'threshold', label: '浴室門檻高度', short: '門檻高', unit: 'cm', kind: 'height' },
    { key: 'dist', label: '床邊到浴室門口的距離', short: '床到浴室', unit: '公尺', kind: 'dist' },
  ];
  // 材質：影響安裝方式（家人點選，不確定交給生活顧問到府確認；不做 AI 判斷）
  const MATS = [
    { key: 'bath', name: '浴室地板', why: '止滑條貼法', opts: ['磁磚', '木地板', '塑膠地板', '石材'] },
    { key: 'wall', name: '走廊牆面', why: '夜燈固定方式', opts: ['水泥牆', '木板牆', '磁磚牆', '輕隔間'] },
    { key: 'door', name: '大門門框', why: '門窗感測器貼法', opts: ['鋁框', '木框', '鐵框'] },
  ];
  const UNSURE = '待顧問確認';
  const fmtU = (cm, unit) => (unit === '公尺' ? Math.round(cm / 10) / 10 : Math.round(cm * 2) / 2);

  const css = document.createElement('style');
  css.textContent = `.lvm{position:fixed;inset:0;z-index:90;background:#fff;display:flex;flex-direction:column;font-family:"Noto Sans TC",system-ui,sans-serif}
.lvm .lvm-top{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #eee}.lvm .lvm-top b{flex:1;font-size:17px}
.lvm .lvm-x{border:0;background:none;font:inherit;color:#D4003C;font-size:15px;cursor:pointer}
.lvm .lvm-body{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column}
.lvm .lvm-pad{padding:14px}.lvm .lvm-pad .btn{display:block;width:100%;margin-top:10px}
.lvm .armw{flex:1;min-height:0}.lvm .lvm-big{font-size:2.2em;font-weight:700;margin:6px 0}
.lvm .lvm-note{font-size:.85em;color:#6F6670;margin-top:8px;line-height:1.6}
.lvm .lvw-card{border:1px solid #e6e1e3;border-radius:12px;padding:10px 12px;margin-top:10px}
.lvm .lvw-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dashed #eee}.lvm .lvw-row:last-child{border-bottom:0}
.lvm .lvw-row>span{flex:1}.lvm .lvw-row b{min-width:72px;text-align:right}
.lvm .lvw-sm{border:1px solid #ccc;background:#fff;border-radius:8px;padding:5px 10px;font:inherit;font-size:.85em;cursor:pointer}
.lvm .lvw-mat{border:1px solid #eee;border-radius:10px;padding:8px 10px;margin-top:8px}
.lvm .lvw-mat .h{display:flex;gap:6px;align-items:center}.lvm .lvw-mat .tg{background:#FFF1F4;color:#D4003C;border-radius:8px;padding:1px 6px;font-size:.78em}
.lvm .lvw-ops{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.lvm .lvw-ops button{border:1px solid #ccc;background:#fff;border-radius:8px;padding:5px 10px;font:inherit;font-size:.85em;cursor:pointer}
.lvm .lvw-ops button[aria-pressed="true"]{background:#2E9E6A;border-color:#2E9E6A;color:#fff}
.xrov .xrchips{position:absolute;left:12px;right:12px;top:62px;display:flex;gap:4px}
.xrov .xrchips i{flex:1;font-style:normal;font-size:12px;text-align:center;border-radius:12px;padding:4px 0;background:rgba(20,18,22,.55)}
.xrov .xrchips i.dn{background:#2E9E6A}.xrov .xrchips i.cu{background:#D4003C}
.xrov.xrm .xrh{top:100px}.xrov .xrrow{display:flex;gap:8px;min-height:36px}
.xrov .xrsb{pointer-events:auto;border:0;background:#fff;color:#222;border-radius:18px;padding:9px 14px;font:inherit;font-size:14px;font-weight:700}`;
  document.head.appendChild(css);

  // ── WebXR 量測（Android Chrome）：可連續量多項；距離＝兩點直線，高度＝底部點到正上方的垂直距離 ──
  // 回傳 { vals: { key: 公分 }, outlets: 個數, done: 是否全部量完 }，AR 無法啟動時回傳 null；只存數字
  async function runXR({ items, title, outlets: withOutlets, onEnd }) {
    const R = { vals: {}, outlets: 0, done: false };
    const multi = items.length > 1;
    const ov = document.createElement('div'); ov.className = multi ? 'xrov xrm' : 'xrov';
    ov.innerHTML = `<canvas class="xrc" id="lvxc"></canvas><div class="xrtop"><span>${esc(title)}</span><button class="xrb" id="lvxx">${multi ? '結束' : '取消'}</button></div>${multi ? '<div class="xrchips" id="lvxch"></div>' : ''}<div class="xrh" id="lvxh">慢慢移動手機，對著地面或牆邊找平面…</div><div class="xrbot"><button class="xrgo" id="lvxgo" aria-label="放點"></button><div class="xrrow">${withOutlets ? '<button class="xrsb" id="lvxol">＋ 標插座（0）</button>' : ''}<button class="xrsb" id="lvxre" hidden>重點這一項</button></div></div>`;
    document.body.appendChild(ov);
    let s, ref, viewer, hts, gl;
    try {
      s = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: ov } });
      const cv = document.createElement('canvas'); gl = cv.getContext('webgl', { xrCompatible: true });
      s.updateRenderState({ baseLayer: new XRWebGLLayer(s, gl) });
      ref = await s.requestReferenceSpace('local'); viewer = await s.requestReferenceSpace('viewer');
      // 'point' 讓準心也能落在牆邊、門框等不是大平面的地方
      try { hts = await s.requestHitTestSource({ space: viewer, entityTypes: ['plane', 'point'] }); } catch (e) { hts = await s.requestHitTestSource({ space: viewer }); }
    } catch (e) { ov.remove(); try { s && s.end(); } catch (e2) {} onEnd(null); return; }
    const x = { i: 0, pts: [], cur: null, h: null, marks: [], ended: false, found: false };
    const $ = (id) => document.getElementById(id), hint = (t) => { const h = $('lvxh'); if (h) h.innerHTML = t; };
    const it = () => items[x.i];
    const chips = () => { const c = $('lvxch'); if (c) c.innerHTML = items.map((m, k) => `<i class="${k < x.i ? 'dn' : k === x.i ? 'cu' : ''}">${esc(m.short || m.label)}${k < x.i ? ' ✓' : ''}</i>`).join(''); };
    const startHint = () => (it().kind === 'height' ? `量<b>高度</b>：把準心對到${esc(it().label.replace('高度', ''))}的<b>底部</b>（貼地面），點一下。` : `把白色準心對到${esc(it().label)}的<b>一端</b>，點一下放起點。`);
    const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) * 100;
    const next = (cm) => {
      R.vals[it().key] = Math.max(0, cm); x.pts = []; x.h = null; x.i++;
      const re = $('lvxre'); if (re) re.hidden = true;
      if (x.i >= items.length) { R.done = true; s.end(); return; }
      chips(); hint(`${esc(items[x.i - 1].short || items[x.i - 1].label)}量好了。下一項：${startHint()}`);
    };
    const place = () => {
      if (x.ended) return;
      const m = it();
      if (m.kind === 'height' && x.pts.length === 1) { if (x.h == null) { hint('把手機稍微拿遠，讓準心能沿著門檻往上移'); return; } next(x.h); return; }
      if (!x.cur) { hint('還沒找到平面，慢慢移動手機'); return; }
      x.pts.push(x.cur); const re = $('lvxre'); if (re) re.hidden = false;
      if (x.pts.length === 1) hint(m.kind === 'height' ? '已點底部。把準心往上移到<b>頂端</b>，再點一下。' : `已放起點。把準心移到${esc(m.label)}的<b>另一端</b>，再點一下放終點。`);
      else next(dist(x.pts[0], x.pts[1]));
    };
    $('lvxx').onclick = () => s.end();
    $('lvxgo').onclick = place;
    const re = $('lvxre'); if (re) re.onclick = () => { x.pts = []; x.h = null; re.hidden = true; hint(startHint()); };
    const ol = $('lvxol'); if (ol) ol.onclick = () => { R.outlets++; x.marks.push(x.cur); ol.textContent = `＋ 標插座（${R.outlets}）`; hint(`已標第 ${R.outlets} 個插座。${startHint()}`); };
    ov.addEventListener('beforexrselect', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    s.addEventListener('select', place);
    s.addEventListener('end', () => { x.ended = true; ov.remove(); onEnd(R); });
    chips();
    const mul = (M, v) => [0, 1, 2, 3].map((r) => M[r] * v[0] + M[4 + r] * v[1] + M[8 + r] * v[2] + M[12 + r] * v[3]);
    const label = (g, tx, mx, my, bg) => { g.font = '700 16px "Noto Sans TC",sans-serif'; const tw = g.measureText(tx).width + 20; g.fillStyle = bg || 'rgba(20,18,22,.82)'; g.beginPath(); if (g.roundRect) g.roundRect(mx - tw / 2, my - 15, tw, 30, 8); else g.rect(mx - tw / 2, my - 15, tw, 30); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tx, mx, my); };
    const oc = $('lvxc'), g = oc.getContext('2d');
    const onFrame = (t, fr) => {
      if (x.ended) return; s.requestAnimationFrame(onFrame);
      const L = s.renderState.baseLayer; gl.bindFramebuffer(gl.FRAMEBUFFER, L.framebuffer); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      const HR = fr.getHitTestResults(hts);
      if (HR.length) { const p = HR[0].getPose(ref).transform.position; x.cur = { x: p.x, y: p.y, z: p.z }; } else x.cur = null;
      const pose = fr.getViewerPose(ref);
      const W = innerWidth, H = innerHeight, dpr = devicePixelRatio || 1;
      if (oc.width !== Math.round(W * dpr)) { oc.width = Math.round(W * dpr); oc.height = Math.round(H * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      if (!pose) return;
      const v = pose.views[0], P = v.projectionMatrix, Vi = v.transform.inverse.matrix;
      const pr = (q) => { const c = mul(P, mul(Vi, [q.x, q.y, q.z, 1])); if (c[3] <= 0) return null; return [(c[0] / c[3] * 0.5 + 0.5) * W, (1 - (c[1] / c[3] * 0.5 + 0.5)) * H]; };
      const dot = (q) => { const s2 = pr(q); if (!s2) return; g.beginPath(); g.arc(s2[0], s2[1], 8, 0, 7); g.fillStyle = '#D4003C'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); };
      const seg = (A, B, txt) => { const A2 = pr(A), B2 = pr(B); if (!A2 || !B2) return; g.setLineDash([8, 6]); g.lineWidth = 3; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(...A2); g.lineTo(...B2); g.stroke(); g.setLineDash([]); label(g, txt, (A2[0] + B2[0]) / 2, (A2[1] + B2[1]) / 2 - 26); };
      x.marks.forEach((q, k) => { const s2 = q && pr(q); if (s2) label(g, `插座 ${k + 1}`, s2[0], s2[1], 'rgba(255,122,156,.92)'); });
      const m = it();
      if (m && x.pts.length === 1) {
        const A = x.pts[0];
        if (m.kind === 'height') {
          // 高度：相機視線與「底部點正上方的垂直線」最接近的位置，就是準心對到的高度
          const T = pose.transform.matrix, o = { x: T[12], y: T[13], z: T[14] }, d = { x: -T[8], y: -T[9], z: -T[10] };
          const w0 = { x: A.x - o.x, y: A.y - o.y, z: A.z - o.z }, b = d.y, den = 1 - b * b;
          if (den > 0.02) { const e = d.x * w0.x + d.y * w0.y + d.z * w0.z, sv = (b * e - w0.y) / den; x.h = Math.max(0, sv * 100); }
          if (x.h != null) seg(A, { x: A.x, y: A.y + x.h / 100, z: A.z }, `約 ${Math.round(x.h * 2) / 2} cm`);
        } else if (x.cur) seg(A, x.cur, `約 ${fmtU(dist(A, x.cur), m.unit)} ${m.unit}`);
      }
      x.pts.forEach(dot);
      if (x.cur && !(m && m.kind === 'height' && x.pts.length === 1)) {
        const ring = []; for (let k = 0; k <= 32; k++) { const th = k / 32 * Math.PI * 2; ring.push(pr({ x: x.cur.x + Math.cos(th) * 0.06, y: x.cur.y, z: x.cur.z + Math.sin(th) * 0.06 })); }
        if (ring.every(Boolean)) { g.beginPath(); ring.forEach((q, k) => (k ? g.lineTo(...q) : g.moveTo(...q))); g.closePath(); g.fillStyle = 'rgba(255,255,255,.15)'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke(); }
        if (!x.found && !x.pts.length) { x.found = true; hint(`找到平面了。${startHint()}`); }
      }
    };
    s.requestAnimationFrame(onFrame);
  }

  // ── 量單一項 ──
  function open(opt) {
    // opt: { key, label, unit: 'cm'|'公尺', xrFit, kind: 'dist'|'height', onDone(value, mode) }
    const st = { step: 'pick', pts: [], card: null, cardPx: 0, tgt: null, val: null, mode: null };
    let stream = null, img = null;
    const box = document.createElement('div'); box.className = 'lvm'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '用手機量' + opt.label);
    document.body.appendChild(box);
    const fmt = (cm) => fmtU(cm, opt.unit);
    const stop = () => { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } };
    const close = () => { stop(); box.remove(); };
    const height = opt.kind === 'height';

    function render() {
      const top = `<div class="lvm-top"><b>用手機量｜${esc(opt.label)}</b><button class="lvm-x" data-m="close">關閉</button></div>`;
      let body = '';
      if (st.step === 'pick') {
        const canXR = xrOK && opt.xrFit;
        body = `<div class="lvm-pad">
          ${canXR ? `<button class="btn" data-m="xr">${height ? '用 AR 量（點底部，再對到頂端）' : '用 AR 量（點起點、終點）'}</button>` : ''}
          <button class="btn ${canXR ? 'ghost' : ''}" data-m="cam">拍照量（旁邊放一把尺當比例尺）</button>
          <label class="btn ghost" style="text-align:center">從相簿選照片<input type="file" accept="image/*" capture="environment" data-mfile="1" hidden></label>
          <div class="lvm-note">${canXR ? '這支手機支援 AR 量測。' : opt.xrFit ? '這支手機的瀏覽器不支援網頁 AR（iPhone 的 Safari 目前都不支援），請用拍照量。' : ''}${height ? '拍照量時，尺要立在門檻旁邊。' : ''}照片只在手機上計算，不上傳、不存。</div></div>`;
      } else if (st.step === 'live') {
        body = `<div class="armw"><video id="lvmV" autoplay playsinline muted></video><div class="armh">把尺或捲尺貼著要量的東西放好，刻度要拍清楚</div></div><div class="lvm-pad"><button class="btn" data-m="shot">拍照</button><button class="btn ghost" data-m="pick">取消</button></div>`;
      } else if (st.step === 'ref') {
        body = `<div class="armw"><canvas id="lvmC"></canvas><div class="armh">② 這兩個刻度相差幾公分？</div></div><div class="lvm-pad"><label class="muted" style="display:block">尺上兩點相差（公分）<input class="fld" id="lvmRef" type="number" inputmode="decimal" min="1" max="500" step="0.5" value="${st.refCm || REF_CM}"></label><button class="btn" data-m="ref">下一步</button><button class="btn ghost" data-m="recard">重點刻度</button></div>`;
      } else if (st.step === 'card' || st.step === 'target') {
        const hint = st.step === 'card' ? `① 點尺上<b>兩個刻度</b>（例如 0 和 10 公分）（${st.pts.length}／2）` : `③ 點要量的${esc(opt.label)}兩端（${st.pts.length}／2）`;
        body = `<div class="armw"><canvas id="lvmC" data-m="tap"></canvas><div class="armh">${hint}</div></div><div class="lvm-pad">${st.pts.length ? '<button class="btn ghost" data-m="undo">重點這一步</button>' : ''}<button class="btn ghost" data-m="pick">重新拍</button></div>`;
      } else if (st.step === 'xr') {
        body = `<div class="lvm-pad" style="text-align:center"><b>AR 量測中</b><div class="lvm-note">${height ? '先點底部，再把準心往上移到頂端點一下。' : '出現圓圈後點一下放起點，再點一下放終點。'}</div><button class="btn ghost" data-m="pick">取消</button></div>`;
      } else {
        body = `<div class="lvm-pad" style="text-align:center"><div class="muted">${esc(opt.label)}</div><div class="lvm-big">約 ${fmt(st.val)} ${esc(opt.unit)}</div>
          <div class="lvm-note">${st.mode === 'xr' ? 'AR 實測｜約 ±1～3 cm｜不拍照、不存影像，只存這個數字' : '照片比例尺｜約 ±3–5 cm，僅供參考；生活顧問到府會再複量'}</div>
          <button class="btn" data-m="use">使用這個數字</button><button class="btn ghost" data-m="pick">重新量</button></div>
          ${img && st.mode === 'photo' ? '<div class="armw" style="flex:none"><canvas id="lvmC"></canvas></div>' : ''}`;
      }
      box.innerHTML = top + `<div class="lvm-body">${body}</div>`;
      const vd = box.querySelector('#lvmV'); if (vd && stream) vd.srcObject = stream;
      const c = box.querySelector('#lvmC'); if (c && img) draw(c);
    }
    function draw(c) {
      const w = img.width, h = img.height; c.width = w; c.height = h;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const r = Math.max(6, w / 90), lw = Math.max(3, w / 220);
      const pair = (P, col) => { P.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = lw / 1.5; g.strokeStyle = '#fff'; g.stroke(); }); if (P.length === 2) { g.beginPath(); g.moveTo(...P[0]); g.lineTo(...P[1]); g.strokeStyle = col; g.lineWidth = lw; g.stroke(); } };
      if (st.card) pair(st.card, '#2F6FDB');
      pair(st.step === 'card' || st.step === 'target' ? st.pts : (st.tgt || []), '#D4003C');
    }
    async function openCam() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { alertMsg('這個瀏覽器不能開相機，請從相簿選照片'); return; }
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false }); st.step = 'live'; st.mode = 'photo'; render(); }
      catch (e) { alertMsg('沒有取得相機權限，請從相簿選照片或關閉後手動填'); }
    }
    function alertMsg(m) { const n = box.querySelector('.lvm-note'); if (n) n.textContent = m; }
    function shot() {
      const vd = box.querySelector('#lvmV'); if (!vd || !vd.videoWidth) return;
      const c = document.createElement('canvas'); c.width = vd.videoWidth; c.height = vd.videoHeight; c.getContext('2d').drawImage(vd, 0, 0);
      img = c; stop(); st.step = 'card'; st.pts = []; st.card = null; render();
    }
    function fromFile(file) {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { const c = document.createElement('canvas'); const s = Math.min(1, 1920 / Math.max(im.width, im.height)); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); img = c; URL.revokeObjectURL(u); st.mode = 'photo'; st.step = 'card'; st.pts = []; st.card = null; render(); };
      im.onerror = () => alertMsg('讀不到這張照片');
      im.src = u;
    }
    function tap(e, c) {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) * c.width / r.width, y = (e.clientY - r.top) * c.height / r.height;
      st.pts.push([x, y]);
      if (st.pts.length === 2) {
        const d = Math.hypot(st.pts[0][0] - st.pts[1][0], st.pts[0][1] - st.pts[1][1]);
        if (st.step === 'card') { if (d < 20) { st.pts = []; render(); return; } st.card = st.pts; st.cardPx = d; st.pts = []; st.step = 'ref'; }
        else { st.tgt = st.pts; st.val = d / st.cardPx * (st.refCm || REF_CM); st.pts = []; st.step = 'done'; }
      }
      render();
    }
    function startXR() {
      st.step = 'xr'; st.mode = 'xr'; render();
      runXR({ items: [{ key: opt.key, label: opt.label, unit: opt.unit, kind: opt.kind || 'dist' }], title: opt.label, onEnd: (r) => {
        if (!box.isConnected) return;
        if (!r) { st.step = 'pick'; render(); alertMsg('無法啟動 AR，請改用拍照量'); return; }
        if (r.vals[opt.key] != null) { st.val = r.vals[opt.key]; st.step = 'done'; } else st.step = 'pick';
        render();
      } });
    }

    box.addEventListener('click', (e) => {
      const t = e.target.closest('[data-m]'); if (!t) return;
      const m = t.dataset.m;
      if (m === 'close') close();
      else if (m === 'xr') startXR();
      else if (m === 'cam') openCam();
      else if (m === 'shot') shot();
      else if (m === 'pick') { stop(); st.step = 'pick'; st.pts = []; st.card = null; st.tgt = null; render(); }
      else if (m === 'undo') { st.pts = []; render(); }
      else if (m === 'recard') { st.pts = []; st.card = null; st.step = 'card'; render(); }
      else if (m === 'ref') { const v = Number((box.querySelector('#lvmRef') || {}).value); if (!(v > 0)) { alertMsg('請輸入兩個刻度相差幾公分'); return; } st.refCm = v; st.step = 'target'; render(); }
      else if (m === 'tap') tap(e, t);
      else if (m === 'use') { const v = fmt(st.val), mode = st.mode; close(); opt.onDone && opt.onDone(v, mode); }
    });
    box.addEventListener('change', (e) => { if (e.target.dataset && e.target.dataset.mfile && e.target.files[0]) fromFile(e.target.files[0]); });
    render();
  }

  // ── 一次量完：3 項依序（AR 連續量，或每項拍照量）＋沿路插座＋材質確認，最後一起帶回評估表 ──
  function walk(opt) {
    // opt: { init: { vals:{key:表單單位的數字}, modes, outlets, mats }, onDone({ vals, modes, outlets, mats }) }
    const I = opt.init || {};
    const S = { vals: Object.assign({}, I.vals), modes: Object.assign({}, I.modes), outlets: I.outlets || 0, mats: Object.assign({}, I.mats) };
    const box = document.createElement('div'); box.className = 'lvm'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '用手機一次量完');
    document.body.appendChild(box);
    const left = () => ITEMS.filter((m) => S.vals[m.key] == null);
    const note = (t) => { const n = box.querySelector('.lvm-note'); if (n) n.textContent = t; };
    function render() {
      const L = left();
      const rows = ITEMS.map((m) => `<div class="lvw-row"><span>${esc(m.label)}</span><b data-wv="${m.key}">${S.vals[m.key] != null ? `${S.vals[m.key]} ${esc(m.unit)}` : '<span class="muted">未量</span>'}</b><button type="button" class="lvw-sm" data-w="one" data-k="${m.key}">${S.vals[m.key] != null ? '重量' : '量'}</button></div>`).join('')
        + `<div class="lvw-row"><span>沿路可用插座</span><button type="button" class="lvw-sm" data-w="ol-" aria-label="插座減一">－</button><b data-wv="outlets" style="min-width:44px;text-align:center">${S.outlets} 個</b><button type="button" class="lvw-sm" data-w="ol+" aria-label="插座加一">＋</button></div>`;
      const mats = MATS.map((m) => { const v = S.mats[m.key]; return `<div class="lvw-mat"><div class="h"><b>${esc(m.name)}</b><span class="tg">${esc(m.why)}</span></div><div class="lvw-ops">${m.opts.concat(['不確定']).map((o) => { const val = o === '不確定' ? UNSURE : o; return `<button type="button" data-w="mat" data-k="${m.key}" data-v="${esc(val)}" aria-pressed="${v === val}">${esc(o)}</button>`; }).join('')}</div></div>`; }).join('');
      const nm = MATS.filter((m) => S.mats[m.key]).length;
      box.innerHTML = `<div class="lvm-top"><b>用手機一次量完</b><button class="lvm-x" data-w="close">關閉</button></div><div class="lvm-body"><div class="lvm-pad">
        ${xrOK ? `<button class="btn" data-w="xr">${L.length === ITEMS.length ? '開始 AR 量測（3 項依序）' : L.length ? `繼續 AR 量剩下 ${L.length} 項` : '用 AR 全部重量'}</button><div class="lvm-note">依序量走道寬、門檻高、床到浴室；經過插座時按「＋ 標插座」。</div>`
          : '<div class="lvm-note">這支手機的瀏覽器不支援網頁 AR（iPhone 的 Safari 目前都不支援），每一項按「量」用拍照量，插座用＋－記數。</div>'}
        <div class="lvw-card">${rows}</div>
        <div class="lvw-card"><b>材質確認</b><span class="muted" style="font-size:.85em">　已選 ${nm}／${MATS.length}・不確定可交給生活顧問到府確認</span>${mats}</div>
        <button class="btn" data-w="use">帶入評估表</button>
        <div class="muted" style="font-size:.85em;margin-top:8px;line-height:1.6">只存數字與選項，不存照片、不上傳影像。沒量的項目可以回到評估表用捲尺量好直接填。</div>
      </div></div>`;
    }
    box.addEventListener('click', (e) => {
      const t = e.target.closest('[data-w]'); if (!t) return;
      const w = t.dataset.w;
      if (w === 'close') box.remove();
      else if (w === 'ol+') { S.outlets = Math.min(20, S.outlets + 1); render(); }
      else if (w === 'ol-') { S.outlets = Math.max(0, S.outlets - 1); render(); }
      else if (w === 'mat') { const k = t.dataset.k; if (S.mats[k] === t.dataset.v) delete S.mats[k]; else S.mats[k] = t.dataset.v; render(); }
      else if (w === 'one') {
        const m = ITEMS.find((q) => q.key === t.dataset.k);
        open({ key: m.key, label: m.label, unit: m.unit, kind: m.kind, xrFit: true, onDone: (v, mode) => { S.vals[m.key] = v; S.modes[m.key] = mode; render(); } });
      } else if (w === 'xr') {
        const todo = left().length ? left() : ITEMS;
        runXR({ items: todo, title: '一次量完', outlets: true, onEnd: (r) => {
          if (!box.isConnected) return;
          if (!r) { render(); note('無法啟動 AR，請每一項改用拍照量'); return; }
          todo.forEach((m) => { if (r.vals[m.key] != null) { S.vals[m.key] = fmtU(r.vals[m.key], m.unit); S.modes[m.key] = 'xr'; } });
          S.outlets = Math.min(20, S.outlets + r.outlets); render();
        } });
      } else if (w === 'use') { box.remove(); opt.onDone && opt.onDone({ vals: S.vals, modes: S.modes, outlets: S.outlets, mats: S.mats }); }
    });
    render();
  }

  window.JJJMeasure = { open, walk, REF_CM, ITEMS, MATS, UNSURE };
})();
