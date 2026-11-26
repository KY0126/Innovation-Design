-- 實用版搬遷第 1 批（家庭端）：Demo 畫面接 Supabase 需要的欄位、資料表、函式與列級權限
-- 設計：docs/design/實用版_Live版全功能搬遷設計.md；欄位名稱沿用 Demo 模擬後端，畫面不用改
-- 原則：尺寸存數字不存影像（M3）；每張表都開 RLS；有狀態轉換或防作弊的（預約名額、方案確認、點數、取消）走函式

-- ── 門市（預約名額要在伺服器端檢查） ──
create table jjj.stores (
  name text primary key,
  short text not null,
  times text[] not null,
  cap int not null default 1
);
insert into jjj.stores (name, short, times, cap) values
  ('Digital City 高雄民族店', '高雄民族店', array['10:30','14:00','16:30','19:00'], 1),
  ('Digital City 高雄澄清店', '高雄澄清店', array['11:00','15:00','19:30'], 1),
  ('Digital City 高雄三民中華店', '高雄三民中華店', array['10:00','14:30','18:30'], 1);

-- ── 既有表補 Demo 欄位 ──
alter table jjj.households
  add column phase smallint not null default 0,
  add column address text,
  add column phone text,
  add column prefs jsonb not null default '{}',
  add column contacts jsonb not null default '[]',
  add column obs jsonb,
  add column updated_at timestamptz not null default now();
grant update (prefs, obs, contacts, updated_at) on jjj.households to authenticated;

alter table jjj.assessments
  add column filled_by text check (filled_by in ('self','child')),
  add column answers jsonb,
  add column measures jsonb,
  add column lights jsonb,
  add column rec jsonb,
  add column duration_s int check (duration_s between 0 and 7200);
alter table jjj.assessments drop constraint if exists assessments_source_check;
alter table jjj.assessments add constraint assessments_source_check check (source in ('ar','manual','app'));

alter table jjj.bookings
  add column code text,
  add column kind text not null default '門市諮詢',
  add column slot_start text,
  add column slot_end text,
  add column note text,
  add column assignee_id uuid references jjj.profiles(id),
  add column progress int,
  add column steps jsonb not null default '{}',
  add column diff text,
  add column completed_at timestamptz;
alter table jjj.bookings alter column slot drop not null;
alter table jjj.bookings drop constraint if exists bookings_status_check;
alter table jjj.bookings add constraint bookings_status_check check (status in
  ('已預約','已確認','待指派','已指派','待排程','已排程','施工中','待驗收','待改善','已完成','已取消'));
-- 家庭端預約、取消一律走函式（名額檢查）
drop policy if exists bk_write on jjj.bookings;
drop policy if exists bk_update on jjj.bookings;
create policy bk_staff_update on jjj.bookings for update to authenticated
  using (jjj.is_store_staff(household_id)) with check (jjj.is_store_staff(household_id));

alter table jjj.consents
  add column kind text,
  add column items jsonb not null default '[]',
  add column agreed boolean not null default true,
  add column by_name text,
  add column revoked_at timestamptz;
alter table jjj.consents alter column quote_id drop not null;
create policy cs_revoke on jjj.consents for update to authenticated
  using (jjj.is_member(household_id)) with check (jjj.is_member(household_id));
grant update (revoked_at) on jjj.consents to authenticated;

alter table jjj.notifications
  add column household_id bigint references jjj.households(id) on delete cascade,
  add column audience text,
  add column channel text,
  add column body text,
  add column care_event_id bigint;
alter table jjj.notifications alter column user_id drop not null;
create policy nt_household on jjj.notifications for select to authenticated
  using (household_id is not null and jjj.is_member(household_id) and audience in ('owner','second','family'));
create policy nt_household_read on jjj.notifications for update to authenticated
  using (household_id is not null and jjj.is_member(household_id)) with check (household_id is not null and jjj.is_member(household_id));

alter table jjj.care_events
  add column occurred_at timestamptz not null default now(),
  add column title text,
  add column outcome text,
  add column timeline jsonb not null default '[]',
  add column source text,
  add column followed_up boolean not null default false;
grant select (occurred_at, title, outcome, timeline, source, followed_up) on jjj.care_events to authenticated;

alter table jjj.wish_works
  add column household_id bigint references jjj.households(id) on delete set null,
  add column field text,
  add column theme_id bigint,
  add column parent_id bigint references jjj.wish_works(id) on delete set null,
  add column story jsonb not null default '{}',
  add column status text not null default '共鳴中',
  add column review_note text,
  add column base int not null default 0,
  add column terms boolean not null default false,
  add column updated_at timestamptz not null default now();
update jjj.wish_works set status = case when is_public then '共鳴中' else '草稿' end;
-- 作品由函式送出（同時記點數）；直接新增只允許一般狀態、不能自帶共鳴數；草稿以外的作品公開
drop policy if exists ww_write on jjj.wish_works;
drop policy if exists ww_read_public on jjj.wish_works;
create policy ww_write on jjj.wish_works for insert to authenticated
  with check (owner = (select auth.uid()) and base = 0 and status in ('共鳴中','草稿') and review_note is null);
