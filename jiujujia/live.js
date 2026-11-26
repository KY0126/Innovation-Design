// 實用版（/live/app/、/live/admin/）共用：版本標示、登入提示方框、未登入攔截
// 同一套程式，靠網址 ?mode=live 切換（CLAUDE.md C13、docs/context/目錄結構.md D16）。
// 第一階段（骨架）：不設登入頁、整個揪居家要登入；LINE 登入與 Supabase 在第二階段接上。
(function () {
  const LIVE = /(^|[?&])mode=live(&|$)/.test(location.search.slice(1));
  window.JJJ_LIVE = LIVE;
  if (!LIVE) return;
  const PAGE = /admin\.html/.test(location.pathname) ? 'adm' : 'app';
  document.documentElement.classList.add('jjj-live');

  // 登入提示方框：比例照全國電子 App 原本的登入提示（寬約 83%、左右留白約 9%、三行等行距）
  const CSS = `
#webDemo,#envBadge{display:none!important}
.lv-tag{position:absolute;left:33%;top:50%;transform:translateY(-50%);font-size:13px;font-weight:700;color:#D4003C;pointer-events:none}
.lv-ban{display:block;position:relative;width:calc(100% - 32px);margin:30px 16px 14px;padding:0;min-height:0;height:88px;border:0;border-radius:16px;background:#F3E5E7;text-align:left;overflow:hidden;cursor:pointer;font:inherit}
.lv-ban .s{position:absolute;left:20px;top:20px;font-size:13px;color:#666}
.lv-ban .b{position:absolute;left:20px;top:42px;font-size:19px;font-weight:800;color:#555}
.lv-hx{position:absolute;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.lv-mask{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}
.lv-dlg{width:min(325px,83vw);border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,.18)}
.lv-dlg .tx{padding:22px 9.5% 18px;background:linear-gradient(#f1f1f1 70%,#e6e6e6);text-align:center;font-size:16px;line-height:27px;color:#555}
.lv-dlg .tx .em{color:#D4003C}
.lv-dlg .bt{display:flex}
.lv-dlg .bt button{flex:1;height:58px;border:0;border-radius:0;padding:0;min-height:0;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;cursor:pointer;font-family:inherit}
.lv-dlg .bt .no{background:#fff;color:#444}
.lv-dlg .bt .ok{background:#D4003C;color:#fff}
.lv-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:210;background:#333;color:#fff;font-size:14px;padding:10px 16px;border-radius:10px;max-width:86vw;text-align:center}
`;
  function addCss() { if (document.getElementById('lvCss')) return; const s = document.createElement('style'); s.id = 'lvCss'; s.textContent = CSS; document.head.appendChild(s); }
  if (document.head) addCss(); else document.addEventListener('DOMContentLoaded', addCss);

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'lv-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
  }
  // 確認：第二階段改成 LINE 登入，登入後回到剛才的功能（記在 after）
  let after = null;
  function needLogin(target) {
    if (document.querySelector('.lv-mask')) return;
    after = target || null;
    const m = document.createElement('div'); m.className = 'lv-mask';
    m.innerHTML = '<div class="lv-dlg" role="dialog" aria-modal="true" aria-labelledby="lvMsg"><div class="tx" id="lvMsg">請先登入會員，即可使用更多 APP<br>服務<br><span class="em">登入即享免費居家評估</span></div><div class="bt"><button type="button" class="no" data-lv="no">返回</button><button type="button" class="ok" data-lv="ok">確認</button></div></div>';
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lv]');
      if (!b && e.target !== m) return;
      m.remove();
      if (b && b.dataset.lv === 'ok') toast('LINE 登入將在下一階段接上');
    });
    document.body.appendChild(m);
    m.querySelector('.ok').focus();
  }

  function S() { return window.JJJAPP && window.JJJAPP.S; }
  function guest() { const s = S(); return !s || !s.me; }

  if (PAGE === 'app') {
    // 未登入：除了「大字」與「首頁」，點任何功能都先跳登入提示
    document.addEventListener('click', (e) => {
      if (!guest() || e.target.closest('.lv-mask')) return;
      const el = e.target.closest('#view [data-go], #view [data-a], #view [data-hb], #view [data-nav], #view [data-aigo], #view .lv-ban, #view button');
      if (!el) return;
      if (el.dataset.a === 'big' || el.dataset.nav === 'home') return;
      e.preventDefault(); e.stopPropagation();
      needLogin(el.dataset.go || el.dataset.nav || null);
    }, true);
    // 首頁（未登入）：標「實用版」、會員欄換成註冊誘因橫幅
    (window.JJJHOOKS || (window.JJJHOOKS = [])).push((v, view) => {
      if (v !== 'home' || !guest()) return;
      const hd = view.querySelector('img[src="home/header.png"]');
      if (hd && !view.querySelector('.lv-tag')) hd.insertAdjacentHTML('afterend', '<span class="lv-tag">實用版</span>');
      const mem = view.querySelector('.hmem img');
      if (mem) mem.outerHTML = '<button type="button" class="lv-ban" aria-label="註冊就送免費居家評估，邀家人一起加入再送一份小禮"><span class="s">邀家人一起加入，再送一份小禮</span><span class="b">註冊就送免費居家評估</span>'
        + '<span class="lv-hx" style="left:calc(100% - 109px);top:16px;width:13px;height:14px;background:#E6E6E6"></span>'
        + '<span class="lv-hx" style="left:calc(100% - 75px);top:3px;width:21px;height:23px;background:#EBA6B8"></span>'
        + '<span class="lv-hx" style="left:calc(100% - 91px);top:34px;width:39px;height:44px;background:#F6B8C8;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px">♥</span>'
        + '<span class="lv-hx" style="left:calc(100% - 57px);top:10px;width:49px;height:57px;background:#C8003A"><span style="position:absolute;left:18px;top:14px;width:13px;height:13px;border-radius:50%;background:#FBE3EA"></span><span style="position:absolute;left:13px;top:30px;width:23px;height:12px;border-radius:12px 12px 4px 4px;background:#FBE3EA"></span></span></button>';
    });
  }

  if (PAGE === 'adm') {
    // 後台是工作用：打開先登入；第二階段接上實用版帳號
    document.addEventListener('DOMContentLoaded', () => {
      const lg = document.querySelector('#gate .glogo');
      if (lg && !lg.querySelector('.lv-adm')) lg.insertAdjacentHTML('beforeend', '<span class="lv-adm" style="margin-left:8px;font-size:13px;color:#D4003C">實用版</span>');
      document.querySelectorAll('#gate a[href="app.html"]').forEach((a) => { a.href = '../live/app/'; });
    });
    document.addEventListener('submit', (e) => {
      if (e.target.id !== 'gForm') return;
      e.preventDefault(); e.stopImmediatePropagation();
      const er = e.target.querySelector('.gerr'); if (er) er.textContent = '實用版帳號登入將在下一階段接上。';
    }, true);
  }

  window.JJJLIVE = { needLogin };
})();
