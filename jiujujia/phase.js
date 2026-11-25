// 揪居家｜營運階段（示範用）
// 階段存在瀏覽器 localStorage（jjj_phase）。網址加 ?phase=擴展期（或 pilot／exp／ext），
// 打開連結的人就會看到同一個階段，方便分享給評審或組員；正式版由總部後端依決策點切換。
(function () {
  var N = ['試點期', '擴展期', '延伸期'], ALIAS = { pilot: 0, exp: 1, ext: 2, '1': 0, '2': 1, '3': 2 };
  try {
    var q = new URLSearchParams(location.search).get('phase');
    if (q) {
      var i = N.indexOf(q); if (i < 0 && Object.prototype.hasOwnProperty.call(ALIAS, q)) i = ALIAS[q];
      if (i >= 0) localStorage.setItem('jjj_phase', N[i]);
    }
  } catch (e) {}
  function get() { try { return Math.max(0, N.indexOf(localStorage.getItem('jjj_phase') || N[0])); } catch (e) { return 0; } }
  window.JJJPHASE = get;
  window.JJJPHASE_NAMES = N;
  window.JJJPHASE_LINK = function (page, i) { var u = new URL(page, location.href); u.searchParams.set('phase', ['pilot', 'exp', 'ext'][i]); return u.href; };
})();