create policy ww_read on jjj.wish_works for select to authenticated
  using (status <> '草稿' or owner = (select auth.uid()));
create policy ww_read_anon on jjj.wish_works for select to anon using (status <> '草稿');

alter table jjj.wish_supports
  add column kind text not null default 'support' check (kind in ('support','follow')),
  add column buy text,
  add column price text;
revoke insert on jjj.wish_supports from authenticated;
drop policy if exists ws_write on jjj.wish_supports;

-- ── 新表 ──
create table jjj.requests (
  id bigint generated always as identity primary key,
  household_id bigint not null references jjj.households(id) on delete cascade,
  user_id uuid references jjj.profiles(id),
  kind text not null check (kind in ('設備檢修','夜燈調整','方案升級','改為年繳','取消方案','修改第二聯絡人','聯絡生活顧問','加選門口攝影機','設備問題','線上報修')),
  note text check (length(note) <= 200),
  status text not null default '待處理',
  handled_by uuid,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create table jjj.preorders (
  topic_id text not null,
  user_id uuid not null references jjj.profiles(id) on delete cascade default auth.uid(),
  household_id bigint references jjj.households(id) on delete set null,
  status text not null default '意向登記',
  created_at timestamptz not null default now(),
  primary key (topic_id, user_id)
);
create table jjj.wishes (
  id bigint generated always as identity primary key,
  code text not null,
  household_id bigint not null references jjj.households(id) on delete cascade,
  user_id uuid references jjj.profiles(id),
  store text,
  home text not null default 'parents' check (home in ('parents','mine')),
  category text not null check (category in ('安全','方便','夜間照明','設備','其他')),
  text text not null check (length(text) between 1 and 200),
  source text,
  status text not null default '待分類',
  reply text,
  created_at timestamptz not null default now()
);
create table jjj.wish_topics (
  id text primary key,
  name text not null,
  descr text,
  base int not null default 0,
  threshold int not null default 100,
  status text not null default 'res',
  sort int not null default 0
);
-- 題目沿用 Demo；共鳴數從 0 開始算真的（不放示範數字）；可調光夜燈已開放預購
insert into jjj.wish_topics (id, name, descr, base, threshold, status, sort) values
  ('dim', '可調光感應夜燈', '半夜起床夠亮、又不刺眼', 0, 100, 'pre', 1),
  ('switch', '床邊大按鍵開關', '起身前先按一下，走道燈全亮', 0, 100, 'res', 2),
  ('voice', '睡前語音報平安', '睡前按一下，家人就知道今晚平安', 0, 100, 'res', 3),
  ('mat', '浴室門口止滑地墊', '夜間進出浴室腳下不打滑', 0, 100, 'res', 4);
create table jjj.wish_votes (
  topic_id text not null references jjj.wish_topics(id) on delete cascade,
  user_id uuid not null references jjj.profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (topic_id, user_id)
);
-- 家庭的小型設定：評估草稿、方案選擇、家電連結（key/value）
create table jjj.hh_kv (
  household_id bigint not null references jjj.households(id) on delete cascade,
  k text not null check (k in ('assessment_draft','choices','device_links')),
  v jsonb not null default '{}',
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (household_id, k)
);
create table jjj.family_handoffs (
  id bigint generated always as identity primary key,
  household_id bigint not null references jjj.households(id) on delete cascade,
  items jsonb not null default '[]',
  at text,
  by_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create table jjj.orders (
  id bigint generated always as identity primary key,
  household_id bigint references jjj.households(id) on delete set null,
  code text not null,
  items jsonb not null default '[]',
  monthly int not null default 0,
  one_time int not null default 0,
  pay text,
  status text not null check (status in ('待生活顧問確認','已報名','已成立','已確認','已取消')),
  note text,
  by_id uuid not null default auth.uid() references jjj.profiles(id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create table jjj.cart_items (
  user_id uuid not null references jjj.profiles(id) on delete cascade default auth.uid(),
  sku text not null,
  name text not null,
  price int not null check (price >= 0),
  qty int not null default 1 check (qty between 1 and 20),
  src text,
  primary key (user_id, sku)
);
-- 方案（生活顧問第 2 批建立；家庭在這批可以讀、確認）
create table jjj.plans (
  id bigint generated always as identity primary key,
  household_id bigint not null references jjj.households(id) on delete cascade,
  sel jsonb not null default '{}',
  later jsonb not null default '{}',
  plan_code text,
  pay text,
  one_time int not null default 0,
  monthly int not null default 0,
  status text not null default '待確認' check (status in ('草稿','待確認','已確認','已取消')),
  advisor_id uuid references jjj.profiles(id),
  escort boolean not null default false,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
-- 家電檔案與保養提醒（安裝、顧問建立；家庭在這批可以讀）
create table jjj.devices (
  id bigint generated always as identity primary key,
  household_id bigint not null references jjj.households(id) on delete cascade,
  home text not null default 'parents' check (home in ('parents','mine')),
  name text not null,
  years int,
  grade text,
  status text,
  warn text,
  kwh int,
  warranty text,
  old boolean not null default false,
  source text,
  qty int not null default 1
);
create table jjj.reminders (
  id bigint generated always as identity primary key,
  household_id bigint not null references jjj.households(id) on delete cascade,
  device text not null,
  kind text not null,
  reason text,
  due text,
  status text not null default '待處理' check (status in ('待處理','已預約','已略過','已完成')),
  booking_id bigint references jjj.bookings(id) on delete set null,
  created_at timestamptz not null default now()
);
create table jjj.wish_themes (
  id bigint generated always as identity primary key,
  title text not null,
  by_name text,
  reward text,
  deadline text,
  phase int not null default 0,
  status text not null default '進行中',
  created_at timestamptz not null default now()
);
create table jjj.wish_updates (
  id bigint generated always as identity primary key,
  work_id bigint not null references jjj.wish_works(id) on delete cascade,
  by_name text,
  text text not null,
  created_at timestamptz not null default now()
);
create table jjj.wish_comments (
  id bigint generated always as identity primary key,
  work_id bigint not null references jjj.wish_works(id) on delete cascade,
  user_id uuid not null default auth.uid() references jjj.profiles(id) on delete cascade,
  name text,
  text text not null check (length(text) between 1 and 200),
  status text not null default '待審核' check (status in ('待審核','顯示','隱藏')),
  created_at timestamptz not null default now()
);
create table jjj.wish_cparts (
  id bigint generated always as identity primary key,
  work_id bigint references jjj.wish_works(id) on delete cascade,
  user_id uuid not null references jjj.profiles(id) on delete cascade,
  name text not null,
  purpose text,
  photo text,
  status text not null default '待評估',
  created_at timestamptz not null default now()
);
create table jjj.wish_points (
  id bigint generated always as identity primary key,
  user_id uuid not null references jjj.profiles(id) on delete cascade,
  work_id bigint references jjj.wish_works(id) on delete set null,
  reason text not null,
  points int not null,
  status text not null default '待檢核' check (status in ('待檢核','已入帳','不通過')),
  created_at timestamptz not null default now(),
  checked_at timestamptz,
  unique (user_id, work_id, reason)
);
create table jjj.video_tasks (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references jjj.profiles(id) on delete cascade,
  household_id bigint references jjj.households(id) on delete set null,
  topic text,
  checks jsonb not null default '{}',
  status text not null default '待審核',
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- ── 列級權限 ──
alter table jjj.stores enable row level security;
alter table jjj.requests enable row level security;
alter table jjj.preorders enable row level security;
alter table jjj.wishes enable row level security;
alter table jjj.wish_topics enable row level security;
alter table jjj.wish_votes enable row level security;
alter table jjj.hh_kv enable row level security;
alter table jjj.family_handoffs enable row level security;
alter table jjj.orders enable row level security;
alter table jjj.cart_items enable row level security;
alter table jjj.plans enable row level security;
alter table jjj.devices enable row level security;
alter table jjj.reminders enable row level security;
alter table jjj.wish_themes enable row level security;
alter table jjj.wish_updates enable row level security;
alter table jjj.wish_comments enable row level security;
alter table jjj.wish_cparts enable row level security;
alter table jjj.wish_points enable row level security;
alter table jjj.video_tasks enable row level security;

create policy st_read on jjj.stores for select to authenticated, anon using (true);
-- 家庭成員讀寫自己家的；本門市顧問、總部可讀
create policy rq_read on jjj.requests for select to authenticated
  using (jjj.is_member(household_id) or jjj.is_store_staff(household_id) or (select jjj.my_role()) = 'hq');
create policy rq_write on jjj.requests for insert to authenticated
  with check (jjj.is_member(household_id) and user_id = (select auth.uid()) and status = '待處理');
create policy rq_staff on jjj.requests for update to authenticated
  using (jjj.is_store_staff(household_id) or (select jjj.my_role()) = 'hq') with check (true);
create policy po_self on jjj.preorders for select to authenticated using (user_id = (select auth.uid()));
create policy po_write on jjj.preorders for insert to authenticated
  with check (user_id = (select auth.uid()) and (household_id is null or jjj.is_member(household_id)));
create policy wi_read on jjj.wishes for select to authenticated
  using (jjj.is_member(household_id) or jjj.is_store_staff(household_id) or (select jjj.my_role()) = 'hq');
create policy wi_write on jjj.wishes for insert to authenticated
  with check (jjj.is_member(household_id) and user_id = (select auth.uid()) and status = '待分類' and reply is null);
create policy wt_read on jjj.wish_topics for select to authenticated using (true);
create policy wv_self on jjj.wish_votes for select to authenticated using (user_id = (select auth.uid()));
create policy wv_write on jjj.wish_votes for insert to authenticated with check (user_id = (select auth.uid()));
create policy wv_delete on jjj.wish_votes for delete to authenticated using (user_id = (select auth.uid()));
create policy kv_read on jjj.hh_kv for select to authenticated
  using (jjj.is_member(household_id) or jjj.is_store_staff(household_id));
create policy kv_write on jjj.hh_kv for insert to authenticated with check (jjj.is_member(household_id));
create policy kv_update on jjj.hh_kv for update to authenticated
  using (jjj.is_member(household_id)) with check (jjj.is_member(household_id));
create policy kv_delete on jjj.hh_kv for delete to authenticated using (jjj.is_member(household_id));
create policy fh_read on jjj.family_handoffs for select to authenticated
  using (jjj.is_member(household_id) or jjj.is_store_staff(household_id) or (select jjj.my_role()) = 'hq');
create policy fh_write on jjj.family_handoffs for insert to authenticated
  with check (jjj.is_member(household_id) and by_id = (select auth.uid()));
create policy od_read on jjj.orders for select to authenticated
  using (by_id = (select auth.uid()) or (household_id is not null and (jjj.is_member(household_id) or jjj.is_store_staff(household_id))) or (select jjj.my_role()) = 'hq');
create policy od_write on jjj.orders for insert to authenticated
  with check (by_id = (select auth.uid()) and (household_id is null or jjj.is_member(household_id))
              and status in ('待生活顧問確認','已報名','已成立') and confirmed_at is null);
create policy ci_self on jjj.cart_items for select to authenticated using (user_id = (select auth.uid()));
create policy ci_write on jjj.cart_items for insert to authenticated with check (user_id = (select auth.uid()));
create policy ci_update on jjj.cart_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ci_delete on jjj.cart_items for delete to authenticated using (user_id = (select auth.uid()));
create policy pl_read on jjj.plans for select to authenticated
  using ((jjj.is_member(household_id) and status <> '草稿') or jjj.is_store_staff(household_id) or (select jjj.my_role()) = 'hq');
create policy dv_read on jjj.devices for select to authenticated
  using (jjj.is_member(household_id) or jjj.is_store_staff(household_id) or jjj.is_assigned_tech(household_id) or (select jjj.my_role()) = 'hq');
create policy rm_read on jjj.reminders for select to authenticated
  using (jjj.is_member(household_id) or jjj.is_store_staff(household_id) or (select jjj.my_role()) = 'hq');
create policy th_read on jjj.wish_themes for select to authenticated, anon using (true);
create policy wu_read on jjj.wish_updates for select to authenticated, anon using (true);
create policy wc_read on jjj.wish_comments for select to authenticated
  using (status = '顯示' or user_id = (select auth.uid()) or (select jjj.my_role()) in ('hq','advisor'));
create policy wc_write on jjj.wish_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and status = '待審核');
create policy cp_read on jjj.wish_cparts for select to authenticated using (true);
create policy wp_self on jjj.wish_points for select to authenticated
  using (user_id = (select auth.uid()) or (select jjj.my_role()) in ('hq','advisor'));
create policy vt_self on jjj.video_tasks for select to authenticated using (user_id = (select auth.uid()));
create policy vt_write on jjj.video_tasks for insert to authenticated
  with check (user_id = (select auth.uid()) and status = '待審核' and (household_id is null or jjj.is_member(household_id)));

-- 存取：新表一張一張開，可更新的欄位要列出來
grant select on jjj.stores, jjj.wish_topics, jjj.wish_themes, jjj.wish_updates to anon, authenticated;
grant select, insert on jjj.requests, jjj.wishes, jjj.family_handoffs, jjj.orders, jjj.video_tasks, jjj.wish_comments to authenticated;
grant select, insert, delete on jjj.preorders, jjj.wish_votes to authenticated;
grant select, insert, update, delete on jjj.hh_kv, jjj.cart_items to authenticated;
grant select on jjj.plans, jjj.devices, jjj.reminders, jjj.wish_cparts, jjj.wish_points to authenticated;
grant update (status, handled_by, handled_at) on jjj.requests to authenticated;
grant all on all tables in schema jjj to service_role;
grant usage, select on all sequences in schema jjj to authenticated, service_role;

-- ── 函式（狀態轉換、名額、點數） ──
-- 我的長輩家（Demo：一個家庭帳號對一個家，取最早加入的那個）
create or replace function jjj.my_household() returns bigint
language sql stable security definer set search_path = '' as
$$ select household_id from jjj.members where user_id = auth.uid() order by household_id limit 1 $$;

-- 門市時段已被預約幾筆（家庭看不到別家預約，只回傳數字）
create or replace function jjj.slot_taken(p_store text, p_slots text[]) returns table (slot text, n int)
language sql stable security definer set search_path = '' as
$$ select s, (select count(*)::int from jjj.bookings b where b.store = p_store and b.slot_start = s and b.kind = '門市諮詢' and b.status <> '已取消')
   from unnest(p_slots) s $$;

-- 預約門市諮詢：伺服器端檢查名額；同一家只留最新一筆待處理的諮詢
create or replace function jjj.book_consult(p_store text, p_slot text) returns bigint
language plpgsql security definer set search_path = '' as
$$
declare hid bigint; h jjj.households; st jjj.stores; bid bigint; n int; c text; ts timestamptz;
begin
  hid := jjj.my_household(); if hid is null then raise exception '尚未建立家庭資料'; end if;
  select * into h from jjj.households where id = hid for update;
  if h.phase >= 2 then raise exception '已有生活顧問的方案，請直接聯絡綁定門市'; end if;
  select * into st from jjj.stores where name = p_store or short = p_store;
  if not found then raise exception '請選擇門市'; end if;
  if p_slot !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' or not (substr(p_slot, 12, 5) = any(st.times)) then raise exception '這個時段無法預約，請重新選擇'; end if;
  ts := to_timestamp(p_slot, 'YYYY-MM-DD"T"HH24:MI')::timestamp at time zone 'Asia/Taipei';
  if ts < now() + interval '2 hours' or ts > now() + interval '8 days' then raise exception '這個時段無法預約，請重新選擇'; end if;
  perform pg_advisory_xact_lock(hashtext(st.name || p_slot));
  select count(*) into n from jjj.bookings where store = st.name and slot_start = p_slot and kind = '門市諮詢' and status <> '已取消';
  if n >= st.cap then raise exception '這個時段剛剛額滿了，請選擇其他時段'; end if;
  update jjj.bookings set status = '已取消' where household_id = hid and kind = '門市諮詢' and status in ('待指派','已指派');
  c := 'B-' || replace(substr(p_slot, 1, 10), '-', '') || '-' || lpad((select count(*) + 1 from jjj.bookings where code like 'B-' || replace(substr(p_slot, 1, 10), '-', '') || '-%')::text, 2, '0');
  insert into jjj.bookings (code, household_id, kind, store, slot_start, slot, status, created_by)
    values (c, hid, '門市諮詢', st.name, p_slot, ts, '待指派', auth.uid())
    returning id into bid;
  update jjj.households set phase = greatest(phase, 1), store = st.name, updated_at = now() where id = hid;
  return bid;
end $$;

create or replace function jjj.cancel_booking(p_id bigint) returns void
language plpgsql security definer set search_path = '' as
$$
declare b jjj.bookings; hid bigint;
begin
  hid := jjj.my_household();
  select * into b from jjj.bookings where id = p_id and household_id = hid for update;
  if not found then raise exception '找不到資料'; end if;
  if b.status not in ('待指派','已指派') then raise exception '這筆預約無法取消'; end if;
  update jjj.bookings set status = '已取消' where id = b.id;
  update jjj.households set phase = 0 where id = hid and phase = 1;
end $$;

-- 確認方案：寫入地址電話、建立到府安裝單（派工在第 3 批）
create or replace function jjj.plan_confirm(p_address text, p_phone text) returns void
language plpgsql security definer set search_path = '' as
$$
declare hid bigint; h jjj.households; p jjj.plans; a text; ph text;
begin
  hid := jjj.my_household(); if hid is null then raise exception '尚未建立家庭資料'; end if;
  select * into h from jjj.households where id = hid for update;
  select * into p from jjj.plans where household_id = hid and status = '待確認' order by id desc limit 1;
  if not found then raise exception '目前沒有待確認的方案'; end if;
  a := coalesce(nullif(left(trim(p_address), 120), ''), h.address); ph := coalesce(nullif(left(trim(p_phone), 20), ''), h.phone);
  if a is null then raise exception '請填寫到府安裝地址'; end if;
  if ph is null then raise exception '請填寫聯絡電話'; end if;
  update jjj.plans set status = '已確認', confirmed_at = now() where id = p.id;
  update jjj.households set phase = greatest(phase, 3), address = a, phone = ph, updated_at = now() where id = hid;
  if not exists (select 1 from jjj.bookings where household_id = hid and kind = '到府安裝' and status <> '已取消') then
    insert into jjj.bookings (code, household_id, kind, store, slot_start, status, note, created_by)
      values ('W-' || to_char(now() at time zone 'Asia/Taipei', 'YYYYMMDD') || '-' || hid, hid, '到府安裝', coalesce(h.store, ''), '', '待排程',
              case when (p.sel ->> 'night') is not null then '統一排程：技師先裝夜燈，再裝關懷設備' end, auth.uid());
  end if;
end $$;

-- 家人驗收：通過或退回（技師第 3 批把安裝單改成待驗收）
create or replace function jjj.install_review(p_accept boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as
$$
declare hid bigint; b jjj.bookings;
begin
  hid := jjj.my_household();
  select * into b from jjj.bookings where household_id = hid and kind = '到府安裝' and status = '待驗收' order by id desc limit 1 for update;
  if not found then raise exception '目前沒有待驗收的安裝'; end if;
  if not p_accept and coalesce(trim(p_note), '') = '' then raise exception '請寫下哪裡有問題'; end if;
  update jjj.bookings set status = case when p_accept then '已完成' else '待改善' end,
    completed_at = case when p_accept then now() end, diff = case when p_accept then diff else left(p_note, 100) end where id = b.id;
  if p_accept then update jjj.households set phase = greatest(phase, 4) where id = hid; end if;
end $$;

-- 保養提醒：一鍵預約或略過
create or replace function jjj.reminder_act(p_id bigint, p_book boolean) returns void
language plpgsql security definer set search_path = '' as
$$
declare hid bigint; r jjj.reminders; h jjj.households; bid bigint;
begin
  hid := jjj.my_household();
  select * into r from jjj.reminders where id = p_id and household_id = hid for update;
  if not found then raise exception '找不到提醒'; end if;
  if not p_book then update jjj.reminders set status = '已略過' where id = r.id and status = '待處理'; return; end if;
  if r.status <> '待處理' then raise exception '這則提醒已處理'; end if;
  select * into h from jjj.households where id = hid;
  insert into jjj.bookings (code, household_id, kind, store, slot_start, status, note, created_by)
    values ('M-' || to_char(now() at time zone 'Asia/Taipei', 'YYYYMMDD') || '-' || r.id, hid, '到府維護', coalesce(h.store, ''), '', '待排程', r.device || '｜' || r.kind, auth.uid())
    returning id into bid;
  update jjj.reminders set status = '已預約', booking_id = bid where id = r.id;
end $$;

-- 取消訂單：只有還沒確認的可以取消
create or replace function jjj.cancel_order(p_id bigint) returns void
language plpgsql security definer set search_path = '' as
$$
declare o jjj.orders;
begin
  select * into o from jjj.orders where id = p_id and (by_id = auth.uid() or (household_id is not null and jjj.is_member(household_id))) for update;
  if not found then raise exception '找不到訂單'; end if;
  if o.status not in ('待生活顧問確認','已報名') then raise exception '已確認的訂單請洽生活顧問'; end if;
  update jjj.orders set status = '已取消' where id = o.id;
end $$;

-- 通知（家庭內）：訂單、心願、事件用
create or replace function jjj.notify_household(p_household bigint, p_kind text, p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = '' as
$$ insert into jjj.notifications (household_id, audience, channel, kind, title, body, link)
   select p_household, 'owner', 'App', p_kind, left(p_title, 120), left(p_body, 300), p_link
   where p_household is not null and jjj.is_member(p_household) $$;

-- 關懷演練（模擬器）：建立異常事件、往下一步；只限自己家，來源標 drill
create or replace function jjj.care_drill(p_kind text, p_title text, p_timeline jsonb, p_notify jsonb) returns bigint
language plpgsql security definer set search_path = '' as
$$
declare hid bigint; eid bigint; n jsonb;
begin
  hid := jjj.my_household(); if hid is null then raise exception '找不到家庭'; end if;
  insert into jjj.care_events (household_id, kind, occurred_at, title, outcome, timeline, source)
    values (hid, case when p_kind = 'dev' then 'dev' else 'act' end, now(), left(coalesce(p_title, '異常事件'), 80), '處理中', coalesce(p_timeline, '[]'), 'drill')
    returning id into eid;
  for n in select * from jsonb_array_elements(coalesce(p_notify, '[]')) loop
    insert into jjj.notifications (household_id, care_event_id, audience, channel, kind, title, body, link)
      values (hid, eid, n ->> 'audience', n ->> 'channel', 'care', left(n ->> 'title', 120), left(coalesce(n ->> 'body', ''), 300), 'ev:' || eid);
  end loop;
  return eid;
end $$;
create or replace function jjj.care_drill_step(p_id bigint, p_timeline jsonb, p_outcome text, p_notify jsonb) returns void
language plpgsql security definer set search_path = '' as
$$
declare e jjj.care_events; n jsonb;
begin
  select * into e from jjj.care_events where id = p_id and source = 'drill' and jjj.is_member(household_id) for update;
  if not found then raise exception '找不到事件'; end if;
  update jjj.care_events set timeline = coalesce(p_timeline, e.timeline), outcome = left(coalesce(p_outcome, e.outcome), 40) where id = e.id;
  for n in select * from jsonb_array_elements(coalesce(p_notify, '[]')) loop
    insert into jjj.notifications (household_id, care_event_id, audience, channel, kind, title, body, link)
      values (e.household_id, e.id, n ->> 'audience', n ->> 'channel', 'care', left(n ->> 'title', 120), left(coalesce(n ->> 'body', ''), 300), 'ev:' || e.id);
  end loop;
end $$;

-- 揪心願：名稱（作品頁顯示設計者「名字（某某家）」）與支持數，只回傳公開需要的
create or replace function jjj.user_names(p_ids uuid[]) returns table (id uuid, name text)
language sql stable security definer set search_path = '' as
$$ select p.id, coalesce(nullif(p.display_name, ''), '使用者') || coalesce('（' || (select h.elder_name from jjj.households h where h.created_by = p.id order by h.id limit 1) || '家）', '')
   from jjj.profiles p where p.id = any(p_ids)
     and (p.id = auth.uid() or exists (select 1 from jjj.wish_works w where w.owner = p.id and w.status <> '草稿')
          or exists (select 1 from jjj.wish_comments c where c.user_id = p.id and c.status = '顯示')) $$;
create or replace function jjj.wish_support_counts(p_ids bigint[]) returns table (work_id bigint, n int, derivs int)
language sql stable security definer set search_path = '' as
$$ select w.id, w.base + (select count(*)::int from jjj.wish_supports s where s.work_id = w.id and s.kind = 'support'),
          (select count(*)::int from jjj.wish_works d where d.parent_id = w.id and d.status <> '草稿')
   from jjj.wish_works w where w.id = any(p_ids) and (w.status <> '草稿' or w.owner = auth.uid()) $$;

-- 可以按「我也需要」：已確認揪夜安方案，或訂了對應場域的方案
create or replace function jjj.wish_eligible(p_field text) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from jjj.plans p where p.household_id = jjj.my_household() and p.status = '已確認' and p_field = '臥室到浴室')
   or exists (select 1 from jjj.orders o, jsonb_array_elements(o.items) i where o.household_id = jjj.my_household() and o.status <> '已取消'
              and i ->> 'id' = any (case p_field when '臥室到浴室' then array['night_basic','night_plus','all'] when '廚房' then array['food','all']
                                    when '客廳' then array['tv','all'] when '洗衣陽台' then array['wash','all'] else array['all'] end)) $$;

create or replace function jjj.wish_add_points(p_user uuid, p_work bigint, p_reason text, p_points int) returns void
language sql security definer set search_path = '' as
$$ insert into jjj.wish_points (user_id, work_id, reason, points) values (p_user, p_work, p_reason, p_points) on conflict do nothing $$;
revoke execute on function jjj.wish_add_points(uuid, bigint, text, int) from public, anon, authenticated;

-- 送出作品：檢查、建立、零件、更新紀錄、點數（50；衍生版 100）
create or replace function jjj.wish_submit(p_title text, p_field text, p_story jsonb, p_build jsonb, p_cparts jsonb, p_theme bigint, p_parent bigint, p_draft boolean) returns bigint
language plpgsql security definer set search_path = '' as
$$
declare wid bigint; nm text; c jsonb; m jsonb := '{}'; b jsonb := '[]'; x jsonb; pw jjj.wish_works; hid bigint;
begin
  if auth.uid() is null then raise exception '請先登入'; end if;
  if coalesce(trim(p_title), '') = '' or p_field not in ('臥室到浴室','廚房','客廳','洗衣陽台','全屋') then raise exception '請寫下希望，並選擇場域'; end if;
  hid := jjj.my_household();
  select name into nm from jjj.user_names(array[auth.uid()]);
  insert into jjj.wish_works (owner, household_id, title, field, scene, theme_id, parent_id, story, build, status, terms, is_public)
    values (auth.uid(), hid, left(trim(p_title), 40), p_field, p_field, p_theme, p_parent, coalesce(p_story, '{}'), '[]',
            case when p_draft then '草稿' else '共鳴中' end, true, not p_draft)
    returning id into wid;
  for c in select * from jsonb_array_elements(coalesce(p_cparts, '[]')) limit 5 loop
    if coalesce(trim(c ->> 'name'), '') = '' then continue; end if;
    insert into jjj.wish_cparts (work_id, user_id, name, purpose, photo)
      values (wid, auth.uid(), left(c ->> 'name', 30), left(coalesce(c ->> 'purpose', ''), 80), left(coalesce(c ->> 'photo', ''), 90000))
      returning jsonb_build_object(coalesce(c ->> 'tmp', ''), id) || m into m;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p_build, '[]')) limit 12 loop
    if x ? 'cpart' and x ->> 'cpart' is not null then
      b := b || jsonb_strip_nulls(jsonb_build_object('slot', x -> 'slot', 'cpart', m -> (x ->> 'cpart'), 'x', x -> 'x', 'y', x -> 'y'));
    elsif x ->> 'part' is not null then
      b := b || jsonb_strip_nulls(jsonb_build_object('slot', x -> 'slot', 'part', x -> 'part', 'x', x -> 'x', 'y', x -> 'y'));
    end if;
  end loop;
  if jsonb_array_length(b) = 0 then raise exception '至少擺一個零件'; end if;
  update jjj.wish_works set build = b where id = wid;
  insert into jjj.wish_updates (work_id, by_name, text) values (wid, nm,
    case when p_draft then '存成草稿：試點期只開放臥室到浴室，這件會當作擴展期的需求證據' else '送出作品，開始累積共鳴' end);
  perform jjj.wish_add_points(auth.uid(), wid, case when p_parent is not null then '送出衍生版（第 3 關）' else '送出作品' end, case when p_parent is not null then 100 else 50 end);
  if p_parent is not null then
    select * into pw from jjj.wish_works where id = p_parent;
    if found then
      insert into jjj.wish_updates (work_id, by_name, text) values (p_parent, nm, '新增衍生版「' || left(trim(p_title), 40) || '」');
      insert into jjj.notifications (household_id, audience, channel, kind, title, body, link)
        select pw.household_id, 'owner', 'App', 'wish', '有人改了你的作品：' || pw.title, left(trim(p_title), 40), 'wish:' || wid where pw.household_id is not null;
    end if;
  end if;
  return wid;
end $$;

-- 支持（我也需要）或追蹤；達 20 戶給設計者點數、達 100 戶進審查
create or replace function jjj.wish_support(p_work bigint, p_follow boolean, p_buy text, p_price text) returns int
language plpgsql security definer set search_path = '' as
$$
declare w jjj.wish_works; before int; after int;
begin
  if auth.uid() is null then raise exception '請先登入'; end if;
  select * into w from jjj.wish_works where id = p_work and status <> '草稿' for update;
  if not found then raise exception '找不到作品'; end if;
  if w.owner = auth.uid() then raise exception '不能支持自己的作品'; end if;
  if p_follow then
    insert into jjj.wish_supports (work_id, user_id, kind) values (w.id, auth.uid(), 'follow') on conflict do nothing;
    return null;
  end if;
  if coalesce(jjj.my_role(), 'family') <> 'family' or not jjj.wish_eligible(w.field) then
    raise exception '訂閱「%」的家庭才能按「我也需要」，可以先追蹤',
      case w.field when '臥室到浴室' then '揪夜安' when '廚房' then '揪食光' when '客廳' then '揪團聚' when '洗衣陽台' then '揪清爽' else '揪全家' end;
  end if;
  select w.base + count(*)::int into before from jjj.wish_supports where work_id = w.id and kind = 'support';
  insert into jjj.wish_supports (work_id, user_id, kind, buy, price) values (w.id, auth.uid(), 'support', left(p_buy, 40), left(p_price, 40))
    on conflict (work_id, user_id) do update set kind = 'support', buy = excluded.buy, price = excluded.price;
  select w.base + count(*)::int into after from jjj.wish_supports where work_id = w.id and kind = 'support';
  if before < 20 and after >= 20 then
    perform jjj.wish_add_points(w.owner, w.id, '作品共鳴達 20 戶（第 4 關）', 200);
    insert into jjj.notifications (household_id, audience, channel, kind, title, body, link)
      select w.household_id, 'owner', 'App', 'wish', '你的作品達 20 戶共鳴：' || w.title, '+200 點待檢核', 'wish:' || w.id where w.household_id is not null;
  end if;
  if after >= 100 and w.status = '共鳴中' then
    update jjj.wish_works set status = '待審查', updated_at = now() where id = w.id;
    insert into jjj.wish_updates (work_id, by_name, text) values (w.id, '揪居家', '達到 100 戶，排入下一次每季審查');
  end if;
  return after;
end $$;

-- 留言者名稱由伺服器帶入，不能自己填
create or replace function jjj.wish_comment_name() returns trigger
language plpgsql security definer set search_path = '' as
$$ begin new.name := (select n.name from jjj.user_names(array[auth.uid()]) n limit 1); return new; end $$;
create trigger wish_comment_name before insert on jjj.wish_comments for each row execute function jjj.wish_comment_name();

revoke execute on all functions in schema jjj from public, anon;
grant execute on function jjj.my_role(), jjj.my_store(), jjj.is_member(bigint), jjj.is_store_staff(bigint),
  jjj.is_assigned_tech(bigint), jjj.create_household(text, text, text), jjj.create_invite(bigint),
  jjj.redeem_invite(text), jjj.wish_count(bigint), jjj.household_members(bigint),
  jjj.my_household(), jjj.slot_taken(text, text[]), jjj.book_consult(text, text), jjj.cancel_booking(bigint),
  jjj.plan_confirm(text, text), jjj.install_review(boolean, text), jjj.reminder_act(bigint, boolean), jjj.cancel_order(bigint),
  jjj.notify_household(bigint, text, text, text, text), jjj.care_drill(text, text, jsonb, jsonb), jjj.care_drill_step(bigint, jsonb, text, jsonb),
  jjj.user_names(uuid[]), jjj.wish_support_counts(bigint[]), jjj.wish_eligible(text),
  jjj.wish_submit(text, text, jsonb, jsonb, jsonb, bigint, bigint, boolean), jjj.wish_support(bigint, boolean, text, text) to authenticated;
grant execute on function jjj.wish_count(bigint), jjj.wish_support_counts(bigint[]), jjj.user_names(uuid[]) to anon;
grant execute on all functions in schema jjj to service_role;
