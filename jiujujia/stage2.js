// 揪居家｜擴展期與延伸期畫面（介面藍圖 F24～F34）
// 營運階段由企業管理端「營運階段」分頁切換（D9），存在本機 localStorage（示範用）。
(function () {
  const J = window.JJJ; if (!J) return;
  const { V, hdr, toast, render, go } = J;
  const PHASES = ['試點期', '擴展期', '延伸期'];
  const ph = () => window.JJJPHASE ? window.JJJPHASE() : 0;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const L = { s: {} }; // 本模組自己的畫面狀態
  const need = n => n === 2 ? '延伸期' : '擴展期';
  // 階段標示：目前階段已開放 → 可操作；否則顯示「○○開放」並停用按鈕
  const open = n => ph() >= n;
  const bar = n => open(n)
    ? `<div class="card" style="background:var(--note);padding:8px 14px"><span class="tag ok">${need(n)}已開放</span> <span class="muted" style="font-size:.85em">目前營運階段：${PHASES[ph()]}</span></div>`
    : `<div class="card" style="background:var(--note);padding:8px 14px"><span class="rtag">${need(n)}開放</span> <span class="muted" style="font-size:.85em">目前為${PHASES[ph()]}，可先看內容；開放時優先通知</span></div>`;
  const act = (n, label, attr) => open(n)
    ? `<button class="btn" ${attr}>${label}</button>`
    : `<button class="btn ghost" disabled style="opacity:.6">${need(n)}開放後即可${label.replace(/^./, c => c)}</button>`;
  const light = c => `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${{ r: '#D4003C', y: '#E0A030', g: '#3E9B6B' }[c]};margin-right:6px;vertical-align:-1px"></span>`;
  const row = (go2, t, d, n) => `<button class="row" data-go="${go2}" style="width:100%"><span>${t}${n !== undefined ? ` <span class="${open(n) ? 'tag ok' : 'rtag'}" style="font-size:.75em">${need(n)}</span>` : ''}<span class="muted" style="display:block;font-size:.85em">${d}</span></span><span class="chev">›</span></button>`;
  const page = (t, body) => `${hdr(t)}<div class="scroll" style="padding-top:12px">${body}</div>`;

  const FIELDS = [
    ['night', '揪夜安', '臥室到浴室', 0, '夜間照明、異常先問再通知'],
    ['food', '揪食光', '廚房', 200, '忘記關火、瓦斯外洩'],
    ['tv', '揪團聚', '客廳', 150, '室溫過高、遠距視訊'],
    ['wash', '揪清爽', '洗衣陽台', 100, '不必爬高曬衣'],
  ];

  // A4 全家場域方案：同一組空間座標畫 3D（plan.jpg 疊範圍）與 2D 俯視平面圖
  const HPR = { bed: [0, 0, 4, 3.5], bath: [4, 0, 6.2, 3.5], ldy: [6.2, 0, 9, 3.5], hall: [0, 3.5, 9, 4.6], kit: [0, 4.6, 3.8, 8], liv: [3.8, 4.6, 9, 8], door: [7.2, 8, 9, 9] };
  const ZN = { bed: ['臥室', 'night'], hall: ['走道', 'night'], bath: ['浴室', 'night'], door: ['玄關', 'night'], kit: ['廚房', 'food'], liv: ['客廳', 'tv'], ldy: ['洗衣陽台', 'wash'] };
  const DEV2 = [['夜', 2.9, 1.6], ['夜', 3.4, 4.05], ['夜', 4.15, 3.2], ['檻', 4.6, 3.5], ['感', 5.2, 3.5], ['鈕', 5.7, 0.9], ['感', 7.55, 8.5]];
  const LBL2 = { hall: [7.4, 4.2], door: [8.45, 8.65] };
  const NPATH = [[2.85, 1.4], [3.05, 2.6], [3.45, 3.5], [3.6, 4.05], [4.8, 4.05], [5.0, 3.5], [4.9, 2.3], [4.75, 1.3]];
  function zoneMap() {
    const m = L.s.zm || '3d', on = k => ZN[k][1] === 'night', ex = open(1);
    const tabs = `<div class="tabs" role="tablist" style="margin:8px 0">${[['3d', '3D 居家模型'], ['2d', '2D 平面圖']].map(([k, n]) => `<button role="tab" data-zm="${k}" aria-selected="${m === k}">${n}</button>`).join('')}</div>`;
    let g = '';
    if (m === '3d') {
      const H = J.HPV, FT = J.HPJ.FT;
      Object.entries(HPR).forEach(([k, [x0, z0, x1, z1]]) => {
        const P = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => J.hpp(x + .05, FT + .02, z + .05).map(v => v.toFixed(0)).join(',')).join(' ');
        g += `<polygon points="${P}" fill="${on(k) ? 'rgba(196,45,90,.22)' : 'rgba(120,120,120,.12)'}" stroke="${on(k) ? '#D4003C' : '#8C9096'}" stroke-width="${on(k) ? 5 : 3}" ${on(k) ? '' : 'stroke-dasharray="10 8"'}/>`;
      });
      g += J.hpPath();
      Object.entries(HPR).forEach(([k, [x0, z0, x1, z1]]) => {
        const [px, py] = J.hpp((x0 + x1) / 2, FT + .5, (z0 + z1) / 2), f = FIELDS.find(F => F[0] === ZN[k][1]);
        g += `<text x="${px.toFixed(0)}" y="${py.toFixed(0)}" font-size="30" font-weight="700" text-anchor="middle" fill="${on(k) ? '#A3002E' : '#5E6168'}" stroke="#fff" stroke-width="8" paint-order="stroke">${ZN[k][0]}${on(k) ? '' : '｜' + f[1]}</text>`;
      });
      return `<div class="card zmap">${tabs}<div style="position:relative;border-radius:10px;overflow:hidden;background:#F6F3EE"><img src="home/plan.jpg" alt="林媽媽家 3D 居家模型：四個場域的範圍" style="display:block;width:100%"><svg viewBox="${H.join(' ')}" style="position:absolute;inset:0;width:100%;height:100%">${g}</svg></div>
        <div class="rs" style="margin-top:6px"><span style="color:#D4003C">■</span> 揪夜安（試點期可訂）：臥室、走道、浴室、玄關<br><span style="color:#8C9096">▢</span> ${ex ? '擴展期已開放' : '擴展期'}：揪食光、揪團聚、揪清爽</div></div>`;
    }
    const S = 30, X = x => (x * S + 10).toFixed(0), Z = z => (z * S + 10).toFixed(0);
    Object.entries(HPR).forEach(([k, [x0, z0, x1, z1]]) => {
      g += `<rect x="${X(x0)}" y="${Z(z0)}" width="${((x1 - x0) * S).toFixed(0)}" height="${((z1 - z0) * S).toFixed(0)}" fill="${on(k) ? '#FBEAF0' : '#F3F3F3'}" stroke="${on(k) ? '#D4003C' : '#9A9A9A'}" stroke-width="${on(k) ? 2 : 1.2}" ${on(k) ? '' : 'stroke-dasharray="5 4"'}/>`;
      const [lx, lz] = LBL2[k] || [(x0 + x1) / 2, z0 + .5];
      g += `<text x="${X(lx)}" y="${Z(lz)}" font-size="11" text-anchor="middle" fill="${on(k) ? '#A3002E' : '#666'}">${ZN[k][0]}</text>`;
    });
    g += `<polyline points="${NPATH.map(([x, z]) => X(x) + ',' + Z(z)).join(' ')}" fill="none" stroke="#D4003C" stroke-width="2" stroke-dasharray="4 3"/>`;
    DEV2.forEach(([c, x, z]) => { g += `<g transform="translate(${X(x)},${Z(z)})"><circle r="9" fill="#D4003C" stroke="#fff" stroke-width="2"/><text y="4" font-size="10" font-weight="700" text-anchor="middle" fill="#fff">${c}</text></g>`; });
    return `<div class="card zmap">${tabs}<svg viewBox="0 0 290 290" style="width:100%;display:block;background:#fff" role="img" aria-label="林媽媽家 2D 平面圖：揪夜安設備位置與夜間路線">${g}</svg>
      <div class="rs" style="margin-top:6px">夜＝感應夜燈　檻＝門檻提示燈條　感＝門窗感測器　鈕＝緊急按鈕；虛線是床邊到浴室的夜間路線</div>
      <div class="muted" style="font-size:.8em;margin-top:4px">依 3D 模型座標推出的示意圖，不是丈量施工圖；正式版由 AR 掃描（場勘）產生，生活顧問用來整合報價、技師當施工圖底圖。</div></div>`;
  }

  Object.assign(V, {
    // 入口：擴展期與延伸期功能總覽
    x0: () => page('揪居家接下來會開放', `
      <div class="card"><b>目前營運階段：${PHASES[ph()]}</b><div class="muted" style="font-size:.85em;margin-top:4px">試點只做揪夜安。決策點二（試點結束、四項門檻同時達標）通過後開放擴展期；決策點三（單店約 194 戶）通過後開放延伸期。</div></div>
      <div class="ly"><h3>擴展期｜同一個家多顧幾個地方</h3></div>
      <div class="card" style="padding:4px 14px">
        ${row('x24', '全家場域方案', '揪食光 +200、揪團聚 +150、揪清爽 +100', 1)}
        ${row('x26', '揪全家：全屋方案', '每月 699 元，比分開訂省 200 元', 1)}
        ${row('x27', '家電換新建議', '先保養延壽，效能不足才換新', 1)}
        ${row('x29', '異業加購', '延保搭居家意外險、冷氣清洗搭打掃', 1)}
        ${row('x30', '長輩關懷 2.0', '家裡現有的家電也能接入', 1)}
        ${row('x31', '揪夜安進階影像版', '長輩本人同意才裝，預設仍不裝鏡頭', 1)}
        ${row('x32', '揪食光：節氣食譜', '合作主廚食譜與節氣共煮', 1)}
        ${row('u3', '校園大使短影音任務', '拍攝前確認長輩同意、不露臉、不拍地址', 1)}
      </div>
      <div class="ly"><h3>延伸期｜新家庭也能用</h3></div>
      <div class="card" style="padding:4px 14px">
        ${row('x33', '新家與老宅翻修', 'AR 配置全屋家電，一次規劃到位', 2)}
        ${row('x34', '育兒與寵物模式', '嬰兒房溫濕度、寵物出門模式', 2)}
      </div>
      <p class="pad muted" style="font-size:.85em">揪夥伴商用版（日照據點、住宿機構、租屋代管、民宿、小店）另有專用版本，不在家庭 App 中。</p>`),

    // F24 全家場域方案
    x24: () => {
      const sel = L.s.f24 || (L.s.f24 = {});
      const add = FIELDS.slice(1).filter(f => sel[f[0]]);
      const sum = 449 + add.reduce((a, f) => a + f[3], 0);
      const all = add.length === 3;
      return page('全家場域方案', `${bar(1)}
      ${zoneMap()}
      <div class="card"><div class="muted" style="font-size:.85em">加購沿用已完成的 AR 掃描與家電檔案，只補掃新空間。月費依風險分級。</div></div>
      ${FIELDS.map(([k, n, w, p, d]) => k === 'night'
        ? `<div class="card" ><b>${n}｜${w}</b> <span class="tag ok">已訂閱</span><div class="rs">${d}｜安心方案 449 元／月</div></div>`
        : `<button class="card opt" data-x24="${k}" aria-pressed="${!!sel[k]}" ${open(1) ? '' : 'disabled style="opacity:.6"'} style="width:calc(100% - 24px);margin:0 12px 10px;text-align:left"><b>${n}｜${w}　+${p} 元／月</b><div class="rs">${d}</div></button>`).join('')}
      <div class="card"><div style="display:flex;justify-content:space-between"><span>每月合計</span><b>NT$ ${sum.toLocaleString('en-US')}</b></div>
      ${all ? `<div style="margin-top:8px;padding:8px 10px;background:#FBF3F3;border-radius:8px;font-size:.9em">四個場域都要了，改用<b>揪全家 699 元</b>每月可省 ${sum - 699} 元。</div><button class="btn" data-go="x26" style="margin-top:8px">改看揪全家</button>`
        : `<div style="margin-top:10px">${add.length || !open(1) ? act(1, '加購並交給生活顧問', 'data-req="加購場域方案"') : '<button class="btn ghost" disabled style="opacity:.6">先選要加購的場域</button>'}</div>`}</div>
      <button class="btn ghost" data-go="x25" style="margin:0 12px 12px;width:calc(100% - 24px)">揪食光：先看廚房診斷結果</button>`);
    },

    // F25 揪食光：廚房診斷
    x25: () => page('揪食光｜廚房診斷結果', `${bar(1)}
      <div class="card"><b>林媽媽家廚房（示意）</b><div class="muted" style="font-size:.85em;margin:2px 0 8px">依 AR 掃描與家電檔案判斷</div>
      ${[['r', '爐具', '傳統瓦斯爐、無熄火保護'], ['r', '偵測器', '沒有煙霧與瓦斯偵測器'], ['y', '插座', '電鍋與微波爐共用一個插座'], ['g', '照明', '流理台亮度足夠']].map(([c, n, d]) => `<div style="padding:6px 0;border-top:1px solid var(--line,#eee)">${light(c)}<b>${n}</b><div class="rs" style="margin-left:18px">${d}</div></div>`).join('')}</div>
      <div class="card"><b>建議組合</b><div class="rs" style="line-height:1.8">IH 爐或熄火保護瓦斯爐、煙霧與瓦斯偵測器、排油煙機（商品不指名品牌）</div>
      <div class="muted" style="font-size:.85em;margin-top:6px">瓦斯管線與插座迴路由協力工班施工；全國電子技師負責設備安裝與教學。</div></div>
      <div class="pad">${act(1, '選擇改善方式', 'data-req="揪食光改善方式"')}</div>`),

    // F26 揪全家
    x26: () => page('揪全家｜全屋方案', `${bar(1)}
      <div class="card" ><b style="font-size:1.1em">揪全家　每月 NT$ 699</b>
      <div class="rs" style="line-height:1.8;margin-top:6px">・四個場域一起顧：臥室到浴室、廚房、客廳、洗衣陽台<br>・安心等級服務：生活顧問每月關心、年度健檢<br>・首年設定費減免</div></div>
      <div class="card"><b>和分開訂購比較</b>
      ${[['揪夜安｜安心方案', 449], ['揪食光', 200], ['揪團聚', 150], ['揪清爽', 100]].map(([n, p]) => `<div style="display:flex;justify-content:space-between;padding:4px 0"><span class="muted">${n}</span><span>${p} 元</span></div>`).join('')}
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--line,#eee)"><span>分開訂合計</span><s>899 元</s></div>
      <div style="display:flex;justify-content:space-between"><b>改用揪全家</b><b style="color:#D4003C">699 元｜每月省 200 元（約兩成）</b></div></div>
      <div class="pad">${act(1, '請生活顧問正式報價', 'data-req="揪全家正式報價"')}</div>`),

    // F27 家電換新建議
    x27: () => page('家電換新建議', `${bar(1)}
      <div class="card"><div class="muted" style="font-size:.85em">依家電檔案的使用年限與用電變化判斷。原則是先保養延壽，效能真的不足才建議換新，舊機由技師回收。</div></div>
      ${[['客廳冷氣', '11 年', '用電比去年多約 18%', 'y', '先清洗保養，再觀察一季', null], ['洗衣機', '13 年', '脫水異音、門封老化', 'r', '建議換新（含舊機回收）', 'x28'], ['冰箱', '6 年', '用電穩定', 'g', '維持年度健檢即可', null]].map(([n, y, d, c, s, nx]) => `<div class="card">${light(c)}<b>${n}</b> <span class="muted">已用 ${y}</span><div class="rs" style="margin-left:18px">${d}</div><div style="margin:6px 0 0 18px;font-size:.92em"><b>${s}</b></div>${nx ? `<button class="btn ghost" data-go="${nx}" style="margin-top:8px">看以租代買試算</button>` : ''}</div>`).join('')}`),

    // F28 以租代買試算
    x28: () => {
      const t = L.s.term || 36;
      return page('以租代買試算', `${bar(1)}
      <div class="card"><b>洗衣機（洗脫烘）</b><div class="seg" role="group" aria-label="期數" style="margin-top:8px"><button data-term="36" aria-pressed="${t === 36}">36 期</button><button data-term="60" aria-pressed="${t === 60}">60 期</button></div>
      <div style="display:flex;justify-content:space-between;margin-top:10px"><span>每月租金</span><b>○○ 元（示意）</b></div>
      <div class="muted" style="font-size:.85em">免押金；實際金額於擴展期與租賃公司或原廠議定。</div></div>
      <div class="card"><b>租金內含</b><div class="rs" style="line-height:1.8">安裝、每年清洗、耗材與保固</div>
      <b style="display:block;margin-top:8px">${t} 期期滿後</b><div class="rs" style="line-height:1.8">家電歸您，或換新機並回收舊機</div></div>
      <div class="pad">${act(1, '請生活顧問報價', `data-req="以租代買 ${t} 期報價"`)}</div>`);
    },

    // F29 異業加購
    x29: () => {
      const s = L.s.f29 || (L.s.f29 = {});
      return page('異業加購', `${bar(1)}
      ${[['ins', '延保搭居家意外險', '合作產險', '保費不使用長輩關懷資料'], ['clean', '冷氣清洗搭居家打掃', '合作清潔業者', '由生活顧問統一排程，同一天到府']].map(([k, n, w, d]) => `<button class="card opt" data-x29="${k}" aria-pressed="${!!s[k]}" ${open(1) ? '' : 'disabled style="opacity:.6"'} style="width:calc(100% - 24px);margin:0 12px 10px;text-align:left"><b>${n}</b> <span class="muted" style="font-size:.85em">${w}</span><div class="rs">${d}</div></button>`).join('')}
      <div class="card" style="background:var(--note)"><div class="muted" style="font-size:.88em">回饋以全國電子點數計算；合作夥伴看不到長輩關懷資料。</div></div>
      <div class="pad">${act(1, '交給生活顧問報價', 'data-req="異業加購"')}</div>`);
    },

    // F30 長輩關懷 2.0
    x30: () => page('長輩關懷 2.0', `${bar(1)}
      <div class="card"><div class="muted" style="font-size:.85em">支援共通標準的既有家電可直接接入，不必全部換新。</div></div>
      <div class="card"><b>家電檔案中的設備</b>
      ${[['冷氣（2021 年）', 1], ['除濕機（2023 年）', 1], ['電視（2016 年）', 0], ['電鍋', 0]].map(([n, ok]) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--line,#eee)"><span>${n}</span>${ok ? '<span class="tag ok">可接入</span>' : '<span class="muted">無法接入</span>'}</div>`).join('')}
      <div class="muted" style="font-size:.85em;margin-top:6px">無法接入的設備可拍銘牌建檔，仍可收到保養提醒。</div></div>
      <div class="pad">${act(1, '接入可用的設備', 'data-req="長輩關懷 2.0 接入"')}</div>`),

    // F31 進階影像版
    x31: () => {
      const c = L.s.f31 || (L.s.f31 = {});
      const items = [['a', '長輩本人書面同意'], ['b', '只裝門口，臥室與浴室不裝'], ['c', '本機錄影不上傳；異常且長輩未回應才傳截圖'], ['d', '長輩可隨時暫停或刪除']];
      const all = items.every(([k]) => c[k]);
      return page('揪夜安｜進階影像版', `${bar(1)}
      <div class="card"><div class="muted" style="font-size:.85em">預設仍不裝鏡頭。長輩不同意，就維持無鏡頭版，所有關懷功能照常。</div></div>
      <div class="card"><b>門口攝影機（選配）啟用前，四項都要確認</b>
      ${items.map(([k, t]) => `<button class="row" data-x31="${k}" style="width:100%" aria-pressed="${!!c[k]}"><span>${c[k] ? '☑' : '☐'} ${t}</span></button>`).join('')}</div>
      <div class="pad">${all ? act(1, '交給長輩本人確認', 'data-req="進階影像版長輩確認"') : '<button class="btn ghost" disabled style="opacity:.6">四項都確認後才能送出</button>'}</div>`);
    },

    // F32 節氣食譜
    x32: () => page('揪食光｜節氣食譜', `${bar(1)}
      <div class="card"><b>冬至｜IH 爐煮桂圓紅棗湯圓（示意）</b><div class="rs" style="line-height:1.8;margin-top:4px">合作主廚依您家的設備推薦做法：IH 爐中火 8 分鐘，不必顧火；料理完成會提醒關爐。</div></div>
      <div class="card"><b>Digital City 節氣共煮</b><div class="rs" style="line-height:1.8;margin-top:4px">12/21（日）14:00｜Digital City 高雄民族店（示意）<br>主廚示範、生活顧問接待，可帶長輩一起來</div>
      <div style="margin-top:8px">${act(1, '報名', 'data-req="節氣共煮報名"')}</div></div>`),

    // U3 校園大使：短影音任務（擴展期）
    u3: () => {
      const c = L.s.u3 || (L.s.u3 = {}), st = L.s.u3st || '';
      const items = [['a', '長輩本人同意拍攝（家人在場確認）'], ['b', '不拍長輩的臉，只拍設備與動線'], ['c', '不拍地址、門牌與窗外街景'], ['d', '不進臥室與浴室內部拍攝']];
      const all = items.every(([k]) => c[k]);
      const flow = [['拍攝', '60 秒以內，主題擇一'], ['送審', '生活顧問與總部審核隱私與用語'], ['上架', '審核通過後由全國電子官方社群發布'], ['獎勵', '每月任務津貼＋團隊點數，不抽成、不做個人排名']];
      return page('校園大使｜短影音任務', `${bar(1)}
      <div class="card"><b>文藻外語大學 × Digital City 高雄民族店（規劃洽談，畫面示意）</b><div class="rs" style="margin-top:4px">把居家觀察學到的事，拍成 60 秒短影音，讓更多家人知道長輩夜裡怎麼走才安全。</div></div>
      <div class="card"><b>本月主題（擇一）</b>
        ${[['t1', '夜裡起床的那 5 步：臥室到浴室怎麼亮'], ['t2', '門檻 2 公分也會絆倒：三種不鑽孔的改法'], ['t3', '節氣共煮花絮：主廚示範、顧問接待']].map(([k, t]) => `<button class="row" data-u3t="${k}" style="width:100%" aria-pressed="${L.s.u3t === k}"><span>${L.s.u3t === k ? '◉' : '○'} ${t}</span></button>`).join('')}</div>
      <div class="card"><b>拍攝前確認（四項都要勾）</b>
        ${items.map(([k, t]) => `<button class="row" data-u3="${k}" style="width:100%" aria-pressed="${!!c[k]}"><span>${c[k] ? '☑' : '☐'} ${t}</span></button>`).join('')}</div>
      <div class="card"><b>任務流程</b>${flow.map(([n, d], i) => `<div style="display:flex;gap:10px;padding:6px 0;border-top:1px solid var(--line,#eee)"><b style="flex:none;width:44px;color:#D4003C">${i + 1} ${n}</b><span class="rs">${d}</span></div>`).join('')}</div>
      ${st ? `<div class="card" style="background:var(--ok-soft)"><b>已送審</b><div class="rs">生活顧問與總部審核後通知你；審核不通過會說明要修改哪裡。</div></div>` : ''}
      <div class="pad">${!open(1) ? '<button class="btn ghost" disabled style="opacity:.6">擴展期開放後即可上傳</button>' : st ? '<button class="btn ghost" disabled style="opacity:.6">已送審，等待審核</button>' : (all && L.s.u3t) ? '<button class="btn" data-u3send="1">上傳影片並送審（示意）</button>' : '<button class="btn ghost" disabled style="opacity:.6">選好主題、四項都確認後才能上傳</button>'}</div>`);
    },

    // F33 新家與老宅翻修
    x33: () => {
      const t = L.s.f33 || 'old';
      return page('新家與老宅翻修', `${bar(2)}
      <div class="seg" role="group" aria-label="類型" style="margin:0 12px 10px"><button data-f33="old" aria-pressed="${t === 'old'}">老宅翻修</button><button data-f33="new" aria-pressed="${t === 'new'}">搬新家</button></div>
      ${t === 'old'
        ? `<div class="card"><b>老宅翻修</b><div class="rs" style="line-height:1.8;margin-top:4px">AR 掃描現況並對照家電檔案，翻修時一次換掉老舊家電，並一併做揪夜安的夜間動線改善；家電配合裝潢時程進場。</div></div>`
        : `<div class="card"><b>搬新家</b><div class="rs" style="line-height:1.8;margin-top:4px">AR 量好每個空間，直接配好全屋家電與揪全家；大型家電可用以租代買。新成屋可由合作建商在交屋時配好。</div></div>`}
      <div class="card" style="background:var(--note)"><div class="muted" style="font-size:.88em">泥作、水電等工程由協力工班施工。</div></div>
      <div class="pad">${act(2, '開始 AR 掃描', `data-req="${t === 'old' ? '老宅翻修' : '搬新家'} AR 配置"`)}</div>`);
    },

    // F34 育兒與寵物模式
    x34: () => {
      const t = L.s.f34 || 'baby';
      return page('育兒與寵物模式', `${bar(2)}
      <div class="seg" role="group" aria-label="模式" style="margin:0 12px 10px"><button data-f34="baby" aria-pressed="${t === 'baby'}">育兒</button><button data-f34="pet" aria-pressed="${t === 'pet'}">寵物</button></div>
      ${t === 'baby'
        ? `<div class="card"><b>嬰兒房</b><div style="display:flex;justify-content:space-between;margin-top:6px"><span>溫度／濕度</span><b>24°C／72%</b></div><div class="rs" style="color:#D4003C">濕度偏高（建議 50–60%）</div><button class="btn" data-x34="dry" style="margin-top:8px">一鍵開除濕機</button></div>
           <div class="card"><div class="rs">夜間餵奶沿用揪夜安的感應夜燈，起身就亮、不吵醒寶寶。</div></div>`
        : `<div class="card"><b>出門模式</b><div class="rs" style="line-height:1.8;margin-top:4px">出門後維持冷氣與除濕；室溫過高、門窗沒關好會提醒。</div><button class="btn" data-x34="away" style="margin-top:8px">開啟出門模式</button></div>
           <div class="card"><div class="rs">預設不裝鏡頭。</div></div>`}`);
    },
  });

  // 既有畫面的入口（介面藍圖：F01 揪居家 → F33、F02 家庭模式 → F34、F15 家電健康卡 → F27）
  window.JJJS2 = {
    entry(where, ctx) {
      if (where === 'm2') {
        const mine = !ctx; // ctx = 是否在「長輩家」分頁
        return `<div class="card" style="display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,#FBF3F3,#fff)">${window.JJJS2.logo(52)}<div><b style="color:#A3002E">揪居家，讓家更有電</b><div class="rs" style="font-size:.82em">先揪懂一個家，再揪順每次服務，<br>最後揪大家一起想</div></div></div><div class="card" style="padding:4px 14px"><div class="muted" style="font-size:.85em;padding:8px 0 2px">揪居家接下來會開放</div>
          ${mine ? row('x34', '育兒與寵物模式', '嬰兒房溫濕度、寵物出門模式', 2) : row('x24', '其他場域方案', '揪食光、揪團聚、揪清爽、揪全家', 1)}
          ${row('x33', '新家與老宅翻修', 'AR 配置全屋家電，一次規劃到位', 2)}
          ${row('x0', '看全部擴展期與延伸期功能', `目前營運階段：${PHASES[ph()]}`)}</div>`;
      }
      if (where === 'hc') {
        const h = ctx || {}, old = h.years != null && h.years >= 8;
        return `<div class="card" style="padding:4px 14px">${row('x27', old ? `已用 ${h.years} 年：看換新建議` : '家電換新建議', '先保養延壽，效能不足才換新；可選以租代買', 1)}</div>`;
      }
      if (where === 'obsR') { // U2 → U3：校園大使下一個任務
        return `<button class="btn ghost" data-go="u3">下一個任務：60 秒短影音${open(1) ? '' : '（擴展期開放）'}</button>`;
      }
      if (where === 'a1') { // 生活顧問手機版：依目前階段提醒可提案的方案
        const p = ph();
        const t = ['試點期｜只提案揪夜安（基本 299／安心 449）；其他場域可幫家人登記', '擴展期｜可加購揪食光 +200、揪團聚 +150、揪清爽 +100，四場域改揪全家 699；可提以租代買', '延伸期｜另可接新家與老宅翻修、育兒與寵物家庭'][p];
        return `<div class="card" style="background:var(--note);padding:8px 14px"><span class="${p ? 'tag ok' : 'rtag'}">營運階段</span> <span style="font-size:.88em">${t}</span></div>`;
      }
      return '';
    },
  };

  // ---------- 揪心願（參考 LEGO Ideas：寫作模板、推薦標籤、相似比對、三段門檻、每季審查） ----------
  const W_FIELD = ['臥室到浴室', '廚房', '客廳', '洗衣陽台', '全屋'];
  const W_NEED = ['防跌照明', '用火用電安全', '聯絡與陪伴', '省力家事', '節電與保養', '無障礙改善'];
  const W_WHO = ['長輩', '育兒', '寵物'];
  const W_PRICE = ['1,000 元以內', '1,000–3,000 元', '3,000 元以上'];
  // 既有主題的標籤與期限（示意）
  const W_META = {
    dim: { f: '臥室到浴室', n: ['防跌照明'], left: 0, kw: ['夜燈', '亮', '刺眼', '光'] },
    switch: { f: '臥室到浴室', n: ['防跌照明', '省力家事'], left: 45, kw: ['開關', '按鍵', '床邊', '按'] },
    voice: { f: '全屋', n: ['聯絡與陪伴'], left: 21, kw: ['報平安', '語音', '電話', '聯絡'] },
    mat: { f: '臥室到浴室', n: ['無障礙改善'], left: 63, kw: ['止滑', '地墊', '滑', '浴室'] },
  };
  const W_STAGES = [[20, '30 天內 20 戶'], [50, '90 天內 50 戶'], [100, '100 戶進入每季審查']];
  const wf = () => L.s.wf || (L.s.wf = { who: '長輩', field: '臥室到浴室', need: [], obj: '長輩', price: '' });
  const chip = (attr, v, on, dis) => `<button class="slot" style="margin:0 6px 8px 0${dis ? ';opacity:.5' : ''}" ${attr}="${esc(v)}" aria-pressed="${!!on}" ${dis ? 'disabled' : ''}>${esc(v)}</button>`;
  const BAN = [[/治療|療效|醫療|復健效果|保證不跌|防止中風/, '不寫醫療效果'], [/飛利浦|Philips|小米|國際牌|Panasonic|Tapo|TP-Link|大金|日立|三星|LG/i, '不指名品牌'], [/臉|門牌|地址|住址/, '不放長輩可辨識影像或地址']];
  function similar(f) {
    const txt = [f.when, f.stuck, f.hope].join(' ');
    const T = (J.S.topics && J.S.topics.topics) || Object.keys(W_META).map(id => ({ id, n: { dim: '可調光感應夜燈', switch: '床邊大按鍵開關', voice: '睡前語音報平安', mat: '浴室門口止滑地墊' }[id] }));
    return T.filter(t => { const m = W_META[t.id]; if (!m) return false; return m.kw.some(k => txt.includes(k)) || (m.f === f.field && f.need.some(n => m.n.includes(n)) && txt.trim()); }).slice(0, 2);
  }
  Object.assign(V, {
    wish: () => {
      const f = wf(), sim = similar(f), warn = BAN.filter(([re]) => re.test([f.when, f.stuck, f.hope].join(' '))).map(x => x[1]);
      const pilotOther = ph() < 1 && f.field !== '臥室到浴室';
      const fld = (k, label, ph2) => `<label class="muted" style="display:block;margin-bottom:8px">${label}<input class="fld" data-wf="${k}" value="${esc(f[k] || '')}" placeholder="${ph2}" style="margin-top:4px"></label>`;
      const th = THEMES.find(x => x.id === f.theme), hasB = Object.keys(bld()).length;
      return page('許一個揪心願', `
      ${th ? `<div class="card" ><div class="muted" style="font-size:.85em">全國出題｜${th.by}</div><b>${th.n}</b><div class="rs">獎勵：${th.rw}</div></div>` : ''}
      <div class="card" style="background:var(--note)"><b>官方寫作模板</b><div class="rs">照著填，生活顧問與總部就能看懂、比對與審查。內容只有門市與總部看得到，心願牆只顯示整理過的主題。</div></div>
      <div class="card">
        <div class="muted">誰遇到</div><div>${['長輩', '孫輩', '我自己', '其他家人'].map(v => chip('data-wwho', v, f.who === v)).join('')}</div>
        <div class="muted">在哪裡（場域，必選一）</div><div>${W_FIELD.map(v => chip('data-wfield', v, f.field === v)).join('')}</div>
        ${fld('when', '什麼時候', '例：半夜起床上廁所')}
        ${fld('stuck', '卡在哪', '例：感應夜燈太亮，很刺眼')}
        ${fld('hope', '希望（一句話，必填）', '例：亮度可以調低的感應夜燈')}
        <div class="muted">需求類型（選一到兩個）</div><div>${W_NEED.map(v => chip('data-wneed', v, f.need.includes(v), !f.need.includes(v) && f.need.length >= 2)).join('')}</div>
        <div class="muted">對象</div><div>${W_WHO.map(v => chip('data-wobj', v, f.obj === v, v !== '長輩' && ph() < 2)).join('')}${ph() < 2 ? '<span class="muted" style="font-size:.8em">育兒、寵物於延伸期開放</span>' : ''}</div>
        <div class="muted">希望價格帶</div><div>${W_PRICE.map(v => chip('data-wprice', v, f.price === v)).join('')}</div>
        <div class="muted" style="font-size:.85em">照片（選填）：只拍空間，不拍人、不拍地址與門牌</div>
      </div>
      ${warn.length ? `<div class="card" ><b>全國電子 AI 顧問阿國提醒</b><div class="rs">內容可能違反「${warn.join('、')}」，請修改後再送出。</div></div>` : ''}
      ${sim.length ? `<div class="card" ><b>全國電子 AI 顧問阿國：找到相似心願</b><div class="rs" style="margin-bottom:6px">直接去按「我也需要」，比重新提案更快達到門檻。</div>${sim.map(t => `<button class="row" data-go="wall" style="width:100%"><span>${esc(t.n)}</span><span class="chev">去共鳴 ›</span></button>`).join('')}</div>` : ''}
      ${pilotOther ? '<div class="card" style="background:var(--note)"><div class="rs">試點期只量產「臥室到浴室」的心願；這個場域的心願會累積起來，作為擴展期開放新場域的需求證據。</div></div>' : ''}
      <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><b>拼出預覽圖與做法卡</b><div class="rs">${hasB ? `已附 ${hasB} 個零件的做法卡` : '選填：在居家地圖上拼給大家看，更容易得到共鳴'}</div></div><button class="btn ghost" data-go="${hasB ? 'wcard' : 'wbuild'}" style="width:auto;margin:0">${hasB ? '查看' : '去拼'}</button></div></div>
      <textarea id="wishtxt" hidden></textarea>
      <div class="pad"><button class="btn" data-a="wishSend" ${warn.length ? 'disabled style="opacity:.6"' : ''}>送出心願</button>
      <p class="muted" style="font-size:.85em">我們會認真評估每一個心願，但無法保證都能實現；有進度時會通知您。</p></div>`);
    },
  });
  const wallShow = t => { if ((L.s.wline || 'own') === 'hq') return false; const m = W_META[t.id] || {}; const g = L.s.wtag; return !g || m.f === g || (m.n || []).includes(g); };
  Object.assign(window.JJJS2 || (window.JJJS2 = {}), {
    wallHead() {
      const g = L.s.wtag || '';
      if ((L.s.wline || 'own') === 'hq') return this.lineTabs() + this.themes();
      return this.lineTabs() + `<div class="pad" style="padding-top:0"><div class="muted" style="font-size:.85em;margin-bottom:4px">依標籤篩選</div>${['', '臥室到浴室', '全屋', '防跌照明', '聯絡與陪伴', '無障礙改善'].map(v => `<button class="slot" style="margin:0 6px 8px 0" data-wtag="${v}" aria-pressed="${g === v}">${v || '全部'}</button>`).join('')}</div>`;
    },
    wallShow,
    wallCard(t) {
      const m = W_META[t.id] || { f: '', n: [], left: 0 }, c = t.c;
      const tags = `<div style="margin-top:6px">${[m.f, ...m.n].filter(Boolean).map(x => `<span class="tag" style="margin-right:4px">#${esc(x)}</span>`).join('')}</div>`;
      const stage = W_STAGES.findIndex(([n]) => c < n);
      const marks = W_STAGES.map(([n]) => `<span style="position:absolute;left:${n}%;top:-3px;width:2px;height:14px;background:#3D3A40;opacity:.35"></span>`).join('');
      const bar = `<div style="position:relative;margin:12px 0 4px"><div class="pbar" style="margin:0"><i style="width:${Math.min(100, c)}%"></i></div>${marks}</div><div style="position:relative;height:1.3em;font-size:.75em" class="muted"><span style="position:absolute;left:0">0</span>${W_STAGES.map(([n]) => `<span style="position:absolute;white-space:nowrap;left:${n}%;transform:translateX(${n === 100 ? '-100%' : '-50%'})">${n}${n === 100 ? ' 戶' : ''}</span>`).join('')}</div>`;
      const msg = t.st === 'pre' ? `${c} 個家庭也需要｜已通過每季審查，開放預購`
        : stage < 0 ? `${c} 個家庭也需要｜已達 100 戶，進入下一次每季審查`
        : `${c} 個家庭也需要｜第 ${stage + 1} 關：${W_STAGES[stage][1]}，還差 ${W_STAGES[stage][0] - c} 戶${m.left ? `、剩 ${m.left} 天` : ''}`;
      return tags + bar + `<div class="muted" style="font-size:.88em">${msg}</div>` + this.topicExtra(t);
    },
    wallTail() {
      if ((L.s.wline || 'own') === 'hq') return '';
      return `<div class="card" style="border-style:dashed"><div style="display:flex;justify-content:space-between"><b>爐火忘關自動提醒</b><span class="tag">擴展期證據</span></div><div class="muted" style="font-size:.9em">#廚房 #用火用電安全｜23 個家庭提出</div><div class="rs" style="margin-top:6px">試點期只量產臥室到浴室；廚房的心願先累積，作為擴展期開放揪食光的需求證據。</div></div>`;
    },
  });

  // ---------- 揪心願：拼出預覽圖、做法卡、改版、闖關、我家出題／全國出題、品牌觸點 ----------
  const SLOTS = [['床邊', 3.08, 1.0], ['床尾', 3.35, 2.6], ['走道', 4.2, 3.66], ['門檻', 4.7, 3.55], ['浴室門口', 5.3, 3.25], ['浴室內', 5.6, 2.0]];
  const ITEMS = {
    light: { n: '感應夜燈', c: '燈', p: 390, tool: 0, min: 5, step: s => `在${s}離地約 30 公分貼一顆感應夜燈（背膠，不鑽孔）` },
    strip: { n: '門檻提示燈條', c: '條', p: 590, tool: 0, min: 8, step: s => `在${s}貼門檻提示燈條，讓高低差在夜裡看得見` },
    btn: { n: '床邊大按鍵開關', c: '鈕', p: 490, tool: 0, min: 5, step: s => `把無線大按鍵開關貼在${s}伸手就按得到的地方` },
    mat: { n: '止滑地墊', c: '墊', p: 350, tool: 0, min: 2, step: s => `在${s}鋪止滑地墊，邊緣貼平不翹起` },
    rail: { n: '起身扶手', c: '扶', p: 2800, tool: 1, min: 40, step: s => `在${s}安裝起身扶手（需鑽孔，由技師施工）` },
  };
  const DEMO_BUILD = { 0: 'light', 2: 'light', 3: 'strip', 4: 'light' }; // 「可調光感應夜燈」示範做法
  const bld = () => L.s.build || (L.s.build = {});
  const pts = () => L.s.pts || (L.s.pts = { total: 0, lv: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  const award = (lv, n, msg) => { const P = pts(); if (P.lv[lv]) { toast('這一關已完成，同一個心願每關只計一次'); return; } P.lv[lv] = 1; P.total += n; toast(`${msg}｜+${n} 點（生活顧問檢核後入帳）`); };
  function buildSvg(b, night, edit) {
    const H = J.HPV, sel = L.s.bitem;
    const pins = Object.entries(b).map(([i, k]) => ({ x: SLOTS[i][1], y: SLOTS[i][2], k: k === 'light' || k === 'strip' ? 'light' : k }));
    let g = night ? J.hpNight('wb', pins, true) : '';
    g += J.hpPath();
    SLOTS.forEach(([n, x, z], i) => {
      const [px, py] = J.hpp(x, J.HPJ.FT + .35, z), k = b[i];
      if (k) g += `<g ${edit ? `data-bslot="${i}" style="cursor:pointer"` : ''} transform="translate(${px.toFixed(0)},${py.toFixed(0)})"><circle r="17" fill="${ITEMS[k].tool ? '#E0A030' : '#D4003C'}" stroke="#fff" stroke-width="4"/><text y="6" font-size="17" font-weight="700" text-anchor="middle" fill="#fff">${ITEMS[k].c}</text></g>`;
      else if (edit) g += `<g data-bslot="${i}" style="cursor:pointer" transform="translate(${px.toFixed(0)},${py.toFixed(0)})"><circle r="15" fill="#fff" fill-opacity=".9" stroke="#D4003C" stroke-width="3" stroke-dasharray="5 4"/><text y="7" font-size="19" text-anchor="middle" fill="#D4003C">＋</text>${sel ? '' : `<text y="36" font-size="14" text-anchor="middle" fill="#3D3A40" stroke="#fff" stroke-width="5" paint-order="stroke">${n}</text>`}</g>`;
    });
    // 放大到臥室、走道、浴室一帶，零件才不會擠在一起
    return `<div style="position:relative;aspect-ratio:1.2;overflow:hidden;border-radius:10px"><div class="hpw pm" style="position:absolute;width:165%;left:-52%;top:-10%"><img src="home/plan.jpg" alt="心願預覽圖：林媽媽家臥室到浴室"><svg viewBox="${H.join(' ')}">${g}</svg></div></div>`;
  }
  const bItems = b => Object.entries(b).sort((a, c) => a[0] - c[0]).map(([i, k]) => ({ slot: SLOTS[i][0], k, it: ITEMS[k] }));
  const qr = seed => { let x = seed, c = ''; for (let r = 0; r < 9; r++) for (let q = 0; q < 9; q++) { x = (x * 9301 + 49297) % 233280; const corner = (r < 3 && q < 3) || (r < 3 && q > 5) || (r > 5 && q < 3); if (corner || x / 233280 > .5) c += `<rect x="${q * 4}" y="${r * 4}" width="4" height="4"/>`; } return `<svg viewBox="0 0 36 36" width="64" height="64" style="background:#fff;border:1px solid #ddd;border-radius:4px" aria-label="做法卡 QR Code（示意）"><g fill="#3D3A40">${c}</g></svg>`; };
  function chime() { try { const A = new (window.AudioContext || window.webkitAudioContext)(); [523.25, 659.25, 783.99].forEach((f, i) => { const o = A.createOscillator(), g = A.createGain(); o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(0, A.currentTime + i * .16); g.gain.linearRampToValueAtTime(.18, A.currentTime + i * .16 + .03); g.gain.exponentialRampToValueAtTime(.001, A.currentTime + i * .16 + .5); o.connect(g); g.connect(A.destination); o.start(A.currentTime + i * .16); o.stop(A.currentTime + i * .16 + .55); }); } catch (e) {} }
  const THEMES = [
    { id: 'nb', n: '好鄰居題：幫隔壁獨居長輩想一個方法', by: '全國電子｜揪感心', left: 28, sub: 37, rw: '點數加倍＋Digital City 社區健檢日優先名額', ph: 0 },
    { id: 'night', n: '500 元內，讓夜路更亮', by: '全國電子', left: 12, sub: 54, rw: '點數加倍＋零件 9 折券', ph: 0 },
    { id: 'keep', n: '補助結束後，舊冷氣怎麼養得更久', by: '全國電子 × 居家清潔夥伴', left: 40, sub: 0, rw: '點數加倍＋冷氣清洗搭打掃折扣', ph: 1 },
  ];
  Object.assign(V, {
    // 拼出你的心願（像 LEGO 用官方零件拼出作品）
    wbuild: () => {
      const b = bld(), night = !!L.s.bnight, sel = L.s.bitem, n = Object.keys(b).length;
      return page('拼出你的心願', `
      <div class="card" style="background:var(--note)"><div class="rs">先選零件，再點地圖上的「＋」擺放；再點一次可移除。只在示意屋型上拼，不需要真的動手改裝。</div></div>
      <div class="card" style="padding:8px 10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>林媽媽家｜臥室到浴室</b><span class="seg" role="group" aria-label="白天或夜間"><button data-bnight="0" aria-pressed="${!night}">白天</button><button data-bnight="1" aria-pressed="${night}">夜間</button></span></div>${buildSvg(b, night, true)}</div>
      <div class="card"><b>零件盤</b><div style="margin-top:6px">${Object.entries(ITEMS).map(([k, it]) => `<button class="slot" style="margin:0 6px 8px 0" data-bitem="${k}" aria-pressed="${sel === k}">${it.c}｜${it.n}${it.tool ? '（需技師）' : ''}</button>`).join('')}</div>${sel ? `<div class="muted" style="font-size:.85em">已選「${ITEMS[sel].n}」，點地圖上的＋擺放</div>` : ''}</div>
      <div class="pad">${n ? '<button class="btn" data-go="wcard">產生預覽圖與做法卡</button>' : '<button class="btn ghost" disabled style="opacity:.6">先擺一個零件</button>'}</div>`);
    },
    // 做法卡（像食譜：材料、難度、步驟、小撇步）
    wcard: () => {
      const b = Object.keys(bld()).length ? bld() : DEMO_BUILD, list = bItems(b), sum = list.reduce((a, x) => a + x.it.p, 0), mins = list.reduce((a, x) => a + x.it.min, 0) + 5, tool = list.some(x => x.it.tool);
      const cnt = {}; list.forEach(x => { cnt[x.k] = (cnt[x.k] || 0) + 1; });
      return page('做法卡', `
      <div class="card" style="padding:8px 10px"><b>心願預覽圖｜夜間</b>${buildSvg(b, true, false)}</div>
      <div class="card"><div style="display:flex;justify-content:space-between"><b>適用空間</b><span>臥室到浴室，走道約 3 公尺</span></div>
        <div style="display:flex;justify-content:space-between;margin-top:4px"><b>難度與時間</b><span>${tool ? '<span class="tag" style="background:#FBF0DC;color:#9A6A12">含需技師步驟</span>' : '<span class="tag ok">免工具</span>'}　約 ${mins} 分鐘</span></div></div>
      <div class="card"><b>零件清單</b>${Object.entries(cnt).map(([k, c]) => `<div class="row"><span>${ITEMS[k].n} ×${c}</span><span class="muted">約 ${(ITEMS[k].p * c).toLocaleString('en-US')} 元</span></div>`).join('')}<div class="row"><b>合計</b><b>約 ${sum.toLocaleString('en-US')} 元</b></div><div class="muted" style="font-size:.8em">價格為示意；門市或全國電子線上購物都買得到，商品不指名品牌。</div></div>
      <div class="card"><b>步驟</b>${list.map((x, i) => `<div style="display:flex;gap:8px;padding:6px 0;border-top:1px solid var(--line,#eee)"><b style="color:#D4003C;flex:none">${i + 1}</b><span class="rs">${x.it.step(x.slot)}${x.it.tool ? ' <span class="tag" style="background:#FBF0DC;color:#9A6A12">需技師</span>' : ''}</span></div>`).join('')}<div style="display:flex;gap:8px;padding:6px 0;border-top:1px solid var(--line,#eee)"><b style="color:#D4003C">${list.length + 1}</b><span class="rs">關燈從床邊實走一次到浴室，太亮就調低</span></div></div>
      <div class="card" style="background:var(--note)"><b>小撇步</b><div class="rs">夜燈不要直射眼睛；背膠款先擦乾淨牆面；鑽孔、配線與扶手一律請技師施工。</div></div>
      <div class="card"><div style="display:flex;gap:12px;align-items:center">${qr(list.length * 97 + sum)}<div><b>分享這張做法卡</b><div class="rs">全國電子 App 揪心願頁的短網址與 QR Code（示意），可經 LINE 官方帳號分享給家人。</div></div></div></div>
      <div class="pad">
        <button class="btn" data-wdo="2">我照著做了（第 2 關）</button>
        <button class="btn ghost" data-go="wremix">我改了這樣做（第 3 關）</button>
        ${tool ? '<button class="btn ghost" data-req="照做法卡請技師施工">請生活顧問安排技師照這份做法施工</button>' : ''}
        ${L.s.wf ? '<button class="btn ghost" data-wattach="1">附加到我的心願</button>' : ''}
      </div>`);
    },
    // 我改了這樣做（衍生版＋三個發想問題＋阿國換角度）
    wremix: () => {
      const r = L.s.rmx || (L.s.rmx = {});
      const ask = [['q1', '哪一步最不順？'], ['q2', '你換掉或拿掉了什麼？'], ['q3', '如果能有一個新商品解決這一步，會是什麼？']];
      const ang = [['換對象', '這個做法給坐輪椅的長輩用，要改什麼？'], ['換地方', '同樣的想法放到廚房會變成什麼？'], ['合在一起', '能不能和另一個心願合成一組？'], ['拿掉一樣', '不插電、不鑽孔，還做得到嗎？']];
      return page('我改了這樣做', `
      <div class="card"><div class="muted" style="font-size:.85em">原作｜可調光感應夜燈（陳小姐家庭提案）</div><div class="rs">衍生版會掛在原作下面，原作者與你都會列名。</div></div>
      <div class="card">
        <label class="muted" style="display:block;margin-bottom:8px">改了什麼（必填）<input class="fld" data-rm="what" value="${esc(r.what || '')}" placeholder="例：把床邊夜燈換成床底燈條" style="margin-top:4px"></label>
        <label class="muted" style="display:block;margin-bottom:8px">為什麼（必填）<input class="fld" data-rm="why" value="${esc(r.why || '')}" placeholder="例：媽媽說光從下面來比較不刺眼" style="margin-top:4px"></label></div>
      <div class="card"><b>做完後的三個問題</b>${ask.map(([k, q]) => `<label class="muted" style="display:block;margin:8px 0">${q}<input class="fld" data-rm="${k}" value="${esc(r[k] || '')}" style="margin-top:4px"></label>`).join('')}</div>
      <div class="card" ><b>全國電子 AI 顧問阿國：換個角度想想</b><div style="margin-top:6px">${ang.map(([n, q]) => `<button class="slot" style="margin:0 6px 8px 0" data-rang="${esc(q)}">${n}</button>`).join('')}</div>${r.ang ? `<div class="rs">💡 ${esc(r.ang)}</div>` : ''}</div>
      <div class="pad"><button class="btn" data-wdo="3">送出衍生版（第 3 關）</button>
        <button class="btn ghost" data-wnew="1">把第 3 題變成新心願（往第 4 關）</button></div>`);
    },
    // 揪心願闖關與獎勵
    wquest: () => {
      const P = pts(), p = ph();
      const LV = [['看懂', '看預覽圖與做法卡，按「我也需要」', 10], ['照著做', '照做法卡做出來，上傳完成照（只拍空間）', 50], ['我改了這樣做', '寫出改了什麼、為什麼，並回答三個問題', 100], ['長出新心願', '你的衍生版或新心願共鳴達 20 戶', 200], ['共同設計', '改良點被寫進量產規格', 0]];
      const rw = [['全國電子點數', 0], ['做法卡零件 9 折券', 0], ['Digital City 社區健檢日優先名額', 0], ['冷氣清洗搭居家打掃折扣', 1], ['節氣共煮優先名額', 1], ['以租代買首期優惠', 1]];
      return page('揪心願闖關', `
      <div class="card" ><div style="display:flex;justify-content:space-between;align-items:center"><b>我的點數</b><b style="font-size:1.4em;color:#D4003C">${P.total}</b></div><div class="rs">點數併入全國電子會員點數；完成照與衍生版經生活顧問檢核後入帳，每月有上限，不因分享或拉人給點。</div>${P.lv[4] ? '<div style="margin-top:6px"><span class="tag ok">🏅 心願設計師</span></div>' : ''}</div>
      <div class="card"><b>五個關卡</b>${LV.map(([n, d, v], i) => `<div style="display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--line,#eee);align-items:flex-start"><b style="flex:none;width:26px;height:26px;border-radius:50%;background:${P.lv[i + 1] ? '#D4003C' : '#F2E6EA'};color:${P.lv[i + 1] ? '#fff' : '#D4003C'};display:flex;align-items:center;justify-content:center">${P.lv[i + 1] ? '✓' : i + 1}</b><div style="flex:1"><b>${n}</b><div class="rs">${d}</div></div><span class="muted" style="font-size:.85em;white-space:nowrap">${v ? `+${v} 點` : '1% 購物金＋列名'}</span></div>`).join('')}</div>
      <div class="card"><b>可兌換的獎勵</b>${rw.map(([n, need]) => `<div class="row"><span>${n}</span>${p >= need ? '<span class="tag ok">可兌換</span>' : '<span class="rtag">擴展期開放</span>'}</div>`).join('')}<div class="muted" style="font-size:.8em;margin-top:4px">異業獎勵由合作夥伴提供，用來換曝光；不做現金分潤。</div></div>
      <div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><b>揪居家提示音</b><div class="rs">長輩按「我很好」、心願成團時都用同一段提示音</div></div><button class="btn ghost" data-chime="1" style="width:auto;margin:0">▶ 試聽</button></div></div>`);
    },
  });
  Object.assign(window.JJJS2, {
    lineTabs() {
      const ln = L.s.wline || 'own';
      return `<div class="pad" style="padding-top:0"><div class="seg" role="group" aria-label="心願路線" style="margin-bottom:8px"><button data-wline="own" aria-pressed="${ln === 'own'}">我家出題</button><button data-wline="hq" aria-pressed="${ln === 'hq'}">全國出題</button></div><div class="rs" style="margin-bottom:8px">${ln === 'own' ? '從自己家遇到的問題出發' : '全國電子出題，揪全國的家庭一起想'}</div><button class="row" data-go="wquest" style="width:100%"><span>🏅 我的闖關進度與點數：<b>${pts().total}</b> 點</span><span class="chev">›</span></button></div>`;
    },
    themes() {
      return `<div class="pad" style="padding-top:0"><div class="rs" style="margin-bottom:8px">依自己家的需求投稿；投稿同樣用寫作模板、標籤與做法卡，獎勵點數加倍。</div></div>` + THEMES.map(x => { const on = ph() >= x.ph; return `<div class="card" ><div style="display:flex;justify-content:space-between;gap:8px"><b>${x.n}</b>${on ? `<span class="tag">剩 ${x.left} 天</span>` : '<span class="rtag">擴展期</span>'}</div><div class="muted" style="font-size:.88em;margin-top:2px">出題：${x.by}｜已投稿 ${x.sub} 件</div><div class="rs" style="margin-top:4px">獎勵：${x.rw}</div>${on ? `<button class="btn ghost" data-wtheme="${x.id}" style="margin-top:8px">用這題投稿</button>` : '<button class="btn ghost" disabled style="margin-top:8px;opacity:.6">擴展期開放（異業夥伴共同出題）</button>'}</div>`; }).join('');
    },
    topicExtra(t) {
      const D = { dim: [62, 14, '已量產'], switch: [23, 6, '樣品試用中（5 戶）'], voice: [9, 4, ''], mat: [5, 1, ''] }[t.id] || [0, 0, ''];
      return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center"><span class="muted" style="font-size:.85em">做過 ${D[0]} 戶・改版 ${D[1]} 版</span>${D[2] ? `<span class="tag ok">${D[2]}</span>` : ''}<button class="btn ghost" data-go="wcard" style="width:auto;margin:0 0 0 auto;padding:6px 12px">看做法卡</button></div>`;
    },
    // 揪居家標誌：房子＋紅黃綠三色燈號（呼應居家安全地圖的燈號）
    logo(sz) {
      return `<svg width="${sz}" height="${sz}" viewBox="0 0 64 64" role="img" aria-label="揪居家標誌" style="flex:none"><path d="M8 30 L32 9 L56 30" fill="none" stroke="#D4003C" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 27 V54 H50 V27" fill="#fff" stroke="#A3002E" stroke-width="4" stroke-linejoin="round"/><circle cx="23" cy="42" r="5" fill="#D4003C"/><circle cx="32" cy="42" r="5" fill="#E0A030"/><circle cx="41" cy="42" r="5" fill="#3E9B6B"/></svg>`;
    },
    pack() {
      return `<div class="card"><b>包裝示意</b><div style="margin-top:8px;border:2px solid #D4003C;border-radius:12px;padding:12px;background:linear-gradient(135deg,#fff,#FBF3F3)"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div><div style="font-size:.8em;color:#D4003C;font-weight:700">揪心願｜由陳小姐家庭提案</div><div class="big" style="margin:4px 0">可調光感應夜燈組</div><div class="muted" style="font-size:.8em">共同設計：林家、王家、高雄民族店生活顧問</div></div>${qr(123)}</div><div style="margin-top:8px;display:flex;align-items:center;gap:8px;font-weight:700;color:#A3002E">${this.logo(28)}揪居家，讓家更有電</div><div class="muted" style="font-size:.78em">掃 QR Code 看做法卡｜全國電子</div></div></div>`;
    },
  });

  // 本模組的點擊事件（在原 App 的事件處理之前攔截自己的屬性）
  document.addEventListener('click', e => {
    // 送出心願：把模板欄位組成文字，交給原本的送出流程
    const ws = e.target.closest && e.target.closest('[data-a="wishSend"]');
    if (ws && document.getElementById('wishtxt') && document.querySelector('[data-wf]')) {
      const f = wf();
      document.querySelectorAll('[data-wf]').forEach(i => { f[i.dataset.wf] = i.value.trim(); });
      if (!f.hope) { e.stopPropagation(); toast('請寫下「希望」：一句話描述理想的樣子'); return; }
      if (!f.need.length) { e.stopPropagation(); toast('請選一到兩個需求類型'); return; }
      document.getElementById('wishtxt').value = `【${f.who}｜${f.field}】${f.when ? f.when + '，' : ''}${f.stuck ? f.stuck + '。' : ''}希望：${f.hope}（#${f.need.join(' #')}｜對象：${f.obj}${f.price ? '｜價格帶：' + f.price : ''}${f.theme ? '｜全國出題：' + (THEMES.find(x => x.id === f.theme) || {}).n : ''}${Object.keys(bld()).length ? '｜附做法卡' : ''}）`;
      J.S.wcat = f.field; L.s.wf = null; return;
    }
    const t = e.target.closest && e.target.closest('[data-zm],[data-x24],[data-x29],[data-x31],[data-term],[data-f33],[data-f34],[data-x34],[data-u3],[data-u3t],[data-u3send],[data-wwho],[data-wfield],[data-wneed],[data-wobj],[data-wprice],[data-wtag],[data-bitem],[data-bslot],[data-bnight],[data-wdo],[data-wattach],[data-rang],[data-wnew],[data-wline],[data-wtheme],[data-chime]');
    if (!t || t.disabled) return;
    e.stopPropagation();
    const d = t.dataset;
    if (d.zm) { L.s.zm = d.zm; }
    else if (d.x24) { if (!open(1)) return; const s = L.s.f24; s[d.x24] = !s[d.x24]; }
    else if (d.x29) { if (!open(1)) return; const s = L.s.f29; s[d.x29] = !s[d.x29]; }
    else if (d.x31) { const s = L.s.f31; s[d.x31] = !s[d.x31]; }
    else if (d.wwho !== undefined || d.wfield !== undefined || d.wneed !== undefined || d.wobj !== undefined || d.wprice !== undefined) {
      const f = wf(); document.querySelectorAll('[data-wf]').forEach(i => { f[i.dataset.wf] = i.value.trim(); });
      if (d.wwho) f.who = d.wwho; if (d.wfield) f.field = d.wfield; if (d.wobj) f.obj = d.wobj; if (d.wprice) f.price = d.wprice;
      if (d.wneed) f.need = f.need.includes(d.wneed) ? f.need.filter(x => x !== d.wneed) : f.need.concat(d.wneed).slice(0, 2);
    }
    else if (d.wtag !== undefined) L.s.wtag = d.wtag;
    else if (d.bitem) L.s.bitem = L.s.bitem === d.bitem ? '' : d.bitem;
    else if (d.bslot !== undefined) { const b = bld(), i = d.bslot; if (b[i]) delete b[i]; else if (L.s.bitem) b[i] = L.s.bitem; else { toast('先在零件盤選一個零件'); return; } }
    else if (d.bnight !== undefined) L.s.bnight = d.bnight === '1';
    else if (d.wdo === '2') { award(2, 50, '已記錄「我照著做了」，請上傳完成照（只拍空間）'); }
    else if (d.wdo === '3') { const r = L.s.rmx || {}; document.querySelectorAll('[data-rm]').forEach(i => { r[i.dataset.rm] = i.value.trim(); }); L.s.rmx = r; if (!r.what || !r.why) { toast('請寫出改了什麼、為什麼'); return; } award(3, 100, '衍生版已送出，掛在原作下面'); }
    else if (d.wattach) { toast('已把做法卡附加到心願'); go('wish'); return; }
    else if (d.rang) { const r = L.s.rmx || (L.s.rmx = {}); document.querySelectorAll('[data-rm]').forEach(i => { r[i.dataset.rm] = i.value.trim(); }); r.ang = d.rang; }
    else if (d.wnew) { const r = L.s.rmx || {}; document.querySelectorAll('[data-rm]').forEach(i => { r[i.dataset.rm] = i.value.trim(); }); if (!r.q3) { toast('先回答第 3 題：新商品會是什麼'); return; } const f = wf(); f.hope = r.q3; f.stuck = r.q1 || f.stuck; go('wish'); toast('已帶入新心願草稿'); return; }
    else if (d.wline) { L.s.wline = d.wline; }
    else if (d.wtheme) { const f = wf(); f.theme = d.wtheme; go('wish'); return; }
    else if (d.chime) { chime(); return; }
    else if (d.u3) { const s = L.s.u3; s[d.u3] = !s[d.u3]; }
    else if (d.u3t) L.s.u3t = d.u3t;
    else if (d.u3send) { L.s.u3st = 'sent'; toast('已送審（示意）：生活顧問與總部審核後通知你'); }
    else if (d.term) L.s.term = +d.term;
    else if (d.f33) L.s.f33 = d.f33;
    else if (d.f34) L.s.f34 = d.f34;
    else if (d.x34) { toast(open(2) ? (d.x34 === 'dry' ? '已開啟除濕機（示意）' : '已開啟出門模式（示意）') : '延伸期開放'); return; }
    render();
  }, true);
  let wt;
  document.addEventListener('input', e => {
    const k = e.target && e.target.dataset && e.target.dataset.wf; if (!k) return;
    wf()[k] = e.target.value; clearTimeout(wt);
    wt = setTimeout(() => { const pos = e.target.selectionStart; render(); const n = document.querySelector(`[data-wf="${k}"]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} } }, 600);
  });
})();
