// 揪居家｜工作包 4：擴展期家庭（全部服務 F35、全部訂單 F36、加購與訂閱 F37、家電詳情 F15D、長輩同意 F31）
// 價目來自 /api/catalog；訂單、同意紀錄、設備接入、短影音都存資料庫。載入順序：stage2.js 之後。
(function () {
  const J = window.JJJ; if (!J) return;
  const { V, S, api, esc, stepper, fmt, toast, render, go } = J;
  const hdr = J.hdr;
  const PH = ['試點期', '擴展期', '延伸期'];
  const ph = () => window.JJJPHASE ? window.JJJPHASE() : 2;
  const L2 = () => (window.JJJS2 && window.JJJS2.L) || { s: {} };
  ['co', 'x31e'].forEach(v => { if (!J.NO_NAV.includes(v)) J.NO_NAV.push(v); });
  async function cat() { if (!S.cat) S.cat = await api('/catalog'); return S.cat; }
  const C = id => (S.cat ? S.cat.items.find(x => x.id === id) : null);
  const money = (m, o) => [m ? `每月 ${fmt(m)}` : '', o ? `一次 ${fmt(o)}` : ''].filter(Boolean).join('＋') || '免費';
  const badge = n => ph() >= n ? '' : `<span class="tag" style="margin-left:6px">${PH[n]}開放</span>`;
  const page = (t, body) => `${hdr(t)}<div class="scroll" style="padding-top:12px">${body}</div>`;
  const reload = (k, fn) => { fn().then(() => render()).catch(e => toast(e.message)); };

  // ---------- F35 全部服務 ----------
  V.x0 = () => {
    const card = (g, t, d, n) => `<button class="svc" ${g}><b>${t}${badge(n)}</b><span class="muted">${d}</span></button>`;
    const old = oldest();
    return page('全部服務', `
      <div class="pad muted" style="margin-bottom:8px;font-size:.9em">目前營運階段：${PH[ph()]}。還沒開放的服務也能先看內容，開放時優先通知。</div>
      <div class="sec">長輩家的安全</div><div class="svcg">
        ${card('data-go="pl"', '揪夜安', '臥室到浴室的夜間照明與關懷', 0)}
        ${card('data-go="x24"', '全家場域方案', '廚房、客廳、洗衣陽台加購', 1)}
        ${card('data-go="x26"', '揪全家', '四個場域每月 699 元', 1)}
        ${card('data-go="x25"', '揪食光｜廚房診斷', '依 AR 量測看用火用電風險', 1)}
        ${card('data-go="x30"', '長輩關懷 2.0', '家裡現有的家電也能接入', 1)}
        ${card('data-go="x31"', '進階影像版', '長輩本人同意才裝', 1)}</div>
      <div class="sec">家電</div><div class="svcg">
        ${card(old ? `data-hcseg="${old.id}|2"` : 'data-go="hf"', '換新建議', old ? `${esc(old.name)}已用 ${old.years} 年` : '先保養延壽，效能不足才換新', 1)}
        ${card(old ? `data-hcseg="${old.id}|3"` : 'data-go="x28"', '以租代買', '免押金，含安裝、清洗與保固', 1)}
        ${card('data-go="x29"', '異業加購', '延保搭意外險、冷氣清洗搭打掃', 1)}
        ${card('data-go="x32"', '節氣食譜與共煮', '合作主廚、門市活動', 1)}</div>
      <div class="sec">新家庭</div><div class="svcg">
        ${card('data-go="x33"', '新家與老宅翻修', 'AR 配置全屋家電', 2)}
        ${card('data-go="x34"', '育兒與寵物模式', '嬰兒房溫濕度、寵物出門模式', 2)}
        ${card('data-go="u3"', '校園大使短影音', '孫輩把居家觀察拍成 60 秒', 1)}</div>
      <div class="glist" style="margin-top:14px"><button class="gi" data-go="ords"><span><b>全部訂單</b><span class="muted" style="display:block;font-size:.88em">加購、訂閱、以租代買、活動報名</span></span><span class="chev">›</span></button></div>
      <p class="pad muted" style="font-size:.85em">揪夥伴商用版（日照據點、住宿機構、租屋代管、民宿、小店）另有專用版本。</p>`);
  };
  function oldest() { const D = ((S.hh && S.hh.devices) || []).filter(d => d.years != null && d.source !== '到府安裝'); return D.sort((a, b) => b.years - a.years)[0] || null; }

  // ---------- F15D 家電詳情（分段：健康卡、保養、換新建議、以租代買、異業加購） ----------
  const SEG = ['健康卡', '保養', '換新建議', '以租代買', '異業加購'];
  const BUY = n => /洗衣/.test(n) ? 'washer' : /冷氣/.test(n) ? 'ac' : /冰箱/.test(n) ? 'fridge' : '';
  V.hc = () => {
    const h = ((S.hh && S.hh.devices) || []).find(d => d.id === S.hc); if (!h) return V.m2();
    const k = S.hcSeg || 0, isCare = h.source === '到府安裝';
    const segs = isCare ? SEG.slice(0, 2) : SEG;
    const R = ((S.hh && S.hh.reminders) || []).filter(r => String(r.device || '').includes(h.name.split('｜')[0]) && r.status === '待處理');
    let body = '';
    if (k === 0) body = `<div class="card"><b style="font-size:1.1em">${esc(h.name)}${h.qty > 1 ? ' ×' + h.qty : ''}</b><div class="muted">${h.home === 'parents' ? '長輩家' : '我家'}・${isCare ? '到府安裝時登錄' : '購買紀錄自動帶入'}</div>
      ${h.years != null ? `<div class="row"><span>使用年數</span><b>${h.years} 年</b></div>` : ''}${h.grade ? `<div class="row"><span>能源效率</span><b>${h.grade} 級</b></div>` : ''}${h.kwh ? `<div class="row"><span>年耗電（估算）</span><b>約 ${h.kwh} 度</b></div>` : ''}<div class="row"><span>保固</span><span>${esc(h.warranty || '—')}</span></div><div class="row"><span>狀態</span><span class="tag ${h.warn ? '' : 'ok'}">${esc(h.status || '正常')}</span></div>${isCare ? '<div class="rs" style="margin-top:6px">揪夜安方案設備：保固與故障由綁定門市負責，不走一般報修</div>' : '<button class="row" data-go="wty" style="width:100%"><span>看保固清單</span><span class="chev">›</span></button>'}</div>`;
    else if (k === 1) body = `<div class="card"><b>保養提醒</b>${R.length ? R.map(r => `<div class="row"><span>${esc(r.kind)}<span class="muted" style="display:block;font-size:.85em">${esc(r.reason || '')}</span></span><span class="muted">${esc(r.due || '')}</span></div>`).join('') : '<div class="muted" style="margin-top:4px">目前沒有待處理的保養。年度健檢時間到了會提醒。</div>'}</div>
      <div class="pad"><button class="btn" data-req="${esc(h.name)}保養預約">預約保養</button>${isCare ? `<button class="btn ghost" data-req="${esc(h.name)}設備問題">請生活顧問處理故障</button>` : `<button class="btn ghost" data-repair="${h.id}">線上報修</button>`}</div>`;
    else if (k === 2) {
      const yr = h.years || 0, bad = yr >= 10 || h.warn, save = h.kwh ? Math.round(h.kwh * 0.5 * 3.2) : null;
      body = `<div class="card"><b>${bad ? '建議換新（含舊機回收）' : '先保養延壽'}</b><div class="rs" style="margin-top:4px">${bad ? `已用 ${yr} 年${h.warn ? '，且' + esc(h.status || '') : ''}；換成 1 級能效機種較划算。` : `使用 ${yr} 年，先清洗保養，再觀察一季用電。`}</div>
        ${save ? `<div class="row"><span>換 1 級能效每年約省</span><b>${fmt(save)}</b></div>` : ''}<div class="muted" style="font-size:.85em;margin-top:6px">依家電檔案的使用年限與用電估算；舊機由技師回收。</div></div>
        <div class="pad">${bad ? `<button class="btn" data-hcseg="${h.id}|3">看以租代買</button>${BUY(h.name) ? `<button class="btn ghost" data-addcart="${BUY(h.name)}|換新建議">一次買斷：加入購物車</button>` : ''}<button class="btn ghost" data-req="${esc(h.name)}換新報價">請生活顧問報價</button>` : `<button class="btn" data-hcseg="${h.id}|1">預約保養</button>`}</div>`;
    } else if (k === 3) {
      const t = S.rentT || 36, it = C('rent_washer_' + t);
      body = `<div class="card"><b>${esc(h.name)}｜以租代買</b><div class="seg" role="group" aria-label="期數" style="margin-top:8px"><button data-rent="36" aria-pressed="${t === 36}">36 期</button><button data-rent="60" aria-pressed="${t === 60}">60 期</button></div>
        <div class="row" style="margin-top:8px"><span>每月租金</span><b>${it ? fmt(it.monthly) : '—'}</b></div><div class="muted" style="font-size:.85em">${it ? esc(it.note) : ''}</div></div>
        <div class="pad">${ph() >= 1 ? `<button class="btn" data-co="rent">選這個方案</button>` : '<button class="btn ghost" disabled>擴展期開放</button>'}</div>`;
    } else {
      const P = S.partner || (S.partner = {});
      body = ['ins', 'clean'].map(id => { const c = C(id); return c ? `<button class="card opt" data-ptn="${id}" aria-pressed="${!!P[id]}" style="width:calc(100% - 24px);text-align:left"><b>${P[id] ? '☑' : '☐'} ${esc(c.n)}</b><div class="rs">${money(c.monthly, c.one)}｜${esc(c.note || '')}</div></button>` : ''; }).join('')
        + `<div class="pad">${Object.values(P).some(Boolean) ? '<button class="btn" data-co="partner">加購</button>' : '<button class="btn ghost" disabled>先選要加購的項目</button>'}</div>`;
    }
    return `${hdr('家電詳情')}<div class="scroll" style="padding-top:12px">
      <div class="sxt" role="tablist" style="padding:0 12px 10px;overflow-x:auto;white-space:nowrap">${segs.map((x, i) => `<button role="tab" data-hcs="${i}" aria-selected="${k === i}">${x}</button>`).join('')}</div>${S.cat || k < 3 ? body : '<div class="card muted">載入中…</div>'}</div>`;
  };

  // ---------- F37 加購與訂閱（4 步，名稱對齊現有購物車：確認方案、到府資訊、選擇支付方式、訂單結果） ----------
  const STEPS = ['確認方案', '到府資訊', '選擇支付方式', '訂單結果'];
  const SLOTP = ['平日上午', '平日下午', '假日上午', '假日下午'];
  function startCo(ids, src) { const h = (S.hh && S.hh.household) || {}; S.co = { ids: ids.slice(), on: Object.fromEntries(ids.map(i => [i, true])), src, step: 0, pay: null, agree: false, res: null, leave: false, visit: { address: h.address || '', phone: h.phone || '', slot: '' } }; go('co'); cat().then(render); }
  V.co = () => {
    const c = S.co; if (!c) return V.m2();
    const sel = c.ids.filter(i => c.on[i]).map(C).filter(Boolean), mo = sel.reduce((a, x) => a + x.monthly, 0), on = sel.reduce((a, x) => a + x.one, 0), free = !mo && !on, cam = sel.some(x => x.id === 'cam');
    const top = `<div class="top"><button class="back" data-a="back" aria-label="返回上一頁">‹ 返回</button><h1>加購與訂閱</h1><button class="back" data-co-leave="1" style="text-align:right">離開</button></div>`;
    const leave = c.leave ? `<div class="sheet-bg"><div class="sheet"><b>確定要離開嗎？</b><div class="muted" style="margin:6px 0 12px">這次的選擇不會送出。</div><button class="btn" data-co-leave="go">離開</button><button class="btn ghost" data-co-leave="stay">繼續選</button></div></div>` : '';
    if (!S.cat) return `${top}<div class="scroll"><div class="card muted" style="margin-top:12px">載入中…</div></div>`;
    let body = '', foot = '';
    const v = c.visit, vOK = v.address.trim() && v.phone.trim() && v.slot;
    if (c.step === 0) {
      body = `<div class="pad muted" style="margin-bottom:8px">從「${esc(c.src)}」加入</div>` + c.ids.map(C).filter(Boolean).map(x => `<button class="card opt" data-coi="${x.id}" aria-pressed="${!!c.on[x.id]}" style="width:calc(100% - 24px);text-align:left"><div style="display:flex;justify-content:space-between;gap:8px"><b>${c.on[x.id] ? '☑' : '☐'} ${esc(x.n)}</b><b>${money(x.monthly, x.one)}</b></div>${x.note ? `<div class="rs">${esc(x.note)}</div>` : ''}${x.phase > ph() ? `<div class="rs" style="color:var(--brand-ink)">${PH[x.phase]}才開放</div>` : ''}</button>`).join('')
        + `<div class="card"><div class="row"><b>合計</b><b>${money(mo, on)}</b></div><div class="rs">${mo ? '月付不綁約，可隨時變更或取消' : '費用於到府完成後付款'}</div></div>`;
      foot = `<button class="btn" data-co-next="1" ${sel.length && sel.every(x => x.phase <= ph()) ? '' : 'disabled'}>下一步：到府資訊</button>`;
    } else if (c.step === 1) {
      body = `<div class="card"><label class="muted">到府地址<input class="fld" data-cov="address" value="${esc(v.address)}" placeholder="高雄市三民區建工路 1 號"></label>
        <label class="muted" style="display:block;margin-top:10px">聯絡電話<input class="fld" data-cov="phone" inputmode="tel" value="${esc(v.phone)}" placeholder="0912-345-678"></label>
        <div class="muted" style="margin-top:10px">方便的時段</div><div>${SLOTP.map(x => `<button class="slot" style="margin:6px 6px 0 0" data-coslot="${x}" aria-pressed="${v.slot === x}">${x}</button>`).join('')}</div></div>
        <div class="card" style="background:var(--note)"><div class="rs" style="line-height:1.8">・生活顧問 1 個工作天內打電話確認，再排到府時間<br>・沿用已完成的 AR 量測與家電檔案，只補掃新空間${cam ? '<br>・進階影像版：長輩本人同意後才生效' : ''}</div></div>
        <button class="row" data-co-agree="1" style="width:calc(100% - 24px);margin:0 12px;background:var(--card);border-radius:12px;padding:12px 14px"><span>${c.agree ? '☑' : '☐'} 我已了解以上內容</span></button>`;
      foot = `<button class="btn" data-co-next="${free ? 3 : 2}" ${c.agree && vOK ? '' : 'disabled'}>${free ? '送出' : '下一步：選擇支付方式'}</button>`;
    } else if (c.step === 2) {
      body = `<div class="card">${S.cat.pay.map(p => `<button class="row" data-copay="${esc(p)}" style="width:100%"><span>${c.pay === p ? '◉' : '○'} ${esc(p)}</span></button>`).join('')}</div><div class="card"><div class="row"><span>${esc(sel.map(x => x.n.split('｜')[0]).join('、'))}</span><b>${money(mo, on)}</b></div></div><div class="pad muted" style="font-size:.88em">生活顧問確認後才開始扣款；確認前都可以取消。</div>`;
      foot = `<button class="btn" data-co-next="3" ${c.pay ? '' : 'disabled'}>送出訂單</button>`;
    } else {
      const r = c.res;
      body = r ? `<div class="card" style="text-align:center;padding:24px 16px"><div style="font-size:2em;color:var(--ok)">✓</div><b style="font-size:1.2em">已送出</b><div class="muted" style="margin-top:4px">訂單編號 ${esc(r.code)}</div><div style="margin-top:10px">${money(r.monthly, r.one_time)}</div><div class="rs" style="margin-top:8px">生活顧問 1 個工作天內聯絡您｜${esc(v.slot)}</div>${cam ? '<div class="rs">進階影像版：長輩本人同意後才生效</div>' : ''}</div>` : '<div class="card muted">送出中…</div>';
      foot = `<button class="btn" data-co-done="ords">查看購買紀錄</button><button class="btn ghost" data-co-done="m2">回到揪居家</button>`;
    }
    return `${top}<div class="scroll">${stepper(STEPS, c.step)}${body}</div><div class="pad" style="padding-bottom:12px;background:var(--bg)">${foot}</div>${leave}`;
  };

  // ---------- 線上購物（模擬全國電子線上購物的購物車：購物車、收件填寫、選擇支付方式、訂單結果） ----------
  const SPAY = ['信用卡一次付清', '信用卡分期', '行動支付', '會員點數折抵'];
  async function addCart(items, src) { try { await api('/cart', { method: 'POST', body: { items: items.map(x => ({ ...x, src })) } }); S.shop = { step: 0 }; S.stack.push('shop'); await J.LOAD.shop(); render(); toast('已加入購物車'); } catch (e) { toast(e.message); } }
  V.shop = () => {
    const st = S.shop || (S.shop = { step: 0 }), L = S.cartL, tot = (L || []).reduce((a, x) => a + x.price * x.qty, 0);
    const h = (S.hh && S.hh.household) || {}, f = st.f || (st.f = { name: S.me.name || '', phone: h.phone || '', address: h.address || '' });
    const steps = `<div class="shst">${['購物車', '收件填寫', '選擇支付方式', '訂單結果'].map((x, i) => `<div class="${i === st.step ? 'on' : i < st.step ? 'ok' : ''}"><span>${i + 1}</span>${x}</div>`).join('')}</div>`;
    let body = '';
    if (!L) body = '<div class="card muted">載入中…</div>';
    else if (st.step === 0) body = L.length ? L.map(x => `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(x.name)}</b><b>NT$ ${(x.price * x.qty).toLocaleString('en-US')}</b></div><div style="display:flex;align-items:center;gap:8px;margin-top:8px"><button class="tag" data-cq="${x.sku}|${x.qty - 1}">−</button><span>${x.qty}</span><button class="tag" data-cq="${x.sku}|${x.qty + 1}">＋</button>${x.src ? `<span class="muted" style="margin-left:auto;font-size:.82em">來自${esc(x.src)}</span>` : ''}</div></div>`).join('') + `<div class="card"><div class="row"><b>合計</b><b>NT$ ${tot.toLocaleString('en-US')}</b></div></div><div class="pad"><button class="btn" data-shnext="1">去結帳</button></div>`
      : `<div style="text-align:center;padding:40px 16px"><div style="font-size:3em;color:var(--muted)">🛒</div><div style="margin:10px 0 18px">您的購物車裡還沒有任何商品。</div><button class="btn" data-orig="線上購物商店" style="width:auto;padding:10px 26px">回到商店</button></div>`;
    else if (st.step === 1) body = `<div class="card">${[['name', '收件人'], ['phone', '手機'], ['address', '收件地址']].map(([k, l]) => `<label class="muted" style="display:block;margin-bottom:10px">${l}<input class="fld" data-shf="${k}" value="${esc(f[k])}"></label>`).join('')}<div class="rs">大型家電由技師到府安裝，並免費回收舊機。</div></div><div class="pad"><button class="btn" data-shnext="2">下一步</button></div>`;
    else if (st.step === 2) body = `<div class="card">${SPAY.map(p => `<button class="row" data-shpay="${p}" style="width:100%"><span>${st.pay === p ? '◉' : '○'} ${p}</span></button>`).join('')}</div><div class="card"><div class="row"><b>合計</b><b>NT$ ${tot.toLocaleString('en-US')}</b></div></div><div class="pad"><button class="btn" data-shnext="3" ${st.pay ? '' : 'disabled'}>確認付款</button></div>`;
    else body = st.res ? `<div class="card" style="text-align:center;padding:24px 16px"><div style="font-size:2em;color:var(--ok)">✓</div><b style="font-size:1.2em">訂單已成立</b><div class="muted">訂單編號 ${esc(st.res.code)}｜NT$ ${st.res.total.toLocaleString('en-US')}</div><div class="rs" style="margin-top:8px">訂單也會出現在會員中心「購買紀錄」</div></div><div class="pad"><button class="btn ghost" data-shdone="1">查看購買紀錄</button></div>` : '<div class="card muted">送出中…</div>';
    return `<div class="shtop"><span>‹</span><span>›</span><b>線上購物</b><span>✕</span></div><div class="shurl">https://www.elifemall.com.tw/…</div><div class="scroll" style="padding-top:8px"><div class="pad muted" style="font-size:.85em;margin-bottom:6px">首頁 › 購物車（原型模擬全國電子線上購物）</div>${steps}${body}</div>${J.nav('cart')}`;
  };
  J.LOAD.shop = async () => { S.cartL = (await api('/cart')).items; };
  window.JJJCART = { addCart };

  // ---------- F36 全部訂單 ----------
  V.ords = () => {
    const O = S.ords; const G = [['進行中', o => ['待生活顧問確認', '已報名'].includes(o.status)], ['已確認', o => o.status === '已確認'], ['已取消', o => o.status === '已取消']];
    return page('全部訂單', !O ? '<div class="card muted">載入中…</div>' : !O.length ? '<div class="card"><b>還沒有訂單</b><div class="muted">加購、訂閱、以租代買和活動報名都會出現在這裡。</div><button class="btn ghost" data-go="x0" style="margin-top:10px">看全部服務</button></div>'
      : G.map(([g, f]) => { const L = O.filter(f); return L.length ? `<div class="sec">${g}｜${L.length}</div>` + L.map(o => `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(o.items.map(i => i.n).join('、'))}</b><span class="tag ${o.status === '已確認' ? 'ok' : ''}">${esc(o.status)}</span></div><div class="muted" style="font-size:.88em;margin-top:2px">${esc(o.code)}｜${esc(String(o.created_at).slice(0, 16))}${o.pay ? '｜' + esc(o.pay) : ''}</div><div style="margin-top:6px">${money(o.monthly, o.one_time)}</div>${['待生活顧問確認', '已報名'].includes(o.status) ? `<button class="tag" data-ocancel="${o.id}" style="margin-top:8px">取消</button>` : ''}</div>`).join('') : ''; }).join(''));
  };

  // ---------- F31 長輩本人同意（大字、單一問題） ----------
  V.x31e = () => {
    const r = S.x31r;
    return `<div class="top"><button class="back" data-a="back" aria-label="返回上一頁">‹ 返回</button><h1>請長輩本人確認</h1><span class="tsp"></span></div><div class="scroll" style="padding-top:16px;font-size:1.2em"><div class="pad">
      ${r == null ? `<div class="card" style="text-align:center;padding:24px 16px"><div style="font-size:1.4em;font-weight:700">要在門口裝一台攝影機嗎？</div>
        <div style="text-align:left;line-height:1.9;margin-top:14px">・只裝在門口，臥室和浴室不裝<br>・影像只存在家裡，不上傳<br>・您沒回應又有異常時，才傳一張截圖給家人<br>・隨時可以暫停或刪除</div>
        <button class="btn" data-x31e="1" style="margin-top:18px;font-size:1.1em;padding:16px">我同意</button><button class="btn ghost" data-x31e="0" style="font-size:1.1em;padding:16px">我不要</button></div>`
        : `<div class="card" style="text-align:center;padding:24px 16px"><div style="font-size:1.4em;font-weight:700">${r ? '已記下：您同意' : '已記下：維持不裝鏡頭'}</div><div class="muted" style="margin-top:8px">${r ? '家人可以訂購門口攝影機；您隨時可以改變主意。' : '所有關懷功能照常，不會再詢問。'}</div>
          ${r ? '<button class="btn" data-co="cam" style="margin-top:16px">請家人接著訂購</button>' : '<button class="btn ghost" data-a="back" style="margin-top:16px">回上一頁</button>'}</div>`}
      </div></div>`;
  };

  // ---------- 讓既有擴展期畫面接上資料 ----------
  const wrap = (k, f) => { const o = V[k]; V[k] = () => f(o()); };
  wrap('x31', h => h + (S.cons ? `<div class="sec">同意紀錄</div><div class="glist">${S.cons.filter(c => c.kind === '進階影像版').map(c => `<div class="gi" style="cursor:default"><span><b>${c.agreed ? '長輩同意' : '長輩不同意'}${c.revoked_at ? '（已撤回）' : ''}</b><span class="muted" style="display:block;font-size:.85em">${esc(c.by_name)}｜${esc(String(c.created_at).slice(0, 16))}</span></span>${c.agreed && !c.revoked_at ? `<button class="tag" data-crev="${c.id}">撤回</button>` : ''}</div>`).join('') || '<div class="gi muted" style="cursor:default">還沒有紀錄</div>'}</div>` : ''));
  wrap('x30', h => S.links ? h.replace(/<div class="pad">.*?<\/div>\s*$/s, `<div class="pad"><button class="btn" data-x30save="1">接入可用的設備</button>${S.links.length ? `<div class="okbox" style="margin-top:8px">已接入：${S.links.filter(l => l.linked).map(l => esc(l.name)).join('、') || '無'}</div>` : ''}</div>`) : h);
  wrap('x32', h => { const reg = (S.ords || []).find(o => o.status !== '已取消' && o.items.some(i => i.id === 'cook')); return reg ? h.replace(/<div style="margin-top:8px">[\s\S]*?<\/div><\/div>/, `<div style="margin-top:8px"><span class="tag ok">已報名｜${esc(reg.code)}</span></div></div>`) : h; });
  J.LOAD.x0 = () => cat(); J.LOAD.hc = () => cat(); J.LOAD.x28 = () => cat(); J.LOAD.ords = async () => { S.ords = (await api('/home/orders')).orders; };
  J.LOAD.x31 = async () => { S.cons = (await api('/home/consents')).consents; };
  J.LOAD.x30 = async () => { S.links = (await api('/home/device-links')).links; };
  J.LOAD.x32 = J.LOAD.ords; J.LOAD.u3 = async () => { S.vids = (await api('/videos')).videos; };

  document.getElementById('view').addEventListener('click', async e => {
    const t = e.target.closest('[data-coslot],[data-cq],[data-shnext],[data-shpay],[data-shdone],[data-addcart],[data-co],[data-coi],[data-co-next],[data-co-agree],[data-copay],[data-co-done],[data-co-leave],[data-hcs],[data-hcseg],[data-rent],[data-ptn],[data-ocancel],[data-x31e],[data-crev],[data-x30save],[data-cook],[data-u3send]');
    if (!t || t.disabled) return; e.stopPropagation();
    const d = t.dataset, s = L2().s;
    if (d.co !== undefined) {
      await cat();
      if (d.co === 'fields') startCo(['food', 'tv', 'wash'].filter(k => (s.f24 || {})[k]), '全家場域方案');
      else if (d.co === 'all') startCo(['all'], '揪全家');
      else if (d.co === 'food') startCo(['food'], '揪食光｜廚房診斷');
      else if (d.co === 'rent') startCo(['rent_washer_' + (S.rentT || s.term || 36)], '以租代買');
      else if (d.co === 'partner') startCo(['ins', 'clean'].filter(k => (S.partner || s.f29 || {})[k]), '異業加購');
      else if (d.co === 'cam') startCo(['cam'], '進階影像版');
      return;
    }
    const c = S.co;
    if (d.coslot) { c.visit.slot = d.coslot; render(); return; }
    if (d.cq) { const [k, q] = d.cq.split('|'); await api('/cart/' + k, { method: 'PUT', body: { qty: +q } }); await J.LOAD.shop(); render(); return; }
    if (d.shnext) { const st = S.shop, n = +d.shnext; if (n === 2) { const f = st.f; if (!f.name.trim() || !f.phone.trim() || !f.address.trim()) { toast('請填寫收件人、手機與地址'); return; } } if (n === 3) { st.step = 3; st.res = null; render(); try { st.res = await api('/cart/checkout', { method: 'POST', body: { ...st.f, pay: st.pay } }); S.ords = null; } catch (er) { st.step = 2; toast(er.message); } render(); return; } st.step = n; render(); return; }
    if (d.shpay) { S.shop.pay = d.shpay; render(); return; }
    if (d.shdone) { S.shop = { step: 0 }; S.stack = ['m1', 'ords']; render(); reload('ords', J.LOAD.ords); return; }
    if (d.addcart) { const [sku, src] = d.addcart.split('|'); addCart(sku.split(',').map(x => ({ sku: x, qty: 1 })), src || ''); return; }
    if (d.coi) { c.on[d.coi] = !c.on[d.coi]; render(); return; }
    if (d.coAgree) { c.agree = !c.agree; render(); return; }
    if (d.copay) { c.pay = d.copay; render(); return; }
    if (d.coLeave) { if (d.coLeave === 'go') { S.co = null; J.S.stack.pop(); render(); } else { c.leave = d.coLeave === '1'; render(); } return; }
    if (d.coNext) {
      const n = +d.coNext;
      if (n === 3) {
        c.step = 3; c.res = null; render();
        try { c.res = await api('/home/orders', { method: 'POST', body: { items: c.ids.filter(i => c.on[i]), pay: c.pay, note: JSON.stringify({ visit: c.visit }) } }); S.ords = null; } catch (er) { c.step = 2; toast(er.message); }
        render(); return;
      }
      c.step = n; render(); return;
    }
    if (d.coDone) { S.co = null; J.S.stack = ['home', 'm2'].concat(d.coDone === 'ords' ? ['ords'] : []); render(); if (d.coDone === 'ords') reload('ords', J.LOAD.ords); return; }
    if (d.hcs) { S.hcSeg = +d.hcs; render(); return; }
    if (d.hcseg) { const [id, k] = d.hcseg.split('|'); S.hc = +id; S.hcSeg = +k; if (J.S.stack[J.S.stack.length - 1] === 'hc') { render(); } else go('hc'); cat().then(render); return; }
    if (d.rent) { S.rentT = +d.rent; render(); return; }
    if (d.ptn) { const P = S.partner || (S.partner = {}); P[d.ptn] = !P[d.ptn]; render(); return; }
    if (d.ocancel) { try { await api('/home/orders/' + d.ocancel + '/cancel', { method: 'POST' }); await J.LOAD.ords(); render(); toast('已取消'); } catch (er) { toast(er.message); } return; }
    if (d.x31e !== undefined) { const ok = d.x31e === '1'; try { await api('/home/consents', { method: 'POST', body: { kind: '進階影像版', agreed: ok, by: (window.JJJ.S.ctx && window.JJJ.S.ctx.elder || '長輩') + '本人', items: ['只裝門口', '本機錄影不上傳', '未回應才傳截圖', '可隨時暫停或刪除'] } }); S.x31r = ok; S.cons = null; render(); } catch (er) { toast(er.message); } return; }
    if (d.crev) { await api('/home/consents/' + d.crev + '/revoke', { method: 'POST' }); await J.LOAD.x31(); render(); toast('已撤回，門口攝影機會停用'); return; }
    if (d.x30save) { const ok = {}; document.querySelectorAll('#view [data-x30dev]').forEach(x => { ok[x.dataset.x30dev] = x.dataset.ok === '1'; }); try { await api('/home/device-links', { method: 'PUT', body: { links: ok } }); await J.LOAD.x30(); render(); toast('已接入可用的設備'); } catch (er) { toast(er.message); } return; }
    if (d.cook) { try { await api('/home/orders', { method: 'POST', body: { items: ['cook'] } }); await J.LOAD.ords(); render(); toast('已報名節氣共煮'); } catch (er) { toast(er.message); } return; }
    if (d.u3send) { try { await api('/videos', { method: 'POST', body: { topic: s.u3t, checks: s.u3 || {} } }); s.u3st = 'sent'; render(); toast('已送審'); } catch (er) { toast(er.message); } return; }
  }, true);
  document.getElementById('view').addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.cov && S.co) { S.co.visit[t.dataset.cov] = t.value; const b = document.querySelector('[data-co-next]'); if (b) b.disabled = !(S.co.agree && S.co.visit.address.trim() && S.co.visit.phone.trim() && S.co.visit.slot); } if (t.dataset && t.dataset.shf && S.shop) S.shop.f[t.dataset.shf] = t.value; }, true);
  window.JJJFAM = { startCo, cat };
})();
