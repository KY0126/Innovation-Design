// 揪居家實用版：官方帳號推播（P1 正式報價、P3 先問長輩、P4 長輩沒回覆才通知子女）與「我很好」回覆
// 推播用現有五子登科官方帳號（Messaging API）；金鑰只從 Supabase secrets 讀：LINE_OA_CHANNEL_ID、LINE_OA_CHANNEL_SECRET。
// 金鑰還沒設定時，照樣寫進 App 的通知（jjj.notifications），只是不送 LINE（pushed=false）。
// LINE 訊息一律寫「揪居家／五子登科」，不寫全國電子（C8）；不放地址、平面圖、作息（R15）。
import { createClient } from "npm:@supabase/supabase-js@2";

const BASE = "https://ky0126.github.io/Innovation-Design/live/";
const ORIGINS = ["https://ky0126.github.io", "http://127.0.0.1:8766", "http://localhost:8766"];
const RED = "#C8003A";
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

const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false }, db: { schema: "jjj" },
});

// ── LINE ──
async function oaToken(): Promise<string | null> {
  const id = Deno.env.get("LINE_OA_CHANNEL_ID"), sec = Deno.env.get("LINE_OA_CHANNEL_SECRET");
  if (!id || !sec) return null;
  const r = await fetch("https://api.line.me/oauth2/v3/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: sec }),
  });
  return r.ok ? (await r.json()).access_token : null;
}
type Btn = { label: string; uri: string; primary?: boolean };
function card(alt: string, title: string, text: string, btns: Btn[]) {
  return {
    type: "flex", altText: alt,
    contents: {
      type: "bubble",
      body: { type: "box", layout: "vertical", spacing: "sm", contents: [
        { type: "text", text: title, weight: "bold", size: "md", wrap: true, color: "#222222" },
        { type: "text", text, size: "sm", wrap: true, color: "#555555" },
      ] },
      footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
        ...btns.map((b) => ({ type: "button", style: b.primary === false ? "secondary" : "primary", color: b.primary === false ? undefined : RED, height: "sm", action: { type: "uri", label: b.label, uri: b.uri } })),
        { type: "text", text: "揪居家｜五子登科", size: "xxs", color: "#8C959F" },
      ] },
    },
  };
}
async function push(tok: string | null, to: string | null, msg: unknown): Promise<boolean> {
  if (!tok || !to) return false;
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
    body: JSON.stringify({ to, messages: [msg] }),
  });
  return r.ok;
}

// 通知家庭成員：寫 App 通知，已加好友的再送 LINE
async function notifyMembers(db: ReturnType<typeof admin>, tok: string | null, hid: number, relations: string[], kind: string, title: string, link: string, msg: unknown) {
  const { data: mem } = await db.from("members").select("user_id, relation, notify, profiles!inner(line_user_id, is_friend)").eq("household_id", hid);
  let sent = 0, total = 0;
  for (const m of (mem || []) as any[]) {
    if (!relations.includes(m.relation) || !m.notify) continue;
    total++;
    const p = m.profiles;
    const ok = p.is_friend ? await push(tok, p.line_user_id, msg) : false;
    if (ok) sent++;
    await db.from("notifications").insert({ user_id: m.user_id, kind, title, link, pushed: ok, pushed_at: ok ? new Date().toISOString() : null });
  }
  return { sent, total };
}

