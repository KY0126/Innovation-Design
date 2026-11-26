// 揪居家｜AR 量測（手機實測）
// 三條路，量到的數字都寫回同一份 S.meas（走道寬、門檻高、床到浴室距離），後面的燈號、顧問圖面、技師工單不用改：
//   1. Android（Chrome）：WebXR 偵測地面，點起點、終點量距離（約 ±1～3 cm）
//   2. iPhone 與其他手機：拍一張旁邊放了尺的照片，點尺上兩個刻度、輸入相差幾公分定比例，再點要量的兩端（約 ±3–5 cm，僅供參考）
//   3. 都不行：手動輸入（原本的畫面）
(function () {
  const J = window.JJJ; if (!J) return;
  const { V, S, esc, toast, render, go } = J;
  const REF_CM = 10; // 尺上兩個刻度預設相差 10 公分（可改）
  const FIELDS = [['corridor_cm', 'A｜走道寬度', 'cm', 1], ['threshold_cm', 'B｜浴室門檻高度', 'cm', 0], ['bed_bath_m', 'C｜床邊到浴室門口', '公尺', 1]];
  let stream = null, img = null, xr = null;
  const A = () => S.arm || (S.arm = { k: 'corridor_cm', step: 'pick', pts: [], card: null, val: null, xrOK: null, mode: null });
  if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-ar').then(ok => { A().xrOK = ok; }).catch(() => { A().xrOK = false; }); else A().xrOK = false;

  function stop() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
  const unit = k => (FIELDS.find(f => f[0] === k) || [])[2];
  const fmtVal = (k, cm) => unit(k) === '公尺' ? Math.round(cm / 50) / 2 : Math.round(cm * 2) / 2; // 公尺取 0.5，公分取 0.5

  V.arm = () => {
    const a = A(), f = FIELDS.find(x => x[0] === a.k);
    const bar = `<div class="top"><button class="back" data-a="back" aria-label="返回上一頁">‹ 返回</button><h1>量測尺寸</h1><span class="tsp"></span></div>`;
    // 選項目與結果頁放「AR 量測｜手動輸入」切換；拍照點點時專心點，不放切換
    const top = a.step === 'pick' || a.step === 'done' ? bar + J.measSeg('ar') : bar;
    if (a.step === 'pick') return `${top}<div class="scroll" style="padding-top:12px">
      <div class="sec">要量哪一項？</div><div class="glist">${FIELDS.map(([k, l, u, xrFit]) => `<button class="gi" data-armk="${k}" aria-pressed="${a.k === k}"><span><b>${a.k === k ? '◉' : '○'} ${l}</b><span class="muted" style="display:block;font-size:.88em">${xrFit ? 'AR 或照片都能量' : '建議用照片：尺立在門檻旁'}${S.meas[k] != null ? `｜目前 ${esc(S.meas[k])} ${u}` : ''}</span></span></button>`).join('')}</div>
      <div class="sec">量測方式</div>
      <div class="pad">
        ${a.xrOK && f[3] ? '<button class="btn" data-arstart="xr">用 AR 量（點起點、終點）</button>' : ''}
        <button class="btn ${a.xrOK && f[3] ? 'ghost' : ''}" data-arstart="cam">拍照量（旁邊放一把尺當比例尺）</button>
        <label class="btn ghost" style="display:block;text-align:center">從相簿選照片<input type="file" accept="image/*" capture="environment" data-arfile="1" hidden></label>
        <div class="muted" style="font-size:.85em;margin-top:8px">${a.xrOK ? '這支手機支援 AR 量測。' : '這支手機的瀏覽器不支援網頁 AR（iPhone 的 Safari 目前都不支援），請用拍照量。'}不拍人臉；照片只在手機上計算，不上傳。</div>
      </div></div>`;
    if (a.step === 'live') return `${top}<div class="armw"><video id="armV" autoplay playsinline muted></video><div class="armh">把尺或捲尺貼著要量的東西放好，刻度要拍清楚</div></div><div class="pad" style="padding:10px 12px"><button class="btn" data-arshot="1">拍照</button><button class="btn ghost" data-arback="pick">取消</button></div>`;
    if (a.step === 'ref') return `${top}<div class="armw"><canvas id="armC"></canvas><div class="armh">② 這兩個刻度相差幾公分？</div></div><div class="pad" style="padding:10px 12px"><label class="muted" style="display:block">尺上兩點相差（公分）<input class="fld" id="armRef" type="number" inputmode="decimal" min="1" max="500" step="0.5" value="${a.refCm || REF_CM}"></label><button class="btn" data-arref="1">下一步</button><button class="btn ghost" data-arundo="card">重點刻度</button></div>`;
    if (a.step === 'card' || a.step === 'target') {
      const hint = a.step === 'card' ? `① 點尺上<b>兩個刻度</b>（例如 0 和 10 公分）（${a.pts.length}／2）` : `③ 點要量的${esc(f[1].split('｜')[1])}兩端（${a.pts.length}／2）`;
      return `${top}<div class="armw"><canvas id="armC" data-artap="1"></canvas><div class="armh">${hint}</div></div><div class="pad" style="padding:10px 12px">${a.pts.length ? '<button class="btn ghost" data-arundo="1">重點這一步</button>' : ''}<button class="btn ghost" data-arback="pick">重新拍</button></div>`;
    }
    if (a.step === 'xr') return `${top}<div class="scroll" style="padding-top:16px"><div class="card" style="text-align:center"><b>AR 量測中</b><div class="muted" style="margin-top:6px">慢慢移動手機找地面，出現圓圈後點一下放起點，再點一下放終點。</div></div><div class="pad"><button class="btn ghost" data-arback="pick">取消</button></div></div>`;
    // done
    const v = fmtVal(a.k, a.val);
    return `${top}<div class="scroll" style="padding-top:16px"><div class="card" style="text-align:center;padding:24px 16px"><div class="muted">${esc(f[1])}</div><div style="font-size:2.2em;font-weight:700;margin:6px 0">約 ${v} ${f[2]}</div>
      <div class="rs">${a.mode === 'xr' ? 'AR 實測｜約 ±1～3 cm｜不拍照、不存影像，只存這個數字' : '照片比例尺｜約 ±3–5 cm，僅供參考；門市到府會再複量'}</div></div>
      <div class="pad"><button class="btn" data-aruse="1">使用這個數字</button><button class="btn ghost" data-arback="pick">重新量</button><button class="btn ghost" data-arman="1">改用手動輸入</button><div class="muted" style="font-size:.85em;text-align:center;margin-top:6px">不滿意可改用手動輸入：剛量到的數字會先填好，直接改成捲尺量的數字</div></div>
      ${img && a.mode === 'photo' ? '<div class="armw" style="height:auto"><canvas id="armC"></canvas></div>' : ''}</div>`;
  };

  // 畫面更新後：接上相機、重畫照片與標記；離開就關相機
  (window.JJJHOOKS || (window.JJJHOOKS = [])).push((v, view) => {
    if (v === 'ar' && S.measFocus) { const el = view.querySelector('#m_' + S.measFocus); S.measFocus = null; if (el) { el.focus(); el.select && el.select(); el.scrollIntoView({ block: 'center' }); } }
    if (v !== 'arm') { stop(); return; }
    const a = A(), vd = view.querySelector('#armV'); if (vd && stream) vd.srcObject = stream;
    const c = view.querySelector('#armC'); if (c && img) draw(c, a);
  });
  function draw(c, a) {
    const w = img.width, h = img.height; c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const r = Math.max(6, w / 90), lw = Math.max(3, w / 220);
    const pair = (P, col) => { P.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = lw / 1.5; g.strokeStyle = '#fff'; g.stroke(); }); if (P.length === 2) { g.beginPath(); g.moveTo(...P[0]); g.lineTo(...P[1]); g.strokeStyle = col; g.lineWidth = lw; g.stroke(); } };
    if (a.card) pair(a.card, '#2F6FDB');
    pair(a.step === 'card' ? a.pts : a.step === 'target' ? a.pts : (a.tgt || []), '#D4003C');
  }
  async function openCam() {
    const a = A();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('這個瀏覽器不能開相機，請從相簿選照片'); return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false }); a.step = 'live'; a.mode = 'photo'; render(); }
    catch (e) { toast('沒有取得相機權限，請從相簿選照片或改用手動輸入'); }
  }
  function shot() {
    const vd = document.getElementById('armV'); if (!vd || !vd.videoWidth) { toast('相機還沒準備好'); return; }
    const c = document.createElement('canvas'); c.width = vd.videoWidth; c.height = vd.videoHeight; c.getContext('2d').drawImage(vd, 0, 0);
    img = c; stop(); const a = A(); a.step = 'card'; a.pts = []; a.card = null; render();
  }
  function fromFile(file) {
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); const s = Math.min(1, 1920 / Math.max(im.width, im.height)); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); img = c; URL.revokeObjectURL(u); const a = A(); a.mode = 'photo'; a.step = 'card'; a.pts = []; a.card = null; render(); };
    im.onerror = () => toast('讀不到這張照片');
    im.src = u;
  }
  function tap(e, c) {
    const a = A(), r = c.getBoundingClientRect(), x = (e.clientX - r.left) * c.width / r.width, y = (e.clientY - r.top) * c.height / r.height;
    a.pts.push([x, y]);
    if (a.pts.length === 2) {
      const d = Math.hypot(a.pts[0][0] - a.pts[1][0], a.pts[0][1] - a.pts[1][1]);
      if (a.step === 'card') { if (d < 20) { a.pts = []; toast('兩點太近，請點尺上離遠一點的兩個刻度'); render(); return; } a.card = a.pts; a.cardPx = d; a.pts = []; a.step = 'ref'; }
      else { a.tgt = a.pts; a.val = d / a.cardPx * (a.refCm || REF_CM); a.pts = []; a.step = 'done'; }
    }
    render();
  }

  // ---------- WebXR（Android Chrome） ----------
  // 畫面：白色準心貼在地面上、起點紅點、白線與即時距離；按下方紅色圓鈕或點畫面放點
  // 只存兩點距離，不拍照、不存相機影像
  async function startXR() {
    const a = A(), f = FIELDS.find(x => x[0] === a.k) || FIELDS[0], what = f[1].split('｜')[1];
    a.step = 'xr'; a.mode = 'xr'; render();
    let ov;
    try {
      ov = document.createElement('div'); ov.className = 'xrov';
      ov.innerHTML = `<canvas class="xrc" id="xrc"></canvas><div class="xrtop"><span>${esc(f[1])}</span><button class="xrb" id="xrx">取消</button></div><div class="xrh" id="xrh">慢慢移動手機，對著地面找平面…</div><div class="xrbot"><button class="xrgo" id="xrgo" aria-label="放點"></button><span id="xrsub">點畫面任何地方也可以放點</span></div>`;
      document.body.appendChild(ov);
      const s = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: ov } });
      xr = { s, ov, pts: [], cur: null };
      const cv = document.createElement('canvas'), gl = cv.getContext('webgl', { xrCompatible: true });
      s.updateRenderState({ baseLayer: new XRWebGLLayer(s, gl) });
      const ref = await s.requestReferenceSpace('local'), viewer = await s.requestReferenceSpace('viewer'), hts = await s.requestHitTestSource({ space: viewer });
      const $ = id => document.getElementById(id), hint = t => { const h = $('xrh'); if (h) h.innerHTML = t; };
      const oc = $('xrc'), g = oc.getContext('2d');
      const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) * 100;
      const place = () => {
        if (!xr || !xr.cur) { hint('還沒找到地面，慢慢移動手機'); return; }
        xr.pts.push(xr.cur);
        if (xr.pts.length === 1) { hint(`已放起點。把準心移到${esc(what)}的<b>另一端</b>，數字會跟著變，再點一下放終點。`); const sb = $('xrsub'); if (sb) sb.textContent = '放錯了？按「取消」重來'; }
        else { a.val = dist(xr.pts[0], xr.pts[1]); a.step = 'done'; s.end(); }
      };
      $('xrx').onclick = () => s.end();
      $('xrgo').onclick = place;
      // 點在按鈕上不要再觸發一次 select
      ov.addEventListener('beforexrselect', e => { if (e.target.closest('button')) e.preventDefault(); });
      s.addEventListener('select', place);
      s.addEventListener('end', () => { ov.remove(); xr = null; if (a.step === 'xr') a.step = 'pick'; render(); });
      // 3D 座標投影到螢幕
      const mul = (M, v) => [0, 1, 2, 3].map(r => M[r] * v[0] + M[4 + r] * v[1] + M[8 + r] * v[2] + M[12 + r] * v[3]);
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
        const pr = q => { const c = mul(P, mul(Vi, [q.x, q.y, q.z, 1])); if (c[3] <= 0) return null; return [(c[0] / c[3] * 0.5 + 0.5) * W, (1 - (c[1] / c[3] * 0.5 + 0.5)) * H]; };
        const dot = q => { const s2 = pr(q); if (!s2) return; g.beginPath(); g.arc(s2[0], s2[1], 8, 0, 7); g.fillStyle = '#D4003C'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); };
        const end = xr.pts.length === 1 ? xr.cur : null;
        if (xr.pts.length === 1 && end) {
          const A2 = pr(xr.pts[0]), B2 = pr(end);
          if (A2 && B2) {
            g.setLineDash([8, 6]); g.lineWidth = 3; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(...A2); g.lineTo(...B2); g.stroke(); g.setLineDash([]);
            const d = Math.round(dist(xr.pts[0], end)), mx = (A2[0] + B2[0]) / 2, my = (A2[1] + B2[1]) / 2 - 26, tx = `約 ${d} cm`;
            g.font = '700 16px "Noto Sans TC",sans-serif'; const tw = g.measureText(tx).width + 20;
            g.fillStyle = 'rgba(20,18,22,.82)'; g.beginPath(); g.roundRect ? g.roundRect(mx - tw / 2, my - 15, tw, 30, 8) : g.rect(mx - tw / 2, my - 15, tw, 30); g.fill();
            g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tx, mx, my);
          }
        }
        xr.pts.forEach(dot);
        if (xr.cur) {
          // 準心：地面上半徑 8 公分的圓，投影後自然成橢圓
          const ring = []; for (let k = 0; k <= 32; k++) { const th = k / 32 * Math.PI * 2; ring.push(pr({ x: xr.cur.x + Math.cos(th) * 0.08, y: xr.cur.y, z: xr.cur.z + Math.sin(th) * 0.08 })); }
          if (ring.every(Boolean)) { g.beginPath(); ring.forEach((q, k) => k ? g.lineTo(...q) : g.moveTo(...q)); g.closePath(); g.fillStyle = 'rgba(255,255,255,.15)'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke(); const c0 = pr(xr.cur); g.beginPath(); g.arc(c0[0], c0[1], 3, 0, 7); g.fillStyle = '#fff'; g.fill(); }
          if (!xr.pts.length) hint(`找到地面了。把白色準心對到${esc(what)}的<b>一端</b>，點一下放起點。`);
        } else if (!xr.pts.length) hint('慢慢移動手機，對著地面找平面…');
      };
      s.requestAnimationFrame(onFrame);
    } catch (e) { if (ov) ov.remove(); document.querySelectorAll('.xrov').forEach(x => x.remove()); xr = null; a.step = 'pick'; render(); toast('無法啟動 AR，請改用拍照量'); }
  }

  const view = document.getElementById('view');
  view.addEventListener('click', e => {
    const t = e.target.closest('[data-armk],[data-arstart],[data-arshot],[data-arback],[data-arundo],[data-aruse],[data-artap],[data-arman],[data-arref]'); if (!t) return; e.stopPropagation();
    const a = A(), d = t.dataset;
    if (d.armk) { a.k = d.armk; render(); }
    else if (d.arstart === 'xr') startXR();
    else if (d.arstart === 'cam') openCam();
    else if (d.arshot) shot();
    else if (d.arback) { stop(); a.step = d.arback; a.pts = []; a.card = null; a.tgt = null; render(); }
    else if (d.arundo) { a.pts = []; if (d.arundo === 'card') { a.card = null; a.step = 'card'; } render(); }
    else if (d.arref) { const v = Number((document.getElementById('armRef') || {}).value); if (!(v > 0)) { toast('請輸入兩個刻度相差幾公分'); return; } a.refCm = v; a.step = 'target'; render(); }
    else if (d.artap) tap(e, t);
    else if (d.arman) {
      // 切到手動輸入；從結果頁來的，先把剛量到的數字填進去，游標停在那一格
      stop(); let msg = '';
      if (a.step === 'done' && a.val != null) { const v = fmtVal(a.k, a.val); S.meas[a.k] = String(v); S.measSrc = Object.assign({}, S.measSrc, { [a.k]: a.mode }); S.measFocus = a.k; msg = '已先填入 ' + v + ' ' + unit(a.k) + '，可直接修改'; }
      S.armode = 'manual'; a.step = 'pick'; img = null;
      const i = J.S.stack.lastIndexOf('ar'); if (i >= 0) J.S.stack = J.S.stack.slice(0, i + 1); else J.S.stack.pop();
      render(); if (msg) toast(msg);
    }
    else if (d.aruse) {
      const v = fmtVal(a.k, a.val);
      S.meas[a.k] = String(v); S.measSrc = Object.assign({}, S.measSrc, { [a.k]: a.mode }); S.armode = 'manual';
      a.step = 'pick'; img = null; toast('已帶入：' + FIELDS.find(f => f[0] === a.k)[1].split('｜')[1] + ' ' + v + ' ' + unit(a.k));
      const i = J.S.stack.lastIndexOf('ar'); if (i >= 0) J.S.stack = J.S.stack.slice(0, i + 1); else J.S.stack.pop(); render();
    }
  }, true);
  view.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.arfile && e.target.files[0]) fromFile(e.target.files[0]); }, true);
  J.NO_NAV.push('arm');
  window.JJJAR = { A, REF_CM, _setImage: c => { img = c; } };
})();
