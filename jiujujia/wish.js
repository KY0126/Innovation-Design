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

  // 地圖：與居家安全地圖同一組空間座標（俯視）
  function map(field, build, cps, opt = {}) {
    const W = S.wp; if (!W) return '<div class="muted">載入中…</div>';
    const on = FR[field] || [], L = {}; ((opt.mine && S.hh && S.hh.assessment && S.hh.assessment.lights) || []).forEach(([n, c]) => { const k = Object.keys(ROOMS).find(r => ROOMS[r][4] === n || (n === '門口' && r === 'door')); if (k) L[k] = c; });
    let g = '';
    for (const [k, [x0, z0, x1, z1, n]] of Object.entries(ROOMS)) { const act = on.includes(k), c = L[k]; g += `<rect x="${X(x0)}" y="${X(z0)}" width="${((x1 - x0) * 30).toFixed(0)}" height="${((z1 - z0) * 30).toFixed(0)}" fill="${c ? LIGHT[c] : act ? '#FAE0E8' : '#F3F3F3'}" fill-opacity="${c ? .22 : 1}" stroke="${act ? '#D4003C' : '#B4B2A9'}" stroke-width="${act ? 2 : 1}"/><text x="${X((x0 + x1) / 2)}" y="${X(z0 + .45)}" font-size="10" text-anchor="middle" fill="#5F5E5A">${n}</text>`; }
    (W.slots[field] || []).forEach(([n, x, z], i) => {
      const b = (build || []).find(q => q.slot === i), p = b && b.part ? part(b.part) : null, cp = b && b.cpart != null ? (cps || []).find(c => c.tmp === b.cpart || c.id === b.cpart) : null;
      const at = opt.edit ? `data-wslot="${i}" style="cursor:pointer"` : '';
      if (p) g += `<g ${at} transform="translate(${X(x)},${X(z)})"><circle r="11" fill="${p.tool ? '#BA7517' : '#D4003C'}" stroke="#fff" stroke-width="2.5"/><text y="4" font-size="${p.c.length > 1 ? 8 : 11}" font-weight="700" text-anchor="middle" fill="#fff">${p.c}</text></g>`;
      else if (cp) g += `<g ${at} transform="translate(${X(x)},${X(z)})"><circle r="11" fill="#FAEEDA" stroke="#BA7517" stroke-width="2" stroke-dasharray="3 2"/><text y="4" font-size="10" font-weight="700" text-anchor="middle" fill="#633806">新</text></g>`;
      else if (opt.edit) g += `<g ${at} transform="translate(${X(x)},${X(z)})"><circle r="10" fill="#fff" stroke="#D4003C" stroke-width="1.5" stroke-dasharray="3 2"/><text y="4" font-size="12" text-anchor="middle" fill="#D4003C">＋</text><text y="22" font-size="8.5" text-anchor="middle" fill="#5F5E5A">${n}</text></g>`;
    });
    return `<svg viewBox="0 0 290 290" class="wmap" role="img" aria-label="${esc(field)}的作品預覽圖">${g}</svg>`;
  }
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
      <div class="card" style="padding:8px">${map(w.field, w.build, w.cparts.map(c => ({ ...c, tmp: c.id })))}</div>
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
      ${sh ? `<div class="sheet-bg"><div class="sheet"><b>再回答兩題就送出</b>
        <div class="muted" style="margin-top:8px">做出來你會買嗎？</div><div>${['會', '看價格', '不會'].map(x => `<button class="slot" style="margin:6px 6px 0 0" data-wbuy="${x}" aria-pressed="${sh.buy === x}">${x}</button>`).join('')}</div>
        <div class="muted" style="margin-top:8px">願意付多少？</div><div>${['500 元內', '500–1,000 元', '1,000 元以上'].map(x => `<button class="slot" style="margin:6px 6px 0 0" data-wprice2="${x}" aria-pressed="${sh.price === x}">${x}</button>`).join('')}</div>
        <button class="btn" data-wsupgo="1" style="margin-top:12px" ${sh.buy && sh.price ? '' : 'disabled'}>送出「我也需要」</button><button class="btn ghost" data-wsupx="1">取消</button>
        <div class="rs" style="margin-top:6px">只有訂閱「${esc(w.plan)}」的家庭能支持；其他人可先追蹤</div></div></div>` : ''}
      </div>`;
  };
  async function openWk(id) { S.wkd = null; S.wsheet = null; go('wk'); await meta(); try { S.wkd = (await api('/wish/works/' + id)).work; } catch (e) { toast(e.message); } if (J.S.stack[J.S.stack.length - 1] === 'wk') render(); }

  // ---------- 創作 4 步：寫下心願、拼出來、做法卡、確認送出 ----------
  const WSTEP = ['寫下心願', '拼出來', '做法卡', '確認送出'];
  function startNew(o = {}) { S.wn = Object.assign({ step: 0, field: '臥室到浴室', theme_id: null, parent_id: null, story: { who: '長輩', when: '', stuck: '', hope: '' }, build: [], cparts: [], sel: null, terms: { rules: false, license: false }, home: (S.hh && S.hh.assessment) ? 'mine' : 'tpl', leave: false, cform: null }, o); go('wnew'); Promise.all([meta(), J.LOAD.wl2()]).then(render).catch(() => {}); }
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
      const P = W.parts.filter(p => p.f.includes(n.field)), m = (S.hh && S.hh.assessment && S.hh.assessment.measures) || {};
      body = `<div class="card" style="padding:8px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px"><b style="font-size:.95em">${esc(n.field)}</b><span class="seg" role="group" aria-label="地圖">${S.hh && S.hh.assessment ? `<button data-whome="mine" aria-pressed="${n.home === 'mine'}">我家</button>` : ''}<button data-whome="tpl" aria-pressed="${n.home === 'tpl'}">場域模板</button></span></div>
        ${n.home === 'mine' ? `<div class="rs">依 AR 量測：${m.corridor_cm ? '走道 ' + m.corridor_cm + ' cm' : '尚未量走道'}${m.threshold_cm != null ? '、門檻 ' + m.threshold_cm + ' cm' : ''}；顏色是居家安全燈號</div>` : ''}
        ${map(n.field, n.build, n.cparts, { edit: 1, mine: n.home === 'mine' })}<div class="rs">${n.sel ? '點地圖上的「＋」擺放，再點一次移除' : '先選下面的零件'}</div></div>
        <div class="card"><b>全國電子零件</b><div style="margin-top:6px">${P.map(p => `<button class="slot" style="margin:0 6px 6px 0" data-wsel="${p.id}" aria-pressed="${n.sel === p.id}">${p.c}｜${esc(p.n)}${p.tool ? '（需技師）' : ''}</button>`).join('')}</div>
        <b style="display:block;margin-top:8px">我想要但還沒有的</b><div style="margin-top:6px">${n.cparts.map(c => `<button class="slot" style="margin:0 6px 6px 0;border-style:dashed" data-wsel="c${c.tmp}" aria-pressed="${n.sel === 'c' + c.tmp}">新｜${esc(c.name)}</button>`).join('')}${n.cparts.length < 5 ? '<button class="slot" style="margin:0 6px 6px 0;border-style:dashed" data-wcnew="1">＋ 自訂零件</button>' : ''}</div>
        ${n.cform ? `<div class="wcform"><label class="muted">名稱<input class="fld" data-wcf="name" value="${esc(n.cform.name)}" placeholder="可調光床底燈條"></label><label class="muted" style="display:block;margin-top:8px">用途<input class="fld" data-wcf="purpose" value="${esc(n.cform.purpose)}" placeholder="光從床底照地面，不刺眼"></label><label class="muted" style="display:block;margin-top:8px">照片或手繪（選填，只拍空間）<input type="file" accept="image/*" data-wcphoto="1"></label>${n.cform.photo ? `<img src="${n.cform.photo}" alt="自訂零件照片" style="width:80px;border-radius:8px;margin-top:6px">` : ''}<div style="display:flex;gap:8px;margin-top:8px"><button class="btn" data-wcsave="1" style="margin:0">加入零件盤</button><button class="btn ghost" data-wcx="1" style="margin:0">取消</button></div></div>` : ''}</div>`;
      foot = `<button class="btn" data-wnext="2" ${n.build.length ? '' : 'disabled'}>下一步：做法卡</button>`;
    } else if (n.step === 2) {
      body = `<div class="card" style="padding:8px"><b style="font-size:.95em">預覽圖</b>${map(n.field, n.build, n.cparts, { mine: n.home === 'mine' })}</div>${card(n.build, n.cparts, n.field)}`;
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

  const view = document.getElementById('view');
  view.addEventListener('click', async e => {
    const t = e.target.closest('[data-wtab],[data-wfld],[data-wsort],[data-wk],[data-wcreate],[data-wnewt],[data-wsup],[data-wbuy],[data-wprice2],[data-wsupgo],[data-wsupx],[data-wshare],[data-wremix],[data-wcmt],[data-wback],[data-wleave],[data-wnext],[data-wwho2],[data-wfield2],[data-wthm],[data-whome],[data-wsel],[data-wslot],[data-wcnew],[data-wcsave],[data-wcx],[data-wterm],[data-wsend]');
    if (!t || t.disabled) return; e.stopPropagation();
    const d = t.dataset, n = S.wn;
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
    if (d.wremix) { const w = S.wkd; startNew({ parent_id: w.id, field: w.field, story: Object.assign({ who: '長輩', when: '', stuck: '', hope: '' }, w.story, { hope: '' }), build: w.build.filter(b => b.part).map(b => ({ slot: b.slot, part: b.part })) }); return; }
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
    if (d.wslot) { const i = +d.wslot, k = n.build.findIndex(b => b.slot === i); if (k >= 0) n.build.splice(k, 1); else if (n.sel) n.build.push(n.sel[0] === 'c' ? { slot: i, cpart: +n.sel.slice(1) } : { slot: i, part: n.sel }); else toast('先選一個零件'); render(); return; }
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
