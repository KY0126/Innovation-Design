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
  const light = c => `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${{ r: '#C42D5A', y: '#E0A030', g: '#3E9B6B' }[c]};margin-right:6px;vertical-align:-1px"></span>`;
  const row = (go2, t, d, n) => `<button class="row" data-go="${go2}" style="width:100%"><span>${t}${n !== undefined ? ` <span class="${open(n) ? 'tag ok' : 'rtag'}" style="font-size:.75em">${need(n)}</span>` : ''}<span class="muted" style="display:block;font-size:.85em">${d}</span></span><span class="chev">›</span></button>`;
  const page = (t, body) => `${hdr(t)}<div class="scroll" style="padding-top:12px">${body}</div>`;

  const FIELDS = [
    ['night', '揪夜安', '臥室到浴室', 0, '夜間照明、異常先問再通知'],
    ['food', '揪食光', '廚房', 200, '忘記關火、瓦斯外洩'],
    ['tv', '揪團聚', '客廳', 150, '室溫過高、遠距視訊'],
    ['wash', '揪清爽', '洗衣陽台', 100, '不必爬高曬衣'],
  ];

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
      <div class="card"><div class="muted" style="font-size:.85em">加購沿用已完成的 AR 掃描與家電檔案，只補掃新空間。月費依風險分級。</div></div>
      ${FIELDS.map(([k, n, w, p, d]) => k === 'night'
        ? `<div class="card" style="border-left:5px solid #C42D5A"><b>${n}｜${w}</b> <span class="tag ok">已訂閱</span><div class="rs">${d}｜安心方案 449 元／月</div></div>`
        : `<button class="card opt" data-x24="${k}" aria-pressed="${!!sel[k]}" ${open(1) ? '' : 'disabled style="opacity:.6"'} style="width:calc(100% - 24px);margin:0 12px 10px;text-align:left"><b>${n}｜${w}　+${p} 元／月</b><div class="rs">${d}</div>${k === 'food' ? `<div class="muted" style="font-size:.85em;margin-top:4px">先看廚房診斷 ›</div>` : ''}</button>`).join('')}
      <div class="card"><div style="display:flex;justify-content:space-between"><span>每月合計</span><b>NT$ ${sum.toLocaleString('en-US')}</b></div>
      ${all ? `<div style="margin-top:8px;padding:8px 10px;background:#FBF3F3;border-radius:8px;font-size:.9em">四個場域都要了，改用<b>揪全家 699 元</b>每月可省 ${sum - 699} 元。</div><button class="btn" data-go="x26" style="margin-top:8px">改看揪全家</button>`
        : `<div style="margin-top:10px">${act(1, '加購並交給生活顧問', 'data-req="加購場域方案"')}</div>`}</div>
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
      <div class="card" style="border-left:5px solid #C42D5A"><b style="font-size:1.1em">揪全家　每月 NT$ 699</b>
      <div class="rs" style="line-height:1.8;margin-top:6px">・四個場域一起顧：臥室到浴室、廚房、客廳、洗衣陽台<br>・安心等級服務：生活顧問每月關心、年度健檢<br>・首年設定費減免</div></div>
      <div class="card"><b>和分開訂購比較</b>
      ${[['揪夜安｜安心方案', 449], ['揪食光', 200], ['揪團聚', 150], ['揪清爽', 100]].map(([n, p]) => `<div style="display:flex;justify-content:space-between;padding:4px 0"><span class="muted">${n}</span><span>${p} 元</span></div>`).join('')}
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--line,#eee)"><span>分開訂合計</span><s>899 元</s></div>
      <div style="display:flex;justify-content:space-between"><b>改用揪全家</b><b style="color:#C42D5A">699 元｜每月省 200 元（約兩成）</b></div></div>
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
        ? `<div class="card"><b>嬰兒房</b><div style="display:flex;justify-content:space-between;margin-top:6px"><span>溫度／濕度</span><b>24°C／72%</b></div><div class="rs" style="color:#C42D5A">濕度偏高（建議 50–60%）</div><button class="btn" data-x34="dry" style="margin-top:8px">一鍵開除濕機</button></div>
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
        return `<div class="card" style="padding:4px 14px"><div class="muted" style="font-size:.85em;padding:8px 0 2px">揪居家接下來會開放</div>
          ${mine ? row('x34', '育兒與寵物模式', '嬰兒房溫濕度、寵物出門模式', 2) : row('x24', '其他場域方案', '揪食光、揪團聚、揪清爽、揪全家', 1)}
          ${row('x33', '新家與老宅翻修', 'AR 配置全屋家電，一次規劃到位', 2)}
          ${row('x0', '看全部擴展期與延伸期功能', `目前營運階段：${PHASES[ph()]}`)}</div>`;
      }
      if (where === 'hc') {
        const h = ctx || {}, old = h.years != null && h.years >= 8;
        return `<div class="card" style="padding:4px 14px">${row('x27', old ? `已用 ${h.years} 年：看換新建議` : '家電換新建議', '先保養延壽，效能不足才換新；可選以租代買', 1)}</div>`;
      }
      if (where === 'a1') { // 生活顧問手機版：依目前階段提醒可提案的方案
        const p = ph();
        const t = ['試點期｜只提案揪夜安（基本 299／安心 449）；其他場域可幫家人登記', '擴展期｜可加購揪食光 +200、揪團聚 +150、揪清爽 +100，四場域改揪全家 699；可提以租代買', '延伸期｜另可接新家與老宅翻修、育兒與寵物家庭'][p];
        return `<div class="card" style="background:var(--note);padding:8px 14px"><span class="${p ? 'tag ok' : 'rtag'}">營運階段</span> <span style="font-size:.88em">${t}</span></div>`;
      }
      return '';
    },
  };

  // 本模組的點擊事件（在原 App 的事件處理之前攔截自己的屬性）
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-x24],[data-x29],[data-x31],[data-term],[data-f33],[data-f34],[data-x34]');
    if (!t || t.disabled) return;
    e.stopPropagation();
    const d = t.dataset;
    if (d.x24) { if (!open(1)) return; const s = L.s.f24; s[d.x24] = !s[d.x24]; }
    else if (d.x29) { if (!open(1)) return; const s = L.s.f29; s[d.x29] = !s[d.x29]; }
    else if (d.x31) { const s = L.s.f31; s[d.x31] = !s[d.x31]; }
    else if (d.term) L.s.term = +d.term;
    else if (d.f33) L.s.f33 = d.f33;
    else if (d.f34) L.s.f34 = d.f34;
    else if (d.x34) { toast(open(2) ? (d.x34 === 'dry' ? '已開啟除濕機（示意）' : '已開啟出門模式（示意）') : '延伸期開放'); return; }
    render();
  }, true);
})();
