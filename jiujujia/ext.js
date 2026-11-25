// 揪居家｜工作包 5：延伸期新身分（校園大使）與新客群（新家翻修、育兒寵物）接上資料庫
// 商用客戶（揪夥伴商用版）在 business.html。載入順序：family.js 之後。
(function () {
  const J = window.JJJ; if (!J) return;
  const { V, S, api, esc, toast, render, go } = J;
  const L2 = () => (window.JJJS2 && window.JJJS2.L) || { s: {} };

  // ---------- 校園大使：任務／成果／帳號 ----------
  V.u0 = () => {
    const D = S.amb;
    return `${J.stf('任務', false)}<div class="scroll">
      <div class="step">${esc(S.me.name)}｜校園大使｜${esc((S.me.store || '').replace('Digital City ', ''))}</div>
      <div class="sec">本月任務</div>
      <button class="card" data-go="uvisit" style="display:block;width:calc(100% - 24px);text-align:left"><div style="display:flex;justify-content:space-between;gap:8px"><b>陪家人做居家觀察｜15 分鐘</b><span class="tag">50 點</span></div><div class="muted" style="font-size:.9em">和家人一起看長輩家的夜間動線；先取得家人與長輩同意，不拍人、不拍地址</div></button>
      <button class="card" data-go="u3" style="display:block;width:calc(100% - 24px);text-align:left"><div style="display:flex;justify-content:space-between;gap:8px"><b>60 秒短影音</b><span class="tag">100 點</span></div><div class="muted" style="font-size:.9em">把居家觀察學到的事拍成短影音；生活顧問與總部審核後上架</div></button>
      <div class="sec">我的推薦碼</div><div class="card"><div style="font-size:1.4em;font-weight:700;letter-spacing:2px">${D ? esc(D.code) : '—'}</div><div class="muted" style="font-size:.88em">家人完成居家評估時輸入，門市就知道是你推薦的</div></div>
      <p class="muted pad" style="font-size:.85em">津貼與點數不抽成、不做個人排名；任務內容由綁定門市確認。</p></div>`;
  };
  V.u1 = () => {
    const D = S.amb;
    if (!D) return `${J.stf('成果', false)}<div class="scroll"><div class="card muted" style="margin-top:12px">載入中…</div></div>`;
    const tag = st => `<span class="tag ${/已確認|已上架/.test(st) ? 'ok' : ''}">${esc(st)}</span>`;
    return `${J.stf('成果', false)}<div class="scroll">
      <div class="card" style="margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);text-align:center">${[['累計點數', D.points], ['居家觀察', D.visits.length], ['短影音', D.videos.length]].map(([l, v]) => `<div><b style="font-size:1.4em">${v}</b><div class="muted" style="font-size:.85em">${l}</div></div>`).join('')}</div>
      <div class="sec">居家觀察</div><div class="glist">${D.visits.length ? D.visits.map(v => `<div class="gi" style="cursor:default"><span><b>${esc(v.family)}</b><span class="muted" style="display:block;font-size:.85em">${esc(String(v.created_at).slice(0, 16))}${v.note ? '｜' + esc(v.note) : ''}</span></span>${tag(v.status)}</div>`).join('') : '<div class="gi muted" style="cursor:default">還沒有紀錄</div>'}</div>
      <div class="sec">短影音</div><div class="glist">${D.videos.length ? D.videos.map(v => `<div class="gi" style="cursor:default"><span><b>${esc(v.topic || '短影音')}</b><span class="muted" style="display:block;font-size:.85em">${esc(String(v.created_at).slice(0, 16))}${v.review_note ? '｜' + esc(v.review_note) : ''}</span></span>${tag(v.status)}</div>`).join('') : '<div class="gi muted" style="cursor:default">還沒有送審</div>'}</div></div>`;
  };
  V.uacct = () => `${J.stf('帳號', false)}<div class="scroll">${J.meCard()}${J.acctList([['帳號安全', [['變更密碼', '', 'data-go="pw"']]]])}</div>`;
  V.uvisit = () => {
    const f = S.uv || (S.uv = { family: '', note: '', ck: {} });
    const items = [['a', '家人同意，並由家人陪同'], ['b', '長輩本人同意'], ['c', '不拍人、不拍地址與門牌，不進浴室內部']];
    return `${J.stf('陪家人做居家觀察')}<div class="scroll" style="padding-top:12px">
      <div class="card"><label class="muted">家庭（例如：林媽媽家）<input class="fld" id="uvF" value="${esc(f.family)}" maxlength="40"></label>
      <label class="muted" style="display:block;margin-top:10px">觀察到的事（選填）<input class="fld" id="uvN" value="${esc(f.note)}" maxlength="200" placeholder="例如：走道晚上很暗、浴室門檻約 2 公分"></label></div>
      <div class="card"><b>開始前確認（三項都要）</b>${items.map(([k, t]) => `<button class="row" data-uvck="${k}" style="width:100%"><span>${f.ck[k] ? '☑' : '☐'} ${t}</span></button>`).join('')}</div>
      <div class="pad"><button class="btn" data-uvsend="1" ${items.every(([k]) => f.ck[k]) ? '' : 'disabled'}>送出，請門市確認</button></div></div>`;
  };
  J.LOAD.u0 = async () => { S.amb = await api('/amb/summary'); };
  J.LOAD.u1 = J.LOAD.u0;

  document.getElementById('view').addEventListener('click', async e => {
    const t = e.target.closest('[data-uvck],[data-uvsend],[data-co="reno"],[data-co="baby"],[data-co="pet"]'); if (!t || t.disabled) return;
    if (t.dataset.co) { e.stopPropagation(); await window.JJJFAM.cat(); window.JJJFAM.startCo([t.dataset.co], t.dataset.co === 'reno' ? '新家與老宅翻修' : '育兒與寵物模式'); return; }
    e.stopPropagation();
    const f = S.uv; f.family = (document.getElementById('uvF') || {}).value || f.family; f.note = (document.getElementById('uvN') || {}).value || f.note;
    if (t.dataset.uvck) { f.ck[t.dataset.uvck] = !f.ck[t.dataset.uvck]; render(); return; }
    try { await api('/amb/visits', { method: 'POST', body: { family: f.family, note: f.note, checks: f.ck } }); S.uv = null; S.stack = ['u1']; await J.LOAD.u1(); render(); toast('已送出，門市確認後加 50 點'); } catch (er) { toast(er.message); }
  }, true);
})();

