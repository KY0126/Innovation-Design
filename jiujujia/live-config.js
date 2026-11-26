// 實用版設定（只在 ?mode=live 載入）
// supabaseKey 是 Supabase「publishable key」：設計上就是放在網頁裡的公開值，資料由列級權限保護；
// 真正的密鑰（service role、LINE Channel secret）只存在 Supabase secrets，不放這裡（C7）。
(function () {
  const base = 'https://ky0126.github.io/Innovation-Design/live/';
  window.JJJ_LIVE_CFG = Object.assign({
    supabaseUrl: 'https://mmownoqzrhvgguxpukgl.supabase.co',
    supabaseKey: 'sb_publishable_k-ePRVf5164vA9hp76YlLA_HgHclwY_',
    lineLoginChannelId: '',            // 第 6 步建好 LINE Login 設定後填入（Channel ID 是公開值）
    callback: base + 'app/',           // LINE Login 設定的 Callback URL 要填這個
    base,
    stores: ['Digital City 高雄民族店'],
    wishStages: [20, 50, 100],         // 揪心願三段門檻（領域鐵律 R8）
  }, window.JJJ_LIVE_CFG_OVERRIDE || {});
})();
