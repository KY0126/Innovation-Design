-- 家人清單：同一家庭的成員看得到彼此的暱稱與身分（profiles 本身只開放看自己）
create or replace function jjj.household_members(p_household bigint)
returns table (user_id uuid, display_name text, relation text, is_me boolean)
language sql stable security definer set search_path = '' as
$$ select m.user_id, p.display_name, m.relation, m.user_id = auth.uid()
   from jjj.members m join jjj.profiles p on p.id = m.user_id
   where m.household_id = p_household and jjj.is_member(p_household)
   order by m.created_at $$;
revoke execute on function jjj.household_members(bigint) from public, anon;
grant execute on function jjj.household_members(bigint) to authenticated, service_role;
