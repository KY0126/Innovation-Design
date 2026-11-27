// 總部建立、停用、重設員工帳號（生活顧問、技師、總部）；只有總部可以呼叫
// 員工帳號：員工編號 E123456 → e123456@staff.jiujujia.example；臨時密碼只回傳這一次，請當面交給同仁
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const STORES = ["Digital City 高雄民族店", "Digital City 高雄澄清店", "Digital City 高雄三民中華店"];
const tempPw = () => { const a = new Uint8Array(9); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replace(/[+/=]/g, "").slice(0, 10); };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return J({ error: "method" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!, svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, svc, { auth: { persistSession: false } });
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return J({ error: "請先登入" }, 401);
  const db = admin.schema("jjj");
  const { data: me } = await db.from("profiles").select("role, disabled, display_name").eq("id", user.id).maybeSingle();
  if (!me || me.role !== "hq" || me.disabled) return J({ error: "只有總部可以管理帳號" }, 403);
  const b = await req.json().catch(() => ({}));
  const audit = (action: string, target: string, detail?: string) => db.from("audit").insert({ user_id: user.id, action, target, detail: detail || null });

  if (b.action === "create") {
    const raw = String(b.email || b.staff_no || "").trim().toLowerCase();
    const email = raw.includes("@") ? raw : raw ? raw + "@staff.jiujujia.example" : "";
    const name = String(b.name || "").trim().slice(0, 30), role = String(b.role || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return J({ error: "員工編號或 Email 格式不正確" }, 400);
    if (!name) return J({ error: "請填寫姓名" }, 400);
    if (!["advisor", "tech", "hq"].includes(role)) return J({ error: "角色不正確" }, 400);
    const store = role === "hq" ? null : STORES.find((s) => s === b.store || s.replace("Digital City ", "") === b.store) || null;
    if (role !== "hq" && !store) return J({ error: "請選擇門市" }, 400);
    const pw = tempPw();
    const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { name } });
    if (error) return J({ error: /already/i.test(error.message) ? "這個員工編號已有帳號" : "建立失敗，請稍後再試" }, /already/i.test(error.message) ? 409 : 500);
    const { error: e2 } = await db.from("profiles").upsert({ id: data.user.id, display_name: name, role, store, disabled: false });
    if (e2) { await admin.auth.admin.deleteUser(data.user.id); return J({ error: "建立失敗，請稍後再試" }, 500); }
    await audit("建立員工帳號", email, role);
    return J({ id: data.user.id, email, temp_password: pw });
  }
  if (b.action === "update") {
    const id = String(b.id || "");
    const { data: t } = await db.from("profiles").select("id, role").eq("id", id).maybeSingle();
    if (!t || !["advisor", "tech", "hq"].includes(t.role)) return J({ error: "找不到資料" }, 404);
    if (id === user.id && b.disabled) return J({ error: "不能停用自己的帳號" }, 400);
    const { data: au } = await admin.auth.admin.getUserById(id);
    let temp: string | null = null;
    if ("disabled" in b) {
      await db.from("profiles").update({ disabled: !!b.disabled }).eq("id", id);
      await admin.auth.admin.updateUserById(id, { ban_duration: b.disabled ? "876000h" : "none" });
      await audit(b.disabled ? "停用帳號" : "啟用帳號", au?.user?.email || id);
    }
    if (b.reset_password) {
      temp = tempPw();
      await admin.auth.admin.updateUserById(id, { password: temp });
      await audit("重設密碼", au?.user?.email || id);
    }
    return J({ ok: true, temp_password: temp });
  }
  if (b.action === "list") {
    const { data: P } = await db.from("profiles").select("id, display_name, role, store, disabled, created_at, last_login").in("role", ["hq", "advisor", "tech"]);
    const out = [];
    for (const p of P || []) { const { data: au } = await admin.auth.admin.getUserById(p.id); out.push({ id: p.id, email: au?.user?.email || "", name: p.display_name, role: p.role, store: p.store, disabled: p.disabled ? 1 : 0, created_at: p.created_at, last_login: p.last_login }); }
    const ord: Record<string, number> = { hq: 0, advisor: 1, tech: 2 };
    out.sort((a, b2) => ord[a.role] - ord[b2.role] || String(a.created_at).localeCompare(String(b2.created_at)));
    return J({ users: out });
  }
  return J({ error: "action" }, 400);
});
