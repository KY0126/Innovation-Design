// 揪居家｜揪心願（樂高式）：揪心願頁（分類軸）、作品頁、創作 4 步、點數紀錄
// 資料都在資料庫（store3.js）；載入順序：ext.js 之後。
(function () {
  const J = window.JJJ; if (!J) return;
  const { V, S, api, esc, toast, render, go } = J;
  const hdr = J.hdr;
  ['wnew'].forEach(v => { if (!J.NO_NAV.includes(v)) J.NO_NAV.push(v); });
  const ROOMS = { bed: [0, 0, 4, 3.5, '臥室'], bath: [4, 0, 6.2, 3.5, '浴室'], ldy: [6.2, 0, 9, 3.5, '洗衣陽台'], hall: [0, 3.5, 9, 4.6, '走道'], kit: [0, 4.6, 3.8, 8, '廚房'], liv: [3.8, 4.6, 9, 8, '客廳'], door: [7.2, 8, 9, 9, '玄關'] };
  const FR = { '臥室到浴室': ['bed', 'hall', 'bath'], '廚房': ['kit'], '客廳': ['liv'], '洗衣陽台': ['ldy'], '全屋': Object.keys(ROOMS) };
  const LIGHT = { r: '#E5484D', y: '#F5A524', g: '#2E9E5B' };
  async function meta() { if (!S.wp) S.wp = await api('/wish/parts'); return S.wp; }
  const part = id => (S.wp ? S.wp.parts.find(p => p.id === id) : null);
  const X = x => (x * 30 + 10).toFixed(0);

  // 平面圖：業界施工圖畫法（cad.js），與居家安全地圖同一組空間座標（mm）
  const CAD = () => window.JJJCAD;
  function nearSlot(field, x, y) { const sl = (S.wp && S.wp.slots[field]) || []; let bi = 0, bd = 1e12; sl.forEach(([, sx, sz], i) => { const d = (sx * 1000 - x) ** 2 + (sz * 1000 - y) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; }
  // 作品零件 → 圖面項目（E1、E2…）；沒有座標的舊作品用擺放位置
  function items(field, build, cps) {
    const sl = (S.wp && S.wp.slots[field]) || [];
    return (build || []).map((b, i) => { const p = b.part ? part(b.part) : null, cp = b.cpart != null ? (cps || []).find(c => c.tmp === b.cpart || c.id === b.cpart) : null; if (!p && !cp) return null; const s0 = sl[b.slot] || sl[0] || ['', 4.5, 4.5]; return { idx: i, part: p ? p.id : null, p, cp, name: p ? p.n : cp.name, x: b.x != null ? b.x : Math.round(s0[1] * 1000), y: b.y != null ? b.y : Math.round(s0[2] * 1000), spec: p ? null : CAD().spec('_custom') }; })
      .filter(Boolean).map((it, k) => Object.assign(it, { tag: 'E' + (k + 1) }));
  }
  function lights(opt) { const L = {}; ((opt.mine && S.hh && S.hh.assessment && S.hh.assessment.lights) || []).forEach(([n, c]) => { const k = Object.keys(CAD().ROOMS).find(r => CAD().ROOMS[r][0] === n || (n === '門口' && r === 'door')); if (k) L[k] = c; }); return L; }
  function map(field, build, cps, opt = {}) {
    if (!S.wp || !CAD()) return '<div class="muted">載入中…</div>';
    return CAD().plan(field, items(field, build, cps), { edit: opt.edit, sel: opt.sel, full: opt.full, lights: lights(opt), alt: field + '平面配置圖' });
  }
  // 3D 容器：畫面重繪後由 hook 掛上 WebGL
  function v3d(field, build, cps, night, key) { S.w3cfg = { key, field, night: !!night, items: items(field, build, cps).map(({ tag, part, x, y, spec }) => ({ tag, part, x, y, spec })) }; return `<div class="w3d" data-w3d="${key}" role="img" aria-label="${esc(field)} 3D 鳥瞰，可拖曳旋轉"><div class="muted" style="padding:12px">3D 載入中…</div></div>`; }
  // 設備表
  function sched(field, build, cps) { return items(field, build, cps).map(it => { const sp = it.spec || CAD().spec(it.part), tool = it.p && it.p.tool; return `<div class="wsr"><b>${it.tag}</b><span><span style="color:var(--ink)">${esc(it.name)}</span><span class="muted" style="display:block;font-size:.85em">${esc(sp[4])}｜X ${it.x.toLocaleString('en-US')}、Y ${it.y.toLocaleString('en-US')} mm</span></span><span class="${tool ? 'wtech' : 'muted'}">${it.cp ? '待評估' : tool ? '技師安裝' : '自行安裝'}</span></div>`; }).join(''); }
  const bar = c => `<div class="wbar"><i style="width:${Math.min(100, c)}%"></i>${[20, 50, 100].map(n => `<b style="left:${n}%"></b>`).join('')}</div>`;
  const stTag = s => s === '共鳴中' ? '' : `<span class="tag ${/通過|預購|量產/.test(s) ? 'ok' : ''}">${esc(s)}</span>`;
  function steps(build, cps) {
    const W = S.wp, L = (build || []).map(b => ({ slot: (W.slots[S.wkField] || [])[b.slot], b })).filter(x => x.slot);
    return L.map(({ slot, b }) => { const p = b.part ? part(b.part) : null, cp = b.cpart != null ? (cps || []).find(c => c.tmp === b.cpart || c.id === b.cpart) : null; return p ? `在${slot[0]}放「${p.n}」${p.tool ? '（需技師）' : ''}` : cp ? `在${slot[0]}放「${cp.name}」（自訂零件，待評估）` : ''; }).filter(Boolean);
  }
  function card(build, cps, field) {
    S.wkField = field; const cnt = {}; (build || []).forEach(b => { if (b.part) cnt[b.part] = (cnt[b.part] || 0) + 1; });
    const list = Object.entries(cnt).map(([k, c]) => ({ p: part(k), c })).filter(x => x.p), sum = list.reduce((a, x) => a + x.p.p * x.c, 0), tool = list.some(x => x.p.tool), mins = list.reduce((a, x) => a + x.p.min * x.c, 0) + 5;
    const cp = (cps || []).filter(c => (build || []).some(b => b.cpart === c.tmp || b.cpart === c.id));
    return `<div class="card"><b>零件清單</b>${list.map(x => `<div class="row"><span>${esc(x.p.n)} ×${x.c}</span><span class="muted">約 NT$ ${(x.p.p * x.c).toLocaleString('en-US')}</span></div>`).join('')}${cp.map(c => `<div class="row"><span>${esc(c.name)} <span class="tag" style="background:#FAEEDA;color:#633806">自訂｜${esc(c.status || '待評估')}</span></span><span class="muted">還沒有商品</span></div>`).join('')}<div class="row"><b>合計（現有零件）</b><b>約 NT$ ${sum.toLocaleString('en-US')}</b></div>
      <div class="rs">${tool ? '含需技師的步驟' : '免工具'}｜約 ${mins} 分鐘</div></div>
      <div class="card"><b>步驟</b>${steps(build, cps).map((t, i) => `<div style="display:flex;gap:8px;padding:6px 0;border-top:1px solid var(--line)"><b style="color:#D4003C;flex:none">${i + 1}</b><span class="rs">${esc(t)}</span></div>`).join('')}<div class="rs" style="margin-top:6px">小撇步：夜燈不要直射眼睛；鑽孔、配線與扶手一律請技師施工。</div></div>
      ${list.length ? `<div class="pad"><button class="btn ghost" data-addcart="${list.map(x => x.p.id).join(',')}|揪心願做法卡">加入購物車（現有零件）</button></div>` : ''}`;
  }

  // ---------- 揪心願頁（分類軸：大家的作品、我的作品、全國出題） ----------
  V.wl2 = () => {
    const tab = S.wtab || 'all', f = S.wfield || '', sort = S.wsort || 'near', D = S.wl2d;
    const tabs = [['all', '大家的作品'], ['mine', '我的作品'], ['theme', '全國出題']];
    const fields = ['', '臥室到浴室', '廚房', '客廳', '洗衣陽台', '全屋'];
    const item = w => `<button class="card wcard" data-wk="${w.id}"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(w.title)}</b>${stTag(w.status)}</div><div class="muted" style="font-size:.85em">${esc(w.designer)}｜${esc(w.field)}${w.parent_id ? '｜衍生版' : ''}${w.derivs ? `｜衍生 ${w.derivs} 版` : ''}</div>${w.status === '草稿' ? '<div class="rs">草稿：試點期只開放臥室到浴室，這件當作擴展期的需求證據</div>' : bar(w.count) + `<div class="muted" style="font-size:.85em">${w.count} 戶也需要｜${esc(w.stage.label)}</div>`}</button>`;
    return `${hdr('揪心願')}<div class="scroll" style="padding-top:8px">
      <div class="sxt" role="tablist" style="padding:0 12px 6px">${tabs.map(([k, l]) => `<button role="tab" data-wtab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
      ${tab !== 'theme' ? `<div class="pad">${fields.map(x => `<button class="slot" style="margin:0 6px 6px 0" data-wfld="${x}" aria-pressed="${f === x}">${x || '全部'}</button>`).join('')}</div><div class="pad muted" style="font-size:.85em;margin-bottom:6px">排序：${[['near', '快達門檻'], ['new', '最新']].map(([k, l]) => `<button class="lnk ${sort === k ? 'on' : ''}" data-wsort="${k}">${l}</button>`).join('｜')}</div>` : ''}
      ${!D ? '<div class="card muted">載入中…</div>' : tab === 'theme' ? D.themes.map(t => `<div class="card"><div class="muted" style="font-size:.85em">全國出題｜${esc(t.by_name)}｜截止 ${esc(t.deadline || '')}</div><b>${esc(t.title)}</b><div class="rs">獎勵：${esc(t.reward)}</div><button class="btn ghost" data-wnewt="${t.id}" style="margin-top:8px">用這個題目投稿</button>${D.works.filter(w => w.theme_id === t.id).map(item).join('')}</div>`).join('') || '<div class="card muted">目前沒有題目</div>'
        : (D.works.length ? D.works.map(item).join('') : `<div class="card"><b>${tab === 'mine' ? '你還沒有作品' : '這個分類還沒有作品'}</b><div class="muted">家裡還需要什麼？拼出來給大家看，100 戶共鳴就進總部審查。</div></div>`)}
      <div class="pad"><button class="btn" data-wcreate="1">許一個揪心願</button></div></div>`;
  };
  J.LOAD.wl2 = async () => { await meta(); const q = new URLSearchParams({ tab: S.wtab || 'all', field: S.wfield || '', sort: S.wsort || 'near' }); S.wl2d = await api('/wish/works?' + q); };

  // ---------- 作品頁 ----------
  V.wk = () => {
    const w = S.wkd; if (!w) return `${hdr('作品')}<div class="scroll"><div class="card muted" style="margin-top:12px">載入中…</div></div>`;
    const own = w.user_id === S.me.id, sh = S.wsheet;
    return `${hdr('作品')}<div class="scroll" style="padding-top:12px">
      ${(() => { const cps = w.cparts.map(c => ({ ...c, tmp: c.id })), v = S.wkv || '2d'; return `<div class="card" style="padding:6px 8px 8px"><div class="sxt" role="tablist" style="margin-bottom:6px">${[['2d', '平面圖'], ['3d', '3D'], ['night', '夜間']].map(([k, l]) => `<button role="tab" data-wkv="${k}" aria-selected="${v === k}">${l}</button>`).join('')}</div>
        ${v === '2d' ? map(w.field, w.build, cps, { full: 1 }) : v3d(w.field, w.build, cps, v === 'night', 'wk')}
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px;font-size:.8em" class="muted"><span>${v === '2d' ? 'A-01 平面配置圖｜1:50｜單位 mm｜紅色為新增' : v === '3d' ? '拖曳旋轉、雙指縮放' : '夜間模擬：夜燈與燈條亮起的樣子'}</span><button class="lnk" data-wsheet="1" style="color:#A3002E">看設備施工圖</button></div></div>`; })()}
      <div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:1.12em">${esc(w.title)}</b>${stTag(w.status)}</div>
        <div class="muted" style="font-size:.88em">設計者：${esc(w.designer)}｜${esc(w.field)}${w.theme ? '｜全國出題：' + esc(w.theme.title) : ''}</div>
        ${w.parent ? `<button class="lnk" data-wk="${w.parent.id}">改自「${esc(w.parent.title)}」（${esc(w.parent.designer)}）</button>` : ''}
        <div class="rs" style="margin-top:6px">「${esc(w.story.when || '')}${w.story.stuck ? '，' + esc(w.story.stuck) : ''}。希望：${esc(w.story.hope || w.title)}」</div>
        ${w.status === '草稿' ? '<div class="rs" style="margin-top:8px">草稿：試點期只開放臥室到浴室</div>' : bar(w.count) + `<div class="muted" style="font-size:.88em">${w.count} 戶也需要｜${esc(w.stage.label)}</div>`}
        ${w.status === '預購' ? '<button class="btn" data-addcart="dimlight|心願預購" style="margin-top:10px">預購：加入購物車</button>' : own ? '<div class="rs" style="margin-top:8px">這是你的作品；分享給同樣需要的家庭，更快達到門檻。</div>' : w.mine === 'support' ? '<button class="btn ghost" disabled style="margin-top:10px">已按「我也需要」</button>' : w.status === '草稿' ? '' : `<button class="btn" data-wsup="1" style="margin-top:10px">我也需要</button>${w.mine === 'follow' ? '<div class="rs">已追蹤，有進度會通知你</div>' : ''}`}
        <button class="btn ghost" data-wshare="1">分享到家人 LINE 群組</button></div>
      <div class="sec">做法卡</div>${card(w.build, w.cparts.map(c => ({ ...c, tmp: c.id })), w.field)}
      <div class="sec">衍生版｜${w.derivatives.length}</div>${w.derivatives.map(d => `<button class="card wcard" data-wk="${d.id}"><b>${esc(d.title)}</b><div class="muted" style="font-size:.85em">${esc(d.designer)}｜原作者與改版者都列名</div></button>`).join('')}
      ${w.status !== '草稿' ? '<div class="pad"><button class="btn ghost" data-wremix="1">我改了這樣做</button></div>' : ''}
      <div class="sec">更新紀錄</div><div class="glist">${w.updates.map(u => `<div class="gi" style="cursor:default"><span><b>${esc(u.text)}</b><span class="muted" style="display:block;font-size:.85em">${esc(u.by_name || '')}｜${esc(String(u.created_at).slice(5, 16).replace('-', '/'))}</span></span></div>`).join('') || '<div class="gi muted" style="cursor:default">還沒有更新</div>'}</div>
      <div class="sec">留言（審核後顯示）</div><div class="glist">${w.comments.map(c => `<div class="gi" style="cursor:default"><span><b>${esc(c.text)}</b><span class="muted" style="display:block;font-size:.85em">${esc(c.name || '')}${c.status !== '顯示' ? '｜' + esc(c.status) : ''}</span></span></div>`).join('') || '<div class="gi muted" style="cursor:default">還沒有留言</div>'}</div>
      <div class="pad" style="display:flex;gap:8px;margin-top:8px"><input class="fld" id="wcmt" placeholder="我家也是…" style="margin:0;flex:1"><button class="btn" data-wcmt="1" style="margin:0;width:auto;padding:0 16px">送出</button></div>
      ${S.wkE ? `<div class="sheet-bg"><div class="sheet" style="max-height:88%;overflow:auto"><div style="display:flex;justify-content:space-between;align-items:center"><b>設備施工圖 E-01</b><button class="lnk" data-wsheetx="1">關閉</button></div><div class="rs" style="margin-bottom:6px">給技師：新增零件的位置、安裝高度與施工方式；黑色是原有的燈、插座、開關</div>${CAD().plan(w.field, items(w.field, w.build, w.cparts.map(c => ({ ...c, tmp: c.id }))), { sheet: 'E', alt: '設備施工圖' })}<div class="sec" style="padding-left:0">設備表</div>${sched(w.field, w.build, w.cparts.map(c => ({ ...c, tmp: c.id })))}<div class="rs" style="margin-top:8px">尺寸以 AR 量測為準，鑽孔、配線與扶手一律請技師施工前到府複核。</div></div></div>` : ''}
      ${sh ? `<div class="sheet-bg"><div class="sheet"><b>再回答兩題就送出</b>
        <div class="muted" style="margin-top:8px">做出來你會買嗎？</div><div>${['會', '看價格', '不會'].map(x => `<button class="slot" style="margin:6px 6px 0 0" data-wbuy="${x}" aria-pressed="${sh.buy === x}">${x}</button>`).join('')}</div>
        <div class="muted" style="margin-top:8px">願意付多少？</div><div>${['500 元內', '500–1,000 元', '1,000 元以上'].map(x => `<button class="slot" style="margin:6px 6px 0 0" data-wprice2="${x}" aria-pressed="${sh.price === x}">${x}</button>`).join('')}</div>
        <button class="btn" data-wsupgo="1" style="margin-top:12px" ${sh.buy && sh.price ? '' : 'disabled'}>送出「我也需要」</button><button class="btn ghost" data-wsupx="1">取消</button>
        <div class="rs" style="margin-top:6px">只有訂閱「${esc(w.plan)}」的家庭能支持；其他人可先追蹤</div></div></div>` : ''}
      </div>`;
  };
  async function openWk(id) { S.wkd = null; S.wsheet = null; S.wkE = false; S.wkv = '2d'; go('wk'); await meta(); try { S.wkd = (await api('/wish/works/' + id)).work; } catch (e) { toast(e.message); } if (J.S.stack[J.S.stack.length - 1] === 'wk') render(); }

  // ---------- 創作 4 步：寫下心願、拼出來、做法卡、確認送出 ----------
  const WSTEP = ['寫下心願', '拼出來', '做法卡', '確認送出'];
  const WCAT = [['照明', ['light', 'strip']], ['感測', ['btn', 'hygro', 'speaker']], ['安全', ['gas', 'smoke', 'plug']], ['止滑扶手', ['mat', 'rail']], ['家電', ['ih', 'rack']]];
  const ICO = { light: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z', strip: 'M3 14h18M5 14v3M9 14v3M13 14v3M17 14v3M3 10h18', btn: 'M5 5h14v14H5zM9 9h6v6H9z', hygro: 'M12 4a2 2 0 0 1 2 2v8a4 4 0 1 1-4 0V6a2 2 0 0 1 2-2z', speaker: 'M7 3h10v18H7zM12 15m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0', gas: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z', smoke: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zM9 12h6', plug: 'M9 3v5M15 3v5M7 8h10v4a5 5 0 0 1-10 0zM12 17v4', mat: 'M4 7h16v10H4zM7 7v10M11 7v10M15 7v10', rail: 'M5 4v16M5 8h11a3 3 0 0 1 0 6H5', ih: 'M4 6h16v12H4zM12 12m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0', rack: 'M3 6h18M6 6v4M18 6v4M5 10h14', new: 'M4 4h16v16H4zM12 8v8M8 12h8', plus: 'M12 5v14M5 12h14' };
  const ico = k => `<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${ICO[k] || ICO.new}"/></svg>`;
  function startNew(o = {}) { S.wn = Object.assign({ step: 0, field: '臥室到浴室', theme_id: null, parent_id: null, story: { who: '長輩', when: '', stuck: '', hope: '' }, build: [], cparts: [], sel: null, pick: null, view: '2d', cat: null, hist: [], terms: { rules: false, license: false }, home: (S.hh && S.hh.assessment) ? 'mine' : 'tpl', leave: false, cform: null }, o); go('wnew'); Promise.all([meta(), J.LOAD.wl2()]).then(render).catch(() => {}); }
  V.wnew = () => {
    const n = S.wn; if (!n) return V.m2(); const W = S.wp, ph = W ? W.phase : 2;
    const top = `<div class="top"><button class="back" data-wback="1" aria-label="返回上一步">‹ 返回</button><h1>${n.parent_id ? '我改了這樣做' : '許一個揪心願'}</h1><button class="back" data-wleave="1" style="text-align:right">離開</button></div>`;
    const leave = n.leave ? `<div class="sheet-bg"><div class="sheet"><b>確定要離開嗎？</b><div class="muted" style="margin:6px 0 12px">這次拼的內容不會送出。</div><button class="btn" data-wleave="go">離開</button><button class="btn ghost" data-wleave="stay">繼續</button></div></div>` : '';
    if (!W) return `${top}<div class="scroll"><div class="card muted" style="margin-top:12px">載入中…</div></div>`;
    let body = '', foot = '';
    if (n.step === 0) {
      const s = n.story, sim = ((S.wl2d && S.wl2d.works) || []).filter(w => w.field === n.field && !w.parent_id && [s.hope, s.stuck].join('').length > 1 && [...new Set((s.hope + s.stuck).match(/[一-鿿]{2}/g) || [])].some(k => (w.title + JSON.stringify(w.story)).includes(k))).slice(0, 2);
      const fld = (k, l, ph2) => `<label class="muted" style="display:block;margin-top:8px">${l}<input class="fld" data-wst="${k}" value="${esc(s[k] || '')}" placeholder="${ph2}"></label>`;
      body = `<div class="card"><div class="muted">誰遇到</div><div>${['長輩', '孫輩', '我自己', '其他家人'].map(v => `<button class="slot" style="margin:6px 6px 0 0" data-wwho2="${v}" aria-pressed="${s.who === v}">${v}</button>`).join('')}</div>
        <div class="muted" style="margin-top:8px">在哪裡</div><div>${W.fields.map(v => `<button class="slot" style="margin:6px 6px 0 0" data-wfield2="${v}" aria-pressed="${n.field === v}">${v}</button>`).join('')}</div>
        ${ph < 1 && n.field !== '臥室到浴室' ? '<div class="rs">試點期只開放臥室到浴室；這個場域會存成草稿，當作擴展期的需求證據</div>' : ''}
        ${fld('when', '什麼時候', '半夜起床上廁所')}${fld('stuck', '卡在哪', '夜燈太亮，很刺眼')}${fld('hope', '希望（一句話，必填）', '亮度可以調低的夜燈')}
        ${S.wl2d && S.wl2d.themes.length ? `<div class="muted" style="margin-top:8px">全國出題（選填）</div><div>${[{ id: null, title: '不參加' }].concat(S.wl2d.themes).map(t => `<button class="slot" style="margin:6px 6px 0 0" data-wthm="${t.id || ''}" aria-pressed="${(n.theme_id || null) === (t.id || null)}">${esc(t.title)}</button>`).join('')}</div>` : ''}</div>
        ${sim.length ? `<div class="card" style="background:#FAE0E8"><b style="color:#A3002E">找到相似作品</b><div class="rs" style="margin-bottom:6px">去按「我也需要」比重新提案更快達到門檻。</div>${sim.map(w => `<button class="row" data-wk="${w.id}" style="width:100%"><span>${esc(w.title)}｜${w.count} 戶</span><span class="chev">›</span></button>`).join('')}</div>` : ''}`;
      foot = `<button class="btn" data-wnext="1" ${s.hope.trim() ? '' : 'disabled'}>下一步：拼出來</button>`;
    } else if (n.step === 1) {
      const m = (S.hh && S.hh.assessment && S.hh.assessment.measures) || {}, v = n.view || '2d', its = items(n.field, n.build, n.cparts), pk = its.find(x => x.idx === n.pick);
      body = `<div class="card" style="padding:8px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px"><b style="font-size:.95em">${esc(n.field)}</b><span class="seg" role="group" aria-label="底圖">${S.hh && S.hh.assessment ? `<button data-whome="mine" aria-pressed="${n.home === 'mine'}">我家</button>` : ''}<button data-whome="tpl" aria-pressed="${n.home === 'tpl'}">場域模板</button></span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div class="sxt" role="tablist" style="padding:0">${[['2d', '2D'], ['3d', '3D'], ['night', '夜間']].map(([k, l]) => `<button role="tab" data-wview="${k}" aria-selected="${v === k}">${l}</button>`).join('')}</div><button class="lnk" data-wundo="1" ${n.hist && n.hist.length ? '' : 'disabled'}>復原</button></div>
        ${n.home === 'mine' ? `<div class="rs">依 AR 量測：${m.corridor_cm ? '走道 ' + m.corridor_cm + ' cm' : '尚未量走道'}${m.threshold_cm != null ? '、門檻 ' + m.threshold_cm + ' cm' : ''}；房名旁的點是居家安全燈號</div>` : ''}
        ${v === '2d' ? `<div class="wcad" data-wcad="1">${map(n.field, n.build, n.cparts, { edit: 1, mine: n.home === 'mine', sel: n.pick })}</div>` : v3d(n.field, n.build, n.cparts, v === 'night', 'wnew')}
        <div class="rs">${v !== '2d' ? '3D 只看不改；要擺零件請切回 2D' : n.sel ? '點平面圖放上「' + esc(n.sel[0] === 'c' ? ((n.cparts.find(c => 'c' + c.tmp === n.sel) || {}).name || '') : (part(n.sel) || {}).n || '') + '」，或直接從下面拖上來' : '按住下面的零件拖到平面圖；放好的零件可以再拖動，點一下看細節'}</div></div>
        ${pk ? (() => { const sp = pk.spec || CAD().spec(pk.part), nw = CAD().nearWall(pk.x, pk.y), far = sp[3] === 'wall' && nw[0] > 300, tool = pk.p && pk.p.tool; return `<div class="card wpk"><div style="display:flex;justify-content:space-between;align-items:center"><b><span style="color:#D4003C">${pk.tag}</span> ${esc(pk.name)}</b><button class="lnk" data-wpickx="1">完成</button></div>
          <div class="rs" style="line-height:1.75">${pk.p ? '約 NT$ ' + pk.p.p.toLocaleString('en-US') : '自訂零件，還沒有商品'}｜${pk.cp ? '待評估' : tool ? '技師安裝' : '自行安裝'}｜安裝高度 ${esc(sp[4])}<br>位置：X ${pk.x.toLocaleString('en-US')} mm、Y ${pk.y.toLocaleString('en-US')} mm（離牆 ${Math.round(nw[0]).toLocaleString('en-US')} mm）</div>
          ${far ? '<div class="wwarn">這個零件要裝在牆上，請拖到牆邊。</div>' : ''}<button class="btn ghost" data-wdel="${pk.idx}" style="margin-top:8px">移除這個零件</button></div>`; })() : ''}
        ${n.cform ? `<div class="card wcform"><b>自訂零件</b><label class="muted" style="display:block;margin-top:6px">名稱<input class="fld" data-wcf="name" value="${esc(n.cform.name)}" placeholder="可調光床底燈條"></label><label class="muted" style="display:block;margin-top:8px">用途<input class="fld" data-wcf="purpose" value="${esc(n.cform.purpose)}" placeholder="光從床底照地面，不刺眼"></label><label class="muted" style="display:block;margin-top:8px">照片或手繪（選填，只拍空間）<input type="file" accept="image/*" data-wcphoto="1"></label>${n.cform.photo ? `<img src="${n.cform.photo}" alt="自訂零件照片" style="width:80px;border-radius:8px;margin-top:6px">` : ''}<div style="display:flex;gap:8px;margin-top:8px"><button class="btn" data-wcsave="1" style="margin:0">加入零件盤</button><button class="btn ghost" data-wcx="1" style="margin:0">取消</button></div></div>` : ''}`;
      const P = W.parts.filter(p => p.f.includes(n.field)), cats = WCAT.filter(([, ids]) => P.some(p => ids.includes(p.id))).concat([['自訂', null]]), cat = cats.some(c => c[0] === n.cat) ? n.cat : cats[0][0];
      const tiles = cat === '自訂' ? n.cparts.map(c => `<button class="wtile nw" data-wsel="c${c.tmp}" aria-pressed="${n.sel === 'c' + c.tmp}">${ico('new')}<span>${esc(c.name)}</span><small>自訂</small></button>`).join('') + (n.cparts.length < 5 ? '<button class="wtile nw" data-wcnew="1">' + ico('plus') + '<span>自訂零件</span><small>我想要但還沒有</small></button>' : '')
        : P.filter(p => (WCAT.find(c => c[0] === cat) || [, []])[1].includes(p.id)).map(p => `<button class="wtile" data-wsel="${p.id}" aria-pressed="${n.sel === p.id}">${ico(p.id)}<span>${esc(p.n)}</span><small>${p.tool ? '需技師' : 'NT$' + p.p.toLocaleString('en-US')}</small></button>`).join('');
      foot = `<div class="wpal" aria-label="全國電子零件盤"><div class="sxt" role="tablist" style="padding:0 2px">${cats.map(([c]) => `<button role="tab" data-wcat="${c}" aria-selected="${cat === c}">${c}</button>`).join('')}</div><div class="wtiles">${tiles}</div></div><button class="btn" data-wnext="2" ${n.build.length ? '' : 'disabled'}>下一步：做法卡｜已放 ${n.build.length} 個</button>`;
    } else if (n.step === 2) {
      body = `<div class="card" style="padding:8px"><b style="font-size:.95em">平面配置圖</b>${map(n.field, n.build, n.cparts, { mine: n.home === 'mine', full: 1 })}<div class="sec" style="padding-left:0">設備表</div>${sched(n.field, n.build, n.cparts)}</div>${card(n.build, n.cparts, n.field)}`;
      foot = `<button class="btn" data-wnext="3">下一步：確認送出</button>`;
    } else {
      body = `<div class="card"><b>投稿規範</b><div class="rs" style="line-height:1.8">・不使用他人的商標、品牌或設計<br>・不自行接電、改裝電器；鑽孔與配線請技師施工<br>・只拍空間，不拍人、地址與門牌<br>・不寫醫療效果</div></div>
        <button class="row" data-wterm="rules" style="width:calc(100% - 24px);margin:0 12px 10px;background:var(--card);border-radius:12px;padding:12px 14px"><span>${n.terms.rules ? '☑' : '☐'} 我同意以上規範</span></button>
        <button class="row" data-wterm="license" style="width:calc(100% - 24px);margin:0 12px 10px;background:var(--card);border-radius:12px;padding:12px 14px;text-align:left"><span>${n.terms.license ? '☑' : '☐'} 同意全國電子評估、改良與量產這個作品；量產後包裝具名，並依銷售回饋點數（有上限）、贈送首批商品</span></button>
        <div class="pad muted" style="font-size:.88em">送出後累積共鳴：30 天內 20 戶、90 天內 50 戶、100 戶進入每季審查；結果會通知你。</div>`;
      foot = `<button class="btn" data-wsend="1" ${n.terms.rules && n.terms.license ? '' : 'disabled'}>送出作品</button>`;
    }
    return `${top}<div class="scroll">${J.stepper(WSTEP, n.step)}${body}</div><div class="pad" style="padding-bottom:12px;background:var(--bg)">${foot}</div>${leave}`;
  };

  // ---------- 會員中心「點數紀錄」：揪心願點數併入會員點數 ----------
  V.pts = () => { const P = S.ptsd; return `${hdr('點數紀錄')}<div class="scroll" style="padding-top:12px">${!P ? '<div class="card muted">載入中…</div>' : `<div class="card" style="display:grid;grid-template-columns:1fr 1fr;text-align:center"><div><b style="font-size:1.4em">${P.total}</b><div class="muted" style="font-size:.85em">揪心願已入帳</div></div><div><b style="font-size:1.4em">${P.pending}</b><div class="muted" style="font-size:.85em">待生活顧問檢核</div></div></div>
    <div class="glist">${P.items.map(x => `<div class="gi" style="cursor:default"><span><b>${esc(x.reason)}</b><span class="muted" style="display:block;font-size:.85em">${esc(x.title || '')}｜${esc(String(x.created_at).slice(0, 10))}</span></span><span><b>+${x.points}</b> <span class="tag ${x.status === '已入帳' ? 'ok' : ''}">${esc(x.status)}</span></span></div>`).join('') || '<div class="gi muted" style="cursor:default">還沒有揪心願點數</div>'}</div>
    <p class="muted pad" style="font-size:.85em">全國電子會員點數 1 點可折抵 1 元；交易點數自發送日起 1 年內有效，活動點數依實際到期日。</p>`}</div>`; };
  J.LOAD.pts = async () => { S.ptsd = await api('/points'); };

  // 生活顧問案件詳情：顯示這個家庭的作品
  const _acase = V.acase; V.acase = () => { let h = _acase(); const c = S.acase; if (c && S.acw && S.acw.hid === c.hid) h = h.replace(/<\/div>$/, `<div class="sec">揪心願作品｜${S.acw.list.length}</div><div class="glist">${S.acw.list.map(w => `<div class="gi" style="cursor:default"><span><b>${esc(w.title)}</b><span class="muted" style="display:block;font-size:.85em">${esc(w.field)}｜${w.count} 戶也需要｜${esc(w.status)}</span></span></div>`).join('') || '<div class="gi muted" style="cursor:default">還沒有作品</div>'}</div></div>`); else if (c && (!S.acw || S.acw.hid !== c.hid)) { S.acw = { hid: c.hid, list: [] }; api('/wish/works?tab=all&hid=' + c.hid).then(d => { S.acw = { hid: c.hid, list: d.works }; if (J.S.stack[J.S.stack.length - 1] === 'acase') render(); }).catch(() => {}); } return h; };

  // 擺零件：記下復原點、找最近的擺放位置（做法卡步驟用）
  function snap(n) { n.hist.push(JSON.parse(JSON.stringify(n.build))); if (n.hist.length > 30) n.hist.shift(); }
  function place(n, sel, x, y) { if (n.build.length >= 12) { toast('一個作品最多 12 個零件'); return; } snap(n); const slot = nearSlot(n.field, x, y); n.build.push(sel[0] === 'c' ? { slot, cpart: +sel.slice(1), x, y } : { slot, part: sel, x, y }); n.pick = n.build.length - 1; }
  function rr() { const sc = document.querySelector('#view .scroll'), y = sc ? sc.scrollTop : 0; render(); const s2 = document.querySelector('#view .scroll'); if (s2) s2.scrollTop = y; }
  const view = document.getElementById('view');
  // 拖曳：零件盤往上拖到平面圖新增；平面圖上的零件拖動換位置
  let drag = null, dragEnd = 0, skipClick = false;
  view.addEventListener('pointerdown', e => {
    const n = S.wn; if (!n || n.step !== 1 || (n.view || '2d') !== '2d') return;
    const pin = e.target.closest('[data-wpin]'), tile = e.target.closest('.wtile[data-wsel]');
    if (!pin && !tile) return;
    drag = { pin: pin ? +pin.dataset.wpin : null, sel: tile ? tile.dataset.wsel : null, x0: e.clientX, y0: e.clientY, on: false, el: pin || tile, id: e.pointerId };
    if (pin) { try { pin.setPointerCapture(e.pointerId); } catch (er) { } }
  }, true);
  view.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return; const n = S.wn, dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.on) { if (drag.pin != null ? Math.hypot(dx, dy) < 6 : !(dy < -10 && Math.abs(dy) > Math.abs(dx))) return; drag.on = true;
      if (drag.sel) { const g = document.createElement('div'); g.className = 'wghost'; g.textContent = (drag.sel[0] === 'c' ? ((n.cparts.find(c => 'c' + c.tmp === drag.sel) || {}).name) : (part(drag.sel) || {}).n) || ''; document.body.appendChild(g); drag.g = g; try { drag.el.setPointerCapture(e.pointerId); } catch (er) { } } }
    e.preventDefault();
    if (drag.g) { drag.g.style.left = e.clientX + 'px'; drag.g.style.top = e.clientY + 'px'; }
    else { const sv = view.querySelector('.wcad svg'); if (!sv) return; const b = n.build[drag.pin], [x, y] = CAD().clampTo(n.field, ...CAD().toMM(e, sv)), it = items(n.field, n.build, n.cparts).find(q => q.idx === drag.pin); if (!it) return; drag.el.setAttribute('transform', `translate(${x - it.x} ${y - it.y})`); drag.to = [x, y]; }
  }, true);
  const dragStop = e => {
    if (!drag || e.pointerId !== drag.id) return; const d = drag, n = S.wn; drag = null; if (!d.on) return; dragEnd = Date.now(); skipClick = true;
    if (d.g) { d.g.remove(); const sv = view.querySelector('.wcad svg'); if (!sv || e.type === 'pointercancel') return; const r = sv.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { rr(); return; } const [x, y] = CAD().clampTo(n.field, ...CAD().toMM(e, sv)); place(n, d.sel, x, y); n.sel = null; rr(); return; }
    if (d.to) { snap(n); const b = n.build[d.pin]; b.x = d.to[0]; b.y = d.to[1]; b.slot = nearSlot(n.field, b.x, b.y); n.pick = d.pin; } rr();
  };
  view.addEventListener('pointerup', dragStop, true); view.addEventListener('pointercancel', dragStop, true);
  // 3D：畫面重繪後掛上 WebGL
  let m3d = null;
  (window.JJJHOOKS = window.JJJHOOKS || []).push((v, el) => { const h = el.querySelector('[data-w3d]'); if (!h || !S.w3cfg) return; const cfg = S.w3cfg; (m3d = m3d || import('./cad3d.js?v=20261125a')).then(M => { if (h.isConnected) M.mount(h, cfg); }).catch(er => { h.innerHTML = '<div class="muted" style="padding:12px">這台裝置無法顯示 3D：' + esc(er.message) + '</div>'; }); });
  if (!document.getElementById('wcadcss')) document.head.insertAdjacentHTML('beforeend', `<style id="wcadcss">
.wcad{border-radius:8px;overflow:hidden;border:1px solid var(--line);margin-top:6px}.wcad svg [data-wpin]{touch-action:none}
.w3d{position:relative;height:270px;border-radius:8px;overflow:hidden;background:#F4F2EF;margin-top:6px}.w3lab{position:absolute;inset:0;pointer-events:none}
.w3tag{position:absolute;transform:translate(-50%,-140%);background:#fff;border:1px solid #D4003C;color:#D4003C;font-size:11px;font-weight:700;border-radius:4px;padding:0 4px;line-height:16px}.w3tag.nw{border-color:#BA7517;color:#BA7517}
.wpal{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:4px 8px 8px;margin-bottom:8px}.wtiles{display:flex;gap:8px;overflow-x:auto;padding-top:6px;touch-action:pan-x}
.wtile{flex:none;width:84px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font-size:12px;line-height:1.3;text-align:center;cursor:grab;min-height:0;touch-action:pan-x}
.wtile small{color:var(--muted);font-size:11px}.wtile[aria-pressed=true]{border:2px solid #D4003C;padding:7px 3px}.wtile.nw{border-style:dashed}
.wghost{position:fixed;z-index:9999;transform:translate(-50%,-120%);pointer-events:none;background:#D4003C;color:#fff;font-size:13px;font-weight:700;padding:6px 12px;border-radius:8px;opacity:.9;white-space:nowrap}
.wwarn{margin-top:6px;font-size:.9em;color:#A3002E;background:#FAE0E8;border-radius:8px;padding:6px 10px}
.wsr{display:flex;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--line);font-size:.92em}.wsr>b{color:#D4003C;width:24px;flex:none}.wsr>span:nth-child(2){flex:1}.wtech{color:#A3002E}
</style>`);
  view.addEventListener('click', async e => {
    const t = e.target.closest('[data-wtab],[data-wfld],[data-wsort],[data-wk],[data-wcreate],[data-wnewt],[data-wsup],[data-wbuy],[data-wprice2],[data-wsupgo],[data-wsupx],[data-wshare],[data-wremix],[data-wcmt],[data-wback],[data-wleave],[data-wnext],[data-wwho2],[data-wfield2],[data-wthm],[data-whome],[data-wsel],[data-wpin],[data-wcad],[data-wcnew],[data-wkv],[data-wsheet],[data-wsheetx],[data-wview],[data-wundo],[data-wcat],[data-wpickx],[data-wdel],[data-wcsave],[data-wcx],[data-wterm],[data-wsend]');
    if (!t || t.disabled) return; e.stopPropagation();
    const d = t.dataset, n = S.wn;
    if (skipClick) { skipClick = false; if (Date.now() - dragEnd < 400 && (d.wsel || d.wpin != null || d.wcad)) return; }
    if (d.wkv) { S.wkv = d.wkv; rr(); return; }
    if (d.wsheet) { S.wkE = true; rr(); return; }
    if (d.wsheetx) { S.wkE = false; rr(); return; }
    if (d.wtab) { S.wtab = d.wtab; S.wl2d = null; render(); J.LOAD.wl2().then(render); return; }
    if (d.wfld !== undefined) { S.wfield = d.wfld; S.wl2d = null; render(); J.LOAD.wl2().then(render); return; }
    if (d.wsort) { S.wsort = d.wsort; J.LOAD.wl2().then(render); return; }
    if (d.wk) { openWk(+d.wk); return; }
    if (d.wcreate) { startNew(); return; }
    if (d.wnewt) { startNew({ theme_id: +d.wnewt }); return; }
    if (d.wsup) { const w = S.wkd; if (!w.eligible) { try { await api('/wish/works/' + w.id + '/support', { method: 'POST', body: {} }); } catch (er) { toast(er.message); await api('/wish/works/' + w.id + '/support', { method: 'POST', body: { follow: 1 } }).catch(() => {}); S.wkd = (await api('/wish/works/' + w.id)).work; render(); } return; } S.wsheet = {}; render(); return; }
    if (d.wbuy) { S.wsheet.buy = d.wbuy; render(); return; }
    if (d.wprice2) { S.wsheet.price = d.wprice2; render(); return; }
    if (d.wsupx) { S.wsheet = null; render(); return; }
    if (d.wsupgo) { try { const r = await api('/wish/works/' + S.wkd.id + '/support', { method: 'POST', body: S.wsheet }); S.wsheet = null; S.wkd = (await api('/wish/works/' + S.wkd.id)).work; render(); toast('已送出，目前 ' + r.count + ' 戶也需要'); } catch (er) { toast(er.message); } return; }
    if (d.wshare) { const w = S.wkd; J.shareText('揪心願｜' + w.title, `${w.title}：已經 ${w.count} 個家庭也需要，一起讓它被做出來`); return; }
    if (d.wremix) { const w = S.wkd; startNew({ parent_id: w.id, field: w.field, story: Object.assign({ who: '長輩', when: '', stuck: '', hope: '' }, w.story, { hope: '' }), build: w.build.filter(b => b.part).map(b => ({ slot: b.slot, part: b.part, x: b.x, y: b.y })) }); return; }
    if (d.wcmt) { const i = document.getElementById('wcmt'); try { await api('/wish/works/' + S.wkd.id + '/comments', { method: 'POST', body: { text: i.value } }); S.wkd = (await api('/wish/works/' + S.wkd.id)).work; render(); toast('已送出，審核後顯示'); } catch (er) { toast(er.message); } return; }
    if (!n) return;
    if (d.wback) { if (n.step > 0) { n.step--; render(); } else { S.stack.pop(); render(); } return; }
    if (d.wleave) { if (d.wleave === 'go') { S.wn = null; S.stack.pop(); render(); } else { n.leave = d.wleave === '1'; render(); } return; }
    if (d.wnext) { n.step = +d.wnext; render(); return; }
    if (d.wwho2) { n.story.who = d.wwho2; render(); return; }
    if (d.wfield2) { if (n.field !== d.wfield2) { n.field = d.wfield2; n.build = []; n.sel = null; } render(); return; }
    if (d.wthm !== undefined) { n.theme_id = d.wthm ? +d.wthm : null; render(); return; }
    if (d.whome) { n.home = d.whome; render(); return; }
    if (d.wsel) { n.sel = n.sel === d.wsel ? null : d.wsel; render(); return; }
    if (d.wview) { n.view = d.wview; n.pick = null; rr(); return; }
    if (d.wcat) { n.cat = d.wcat; rr(); return; }
    if (d.wundo) { if (n.hist.length) { n.build = n.hist.pop(); n.pick = null; } rr(); return; }
    if (d.wpickx) { n.pick = null; rr(); return; }
    if (d.wdel != null) { snap(n); n.build.splice(+d.wdel, 1); n.pick = null; rr(); return; }
    if (d.wpin != null) { n.pick = n.pick === +d.wpin ? null : +d.wpin; rr(); return; }
    if (d.wcad) { if (!n.sel) { n.pick = null; rr(); return; } const sv = t.querySelector('svg'); const [x, y] = CAD().clampTo(n.field, ...CAD().toMM(e, sv)); place(n, n.sel, x, y); rr(); return; }
    if (d.wcnew) { n.cform = { name: '', purpose: '', photo: '' }; render(); return; }
    if (d.wcx) { n.cform = null; render(); return; }
    if (d.wcsave) { const f = n.cform; if (!f.name.trim()) { toast('請寫自訂零件的名稱'); return; } const tmp = Date.now() % 100000; n.cparts.push({ tmp, name: f.name.trim(), purpose: f.purpose.trim(), photo: f.photo, status: '待評估' }); n.sel = 'c' + tmp; n.cform = null; render(); return; }
    if (d.wterm) { n.terms[d.wterm] = !n.terms[d.wterm]; render(); return; }
    if (d.wsend) { try { const r = await api('/wish/works', { method: 'POST', body: { title: n.story.hope, field: n.field, theme_id: n.theme_id, parent_id: n.parent_id, story: n.story, build: n.build, cparts: n.cparts, terms: n.terms } }); S.wn = null; S.stack = ['home', 'm2', 'wl2']; S.wtab = 'mine'; S.wl2d = null; toast(r.status === '草稿' ? '已存成草稿（擴展期開放）' : '作品已送出，開始累積共鳴'); openWk(r.id); } catch (er) { toast(er.message); } return; }
  }, true);
  view.addEventListener('input', e => { const t = e.target, n = S.wn; if (!n || !t.dataset) return; if (t.dataset.wst) { n.story[t.dataset.wst] = t.value; const b = document.querySelector('[data-wnext="1"]'); if (b) b.disabled = !n.story.hope.trim(); } if (t.dataset.wcf && n.cform) n.cform[t.dataset.wcf] = t.value; }, true);
  view.addEventListener('change', e => {
    const t = e.target, n = S.wn; if (!n || !t.dataset || !t.dataset.wcphoto || !t.files[0]) return;
    const im = new Image(), u = URL.createObjectURL(t.files[0]);
    im.onload = () => { const s = Math.min(1, 240 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); n.cform.photo = c.toDataURL('image/jpeg', .7); URL.revokeObjectURL(u); render(); };
    im.src = u;
  }, true);
  window.JJJWISH = { openWk, startNew };
})();
