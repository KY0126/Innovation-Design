// 揪居家 v5 擴充（消費者端）：看結果 → 選方式（一次一個空間）→ 交給生活顧問；材質款式；服務進度
// 原型：資料存在這台瀏覽器（模擬後端＋localStorage）；價格與工期皆為示範資料
(function () {
  const LSX = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const e = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const J = window.JJJ; if (!J || !J.V) return;

  // ---------- 改善方式資料（示範資料） ----------
  const FLOORS = {
    tile: { n: '止滑磁磚', s: [['霧面灰', '#A9ABAE'], ['木紋', '#C08A55'], ['米白', '#E8E1D2']] },
    click: { n: '止滑卡扣地板', s: [['淺橡木', '#D8B888'], ['深胡桃', '#6B4A33'], ['灰木紋', '#A39E95']] }
  };
  // 價格級距：1＝千元內、2＝一到三千元、3＝三千元以上（需估價）
  const SP = {
    hall: { n: '走道', l: 'r', why: '偏暗、有門檻，寬 92 cm', risk: '夜間起床走到浴室，地面看不清也容易滑。',
      combo: { fast: 'h_inst', cheap: 'h_inst', nodrill: 'h_inst' },
      opts: [
        { id: 'h_inst', t: '全國電子安裝', n: '感應夜燈', p: '千元內', lv: 1, d: '當天', by: '全國電子安裝', r: 'g', rec: 1 },
        { id: 'h_part', t: '簡易施工', n: '感應夜燈＋止滑卡扣地板', p: '一到三千元', lv: 2, d: '半天', by: '協力工班', r: 'g', floor: 'click', note: '不拆除、可復原，適合租屋' },
        { id: 'h_free', t: '免費調整', n: '鞋櫃移出走廊', p: '免費', lv: 0, d: '當天', by: '家人自行調整', r: 'r', note: '走道變寬，但暗的問題還在', more: 1 },
        { id: 'h_none', t: '不處理', n: '維持現況', p: '—', lv: 0, d: '—', by: '—', r: 'r', note: '保留紅燈與風險說明', more: 1 }
      ] },
    bath: { n: '浴室', l: 'y', why: '門檻 2 cm、磁磚地', more: '門往內開', risk: '夜間看不清高低差，地面濕了容易滑。',
      combo: { fast: 'b_inst', cheap: 'b_inst', nodrill: 'b_inst' },
      opts: [
        { id: 'b_inst', t: '全國電子安裝', n: '斜坡墊＋止滑地墊', p: '千元內', lv: 1, d: '當天', by: '全國電子安裝', r: 'g', ramp: 1, rec: 1 },
        { id: 'b_part', t: '簡易施工', n: '木作斜坡＋地面止滑', p: '一到三千元', lv: 2, d: '半天', by: '協力工班', r: 'g', ramp: 1 },
        { id: 'b_eng', t: '改造工程', n: '打除門檻、換止滑磚', p: '三千元以上', lv: 3, d: '約 3 天', by: '需到府估價', r: 'g', floor: 'tile', est: 1, sub: 1 },
        { id: 'b_free', t: '免費調整', n: '移除浴室地墊', p: '免費', lv: 0, d: '當天', by: '家人自行調整', r: 'y', note: '仍為黃燈：門檻高差還在', more: 1 },
        { id: 'b_door2', t: '簡易施工', n: '浴室門｜可從外側解鎖的把手', p: '一到三千元', lv: 2, d: '半天', by: '協力工班', r: 'y', note: '長輩若在浴室跌倒擋住門，家人可從外側開門', more: 1, door: 1 },
        { id: 'b_door3', t: '改造工程', n: '浴室門｜改外開門或橫拉門', p: '三千元以上', lv: 3, d: '約 1–3 天', by: '需到府估價', r: 'y', est: 1, more: 1, door: 1 },
        { id: 'b_none', t: '不處理', n: '維持現況', p: '—', lv: 0, d: '—', by: '—', r: 'y', note: '保留黃燈與風險說明', more: 1 }
      ] }
  };
  const LC = { r: ['紅燈', '#C42D5A'], y: ['黃燈', '#E0A030'], g: ['綠燈', '#138F3B'] };
  const ST = Object.assign({ sp: 'hall', sel: {}, ok: {}, style: {}, combo: 'fast', more: false, pct: 50, view: 'ar', door: {}, mount: 'tape' }, LSX.get('jjj_v5_opt2') || {});
  const save = () => LSX.set('jjj_v5_opt2', ST);
  const optOf = (sp, id) => SP[sp].opts.find(o => o.id === id);
  const cur = sp => optOf(sp, ST.sel[sp] || SP[sp].combo.fast);
  const PR = ['免費', '千元內', '一到三千元', '約 3 千元以上'];
  const lights = () => { const a = J.S.hh && J.S.hh.assessment; return (a && a.lights) || [['臥室', 'g', '無明顯風險'], ['走道', 'r', '夜間偏暗、路上有門檻'], ['浴室', 'y', '門檻約 2 cm，建議斜角處理'], ['廚房', 'g', '無明顯風險'], ['客廳', 'g', '無明顯風險'], ['門口', 'g', '無明顯風險']]; };
  const go = v => { const st = J.S.stack; const i = st.indexOf('optA'); J.S.stack = (i >= 0 ? st.slice(0, i + 1) : st.concat('optA')).concat(v === 'optA' ? [] : [v]); J.render(); };

  const CSS = `<style>.v5bar{position:sticky;bottom:-16px;margin-bottom:-16px;padding-bottom:28px!important;background:var(--card);border-top:1px solid var(--line);padding:10px 12px 12px;margin-top:8px}
  .v5bar .r{display:flex;justify-content:space-between;align-items:baseline;font-size:.92em;margin-bottom:8px}
  .v5o{display:block;width:calc(100% - 24px);margin:8px 12px;cursor:pointer}.v5o.on{border:2px solid var(--brand)}
  .v5o .rd{display:inline-block;width:18px;height:18px;border-radius:50%;border:2px solid var(--line);vertical-align:-3px;margin-right:8px}.v5o.on .rd{border:5px solid var(--brand)}
  .v5rec{font-size:.75em;border:1px solid var(--brand);color:var(--brand);border-radius:6px;padding:0 5px;margin-left:6px;font-weight:700}
  .v5sp{display:flex;align-items:center;gap:10px;width:100%;padding:12px 2px;border-top:1px solid var(--line);text-align:left}.v5sp:first-child{border-top:0}
  .v5dot{width:10px;height:10px;border-radius:50%;flex:none}.v5chip{font-size:.78em;border:1px solid var(--line);border-radius:6px;padding:1px 6px;margin-right:6px;color:var(--muted)}
  .v5st{display:flex;justify-content:space-between;margin-top:8px;font-size:.82em;text-align:center}.v5st span{flex:1}.v5st i{display:block;width:12px;height:12px;border-radius:50%;margin:0 auto 4px;border:2px solid var(--line)}
  .v5st .dn i{background:var(--ok);border-color:var(--ok)}.v5st .cu i{border-color:var(--brand);border-width:3px}.v5st .cu{font-weight:700}</style>`;

  // ---------- 實景前後對比（AR 畫面示意，不是施工圖） ----------
  function scene(sp, o, pct) {
    const st = o && o.floor ? (ST.style[o.id] || FLOORS[o.floor].s[0][0]) : null;
    const col = st ? FLOORS[o.floor].s.find(x => x[0] === st)[1] : null;
    const floorPoly = sp === 'hall' ? '305,688 490,688 660,1248 95,1248' : '318,618 478,618 478,684 318,684';
    const lit = sp === 'hall' && o && /夜燈/.test(o.n);
    const after = `${col ? `<polygon points="${floorPoly}" fill="${col}" fill-opacity=".72"/>` : ''}
      ${o && o.ramp ? '<polygon points="300,684 495,684 520,712 280,712" fill="#8F7A62"/><rect x="300" y="676" width="195" height="8" fill="#5E8F4A" opacity=".9"/>' : ''}
      ${lit ? [[150, 1150], [600, 1150], [330, 760], [470, 760]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="70" fill="url(#glow)"/><circle cx="${x}" cy="${y}" r="9" fill="#FFF3C4"/>`).join('') : ''}`;
    return `<div style="position:relative;aspect-ratio:780/600;overflow:hidden;background:#222">
      <svg viewBox="0 ${sp === 'hall' ? 620 : 300} 780 600" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0">
        <defs><radialGradient id="glow"><stop offset="0" stop-color="#FFE7A0" stop-opacity=".85"/><stop offset="1" stop-color="#FFE7A0" stop-opacity="0"/></radialGradient>
        <clipPath id="v5r"><rect x="${780 * pct / 100}" y="0" width="780" height="1248"/></clipPath></defs>
        <image href="ar/ar_plain.jpg" x="0" y="0" width="780" height="1248"/>
        <g clip-path="url(#v5r)">${lit ? '<rect width="780" height="1248" fill="#0B0E1A" opacity=".45"/>' : ''}${after}</g>
        <line x1="${780 * pct / 100}" y1="0" x2="${780 * pct / 100}" y2="1248" stroke="#fff" stroke-width="5"/>
      </svg>
      <span class="tag" style="position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.55);color:#fff">現在</span>
      <span class="tag" style="position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.55);color:#fff">選擇後${st ? '・' + e(st) : ''}</span></div>
      <input type="range" min="0" max="100" value="${pct}" data-v5cmp aria-label="左右滑動比較改善前後" style="width:100%;margin:0;accent-color:var(--brand)">`;
  }

  function optRow(sp, o) {
    const on = o.door ? !!(ST.door.on && ST.door.id === o.id) : (ST.sel[sp] ? ST.sel[sp] === o.id : SP[sp].combo.fast === o.id), L = LC[o.r];
    const fl = o.floor && on ? `<div style="margin-top:8px"><div class="muted" style="font-size:.85em">選擇款式（${FLOORS[o.floor].n}）</div><div style="display:flex;gap:12px;margin-top:6px">${FLOORS[o.floor].s.map(([n, c]) => {
      const cs = (ST.style[o.id] || FLOORS[o.floor].s[0][0]) === n;
      return `<button data-v5style="${e(o.id)}|${e(n)}" aria-pressed="${cs}" style="display:flex;flex-direction:column;align-items:center;gap:3px;font-size:.82em"><span style="width:38px;height:38px;border-radius:50%;background:${c};border:${cs ? '3px solid var(--brand)' : '1px solid var(--line)'}"></span>${cs ? '<b>' + e(n) + '</b>' : e(n)}</button>`; }).join('')}</div><div class="muted" style="font-size:.8em;margin-top:4px">換款式只改畫面與價格說明，燈號不變。</div></div>` : '';
    const line = o.p === '—' ? '不施工、不收費' : `${e(o.p)}・${e(o.d)}・${e(o.by)}`;
    return `<div class="card v5o ${on ? 'on' : ''}" role="radio" tabindex="0" aria-checked="${on}" data-v5opt="${e(sp)}|${e(o.id)}">
      <div class="row" style="align-items:flex-start"><span><span class="rd"></span><b>${e(o.n)}</b>${o.rec ? '<span class="v5rec">推薦</span>' : ''}</span><span style="color:${L[1]};font-size:.9em;white-space:nowrap">● ${L[0]}</span></div>
      <div class="muted" style="font-size:.86em;margin:2px 0 0 26px">${line}${o.sub ? '｜符合資格者可申請補助' : ''}</div>
      ${o.note ? `<div class="muted" style="font-size:.82em;margin:2px 0 0 26px">${e(o.note)}</div>` : ''}${fl}</div>`;
  }

  // 安裝方式：AI 依門框材質推薦，由家人選定（技師照著做）
  const MOUNT = { tape: { n: '背膠固定，不鑽孔', d: '門框為鋁框，AI 推薦；可完整撕除、不留孔', rec: 1 }, drill: { n: '鑽孔固定', d: '較牢固，但會在門框留下孔洞' } };
  const mountCard = () => `<div class="card"><b>安裝方式</b><span class="muted" style="font-size:.82em">　AI 依門框材質推薦，你來決定</span>
    ${Object.keys(MOUNT).map(k => { const m = MOUNT[k], on = ST.mount === k; return `<div class="v5o ${on ? 'on' : ''}" role="radio" tabindex="0" aria-checked="${on}" data-v5mount="${k}" style="width:100%;margin:8px 0 0;border:1px solid var(--line);border-radius:10px;padding:8px 10px${on ? ';border:2px solid var(--brand)' : ''}"><span class="rd"></span><b>${e(m.n)}</b>${m.rec ? '<span class="v5rec">AI 推薦</span>' : ''}<div class="muted" style="font-size:.84em;margin:2px 0 0 26px">${e(m.d)}</div></div>`; }).join('')}</div>`;

  // ---------- 1 看結果 ----------
  J.V.optA = function () {
    const L = lights(), red = L.filter(x => x[1] === 'r').length, yel = L.filter(x => x[1] === 'y').length, grn = L.length - red - yel;
    const need = Object.keys(SP), done = need.filter(k => ST.ok[k]);
    return `${CSS}${J.hdr('林媽媽家｜居家安全檢核')}<div class="scroll" style="padding-top:10px">
      <div class="card"><div class="muted" style="font-size:.88em">全國電子 AI 顧問阿國評估</div><div style="font-size:1.45em;font-weight:900;margin:2px 0"><span style="color:var(--brand)">${red + yel}</span> 個地方建議處理</div>
        <div class="muted" style="font-size:.88em"><span style="color:${LC.r[1]}">●</span> 紅燈 ${red}　<span style="color:${LC.y[1]}">●</span> 黃燈 ${yel}　<span style="color:${LC.g[1]}">●</span> 綠燈 ${grn}</div></div>
      ${J.cmpPlan ? J.cmpPlan('v5a', { L, pins: J.DPINS({ night: 1 }, 2), path: true, title: '2D 平面圖｜居家安全地圖' }) : ''}
      <div class="card" style="padding:4px 14px">
        ${need.map(k => { const s = SP[k], o = ST.ok[k] ? cur(k) : null; return `<button class="v5sp" data-v5go="${k}"><span class="v5dot" style="background:${LC[s.l][1]}"></span><span style="flex:1"><b>${s.n}</b><div class="muted" style="font-size:.86em">${o ? '已選：' + e(o.n) + ' → <span style="color:' + LC[o.r][1] + '">' + LC[o.r][0] + '</span>' : e(s.why) + (s.more ? '、' + e(s.more) : '')}</div></span><span class="muted">›</span></button>`; }).join('')}
        <div class="v5sp" style="cursor:default"><span class="v5dot" style="background:${LC.g[1]}"></span><span style="flex:1"><b>其他 ${grn} 個空間</b><div class="muted" style="font-size:.86em">沒有明顯風險</div></span></div></div>
      <div class="muted" style="font-size:.8em;padding:0 16px">燈號依《建築物無障礙設施設計規範》判斷，只協助排序、不取代專業評估。</div>
      <div class="v5bar"><div class="r"><span class="muted">${done.length ? '已選 ' + done.length + '／' + need.length + ' 個空間' : '尚未選擇改善方式'}</span></div>
        <button class="btn" data-v5toC ${done.length ? '' : 'style="opacity:.45"'}>${done.length === need.length ? '交給生活顧問' : '選好後請生活顧問報價'}</button></div></div>`;
  };

  // ---------- 2 選方式：一次只看一個空間 ----------
  J.V.opt = function () {
    const sp = ST.sp, S0 = SP[sp], o = cur(sp);
    const main = S0.opts.filter(x => !x.more), more = S0.opts.filter(x => x.more);
    const pins = J.DPINS({ night: 1 }, sp === 'bath' && o.ramp ? 0 : 2);
    return `${CSS}${J.hdr(S0.n)}<div class="scroll" style="padding-top:0">
      <div class="card" style="padding:0;overflow:hidden;margin-top:10px"><div style="display:flex;justify-content:center;padding:8px"><span class="seg" style="width:200px"><button data-v5view="ar" aria-pressed="${ST.view === 'ar'}">實景</button><button data-v5view="3d" aria-pressed="${ST.view === '3d'}">3D 居家模型</button></span></div>
        ${ST.view === 'ar' ? scene(sp, o, ST.pct) : ''}</div>
      ${ST.view === '3d' && J.cmpPlan ? J.cmpPlan('v5b', { L: lights(), pins, path: true, title: '3D 居家模型：夜燈亮起的範圍' }) : ''}
      <div class="pad"><b style="color:${LC[S0.l][1]}">● ${LC[S0.l][0]}</b>・<b>${e(S0.why)}</b><div class="muted" style="font-size:.88em">${e(S0.risk)}</div></div>
      <div class="pad" style="padding-top:0;padding-bottom:0"><span class="seg">${[['fast', '最快轉綠'], ['cheap', '最省錢'], ['nodrill', '不鑽孔']].map(([k, n]) => `<button data-v5combo="${k}" aria-pressed="${ST.combo === k}">${n}</button>`).join('')}</span></div>
      ${main.map(x => optRow(sp, x)).join('')}
      ${ST.more ? more.map(x => optRow(sp, x)).join('') : `<div class="pad" style="padding-top:0;text-align:center"><button class="muted" data-v5more style="text-decoration:underline">更多選擇：免費調整${sp === 'bath' ? '、浴室門' : ''}、不處理</button></div>`}
      ${sp === 'hall' && /全國|簡易/.test(o.t) ? mountCard() : ''}
      <div class="muted" style="font-size:.8em;padding:0 16px">價格與工期為示範資料；改造工程需到府估價，正式以生活顧問報價為準。</div>
      <div class="v5bar"><div class="r"><span>${e(S0.n)} <span style="color:${LC[S0.l][1]}">${LC[S0.l][0]}</span> → <b style="color:${LC[o.r][1]}">${LC[o.r][0]}</b></span><b>${o.lv ? PR[o.lv] : '免費'}</b></div>
        <button class="btn" data-v5ok>確定這個方式</button></div></div>`;
  };

  // ---------- 3 交給顧問：一張報價、看得到進度 ----------
  J.V.optC = function () {
    const picks = Object.keys(SP).map(k => [k, cur(k)]);
    const extra = (ST.door.on ? [['bath', optOf('bath', ST.door.id || 'b_door2')]] : []);
    const all = picks.concat(extra), lv = Math.max(...all.map(([, o]) => o.lv)), est = all.some(([, o]) => o.est);
    const allGreen = picks.every(([, o]) => o.r === 'g');
    const sel = J.S.hh && J.S.hh.plan ? J.S.hh.plan.sel : { night: 1 };
    return `${CSS}${J.hdr('改善方案｜林媽媽家')}<div class="scroll" style="padding-top:10px">
      ${J.cmpPlan ? J.cmpPlan('v5c', { L: lights(), pins: J.DPINS(sel && sel.night ? sel : { night: 1 }, picks.find(([k]) => k === 'bath')[1].ramp ? 0 : 2), path: true, title: '全屋改善前後（示意）' }) : ''}
      <div class="card"><b>已選的改善方式</b>${all.map(([k, o]) => `<div class="row"><span><span class="v5chip">${/簡易施工|改造工程/.test(o.t) ? '協力工班' : /全國/.test(o.t) ? '全國電子' : o.t === '免費調整' ? '自行調整' : '—'}</span>${e(SP[k].n)}｜${e(o.n)}</span><span class="muted" style="font-size:.85em">${e(o.d)}</span></div>`).join('')}
        <div class="row"><span><span class="v5chip">安裝方式</span>${e(MOUNT[ST.mount].n)}</span><span class="muted" style="font-size:.85em">家人選定</span></div>
        <div class="row"><span>六個空間</span><b style="color:${allGreen ? LC.g[1] : LC.y[1]}">● ${allGreen ? '全部綠燈（預估）' : '仍有待處理'}</b></div>
        <div class="muted" style="font-size:.8em;margin-top:4px">需要動工的項目由協力工班先完成，全國電子技師再安裝設備；完工後依實際條件重新判定燈號。</div>
        <div class="muted" style="font-size:.8em;margin-top:4px">計價方式：設備與長輩關懷月費以場域計價；地板、門檻等工程依 AR 量出的尺寸計價（地板按坪、燈條按公尺），由協力工班報價、生活顧問整合。</div></div>
      <div class="card"><b>進度</b>${J.JT([['dn', '', '選方式', '各空間的改善方式已選好'], ['cu', '現在', (LSX.get('jjj_v5_handoff') || []).length ? '估價｜進行中' : '估價｜下一步', '生活顧問整合成一張報價'], ['td', '', '長輩確認', '長輩本人同意才成交'], ['td', '', '施工', '協力工班先、全國電子技師後'], ['td', '', '驗收', '長輩逐區說「沒問題」']])}
        <div class="muted" style="font-size:.82em;margin-top:6px">長輩本人同意才成交；先施工、再安裝設備。協力工班施工附書面保固；符合資格者可申請長照居家無障礙改善補助，生活顧問協助轉介 1966，不保證核准。</div></div>
      <div class="muted" style="font-size:.8em;padding:0 16px">燈號只協助排序、不取代專業評估；對比為示意、不是施工圖。</div>
      <div class="v5bar"><div class="r"><span>一張報價（${est ? '含改造工程' : '全國電子＋協力工班'}）</span><b>${PR[lv] || '免費'}${est ? '・需到府估價' : ''}</b></div>
        <button class="btn" data-v5handoff>請生活顧問確認並報價</button></div></div>`;
  };
  if (J.TIP) { J.TIP.optA = '先看哪裡要處理：點走道或浴室，一次只看一個空間。'; J.TIP.opt = '拖曳前後對比，選一種改善方式，按「確定這個方式」。'; J.TIP.optC = '確認清單與進度，交給生活顧問整合成一張報價。'; }

  // ---------- 安裝進度頁：四端分工的服務進度 ----------
  const ip0 = J.V.ip;
  if (ip0) J.V.ip = function () {
    const html = ip0();
    return html;
  };

  // ---------- 互動 ----------
  const keepScroll = fn => { const sc = document.querySelector('.scroll'), y = sc ? sc.scrollTop : 0; fn(); const s2 = document.querySelector('.scroll'); if (s2) s2.scrollTop = y; };
  document.addEventListener('click', ev => {
    const t = ev.target.closest('[data-v5go],[data-v5opt],[data-v5style],[data-v5combo],[data-v5more],[data-v5view],[data-v5ok],[data-v5toC],[data-v5handoff],[data-v5mount]'); if (!t) return;
    if (t.dataset.v5mount) { ST.mount = t.dataset.v5mount; save(); keepScroll(J.render); return; }
    if (t.dataset.v5go) { ST.sp = t.dataset.v5go; ST.more = false; ST.pct = 50; save(); go('opt'); return; }
    if (t.dataset.v5style) { const [id, n] = t.dataset.v5style.split('|'); ST.style[id] = n; ev.stopPropagation(); save(); keepScroll(J.render); return; }
    if (t.dataset.v5opt) { const [sp, id] = t.dataset.v5opt.split('|'); const o = optOf(sp, id); if (o.door) { ST.door = ST.door.on && ST.door.id === id ? { on: false } : { on: true, id }; } else ST.sel[sp] = id; save(); keepScroll(J.render); return; }
    if (t.dataset.v5combo) { ST.combo = t.dataset.v5combo; ST.sel[ST.sp] = SP[ST.sp].combo[ST.combo]; save(); keepScroll(J.render); return; }
    if (t.hasAttribute('data-v5more')) { ST.more = true; save(); keepScroll(J.render); return; }
    if (t.dataset.v5view) { ST.view = t.dataset.v5view; save(); keepScroll(J.render); return; }
    if (t.hasAttribute('data-v5ok')) { ST.sel[ST.sp] = cur(ST.sp).id; ST.ok[ST.sp] = true; save(); const next = Object.keys(SP).find(k => !ST.ok[k]); if (next) { ST.sp = next; ST.more = false; save(); go('opt'); J.toast('已選好，接著看' + SP[next].n); } else go('optA'); return; }
    if (t.hasAttribute('data-v5toC')) { if (!Object.keys(ST.ok).length) { J.toast('先點走道或浴室，選一種改善方式'); return; } go('optC'); return; }
    if (t.hasAttribute('data-v5handoff')) {
      const items = Object.keys(SP).map(k => { const o = cur(k); return { space: SP[k].n, type: o.t, name: o.n, price: o.p, days: o.d, by: o.by, est: !!o.est, from: SP[k].l, to: o.r, style: o.floor ? (ST.style[o.id] || FLOORS[o.floor].s[0][0]) : null }; });
      if (ST.door.on) { const o = optOf('bath', ST.door.id); items.push({ space: '浴室門', type: o.t, name: o.n, price: o.p, days: o.d, by: o.by, est: !!o.est, from: 'y', to: o.r, style: null }); }
      const all = LSX.get('jjj_v5_handoff') || []; const d = new Date(), pad = n => String(n).padStart(2, '0');
      items.push({ space: '安裝方式', type: '全國電子安裝', name: MOUNT[ST.mount].n, price: '—', days: '—', by: '家人選定', est: false, from: 'g', to: 'g', style: null });
      all.unshift({ household: '林媽媽家', from: '陳小姐', at: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`, items });
      LSX.set('jjj_v5_handoff', all.slice(0, 5));
      J.toast('已交給生活顧問王小明，報價完成後通知你');
      const st = J.S.stack, i = st.indexOf('optA'); if (i >= 0) { J.S.stack = st.slice(0, i); J.render(); }
    }
  }, true);
  document.addEventListener('input', ev => { if (ev.target.matches && ev.target.matches('[data-v5cmp]')) { ST.pct = +ev.target.value; const c = ev.target.parentElement; const x = 780 * ST.pct / 100; const r = c.querySelector('clipPath rect'), l = c.querySelector('svg line'); if (r) r.setAttribute('x', x); if (l) { l.setAttribute('x1', x); l.setAttribute('x2', x); } save(); } });
})();
