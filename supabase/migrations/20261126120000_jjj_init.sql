-- 揪居家實用版：獨立的 jjj 區（和同一個 Supabase 專案裡永信旅遊的 public 區分開）
-- 依據：docs/設計稿「第 4 步 v2」第 3、4 節；CLAUDE.md C7、C13；領域鐵律 R15（不放示範資料）
-- 移除方式：drop schema jjj cascade;（不影響 public 區）

create schema if not exists jjj;

-- ── 資料表（T1～T14） ─────────────────────────────────────
create table jjj.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'family' check (role in ('family','advisor','tech','hq')),
  line_user_id text unique,
  store text,
  is_friend boolean not null default false,
  created_at timestamptz not null default now()
);

create table jjj.households (
  id bigint generated always as identity primary key,
  elder_name text not null,
  elder_note text,
  store text,
  stage smallint not null default 0,
  created_by uuid not null references jjj.profiles(id),
  created_at timestamptz not null default now()
);

create table jjj.members (
  household_id bigint not null references jjj.households(id) on delete cascade,
  user_id uuid not null references jjj.profiles(id) on delete cascade,
  relation text not null default 'child' check (relation in ('child','family','elder')),
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table jjj.invites (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  household_id bigint not null references jjj.households(id) on delete cascade,
  inviter uuid not null references jjj.profiles(id),
  used_by uuid references jjj.profiles(id),
  used_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  gift_recorded boolean not null default false
);

create table jjj.assessments (
  id bigint generated always as identity primary key,
  household_id bigint not null references jjj.households(id) on delete cascade,
  source text not null check (source in ('ar','manual')),
  dims jsonb not null default '{}',      -- 尺寸一律 mm；不存影像（M3）
  result jsonb not null default '{}',    -- 燈號結果
  created_by uuid not null references jjj.profiles(id),
  created_at timestamptz not null default now()
);

create table jjj.bookings (
  id bigint generated always as identity primary key,
  household_id bigint not null references jjj.households(id) on delete cascade,
  store text not null,
  slot timestamptz not null,
  status text not null default '已預約' check (status in ('已預約','已確認','已完成','已取消')),
  created_by uuid not null references jjj.profiles(id),
  created_at timestamptz not null default now()
);

create table jjj.quotes (
  id bigint generated always as identity primary key,
  household_id bigint not null references jjj.households(id) on delete cascade,
  version int not null default 1,
  items jsonb not null default '[]',
  total int not null default 0,
  is_formal boolean not null default false,
  advisor_id uuid not null references jjj.profiles(id),
  created_at timestamptz not null default now(),
  unique (household_id, version)
);

create table jjj.consents (
  id bigint generated always as identity primary key,
  household_id bigint not null references jjj.households(id) on delete cascade,
  quote_id bigint not null references jjj.quotes(id) on delete cascade,
  consented_by uuid not null references jjj.profiles(id),
  on_behalf boolean not null default false,   -- 子女代長輩操作（D6）
  created_at timestamptz not null default now()
);

create table jjj.work_orders (
  id bigint generated always as identity primary key,
  household_id bigint not null references jjj.households(id) on delete cascade,
  package text not null,
  tech_id uuid references jjj.profiles(id),
  status text not null default '未開始' check (status in ('未開始','進行中','待驗收','已完成')),
  acceptance jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table jjj.care_events (
  id bigint generated always as identity primary key,
  household_id bigint not null references jjj.households(id) on delete cascade,
  kind text not null,
  detected_at timestamptz not null default now(),
  elder_ok boolean,
  elder_replied_at timestamptz,
  family_notified boolean not null default false
);

create table jjj.wish_works (
  id bigint generated always as identity primary key,
  owner uuid not null references jjj.profiles(id) on delete cascade,
  title text not null,
  build jsonb not null default '[]',     -- 零件種類＋mm 座標（M9）
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table jjj.wish_supports (
  work_id bigint not null references jjj.wish_works(id) on delete cascade,
  user_id uuid not null references jjj.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (work_id, user_id)
);

create table jjj.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references jjj.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  link text,
  pushed boolean not null default false,
  pushed_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table jjj.share_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references jjj.profiles(id) on delete cascade,
  kind text not null check (kind in ('S1','S2','S3')),
  target_id text,
  created_at timestamptz not null default now()   -- 只記「有分享」，不記分享給誰
);

create index on jjj.members (user_id);
create index on jjj.assessments (household_id);
create index on jjj.bookings (household_id);
create index on jjj.quotes (household_id);
create index on jjj.consents (household_id);
create index on jjj.work_orders (household_id);
create index on jjj.work_orders (tech_id);
create index on jjj.care_events (household_id);
create index on jjj.wish_supports (user_id);
create index on jjj.notifications (user_id);

-- ── 權限用的小函式（security definer，避免規則互相查詢時無限循環） ──
create or replace function jjj.my_role() returns text
language sql stable security definer set search_path = '' as
$$ select role from jjj.profiles where id = auth.uid() $$;

create or replace function jjj.my_store() returns text
language sql stable security definer set search_path = '' as
$$ select store from jjj.profiles where id = auth.uid() $$;

create or replace function jjj.is_member(hid bigint) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from jjj.members where household_id = hid and user_id = auth.uid()) $$;

create or replace function jjj.is_store_staff(hid bigint) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from jjj.households h join jjj.profiles p on p.id = auth.uid()
                  where h.id = hid and p.role = 'advisor' and p.store is not null and p.store = h.store) $$;

