// 揪居家｜營運階段
// 階段存在資料庫 config 表（key = phase），經由 GET／PUT /api/ops/phase 讀寫；預設全部開放（延伸期）。
// 網址加 ?phase=擴展期（或 pilot／exp／ext），打開連結時會把階段寫進資料庫，方便分享給評審或組員。
// JJJPHASE() 回傳目前階段（0 試點期、1 擴展期、2 延伸期）；階段改變時發出 window 事件 'jjjphase'。
(function () {
  var N = ['試點期', '擴展期', '延伸期'], ALIAS = { pilot: 0, exp: 1, ext: 2, '1': 0, '2': 1, '3': 2 };
  var cur = 2;
  function apply(p) { var c = cur; cur = p; if (c !== p) { try { window.dispatchEvent(new CustomEvent('jjjphase', { detail: p })); } catch (e) {} } }
  function load() { return fetch('/api/ops/phase').then(function (r) { return r.json(); }).then(function (d) { apply(+d.phase || 0); return cur; }).catch(function () { return cur; }); }
  function set(i) {
    i = Math.max(0, Math.min(2, i | 0));
    return fetch('/api/ops/phase', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-JJJ': '1' }, body: JSON.stringify({ phase: i }) })
      .then(function (r) { return r.json(); }).then(function (d) { apply(+d.phase); return cur; });
  }
  var q = null;
  try { q = new URLSearchParams(location.search).get('phase'); } catch (e) {}
  var qi = -1;
  if (q) { qi = N.indexOf(q); if (qi < 0 && Object.prototype.hasOwnProperty.call(ALIAS, q)) qi = ALIAS[q]; }
  window.JJJPHASE = function () { return cur; };
  window.JJJPHASE_SET = set;
  window.JJJPHASE_READY = window.JJJSTORE ? (qi >= 0 ? set(qi) : load()) : Promise.resolve(cur);
  window.JJJPHASE_NAMES = N;
  window.JJJPHASE_LINK = function (page, i) { var u = new URL(page, location.href); u.searchParams.set('phase', ['pilot', 'exp', 'ext'][i]); return u.href; };
  // 其他分頁改了資料庫（含營運階段）時重新讀取
  window.addEventListener('storage', function (e) { if (e.key === 'jjj_web_db_v7' && window.JJJSTORE) setTimeout(load, 50); });
})();
