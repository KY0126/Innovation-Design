-- 實用版 jjj 區列級權限檢查（L6 安全層）。整段在 DO 區塊內執行，結尾 raise exception 讓所有測試資料回滾。
-- 執行：在 Supabase SQL 編輯器或 execute_sql 跑；看錯誤訊息裡的結果，「(錯)」代表權限有漏洞。
-- 2026/11/26 結果：A看自己家=1｜A改門市=被拒｜A改階段=可以｜直接新增家庭=被拒｜B看A家=0｜B寫A評估=被拒｜B自升總部=被拒｜B改暱稱=可以｜B看A私人心願=0｜B用邀請碼後=1｜邀請碼重複使用=被拒｜同門市顧問=1｜他門市顧問=0｜未登入看私人心願=0｜未登入讀家庭=被拒
do $t$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  hid bigint; n int; code text; r text := ''; ok boolean; wid bigint;
begin
  insert into auth.users (id, email, aud, role) values (a,'rls-a@test.local','authenticated','authenticated'),(b,'rls-b@test.local','authenticated','authenticated'),(c,'rls-c@test.local','authenticated','authenticated'),(d,'rls-d@test.local','authenticated','authenticated');
  insert into jjj.profiles (id, role, store) values (a,'family',null),(b,'family',null),(c,'advisor','S1'),(d,'advisor','S2');
  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true); set local role authenticated;
  hid := jjj.create_household('媽媽', null, 'S1');
  insert into jjj.assessments (household_id, source, created_by) values (hid,'manual',a);
  insert into jjj.wish_works (owner, title, is_public) values (a,'私人心願',false) returning id into wid;
  select count(*) into n from jjj.households where id = hid; r := r || 'A看自己家=' || n;
  ok := true; begin update jjj.households set store='S2' where id=hid; exception when others then ok := false; end;
  r := r || '｜A改門市=' || case when ok then '成功(錯)' else '被拒' end;
  ok := true; begin update jjj.households set stage=1 where id=hid; exception when others then ok := false; end;
  r := r || '｜A改階段=' || case when ok then '可以' else '被拒(錯)' end;
  ok := true; begin insert into jjj.households (elder_name, created_by) values ('x', a); exception when others then ok := false; end;
  r := r || '｜直接新增家庭=' || case when ok then '成功(錯)' else '被拒' end;
  code := jjj.create_invite(hid);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from jjj.households where id = hid; r := r || '｜B看A家=' || n;
  ok := true; begin insert into jjj.assessments (household_id, source, created_by) values (hid,'manual',b); exception when others then ok := false; end;
  r := r || '｜B寫A評估=' || case when ok then '成功(錯)' else '被拒' end;
  ok := true; begin update jjj.profiles set role='hq' where id=b; exception when others then ok := false; end;
  r := r || '｜B自升總部=' || case when ok then '成功(錯)' else '被拒' end;
  ok := true; begin update jjj.profiles set display_name='小B' where id=b; exception when others then ok := false; end;
  r := r || '｜B改暱稱=' || case when ok then '可以' else '被拒(錯)' end;
  select count(*) into n from jjj.wish_works where id = wid; r := r || '｜B看A私人心願=' || n;
  perform jjj.redeem_invite(code);
  select count(*) into n from jjj.households where id = hid; r := r || '｜B用邀請碼後=' || n;
  ok := true; begin perform jjj.redeem_invite(code); exception when others then ok := false; end;
  r := r || '｜邀請碼重複使用=' || case when ok then '成功(錯)' else '被拒' end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',c,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from jjj.households where id = hid; r := r || '｜同門市顧問=' || n;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',d,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from jjj.households where id = hid; r := r || '｜他門市顧問=' || n;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true); set local role anon;
  select count(*) into n from jjj.wish_works; r := r || '｜未登入看私人心願=' || n;
  ok := true; begin select count(*) into n from jjj.households; exception when others then ok := false; end;
  r := r || '｜未登入讀家庭=' || case when ok then '可讀' || n else '被拒' end;
  reset role;
  raise exception 'RLS測試結果（全部回滾）：%', r;
end $t$;
