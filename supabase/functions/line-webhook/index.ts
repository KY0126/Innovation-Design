// 揪居家｜五子登科官方帳號的自動回覆（Messaging API webhook）
// 圖文選單（拼圖）12 個按鈕、自己打字提問、加好友，都由這裡回答；回不出來的問題記下來，並幫已綁定的家庭轉給生活顧問。
// 已用 LINE 登入實用版的家庭，會依自己長輩家的真實資料回覆（評估、預約、安裝、關懷、通知）。
// 金鑰只從 Supabase secrets 讀：LINE_OA_CHANNEL_ID、LINE_OA_CHANNEL_SECRET（驗簽、換短效存取權杖）。
// LINE 訊息一律寫「揪居家／五子登科」，不寫全國電子；不放地址、平面圖、作息細節（R15）。
import { createClient } from "npm:@supabase/supabase-js@2";
import { FAQ, match } from "./faq.ts";

const BASE = "https://ky0126.github.io/Innovation-Design/live/app/";
const RED = "#C8003A";
const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false }, db: { schema: "jjj" } });

// ── LINE ──
async function verify(body: string, sig: string | null) {
  const sec = Deno.env.get("LINE_OA_CHANNEL_SECRET"); if (!sec || !sig) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(sec), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body)));
  return btoa(String.fromCharCode(...mac)) === sig;
}
let tokCache: { t: string; exp: number } | null = null;
async function token(): Promise<string | null> {
  if (tokCache && tokCache.exp > Date.now()) return tokCache.t;
  const id = Deno.env.get("LINE_OA_CHANNEL_ID"), sec = Deno.env.get("LINE_OA_CHANNEL_SECRET");
  if (!id || !sec) return null;
  const r = await fetch("https://api.line.me/v2/oauth/accessToken", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: sec }) });
  if (!r.ok) return null;
  const j = await r.json(); tokCache = { t: j.access_token, exp: Date.now() + (Math.min(j.expires_in || 3600, 86400) - 300) * 1000 };
  return tokCache.t;
}
async function reply(rt: string, messages: unknown[]) {
  const t = await token(); if (!t) return false;
  const r = await fetch("https://api.line.me/v2/bot/message/reply", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ replyToken: rt, messages: messages.slice(0, 5) }) });
  if (!r.ok) console.error("reply", r.status, await r.text());
  return r.ok;
}

// ── 訊息格式 ──
const QR = (labels: string[]) => ({ items: labels.slice(0, 13).map((l) => ({ type: "action", action: { type: "message", label: l.slice(0, 20), text: l } })) });
const MAIN_QR = ["居家診斷", "費用", "會不會裝鏡頭", "安裝進度", "長輩關懷", "找真人"];
const text = (t: string, qr = MAIN_QR) => ({ type: "text", text: t, quickReply: QR(qr) });
type Btn = { label: string; uri?: string; text?: string; primary?: boolean };
function card(alt: string, title: string, body: string | string[], btns: Btn[], qr = MAIN_QR) {
  const lines = Array.isArray(body) ? body : [body];
  return {
    type: "flex", altText: alt.slice(0, 300), quickReply: QR(qr),
    contents: {
      type: "bubble",
      body: { type: "box", layout: "vertical", spacing: "sm", contents: [
        { type: "text", text: title, weight: "bold", size: "md", wrap: true, color: "#222222" },
        ...lines.map((x) => ({ type: "text", text: x, size: "sm", wrap: true, color: "#555555" })),
      ] },
      footer: { type: "box", layout: "vertical", spacing: "sm", contents: [
        ...btns.map((b) => ({ type: "button", style: b.primary === false ? "secondary" : "primary", ...(b.primary === false ? {} : { color: RED }), height: "sm",
          action: b.uri ? { type: "uri", label: b.label, uri: b.uri } : { type: "message", label: b.label, text: b.text || b.label } })),
        { type: "text", text: "揪居家｜五子登科", size: "xxs", color: "#8C959F" },
      ] },
    },
  };
}
const app = (hash = "") => BASE + (hash ? "#" + hash : "");

