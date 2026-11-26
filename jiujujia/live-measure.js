// 實用版：真的用手機量尺寸（居家評估的走道寬、門檻高、床到浴室距離）
// 和示範版 ar.js 同一套量法，改成獨立的全螢幕畫面，量完把數字交回呼叫的人：
//   1. Android（Chrome）：WebXR 偵測地面，點起點、終點量距離（約 ±1～3 cm）
//   2. iPhone 與其他手機：拍一張旁邊放了尺的照片，點尺上兩個刻度、輸入相差幾公分定比例，再點要量的兩端（約 ±3–5 cm，僅供參考）
//   3. 都不行：關掉回到表單手動填
// 不上傳照片、不存影像，只回傳一個數字（docs/design/實用版_資料表權限與LINE循環.md M3）
(function () {
  if (!window.JJJ_LIVE) return;
  const REF_CM = 10; // 尺上兩個刻度預設相差 10 公分（可改）
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let xrOK = false;
  if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-ar').then((ok) => { xrOK = ok; }).catch(() => { xrOK = false; });

  const css = document.createElement('style');
  css.textContent = `.lvm{position:fixed;inset:0;z-index:90;background:#fff;display:flex;flex-direction:column;font-family:"Noto Sans TC",system-ui,sans-serif}
.lvm .lvm-top{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #eee}.lvm .lvm-top b{flex:1;font-size:17px}
.lvm .lvm-x{border:0;background:none;font:inherit;color:#D4003C;font-size:15px;cursor:pointer}
.lvm .lvm-body{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column}
.lvm .lvm-pad{padding:14px}.lvm .lvm-pad .btn{display:block;width:100%;margin-top:10px}
.lvm .armw{flex:1;min-height:0}.lvm .lvm-big{font-size:2.2em;font-weight:700;margin:6px 0}
.lvm .lvm-note{font-size:.85em;color:#6F6670;margin-top:8px;line-height:1.6}`;
  document.head.appendChild(css);

  function open(opt) {
    // opt: { key, label, unit: 'cm'|'公尺', xrFit, onDone(value, mode) }
    const st = { step: 'pick', pts: [], card: null, cardPx: 0, tgt: null, val: null, mode: null };
    let stream = null, img = null, xr = null;
    const box = document.createElement('div'); box.className = 'lvm'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '用手機量' + opt.label);
    document.body.appendChild(box);
    const fmt = (cm) => (opt.unit === '公尺' ? Math.round(cm / 10) / 10 : Math.round(cm * 2) / 2);
    const stop = () => { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } };
    const close = () => { stop(); if (xr) { try { xr.s.end(); } catch (e) {} } box.remove(); };

    function render() {
      const top = `<div class="lvm-top"><b>用手機量｜${esc(opt.label)}</b><button class="lvm-x" data-m="close">關閉</button></div>`;
      let body = '';
      if (st.step === 'pick') {
        const canXR = xrOK && opt.xrFit;
        body = `<div class="lvm-pad">
          ${canXR ? '<button class="btn" data-m="xr">用 AR 量（點起點、終點）</button>' : ''}
          <button class="btn ${canXR ? 'ghost' : ''}" data-m="cam">拍照量（旁邊放一把尺當比例尺）</button>
          <label class="btn ghost" style="text-align:center">從相簿選照片<input type="file" accept="image/*" capture="environment" data-mfile="1" hidden></label>
          <div class="lvm-note">${canXR ? '這支手機支援 AR 量測。' : opt.xrFit ? '這支手機的瀏覽器不支援網頁 AR（iPhone 的 Safari 目前都不支援），請用拍照量。' : '門檻高度建議用拍照量：尺立在門檻旁。'}照片只在手機上計算，不上傳、不存。</div></div>`;
      } else if (st.step === 'live') {
        body = `<div class="armw"><video id="lvmV" autoplay playsinline muted></video><div class="armh">把尺或捲尺貼著要量的東西放好，刻度要拍清楚</div></div><div class="lvm-pad"><button class="btn" data-m="shot">拍照</button><button class="btn ghost" data-m="pick">取消</button></div>`;
      } else if (st.step === 'ref') {
        body = `<div class="armw"><canvas id="lvmC"></canvas><div class="armh">② 這兩個刻度相差幾公分？</div></div><div class="lvm-pad"><label class="muted" style="display:block">尺上兩點相差（公分）<input class="fld" id="lvmRef" type="number" inputmode="decimal" min="1" max="500" step="0.5" value="${st.refCm || REF_CM}"></label><button class="btn" data-m="ref">下一步</button><button class="btn ghost" data-m="recard">重點刻度</button></div>`;
      } else if (st.step === 'card' || st.step === 'target') {
        const hint = st.step === 'card' ? `① 點尺上<b>兩個刻度</b>（例如 0 和 10 公分）（${st.pts.length}／2）` : `③ 點要量的${esc(opt.label)}兩端（${st.pts.length}／2）`;
        body = `<div class="armw"><canvas id="lvmC" data-m="tap"></canvas><div class="armh">${hint}</div></div><div class="lvm-pad">${st.pts.length ? '<button class="btn ghost" data-m="undo">重點這一步</button>' : ''}<button class="btn ghost" data-m="pick">重新拍</button></div>`;
      } else if (st.step === 'xr') {
        body = `<div class="lvm-pad" style="text-align:center"><b>AR 量測中</b><div class="lvm-note">慢慢移動手機找地面，出現圓圈後點一下放起點，再點一下放終點。</div><button class="btn ghost" data-m="pick">取消</button></div>`;
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

    // WebXR（Android Chrome）：白色準心、起點紅點、虛線與即時距離；只存兩點距離
    async function startXR() {
      st.step = 'xr'; st.mode = 'xr'; render();
      let ov;
      try {
        ov = document.createElement('div'); ov.className = 'xrov';
        ov.innerHTML = `<canvas class="xrc" id="lvxc"></canvas><div class="xrtop"><span>${esc(opt.label)}</span><button class="xrb" id="lvxx">取消</button></div><div class="xrh" id="lvxh">慢慢移動手機，對著地面找平面…</div><div class="xrbot"><button class="xrgo" id="lvxgo" aria-label="放點"></button><span id="lvxsub">點畫面任何地方也可以放點</span></div>`;
        document.body.appendChild(ov);
        const s = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: ov } });
        xr = { s, pts: [], cur: null };
        const cv = document.createElement('canvas'), gl = cv.getContext('webgl', { xrCompatible: true });
        s.updateRenderState({ baseLayer: new XRWebGLLayer(s, gl) });
        const ref = await s.requestReferenceSpace('local'), viewer = await s.requestReferenceSpace('viewer'), hts = await s.requestHitTestSource({ space: viewer });
        const $ = (id) => document.getElementById(id), hint = (t) => { const h = $('lvxh'); if (h) h.innerHTML = t; };
        const oc = $('lvxc'), g = oc.getContext('2d');
        const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) * 100;
        const place = () => {
          if (!xr || !xr.cur) { hint('還沒找到地面，慢慢移動手機'); return; }
          xr.pts.push(xr.cur);
          if (xr.pts.length === 1) hint(`已放起點。把準心移到${esc(opt.label)}的<b>另一端</b>，再點一下放終點。`);
          else { st.val = dist(xr.pts[0], xr.pts[1]); st.step = 'done'; s.end(); }
        };
        $('lvxx').onclick = () => s.end();
        $('lvxgo').onclick = place;
        ov.addEventListener('beforexrselect', (e) => { if (e.target.closest('button')) e.preventDefault(); });
        s.addEventListener('select', place);
        s.addEventListener('end', () => { ov.remove(); xr = null; if (st.step === 'xr') st.step = 'pick'; if (box.isConnected) render(); });
        const mul = (M, v) => [0, 1, 2, 3].map((r) => M[r] * v[0] + M[4 + r] * v[1] + M[8 + r] * v[2] + M[12 + r] * v[3]);
        const onFrame = (t, fr) => {
          if (!xr) return; s.requestAnimationFrame(onFrame);
          const L = s.renderState.baseLayer; gl.bindFramebuffer(gl.FRAMEBUFFER, L.framebuffer); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
          const R = fr.getHitTestResults(hts);
          if (R.length) { const p = R[0].getPose(ref).transform.position; xr.cur = { x: p.x, y: p.y, z: p.z }; } else xr.cur = null;
          const pose = fr.getViewerPose(ref);
          const W = innerWidth, H = innerHeight, dpr = devicePixelRatio || 1;
          if (oc.width !== Math.round(W * dpr)) { oc.width = Math.round(W * dpr); oc.height = Math.round(H * dpr); }
          g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
          if (!pose) return;
          const v = pose.views[0], P = v.projectionMatrix, Vi = v.transform.inverse.matrix;
          const pr = (q) => { const c = mul(P, mul(Vi, [q.x, q.y, q.z, 1])); if (c[3] <= 0) return null; return [(c[0] / c[3] * 0.5 + 0.5) * W, (1 - (c[1] / c[3] * 0.5 + 0.5)) * H]; };
          const dot = (q) => { const s2 = pr(q); if (!s2) return; g.beginPath(); g.arc(s2[0], s2[1], 8, 0, 7); g.fillStyle = '#D4003C'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); };
          if (xr.pts.length === 1 && xr.cur) {
            const A2 = pr(xr.pts[0]), B2 = pr(xr.cur);
            if (A2 && B2) {
              g.setLineDash([8, 6]); g.lineWidth = 3; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(...A2); g.lineTo(...B2); g.stroke(); g.setLineDash([]);
              const d = Math.round(dist(xr.pts[0], xr.cur)), mx = (A2[0] + B2[0]) / 2, my = (A2[1] + B2[1]) / 2 - 26, tx = `約 ${d} cm`;
              g.font = '700 16px "Noto Sans TC",sans-serif'; const tw = g.measureText(tx).width + 20;
              g.fillStyle = 'rgba(20,18,22,.82)'; g.beginPath(); g.roundRect ? g.roundRect(mx - tw / 2, my - 15, tw, 30, 8) : g.rect(mx - tw / 2, my - 15, tw, 30); g.fill();
              g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tx, mx, my);
            }
          }
          xr.pts.forEach(dot);
          if (xr.cur) {
            const ring = []; for (let k = 0; k <= 32; k++) { const th = k / 32 * Math.PI * 2; ring.push(pr({ x: xr.cur.x + Math.cos(th) * 0.08, y: xr.cur.y, z: xr.cur.z + Math.sin(th) * 0.08 })); }
            if (ring.every(Boolean)) { g.beginPath(); ring.forEach((q, k) => (k ? g.lineTo(...q) : g.moveTo(...q))); g.closePath(); g.fillStyle = 'rgba(255,255,255,.15)'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke(); }
            if (!xr.pts.length) hint(`找到地面了。把白色準心對到${esc(opt.label)}的<b>一端</b>，點一下放起點。`);
          } else if (!xr.pts.length) hint('慢慢移動手機，對著地面找平面…');
        };
        s.requestAnimationFrame(onFrame);
      } catch (e) { if (ov) ov.remove(); xr = null; st.step = 'pick'; render(); alertMsg('無法啟動 AR，請改用拍照量'); }
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
  window.JJJMeasure = { open, REF_CM };
})();
