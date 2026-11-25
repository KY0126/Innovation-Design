// 揪居家｜AR 量測（手機實測）
// 三條路，量到的數字都寫回同一份 S.meas（走道寬、門檻高、床到浴室距離），後面的燈號、顧問圖面、技師工單不用改：
//   1. Android（Chrome）：WebXR 偵測地面，點起點、終點量距離（約 ±1–2 cm）
//   2. iPhone 與其他手機：拍一張放了信用卡的照片，先點卡片長邊兩端定比例，再點要量的兩端（約 ±3–5 cm，僅供參考）
//   3. 都不行：手動輸入（原本的畫面）
(function () {
  const J = window.JJJ; if (!J) return;
  const { V, S, esc, toast, render, go } = J;
  const CARD_CM = 8.56; // 信用卡長邊（ISO/IEC 7810 ID-1）
  const FIELDS = [['corridor_cm', 'A｜走道寬度', 'cm', 1], ['threshold_cm', 'B｜浴室門檻高度', 'cm', 0], ['bed_bath_m', 'C｜床邊到浴室門口', '公尺', 1]];
  let stream = null, img = null, xr = null;
  const A = () => S.arm || (S.arm = { k: 'corridor_cm', step: 'pick', pts: [], card: null, val: null, xrOK: null, mode: null });
  if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-ar').then(ok => { A().xrOK = ok; }).catch(() => { A().xrOK = false; }); else A().xrOK = false;

  function stop() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
  const unit = k => (FIELDS.find(f => f[0] === k) || [])[2];
  const fmtVal = (k, cm) => unit(k) === '公尺' ? Math.round(cm / 50) / 2 : Math.round(cm * 2) / 2; // 公尺取 0.5，公分取 0.5

  V.arm = () => {
    const a = A(), f = FIELDS.find(x => x[0] === a.k);
    const top = `<div class="top"><button class="back" data-a="back" aria-label="返回上一頁">‹ 返回</button><h1>手機實測</h1><span class="tsp"></span></div>`;
    if (a.step === 'pick') return `${top}<div class="scroll" style="padding-top:12px">
      <div class="sec">要量哪一項？</div><div class="glist">${FIELDS.map(([k, l, u, xrFit]) => `<button class="gi" data-armk="${k}" aria-pressed="${a.k === k}"><span><b>${a.k === k ? '◉' : '○'} ${l}</b><span class="muted" style="display:block;font-size:.88em">${xrFit ? 'AR 或照片都能量' : '建議用照片：卡片貼著門檻放'}${S.meas[k] != null ? `｜目前 ${esc(S.meas[k])} ${u}` : ''}</span></span></button>`).join('')}</div>
      <div class="sec">量測方式</div>
      <div class="pad">
        ${a.xrOK && f[3] ? '<button class="btn" data-arstart="xr">用 AR 量（點起點、終點）</button>' : ''}
        <button class="btn ${a.xrOK && f[3] ? 'ghost' : ''}" data-arstart="cam">拍照量（放一張信用卡當比例尺）</button>
        <label class="btn ghost" style="display:block;text-align:center">從相簿選照片<input type="file" accept="image/*" capture="environment" data-arfile="1" hidden></label>
        <div class="muted" style="font-size:.85em;margin-top:8px">${a.xrOK ? '這支手機支援 AR 量測。' : '這支手機的瀏覽器不支援網頁 AR（iPhone 的 Safari 目前都不支援），請用拍照量。'}不拍人臉；照片只在手機上計算，不上傳。</div>
      </div></div>`;
    if (a.step === 'live') return `${top}<div class="armw"><video id="armV" autoplay playsinline muted></video><div class="armh">把信用卡貼著要量的東西放好，整個畫面都拍進去</div></div><div class="pad" style="padding:10px 12px"><button class="btn" data-arshot="1">拍照</button><button class="btn ghost" data-arback="pick">取消</button></div>`;
    if (a.step === 'card' || a.step === 'target') {
      const hint = a.step === 'card' ? `① 點信用卡<b>長邊</b>的兩端（${a.pts.length}／2）` : `② 點要量的${esc(f[1].split('｜')[1])}兩端（${a.pts.length}／2）`;
      return `${top}<div class="armw"><canvas id="armC" data-artap="1"></canvas><div class="armh">${hint}</div></div><div class="pad" style="padding:10px 12px">${a.pts.length ? '<button class="btn ghost" data-arundo="1">重點這一步</button>' : ''}<button class="btn ghost" data-arback="pick">重新拍</button></div>`;
    }
    if (a.step === 'xr') return `${top}<div class="scroll" style="padding-top:16px"><div class="card" style="text-align:center"><b>AR 量測中</b><div class="muted" style="margin-top:6px">慢慢移動手機找地面，出現圓圈後點一下放起點，再點一下放終點。</div></div><div class="pad"><button class="btn ghost" data-arback="pick">取消</button></div></div>`;
    // done
    const v = fmtVal(a.k, a.val);
    return `${top}<div class="scroll" style="padding-top:16px"><div class="card" style="text-align:center;padding:24px 16px"><div class="muted">${esc(f[1])}</div><div style="font-size:2.2em;font-weight:700;margin:6px 0">約 ${v} ${f[2]}</div>
      <div class="rs">${a.mode === 'xr' ? 'AR 實測｜約 ±1–2 cm' : '照片比例尺｜約 ±3–5 cm，僅供參考；門市到府會再複量'}</div></div>
      ${img && a.mode === 'photo' ? '<div class="armw" style="height:auto"><canvas id="armC"></canvas></div>' : ''}
      <div class="pad"><button class="btn" data-aruse="1">使用這個數字</button><button class="btn ghost" data-arback="pick">重新量</button></div></div>`;
  };

  // 畫面更新後：接上相機、重畫照片與標記；離開就關相機
  (window.JJJHOOKS || (window.JJJHOOKS = [])).push((v, view) => {
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
      if (a.step === 'card') { if (d < 20) { a.pts = []; toast('兩點太近，請點卡片長邊的兩端'); render(); return; } a.card = a.pts; a.cardPx = d; a.pts = []; a.step = 'target'; }
      else { a.tgt = a.pts; a.val = d / a.cardPx * CARD_CM; a.pts = []; a.step = 'done'; }
    }
    render();
  }

  // ---------- WebXR（Android Chrome） ----------
  async function startXR() {
    const a = A(); a.step = 'xr'; a.mode = 'xr'; render();
    try {
      const ov = document.createElement('div'); ov.className = 'xrov'; ov.innerHTML = '<div class="xrh" id="xrh">找地面中…</div><button class="xrx" id="xrx">取消</button>'; document.body.appendChild(ov);
      const s = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: ov } });
      xr = { s, ov, pts: [], cur: null };
      const cv = document.createElement('canvas'), gl = cv.getContext('webgl', { xrCompatible: true });
      s.updateRenderState({ baseLayer: new XRWebGLLayer(s, gl) });
      const ref = await s.requestReferenceSpace('local'), view = await s.requestReferenceSpace('viewer'), hts = await s.requestHitTestSource({ space: view });
      const hint = t => { const h = document.getElementById('xrh'); if (h) h.textContent = t; };
      document.getElementById('xrx').onclick = () => s.end();
      s.addEventListener('select', () => {
        if (!xr.cur) { hint('還沒找到地面，慢慢移動手機'); return; }
        xr.pts.push(xr.cur);
        if (xr.pts.length === 1) hint('已放起點，移到終點再點一下');
        else { const [p, q] = xr.pts; a.val = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) * 100; a.step = 'done'; s.end(); }
      });
      s.addEventListener('end', () => { ov.remove(); xr = null; if (a.step === 'xr') a.step = 'pick'; render(); });
      const onFrame = (t, fr) => {
        s.requestAnimationFrame(onFrame);
        const L = s.renderState.baseLayer; gl.bindFramebuffer(gl.FRAMEBUFFER, L.framebuffer); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        const R = fr.getHitTestResults(hts);
        if (R.length) { const p = R[0].getPose(ref).transform.position; xr.cur = { x: p.x, y: p.y, z: p.z }; if (xr.pts.length === 1) { const q = xr.pts[0]; hint('目前約 ' + Math.round(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) * 100) + ' cm，點一下放終點'); } else hint('找到地面了，點一下放起點'); }
      };
      s.requestAnimationFrame(onFrame);
    } catch (e) { document.querySelectorAll('.xrov').forEach(x => x.remove()); a.step = 'pick'; render(); toast('無法啟動 AR，請改用拍照量'); }
  }

  const view = document.getElementById('view');
  view.addEventListener('click', e => {
    const t = e.target.closest('[data-armk],[data-arstart],[data-arshot],[data-arback],[data-arundo],[data-aruse],[data-artap]'); if (!t) return; e.stopPropagation();
    const a = A(), d = t.dataset;
    if (d.armk) { a.k = d.armk; render(); }
    else if (d.arstart === 'xr') startXR();
    else if (d.arstart === 'cam') openCam();
    else if (d.arshot) shot();
    else if (d.arback) { stop(); a.step = d.arback; a.pts = []; a.card = null; a.tgt = null; render(); }
    else if (d.arundo) { a.pts = []; render(); }
    else if (d.artap) tap(e, t);
    else if (d.aruse) {
      const v = fmtVal(a.k, a.val);
      S.meas[a.k] = String(v); S.measSrc = Object.assign({}, S.measSrc, { [a.k]: a.mode }); S.armode = 'manual';
      a.step = 'pick'; img = null; toast('已帶入：' + FIELDS.find(f => f[0] === a.k)[1].split('｜')[1] + ' ' + v + ' ' + unit(a.k));
      const i = J.S.stack.lastIndexOf('ar'); if (i >= 0) J.S.stack = J.S.stack.slice(0, i + 1); else J.S.stack.pop(); render();
    }
  }, true);
  view.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.arfile && e.target.files[0]) fromFile(e.target.files[0]); }, true);
  J.NO_NAV.push('arm');
  window.JJJAR = { A, CARD_CM, _setImage: c => { img = c; } };
})();