create or replace function jjj.is_assigned_tech(hid bigint) returns boolean
language sql stable security definer set search_path = '' as
$$ select exists (select 1 from jjj.work_orders where household_id = hid and tech_id = auth.uid()) $$;

-- 建立長輩家：同時把自己加為子女成員
create or replace function jjj.create_household(p_elder_name text, p_elder_note text, p_store text) returns bigint
language plpgsql security definer set search_path = '' as
$$
declare hid bigint;
begin
  if auth.uid() is null then raise exception '需要登入'; end if;
  insert into jjj.households (elder_name, elder_note, store, created_by)
    values (p_elder_name, p_elder_note, p_store, auth.uid()) returning id into hid;
  insert into jjj.members (household_id, user_id, relation) values (hid, auth.uid(), 'child');
  return hid;
end $$;

-- 產生邀請碼（成員才能產生）
create or replace function jjj.create_invite(p_household bigint) returns text
language plpgsql security definer set search_path = '' as
$$
declare c text;
begin
  if not jjj.is_member(p_household) then raise exception '不是這個家庭的成員'; end if;
  loop
    c := upper(substr(translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=', 'XYZ'), 1, 6));
    exit when c ~ '^[A-Z0-9]{6}$' and not exists (select 1 from jjj.invites where code = c);
  end loop;
  insert into jjj.invites (code, household_id, inviter) values (c, p_household, auth.uid());
  return c;
end $$;

-- 使用邀請碼加入家庭（P7 家人邀請禮由 gift_recorded 記錄）
create or replace function jjj.redeem_invite(p_code text) returns bigint
language plpgsql security definer set search_path = '' as
$$
declare inv jjj.invites;
begin
  if auth.uid() is null then raise exception '需要登入'; end if;
  select * into inv from jjj.invites where code = upper(p_code) for update;
  if not found or inv.used_by is not null or inv.expires_at < now() then raise exception '邀請碼無效或已使用'; end if;
  insert into jjj.members (household_id, user_id, relation) values (inv.household_id, auth.uid(), 'family')
    on conflict do nothing;
  update jjj.invites set used_by = auth.uid(), used_at = now(), gift_recorded = true where code = inv.code;
  return inv.household_id;
end $$;

-- 揪心願支持人數：公開，但不透露是誰支持
create or replace function jjj.wish_count(p_work bigint) returns int
language sql stable security definer set search_path = '' as
$$ select count(*)::int from jjj.wish_supports s join jjj.wish_works w on w.id = s.work_id
   where s.work_id = p_work and (w.is_public or w.owner = auth.uid()) $$;

-- ── 列級權限 ───────────────────────────────────────────
alter table jjj.profiles enable row level security;
alter table jjj.households enable row level security;
alter table jjj.members enable row level security;
alter table jjj.invites enable row level security;
alter table jjj.assessments enable row level security;
alter table jjj.bookings enable row level security;
alter table jjj.quotes enable row level security;
alter table jjj.consents enable row level security;
alter table jjj.work_orders enable row level security;
alter table jjj.care_events enable row level security;
alter table jjj.wish_works enable row level security;
alter table jjj.wish_supports enable row level security;
alter table jjj.notifications enable row level security;
alter table jjj.share_logs enable row level security;

-- profiles：只看自己；總部看全部。角色與 LINE ID 只由 Edge Function（service role）寫入
create policy profiles_self on jjj.profiles for select to authenticated
  using (id = (select auth.uid()) or (select jjj.my_role()) = 'hq');
create policy profiles_name on jjj.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- households
create policy hh_read on jjj.households for select to authenticated
  using (jjj.is_member(id) or jjj.is_store_staff(id) or jjj.is_assigned_tech(id) or (select jjj.my_role()) = 'hq');
create policy hh_update on jjj.households for update to authenticated
  using (jjj.is_member(id) or jjj.is_store_staff(id)) with check (jjj.is_member(id) or jjj.is_store_staff(id));

-- members：同家庭看得到彼此；自己的通知設定自己改
create policy mem_read on jjj.members for select to authenticated
  using (jjj.is_member(household_id) or jjj.is_store_staff(household_id) or (select jjj.my_role()) = 'hq');
create policy mem_notify on jjj.members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- invites：成員看得到自己家的邀請碼（建立與使用走函式）
create policy inv_read on jjj.invites for select to authenticated
  using (jjj.is_member(household_id));

-- assessments
create policy as_read on jjj.assessments for select to authenticated
  using (jjj.is_member(household_id) or jjj.is_store_staff(household_id) or jjj.is_assigned_tech(household_id) or (select jjj.my_role()) = 'hq');
create policy as_write on jjj.assessments for insert to authenticated
  with check (jjj.is_member(household_id) and created_by = (select auth.uid()));

-- bookings
create policy bk_read on jjj.bookings for select to authenticated
  using (jjj.is_member(household_id) or jjj.is_store_staff(household_id) or (select jjj.my_role()) = 'hq');
create policy bk_write on jjj.bookings for insert to authenticated
  with check (jjj.is_member(household_id) and created_by = (select auth.uid()));
create policy bk_update on jjj.bookings for update to authenticated
  using (jjj.is_member(household_id) or jjj.is_store_staff(household_id))
  with check (jjj.is_member(household_id) or jjj.is_store_staff(household_id));

-- quotes：生活顧問（同門市）寫；家庭看
create policy qt_read on jjj.quotes for select to authenticated
  using (jjj.is_member(household_id) or jjj.is_store_staff(household_id) or (select jjj.my_role()) = 'hq');
create policy qt_write on jjj.quotes for insert to authenticated
  with check (jjj.is_store_staff(household_id) and advisor_id = (select auth.uid()));
create policy qt_update on jjj.quotes for update to authenticated
  using (jjj.is_store_staff(household_id)) with check (jjj.is_store_staff(household_id));

-- consents：家庭成員本人同意（或代長輩）
create policy cs_read on jjj.consents for select to authenticated
  using (jjj.is_member(household_id) or jjj.is_store_staff(household_id) or (select jjj.my_role()) = 'hq');
create policy cs_write on jjj.consents for insert to authenticated
  with check (jjj.is_member(household_id) and consented_by = (select auth.uid()));

-- work_orders：技師只看自己的；同門市生活顧問安排
create policy wo_read on jjj.work_orders for select to authenticated
  using (tech_id = (select auth.uid()) or jjj.is_member(household_id) or jjj.is_store_staff(household_id) or (select jjj.my_role()) = 'hq');
create policy wo_write on jjj.work_orders for insert to authenticated
  with check (jjj.is_store_staff(household_id));
create policy wo_update on jjj.work_orders for update to authenticated
  using (tech_id = (select auth.uid()) or jjj.is_store_staff(household_id))
  with check (tech_id = (select auth.uid()) or jjj.is_store_staff(household_id));

-- care_events：家庭看；長輩或子女回覆「我很好」。新增由 Edge Function 寫入
create policy ce_read on jjj.care_events for select to authenticated
  using (jjj.is_member(household_id) or (select jjj.my_role()) = 'hq');
create policy ce_reply on jjj.care_events for update to authenticated
  using (jjj.is_member(household_id)) with check (jjj.is_member(household_id));

-- wish_works：公開作品任何人可看（含未登入）；作者自己寫
create policy ww_read_public on jjj.wish_works for select to anon, authenticated
  using (is_public or owner = (select auth.uid()));
create policy ww_write on jjj.wish_works for insert to authenticated
  with check (owner = (select auth.uid()));
create policy ww_update on jjj.wish_works for update to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

-- wish_supports：只看得到自己的支持；人數用 jjj.wish_count()
create policy ws_self on jjj.wish_supports for select to authenticated
  using (user_id = (select auth.uid()));
create policy ws_write on jjj.wish_supports for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy ws_delete on jjj.wish_supports for delete to authenticated
  using (user_id = (select auth.uid()));

-- notifications：只看、只改（已讀）自己的
create policy nt_self on jjj.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy nt_read on jjj.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- share_logs：只記自己的
create policy sl_write on jjj.share_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy sl_self on jjj.share_logs for select to authenticated
  using (user_id = (select auth.uid()) or (select jjj.my_role()) = 'hq');

-- ── 存取權限（有列級權限把關） ──────────────────────────
grant usage on schema jjj to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema jjj to authenticated;
grant all on all tables in schema jjj to service_role;
grant select on jjj.wish_works to anon;
grant usage, select on all sequences in schema jjj to authenticated, service_role;
revoke execute on all functions in schema jjj from public, anon;
grant execute on function jjj.my_role(), jjj.my_store(), jjj.is_member(bigint), jjj.is_store_staff(bigint),
  jjj.is_assigned_tech(bigint), jjj.create_household(text, text, text), jjj.create_invite(bigint),
  jjj.redeem_invite(text), jjj.wish_count(bigint) to authenticated;
grant execute on function jjj.wish_count(bigint) to anon;
grant execute on all functions in schema jjj to service_role;
