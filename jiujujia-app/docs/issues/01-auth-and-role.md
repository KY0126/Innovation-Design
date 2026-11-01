# [共用] 登入、註冊與選擇身分

## User Story
身為 **陳小姐（家人）或林媽媽（長輩）**，
我想要 **用 Email 加密碼或 Google 帳號登入，並在第一次登入時選擇自己的身分**，
以便 **系統依身分顯示我能用的功能**。

## 領域
- [x] customer　- [ ] store（門市角色由管理者建立，不在本 issue 範圍）

## 驗收條件（Given-When-Then）
**正常情境**
- Given 我尚未註冊，When 我輸入 Email、6 碼以上密碼並按「註冊」，Then 系統建立帳號並帶我到「選擇身分」頁。
- Given 我在「選擇身分」頁，When 我選「家人」或「長輩」並送出，Then 系統儲存身分並帶我到首頁，首頁顯示我的名稱與身分。
- Given 我已有帳號，When 我用 Email 與密碼或 Google 登入，Then 直接進入首頁，不再詢問身分。
- Given 我已登入，When 我按「登出」，Then 回到登入頁，且無法再進入需登入的頁面。

**輸入邊界**
- Given 我在註冊頁，When Email 格式錯誤或密碼少於 6 碼，Then 顯示對應的錯誤訊息且不送出。
- Given 我在「選擇身分」頁，When 我嘗試送出「生活顧問」等門市身分，Then 系統拒絕（只開放家人、長輩自行註冊）。

**例外與錯誤處理**
- Given 該 Email 已註冊，When 我再次註冊，Then 顯示「此 Email 已註冊，請直接登入」。
- Given 密碼錯誤，When 我登入，Then 顯示「Email 或密碼不正確」，不透露是哪一項錯。
- Given 我未登入，When 我直接開啟需登入的網址，Then 被導回登入頁。

## 不在本 issue 範圍
- 忘記密碼、Email 驗證信、LINE 登入。
- 同一人用 Google 與 Email 兩種方式登入時合併帳號（另開 issue）。

## 相依
- 使用 `users/{uid}`（ARCHITECTURE.md §4）。