// ── 使用者（LINE 登入過實用版的家庭） ──
type Who = { uid: string; name: string; hid: number | null; h: any; role: string } | null;
async function who(sb: ReturnType<typeof db>, lineId: string): Promise<Who> {
  const { data: p } = await sb.from("profiles").select("id, display_name, role").eq("line_user_id", lineId).maybeSingle();
  if (!p) return null;
  const { data: m } = await sb.from("members").select("household_id").eq("user_id", p.id).order("household_id").limit(1);
  let h = null; if (m && m.length) ({ data: h } = await sb.from("households").select("id, elder_name, store, phase").eq("id", m[0].household_id).maybeSingle());
  return { uid: p.id, name: p.display_name || "", hid: h ? h.id : null, h, role: p.role || "family" };
}
const PHASE = ["還沒開始評估", "已預約門市諮詢", "生活顧問在準備方案", "方案已確認，等待安裝", "已安裝，關懷中"];
const tw = (iso: string | null) => { if (!iso) return ""; const d = new Date(new Date(iso).getTime() + 8 * 3600e3); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
const slotLabel = (s: string | null) => { if (!s) return "待排定"; const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(s); if (!m) return s; const wd = "日一二三四五六"[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()]; return `${+m[2]}/${+m[3]}（${wd}）${m[4]}`; };
const NEED_LOGIN = (what: string) => card(`${what}要先綁定`, `查${what}要先綁定揪居家`, ["用 LINE 登入揪居家實用版一次，之後在這裡問就會回覆您長輩家的狀態。", "登入免費，不用另外註冊。"], [{ label: "用 LINE 綁定揪居家", uri: app("jjj") }]);
const NEED_HH = card("先建立長輩家", "還沒有長輩家", ["登入後先建立長輩家，或用家人給的邀請碼加入。"], [{ label: "建立或加入長輩家", uri: app("jjj") }]);

// ── 圖文選單 12 格 ──
const STORES = [
  ["Digital City 高雄民族店", "有揪居家情境角，可以實際走一次夜燈動線", "10:30、14:00、16:30、19:00"],
  ["Digital City 高雄澄清店", "每月社區健檢日，可順便諮詢長輩居家安全", "11:00、15:00、19:30"],
  ["Digital City 高雄三民中華店", "校園大使合作門市，學生可陪長輩一起來", "10:00、14:30、18:30"],
];
async function tile(sb: ReturnType<typeof db>, k: string, u: Who): Promise<unknown[] | null> {
  switch (k) {
    case "居家診斷": {
      if (u && u.hid) {
        const { data: a } = await sb.from("assessments").select("lights, created_at").eq("household_id", u.hid).order("id", { ascending: false }).limit(1);
        if (a && a.length && a[0].lights) {
          const L = a[0].lights as [string, string, string][], red = L.filter((x) => x[1] === "r"), yel = L.filter((x) => x[1] === "y");
          return [card("居家診斷結果", `${u.h.elder_name}家｜最近一次評估 ${tw(a[0].created_at)}`, [`紅燈 ${red.length} 處、黃燈 ${yel.length} 處`, ...[...red, ...yel].slice(0, 4).map((x) => `・${x[0]}：${x[2]}`)], [{ label: "看完整結果與改善方式", uri: app("jjj") }, { label: "預約門市免費諮詢", text: "預約門市", primary: false }])];
        }
      }
      return [card("免費居家診斷", "免費居家診斷｜約 10 分鐘", ["用手機 AR 量走道寬、浴室門檻、床到浴室的距離，再回答 5 題生活習慣，就會看到每個空間的紅黃綠燈。", "iPhone 可拍一張旁邊放了尺的照片換算；只存數字，不存影像。"], [{ label: "開始居家診斷", uri: app("jjj") }])];
    }
    case "長輩關懷": {
      if (!u) return [card("長輩關懷", "夜間關懷怎麼運作", ["走道、浴室停留太久時，先用燈光和語音問長輩本人，長輩按「我很好」就結束。", "沒有回應才依序通知主要聯絡人、第二聯絡人；由家人判斷是否撥打 119。"], [{ label: "用 LINE 綁定揪居家", uri: app("care") }])];
      if (!u.hid) return [NEED_HH];
      const { data: ev } = await sb.from("care_events").select("title, outcome, occurred_at").eq("household_id", u.hid).order("occurred_at", { ascending: false }).limit(3);
      const L = ev || [];
      return [card("長輩關懷", `${u.h.elder_name}家｜長輩關懷`, L.length ? L.map((e: any) => `・${tw(e.occurred_at)} ${e.title || "事件"}｜${e.outcome || "處理中"}`) : ["最近沒有異常事件，一切平安。"], [{ label: "看關懷紀錄", uri: app("care") }])];
    }
    case "安裝進度": {
      if (!u) return [NEED_LOGIN("安裝進度")];
      if (!u.hid) return [NEED_HH];
      const [{ data: bk }, { data: pl }] = await Promise.all([
        sb.from("bookings").select("kind, status, slot_start, store").eq("household_id", u.hid).neq("status", "已取消").order("id", { ascending: false }).limit(5),
        sb.from("plans").select("status, monthly, one_time").eq("household_id", u.hid).in("status", ["待確認", "已確認"]).order("id", { ascending: false }).limit(1),
      ]);
      const ph = u.h.phase || 0, lines = [`目前階段：${PHASE[Math.min(ph, 4)]}`];
      const c = (bk || []).find((b: any) => b.kind === "門市諮詢"), ins = (bk || []).find((b: any) => b.kind === "到府安裝");
      if (c) lines.push(`門市諮詢：${slotLabel(c.slot_start)}｜${String(c.store || "").replace("Digital City ", "")}｜${c.status}`);
      if (pl && pl.length) lines.push(`方案：${pl[0].status}｜月費 ${pl[0].monthly} 元、一次 ${pl[0].one_time} 元`);
      if (ins) lines.push(`到府安裝：${ins.status}${ins.slot_start ? "｜" + slotLabel(ins.slot_start) : ""}`);
      if (!c && !ins && !(pl && pl.length)) lines.push("還沒有預約或方案，可以先做居家診斷。");
      return [card("安裝進度", `${u.h.elder_name}家｜安裝進度`, lines, [{ label: "看完整進度", uri: app("jjj") }])];
    }
    case "揪心願": return [card("揪心願", "揪心願｜一起拼出想要的照顧小物", ["把「希望長輩家有什麼」拼成作品，30 天內 20 戶、90 天內 50 戶、累積 100 戶共鳴就進入每季審查，通過後開放預購。", "訂閱該場域方案的家庭可以按「我也需要」，其他人可以先追蹤。"], [{ label: "去拼一個作品", uri: app("wish") }, { label: "作品達 100 戶之後呢？", text: "作品達到 100 戶之後呢？", primary: false }])];
    case "預約門市": {
      if (u && u.hid) {
        const { data: c } = await sb.from("bookings").select("slot_start, store, status").eq("household_id", u.hid).eq("kind", "門市諮詢").in("status", ["待指派", "已指派"]).order("id", { ascending: false }).limit(1);
        if (c && c.length) return [card("已預約門市諮詢", "您已預約門市諮詢", [`${slotLabel(c[0].slot_start)}｜${c[0].store}`, `狀態：${c[0].status}（生活顧問會在前一天用 LINE 跟您確認）`], [{ label: "改時間或取消", uri: app("jjj") }])];
      }
      return [card("預約門市免費諮詢", "預約門市免費諮詢", ["做完居家診斷後就能預約，生活顧問會帶著結果跟您討論改善方式。", ...STORES.map((s) => `・${s[0].replace("Digital City ", "")}：${s[2]}`)], [{ label: "做診斷並預約", uri: app("jjj") }, { label: "門市資訊", text: "查詢門市", primary: false }])];
    }
    case "揪問 AI": return [text("嗨，我是揪居家小幫手。可以直接打字問我，例如：\n・揪夜安月費多少？\n・會不會裝鏡頭？\n・長輩不同意可以裝嗎？\n・安裝要多久？\n・家電壞了怎麼報修？\n回答不了的，我會幫您轉給生活顧問。", ["揪夜安月費多少？", "會不會裝鏡頭？", "長輩不同意可以安裝嗎？", "安裝要多久？", "家電壞了怎麼報修？", "找真人"])];
    case "門市型錄": return [card("方案型錄", "揪居家方案型錄", ["揪夜安｜基本方案 每月 299 元：臥室到浴室的感應夜燈與夜間關懷", "揪夜安｜安心方案 每月 449 元：加第二聯絡人與夜間語音確認", "加購場域：揪食光 +200、揪團聚 +150、揪清爽 +100", "揪全家｜全屋套餐 每月 699 元，首年設定費減免", "月付不綁約；正式金額以生活顧問送出的正式報價為準。"], [{ label: "先做免費居家診斷", uri: app("jjj") }, { label: "設定費怎麼算？", text: "設定費怎麼算？", primary: false }])];
    case "查詢門市": return [card("試辦門市", "揪居家試辦門市（高雄）", STORES.map((s) => `・${s[0]}：${s[1]}；可預約 ${s[2]}`), [{ label: "預約門市免費諮詢", uri: app("jjj") }])];
    case "線上購物": return [card("線上購物", "線上購物", ["在揪居家的「線上購物」可以買夜燈、止滑墊、扶手等照顧小物，大型家電由技師到府安裝。", "訂單和保固都在會員中心查得到。"], [{ label: "去逛逛", uri: app() }])];
    case "折價券": return [text("試辦期間沒有發折價券，改成這些優惠：\n・居家診斷與門市諮詢免費\n・選揪全家首年設定費減免\n・邀家人一起加入，長輩家多一位聯絡人\n有新的活動會在這裡通知您。", ["揪夜安月費多少？", "設定費怎麼算？", "居家診斷", "找真人"])];
    case "App 下載": return [card("不用下載", "揪居家不用下載 App", ["用手機瀏覽器打開就能用，用 LINE 登入即可。", "想放在桌面：iPhone 用 Safari 的「分享 › 加入主畫面」；Android 用 Chrome 的「⋮ › 加到主畫面」。"], [{ label: "打開揪居家", uri: app() }])];
    case "會員綁定": {
      if (u) return [text(`您已綁定揪居家（${u.name || "會員"}）${u.hid ? "，長輩家：" + u.h.elder_name + "家" : "，還沒有長輩家"}。`, ["安裝進度", "長輩關懷", "居家診斷", "找真人"])];
      return [card("會員綁定", "用 LINE 綁定揪居家", ["按下方按鈕用 LINE 登入一次就完成綁定，之後在這裡問「安裝進度」「長輩關懷」，就會回覆您長輩家的真實狀態。"], [{ label: "用 LINE 綁定", uri: app("jjj") }])];
    }
  }
  return null;
}
const TILES = ["居家診斷", "長輩關懷", "安裝進度", "揪心願", "預約門市", "揪問 AI", "門市型錄", "查詢門市", "線上購物", "折價券", "App 下載", "會員綁定"];
const ALIAS: [RegExp, string][] = [
  [/^(診斷|評估|免費評估|居家評估|ar|AR|量測|開始)$/, "居家診斷"], [/^(關懷|長輩|爸媽|昨晚)$/, "長輩關懷"], [/^(進度|安裝|施工進度|我的進度|查進度)$/, "安裝進度"],
  [/^(心願|拼圖|作品)$/, "揪心願"], [/^(預約|諮詢|約時間)$/, "預約門市"], [/^(AI|ai|問問題|小幫手|揪問)$/, "揪問 AI"], [/^(型錄|方案|方案介紹)$/, "門市型錄"],
  [/^(門市|門市地址|地點|分店)$/, "查詢門市"], [/^(購物|買東西|商城)$/, "線上購物"], [/^(優惠|優惠券|折扣)$/, "折價券"], [/^(下載|app|APP)$/, "App 下載"], [/^(綁定|登入|會員)$/, "會員綁定"],
  // 已綁定的家庭最常問「我家現在怎樣」：直接回真實資料
  [/(什麼時候來|何時來|哪天來|到哪了|進度如何|進度到哪|裝好了沒|排到了嗎|報價單在哪|方案確認了嗎)/, "安裝進度"],
  [/(改預約|取消預約|預約.*(改|取消|換時間)|我預約的)/, "預約門市"],
  [/(昨晚|昨天晚上|今天早上).*(還好|怎樣|有沒有事|平安)|爸媽還好嗎|媽還好嗎|爸還好嗎|有沒有異常/, "長輩關懷"],
  [/(我家|爸媽家|我媽家|我爸家).*(診斷|評估|紅燈|結果)|診斷結果|評估結果/, "居家診斷"],
];

// ── 自由提問：常見問題比對（同義詞加權）＋小對話 ──
function smalltalk(t: string): unknown[] | null {
  if (/^(嗨|hi|hello|哈囉|你好|您好|安安|早安|午安|晚安)[!！~～。]*$/i.test(t)) return [text("您好，我是揪居家小幫手。想了解什麼呢？可以點下面的按鈕，或直接打字問我。")];
  if (/^(謝謝|感謝|謝啦|thanks|thank you|3q|好的|好|ok|OK|了解|知道了)[!！~～。]*$/i.test(t)) return [text("不客氣，有問題隨時問我 😊")];
  if (/^(我很好|長輩很好|平安)$/.test(t)) return [text("收到，家人會很放心。昨晚的確認請按通知裡的「我很好」按鈕，才會記錄到揪居家。", ["長輩關懷", "找真人"])];
  if (/(笨|爛|沒用|聽不懂|答非所問|白痴)/.test(t)) return [text("抱歉沒幫上忙 🙏 換個說法再問一次，或輸入「找真人」，我轉給生活顧問。", ["找真人", "揪問 AI", "居家診斷"])];
  if (/(天氣|股票|新聞|彩券|樂透|笑話|唱歌)/.test(t)) return [text("這題我幫不上忙，我只會回答揪居家、長輩居家安全和家電服務的問題喔。", ["揪居家是什麼？", "揪夜安月費多少？", "會不會裝鏡頭？", "找真人"])];
  return null;
}
async function handoff(sb: ReturnType<typeof db>, u: Who, q: string) {
  if (!u || !u.hid) return [card("找真人", "轉給生活顧問", ["這題我還答不好。用 LINE 綁定揪居家後，我可以直接幫您轉給綁定門市的生活顧問，1 個工作天內回覆。", "也可以到試辦門市找生活顧問。"], [{ label: "用 LINE 綁定揪居家", uri: app("jjj") }, { label: "查詢門市", text: "查詢門市", primary: false }])];
  const { data: dup } = await sb.from("requests").select("id").eq("household_id", u.hid).eq("kind", "聯絡生活顧問").eq("status", "待處理").limit(1);
  if (!dup || !dup.length) await sb.from("requests").insert({ household_id: u.hid, user_id: u.uid, kind: "聯絡生活顧問", note: ("LINE 提問：" + q).slice(0, 200) });
  return [text(`已幫您轉給${String(u.h.store || "綁定門市").replace("Digital City ", "")}的生活顧問，1 個工作天內會用 LINE 或電話跟您聯絡。${dup && dup.length ? "（您之前的需求還在處理中，已一併轉達）" : ""}`, ["安裝進度", "長輩關懷", "居家診斷"])];
}

async function answer(sb: ReturnType<typeof db>, lineId: string, raw: string): Promise<{ msgs: unknown[]; intent: string; ok: boolean }> {
  const t = raw.trim().replace(/\s+/g, " ").slice(0, 300);
  const u = await who(sb, lineId).catch(() => null);
  let k = TILES.find((x) => x === t) || (ALIAS.find(([re]) => re.test(t)) || [])[1];
  if (/^(找真人|真人|客服|轉真人|聯絡顧問|找生活顧問|生活顧問)$/.test(t)) return { msgs: await handoff(sb, u, "（請生活顧問聯絡我）"), intent: "handoff", ok: true };
  if (k) { const m = await tile(sb, k, u); if (m) return { msgs: m, intent: "tile:" + k, ok: true }; }
  const st = smalltalk(t); if (st) return { msgs: st, intent: "smalltalk", ok: true };
  const m = match(t === "費用" ? "月費多少" : t);
  if (m.f) {
    const f = m.f, btns: Btn[] = f.link ? [{ label: f.linkLabel || "去看看", uri: f.link.startsWith("#") ? app(f.link.slice(1)) : f.link }] : [];
    const more = FAQ.filter((x) => x.cat === f.cat && x !== f).slice(0, 3).map((x) => x.q);
    return { msgs: [btns.length ? card(f.q, f.q, f.a, btns, [...more, "找真人"]) : text(`${f.q}\n${f.a}`, [...more, "找真人"])], intent: "faq:" + f.q, ok: true };
  }
  if (m.near.length) return { msgs: [text("這題我不太確定，您是不是想問：\n" + m.near.map((x) => "・" + x).join("\n") + "\n點下面的問題看答案；都不是的話，輸入「找真人」我幫您轉給生活顧問。", [...m.near, "找真人"])], intent: "near", ok: false };
  return { msgs: [text("這題我還不太確定怎麼回答 🙏\n可以換個說法，或點下面的常見問題；要的話我幫您轉給生活顧問。", ["揪夜安月費多少？", "會不會裝鏡頭？", "安裝要多久？", "家電壞了怎麼報修？", "找真人"])], intent: "unknown", ok: false };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const raw = await req.text();
  if (!(await verify(raw, req.headers.get("x-line-signature")))) return new Response("bad signature", { status: 401 });
  const body = JSON.parse(raw || "{}"), sb = db();
  for (const ev of body.events || []) {
    try {
      const lineId = ev.source && ev.source.userId; if (!lineId) continue;
      if (ev.type === "follow") {
        await sb.from("profiles").update({ is_friend: true }).eq("line_user_id", lineId);
        await reply(ev.replyToken, [card("歡迎加入揪居家", "歡迎加入揪居家｜五子登科", ["幫爸媽家做一次免費居家診斷，夜裡走到浴室更安心。", "點下方選單，或直接打字問我；用 LINE 綁定後，可以在這裡查長輩家的安裝進度與關懷狀態。"], [{ label: "開始免費居家診斷", uri: app("jjj") }, { label: "用 LINE 綁定揪居家", uri: app("jjj"), primary: false }])]);
        continue;
      }
      if (ev.type === "unfollow") { await sb.from("profiles").update({ is_friend: false }).eq("line_user_id", lineId); continue; }
      let q = "";
      if (ev.type === "message" && ev.message.type === "text") q = ev.message.text;
      else if (ev.type === "postback") q = String(ev.postback.data || "").replace(/^q=/, "");
      else if (ev.type === "message") { await reply(ev.replyToken, [text("目前只看得懂文字訊息喔，可以打字問我，或點下方的按鈕。")]); continue; }
      if (!q || /^tab=/.test(q)) continue;
      const r = await answer(sb, lineId, q);
      await reply(ev.replyToken, r.msgs);
      await sb.from("bot_logs").insert({ line_user_id: lineId, text: q.slice(0, 300), intent: r.intent, answered: r.ok });
    } catch (e) { console.error("line-webhook", e); }
  }
  return new Response("ok");
});

