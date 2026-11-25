// 揪居家｜工作包 3：揪問 AI（浮動按鈕＋F22 對話頁）
// 原型階段：依「這個家／這間門市」資料庫裡的資料回答（規則比對），答不了就轉給生活顧問；
// 正式版換成大型語言模型時，仍只把同樣這些資料交給模型，回答格式不變。
(function () {
  const J = window.JJJ; if (!J) return;
  const { V, S, api, esc, fmt, toast, render, go } = J;
  const IMG = 'home/staff.jpg';
  // 不顯示的畫面：登入、流程頁、通知直達頁、長輩裝置、技師
  const HIDE = ['m1', 'co', 'wnew', 'boot', 'login', 'register', 'pw', 'ai', 'ar', 'arm', 'uvisit', 'b1', 'b2', 'b3', 'b4', 'b5', 'co', 'x31e', 'e1', 'c1', 'c2', 'c3', 'ev', 'msum', 'n0', 'share', 'a2', 'a3', 'a4', 'a5', 'a6', 'aec', 'wish', 'obs'];
  const roleOK = () => S.me && (S.me.role === 'family' || S.me.role === 'advisor');
  let hidden = false;
  function after(v, view) {
    if (v === 'm2' || v === 'a1') hidden = false; // 回到揪居家主頁（顧問：今日行程）才再出現
    if (!roleOK() || hidden || HIDE.includes(v) || /^t/.test(v) && S.me.role !== 'family') return;
    const navH = view.querySelector('nav.nav') ? 120 : 64; // 留出底部導覽與展示版標籤
    view.insertAdjacentHTML('beforeend', `<div class="aifab" style="bottom:${navH + 10}px"><button class="aib" data-aigo="1" aria-label="揪問 AI：問全國電子 AI 顧問阿國"><img src="${IMG}" alt="全國電子 AI 顧問阿國"><span class="ail">揪問 AI</span></button><button class="aix" data-aihide="1" aria-label="收起揪問 AI">×</button></div>`);
    const sc = view.querySelector('.scroll'); if (sc) sc.style.paddingBottom = '128px';
  }

  // ---------- 回答 ----------
  const has = (q, ...k) => k.some(x => q.includes(x));
  const EN = () => (S.ctx && S.ctx.elder) || (S.hh && S.hh.household.elder_name) || '長輩';
  async function answerFamily(q) {
    const H = S.hh || {}, care = H.care || [], dev = (H.devices || []).filter(d => d.warn);
    if (has(q, '119', '跌倒', '緊急', '昏倒', '危險', '救護')) return { t: `如果${EN()}可能有危險，請<b>立刻撥打 119</b>。揪居家不取代緊急救護；門市負責事前設定與事後關心，不參與緊急處理。`, a: [['看關懷紀錄', 'gl']] };
    if (has(q, '平安', '今天', '昨晚', '還好', '狀況', '媽', '爸', '長輩', '關懷')) {
      const e = care[0];
      return e ? { t: `${EN()}最近一次是 <b>${esc(e.when)}</b>「${esc(e.title)}」，結果：<b>${esc(e.outcome)}</b>。${e.outcome === '長輩確認' ? '是長輩自己按「我很好」結束的，沒有通知家人。' : ''}近期共 ${care.length} 筆紀錄。`, a: [['看關懷紀錄', 'gl'], ['每月摘要', 'msum']] }
        : { t: `${EN()}目前沒有異常紀錄。夜間關懷${H.plan ? '運作中' : '安裝驗收後開啟'}。`, a: [['長輩關懷', 'ch']] };
    }
    if (has(q, '通知', '訊息', 'LINE')) { const d = await api('/home/notifications'); return { t: d.notifications.length ? `你有 <b>${d.unread}</b> 則未讀通知。最新一則：「${esc(d.notifications[0].title)}」。` : '目前沒有通知。長輩家有狀況、每月摘要或方案更新時，會同時送到這裡和 LINE。', a: [['看通知', 'inbox'], ['通知設定', 'nset']] }; }
    if (has(q, '摘要', '這個月', '本月')) { const m = await api('/home/summary'); return { t: `這個月到今天：<b>${m.quiet}／${m.days}</b> 天平安，長輩自己按「我很好」${m.self} 次，通知家人 ${m.fam} 次，設備提醒 ${m.dev} 次。`, a: [['看每月摘要', 'msum']] }; }
    if (has(q, '家電', '保養', '冷氣', '洗衣機', '冰箱', '換新', '租')) {
      return dev.length ? { t: `有 <b>${dev.length}</b> 台家電要注意：${dev.map(d => `${esc(d.name)}（${esc(d.status || '')}${d.years ? '，' + d.years + ' 年' : ''}）`).join('、')}。原則是先保養延壽，效能真的不足才換新，也可以以租代買。`, a: [['看全部服務', 'x0'], ['家電檔案', 'hf']] }
        : { t: '家電目前都正常。年度健檢時間到了會主動提醒。', a: [['家電檔案', 'hf']] };
    }
    if (has(q, '我家', '我的方案', '我們家') && has(q, '方案', '月費')) {
      const c = await api('/catalog'), p = id => (c.items.find(x => x.id === id) || {}).monthly;
      return { t: `揪夜安基本 ${fmt(p('night_basic'))}、安心 ${fmt(p('night_plus'))}／月；加購揪食光 +${p('food')}、揪團聚 +${p('tv')}、揪清爽 +${p('wash')}；四個場域都要改用揪全家 ${fmt(p('all'))}／月。月付不綁約，家庭方案不依人數加價。${H.plan ? `你家目前是「${esc(J.planName ? J.planName(H.plan.plan) : H.plan.plan)}」。` : ''}`, a: [['全家場域方案', 'x24'], ['專屬居家方案', 'pl']] };
    }
    if (has(q, '訂單', '加購', '訂閱')) { const o = (await api('/home/orders')).orders; return { t: o.length ? `你有 ${o.length} 筆訂單，最新一筆「${esc(o[0].items.map(i => i.n).join('、'))}」：<b>${esc(o[0].status)}</b>。` : '目前沒有訂單。', a: [['全部訂單', 'ords'], ['全部服務', 'x0']] }; }
    if (has(q, '預約', '門市', '顧問', '到府', '安裝')) {
      const b = S.booked, st = (H.household && H.household.store) || '綁定門市';
      return { t: b ? `你的預約：<b>${esc(b.store)}</b> ${esc(b.slot || '')}（${esc(b.status)}）。` : `綁定門市是 <b>${esc(st)}</b>。還沒預約的話，可以先做 5 分鐘居家評估，再預約門市諮詢。`, a: b ? [['安裝進度', 'ip']] : [['開始居家評估', 'b1']], req: '請生活顧問聯絡我' };
    }
    if (has(q, '點數') && has(q, '我', '多少', '剩')) { const P = await api('/points'); return { t: `揪心願點數：已入帳 <b>${P.total}</b> 點、待檢核 ${P.pending} 點（併入全國電子會員點數）。`, a: [['點數紀錄', 'pts']] }; }
    if (has(q, '保固') && has(q, '我', '到期', '哪些', '家')) { const W = await api('/home/warranty'), A = W.mine.concat(W.parents), ex = A.filter(d => d.expired); return { t: `保固清單共 ${A.length} 項，其中 <b>${ex.length}</b> 項已過保${ex.length ? '：' + ex.map(d => esc(d.name)).join('、') : ''}。`, a: [['保固清單', 'wty']] }; }
    if (has(q, '報修') && has(q, '進度', '到哪', '我的')) { const R = (await api('/home/requests')).requests.filter(r => r.kind === '線上報修'); return { t: R.length ? `你有 ${R.length} 筆報修，最新一筆「${esc(R[0].note)}」：<b>${esc(R[0].status)}</b>。` : '目前沒有報修。', a: [['線上報修清單', 'reqs']] }; }
    return null;
  }
  async function answerAdvisor(q) {
    if (has(q, '119', '緊急', '跌倒')) return { t: '門市不參與緊急處理：由家人判斷是否撥打 119。門市負責事前設定與事後關心。', a: [['門市待辦', 'd3']] };
    if (has(q, '待辦', '關心', '售後', '需求')) { const d = await api('/advisor/todos'); return { t: `門市待辦：事後關心 <b>${d.care.length}</b> 件、家庭需求與設備問題 <b>${d.requests.length}</b> 件。${d.care[0] ? `最新：${esc(d.care[0].household)}「${esc(d.care[0].title)}」。` : ''}`, a: [['門市待辦', 'd3']] }; }
    const C = (await api('/advisor/cases')).cases;
    const hit = C.find(c => q.includes(c.household.replace('家', '')));
    if (hit) return { t: `${esc(hit.household)}：<b>${esc(hit.stage)}</b>。下一步：${esc(hit.next)}${hit.care + hit.req ? `；待辦 ${hit.care + hit.req} 件` : ''}。`, a: [['看案件', 'acases']] };
    if (has(q, '今天', '行程', '下一個', '幾件')) { const n = s => C.filter(c => c.stage === s).length; return { t: `目前案件：待問診 ${n('待問診')}、待報價 ${n('待報價')}、待長輩確認 ${n('待長輩確認')}、施工中 ${n('施工中')}、售後 ${n('售後')}。`, a: [['今日行程', 'a1'], ['案件', 'acases']] }; }
    return null;
  }

  const SUG = { family: ['媽媽昨晚還好嗎？', '我的保固哪些到期？', '我的報修進度', '這個月的摘要'], advisor: ['今天有幾件？', '門市待辦', '黃先生家進度'] };
  const STORE_KW = ['揪居家', '長輩', '媽', '爸', '方案', '安裝', '關懷', '心願', 'AR', '量測', '設備', '夜燈', '顧問', '到府'];
  async function loadFaq() { if (!S.faq) S.faq = (await api('/faq')).faq; return S.faq; }
  const src = f => `<div class="aisrc">依據：常見問題｜${esc(f.cat)}｜${esc(f.source || '')}${f.url ? `｜<a href="${esc(f.url)}" target="_blank" rel="noopener">來源</a>` : ''}｜${esc(String(f.updated_at || '').slice(0, 10))} 更新</div>`;
  V.ai = () => {
    const role = S.me.role, L = S.aiLog || (S.aiLog = [{ me: 0, t: role === 'advisor' ? `${esc(S.me.name)}您好，我是全國電子 AI 顧問阿國。可以問我今天的案件、某一家的進度或說明話術。` : `您好，我是全國電子 AI 顧問阿國，也是全國電子客服。可以問我${esc(EN())}最近的狀況、家電保固、訂單、點數，或下面的常見問題；答不了會幫您找真人。` }]);
    const F = S.faq, cats = F ? [...new Set(F.map(f => f.cat))] : [], oc = S.faqCat;
    return `${J.hdr('揪問 AI｜客服', { aplus: false })}<div class="scroll aichat" id="aiS">
      ${L.map((m, k) => m.me ? `<div class="aim me"><div>${esc(m.t)}</div></div>` : `<div class="aim"><img src="${IMG}" alt=""><div><div>${m.t}</div>${m.f ? src(m.f) : ''}${(m.a || []).length || m.hand ? `<div class="aia">${(m.a || []).map(([l, v]) => `<button class="tag" data-go="${v}">${l} ›</button>`).join('')}${m.hand ? `<button class="tag" data-aihand="${m.hand}|${k}">找真人：${m.hand === 'cs' ? '全國電子客服' : '生活顧問'}</button>` : ''}</div>` : ''}${m.log && m.f && m.help == null ? `<div class="aihelp">有幫助嗎？<button class="tag" data-aihelp="${k}|1">有</button><button class="tag" data-aihelp="${k}|0">沒有</button></div>` : m.help != null ? `<div class="aihelp">${m.help ? '謝謝回饋' : '已記下，我們會改進這一題'}</div>` : ''}</div></div>`).join('')}
      ${S.aiBusy ? `<div class="aim"><img src="${IMG}" alt=""><div class="muted">查詢資料中…</div></div>` : ''}
      <div class="ais">${(SUG[role] || []).map(x => `<button class="slot" data-aiq="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <div class="sec" style="padding-left:0">常見問題</div>
      ${!F ? '<div class="muted">載入中…</div>' : `<div class="ais">${cats.map(c => `<button class="slot" data-faqcat="${esc(c)}" aria-pressed="${oc === c}">${esc(c)}</button>`).join('')}</div>${oc ? `<div class="glist" style="margin:0 0 10px">${F.filter(f => f.cat === oc).map(f => `<button class="gi" data-faqid="${f.id}"><span>${esc(f.q)}</span><span class="chev">›</span></button>`).join('')}</div>` : ''}`}
      <div class="aitalk"><button class="tag" data-aihand="${role === 'advisor' ? 'cs' : 'store'}|-1">找真人</button><span class="muted" style="font-size:.85em">客服專線 0800-021-921</span></div>
      <p class="muted pad" style="font-size:.82em">回答依常見問題與你在揪居家、全國電子的資料整理，並標示出處；不構成醫療判斷，找不到依據會轉給真人。</p></div>
      <form class="aif" id="aiForm"><input id="aiQ" class="fld" placeholder="輸入問題" autocomplete="off" aria-label="輸入問題"><button class="btn" type="submit" style="margin:0;width:auto;padding:0 18px">送出</button></form>`;
  };
  async function ask(q, faqId) {
    q = String(q || '').trim(); if (!q || S.aiBusy) return;
    (S.aiLog || []).push({ me: 1, t: q }); S.aiBusy = true; render(); scroll();
    let r = null, f = null;
    try {
      if (has(q, '119', '跌倒', '緊急', '昏倒', '救護', '沒有呼吸')) r = { t: `如果可能有危險，請<b>立刻撥打 119</b>。揪居家不取代緊急救護；門市負責事前設定與事後關心，不參與緊急處理。` };
      else {
        // 有「我、媽、爸、今天」這類字先查個人資料，否則先比對常見問題
        const mine = S.me.role === 'advisor' || /我|媽|爸|昨晚|今天|這個月|本月/.test(q);
        const personal = async () => faqId ? null : (S.me.role === 'advisor' ? await answerAdvisor(q) : await answerFamily(q));
        const faq = async () => { const x = faqId ? (await loadFaq()).find(y => y.id === +faqId) : (await api('/faq/match?q=' + encodeURIComponent(q))).best; return x ? { t: esc(x.a), f: x } : null; };
        r = mine ? (await personal()) || (await faq()) : (await faq()) || (await personal());
      }
    } catch (e) { r = { t: '資料讀取失敗，請稍後再試。' }; }
    const hand = STORE_KW.some(k => q.includes(k)) ? 'store' : 'cs';
    if (!r) r = { t: '這題我找不到依據，不想亂答。要幫你轉給真人嗎？', hand };
    let logId = null; try { logId = (await api('/faq/log', { method: 'POST', body: { q, faq_id: r.f ? r.f.id : null, handed: 0 } })).id; } catch (e) {}
    S.aiLog.push({ me: 0, t: r.t, a: r.a, f: r.f, hand: r.hand, log: logId, q }); S.aiBusy = false;
    if (J.S.stack[J.S.stack.length - 1] === 'ai') { render(); scroll(); }
  }
  function scroll() { const L = document.querySelectorAll('#aiS .aim'); if (L.length > 1) L[L.length - 1].scrollIntoView({ block: 'start' }); }
  const view = document.getElementById('view');
  view.addEventListener('click', e => {
    const t = e.target.closest('[data-aigo],[data-aihide],[data-aiq],[data-aireq],[data-faqcat],[data-faqid],[data-aihand],[data-aihelp]'); if (!t) return; e.stopPropagation();
    if (t.dataset.faqcat) { S.faqCat = S.faqCat === t.dataset.faqcat ? null : t.dataset.faqcat; render(); return; }
    if (t.dataset.faqid) { const f = (S.faq || []).find(x => x.id === +t.dataset.faqid); if (f) ask(f.q, f.id); return; }
    if (t.dataset.aihelp) { const [k, v] = t.dataset.aihelp.split('|'); const m = S.aiLog[+k]; if (m) { m.help = v === '1'; api('/faq/helpful', { method: 'POST', body: { id: m.log, helpful: m.help } }).catch(() => {}); render(); } return; }
    if (t.dataset.aihand) { const [tg, k] = t.dataset.aihand.split('|'); const m = S.aiLog[+k], topic = (m && m.q) || (S.aiLog.filter(x => x.me).slice(-1)[0] || {}).t || '一般詢問'; api('/support/handoff', { method: 'POST', body: { target: tg === 'cs' ? 'cs' : 'store', topic, transcript: S.aiLog.map(x => (x.me ? '使用者：' : '阿國：') + String(x.t).replace(/<[^>]+>/g, '')) } }).then(d => { if (m && m.log) api('/faq/log', { method: 'POST', body: { q: topic, faq_id: null, handed: 1 } }).catch(() => {}); S.aiLog.push({ me: 0, t: `已轉給<b>${esc(d.target)}</b>，對話內容一併交接，不用再講一次。${esc(d.eta)}` }); render(); scroll(); }).catch(er => toast(er.message)); return; }
    if (t.dataset.aigo) { go('ai'); loadFaq().then(() => { if (J.S.stack[J.S.stack.length - 1] === 'ai') render(); }).catch(() => {}); setTimeout(scroll, 0); }
    else if (t.dataset.aihide) { hidden = true; t.closest('.aifab').remove(); toast('已收起；回到揪居家主頁會再出現'); }
    else if (t.dataset.aiq) ask(t.dataset.aiq);
    else if (t.dataset.aireq) api('/requests', { method: 'POST', body: { kind: '請生活顧問聯絡', note: t.dataset.aireq } }).then(d => toast(d.duplicate ? '已送出過，門市處理中' : '已請生活顧問聯絡您')).catch(er => toast(er.message));
  }, true);
  view.addEventListener('submit', e => { if (e.target.id !== 'aiForm') return; e.preventDefault(); e.stopPropagation(); const i = document.getElementById('aiQ'); const q = i.value; i.value = ''; ask(q); }, true);
  window.JJJAI = { after, ask };
})();
