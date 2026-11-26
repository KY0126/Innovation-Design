// 揪居家實用版：LINE 登入換 Supabase 登入憑證
// 流程：網頁拿到 LINE 給的一次性 code，交給這裡；這裡向 LINE 換身分並驗證，
// 在 Supabase 建立或找到帳號（jjj.profiles），再回傳一次性 token_hash，網頁用 verifyOtp 換成登入狀態。
// 金鑰只從 Supabase secrets 讀（LINE_LOGIN_CHANNEL_ID、LINE_LOGIN_CHANNEL_SECRET），不出現在程式或網頁（C7）。
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINS = ["https://ky0126.github.io", "http://127.0.0.1:8766", "http://localhost:8766"];
const cors = (req: Request) => {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};
const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

// 允許的回呼網址：只接受實用版入口，避免被拿去換別的網站的 code
const CALLBACKS = [
  "https://ky0126.github.io/Innovation-Design/live/app/",
  "http://127.0.0.1:8766/live/app/",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "只接受 POST" });
  const CID = Deno.env.get("LINE_LOGIN_CHANNEL_ID");
  const SEC = Deno.env.get("LINE_LOGIN_CHANNEL_SECRET");
  if (!CID || !SEC) return json(req, 503, { error: "LINE 登入設定尚未完成" });

  let body: { code?: string; redirect_uri?: string };
  try { body = await req.json(); } catch { return json(req, 400, { error: "格式錯誤" }); }
  const { code, redirect_uri } = body;
  if (!code || !redirect_uri || !CALLBACKS.includes(redirect_uri)) return json(req, 400, { error: "缺少登入資料" });

  // 1. code 換 token
  const tok = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri, client_id: CID, client_secret: SEC }),
  });
  if (!tok.ok) return json(req, 401, { error: "LINE 登入失敗，請再試一次" });
  const t = await tok.json();

  // 2. 驗證 id_token（確認是發給這個 channel 的）
  const ver = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: t.id_token, client_id: CID }),
  });
  if (!ver.ok) return json(req, 401, { error: "LINE 身分驗證失敗" });
  const v = await ver.json(); // { sub, name, picture, ... }
  const sub: string = v.sub;
  if (!sub) return json(req, 401, { error: "LINE 身分驗證失敗" });

  // 3. 是否已加五子登科好友（登入設定要綁定官方帳號才查得到）
  let isFriend = false;
  try {
    const fr = await fetch("https://api.line.me/friendship/v1/status", { headers: { Authorization: "Bearer " + t.access_token } });
    if (fr.ok) isFriend = !!(await fr.json()).friendFlag;
  } catch { /* 查不到就當作未加好友 */ }

  // 4. 建立或找到帳號
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false }, db: { schema: "jjj" },
  });
  const email = `line_${sub.toLowerCase()}@line.jiujujia.example`;
  const name = String(v.name || "").slice(0, 40);
  const { data: prof } = await admin.from("profiles").select("id, display_name").eq("line_user_id", sub).maybeSingle();
  if (!prof) {
    const { data: cu, error: ce } = await admin.auth.admin.createUser({
      email, email_confirm: true, user_metadata: { app: "jiujujia", via: "line" },
    });
    if (ce || !cu.user) return json(req, 500, { error: "建立帳號失敗" });
    const { error: pe } = await admin.from("profiles").insert({
      id: cu.user.id, display_name: name, role: "family", line_user_id: sub, is_friend: isFriend,
    });
    if (pe) return json(req, 500, { error: "建立帳號失敗" });
  } else {
    await admin.from("profiles").update({ is_friend: isFriend, ...(prof.display_name ? {} : { display_name: name }) }).eq("id", prof.id);
  }

  // 5. 發一次性登入憑證（不寄信）
  const { data: link, error: le } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (le || !link?.properties?.hashed_token) return json(req, 500, { error: "登入憑證產生失敗" });
  return json(req, 200, { token_hash: link.properties.hashed_token, is_friend: isFriend, first: !prof });
});
