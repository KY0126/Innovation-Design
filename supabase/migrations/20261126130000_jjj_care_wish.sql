-- 實用版第二階段補充：關懷事件的一次性回覆連結（P3「我很好」）、揪心願場域與門檻通知紀錄
alter table jjj.care_events add column reply_token text unique;
alter table jjj.care_events add column reply_expires timestamptz;
alter table jjj.care_events add column asked_at timestamptz;          -- P3 已問長輩的時間
alter table jjj.wish_works add column scene text not null default '臥室到浴室';
alter table jjj.wish_works add column notified_stage int not null default 0;   -- P6 已通知到第幾段門檻
-- 回覆碼只給 Edge Function（service role）讀寫，不開放給登入使用者
revoke select on jjj.care_events from authenticated;
grant select (id, household_id, kind, detected_at, elder_ok, elder_replied_at, family_notified, asked_at) on jjj.care_events to authenticated;
