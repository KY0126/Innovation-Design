// 實用版員工登入（/live/admin/、生活顧問電腦版）：員工編號＋密碼，帳號由總部建立（D2）
// 登入後：總部留在後台（admin.html，資料由 live-staff.js 接 Supabase）、生活顧問轉門市電腦版、技師轉揪居家 App
// 第 4 批起，原本的簡化後台（家庭清單＋送出正式報價）由 Demo 同一套後台取代；舊版留在 git 紀錄
(function () {
  if (!window.JJJ_LIVE) return;
  const C = window.JJJ_LIVE_CFG;
  // 與 App 共用登入狀態（同一個網域、同一個名稱），員工登入一次，後台、電腦版、App 都認得
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    db: { schema: 'jjj' },
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'jjj-live-auth' },
  });
  window.JJJLIVESB = sb;
  const ADM = /admin\.html/.test(location.pathname);
  let ME = null;

  async function loadMe() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data } = await sb.from('profiles').select('id, display_name, role, store, disabled').eq('id', session.user.id).maybeSingle();
    ME = data && ['advisor', 'tech', 'hq'].includes(data.role) && !data.disabled ? data : null;
    return ME;
  }
  // 生活顧問：門市電腦版（consultant.html）；技師：揪居家 App（手機）
  function route() {
    if (!ADM || !ME) return false;
    if (ME.role === 'advisor') { location.href = 'consultant.html?mode=live'; return true; }
    if (ME.role === 'tech') { location.href = '../live/app/'; return true; }
    return false;
  }
  async function login(email, pw, er) {
    if (er) er.textContent = '';
    const { error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) { if (er) er.textContent = '員工編號或密碼不正確'; return; }
    if (!(await loadMe())) { await sb.auth.signOut(); if (er) er.textContent = '這個帳號不是員工帳號；家庭請用揪居家 App（手機）。'; return; }
    try { await sb.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', ME.id); } catch (e) {}
    if (route()) return;
    location.reload(); // 總部：重新整理後由 admin.html 進後台
  }

  window.JJJLIVEADM = { login };
  // 已登入過：生活顧問、技師直接轉到自己的畫面（總部由 admin.html 自己進後台）
  (async () => { if (ADM && (await loadMe())) route(); })();
})();
