-- 實用版第 3 批（技師）：工單、工作包步驟、圖面標記、差異回報、長輩驗收
-- 技師只能動指派給自己的工單（bookings.assignee_id 或工作包 assignee_id）；驗收、退回走資料庫函式（一次寫完驗收紀錄、工單、關懷階段、設備）
-- 狀態與 Demo 模擬後端相同；家人驗收也改走同一個函式（第 1 批的 install_review 改成呼叫它）

create or replace function jjj.is_job_tech(bid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from jjj.profiles p where p.id = auth.uid() and not p.disabled and p.role in ('tech', 'hq'))
     and (exists (select 1 from jjj.profiles p where p.id = auth.uid() and p.role = 'hq')
       or exists (select 1 from jjj.bookings where id = bid and assignee_id = auth.uid())
       or exists (select 1 from jjj.work_packages where booking_id = bid and assignee_id = auth.uid()))
$$;
revoke execute on function jjj.is_job_tech(bigint) from anon, public;
grant execute on function jjj.is_job_tech(bigint) to authenticated;

create policy bk_tech_read on jjj.bookings for select using (kind <> '門市諮詢' and jjj.is_job_tech(id));
create policy bk_tech_update on jjj.bookings for update using (kind <> '門市諮詢' and jjj.is_job_tech(id)) with check (kind <> '門市諮詢' and jjj.is_job_tech(id));
create policy wp_tech_update on jjj.work_packages for update using (jjj.is_job_tech(booking_id)) with check (jjj.is_job_tech(booking_id));
create policy pv_tech_update on jjj.plan_versions for update using (jjj.is_assigned_tech(household_id)) with check (jjj.is_assigned_tech(household_id));
create policy sd_tech_write on jjj.site_diffs for insert with check (by_id = (select auth.uid()) and jjj.is_job_tech(booking_id) and status = '待審核');
create policy dv_tech_update on jjj.devices for update using (jjj.is_assigned_tech(household_id)) with check (jjj.is_assigned_tech(household_id));
create policy rm_tech_update on jjj.reminders for update using (jjj.is_assigned_tech(household_id)) with check (jjj.is_assigned_tech(household_id));
create policy pl_tech_read on jjj.plans for select using (jjj.is_assigned_tech(household_id));
drop policy if exists au_read on jjj.audit;
create policy au_read on jjj.audit for select using (jjj.is_staff());
create table if not exists jjj.acceptance_results (
  booking_code text primary key,
  first_pass boolean not null,
  by_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table jjj.acceptance_results enable row level security;
create policy ar_write on jjj.acceptance_results for insert with check (by_id = (select auth.uid()) and jjj.is_staff());
create policy ar_update on jjj.acceptance_results for update using (by_id = (select auth.uid())) with check (by_id = (select auth.uid()));
create policy ar_read on jjj.acceptance_results for select using (jjj.is_staff());
grant select, insert, update on jjj.acceptance_results to authenticated;

-- 驗收（同 Demo 的 id()／rd()）：通過＝工單完成、長輩家進入關懷中（phase 9）、登錄到府安裝的關懷設備；退回＝退回的空間標記改回待施工、工作包重開
create or replace function jjj.install_finish(p_booking bigint, p_accept boolean, p_by_role text, p_by_name text, p_items jsonb, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare b jjj.bookings; pl jjj.plans; v jjj.plan_versions; areas text[]; pk text[]; sel jsonb;
begin
  select * into b from jjj.bookings where id = p_booking for update;
  if not found or b.kind = '門市諮詢' then raise exception '找不到工單'; end if;
  if not (jjj.is_job_tech(b.id) or (p_by_role = '家人' and jjj.is_member(b.household_id))) then raise exception '這不是您的工單'; end if;
  if b.status <> '待驗收' then raise exception '%', case when p_by_role = '家人' then '目前沒有待驗收的安裝' else '全部施工完成後才能請長輩驗收' end; end if;
  if not p_accept and coalesce(trim(p_note), '') = '' and p_by_role = '家人' then raise exception '請寫下哪裡有問題'; end if;
  if p_accept then
    insert into jjj.acceptances (booking_id, household_id, result, by_role, by_name, items, note)
      values (b.id, b.household_id, '通過', p_by_role, left(p_by_name, 20), coalesce(p_items, '[]'), left(p_note, 100));
    update jjj.bookings set status = '已完成', progress = 6, completed_at = now() where id = b.id;
    update jjj.households set phase = greatest(phase, 9), updated_at = now() where id = b.household_id;
    if not exists (select 1 from jjj.devices where household_id = b.household_id and source = '到府安裝') then
      select * into pl from jjj.plans where household_id = b.household_id and status = '已確認' order by id desc limit 1;
      sel := coalesce(pl.sel, '{}');
      insert into jjj.devices (household_id, home, name, years, status, warranty, source, qty)
      select b.household_id, 'parents', d.n, 0, '正常', '保固 2 年', '到府安裝', d.q
      from (values ('night', '閘道器', 1, 1), ('night', '感應小夜燈', 3, 2), ('night', '門窗感測器', 2, 3), ('night', '浴室緊急按鈕', 1, 4),
                   ('morning', '門窗感測器', 1, 5), ('morning', '人體感測器', 1, 6), ('strip', '門檻提示燈條', 1, 7)) as d(k, n, q, o)
      where sel ? d.k order by d.o;
    end if;
  else
    select array_agg(left(x, 10)) into areas from jsonb_array_elements_text(coalesce(p_items, '[]')) x;
    insert into jjj.acceptances (booking_id, household_id, result, by_role, by_name, items, note)
      values (b.id, b.household_id, '退回', p_by_role, left(p_by_name, 20), to_jsonb(coalesce(areas, '{}')), left(p_note, 100));
    select * into v from jjj.plan_versions where household_id = b.household_id order by ver desc limit 1;
    if found then
      select array_agg(distinct p ->> 'pkg') into pk from jsonb_array_elements(v.pins) p where p ->> 'room' = any (coalesce(areas, '{}')) and p ->> 'k' <> 'note';
      update jjj.plan_versions set pins = (select coalesce(jsonb_agg(case when p ->> 'room' = any (coalesce(areas, '{}')) and p ->> 'k' <> 'note' then p || '{"st":"plan"}' else p end), '[]') from jsonb_array_elements(v.pins) p) where id = v.id;
    end if;
    if pk is null or array_length(pk, 1) is null then pk := array['A']; end if;
    update jjj.work_packages set status = '進行中', done_at = null where booking_id = b.id and code = any (pk);
    update jjj.bookings set status = '進行中', progress = 4 where id = b.id;
    update jjj.households set updated_at = now() where id = b.household_id;
  end if;
end $$;
revoke execute on function jjj.install_finish(bigint, boolean, text, text, jsonb, text) from anon, public;
grant execute on function jjj.install_finish(bigint, boolean, text, text, jsonb, text) to authenticated;

-- 家人驗收（第 1 批）改走同一個函式
create or replace function jjj.install_review(p_accept boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare hid bigint; b jjj.bookings; nm text;
begin
  hid := jjj.my_household();
  select * into b from jjj.bookings where household_id = hid and kind = '到府安裝' and status = '待驗收' order by id desc limit 1;
  if not found then raise exception '目前沒有待驗收的安裝'; end if;
  select display_name into nm from jjj.profiles where id = auth.uid();
  perform jjj.install_finish(b.id, p_accept, '家人', coalesce(nm, '家人'), '[]'::jsonb, p_note);
end $$;

-- 家人確認方案（第 1 批）：工單編號與工作包同 Demo（W-日期-流水號；夜間照明 B、關懷設備 A，A 要等 B 完成）
create or replace function jjj.plan_confirm(p_address text, p_phone text) returns void
language plpgsql security definer set search_path = '' as $$
declare hid bigint; h jjj.households; p jjj.plans; a text; ph text; bid bigint; c text; sel jsonb;
begin
  hid := jjj.my_household(); if hid is null then raise exception '尚未建立家庭資料'; end if;
  select * into h from jjj.households where id = hid for update;
  select * into p from jjj.plans where household_id = hid and status = '待確認' order by id desc limit 1;
  if not found then raise exception '目前沒有待確認的方案'; end if;
  a := coalesce(nullif(left(trim(p_address), 120), ''), h.address); ph := coalesce(nullif(left(trim(p_phone), 20), ''), h.phone);
  if a is null then raise exception '請填寫到府安裝地址'; end if;
  if ph is null then raise exception '請填寫聯絡電話'; end if;
  sel := coalesce(p.sel, '{}');
  update jjj.plans set status = '已確認', confirmed_at = now() where id = p.id;
  update jjj.households set phase = greatest(phase, 3), address = a, phone = ph, updated_at = now() where id = hid;
  select id into bid from jjj.bookings where household_id = hid and kind = '到府安裝' and status <> '已取消' limit 1;
  if bid is null then
    c := 'W-' || to_char(now() at time zone 'Asia/Taipei', 'YYYYMMDD');
    perform pg_advisory_xact_lock(hashtext(c));
    select c || '-' || lpad((coalesce(max(nullif(regexp_replace(code, '^.*-', ''), '')::int), 0) + 1)::text, 2, '0') into c from jjj.bookings where code ~ ('^' || c || '-\d+$');
    insert into jjj.bookings (code, household_id, kind, store, slot_start, status, note, created_by)
      values (c, hid, '到府安裝', coalesce(h.store, ''), '', '待排程', case when sel ? 'night' then '統一排程：技師先裝夜燈，再裝關懷設備' end, auth.uid())
      returning id into bid;
  end if;
  if sel ? 'night' then insert into jjj.work_packages (booking_id, household_id, code, name, team) values (bid, hid, 'B', '夜間照明', '全國電子技師') on conflict do nothing; end if;
  if sel ? 'night' or sel ? 'morning' then insert into jjj.work_packages (booking_id, household_id, code, name, team) values (bid, hid, 'A', '關懷設備安裝', '全國電子技師') on conflict do nothing; end if;
  update jjj.work_packages set prereq = 'B' where booking_id = bid and code = 'A' and exists (select 1 from jjj.work_packages where booking_id = bid and code = 'B');
end $$;
