# 揪居家 MCP Agent｜能力表 v1.3

> 全部為模擬資料；規則與數值和 GitHub 原型 v6 一致。★＝會改變狀態，執行前一律要使用者確認。

## Server 1｜home-assess（對應揪居家 App 的評估資料）

| 類型 | 名稱 | 做什麼 | 參數 | 誰可以用 |
|---|---|---|---|---|
| Tool | `get_home_profile` | 長輩稱呼、狀況、所屬門市、住宅類型、聯絡順序 | household_id | 家人（自己的長輩家）、顧問（同門市）、總部 |
| Tool | `get_ar_measures` | 最新一次 AR 量測與材質辨識；超出範圍的值列為需重新量測 | household_id | 同上 |
| Tool | `assess_risk` | 依規則算各區紅黃綠燈與原因 | household_id | 同上 |
| Resource | `policy://risk-rules` | 燈號規則全文 | — | 全部 |
| Resource | `policy://privacy` | AR 影像即刪、預設不裝鏡頭、長輩本人同意 | — | 全部 |

量測單位與合理範圍：走道寬 40–300 cm、門檻 0–30 cm、床邊到浴室門口 0.5–30 m、插座 0–10 個。

## Server 2｜store-erp（對應全國電子 ERP／進銷存）

| 類型 | 名稱 | 做什麼 | 參數 | 誰可以用 |
|---|---|---|---|---|
| Tool | `recommend_options` | 一區的三層做法（免費調整／全國電子安裝／簡易施工／改造工程）、誰施工、前置條件、依材質推薦的安裝方式 | household_id、zone（走道／浴室／浴室門） | 全部 |
| Tool | `check_stock` | 門市庫存（模擬） | sku、store_id | 全部 |
| Tool | `find_store_products` | **全國電子官網實際販售**、符合揪夜安的商品（貨號、品牌、適用方式、官網售價、查詢日期），並列出官網查不到的缺口 | category（夜間照明／感測與連網／浴室防滑／影像確認（選配）／全部） | 全部 |
| Tool | `estimate_quote` | 試算報價（新台幣元）：揪夜安設備＋燈條＋設定費＋改善項目；待估價項目不計入 | household_id、option_ids（同一區可複選，每個做法列一次）、care_plan（揪夜安／不加購） | 全部 |
| Resource | `policy://pricing` | 計價方式 | — | 全部 |
| Prompt | `family_explain` | 顧問向家人說明報價的範本 | household_id | 顧問 |

## Server 3｜service-crm（對應全國電子 CRM／派工系統）

| 類型 | 名稱 | 做什麼 | 參數 | 誰可以用 |
|---|---|---|---|---|
| Tool | `get_case_status` | 案件進度、已選做法、長輩同意紀錄、工單（唯讀查狀態） | household_id | 全部 |
| Tool | ★`submit_to_advisor` | 家人確認後一鍵送生活顧問；同一區可複選；重複送出不會建立第二筆 | household_id、option_ids | 只有家人 |
| Tool | ★`record_elder_consent` | 記錄長輩本人的決定 | case_id、decision（同意／不同意）、method（當面／電話／App 大字確認） | 只有顧問 |
| Tool | `find_available_staff` | AI 推薦派工：同門市、時段、技能、工單最少；工班 09:00 先施工、技師 14:00 後安裝；排除保單失效工班 | case_id、day（YYYY-MM-DD） | 只有顧問 |
| Tool | ★`assign_work_package` | 核准派工；沒有長輩同意、技能不符、保單失效、時段衝突都會拒絕 | case_id、day、tech_id、crew_ids | 只有顧問 |
| Tool | `get_night_events` | 夜間事件：正常起夜／長輩已回覆平安（第 1 次燈光語音或第 2 次家中電話回覆）／需通知家人（兩次都沒回應） | household_id、night | 全部 |
| Tool | ★`notify_family` | 依聯絡順序通知家人；只有長輩兩次詢問都沒回應才能送，同一事件不重複 | household_id、event_id、message（50 字內） | 顧問、總部 |
| Resource | `policy://care-rules` | 浴室停留 30 分鐘先燈光語音詢問、5 分鐘未回應再撥家中電話、兩次都沒回應才通知家人 | — | 全部 |
| Resource | `kb://ltc1966` | 長照 1966 補助轉介：長照需要等級第 2 級以上由顧問協助申請（不承諾金額） | — | 全部 |
| Prompt | `advisor_briefing` | 顧問接手摘要範本 | household_id | 顧問 |

