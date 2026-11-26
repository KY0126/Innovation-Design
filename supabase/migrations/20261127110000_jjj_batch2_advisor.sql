-- 實用版第 2 批（生活顧問）：方案圖面版本、工作包、差異回報、驗收、報價勾選、補助、真實格局、操作紀錄、計時
-- 規則同第 1 批：尺寸存 mm、不存影像、每張表開 RLS；生活顧問只能處理自己門市的家庭，總部看全部（D2）
-- 狀態文字與 Demo 模擬後端（backend.js）一致，畫面不用改

-- ── 身分與權限 ──
alter table jjj.profiles add column if not exists disabled boolean not null default false;
alter table jjj.profiles add column if not exists last_login timestamptz;

-- 本門市生活顧問或總部（停用的帳號不算）
create or replace function jjj.is_store_staff(hid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from jjj.households h join jjj.profiles p on p.id = auth.uid()
    where h.id = hid and not p.disabled
      and (p.role = 'hq' or (p.role = 'advisor' and p.store is not null and p.store = h.store)))
$$;
-- 同門市的員工互相看得到姓名（指派、派工用）；總部看全部
create or replace function jjj.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from jjj.profiles where id = auth.uid() and role in ('advisor', 'tech', 'hq') and not disabled)
$$;

-- ── 狀態（補上 Demo 用到的） ──
alter table jjj.bookings drop constraint if exists bookings_status_check;
alter table jjj.bookings add constraint bookings_status_check check (status in
  ('已預約','已確認','待指派','已指派','待排程','已排程','施工中','進行中','待確認','待驗收','待改善','已完成','已取消'));
alter table jjj.plans drop constraint if exists plans_status_check;
alter table jjj.plans add constraint plans_status_check check (status in ('草稿','待確認','已確認','已取代','已取消'));
alter table jjj.reminders drop constraint if exists reminders_status_check;
alter table jjj.reminders add constraint reminders_status_check check (status in
  ('待處理','已預約','家人已預約','已建立工單','已派工','已略過','已完成'));
alter table jjj.reminders add column if not exists by_family boolean not null default false;
alter table jjj.plans add column if not exists duration_s integer;
alter table jjj.quotes add column if not exists pending integer not null default 0;
alter table jjj.quotes add column if not exists status text not null default '待長輩確認';
alter table jjj.quotes add column if not exists at text;
alter table jjj.wishes add column if not exists class text;
alter table jjj.wishes add column if not exists replied_by uuid;
alter table jjj.wishes add column if not exists replied_at timestamptz;

