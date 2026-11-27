// 揪居家｜家庭 App：技師到府即時追蹤（④）與到府紀錄詳情（⑤）
// 參考 55688、yoxi 的派車畫面。地圖為 OpenStreetMap 真實圖資；技師位置、評分、車牌為示範資料。
// 隱私：位置只在「出發到抵達」分享，抵達即停止；不保存軌跡，只留出發與抵達時間；不顯示技師手機，改撥門市轉接。
(function () {
  const J = window.JJJ; if (!J) return;
  const { V, S, esc, fmt, toast } = J;
  const hdr = J.hdr;
  ['trk', 'trd'].forEach(v => { if (J.NO_NAV && !J.NO_NAV.includes(v)) J.NO_NAV.push(v); });
  const RM = () => import('./map/real/realmap.js?v=20261127a');
  const hm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const ins = () => (S.hh && S.hh.install) || {};
  const techName = () => { const a = ins().assignee || '吳技師'; return /技師$/.test(a) ? a : a + '技師'; };
  const job = () => { const p = S.hh && S.hh.plan, sel = (p && p.sel) || {}; return sel.night ? '夜間照明：床邊感應夜燈 2 盞、走道 1 盞' : '關懷設備安裝'; };
  if (!document.getElementById('trkCss')) { const s = document.createElement('style'); s.id = 'trkCss'; s.textContent = `
.trkWrap{position:relative;height:52vh;min-height:300px;background:#EEE}.trkWrap .map{position:absolute;inset:0}
.trkEta{position:absolute;left:12px;top:12px;z-index:2;background:#C42D5A;color:#fff;border-radius:12px;padding:9px 13px;box-shadow:0 4px 14px rgba(0,0,0,.18)}
.trkEta b{display:block;font-size:1.6em;line-height:1.1}.trkEta span{font-size:.85em}
.trkUpd{position:absolute;right:12px;top:12px;z-index:2;background:rgba(255,255,255,.95);border-radius:10px;padding:5px 9px;font-size:.8em;color:#6F6670}
.trkDemo{position:absolute;left:12px;bottom:10px;z-index:2;background:rgba(255,255,255,.92);border-radius:8px;padding:3px 8px;font-size:.75em;color:#6F6670}
.trkTech{display:flex;gap:12px;align-items:center}.trkTech img{width:52px;height:62px;flex:none}
.trkTL{display:flex;flex-direction:column;gap:6px;font-size:.92em}.trkTL div{display:flex;align-items:center;gap:8px}.trkTL i{width:10px;height:10px;border-radius:5px;flex:none;background:#D4CFD3}.trkTL .on i{background:#C42D5A}
.trdMap{height:150px;position:relative;background:#EEE}.trdMap .map{position:absolute;inset:0}
.trdBt{display:flex;gap:8px;margin-top:10px}.trdBt button{flex:1;margin:0}`; document.head.appendChild(s); }

  // ---------- ④ 技師到府即時追蹤 ----------
  V.trk = () => {
    const o = ins(), n = techName();
    return `${hdr('技師即時位置')}<div class="scroll">
    <div class="trkWrap"><div class="map" id="trkMap" role="img" aria-label="真實地圖：技師從門市往家裡的位置與路線"></div>
      <div class="trkEta" aria-live="polite"><b id="trkMin">— 分鐘</b><span id="trkAt">後抵達</span></div>
      <div class="trkUpd" id="trkUpd">位置更新中…</div><div class="trkDemo">技師位置為示範</div></div>
    <div class="card" style="margin-top:12px"><div class="trkTL">
      <div class="on"><i></i><b>技師已出發</b><span class="muted" id="trkGo"></span></div>
      <div><i></i><span class="muted">抵達｜施工｜驗收</span></div></div></div>
    <div class="card"><div class="trkTech"><img src="map/real/icons/av_go.png" alt="">
      <div style="flex:1"><div style="display:flex;align-items:center;gap:8px"><b style="font-size:1.08em">${esc(n)}</b><span style="color:#C8851A;font-size:.88em">★ 4.9</span></div>
      <div class="muted" style="font-size:.88em">編號 T-0318｜協力工班：南區水電</div>
      <div class="muted" style="font-size:.88em">墨灰工程車｜車牌 ABC-1234（示範）</div>
      <span class="tag ok" style="margin-top:4px;display:inline-block">✓ 居安規劃認證</span></div></div>
      <div class="rs" style="margin-top:8px">開門前請長輩確認編號與車牌，和這裡顯示的一樣才開門。</div></div>
    <div class="card"><div class="rs">這次要做｜${esc(o.code || 'W-20261127-06')}</div><b>${esc(job())}</b><div class="muted" style="font-size:.88em">預計 1 小時｜長輩已同意正式報價</div></div>
    <div class="pad"><button class="btn" data-a="trkCall">撥給門市轉接</button>
      <div class="rs" style="margin-top:8px">位置只在技師出發到抵達這段分享，抵達後停止；不保存行車軌跡。為保護技師隱私，不顯示技師手機。</div></div></div>`;
  };
  // ---------- ⑤ 到府紀錄詳情 ----------
  V.trd = () => {
    const o = ins(), p = S.hh && S.hh.plan, n = techName(), done = o.completed_at ? new Date(o.completed_at) : new Date();
    const t0 = new Date(done.getTime() - 67 * 60000), t1 = new Date(t0.getTime() + 7 * 60000), t2 = new Date(t1.getTime() + 3 * 60000), t3 = new Date(done.getTime() - 4 * 60000);
    const ww = '日一二三四五六'[done.getDay()], until = new Date(done.getTime() + 30 * 864e5);
    const fee = p && p.one_time ? fmt(p.one_time) : '—', pick = S.trdPick || '';
    return `${hdr('到府紀錄')}<div class="scroll">
    <div class="trdMap"><div class="map" id="trdMap" role="img" aria-label="真實地圖：門市到家的規劃路線"></div></div>
    <div class="card" style="margin-top:12px;display:flex;justify-content:space-between;align-items:flex-end;gap:8px">
      <div><div class="muted" style="font-size:.88em">${done.getMonth() + 1}月${done.getDate()}日（${ww}）</div><b style="font-size:1.12em">${esc(job().split('：')[0].replace(/安裝$/, ''))}安裝</b></div>
      <div style="text-align:right"><div class="muted" style="font-size:.8em">本次費用</div><b style="font-size:1.3em">${fee}</b></div></div>
    <div class="card"><div class="trkTech"><img src="map/real/icons/av_free.png" alt=""><div style="flex:1"><b>${esc(n)}</b>｜T-0318<div class="muted" style="font-size:.88em">協力工班：南區水電｜示範資料</div></div></div>
      <div class="trdBt"><button class="btn ${pick === 'keep' ? '' : 'ghost'}" data-a="trdPick" data-k="keep" aria-pressed="${pick === 'keep'}">♡ 下次指定這位</button><button class="btn ${pick === 'swap' ? '' : 'ghost'}" data-a="trdPick" data-k="swap" aria-pressed="${pick === 'swap'}">下次換一位</button></div>
      <div class="rs" style="margin-top:8px">長輩、家人都可以評分；選擇只給門市排班參考，技師看不到是誰選的。</div></div>
    <div class="sec">到府資訊</div><div class="card" style="padding:4px 14px">
      <div class="row"><span>技師出發</span><span>${hm(t0)}</span></div><div class="row"><span>抵達</span><span>${hm(t1)}</span></div>
      <div class="row"><span>施工</span><span>${hm(t2)}–${hm(t3)}</span></div><div class="row"><span>長輩驗收</span><span>${o.status === '已完成' ? hm(done) + '｜本人確認' : '待驗收'}</span></div></div>
    <div class="sec">保固與付款</div><div class="card" style="padding:4px 14px">
      <div class="row"><span>施工售後</span><span>30 天｜到 ${until.getMonth() + 1}/${until.getDate()}</span></div><div class="row"><span>付款方式</span><span>門市或 App 行動支付</span></div></div>
    <div class="pad rs">地圖只畫門市到家的規劃路線，不顯示技師的實際軌跡；家的位置只到街區。</div></div>`;
  };

  // ---------- 掛地圖與動畫 ----------
  let TRK = null;
  async function mountTrack(el) {
    const R = await RM(), path = await R.demoRoute();
    const map = await R.createMap(el, { fit: path, padding: { top: 90, bottom: 60, left: 40, right: 40 } });
    R.storePin(map, R.STORES.民族店, '民族店', 30); R.homePin(map, R.HOME, 30);
    let frac = .3, last = Date.now(); const go = new Date(Date.now() - 4 * 60000);
    const s0 = R.split(path, frac), van = R.vanMarker(map, s0.cur, R.heading(s0.cur, s0.next));
    const $ = id => document.getElementById(id);
    if ($('trkGo')) $('trkGo').textContent = hm(go);
    const tick = () => {
      if (!el.isConnected) { clearInterval(TRK); TRK = null; map.remove(); return; }
      const s = R.split(path, frac); R.line(map, 'rest', s.rest, '#C42D5A'); R.line(map, 'done', s.done, '#9AA0A6');
      van.setLngLat(s.cur); van.turn(R.heading(s.cur, s.next));
      const m = Math.max(1, Math.round((1 - frac) * 10)), at = new Date(Date.now() + m * 60000);
      if ($('trkMin')) { $('trkMin').textContent = frac >= 1 ? '已抵達' : m + ' 分鐘'; $('trkAt').textContent = frac >= 1 ? '技師到門口了' : '後抵達｜約 ' + hm(at); }
      if ($('trkUpd')) $('trkUpd').textContent = '位置更新 ' + Math.round((Date.now() - last) / 1000) + ' 秒前';
      if (frac >= 1) { clearInterval(TRK); TRK = null; if ($('trkUpd')) $('trkUpd').textContent = '已抵達，停止分享位置'; }
    };
    tick(); if (TRK) clearInterval(TRK);
    // 示範：每 10 秒收到一次位置（正式版由技師 App 回報 GPS）
    let n = 0; TRK = setInterval(() => { n++; if (n % 10 === 0) { frac = Math.min(1, frac + .03); last = Date.now(); } tick(); }, 1000);
  }
  async function mountDone(el) {
    const R = await RM(), path = await R.demoRoute();
    const map = await R.createMap(el, { fit: path, padding: { top: 34, bottom: 44, left: 50, right: 40 }, interactive: false });
    R.line(map, 'all', path, '#C42D5A', 4); R.storePin(map, R.STORES.民族店, '民族店', 24); R.homePin(map, R.HOME, 24);
  }
  const fail = (el, e) => { el.innerHTML = `<div class="pad muted" style="padding-top:40px;text-align:center">地圖載入失敗：${esc(e.message)}</div>`; };
  (window.JJJHOOKS || (window.JJJHOOKS = [])).push((v, view) => {
    if (v === 'trk') { const el = view.querySelector('#trkMap'); if (el) mountTrack(el).catch(e => fail(el, e)); }
    if (v === 'trd') { const el = view.querySelector('#trdMap'); if (el) mountDone(el).catch(e => fail(el, e)); }
    if (v === 'ip') {
      const o = ins(); if (!o.slot) return; const done = o.status === '已完成' || o.status === '待驗收';
      const card = document.createElement('div'); card.className = 'card'; card.style.cssText = 'display:flex;gap:12px;align-items:center';
      card.innerHTML = done ? `<img src="map/real/icons/home.png" alt="" style="width:34px"><div style="flex:1"><b>到府紀錄</b><div class="muted" style="font-size:.88em">出發、抵達、施工與驗收時間，30 天施工售後</div></div><button class="tag" data-go="trd">查看</button>`
        : `<img src="map/real/icons/van.png" alt="" style="width:22px;margin:0 6px"><div style="flex:1"><b>技師即時位置</b><div class="muted" style="font-size:.88em">技師出發後，可以看到他在哪裡、幾分鐘後到</div></div><button class="tag" data-go="trk">查看</button>`;
      const first = view.querySelector('.scroll > .card'); if (first) first.after(card);
    }
  });
  // 按鈕
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-a="trkCall"],[data-a="trdPick"]'); if (!b) return;
    if (b.dataset.a === 'trkCall') return toast('示範：正式版會撥給民族店門市，由門市轉接技師');
    S.trdPick = S.trdPick === b.dataset.k ? '' : b.dataset.k; J.render();
    if (S.trdPick) toast(S.trdPick === 'keep' ? '已記下：下次優先排這位技師' : '已記下：下次換一位技師');
  });
})();
