// 揪居家 3 分鐘導覽：遮罩＋功能卡，邊導覽邊操作；切換角色是真的登出再登入（不是沙盒切換器）
(function () {
  const PAGE = /admin\.html/.test(location.pathname) ? 'admin' : 'app';
  const K = 'jjj_tour_step', OFF = 'jjj_tour_off';
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
  const WHO = { 'chen@example.com': '陳小姐（子女）', 'li@example.com': '李小姐（關懷中家庭）', 'advisor@example.com': '王小明（門市顧問）', 'tech@example.com': '吳師傅（技師）', 'manager@example.com': '張經理（總部）' };
  const STEPS = [
    { as: 'chen@example.com', sel: '.agq', t: '① 消費者｜從 AI 顧問阿國開始', d: '陳小姐的媽媽剛開始一個人住。全國電子 App 首頁就有全國電子 AI 顧問阿國，點「幫長輩家做居家診斷」。', click: '.agq [data-go="b1"]' },
    { as: 'chen@example.com', sel: '[data-a="loginChild"]', t: '由子女代填', d: '長輩不用操作手機；選「幫長輩填」。', click: '[data-a="loginChild"]' },
    { as: 'chen@example.com', sel: '#arBtn', t: 'AR 掃描（場勘）', d: '手機對著走廊掃一次，量走道寬與門檻高度。只保存尺寸，不保存影像。', click: '#arBtn' },
    { as: 'chen@example.com', sel: '.arres', t: '量測結果', d: '走道 92 cm、門檻 2 cm。接著回答阿國 5 題；導覽可以幫你一次填完。', act: 'diag', btn: '幫我完成診斷' },
    { as: 'chen@example.com', sel: '#cmp_b3', t: '看懂：安裝前後對比', d: '左右拖曳中間把手：左邊是現在的紅黃綠燈，右邊是安裝後的設備位置。切到「夜間」看感應夜燈亮起的範圍。' },
    { as: 'chen@example.com', sel: '#cmp_b3h', t: '夜間走道實景', d: '同一段 AR 掃描畫面，模擬晚上起床時夜燈一路亮到浴室門口。' },
    { as: 'chen@example.com', sel: '[data-go="share"]', t: '儲存或分享給家人', d: '可以存到「我的家」，或用 LINE 把摘要分享到家人群組（只分享摘要，不含地址與作息）。' },
    { as: 'li@example.com', sel: '.card:has([data-rbook])', t: '已啟用的家庭｜主動提醒', d: '換成已經在用揪夜安的李小姐。關懷設備會主動提醒：感測器電量、夜燈年度健檢。按「一鍵預約」就送出維護工單草稿，門市確認時段後派工。', act: 'm2', btn: '帶我到「我的家」', click: '[data-rbook]', clickBtn: '幫我一鍵預約' },
    { as: 'advisor@example.com', sel: '.kp4', t: '② 門市顧問｜今天', d: '王小明登入後先看 4 張指標卡與一句洞察：今日諮詢、待審差異、待派工、方案待確認。剛剛的一鍵預約已經出現在「待派工」。' },
    { as: 'advisor@example.com', sel: '[data-board]', t: '今日到府：合併到府', d: '林女士家今天兩個施工包：陳師傅先裝夜燈與門檻提示燈條（B，已完成），吳師傅再裝關懷設備（A）。點進去看方案圖面。', click: '[data-board]' },
    { as: 'advisor@example.com', sel: '.pm', t: '規劃：同一張圖，分施工包', d: '每個標記屬於 A 關懷設備或 B 夜間照明；點標記再點圖面可移動位置。長輩確認後鎖定版本，之後的變更都有版本紀錄。' },
    { as: 'tech@example.com', sel: '.card.focus', t: '③ 技師｜今日工作', d: '吳師傅只看到自己的工單，今天的工單聚焦、其他淡化；水電技師的施工包是灰色、只能查看。', click: '.card.focus' },
    { as: 'tech@example.com', sel: '.tmapc', t: '照著裝：圖上只標號碼', d: '施工圖只標施工順序號碼，顏色代表狀態：紅色待施工、酒紅打勾已完成、珊瑚色差異、灰色是水電技師負責的項目。下面依區域分組，點開就看到該區的工作。', click: '[data-tgrp="玄關"]', clickBtn: '幫我展開「玄關」' },
    { as: 'tech@example.com', sel: '.tgrp.open', t: '點項目：完成或回報差異', d: '每一項都有安裝位置與注意事項，做完按「完成」。大門是鋁框，感測器要改用背膠——導覽幫你送出一則「需暫停」的差異回報。', act: 'diff', btn: '幫我回報差異' },
    { as: 'advisor@example.com', sel: '#advD', t: '顧問核准差異 → 新版本', d: '差異回報即時出現在顧問的「今天」。核准後圖面產生新版本，技師的施工包自動恢復。', click: '[data-dfok]', clickBtn: '幫我核准' },
    { as: 'tech@example.com', sel: '.sum', t: '全部完成 → 請長輩驗收', d: '吳師傅把其餘項目做完、按「完成安裝」，工單變成「待驗收」。技師不能自己結案，要由長輩確認。', act: 'finish', btn: '幫我做完其餘項目', click: '[data-a="tAccGo"]', clickBtn: '請長輩驗收' },
    { as: 'tech@example.com', sel: '.tacc', t: '長輩逐區驗收', d: '手機轉給長輩看，大字逐區確認：夜燈會不會亮、按鈕按不按得到。全部沒問題才按「驗收完成」，摘要同步到子女的 App；有問題就退回，相關項目改回待施工。', act: 'accept', btn: '幫長輩逐區確認並驗收' },
    { as: 'manager@example.com', page: 'admin', sel: '#nav', t: '④ 企業營運資訊平台', d: '總部看到的是同一份資料：側欄分成今日工作、服務家庭、揪心願、門市與人員、試點與分析、系統。' },
    { as: 'manager@example.com', page: 'admin', sel: '#nav [data-tab="wo"]', t: '工單', d: '每張工單都有施工包、檢核清單、現場照片與狀態紀錄，剛才的差異核准也在裡面。', click: '#nav [data-tab="wo"]' },
    { as: 'manager@example.com', page: 'admin', sel: '#nav [data-tab="ops"]', t: '服務地圖', d: '全台 316 家門市 → 縣市 → 逢甲店街區，三層往下鑽、往上捲；選取後其他區塊轉灰。', click: '#nav [data-tab="ops"]' },
    { as: 'manager@example.com', page: 'admin', sel: '#mapView .smmain', t: '三層服務地圖', d: '圖上只放顏色、高度、建築與號碼，細節都在右側分組清單；點清單或地圖都會聚焦、其他轉灰。點台中市 →「進入」→ 點逢甲店 →「進入街區」，每一戶的號碼對應清單，可直接建立維護工單草稿。導覽到這裡結束。' },
  ];
  // ---------- 樣式 ----------
  const css = document.createElement('style');
  css.textContent = `#jjjDemo{position:fixed;right:0;top:46%;z-index:9998;display:flex;flex-direction:column;align-items:flex-end;font:12.5px/1.4 "Noto Sans TC",system-ui,sans-serif}
#jjjDemo>button{background:#D4003C;color:#fff;border:0;border-radius:10px 0 0 10px;padding:9px 10px 9px 12px;white-space:nowrap;letter-spacing:1px;cursor:pointer;font-weight:700;font-size:13px;box-shadow:-2px 2px 10px rgba(0,0,0,.2)}
#jjjDemo .pn{display:none;background:#fff;color:#2B2B29;border:1px solid #ddd;border-right:0;border-radius:10px 0 0 10px;padding:10px;box-shadow:0 6px 20px rgba(0,0,0,.18);width:190px}
#jjjDemo.open .pn{display:block}#jjjDemo .pn b{display:block;margin-bottom:6px}#jjjDemo .pn button{display:block;width:100%;margin-top:6px;border:1px solid #ddd;border-radius:8px;background:#fff;padding:6px;cursor:pointer;font:inherit}
#jjjDemo .pn button.p{background:#D4003C;border-color:#D4003C;color:#fff}
#jjjMask{position:fixed;z-index:9996;border-radius:12px;box-shadow:0 0 0 9999px rgba(20,20,24,.55);pointer-events:none;transition:all .25s;outline:3px solid #FFFFFF}
#jjjCard{position:fixed;padding-right:34px!important;z-index:9997;width:min(340px,calc(100vw - 24px));background:#fff;color:#2B2B29;border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.3);padding:14px 14px 12px;font:14px/1.55 "Noto Sans TC",system-ui,sans-serif}
#jjjCard .n{font-size:12px;color:#D4003C;font-weight:700}#jjjCard h3{margin:2px 0 6px;font-size:16px}#jjjCard p{margin:0 0 10px;color:#4A4945}
#jjjCard .r{display:flex;gap:6px;flex-wrap:wrap;align-items:center}#jjjCard button{border:1px solid #DDD;background:#fff;border-radius:9px;padding:6px 10px;cursor:pointer;font:inherit;font-size:13px}
#jjjCard button.p{background:#D4003C;color:#fff;border-color:#D4003C}#jjjCard button.x{position:absolute;top:6px;right:6px;width:28px;height:28px;padding:0;border:0;border-radius:50%;color:#6A6A66;font-size:20px;line-height:28px;background:transparent}#jjjCard button.x:hover{background:#F1F1F1}#jjjCard .who{font-size:12.5px;background:#FCE6EC;color:#8F0029;border-radius:8px;padding:6px 8px;margin-bottom:8px}`;
  document.head.appendChild(css);
  // ---------- 示範工具（取代原本擋住按鈕的右下角浮層） ----------
  const old = document.getElementById('webDemo'); if (old) old.remove();
  const dm = document.createElement('div'); dm.id = 'jjjDemo';
  dm.innerHTML = `<button aria-expanded="false" title="導覽與示範工具">導覽</button><div class="pn"><b>瀏覽器展示版</b><span style="color:#777">資料存在這台瀏覽器</span><button class="p" data-t="start">3 分鐘導覽</button><button data-t="reset">重設示範資料</button></div>`;
  document.body.appendChild(dm);
  dm.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.t === 'start') { LS.set(K, '0'); dm.classList.remove('open'); show(); }
    else if (b.dataset.t === 'reset') { if (b.dataset.arm) { LS.del(K); LS.del(OFF); window.JJJWEB && JJJWEB.reset(); } else { b.dataset.arm = 1; b.textContent = '再按一次確認重設'; } }
    else { dm.classList.toggle('open'); b.setAttribute('aria-expanded', dm.classList.contains('open')); } });
  // ---------- 導覽 ----------
  let mask, card, timer, me = null, scrolled = false;
  const api = async (p, o = {}) => { const r = await fetch('/api' + p, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json', 'X-JJJ': '1' }, body: o.body ? JSON.stringify(o.body) : undefined }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || '操作失敗'); return d; };
  async function who() { try { me = (await api('/me')).user; } catch (e) { me = null; } return me; }
  function stop() { LS.del(K); clearInterval(timer); if (mask) mask.remove(); if (card) card.remove(); mask = card = null; }
  async function switchTo(email, page) {
    try { await api('/auth/logout', { method: 'POST' }); } catch (e) {}
    await api('/auth/login', { method: 'POST', body: { email, password: 'demo1234' } });
    location.href = (page === 'admin' ? 'admin.html' : 'app.html');
  }
  function place() {
    const i = +LS.get(K), s = STEPS[i]; if (!s || !card) return;
    const el = s.sel && document.querySelector(s.sel), ok = el && el.getClientRects().length && (s.page || 'app') === PAGE && me && me.email === s.as;
    if (ok) { const r = el.getBoundingClientRect(); if (!scrolled || r.bottom < 0 || r.top > innerHeight) { el.scrollIntoView({ block: 'center' }); scrolled = true; }
      const q = el.getBoundingClientRect(); Object.assign(mask.style, { display: '', left: q.left - 6 + 'px', top: q.top - 6 + 'px', width: q.width + 12 + 'px', height: q.height + 12 + 'px' });
      const cw = card.offsetWidth, ch = card.offsetHeight; let x = q.right + 14, y = q.top;
      if (x + cw > innerWidth - 8) { x = Math.min(innerWidth - cw - 12, Math.max(12, q.left)); y = q.bottom + 14; if (y + ch > innerHeight - 8) y = q.top - ch - 14; }
      if (y < 8) y = Math.min(innerHeight - ch - 12, q.bottom + 14); if (y < 8) y = 8;
      card.style.left = x + 'px'; card.style.top = Math.min(y, innerHeight - ch - 8) + 'px'; }
    else { mask.style.display = 'none'; card.style.left = (innerWidth - card.offsetWidth) / 2 + 'px'; card.style.top = Math.max(12, innerHeight - card.offsetHeight - 90) + 'px'; }
  }
  async function show() {
    const i = +LS.get(K); if (isNaN(i) || LS.get(K) == null) return; const s = STEPS[i]; if (!s) { stop(); return; }
    await who();
    if (!mask) { mask = document.createElement('div'); mask.id = 'jjjMask'; document.body.appendChild(mask); card = document.createElement('div'); card.id = 'jjjCard'; card.setAttribute('role', 'dialog'); document.body.appendChild(card); }
    const page = s.page || 'app', right = me && me.email === s.as && page === PAGE;
    let act = '';
    if (!right) act = `<div class="who">這一步要用 <b>${WHO[s.as]}</b> 的帳號${page !== PAGE ? '，在' + (page === 'admin' ? '企業營運資訊平台' : '手機 App') : ''}操作。導覽會幫你登出，再用示範帳號真的登入。</div><button class="p" data-tt="switch">幫我切換</button>`;
    else if (s.act && LS.get('jjj_tour_acted') !== String(i)) act = `<button class="p" data-tt="act">${s.btn || '幫我做'}</button>${s.click ? `<button data-tt="click">${s.clickBtn || '幫我點'}</button>` : ''}`;
    else if (s.click) act = `<button class="p" data-tt="click">${s.clickBtn || '幫我點'}</button>`;
    card.innerHTML = `<div class="n">導覽 ${i + 1}／${STEPS.length}｜${WHO[s.as]}</div><h3>${s.t}</h3><p>${s.d}</p><div class="r">${act}${i ? '<button data-tt="prev">上一步</button>' : ''}<button ${act ? '' : 'class="p"'} data-tt="next">${i === STEPS.length - 1 ? '完成' : '下一步'}</button></div><button class="x" data-tt="stop" aria-label="關閉導覽" title="關閉導覽">×</button>`;
    scrolled = false; clearInterval(timer); timer = setInterval(place, 350); setTimeout(place, 30);
  }
  async function doAct(s) {
    const J = window.JJJ;
    if (s.act === 'diag' && J && J.tourDiag) await J.tourDiag();
    else if (s.act === 'm2' && J) J.tourGo(['home', 'm2'], 'parents');
    else if (s.act === 'diff' && J && J.tourDiff) await J.tourDiff();
    else if (s.act === 'finish' && J && J.tourFinish) await J.tourFinish();
    else if (s.act === 'accept' && J && J.tourAccept) await J.tourAccept();
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest && e.target.closest('#jjjCard [data-tt]'); if (!b) return; const i = +LS.get(K), s = STEPS[i], t = b.dataset.tt;
    if (t === 'stop') { LS.set(OFF, '1'); return stop(); }
    if (t === 'next') { if (i >= STEPS.length - 1) { LS.set(OFF, '1'); return stop(); } LS.set(K, String(i + 1)); const n = STEPS[i + 1]; if ((n.page || 'app') !== PAGE && me && me.email === n.as) { location.href = n.page === 'admin' ? 'admin.html' : 'app.html'; return; } return show(); }
    if (t === 'prev') { LS.set(K, String(i - 1)); return show(); }
    b.disabled = true;
    try {
      if (t === 'switch') await switchTo(s.as, s.page || 'app');
      else if (t === 'click') { const el = document.querySelector(s.click); if (el) el.click(); else alert('畫面上找不到這個按鈕，請先照說明操作'); await new Promise(r => setTimeout(r, 700)); LS.set(K, String(i + 1)); show(); }
      else if (t === 'act') { await doAct(s); await new Promise(r => setTimeout(r, 500)); if (!s.click) { LS.set(K, String(i + 1)); } else LS.set('jjj_tour_acted', String(i)); show(); }
    } catch (x) { b.disabled = false; const p = card && card.querySelector('p'); if (p) p.insertAdjacentHTML('beforeend', `<br><span style="color:#D4003C">${x.message}</span>`); }
  });
  addEventListener('resize', place);
  // 頁面載入（含切換帳號後）自動接續導覽
  // 預設自動開始導覽；按 × 關掉後不再自動出現（可從右側「導覽」重新開始）
  if (LS.get(K) == null && LS.get(OFF) == null) LS.set(K, '0');
  if (LS.get(K) != null) setTimeout(show, 1600);
  window.JJJTOUR = { start() { LS.set(K, '0'); show(); }, stop };
})();
