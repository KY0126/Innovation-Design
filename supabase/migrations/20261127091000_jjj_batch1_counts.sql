-- 第 1 批補充：家庭可改地址電話；心願題目票數、預購人數（只回傳數字）
grant update (address, phone) on jjj.households to authenticated;
create or replace function jjj.wish_topic_counts() returns table (topic_id text, votes int, me boolean)
language sql stable security definer set search_path = '' as
$$ select t.id, (select count(*)::int from jjj.wish_votes v where v.topic_id = t.id),
          exists (select 1 from jjj.wish_votes v where v.topic_id = t.id and v.user_id = auth.uid())
   from jjj.wish_topics t $$;
create or replace function jjj.preorder_count(p_topic text) returns table (n int, me boolean)
language sql stable security definer set search_path = '' as
$$ select (select count(*)::int from jjj.preorders where topic_id = p_topic),
          exists (select 1 from jjj.preorders where topic_id = p_topic and user_id = auth.uid()) $$;
revoke execute on function jjj.wish_topic_counts(), jjj.preorder_count(text) from public, anon;
grant execute on function jjj.wish_topic_counts(), jjj.preorder_count(text) to authenticated, service_role;
