// 實用版（/live/app/、/live/admin/）共用：版本標示、登入提示方框、未登入攔截、載入實用版程式
// 同一套程式，靠網址 ?mode=live 切換（CLAUDE.md C13、docs/context/目錄結構.md D16）。
// 不設登入頁、整個揪居家要登入（S01 第三版）；登入後的畫面在 live-app.js，後台在 live-admin.js。
(function () {
  const LIVE = /(^|[?&])mode=live(&|$)/.test(location.search.slice(1));
  window.JJJ_LIVE = LIVE;
  if (!LIVE) return;
  const PAGE = /admin\.html/.test(location.pathname) ? 'adm' : 'app';
  document.documentElement.classList.add('jjj-live');

  // 實用版才載入：Supabase、設定、登入後畫面（保持載入順序）
  const V = '20261126g';
  ['vendor/supabase-2.119.2.js', 'live-config.js?v=' + V, ...(PAGE === 'app' ? ['live-measure.js?v=' + V, 'live-app.js?v=' + V] : ['live-admin.js?v=' + V])].forEach((src) => {
    const s = document.createElement('script'); s.src = src; s.async = false; document.head.appendChild(s);
  });

  // 登入提示方框：比例照全國電子 App 原本的登入提示（寬約 83%、左右留白約 9%、三行等行距）
  const CSS = `
#webDemo,#envBadge{display:none!important}
.lv-tag{position:absolute;left:33%;top:50%;transform:translateY(-50%);font-size:13px;font-weight:700;color:#D4003C;pointer-events:none}
.lv-ban{display:block;position:relative;width:calc(100% - 32px);margin:30px 16px 14px;padding:0;min-height:0;height:88px;border:0;border-radius:16px;background:#F3E5E7;text-align:left;overflow:hidden;cursor:pointer;font:inherit}
.lv-ban .s{position:absolute;left:20px;top:20px;font-size:13px;color:#666}
.lv-ban .b{position:absolute;left:20px;top:42px;font-size:19px;font-weight:800;color:#555}
.lv-ban.in{background:#fff;border:1px solid #E5E1DF}
.lv-ban.in .b{color:#C8003A}
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
.card.lv-hero{padding:0;overflow:hidden}
.lv-red{background:#C8003A;color:#fff;padding:14px 16px 12px}.lv-red .s{font-size:.82em;opacity:.95}.lv-red .b{font-size:1.35em;font-weight:800;margin:2px 0}
.lv-in{padding:12px 16px 14px}
.lv-em{color:#C8003A;font-weight:700;font-size:.88em;margin-bottom:8px}
.lv-tl{list-style:none;margin:0 0 10px;padding:0}
.lv-tl li{position:relative;padding:0 0 10px 22px;display:flex;gap:8px;align-items:baseline;color:#8C959F;font-size:.9em}
.lv-tl li::before{content:"";position:absolute;left:2px;top:4px;width:10px;height:10px;border-radius:50%;background:#C9C9C9}
.lv-tl li.done,.lv-tl li.now{color:#1F2328}.lv-tl li.done::before,.lv-tl li.now::before{background:#C8003A}
.lv-tl li.now::before{box-shadow:0 0 0 4px #F6C344}.lv-tl li.now b{color:#C8003A}
.lv-lights{display:flex;flex-direction:column;gap:6px;margin:0 0 10px}
.lv-l{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:.92em}.lv-l .dot{width:12px;height:12px;border-radius:50%}
.lv-inv{display:flex;gap:12px;align-items:center;justify-content:space-between}.lv-inv .btn{flex:none;white-space:nowrap}
.lv-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;background:#fff;border-radius:14px;padding:12px 4px;margin:10px 0}
.lv-grid button{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:.8em;background:none;border:0;min-height:44px;padding:0;color:inherit}
.lv-grid .i{width:36px;height:36px;border-radius:50%;background:#F9DDE5}
.lv-code{font-size:2em;font-weight:800;letter-spacing:.2em;margin:10px 0 14px;color:#C8003A}
`;
  function addCss() { if (document.getElementById('lvCss')) return; const s = document.createElement('style'); s.id = 'lvCss'; s.textContent = CSS; document.head.appendChild(s); }
  if (document.head) addCss(); else document.addEventListener('DOMContentLoaded', addCss);

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'lv-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
  }
  const APP = () => window.JJJLIVEAPP;
  // 確認：用 LINE 登入，登入後回到剛才的功能（target）；extra 帶邀請碼或心願編號
  function needLogin(target, extra) {
    if (document.querySelector('.lv-mask')) return;
    const m = document.createElement('div'); m.className = 'lv-mask';
    m.innerHTML = '<div class="lv-dlg" role="dialog" aria-modal="true" aria-labelledby="lvMsg"><div class="tx" id="lvMsg">請先登入會員，即可使用更多 APP<br>服務<br><span class="em">登入即享免費居家評估</span></div><div class="bt"><button type="button" class="no" data-lv="no">返回</button><button type="button" class="ok" data-lv="ok">確認</button></div></div>';
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lv]');
      if (!b && e.target !== m) return;
      m.remove();
      if (b && b.dataset.lv === 'ok') { if (APP()) APP().login(target, extra); else toast('LINE 登入準備中，請稍後再試'); }
    });
    document.body.appendChild(m);
    m.querySelector('.ok').focus();
  }
  const loggedIn = () => !!(APP() && APP().loggedIn());

  if (PAGE === 'app') {
    // 點首頁上的功能：未登入跳登入提示；已登入交給實用版畫面（試點只開放揪居家）
    const keyOf = (el) => el.matches('.hg1, [data-hb="0"], .lv-ban') || el.dataset.go === 'b1' || el.dataset.go === 'm2' ? 'jjj'
      : el.dataset.nav === 'm1' ? 'me' : el.dataset.go === 'inbox' ? 'inbox' : 'other';
    document.addEventListener('click', (e) => {
      if (e.target.closest('.lv-mask') || e.target.closest('.lv-page')) return;
      const el = e.target.closest('#view [data-go], #view [data-a], #view [data-hb], #view [data-nav], #view [data-aigo], #view .lv-ban, #view button');
      if (!el) return;
      if (el.dataset.a === 'big' || el.dataset.nav === 'home') return;
      e.preventDefault(); e.stopPropagation();
      const k = keyOf(el);
      if (loggedIn()) APP().open(k); else needLogin(k === 'other' ? 'jjj' : k);
    }, true);
    // 首頁：標「實用版」；會員欄未登入換成註冊誘因橫幅，登入後換成揪居家入口
    (window.JJJHOOKS || (window.JJJHOOKS = [])).push((v, view) => {
      if (v !== 'home') return;
      const hd = view.querySelector('img[src="home/header.png"]');
      if (hd && !view.querySelector('.lv-tag')) hd.insertAdjacentHTML('afterend', '<span class="lv-tag">實用版</span>');
      const mem = view.querySelector('.hmem img');
      if (!mem) return;
      if (loggedIn()) {
        const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        mem.outerHTML = `<button type="button" class="lv-ban in" aria-label="進入揪居家"><span class="s">揪居家｜${esc(APP().name() || '已登入')}</span><span class="b">${esc(APP().summary())} ›</span></button>`;
        return;
      }
      mem.outerHTML = '<button type="button" class="lv-ban" aria-label="註冊就送免費居家評估，邀家人一起加入再送一份小禮"><span class="s">邀家人一起加入，再送一份小禮</span><span class="b">註冊就送免費居家評估</span>'
        + '<span class="lv-hx" style="left:calc(100% - 109px);top:16px;width:13px;height:14px;background:#E6E6E6"></span>'
        + '<span class="lv-hx" style="left:calc(100% - 75px);top:3px;width:21px;height:23px;background:#EBA6B8"></span>'
        + '<span class="lv-hx" style="left:calc(100% - 91px);top:34px;width:39px;height:44px;background:#F6B8C8;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px">♥</span>'
        + '<span class="lv-hx" style="left:calc(100% - 57px);top:10px;width:49px;height:57px;background:#C8003A"><span style="position:absolute;left:18px;top:14px;width:13px;height:13px;border-radius:50%;background:#FBE3EA"></span><span style="position:absolute;left:13px;top:30px;width:23px;height:12px;border-radius:12px 12px 4px 4px;background:#FBE3EA"></span></span></button>';
    });
  }

  if (PAGE === 'adm') {
    // 後台是工作用：打開先登入（員工編號＋密碼，帳號由總部建立；D2）
    document.addEventListener('DOMContentLoaded', () => {
      const lg = document.querySelector('#gate .glogo');
      if (lg && !lg.querySelector('.lv-adm')) lg.insertAdjacentHTML('beforeend', '<span class="lv-adm" style="margin-left:8px;font-size:13px;color:#D4003C">實用版</span>');
      document.querySelectorAll('#gate a[href="app.html"]').forEach((a) => { a.href = '../live/app/'; });
    });
    document.addEventListener('submit', (e) => {
      if (e.target.id !== 'gForm') return;
      e.preventDefault(); e.stopImmediatePropagation();
      const f = e.target, er = f.querySelector('.gerr');
      if (!window.JJJLIVEADM) { if (er) er.textContent = '載入中，請稍後再試'; return; }
      // 員工編號登入：E123456 → e123456@staff.jiujujia.example（帳號由總部建立；也接受完整 Email）
      const id = f.email.value.trim();
      if (!id) { if (er) er.textContent = '請輸入員工編號'; return; }
      window.JJJLIVEADM.login(id.includes('@') ? id : id.toLowerCase() + '@staff.jiujujia.example', f.password.value, er);
    }, true);
  }

  window.JJJLIVE = { needLogin, toast };
})();
