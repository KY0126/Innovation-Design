-- 修正：限制可更新的欄位（安全測試發現使用者能把自己的角色改成總部）
-- 原則：不能改 id、household_id、角色、門市、作者等歸屬欄位；這些只由函式或 Edge Function（service role）寫入
revoke update on all tables in schema jjj from authenticated;
grant update (display_name) on jjj.profiles to authenticated;
grant update (elder_name, elder_note, stage) on jjj.households to authenticated;
grant update (notify) on jjj.members to authenticated;
grant update (slot, status) on jjj.bookings to authenticated;
grant update (items, total, is_formal) on jjj.quotes to authenticated;
grant update (status, acceptance, updated_at, tech_id) on jjj.work_orders to authenticated;
grant update (elder_ok, elder_replied_at) on jjj.care_events to authenticated;
grant update (title, build, is_public) on jjj.wish_works to authenticated;
grant update (read_at) on jjj.notifications to authenticated;
-- 家庭、成員、邀請碼只能透過函式建立
revoke insert on jjj.households, jjj.members, jjj.invites, jjj.profiles, jjj.care_events, jjj.notifications from authenticated;
-- 刪除只開放取消支持揪心願
revoke delete on all tables in schema jjj from authenticated;
grant delete on jjj.wish_supports to authenticated;