// 呼叫者身分（登入使用者的 JWT）
async function caller(req: Request, db: ReturnType<typeof admin>) {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data } = await db.auth.getUser(jwt);
  if (!data?.user) return null;
  const { data: p } = await db.from("profiles").select("id, role, store").eq("id", data.user.id).maybeSingle();
  return p as { id: string; role: string; store: string | null } | null;
}
async function staffOf(db: ReturnType<typeof admin>, me: { role: string; store: string | null } | null, hid: number) {
  if (!me) return false;
  if (me.role === "hq") return true;
  if (me.role !== "advisor" || !me.store) return false;
  const { data: h } = await db.from("households").select("store").eq("id", hid).maybeSingle();
  return !!h && h.store === me.store;
}
const rand = () => { const b = new Uint8Array(18); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" } as any)[c]); };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "只接受 POST" });
  let b: any; try { b = await req.json(); } catch { return json(req, 400, { error: "格式錯誤" }); }
  const db = admin();
  const tok = await oaToken();

  // P1：生活顧問送出正式報價後，通知家庭全部成員
  if (b.action === "quote") {
    const me = await caller(req, db);
    const { data: q } = await db.from("quotes").select("id, household_id, version, is_formal").eq("id", b.quote_id).maybeSingle();
    if (!q || !q.is_formal) return json(req, 404, { error: "找不到正式報價" });
    if (!(await staffOf(db, me, q.household_id))) return json(req, 403, { error: "沒有權限" });
    const link = BASE + "app/#quote";
    const r = await notifyMembers(db, tok, q.household_id, ["child", "family", "elder"], "P1", "爸媽家的改善方案好了",
      link, card("爸媽家的改善方案好了", "爸媽家的改善方案好了", `生活顧問已送出正式報價（第 ${q.version} 版），請長輩確認後才會成交。`, [{ label: "看方案", uri: link }]));
    return json(req, 200, { ok: true, ...r, line: !!tok });
  }

  // P3：記錄一次夜間關懷事件，先問長輩（長輩沒有 LINE 時改問子女，請代為確認：D6）
  if (b.action === "care") {
    const me = await caller(req, db);
    const hid = Number(b.household_id);
    if (!(await staffOf(db, me, hid))) return json(req, 403, { error: "沒有權限" });
    const t = rand();
    const now = new Date();
    const { data: ev, error } = await db.from("care_events").insert({
      household_id: hid, kind: String(b.kind || "夜間走道感應燈亮比較久"),
      reply_token: t, reply_expires: new Date(now.getTime() + 12 * 3600e3).toISOString(), asked_at: now.toISOString(),
    }).select("id").single();
    if (error) return json(req, 500, { error: "記錄失敗" });
    const okUri = BASE + "ok/?t=" + t + "&a=ok", helpUri = BASE + "ok/?t=" + t + "&a=help";
    const msg = card("昨晚還好嗎？", "昨晚還好嗎？", "走道的燈亮了比較久，按一下讓家人放心。", [{ label: "我很好", uri: okUri }, { label: "需要幫忙", uri: helpUri, primary: false }]);
    let r = await notifyMembers(db, tok, hid, ["elder"], "P3", "昨晚還好嗎？", okUri, msg);
    if (r.total === 0) {
      const msg2 = card("請幫忙確認長輩昨晚的狀況", "請幫忙確認長輩昨晚的狀況", "長輩沒有綁定 LINE，請您聯絡長輩後代為回覆。", [{ label: "長輩很好", uri: okUri }, { label: "需要幫忙", uri: helpUri, primary: false }]);
      r = await notifyMembers(db, tok, hid, ["child"], "P3", "請幫忙確認長輩昨晚的狀況", okUri, msg2);
    }
    return json(req, 200, { ok: true, event_id: ev.id, ...r, line: !!tok });
  }

  // 「我很好」回覆頁：不用登入，連結一次有效
  if (b.action === "reply") {
    const { data: ev } = await db.from("care_events").select("id, household_id, reply_expires, elder_ok").eq("reply_token", String(b.t || "")).maybeSingle();
    if (!ev || (ev.reply_expires && new Date(ev.reply_expires) < new Date())) return json(req, 410, { error: "這個連結已經用過或過期了" });
    const ok = b.a !== "help";
    await db.from("care_events").update({ elder_ok: ok, elder_replied_at: new Date().toISOString(), reply_token: null, family_notified: !ok }).eq("id", ev.id);
    if (!ok) {
      const link = BASE + "app/#care";
      await notifyMembers(db, tok, ev.household_id, ["child", "family"], "P4", "長輩回覆需要幫忙", link,
        card("長輩回覆需要幫忙", "長輩回覆需要幫忙", "剛剛在關心訊息裡按了「需要幫忙」，請盡快聯絡。", [{ label: "看關懷紀錄", uri: link }]));
    }
    return json(req, 200, { ok: true, reply: ok ? "ok" : "help" });
  }

  // P4：問過長輩 30 分鐘還沒回覆，才通知子女（排程每 10 分鐘呼叫一次；重複呼叫不會重複通知）
  if (b.action === "escalate") {
    const before = new Date(Date.now() - 30 * 60e3).toISOString();
    const { data: evs } = await db.from("care_events").select("id, household_id").is("elder_ok", null).eq("family_notified", false).lt("asked_at", before).limit(50);
    let n = 0;
    for (const ev of evs || []) {
      await db.from("care_events").update({ family_notified: true }).eq("id", ev.id);
      const link = BASE + "app/#care";
      await notifyMembers(db, tok, ev.household_id, ["child", "family"], "P4", "長輩還沒回覆「我很好」", link,
        card("長輩還沒回覆「我很好」", "長輩還沒回覆「我很好」", "已經問過長輩，30 分鐘沒有回覆，要不要打個電話？", [{ label: "看關懷紀錄", uri: link }]));
      n++;
    }
    return json(req, 200, { ok: true, escalated: n });
  }

  return json(req, 400, { error: "不認得的動作" });
});
