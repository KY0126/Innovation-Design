-- LINE 小幫手：記錄提問與比對結果（改善回答用；只有總部看得到）
create table jjj.bot_logs (
  id bigint generated always as identity primary key,
  line_user_id text,
  text text not null,
  intent text,
  answered boolean not null default false,
  created_at timestamptz not null default now()
);
alter table jjj.bot_logs enable row level security;
create policy bl_hq on jjj.bot_logs for select to authenticated using ((select jjj.my_role()) = 'hq');
grant select on jjj.bot_logs to authenticated;
grant all on jjj.bot_logs to service_role;