## Host 端

| 名稱 | 做什麼 |
|---|---|
| `read_policy` | MCP 的 Resource 不是工具，LLM 讀不到；Host 把所有 Resource 包成一個唯讀工具 |

## 和草稿相比的調整

1. `submit_to_advisor` 從 store-erp 移到 service-crm：送出會建立案件，屬於 CRM。
2. 長輩同意用「同意／不同意」文字，不用 true／false：避免 LLM 把字串 "False" 傳成真值，也讓紀錄一看就懂。
3. 新增 Host 端的 `read_policy`（原因見上）。
4. 售後保養（家電檔案、預約保養）排到 v2。

## v1.1 修正（對照初階提案書）

1. 夜間關懷改成兩次詢問：先燈光語音，5 分鐘沒回應再撥家中電話，兩次都沒回應才通知家人（提案書 3.1「兩次沒回應才通知家人」）。
2. 同一區可以複選做法（與原型顧問端相同），Demo 改用提案書圖 3 與影片中的走道「感應夜燈＋止滑卡扣地板」。
3. 補助轉介寫明長照需要等級第 2 級以上，由顧問協助撥 1966（提案書 3.1）。

## v1.2 新增：全國電子實際商品

`find_store_products` 回傳的是 2026-10-31 在全國電子官網查到的真實商品，不是模擬資料；售價只供參考，揪夜安報價仍用 `estimate_quote` 的團隊推估組合價。官網查不到的揪夜安品項（門窗感測器、人體感測器、浴室緊急按鈕、人體感應夜燈、門檻提示燈條、斜坡墊、智慧插座）會列為缺口，不會假裝有賣。


## v1.3 新增（揪夜安補齊；三個 Server 共 22 個工具，加上 Host 的 read_policy）

| Server | 類型 | 名稱 | 做什麼 | 誰可以用 |
|---|---|---|---|---|
| home-assess | Tool | `get_ar_measures`（擴充） | 每個值附來源與信心度；`low_confidence` 不判斷；`needs_site_check` 需技師確認；材質附檢查結果 | 家人、顧問、總部、有工單的技師 |
| home-assess | Tool | `assess_risk`（擴充） | 燈號照規則；量測不可用的區域「尚未判斷」；分界附近標 `needs_site_check` | 同上 |
| home-assess | Tool | ★`record_measurement` | 家人補量或重量一個值（AR／參考卡照片要附信心度）；方案送出後不能改；技師實測的值不能覆蓋 | 只有家人 |
| home-assess | Tool | ★`report_site_difference` | 技師到府實測不同時回報差異（待顧問核准） | 只有手上有工單的技師 |
| home-assess | Tool | ★`approve_site_difference` | 核准後以技師實測值重算燈號，列出哪一區燈號變了 | 只有生活顧問 |
| store-erp | Tool | `recommend_options`（擴充） | 每個做法附長照給付項目對照（FA03、FA10、FA11） | 全部 |
| store-erp | Tool | `find_store_products`（擴充） | 多兩個類別：安裝與施工服務、保養與保固 | 全部 |
| store-erp | Tool | `get_scene_plan` | 場域方案內容；只開放揪夜安，其他場域只回「尚未開放」 | 全部 |
| service-crm | Tool | `get_care_events` | 晨起確認、感測器離線 | 家人、顧問、總部 |
| service-crm | Tool | ★`notify_family`（擴充） | 也適用白天關懷事件；感測器離線時說明是設備問題；家庭沒有聯絡人時拒絕並提醒補登 | 顧問、總部 |
| service-crm | Tool | `get_appliance_profile` | 家電檔案：保固到期日、下次保養日、對應保養服務與價格 | 家人、顧問、總部 |
| service-crm | Tool | `get_maintenance_due` | 所屬門市 N 天內要保養或保固到期的名單（只列名單，不發送） | 顧問、總部 |
| service-crm | Tool | ★`book_maintenance` | 一鍵預約保養，交給顧問排人；不重複建立 | 只有家人 |

量測檢查門檻（團隊設定，POC 實測後修正）：信心度 70%；門檻分界 0.5 cm、3 cm 前後 0.5 cm；走道分界 80 cm 前後 3 cm；材質信心度 80%。
信心度 70% 的定義：95% 誤差區間不超過分界容忍值，所以容忍帶外的值可以確定落在分界哪一側。