-- ── 新資料表 ──
create table if not exists jjj.plan_versions (
  id bigserial primary key,
  household_id bigint not null references jjj.households(id) on delete cascade,
  plan_id bigint,
  ver integer not null,
  status text not null default '草稿',
  reason text,
  pins jsonb not null default '[]',
  by_id uuid,
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  unique (household_id, ver)
);
create table if not exists jjj.work_packages (
  id bigserial primary key,
  booking_id bigint not null references jjj.bookings(id) on delete cascade,
  household_id bigint not null references jjj.households(id) on delete cascade,
  code text not null,
  name text not null,
  team text not null,
  assignee_id uuid,
  prereq text,
  status text not null default '未開始',
  steps jsonb not null default '{}',
  started_at timestamptz,
  done_at timestamptz,
  unique (booking_id, code)
);
create table if not exists jjj.site_diffs (
  id bigserial primary key,
  booking_id bigint not null references jjj.bookings(id) on delete cascade,
  household_id bigint not null references jjj.households(id) on delete cascade,
  pkg text not null,
  pin_id text,
  level text not null default '輕微',
  text text not null,
  photo boolean not null default false,
  move jsonb,
  status text not null default '待審核',
  by_id uuid,
  by_name text,
  reviewed_by uuid,
  review_note text,
  new_ver integer,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create table if not exists jjj.acceptances (
  id bigserial primary key,
  booking_id bigint not null references jjj.bookings(id) on delete cascade,
  household_id bigint not null references jjj.households(id) on delete cascade,
  result text not null,
  by_role text not null,
  by_name text,
  items jsonb not null default '[]',
  note text,
  created_at timestamptz not null default now()
);
create table if not exists jjj.quote_selections (
  household_id bigint primary key references jjj.households(id) on delete cascade,
  sel jsonb not null default '{}',
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create table if not exists jjj.subsidies (
  household_id bigint primary key references jjj.households(id) on delete cascade,
  data jsonb not null default '{}',
  updated_by uuid,
  updated_at timestamptz not null default now()
);
-- 真實格局（生活顧問到府畫）：一家一份；只存尺寸與房間資料（mm），不存照片
create table if not exists jjj.floorplans (
  household_id bigint primary key references jjj.households(id) on delete cascade,
  layout jsonb not null,
  note text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create table if not exists jjj.audit (
  id bigserial primary key,
  user_id uuid default auth.uid(),
  action text not null,
  target text,
  detail text,
  at timestamptz not null default now()
);
create table if not exists jjj.metrics (
  id bigserial primary key,
  type text not null check (type in ('diag', 'advisor')),
  user_id uuid default auth.uid(),
  duration_s integer not null check (duration_s > 0 and duration_s < 7200),
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists plan_versions_hh on jjj.plan_versions (household_id, ver desc);
create index if not exists work_packages_bk on jjj.work_packages (booking_id);
create index if not exists site_diffs_hh on jjj.site_diffs (household_id, status);
create index if not exists audit_at on jjj.audit (at desc);

-- 指派到這一家的技師（工單或工作包）
create or replace function jjj.is_assigned_tech(hid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from jjj.work_orders where household_id = hid and tech_id = auth.uid())
      or exists (select 1 from jjj.bookings where household_id = hid and assignee_id = auth.uid() and kind <> '門市諮詢')
      or exists (select 1 from jjj.work_packages where household_id = hid and assignee_id = auth.uid())
$$;

alter table jjj.plan_versions enable row level security;
alter table jjj.work_packages enable row level security;
alter table jjj.site_diffs enable row level security;
alter table jjj.acceptances enable row level security;
alter table jjj.quote_selections enable row level security;
alter table jjj.subsidies enable row level security;
alter table jjj.floorplans enable row level security;
alter table jjj.audit enable row level security;
alter table jjj.metrics enable row level security;

-- 家人看得到自己家的圖面、工作包、驗收、格局；本門市顧問與總部可寫；指派技師可看
create policy pv_read on jjj.plan_versions for select using (jjj.is_member(household_id) or jjj.is_store_staff(household_id) or jjj.is_assigned_tech(household_id));
create policy pv_write on jjj.plan_versions for insert with check (jjj.is_store_staff(household_id));
create policy pv_update on jjj.plan_versions for update using (jjj.is_store_staff(household_id)) with check (jjj.is_store_staff(household_id));
create policy wp_read on jjj.work_packages for select using (jjj.is_member(household_id) or jjj.is_store_staff(household_id) or assignee_id = (select auth.uid()) or jjj.is_assigned_tech(household_id));
create policy wp_write on jjj.work_packages for insert with check (jjj.is_store_staff(household_id));
create policy wp_update on jjj.work_packages for update using (jjj.is_store_staff(household_id)) with check (jjj.is_store_staff(household_id));
create policy sd_read on jjj.site_diffs for select using (jjj.is_store_staff(household_id) or jjj.is_assigned_tech(household_id));
create policy sd_update on jjj.site_diffs for update using (jjj.is_store_staff(household_id)) with check (jjj.is_store_staff(household_id));
create policy ac_read on jjj.acceptances for select using (jjj.is_member(household_id) or jjj.is_store_staff(household_id) or jjj.is_assigned_tech(household_id));
create policy qs_all on jjj.quote_selections for all using (jjj.is_store_staff(household_id)) with check (jjj.is_store_staff(household_id));
create policy sb_all on jjj.subsidies for all using (jjj.is_store_staff(household_id)) with check (jjj.is_store_staff(household_id));
create policy fp_read on jjj.floorplans for select using (jjj.is_member(household_id) or jjj.is_store_staff(household_id) or jjj.is_assigned_tech(household_id));
create policy fp_write on jjj.floorplans for insert with check (jjj.is_store_staff(household_id) and updated_by = (select auth.uid()));
create policy fp_update on jjj.floorplans for update using (jjj.is_store_staff(household_id)) with check (jjj.is_store_staff(household_id) and updated_by = (select auth.uid()));
create policy au_write on jjj.audit for insert with check (user_id = (select auth.uid()) and jjj.is_staff());
create policy au_read on jjj.audit for select using ((select jjj.my_role()) = 'hq');
create policy mt_write on jjj.metrics for insert with check (user_id = (select auth.uid()));
create policy mt_read on jjj.metrics for select using ((select jjj.my_role()) in ('hq', 'advisor'));

-- ── 既有資料表：補上生活顧問（本門市）與總部的寫入權 ──
create policy pl_staff_write on jjj.plans for insert with check (jjj.is_store_staff(household_id) and advisor_id = (select auth.uid()));
create policy pl_staff_update on jjj.plans for update using (jjj.is_store_staff(household_id)) with check (jjj.is_store_staff(household_id));
create policy bk_staff_write on jjj.bookings for insert with check (jjj.is_store_staff(household_id) and created_by = (select auth.uid()));
create policy rm_staff_write on jjj.reminders for insert with check (jjj.is_store_staff(household_id));
create policy rm_staff_update on jjj.reminders for update using (jjj.is_store_staff(household_id)) with check (jjj.is_store_staff(household_id));
create policy ce_staff_read on jjj.care_events for select using (jjj.is_store_staff(household_id));
create policy ce_staff_update on jjj.care_events for update using (jjj.is_store_staff(household_id)) with check (jjj.is_store_staff(household_id));
create policy wi_staff_write on jjj.wishes for insert with check (jjj.is_store_staff(household_id) and user_id = (select auth.uid()));
create policy wi_staff_update on jjj.wishes for update using (jjj.is_store_staff(household_id) or (select jjj.my_role()) = 'hq') with check (true);
create policy od_staff_update on jjj.orders for update using (household_id is not null and jjj.is_store_staff(household_id)) with check (household_id is not null and jjj.is_store_staff(household_id));
create policy profiles_staff on jjj.profiles for select using (
  jjj.is_staff() and role in ('advisor', 'tech', 'hq')
  and ((select jjj.my_role()) = 'hq' or store = (select jjj.my_store())));

-- ── 資料庫函式 ──
-- 工單編號：前綴-兩位流水號（同 Demo 的 La()），例如 M-20261127-01
create or replace function jjj.next_code(p_prefix text) returns text
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not jjj.is_staff() and not exists (select 1 from jjj.members where user_id = auth.uid()) then raise exception '請先登入'; end if;
  if p_prefix !~ '^[A-Z]{1,3}-\d{8}$' then raise exception '編號格式不正確'; end if;
  perform pg_advisory_xact_lock(hashtext(p_prefix));
  select coalesce(max(nullif(regexp_replace(code, '^.*-', ''), '')::int), 0) + 1 into n
    from jjj.bookings where code like p_prefix || '-%' and code ~ ('^' || p_prefix || '-\d+$');
  return p_prefix || '-' || lpad(n::text, 2, '0');
end $$;

-- 方案圖面新版本：版本號由資料庫遞增（同 Demo 的 newVersion）
create or replace function jjj.add_plan_version(p_hid bigint, p_plan bigint, p_pins jsonb, p_status text, p_reason text) returns int
language plpgsql security definer set search_path = '' as $$
declare v int; pid bigint;
begin
  if not jjj.is_store_staff(p_hid) then raise exception '只能處理自己門市的資料'; end if;
  if p_status not in ('草稿', '長輩已確認', '差異已核准') then raise exception '狀態不正確'; end if;
  perform pg_advisory_xact_lock(p_hid);
  select coalesce(max(ver), 0) + 1, coalesce(p_plan, max(plan_id)) into v, pid from jjj.plan_versions where household_id = p_hid;
  insert into jjj.plan_versions (household_id, plan_id, ver, status, reason, pins, by_id, locked_at)
    values (p_hid, coalesce(p_plan, pid), v, p_status, left(p_reason, 80), coalesce(p_pins, '[]'), auth.uid(), case when p_status = '草稿' then null else now() end);
  return v;
end $$;

-- 通知長輩家：家人自己或本門市生活顧問、總部都可以發
create or replace function jjj.notify_household(p_household bigint, p_kind text, p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = '' as $$
  insert into jjj.notifications (household_id, audience, channel, kind, title, body, link)
  select p_household, 'owner', 'App', p_kind, left(p_title, 120), left(p_body, 300), p_link
  where p_household is not null and (jjj.is_member(p_household) or jjj.is_store_staff(p_household))
$$;

-- 家人一鍵預約維護：同 Demo（設備維護、待生活顧問確認、工作包 S）
create or replace function jjj.reminder_act(p_id bigint, p_book boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare hid bigint; r jjj.reminders; h jjj.households; bid bigint; c text;
begin
  hid := jjj.my_household();
  select * into r from jjj.reminders where id = p_id and household_id = hid for update;
  if not found then raise exception '找不到提醒'; end if;
  if not p_book then update jjj.reminders set status = '已略過' where id = r.id and status = '待處理'; return; end if;
  if r.status <> '待處理' then raise exception '這則提醒已處理'; end if;
  select * into h from jjj.households where id = hid;
  c := 'M-' || to_char(now() at time zone 'Asia/Taipei', 'YYYYMMDD');
  perform pg_advisory_xact_lock(hashtext(c));
  select c || '-' || lpad((coalesce(max(nullif(regexp_replace(code, '^.*-', ''), '')::int), 0) + 1)::text, 2, '0') into c
    from jjj.bookings where code ~ ('^' || c || '-\d+$');
  insert into jjj.bookings (code, household_id, kind, store, slot_start, status, note, created_by)
    values (c, hid, '設備維護', coalesce(h.store, ''), '', '待確認', r.device || '｜' || r.kind, auth.uid())
    returning id into bid;
  insert into jjj.work_packages (booking_id, household_id, code, name, team) values (bid, hid, 'S', '設備檢修', '全國電子技師');
  update jjj.reminders set status = '家人已預約', booking_id = bid, by_family = true where id = r.id;
end $$;

revoke all on function jjj.next_code(text) from public, anon;
revoke all on function jjj.add_plan_version(bigint, bigint, jsonb, text, text) from public, anon;
grant execute on function jjj.next_code(text) to authenticated;
grant execute on function jjj.add_plan_version(bigint, bigint, jsonb, text, text) to authenticated;
grant select, insert, update on jjj.plan_versions, jjj.work_packages, jjj.site_diffs, jjj.acceptances, jjj.quote_selections, jjj.subsidies, jjj.floorplans, jjj.audit, jjj.metrics to authenticated;
grant usage, select on all sequences in schema jjj to authenticated;

-- 生活顧問可以把格局改回範本（刪掉這一家的真實格局）
create policy fp_delete on jjj.floorplans for delete using (jjj.is_store_staff(household_id));
grant delete on jjj.floorplans, jjj.quote_selections, jjj.subsidies to authenticated;

-- is_staff 只給登入的人用
revoke execute on function jjj.is_staff() from anon, public;
grant execute on function jjj.is_staff() to authenticated;
