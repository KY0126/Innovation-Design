-- 實用版第 4 批（總部後台）：即時總覽、試點指標、帳號管理、FAQ、客服轉真人、揪心願審核、營運設定、LINE 小幫手答不出來的問題
-- 總部看全部；生活顧問只看自己門市（同第 2 批 is_store_staff）。統計在資料庫算好一次回傳（admin_overview、admin_metrics）

-- ── 資料表 ──
create table if not exists jjj.support_tickets (
  id bigserial primary key,
  user_id uuid not null default auth.uid(),
  household_id bigint references jjj.households(id) on delete set null,
  target text not null,
  topic text not null,
  transcript jsonb not null default '[]',
  status text not null default '待回覆' check (status in ('待回覆', '已回覆')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid
);
create table if not exists jjj.faq (
  id bigserial primary key,
  cat text not null, q text not null, a text not null, alias text not null default '',
  roles text not null default 'all' check (roles in ('all', 'family', 'advisor')),
  status text not null default '上架' check (status in ('上架', '草稿')),
  source text not null default '總部', url text not null default '',
  updated_at timestamptz not null default now(), updated_by text
);
create table if not exists jjj.config (
  key text primary key,
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into jjj.config (key, value) values ('care_rules', '{"bath_min":30,"morning":"10:00","elder_wait":5,"family_wait":5}') on conflict do nothing;
alter table jjj.support_tickets enable row level security;
alter table jjj.faq enable row level security;
alter table jjj.config enable row level security;

create policy tk_read on jjj.support_tickets for select using (
  user_id = (select auth.uid()) or (select jjj.my_role()) = 'hq' or (household_id is not null and jjj.is_store_staff(household_id)));
create policy tk_close on jjj.support_tickets for update using ((select jjj.my_role()) = 'hq' or (household_id is not null and jjj.is_store_staff(household_id))) with check (true);
create policy fq_read on jjj.faq for select using (status = '上架' or jjj.is_staff());
create policy fq_write on jjj.faq for insert with check ((select jjj.my_role()) = 'hq');
create policy fq_update on jjj.faq for update using ((select jjj.my_role()) = 'hq') with check ((select jjj.my_role()) = 'hq');
create policy cf_read on jjj.config for select using (true);
create policy cf_write on jjj.config for insert with check ((select jjj.my_role()) = 'hq');
create policy cf_update on jjj.config for update using ((select jjj.my_role()) = 'hq') with check ((select jjj.my_role()) = 'hq');
grant select, insert, update on jjj.support_tickets, jjj.faq, jjj.config to authenticated;
grant select on jjj.faq, jjj.config to anon;

-- ── 揪心願審核、點數、留言、短影音：總部（留言、點數、影片生活顧問也可以） ──
create policy ww_hq_update on jjj.wish_works for update using ((select jjj.my_role()) = 'hq') with check ((select jjj.my_role()) = 'hq');
create policy wu_hq_write on jjj.wish_updates for insert with check ((select jjj.my_role()) = 'hq');
create policy cp_hq_update on jjj.wish_cparts for update using ((select jjj.my_role()) = 'hq') with check ((select jjj.my_role()) = 'hq');
create policy th_hq_write on jjj.wish_themes for insert with check ((select jjj.my_role()) = 'hq');
create policy wp_staff_update on jjj.wish_points for update using ((select jjj.my_role()) in ('hq', 'advisor')) with check ((select jjj.my_role()) in ('hq', 'advisor'));
create policy wc_staff_update on jjj.wish_comments for update using ((select jjj.my_role()) in ('hq', 'advisor')) with check ((select jjj.my_role()) in ('hq', 'advisor'));
create policy ws_staff_read on jjj.wish_supports for select using ((select jjj.my_role()) in ('hq', 'advisor'));
create policy vt_staff_read on jjj.video_tasks for select using ((select jjj.my_role()) in ('hq', 'advisor'));
create policy vt_staff_update on jjj.video_tasks for update using ((select jjj.my_role()) in ('hq', 'advisor')) with check ((select jjj.my_role()) in ('hq', 'advisor'));
create policy wv_staff_read on jjj.wish_votes for select using ((select jjj.my_role()) in ('hq', 'advisor'));

-- ── 揪問 AI 轉真人（同 Demo 的 /api/support/handoff）：建客服單；轉門市時同時建門市待辦 ──
create or replace function jjj.support_handoff(p_target text, p_topic text, p_transcript jsonb) returns json
language plpgsql security definer set search_path = '' as $$
declare hid bigint; tid bigint; tg text;
begin
  if auth.uid() is null then raise exception '請先登入'; end if;
  tg := case when p_target = 'cs' then '全國電子客服' else '綁定門市生活顧問' end;
  hid := jjj.my_household();
  insert into jjj.support_tickets (user_id, household_id, target, topic, transcript)
    values (auth.uid(), hid, tg, left(coalesce(p_topic, ''), 80), coalesce((select jsonb_agg(x) from (select x from jsonb_array_elements(coalesce(p_transcript, '[]')) x offset greatest(jsonb_array_length(coalesce(p_transcript, '[]')) - 12, 0)) t), '[]'))
    returning id into tid;
  if tg = '綁定門市生活顧問' and hid is not null then
    insert into jjj.requests (household_id, user_id, kind, note) values (hid, auth.uid(), '揪問 AI 轉生活顧問', left(coalesce(p_topic, ''), 80));
  end if;
  return json_build_object('id', tid, 'target', tg, 'eta', case when tg = '全國電子客服' then '客服專線 0800-021-921；線上留言 1 個工作天內回覆' else '生活顧問 1 個工作天內聯絡您' end);
end $$;

-- ── 即時總覽（同 Demo 的 /api/admin/overview 的 kpi 與漏斗） ──
create or replace function jjj.admin_overview(p_store text) returns json
language plpgsql stable security definer set search_path = '' as $$
declare r text; st text;
begin
  select role, case when role = 'hq' then nullif(p_store, '') else store end into r, st from jjj.profiles where id = auth.uid() and not disabled;
  if r is null or r not in ('hq', 'advisor') then raise exception '這個帳號沒有權限'; end if;
  return (with h as (select * from jjj.households where st is null or store = st)
  select json_build_object(
    'families', (select count(*) from h),
    'assessed', (select count(distinct a.household_id) from jjj.assessments a join h on h.id = a.household_id),
    'consult_open', (select count(*) from jjj.bookings b join h on h.id = b.household_id where b.kind = '門市諮詢' and b.status in ('待指派', '已指派')),
    'consult_unassigned', (select count(*) from jjj.bookings b join h on h.id = b.household_id where b.kind = '門市諮詢' and b.status = '待指派'),
    'plans_pending', (select count(*) from jjj.plans p join h on h.id = p.household_id where p.status = '待確認'),
    'install_unscheduled', (select count(*) from jjj.bookings b join h on h.id = b.household_id where b.kind = '到府安裝' and b.status = '待排程'),
    'install_scheduled', (select count(*) from jjj.bookings b join h on h.id = b.household_id where b.kind = '到府安裝' and b.status in ('已指派', '進行中')),
    'caring', (select count(*) from h where phase >= 9),
    'wishes_open', (select count(*) from jjj.wishes w join h on h.id = w.household_id where w.status <> '已回覆'),
    'requests_open', (select count(*) from jjj.requests q join h on h.id = q.household_id where q.status = '待處理'),
    'care_7d', (select count(*) from jjj.care_events e join h on h.id = e.household_id where e.occurred_at >= now() - interval '7 days'),
    'diag', (select json_build_object('avg', round(avg(duration_s)), 'n', count(*)) from jjj.metrics where type = 'diag'),
    'advisor', (select json_build_object('avg', round(avg(duration_s)), 'n', count(*)) from jjj.metrics where type = 'advisor'),
    'funnel', json_build_array(
      json_build_array('完成診斷', (select count(distinct a.household_id) from jjj.assessments a join h on h.id = a.household_id)),
      json_build_array('預約門市', (select count(distinct b.household_id) from jjj.bookings b join h on h.id = b.household_id where b.kind = '門市諮詢' and b.status <> '已取消')),
      json_build_array('收到方案', (select count(*) from h where phase >= 2)),
      json_build_array('確認方案', (select count(*) from h where phase >= 3)),
      json_build_array('關懷啟用', (select count(*) from h where phase >= 9))),
    'store', coalesce(st, '全部門市')));
end $$;

-- ── 試點指標（同 Demo store2.js 的 METRICS；每個指標寫明資料來源） ──
create or replace function jjj.admin_metrics(p_store text) returns json
language plpgsql stable security definer set search_path = '' as $$
declare r text; st text; res json;
begin
  select role, case when role = 'hq' then nullif(p_store, '') else store end into r, st from jjj.profiles where id = auth.uid() and not disabled;
  if r is null or r not in ('hq', 'advisor') then raise exception '這個帳號沒有權限'; end if;
  with h as (select * from jjj.households where st is null or store = st),
  n as (select
    (select count(distinct a.household_id) from jjj.assessments a join h on h.id = a.household_id) as diag,
    (select count(distinct b.household_id) from jjj.bookings b join h on h.id = b.household_id where b.kind = '門市諮詢' and b.household_id in (select household_id from jjj.assessments)) as booked,
    (select count(distinct p.household_id) from jjj.plans p join h on h.id = p.household_id where p.status = '已確認') as conf,
    (select count(distinct b.household_id) from jjj.bookings b join h on h.id = b.household_id where b.kind = '門市諮詢' and b.status = '已完成') as consulted,
    (select count(distinct b.household_id) from jjj.bookings b join h on h.id = b.household_id where b.kind = '到府安裝' and b.status = '已完成') as inst,
    (select avg(duration_s) from jjj.metrics where type = 'advisor') as plan_s,
    (select count(*) filter (where first_pass) from jjj.acceptance_results) as fp, (select count(*) from jjj.acceptance_results) as fpn,
    (select count(*) from jjj.site_diffs where status = '待審核') as diffs,
    (select count(*) from jjj.care_events e join h on h.id = e.household_id) as care,
    (select count(*) from jjj.care_events e join h on h.id = e.household_id where e.outcome = '長輩確認') as self, (select count(*) from jjj.care_events e join h on h.id = e.household_id where e.kind = 'act') as act,
    (select count(*) from jjj.care_events e join h on h.id = e.household_id where e.followed_up) as fol,
    (select count(*) from jjj.notifications x join h on h.id = x.household_id) as noti,
    (select count(*) from jjj.requests q join h on h.id = q.household_id where q.status <> '待處理') as reqd, (select count(*) from jjj.requests q join h on h.id = q.household_id) as reqn,
    (select count(*) from jjj.orders o join h on h.id = o.household_id where o.status <> '已取消') as ord, (select coalesce(sum(o.monthly), 0) from jjj.orders o join h on h.id = o.household_id where o.status <> '已取消') as mrr,
    (select count(*) from jjj.wishes w where st is null or w.store = st) as wish, (select count(*) from jjj.wishes w where (st is null or w.store = st) and w.status = '已回覆') as wishr,
    (select count(*) from jjj.video_tasks) as video,
    (select count(*) from jjj.bot_logs) as bot, (select count(*) from jjj.bot_logs where answered) as bota)
  select json_build_object('store', st, 'at', to_char(now() at time zone 'Asia/Taipei', 'YYYY-MM-DD HH24:MI:SS'), 'raw', row_to_json(n)) into res from n;
  return res;
end $$;

revoke execute on function jjj.support_handoff(text, text, jsonb), jjj.admin_overview(text), jjj.admin_metrics(text) from anon, public;
grant execute on function jjj.support_handoff(text, text, jsonb), jjj.admin_overview(text), jjj.admin_metrics(text) to authenticated;

-- 狀態補上 Demo 用到的：揪問 AI 轉生活顧問、點數退回
alter table jjj.requests drop constraint if exists requests_kind_check;
alter table jjj.requests add constraint requests_kind_check check (kind in ('設備檢修','夜燈調整','方案升級','改為年繳','取消方案','修改第二聯絡人','聯絡生活顧問','加選門口攝影機','設備問題','線上報修','揪問 AI 轉生活顧問'));
alter table jjj.wish_points drop constraint if exists wish_points_status_check;
alter table jjj.wish_points add constraint wish_points_status_check check (status in ('待檢核','已入帳','不通過','退回'));