// ---------- 會員中心「預約紀錄」「線上報修清單」：與揪居家同一份資料 ----------
(function () {
  const J = window.JJJ; if (!J) return;
  const { V, S, api, esc } = J;
  const st = s => `<span class="tag ${/完成|已處理|已回覆/.test(s) ? 'ok' : ''}">${esc(s)}</span>`;
  V.bks = () => { const L = S.bks; return `${J.hdr('預約紀錄')}<div class="scroll" style="padding-top:12px">${!L ? '<div class="card muted">載入中…</div>' : L.length ? `<div class="glist">${L.map(b => `<div class="gi" style="cursor:default"><span><b>${esc(b.kind)}</b><span class="muted" style="display:block;font-size:.85em">${esc(String(b.slot_start).replace('T', ' ').slice(0, 16))}｜${esc(String(b.store).replace('Digital City ', ''))}｜${esc(b.code)}</span></span>${st(b.status)}</div>`).join('')}</div>` : '<div class="card muted">目前沒有預約。</div>'}<p class="muted pad" style="font-size:.85em">全國電子原有的門市預約與揪居家的門市諮詢、到府安裝、保養都列在這裡。</p></div>`; };
  V.reqs = () => { const L = S.reqs; return `${J.hdr('線上報修清單')}<div class="scroll" style="padding-top:12px">${!L ? '<div class="card muted">載入中…</div>' : L.length ? `<div class="glist">${L.map(r => `<div class="gi" style="cursor:default"><span><b>${esc(r.kind)}</b><span class="muted" style="display:block;font-size:.85em">${esc(String(r.created_at).slice(0, 16))}${r.note ? '｜' + esc(r.note) : ''}</span></span>${st(r.status)}</div>`).join('')}</div>` : '<div class="card muted">目前沒有報修或保養需求。</div>'}<p class="muted pad" style="font-size:.85em">在揪居家按「詢問」「一鍵預約」送出的保養與設備問題，也在這裡追蹤。</p></div>`; };
  J.LOAD.bks = async () => { S.bks = (await api('/home/bookings')).bookings; };
  J.LOAD.reqs = async () => { S.reqs = (await api('/home/requests')).requests; };
})();

// ---------- 會員中心「保固清單」：我的購買、揪居家｜長輩家（與揪居家家電檔案同一份資料） ----------
(function () {
  const J = window.JJJ; if (!J) return;
  const { V, S, api, esc, toast, render } = J;
  const row = d => `<div class="gi" style="cursor:default"><span><b>${esc(d.name)}</b><span class="muted" style="display:block;font-size:.85em">保固：${esc(d.warranty || '—')}${d.years != null ? '｜使用 ' + d.years + ' 年' : ''}</span></span>${d.repairing ? '<span class="tag">報修中</span>' : `<button class="tag" data-repair="${d.id}">線上報修</button>`}</div>`;
  V.wty = () => { const W = S.wty; return `${J.hdr('保固清單')}<div class="scroll" style="padding-top:12px">${!W ? '<div class="card muted">載入中…</div>' : `
    <div class="sec">我的購買｜${W.mine.length}</div><div class="glist">${W.mine.length ? W.mine.map(row).join('') : '<div class="gi muted" style="cursor:default">沒有資料</div>'}</div>
    <div class="sec">揪居家｜長輩家（家人共用）｜${W.parents.length}</div><div class="glist">${W.parents.length ? W.parents.map(row).join('') : '<div class="gi muted" style="cursor:default">沒有資料</div>'}</div>
    ${W.care.length ? `<div class="sec">揪夜安方案設備｜${W.care.length}</div><button class="card" data-go="hf" style="display:flex;justify-content:space-between;align-items:center;width:calc(100% - 24px)"><span><b>由綁定門市負責</b><span class="muted" style="display:block;font-size:.85em">${esc(W.care.map(d => d.name).join('、'))}；故障請找生活顧問</span></span><span class="chev">›</span></button>` : ''}`}
    <div class="glist" style="margin-top:12px"><button class="gi" data-go="reqs"><span><b>線上報修清單</b></span><span class="chev">›</span></button></div></div>`; };
  J.LOAD.wty = async () => { S.wty = await api('/home/warranty'); };
  document.getElementById('view').addEventListener('click', async e => {
    const t = e.target.closest('[data-repair]'); if (!t) return; e.stopPropagation();
    try { const d = await api('/home/repair', { method: 'POST', body: { device_id: +t.dataset.repair } }); toast(d.duplicate ? '這台已在報修中' : '已送出線上報修，進度在「線上報修清單」'); if (J.S.stack[J.S.stack.length - 1] === 'wty') await J.LOAD.wty(); render(); } catch (er) { toast(er.message); }
  }, true);
})();
