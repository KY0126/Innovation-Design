// 揪居家導覽：右側說明面板＋畫面上的編號框（和 Demo 影片同一套呈現方式）
// 不加遮罩、不跳視窗；一個揪居家 App（家庭／生活顧問／技師）＋企業管理端（電腦版），換身分時真的登出再登入
(function () {
  const PAGE = /admin\.html/.test(location.pathname) ? 'adm' : /consultant\.html/.test(location.pathname) ? 'con' : 'app';
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
  const K = 'jjj_g_step', OFF = 'jjj_g_off';
  const END_NOW = PAGE === 'app' ? 'family' : PAGE === 'con' ? 'advisor' : 'admin';
  const ENDS = {
    family: { n: '揪居家 App', page: 'app', url: 'app.html' },
    tech: { n: '揪居家 App', page: 'app', url: 'app.html' },
    advisor: { n: '企業管理端（電腦版）', page: 'con', url: 'consultant.html' },
    advisorApp: { n: '揪居家 App', page: 'app', url: 'app.html' },
    admin: { n: '企業管理端（電腦版）', page: 'adm', url: 'admin.html' },
  };
  const PLACE = { app: '揪居家 App', con: '企業管理端（電腦版）', adm: '企業管理端（電腦版）' };
  const WHO = { 'chen@example.com': '陳小姐（三明治世代）', 'li@example.com': '李小姐（關懷中家庭）', 'advisor@example.com': '王小明（生活顧問）', 'tech@example.com': '吳技師（全國電子技師）', 'manager@example.com': '張經理（總部）' };
  const CH = ['先評估', '再改善', '後關心', '總部', '接下來'];
  const F = (o) => Object.assign({ end: 'family', as: 'chen@example.com' }, o);
  const A = (o) => Object.assign({ end: 'advisor', as: 'advisor@example.com' }, o);
  const T = (o) => Object.assign({ end: 'tech', as: 'tech@example.com' }, o);
  const P = (o) => Object.assign({ end: 'advisorApp', as: 'advisor@example.com' }, o);
  const L = (o) => Object.assign({ end: 'family', as: 'li@example.com' }, o);
  const M = (o) => Object.assign({ end: 'admin', as: 'manager@example.com' }, o);
  // items: [目標, 說明]；目標可用 CSS 選擇器，或「~文字」找含這段字的最小元素，「~文字@.class」再往外找到該 class
  const ALL = [
    F({ ch: 0, t: '首頁就有揪居家入口', nav: ['home'],
      items: [['.hg1', '功能格第一格就是<b>揪居家</b>，有事要處理時亮紅點'], ['[data-hb="0"]', '活動輪播第一張：<b>先做 5 分鐘居家診斷</b>']],
      why: '不改全國電子 App 的版型，只用既有的功能格與輪播。家人不必另外下載新 App，也不用先到門市。',
      flow: ['App｜家庭'], act: { click: '[data-hb="0"]', label: '幫我點 ②' } }),
    F({ ch: 0, mode: 'full', t: '由家人代填', nav: ['home', 'b1'],
      items: [['[data-a="loginChild"]', '<b>幫長輩填（我是家人）</b>：長輩不用操作手機'], ['~我是長輩本人', '長輩自己填時，自動切換<b>大字模式</b>']],
      why: '長輩多半不習慣操作手機，實際會打開 App 的是家人。兩種身分都保留，資料存在同一個家庭底下。',
      flow: ['App｜家庭'], act: { click: '[data-a="loginChild"]', label: '幫我點 ①' } }),
    F({ ch: 0, t: 'AR 掃描（場勘）', nav: ['home', 'ar'],
      items: [['#arBtn', '<b>開始掃描</b>：手機對著走廊掃一遍'], ['~手動輸入', '手機不支援 AR 時，改用<b>手動輸入</b>']],
      why: '家人不必請假回家拿量尺。原始影像只在分析時暫存，分析完就清除，只留下尺寸與材質。',
      flow: ['App｜家庭'], act: { click: '#arBtn', label: '幫我開始掃描', wait: 8800 } }),
    F({ ch: 0, t: '量尺寸、認材質',
      items: [['~床邊到浴室走道寬@.card', '自動量出<b>走道 92 cm、門檻 2 cm</b>與插座位置'], ['[data-mat="bath|ok"]', 'AI 判讀<b>浴室地板是磁磚</b>，家人按「✓ 對」才算數'], ['~帶入掃描結果', '三種材質都確認後，才能<b>帶入掃描結果</b>']],
      why: 'AI 只提出建議，最後由人確認，避免誤判一路傳到施工現場。材質會決定技師的安裝方式，例如鋁框門改用背膠。',
      flow: ['App｜家庭', '生活顧問（電腦版）・案件量測', 'App｜技師・安裝方式'], act: { fn: 'diag', label: '幫我確認材質並答完五題' } }),
    F({ ch: 0, t: '推薦：夜間動線照明', nav: ['home', 'b3'],
      items: [['~夜間動線照明', '依五個作息問題，推薦<b>夜間動線照明</b>'], ['#cmp_b3', '<b>安裝前後對比</b>：左右拖曳中間把手'], ['[data-go="optA"]', '看哪裡需要處理']],
      why: '先給一個最需要的建議，不一次塞滿商品；前後對比讓家人在家就看得到裝了之後的樣子。',
      flow: ['App｜家庭'], act: { click: '[data-go="optA"]', label: '幫我點 ③' } }),
    F({ ch: 0, mode: 'short', t: '全家場域方案：3D 與 2D', nav: ['home', 'm2', 'x24'],
      items: [['.zmap', '同一張林媽媽家的圖：<b>3D 看是哪個空間，2D 看設備位置</b>'], ['[data-zm]', '上方切換 3D 居家模型與 2D 平面圖'], ['~揪夜安@.card', '試點期只開放<b>揪夜安</b>，其他場域標擴展期']],
      why: '先讓家人看懂「是哪個空間」，再讓生活顧問與技師看清楚設備位置；需求寫在商品前面，家人知道為什麼買。',
      flow: ['App｜家庭', '生活顧問（電腦版）・方案圖面', 'App｜技師・施工圖'] }),
    F({ ch: 0, mode: 'short', t: '交給生活顧問：預約門市諮詢', nav: ['home', 'b4'],
      items: [['~選擇門市', '選門市與時段，<b>長輩本人到店確認</b>'], ['~你的生活顧問', '先認識<b>你的生活顧問</b>：認證與主打技'], ['~自動帶給生活顧問', 'AR 掃描與診斷結果<b>自動帶給顧問</b>，到店不用再講一次']],
      why: '家人只要面對一位生活顧問；報價、工班與安裝由門市整合，長輩本人同意才成交。',
      flow: ['App｜家庭', '生活顧問（電腦版）・新進案件', '企業管理端｜預約與派工'], last: '接下來換成李小姐（App｜家庭），看已經裝好揪夜安的家庭。' }),
    F({ ch: 0, mode: 'full', t: '看結果：先講結論', nav: ['home', 'b3', 'optA'],
      items: [['~個地方建議處理', '先講結論：<b>幾個地方</b>建議處理'], ['~居家安全地圖@.card', '六個空間用<b>紅黃綠燈</b>標出風險'], ['[data-v5go="hall"]', '走道：<b>紅燈</b>，偏暗又有門檻']],
      why: '燈號依《建築物無障礙設施設計規範》判斷，一次只看一個空間，家人不會被資訊淹沒。',
      flow: ['App｜家庭'], act: { click: '[data-v5go="hall"]', label: '幫我點 ③ 走道' } }),
    F({ ch: 0, mode: 'full', t: '選改善方式',
      items: [['~最快轉綠@.seg', '依需求排序：<b>最快轉綠、最省錢、不鑽孔</b>'], ['[data-v5opt="hall|h_part"]', '選<b>感應夜燈＋止滑卡扣地板</b>（簡易施工）']],
      why: '每個紅黃燈都附四類做法：免費調整、全國電子安裝、簡易施工、改造工程。價格是級距，正式報價由生活顧問確認。',
      flow: ['App｜家庭'], act: { click: '[data-v5opt="hall|h_part"]', label: '幫我選 ②' } }),
    F({ ch: 0, mode: 'full', t: '挑款式，先看鋪好的樣子',
      items: [['~選擇款式@.card', '三種地板<b>款式</b>，換款式燈號不變'], ['~現在', '實景<b>前後對比</b>：拖曳看鋪好的樣子'], ['[data-v5ok]', '<b>確定這個方式</b>']],
      why: '用自家走道的實景比對，比看型錄更容易下決定，也減少到府後才改款式。',
      flow: ['App｜家庭'], act: { click: '[data-v5ok]', label: '幫我點 ③' } }),
    F({ ch: 0, mode: 'full', t: '浴室：斜坡墊就能轉綠燈',
      items: [['[data-v5ok]', '浴室推薦<b>斜坡墊＋止滑地墊</b>，千元內、當天安裝']],
      why: '能用免費調整或小設備解決的，就不推大工程；確定後回到全屋總覽。',
      flow: ['App｜家庭'], act: { click: '[data-v5ok]', label: '幫我確定' } }),
    F({ ch: 0, mode: 'full', t: '交給生活顧問',
      items: [['[data-v5toC]', '全國電子與協力工班的項目，放在<b>同一張清單</b>']],
      why: '家人只要面對一位生活顧問，不必自己分別聯絡水電、工班與門市。',
      flow: ['App｜家庭'], act: { click: '[data-v5toC]', label: '幫我打開' } }),
    F({ ch: 0, mode: 'full', t: '請生活顧問報價', nav: ['home', 'b3', 'optA', 'optC'],
      items: [['~全屋改善前後@.card', '<b>全屋改善前後</b>：六個空間全部綠燈（預估）'], ['~已選的改善方式@.card', '已選的方式：<b>簡易施工＋全國電子安裝</b>'], ['[data-v5handoff]', '<b>請生活顧問確認並報價</b>']],
      why: '一張報價含設備與工程；送出後由生活顧問整合，長輩本人到門市同意才成交。',
      flow: ['App｜家庭', '生活顧問（電腦版）・新進案件', '企業管理端｜預約與派工'], act: { click: '[data-v5handoff]', label: '幫我送出 ③' } }),
    F({ ch: 0, mode: 'full', t: '儲存或分享給家人',
      items: [['[data-go="share"]', '成果可存入<b>長輩家</b>，或用 LINE 分享摘要']],
      why: '分享只含摘要，不含地址與作息；兄弟姊妹可以一起看、一起分攤。',
      flow: ['App｜家庭', 'LINE 家人群組'], last: '接下來到企業管理端（電腦版），看生活顧問怎麼接手這筆案件。' }),
    A({ ch: 0, t: '生活顧問（電腦版）｜今天', nav: { view: 'wb' },
      items: [['.prog', '<b>案件進度</b>一條看完，點任一階段就篩選下方清單'], ['.curcase', '左邊是選到的案件與<b>主要動作</b>'], ['.decide', '右邊是今天與<b>需要你決定</b>的差異核准']],
      why: '生活顧問登入後只看自己的工作：數字卡同時是導覽，認證縮成名字旁的徽章，側欄收成 4 項。',
      flow: ['App｜家庭', '生活顧問（電腦版）'] }),
    A({ ch: 0, t: '讀懂 AI 分析', nav: { view: 'case', hid: 3, tab: 1 },
      items: [['~林媽媽家@h2', '案件：<b>林媽媽家</b>（74 歲，一個人住）'], ['[data-tab="1"]', '先讀懂<b>燈號與理由</b>'], ['#view .panel', 'AI 判定不了的項目，列為<b>待現場確認</b>']],
      why: 'AI 分析是參考，不是正式鑑定。生活顧問先讀懂理由，才能向家人說清楚。',
      flow: ['App｜家庭・AR 量測', '生活顧問（電腦版）'] }),
    A({ ch: 0, t: '整合成一張報價', nav: { view: 'case', hid: 3, tab: 5 },
      items: [['~整合報價（編輯中）@.panel', '設備、安裝與<b>協力工班工程</b>合成一張'], ['~報價版本@.panel', '每次修改都留下<b>版本</b>']],
      why: '家電與工程不再各報各的價。待估價項目不套用示範價格；送出後保留版本，<b>最新一版就是正式版本</b>，長輩同意的是這一版。',
      flow: ['生活顧問（電腦版）', 'App｜家庭・專屬方案'], act: { click: '[data-q="send"]', label: '幫我送出正式版本' } }),
    A({ ch: 1, t: '工作包與施工順序', nav: { view: 'case', hid: 3, tab: 7 },
      items: [['~協力工班施工@.pkc', '<b>協力工班</b>先做需要動工的項目'], ['~關懷設備@.pkc', '<b>全國電子技師</b>再安裝設備'], ['~長輩逐區驗收@.pkc', '最後由<b>長輩逐區驗收</b>']],
      why: '先工程後設備，前一步沒完成，後一步顯示等待，避免剛裝好的設備被施工拆掉。',
      flow: ['生活顧問（電腦版）', 'App｜技師・工作包', '企業管理端｜工單'], last: '接下來回到揪居家 App，王小明在門市把手機轉給長輩，確認正式版本。' }),
    P({ ch: 1, t: '生活顧問手機版｜下一個行程', nav: ['home'],
      items: [['.nexttrip', '最上方是<b>下一個行程</b>：AR 量到的尺寸與燈號'], ['[data-a="aHandElder"]', '到府時<b>把手機轉給長輩</b>，大字確認']],
      why: '手機版只用在問診與長輩確認；報價、派工、差異核准都在門市電腦，畫面不會擠在一起。',
      flow: ['App｜生活顧問', '生活顧問（電腦版）'] }),
    P({ ch: 1, t: '把手機轉給長輩：同意正式版本', pre: async J => { await J.openBoard(3); J.tourGo(['a1', 'apm', 'aec']); },
      items: [['~報價版本@.card', '顯示電腦版送出的<b>正式版本</b>，長輩同意的是這一版'], ['~會裝這些@.card', '大字列出<b>會裝哪些</b>，長輩看得懂'], ['[data-a="elderOk"]', '長輩本人按<b>同意這一版</b>才成交']],
      why: '生活顧問在門市把手機轉給長輩，用大字說明。手機版只產出方案草稿，長輩同意的是電腦版整合好的正式報價（有版本號），避免各說各話。',
      flow: ['App｜生活顧問', 'App｜家庭・專屬方案', '企業管理端｜預約與派工'], last: '接下來換成吳技師，看他怎麼照圖安裝。' }),
    T({ ch: 1, t: '技師｜今日工單', nav: ['t1'],
      items: [['.card.focus', '今天的工單聚焦，<b>只看得到自己的</b>'], ['[data-snav="thist"]', '其他日期或已完成的工單在「<b>工單紀錄</b>」'], ['~技師只看得到工單所需資訊', '只看得到<b>工單所需資訊</b>，完整地址出發當天才顯示']],
      why: '技師只拿到完成工作需要的資訊；住址與作息不會出現在其他人的畫面。',
      flow: ['企業管理端｜派工', 'App｜技師'], act: { click: '.card.focus', label: '幫我打開工單 ①' } }),
    T({ ch: 1, t: '現在這一步', 
      items: [['.tnow', '最上方固定<b>現在這一步</b>，按「完成這一步」就往下'], ['.tnow [data-a="tDiffNow"]', '現場不符，直接<b>回報差異</b>，不用往下找']],
      why: '技師在現場只要看最上面一張卡；完成一步就換下一步，差異回報也不用滑到清單最下面。',
      flow: ['App｜技師'] }),
    T({ ch: 1, t: '施工圖只標號碼',
      items: [['.tmapc', '施工圖只標<b>順序號碼</b>，顏色代表狀態'], ['[data-tgrp="玄關"]', '依區域分組，點開就看到該區工作']],
      why: '圖上不放文字，現場一眼就知道下一步；桃紅待施工、深莓已完成、橘色差異、灰色是其他人員。',
      flow: ['App｜技師'], act: { click: '[data-tgrp="玄關"]', label: '幫我展開「玄關」②' } }),
    T({ ch: 1, t: 'AI 帶出安裝方式，現場不符就回報', pre: J => { J.S.topen = '玄關'; J.S.tsel = 'pin:D2'; J.render(); },
      items: [['.trow.sel', '大門是鋁框：AI 帶出<b>背膠固定、不鑽孔</b>'], ['[data-a="tDiffGo"]', '現場不符就<b>回報差異</b>']],
      why: '家人在評估時選定的安裝方式（例如鋁框門用背膠、不鑽孔），直接變成技師的施工依據。差異回報會出現在生活顧問（電腦版）「今天」，由生活顧問核准並更新圖面版本；手機版只提醒。',
      flow: ['App｜技師', '生活顧問（電腦版）・待審差異'], act: { fn: 'diff', label: '幫我回報一則差異' } }),
    T({ ch: 1, t: '全部完成，請長輩驗收',
      items: [['.sum', '做完按「完成安裝」，工單變成<b>待驗收</b>']],
      why: '技師不能自己結案，要由長輩確認才算完成。',
      flow: ['App｜技師', 'App｜家庭・服務進度'], act: { fn: 'finish', label: '幫我做完其餘項目' } }),
    T({ ch: 1, t: '長輩逐區驗收', pre: J => { J.S.acc = {}; J.S.accNote = ''; J.go('tacc'); },
      items: [['.tacc', '大字逐區確認：夜燈會不會亮、按鈕按不按得到']],
      why: '全部沒問題才驗收完成，摘要同步到家人的 App；有問題就退回，相關項目改回待施工。',
      flow: ['App｜技師', 'App｜家庭・服務進度'], act: { fn: 'accept', label: '幫長輩驗收' }, last: '接下來換成李小姐（App｜家庭），看已經在用揪夜安的家庭。' }),
    L({ ch: 1, mode: 'short', t: '安裝進度與驗收紀錄', nav: ['home', 'm2', 'ch', 'ip'], home: 'parents',
      items: [['#view', '協力工班、技師安裝、長輩逐區驗收，<b>每一步都有時間與人</b>']],
      why: '家人不在現場也知道裝到哪裡；驗收由長輩本人確認，紀錄同步給生活顧問。',
      flow: ['App｜技師', 'App｜家庭', '生活顧問（電腦版）'] }),
    L({ ch: 2, t: '後關心｜揪居家', nav: ['home', 'm2'], home: 'parents',
      items: [['.today-sum', '打開就知道<b>長輩家今天一切正常</b>'], ['~要處理的事@.card', '夜燈裝滿一年<b>主動提醒</b>'], ['[data-rbook]', '<b>一鍵預約</b>就送出維護工單草稿']],
      why: '有人顧著，卻不打擾：平常只顯示一句狀態，有事才提醒。',
      flow: ['App｜家庭', '企業管理端｜預約與派工'], act: { click: '[data-rbook]', label: '幫我一鍵預約 ③' } }),
    L({ ch: 2, mode: 'full', t: '異常先問長輩本人', nav: ['home', 'm2', 'gl'], home: 'parents',
      items: [['~異常時的通知順序@.card', '<b>先問長輩</b>，沒回應才依序通知家人'], ['~夜間浴室停留較久@.card', '每一次異常都留下<b>紀錄</b>']],
      why: '臥室到浴室不裝鏡頭，只用感測器。先問本人，尊重長輩，也減少誤報。',
      flow: ['App｜家庭', '企業管理端｜關懷紀錄'] }),
    L({ ch: 2, mode: 'full', t: '揪心願：大家的心願', nav: ['home', 'm2', 'wall'], home: 'parents',
      items: [['~可調光感應夜燈@.card', '同場域家庭的心願，整理成<b>主題</b>'], ['~我也需要', '別家也需要，就按<b>我也需要</b>']],
      why: '達到門檻後由總部評估、再開放預購，先有訂單才進貨，門市不必壓庫存。',
      flow: ['App｜家庭', '企業管理端｜揪心願彙整'], last: '最後到企業管理端（電腦版），看總部怎麼看這些資料。' }),
    M({ ch: 3, t: '企業管理端｜即時總覽', nav: { tab: 'live' },
      items: [['#nav', '側欄 7 項：即時總覽、派工與工單、服務地圖、家庭、揪心願、人員與夥伴、試點分析'], ['#view', '總部與門市主管看到的是<b>同一份即時資料</b>']],
      why: '揪居家 App 與企業管理端資料即時串接；總部不用等月報，就能看到每一戶走到哪一步。',
      flow: ['App｜家庭', '生活顧問（電腦版）', 'App｜技師', '企業管理端'] }),
    M({ ch: 3, t: '預約與派工', nav: { tab: 'bk' },
      items: [['~門市諮詢預約@.panel', '剛才的報價請求與一鍵預約，出現在這裡'], ['~到府工單@.panel', '合併到府：同一天排好技師']],
      why: '一次到府就把夜燈與關懷設備裝好，減少技師來回。',
      flow: ['App｜家庭', '企業管理端', 'App｜技師'], act: { click: '#nav [data-tab="bk"]', label: '打開預約與派工' } }),
    M({ ch: 3, t: '工單', nav: { tab: 'wo' },
      items: [['#view', '每張工單都有<b>工作包、檢核清單、照片與狀態紀錄</b>']],
      why: '技師的差異回報、生活顧問的核准都留在工單裡，事後查得到。',
      flow: ['App｜技師', '企業管理端'] }),
    M({ ch: 3, t: '揪心願', nav: { tab: 'wl' },
      items: [['#nav [data-tab="wl"]', '家庭設計的作品與心願集中在<b>揪心願</b>，上方分頁依工作順序排，紅字是待辦數'], ['#view', '共鳴中的作品看離 100 戶還差多少；達門檻才進審查看板，舊的文字心願在待審查，回覆後邀請拼成作品']],
      why: '先看需求再下單：心願達到門檻才開預購，門市不必壓庫存。',
      flow: ['App｜家庭', '企業管理端'] }),
    M({ ch: 3, mode: 'full', t: '協力工班', nav: { tab: 'partner' },
      items: [['~協力工班名單@.panel', '<b>協力工班</b>：每類每店一家，看保險與保固'], ['~協力工班工單@.panel', '協力工班的工單與進度']],
      why: '會動到房子的工程交給簽約的協力工班，全國電子技師專心安裝設備。',
      flow: ['生活顧問（電腦版）', '企業管理端'] }),
    M({ ch: 3, t: '服務地圖', nav: { tab: 'ops' },
      items: [['#mapView', '全台 → 縣市 → 門市街區，三層往下看']],
      why: '總部依導入階段決定擴張順序，每一戶的狀態都看得到。',
      flow: ['企業管理端'] }),
    M({ ch: 3, t: '試點分析', nav: { tab: 'kpi' },
      items: [['#view', '續訂率、轉換率、技師負荷、誤報率、驗收一次通過率，<b>達標才擴展</b>']],
      why: '試點是為了驗證假設，不是為了衝量；沒達標就回到前面的步驟調整。',
      flow: ['企業管理端'] }),
    M({ ch: 4, t: '營運階段開關', nav: { tab: 'phase' },
      items: [['[data-ph="擴展期"]', '同一套系統切換<b>試點期／擴展期／延伸期</b>（示範用）'], ['~各階段開放的功能@.panel', '每個階段開放哪些方案與服務；◆二、◆三 達標才切換']],
      why: '試點只賣揪夜安；決策點過關後，總部切到下一階段，家庭端與生活顧問端同時開放新方案。',
      flow: ['企業管理端', '揪居家 App', '生活顧問'] }),
    F({ ch: 4, mode: 'full', t: '全部服務：擴展期、延伸期都在這裡', nav: ['home', 'x0'],
      items: [['.svc[data-go="x24"]', '<b>擴展期</b>：其他場域、揪全家、換新與以租代買、異業加購'], ['.svc[data-go="x33"]', '<b>延伸期</b>：新家與老宅翻修、育兒與寵物'], ['.gi[data-go="ords"]', '加購、訂閱都在<b>全部訂單</b>']],
      why: '還沒開放的功能可以先看內容、先登記；開放時優先通知，不必再找入口。',
      flow: ['App｜家庭'] }),
    F({ ch: 4, mode: 'full', t: '全家場域方案', nav: ['home', 'x0', 'x24'],
      items: [['[data-x24="food"]', '揪食光、揪團聚、揪清爽依風險加價'], ['~已訂閱@.card', '已訂閱的揪夜安沿用 AR 掃描與家電檔案']],
      why: '四個場域都選時，畫面會建議改用揪全家 699 元，每月省 200 元。導覽到這裡結束，可以自由操作。',
      flow: ['App｜家庭'] }),
  ];
  // 預設「分身分導覽」：登入哪個身分就跑哪一套（每套 6～8 步）；「完整故事」跨身分一路走完
  const FULL = LS.get('jjj_g_full') === '1';
  const STEPS = ALL.filter(s => FULL ? s.mode !== 'short' : s.mode !== 'full');
  const GRP = s => s.end === 'family' ? 'family' : s.end === 'tech' ? 'tech' : s.end === 'admin' ? 'admin' : 'advisor';
  const GN = { family: '家庭', advisor: '生活顧問', tech: '技師', admin: '總部' };
  const track = i => { const g = GRP(STEPS[i]); const L = STEPS.map((x, k) => [x, k]).filter(([x]) => GRP(x) === g).map(([, k]) => k); return { g, L, pos: L.indexOf(i) + 1 }; };
  const num = i => FULL ? i + 1 : track(i).pos;
  const nextIdx = i => { if (FULL) return i + 1; const t = track(i); return t.pos < t.L.length ? t.L[t.pos] : -1; };
  const prevIdx = i => { if (FULL) return i - 1; const t = track(i); return t.pos > 1 ? t.L[t.pos - 2] : -1; };
  const roleEnd = () => { if (PAGE !== 'app') return PAGE === 'con' ? 'advisor' : 'admin'; const e = window.JJJ && window.JJJ.S && window.JJJ.S.me && window.JJJ.S.me.email; return e === 'tech@example.com' ? 'tech' : e === 'advisor@example.com' ? 'advisorApp' : 'family'; };
  // ---------- 樣式 ----------
  const css = document.createElement('style');
  css.textContent = `
#jg{position:fixed;z-index:9995;background:#fff;color:#3D3A40;border-radius:20px;box-shadow:0 14px 36px rgba(61,58,64,.18);font:15px/1.6 "Noto Sans TC","PingFang TC",system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden}
#jg[hidden]{display:none}
#jg .hd{display:flex;justify-content:space-between;align-items:center;padding:16px 20px 0;font-size:13.5px;color:#8C8389}#jg .hd b{color:#D4003C}
#jg .hd button{border:0;background:none;color:#8C8389;cursor:pointer;font:inherit;padding:4px 6px;border-radius:8px}#jg .hd button:hover{background:#F6F4F2}
#jg .bd{padding:6px 20px 16px;overflow:auto;flex:1}
#jg .tl{display:flex;margin:10px 0 12px}#jg .tl div{flex:1;text-align:center;font-size:12.5px;font-weight:700;color:#A8A5A0;position:relative}
#jg .tl i{display:block;width:14px;height:14px;border-radius:50%;background:#C9C7C3;margin:0 auto 5px;position:relative;z-index:1}
#jg .tl div:not(:last-child)::after{content:"";position:absolute;top:5px;left:50%;right:-50%;height:4px;background:#DDDBD7}
#jg .tl .dn{color:#A3002E}#jg .tl .dn i,#jg .tl .dn::after{background:#D4003C!important}
#jg .tl .cu{color:#D4003C}#jg .tl .cu i{background:#D4003C;box-shadow:0 0 0 5px #F2C94C;width:18px;height:18px;margin-top:-2px}
#jg .who{display:inline-block;background:#FAE0E8;color:#A3002E;font-weight:900;font-size:13px;border-radius:8px;padding:2px 10px}
#jg h2{margin:6px 0 8px;font-size:22px;line-height:1.35;font-weight:900}
#jg .sec{font-size:12.5px;color:#8C8389;font-weight:700;margin:10px 0 4px}
#jg .li{display:flex;gap:10px;margin:6px 0;font-size:15px}#jg .li i{flex:none;width:24px;height:24px;border-radius:50%;background:#D4003C;color:#fff;font-style:normal;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;margin-top:1px}#jg .li b{color:#D4003C}
#jg .li.miss{opacity:.55}
#jg .why{background:#F6F4F2;border-radius:12px;padding:9px 12px;font-size:14px}
#jg .flow{display:flex;flex-wrap:wrap;gap:5px;align-items:center;font-size:13px}#jg .flow span{border:1.5px solid #E3D3D9;border-radius:14px;padding:2px 9px;font-weight:700}#jg .flow span.me{background:#D4003C;border-color:#D4003C;color:#fff}#jg .flow em{font-style:normal;color:#D4003C;font-weight:900}
#jg .msg{margin-top:10px;background:#FFF6D6;border-radius:10px;padding:8px 12px;font-size:14px}
#jg .ft{display:flex;gap:8px;padding:12px 20px 16px;border-top:1px solid #EEE7E4}
#jg .ft button{height:40px;border-radius:10px;border:1.5px solid #DDD5D0;background:#fff;font:inherit;font-size:14.5px;font-weight:700;padding:0 12px;cursor:pointer;color:#3D3A40}
#jg .ft button.p{flex:1;background:#D4003C;border-color:#D4003C;color:#fff}
#jg .ft button:disabled{opacity:.5;cursor:default}
#jg .toc{margin-top:12px;border-top:1px solid #EEE7E4;padding-top:6px;font-size:13px;color:#6F6670}
#jg .toc summary{cursor:pointer;font-weight:700;color:#A3002E;padding:4px 0}
#jg .toc button{display:block;width:100%;text-align:left;border:0;background:none;font:inherit;padding:3px 4px;border-radius:6px;cursor:pointer;color:#6F6670}
#jg .toc button:hover{background:#F6F4F2}#jg .toc button.d{color:#A3002E}#jg .toc button.c{color:#D4003C;font-weight:900}
#jg .toc .e{font-size:12px;color:#A8A1A5;margin:6px 0 2px;font-weight:700}
#jg.sheet{left:8px!important;right:8px!important;bottom:8px!important;top:auto!important;width:auto!important;max-height:46vh;border-radius:16px}
body.jgSheet{padding-bottom:48vh!important}body.jgSheet #view .scroll{padding-bottom:48vh!important}
#jg.sheet.min .bd .rest,#jg.sheet.min .toc{display:none}
#jg.sheet .grab{display:block;width:40px;height:4px;border-radius:2px;background:#D5CDC9;margin:8px auto 0}
#jg .grab{display:none}
.jgb{position:fixed;z-index:9994;border:3px solid #D4003C;border-radius:10px;box-shadow:0 0 0 3px rgba(255,255,255,.8);pointer-events:none;display:none}
.jgb i{position:absolute;left:-15px;top:-15px;width:26px;height:26px;border-radius:50%;background:#D4003C;color:#fff;font:900 14px/26px "Noto Sans TC",sans-serif;text-align:center;font-style:normal;box-shadow:0 0 0 3px #fff}
/* 右下角浮動元件（開啟導覽、瀏覽器展示版）約 110px 高：各頁捲動區底部留白，最後的按鈕才不會被蓋住 */
.scroll{padding-bottom:76px!important}
body>.ft,#app .ft,.ft{padding-bottom:70px!important}
/* 底部有固定操作列（技師完工列）時，浮動元件改放到上方；AR 掃描為全螢幕畫面，掃描時先隱藏 */
body:has(.sum) #jgOpen{bottom:auto;top:66px}
body:has(.sum) #webDemo{bottom:86px!important;top:auto}
body:has(.arsheet) #jgOpen,body:has(.arsheet) #webDemo{display:none!important}
#webDemo{flex-direction:column!important;align-items:flex-end!important;gap:6px!important;padding:0!important;background:none!important;border-radius:0!important}
#webDemo .wdm{font:700 13px "Noto Sans TC",system-ui,sans-serif;color:#fff;background:rgba(43,43,41,.86);border:0;border-radius:18px;padding:7px 12px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.18)}
#webDemo .wdm::after{content:" ▴";font-size:11px}#webDemo.open .wdm::after{content:" ▾"}
#webDemo .wdx{display:none}#webDemo.open .wdx{display:flex;flex-direction:column;gap:6px;background:rgba(43,43,41,.92);border-radius:12px;padding:8px;min-width:132px}
#webDemo .wdx small{color:#DDD;font-size:11px;text-align:center}
#webDemo .wdx button{font:700 13px "Noto Sans TC",system-ui,sans-serif!important;padding:7px 10px!important;border-radius:10px!important}
#webDemo #jgOpen{position:static!important;box-shadow:none;right:auto;bottom:auto!important;top:auto!important}
#jgOpen{position:fixed;right:16px;bottom:16px;z-index:9993;background:#D4003C;color:#fff;border:0;border-radius:22px;padding:10px 16px;font:700 14px "Noto Sans TC",system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.2);cursor:pointer}
body.jgDock{margin-right:var(--jgm,420px)!important}body.jgDock #cGate,body.jgDock #gate{right:var(--jgm,420px)}
#jg .jgn{border:2px solid #D4003C;background:#FAE0E8;border-radius:12px;padding:8px 12px;margin:2px 0 10px;color:#A3002E;font-weight:700;line-height:1.5}
#jg .jgn small{display:block;font-weight:400;color:#6F6670;font-size:13px}
#jg .jgn.big{font-size:16px}
#jg .jbt{display:block;width:100%;text-align:center;border-radius:10px;padding:9px;font:inherit;font-weight:700;margin:8px 0;cursor:pointer;border:1.5px solid #DDD5D0;background:#fff;color:#3D3A40}
#jg .jbt.p{background:#D4003C;border-color:#D4003C;color:#fff}
#jg.nc .bd>.who,#jg.nc .bd>h2,#jg.nc .s1,#jg.nc .rest,#jg.nc .ft [data-t=act]{display:none}
#jg.nc .li,#jg.nd .li{opacity:.45}
#jg.nd .ft [data-t=prev]{border:2px solid #D4003C;color:#D4003C}
`;
  document.head.appendChild(css);
  // ---------- 小工具 ----------
  const api = async (p, o = {}) => { const r = await fetch('/api' + p, { method: o.method || 'GET', headers: { 'Content-Type': 'application/json', 'X-JJJ': '1' }, body: o.body ? JSON.stringify(o.body) : undefined }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || '操作失敗'); return d; };
  let me = null;
  async function who() { try { me = (await api('/me')).user; } catch (e) { me = null; } return me; }
  function find(spec) {
    if (!spec) return null;
    if (spec[0] !== '~') { const els = [...document.querySelectorAll(spec)].filter(e => e.getClientRects().length); return els[0] || null; }
    let [txt, up] = spec.slice(1).split('@'); let best = null, ba = 1e12;
    const root = PAGE === 'app' ? (document.getElementById('view') || document.body) : document.body;
    for (const e of root.querySelectorAll('*')) {
      if (e.closest('#jg')) continue; const t = e.innerText || ''; if (!t.includes(txt)) continue;
      const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; const a = r.width * r.height; if (a < ba) { ba = a; best = e; }
    }
    if (best && up) best = best.closest(up) || best;
    return best;
  }
  const clipRect = () => { let c = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }; if (PAGE === 'app') { const v = document.getElementById('view'); if (v) { const r = v.getBoundingClientRect(); c = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; } } if (panel && !panel.hidden && panel.classList.contains('sheet')) c.bottom = Math.min(c.bottom, panel.getBoundingClientRect().top); return c; };
  // ---------- 狀態 ----------
  let panel, boxes = [], cur = -1, busy = false, raf = 0, mini = innerWidth < 760, showTok = 0, moving = false, mode = '', flash = null, lastKey = null, folded = false, followT = 0, autoT = 0, pendingA = false;
  // 換步驟或執行動作時鎖住面板按鈕，避免連點跳步、兩次更新互相覆蓋
  const lock = on => { moving = on; if (panel) panel.querySelectorAll('.ft button').forEach(b => { b.disabled = on; }); };
  const stepI = () => { const v = LS.get(K); return v == null ? null : +v; };
  const firstOf = (end) => STEPS.findIndex(s => s.end === end);
  function endOf(i) { return STEPS[i] && STEPS[i].end; }
  function ready(s) { return s && ENDS[s.end].page === PAGE && me && me.email === s.as; }
  // ---------- 面板 ----------
  function ensure() {
    if (panel) return;
    panel = document.createElement('div'); panel.id = 'jg'; panel.setAttribute('role', 'complementary'); panel.setAttribute('aria-label', '導覽說明'); document.body.appendChild(panel);
    for (let k = 0; k < 3; k++) { const b = document.createElement('div'); b.className = 'jgb'; b.innerHTML = `<i>${k + 1}</i>`; document.body.appendChild(b); boxes.push(b); }
    panel.addEventListener('click', onClick);
  }
  function stop() { LS.del(K); LS.set(OFF, '1'); if (panel) panel.hidden = true; boxes.forEach(b => b.style.display = 'none'); document.body.classList.remove('jgDock', 'jgSheet'); openBtn(true); relayout(); }
  // 「開啟導覽」與「重設資料」合成一顆「導覽與展示」按鈕，點開再選（不蓋住頁面按鈕與底部選單）
  function mergeDemo() { const d = document.getElementById('webDemo'); if (!d || getComputedStyle(d).display === 'none') return null; if (d._m) return d; d._m = 1;
    const box = document.createElement('div'); box.className = 'wdx'; const cap = document.createElement('small'); cap.textContent = '瀏覽器展示版'; box.appendChild(cap);
    [...d.childNodes].forEach(k => { if (k.nodeType === 1) box.appendChild(k); else k.remove(); });
    const m = document.createElement('button'); m.type = 'button'; m.className = 'wdm'; m.textContent = '導覽與展示'; m.setAttribute('aria-expanded', 'false');
    m.onclick = () => { const o = d.classList.toggle('open'); m.setAttribute('aria-expanded', String(o)); };
    d.appendChild(box); d.appendChild(m); return d; }
  function openBtn(show) { let b = document.getElementById('jgOpen'); if (!show) { if (b) b.remove(); return; } const d = mergeDemo(); if (!b) { b = document.createElement('button'); b.id = 'jgOpen'; b.textContent = '開啟導覽'; b.onclick = () => { if (d) { d.classList.remove('open'); const m = d.querySelector('.wdm'); if (m) m.setAttribute('aria-expanded', 'false'); } if (stepI() != null && !LS.get(OFF)) { folded = false; openBtn(false); show(); } else start(); }; if (d) { const x = d.querySelector('.wdx'); x.insertBefore(b, x.children[1] || null); } else document.body.appendChild(b); } b.textContent = stepI() != null && !LS.get(OFF) ? '繼續導覽' : '開啟導覽'; if (!d) b.style.bottom = demoLift(16) + 'px'; }
  function relayout() { if (window.JJJFRAME && window.JJJFRAME.lay) window.JJJFRAME.lay(); place(); }
  function start(i) { LS.del(OFF); LS.set(K, String(i == null ? Math.max(0, firstOf(roleEnd())) : i)); openBtn(false); show(); }
  function tlHtml(ch) { return `<div class="tl">${CH.map((c, k) => `<div class="${k < ch ? 'dn' : k === ch ? 'cu' : ''}"><i></i>${c}</div>`).join('')}</div>`; }
  function tocHtml(i) {
    let h = '', lastEnd = '';
    STEPS.forEach((s, k) => { if (!FULL && GRP(s) !== GRP(STEPS[i])) return; if (s.end + s.as !== lastEnd) { h += `<div class="e">${ENDS[s.end].n}｜${WHO[s.as]}</div>`; lastEnd = s.end + s.as; }
      h += `<button data-go="${k}" class="${k < i ? 'd' : k === i ? 'c' : ''}">${k < i ? '✓' : k === i ? '●' : '○'} ${num(k)}　${s.t}</button>`; });
    return `<details class="toc"><summary>目錄（${FULL ? STEPS.length + ' 步，跨身分' : GN[GRP(STEPS[i])] + ' ' + track(i).L.length + ' 步'}）</summary>${h}<button data-t="mode" class="jbt">${FULL ? '改看分身分導覽（每個身分 6～8 步）' : '看完整故事（跨身分一路走完）'}</button></details>`;
  }
  async function show() {
    const i = stepI(); if (i == null || LS.get(OFF)) return; const s = STEPS[i]; if (!s) { stop(); return; }
    const tok = ++showTok; ensure(); panel.hidden = false; cur = i; lock(true);
    try { await who(); } catch (e) {}
    if (tok !== showTok) return;
    const head = `<div class="grab"></div><div class="hd"><span><b>${FULL ? `導覽 ${i + 1}／${STEPS.length}` : `導覽 ${track(i).pos}／${track(i).L.length}`}</b>｜${FULL ? ENDS[s.end].n : GN[GRP(s)] + '｜' + ENDS[s.end].n}</span><span><button data-t="min" aria-label="收合">${mini ? '展開' : '收合'}</button><button data-t="stop" aria-label="關閉導覽">✕</button></span></div>`;
    let body = '', foot = '';
    const onPage = ENDS[s.end].page === PAGE;
    mode = '';
    if (!onPage) {
      body = `${tlHtml(s.ch)}<span class="who">${ENDS[s.end].n}｜${WHO[s.as]}</span><h2>下一段在${ENDS[s.end].n}</h2><div class="why">導覽會先登出，帶你到<b>${PLACE[ENDS[s.end].page]}</b>的登入頁，再用示範帳號登入。</div>`;
      foot = `${i && (FULL || track(i).pos > 1) ? '<button data-t="prev">上一步</button>' : ''}<button class="p" data-t="goend">前往${ENDS[s.end].n}</button>`;
      setBoxes([]);
    } else if (!(me && me.email === s.as)) {
      const demoSel = `[data-demo="${s.as}"]`;
      if (me && PAGE === 'app') {
        body = `${tlHtml(s.ch)}<span class="who">${ENDS[s.end].n}｜${WHO[s.as]}</span><h2>下一段換成${WHO[s.as]}</h2><div class="why">同一個揪居家 App，登入後依帳號身分進到各自的首頁。導覽會幫你<b>登出再用示範帳號登入</b>，不用換網頁。</div>`;
        foot = `${i && (FULL || track(i).pos > 1) ? '<button data-t="prev">上一步</button>' : ''}<button class="p" data-t="login">幫我換帳號</button>`;
        s._items = []; setBoxes([]);
      } else {
        const L1 = PAGE === 'app' ? '這是<b>揪居家 App</b>的登入頁：家庭、生活顧問、技師都從這裡登入' : PAGE === 'con' ? '這是<b>企業管理端（電腦版）</b>的生活顧問登入頁，在門市電腦整合報價、排工作包' : '這是<b>企業管理端（電腦版）</b>的登入頁，總部與門市主管使用';
        const W1 = PAGE === 'app' ? '一個 App 依帳號身分分流；總部帳號會提示改用企業管理端（電腦版）。' : '手機用揪居家 App，電腦用企業管理端；帳號放錯入口會提示改用哪一邊，資料即時串接。';
        body = `${tlHtml(s.ch)}<span class="who">${ENDS[s.end].n}｜${WHO[s.as]}</span><h2>${PLACE[PAGE]}登入</h2><div class="sec">看畫面上的編號</div><div class="li"><i>1</i><span>${L1}</span></div><div class="li"><i>2</i><span>示範帳號<b>一鍵登入｜${WHO[s.as]}</b></span></div><div class="sec">為什麼這樣設計</div><div class="why">${W1}</div>`;
        foot = `${i && (FULL || track(i).pos > 1) ? '<button data-t="prev">上一步</button>' : ''}<button class="p" data-t="login">幫我登入 ②</button>`;
        s._items = [[PAGE === 'app' ? '#loginForm' : PAGE === 'con' ? '#cLogin' : '#gForm'], [demoSel]];
        setBoxes(s._items);
      }
    } else {
      const items = s.items.map((it, k) => `<div class="li" data-k="${k}"><i>${k + 1}</i><span>${it[1]}</span></div>`).join('');
      const mine = { family: 'App｜家庭', tech: 'App｜技師', advisor: '生活顧問（電腦版）', advisorApp: 'App｜生活顧問', admin: '企業管理端' }[s.end];
      const flow = s.flow.map((f, k) => `<span class="${s.flow.length === 1 || f.startsWith(mine) ? 'me' : ''}">${f}</span>`).join('<em>→</em>');
      const fl = flash; flash = null;
      body = `${tlHtml(s.ch)}${fl ? `<div class="jgn">${fl.t}${fl.sub ? `<small>${fl.sub}</small>` : ''}</div>` : ''}<span class="who">${ENDS[s.end].n}｜${WHO[s.as]}</span><h2>${s.t}</h2><div class="sec s1">看畫面上的編號</div>${items}<div class="rest"><div class="sec">為什麼這樣設計</div><div class="why">${s.why}</div><div class="sec">這筆資料會送到</div><div class="flow">${flow}</div>${s.last ? `<div class="msg">${s.last}</div>` : ''}${tocHtml(i)}</div>`;
      const nxt = STEPS[nextIdx(i)];
      const nextLabel = !nxt || (!FULL && GRP(nxt) !== GRP(s)) ? `完成${FULL ? '' : GN[GRP(s)]}導覽` : (nxt.end !== s.end || nxt.as !== s.as) ? (ENDS[nxt.end].page === ENDS[s.end].page ? `下一步：換成${WHO[nxt.as].split('（')[0]}` : `下一步：到${ENDS[nxt.end].n}`) : '下一步';
      foot = `${i && (FULL || track(i).pos > 1) ? '<button data-t="prev">上一步</button>' : ''}${s.act && !s._done ? `<button class="p" data-t="act">${s.act.label}</button>` : ''}<button ${s.act && !s._done ? '' : 'class="p"'} data-t="next">${nextLabel}</button>`;
      s._items = s.items; setBoxes(s.items);
      if (s.nav && !s._navved) { s._navved = true; await doNav(s); }
      if (s.pre && !s._pre && PAGE === 'app' && window.JJJ) { s._pre = true; try { await s.pre(window.JJJ); } catch (e) {} await wait(500); }
      if (tok !== showTok) return;
      mode = 'step'; s._where = where(); lastKey = screenKey();
    }
    panel.classList.remove('nc', 'nd');
    panel.innerHTML = head + `<div class="bd">${body}</div><div class="ft">${foot}</div>`; moving = false;
    panel.classList.toggle('min', mini);
    relayout(); setTimeout(() => scrollFirst(), 200);
  }
  // 「瀏覽器展示版」標籤固定在右下角：導覽面板與「開啟導覽」按鈕要讓出它的高度，避免互相遮擋
  // 手機版 App 底部有選單列：展示版標籤放在選單列上方，不蓋住「會員中心」等按鈕
  function placeDemo() {
    const d = document.getElementById('webDemo'); if (!d) return;
    const v = PAGE === 'app' && document.getElementById('view'), vb = v && v.getBoundingClientRect().bottom;
    const nv = v && [...v.querySelectorAll('nav.nav')].find(n => { const r = n.getBoundingClientRect(); return r.height && Math.abs(r.bottom - vb) < 4; });
    const want = nv ? Math.max(10, Math.round(innerHeight - nv.getBoundingClientRect().top) + 6) + 'px' : '10px';
    if (d.style.bottom !== want) d.style.bottom = want;
  }
  function demoLift(base) { placeDemo(); const d = document.getElementById('webDemo'); if (!d) return base; const r = d.getBoundingClientRect(); if (!r.height) return base; return Math.max(base, Math.round(innerHeight - r.top) + 8); }
  function setBoxes(items) { boxes.forEach((b, k) => { b.dataset.sel = items[k] ? items[k][0] : ''; }); place(); }
  function scrollFirst() { const b = boxes[0]; const el = b && b.dataset.sel && find(b.dataset.sel); if (!el) return; const r = el.getBoundingClientRect(), c = clipRect(); if (r.top < c.top || r.bottom > c.bottom) el.scrollIntoView({ block: panel && panel.classList.contains('sheet') ? 'start' : 'center' }); place(); }
  function place() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      placeDemo(); const ob = document.getElementById('jgOpen'); if (ob && !ob.closest('#webDemo')) ob.style.bottom = demoLift(16) + 'px';
      // 面板位置：手機頁放在手機右側，電腦頁固定在右側；空間不夠就改成底部抽屜
      if (panel && !panel.hidden) {
        const F = window.JJJFRAME;
        const B = document.body.classList;
        if (PAGE === 'app' && F && F.side) { panel.classList.remove('sheet'); panel.style.removeProperty('bottom'); Object.assign(panel.style, { left: F.gx + 'px', top: F.top + 'px', width: F.gw + 'px', height: F.h + 'px', right: 'auto', bottom: 'auto' }); B.remove('jgDock', 'jgSheet'); }
        else if (PAGE !== 'app' && innerWidth >= 900) { const w = innerWidth >= 1180 ? 388 : 330; panel.classList.remove('sheet'); Object.assign(panel.style, { left: 'auto', right: '16px', top: '16px', bottom: demoLift(16) + 'px', width: w + 'px', height: 'auto' }); document.body.style.setProperty('--jgm', w + 32 + 'px'); B.add('jgDock'); B.remove('jgSheet'); }
        else { panel.classList.add('sheet'); Object.assign(panel.style, { height: 'auto' }); panel.style.setProperty('bottom', demoLift(8) + 'px', 'important'); B.remove('jgDock'); B.add('jgSheet'); }
      }
      const c = clipRect();
      boxes.forEach((b, k) => {
        const el = b.dataset.sel && !panel.hidden && find(b.dataset.sel);
        const li = panel && panel.querySelector(`.li[data-k="${k}"]`); if (li) li.classList.toggle('miss', !el);
        if (!el) { b.style.display = 'none'; return; }
        const r = el.getBoundingClientRect(); const L = Math.max(r.left, c.left), T = Math.max(r.top, c.top), R = Math.min(r.right, c.right), B = Math.min(r.bottom, c.bottom);
        if (R - L < 8 || B - T < 8) { b.style.display = 'none'; return; }
        Object.assign(b.style, { display: 'block', left: L - 4 + 'px', top: T - 4 + 'px', width: R - L + 8 + 'px', height: B - T + 8 + 'px' });
      });
    });
  }
  async function doNav(s) {
    try {
      if (PAGE === 'app' && window.JJJ && Array.isArray(s.nav)) { const J = window.JJJ, st = s.nav.slice(); const last = st.pop(); J.tourGo(st.length ? st : [last], s.home); if (st.length && J.go) J.go(last); await wait(700); }
      else if (PAGE === 'con' && window.JCON) { Object.assign(window.JCON.ST, s.nav); window.JCON.render(); await wait(400); }
      else if (PAGE === 'adm') { const b = document.querySelector(`#nav [data-tab="${s.nav.tab}"]`); if (b) b.click(); else if (window.JJJA) window.JJJA.go(s.nav.tab); await wait(900); }
    } catch (e) {}
    place();
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function demoLogin(email) {
    const b = document.querySelector(`[data-demo="${email}"]`); if (b) { b.click(); await wait(2500); return; }
    await api('/auth/login', { method: 'POST', body: { email, password: 'demo1234' } }); location.reload();
  }
  async function onClick(e) {
    const b = e.target.closest('button'); if (!b) return; const t = b.dataset.t, i = stepI(), s = STEPS[i];
    if (b.dataset.go) { const k = +b.dataset.go; STEPS.forEach(x => { x._navved = false; x._done = false; x._pre = false; }); LS.set(K, String(k)); return show(); }
    if (t === 'stop') return stop();
    if (t === 'back') { const w = s && s._where; clearNote(); if (w) await goWhere(w); lastKey = screenKey(); place(); return; }
    if (t === 'fold') { folded = true; panel.hidden = true; boxes.forEach(x => x.style.display = 'none'); openBtn(true); return; }
    if (moving && t !== 'min') return;
    if (t === 'min') { mini = !mini; panel.classList.toggle('min', mini); b.textContent = mini ? '展開' : '收合'; return; }
    if (t === 'mode') { if (FULL) LS.del('jjj_g_full'); else LS.set('jjj_g_full', '1'); LS.del(K); LS.del(OFF); location.reload(); return; }
    if (t === 'prev') { const pi = prevIdx(i), p = STEPS[pi]; if (!p) return; p._navved = false; p._done = false; p._pre = false; LS.set(K, String(pi)); return show(); }
    if (t === 'next') { const ni = nextIdx(i), n = STEPS[ni]; if (!n) return stop(); n._navved = false; n._done = false; n._pre = false; LS.set(K, String(ni)); return show(); }
    if (t === 'goend') { LS.set('jjj_g_nav', '1'); try { await api('/auth/logout', { method: 'POST' }); } catch (x) {} if (s.end === 'family' || s.end === 'tech') LS.set('jjj_end', s.end); location.href = ENDS[s.end].url; return; }
    if (t === 'login') { b.disabled = true; try { await demoLogin(s.as); await who(); s._navved = false; show(); } catch (x) { b.disabled = false; } return; }
    if (t === 'act' && s.act) {
      if (busy) return; busy = true; lock(true);
      try {
        const J = window.JJJ;
        if (s.act.click) { const el = find(s.act.click); if (el) { el.click(); await wait(s.act.wait || 800); } }
        else if (s.act.fn === 'diag' && J) { await J.tourDiag(); }
        else if (s.act.fn === 'diff' && J) { await J.tourDiff(); }
        else if (s.act.fn === 'finish' && J) { await J.tourFinish(); }
        else if (s.act.fn === 'accept' && J) { await J.tourAccept(); }
        s._done = true;
        // 點完會換畫面的動作，直接進下一步
        const n = STEPS[i + 1];
        if (n && n.end === s.end && n.as === s.as && (!n.nav || s.act.click)) { n._navved = !n.nav || allFound(n); n._done = false; n._pre = false; LS.set(K, String(i + 1)); }
      } catch (x) { const m = panel.querySelector('.bd'); if (m) m.insertAdjacentHTML('beforeend', `<div class="msg">${x.message}</div>`); }
      busy = false; show();
    }
  }
  // ---------- 事件：只在需要時更新位置，不重畫整頁 ----------
  addEventListener('resize', relayout);
  document.addEventListener('scroll', place, true);
  document.addEventListener('click', e => { if (!e.target.closest('#jg')) setTimeout(place, 350); }, true);
  const mo = new MutationObserver(() => { place(); scheduleFollow(); });
  const target = document.getElementById('view') || document.body; mo.observe(target, { childList: true, subtree: true });
  setInterval(() => { if (panel && !panel.hidden) { place(); follow(); } }, 1200);
  // 頁面載入（含切換帳號後）自動接續導覽；第一次打開自動開始，按 ✕ 關掉後不再自動出現
  // ---------- 跟著畫面走 ----------
  // A 自己點了「幫我點」要點的按鈕 → 算完成，自動下一步
  // B 走到某一步專屬的畫面（往後）→ 卡片跟上
  // C 走到導覽沒介紹的畫面 → 提示，不亂跳
  // D 退回前面步驟的畫面 → 不自動倒退，提示可按「上一步」
  function atOf(x) {
    const n = x.nav; if (!n) return null;
    if (Array.isArray(n)) return n[n.length - 1];
    if (ENDS[x.end].page === 'adm') return n.tab;
    return n.view === 'case' ? `case:${n.hid}:${n.tab}` : n.view;
  }
  function uniqAt(x) { const a = atOf(x); if (!a) return null; return STEPS.filter(y => y.end === x.end && y.as === x.as && atOf(y) === a).length === 1 ? a : null; }
  function screenKey() {
    try {
      if (PAGE === 'app') { const st = window.JJJ && window.JJJ.S.stack; return st && st.length ? st[st.length - 1] : null; }
      if (PAGE === 'con') { const S = window.JCON && window.JCON.ST; return S ? (S.view === 'case' ? `case:${S.hid}:${S.tab}` : S.view) : null; }
      const b = document.querySelector('#nav [data-tab][aria-current="page"]'); return b ? b.dataset.tab : null;
    } catch (e) { return null; }
  }
  function screenName() {
    const pick = q => { const e = document.querySelector(q); return e && e.innerText.trim().split('\n')[0]; };
    return (PAGE === 'app' ? pick('#view .top h1') : PAGE === 'con' ? pick('#nav [aria-current="page"]') || pick('main h2') : pick('#title')) || '目前畫面';
  }
  function where() {
    try {
      if (PAGE === 'app' && window.JJJ) return { stack: window.JJJ.S.stack.slice(), home: window.JJJ.S.home };
      if (PAGE === 'con' && window.JCON) { const S = window.JCON.ST; return { view: S.view, hid: S.hid, tab: S.tab }; }
      return { tab: screenKey() };
    } catch (e) { return null; }
  }
  async function goWhere(w) {
    try {
      if (PAGE === 'app' && window.JJJ) { window.JJJ.tourGo(w.stack, w.home); }
      else if (PAGE === 'con' && window.JCON) { Object.assign(window.JCON.ST, w); window.JCON.render(); }
      else { const b = document.querySelector(`#nav [data-tab="${w.tab}"]`); if (b) b.click(); }
    } catch (e) {}
    await wait(500);
  }
  const anyFound = x => (x.items || []).some(it => find(it[0]));
  const allFound = x => (x.items || []).length > 0 && x.items.every(it => find(it[0]));
  function clearNote() { if (!panel) return; panel.classList.remove('nc', 'nd'); panel.querySelectorAll('.jgnote').forEach(n => n.remove()); }
  function note(kind, i, s) {
    if (!panel || panel.classList.contains(kind === 'C' ? 'nc' : 'nd')) return;
    clearNote(); const bd = panel.querySelector('.bd'); if (!bd) return;
    const html = kind === 'C'
      ? `<div class="jgnote"><div class="jgn big">這個畫面不在導覽裡<small>你目前在：${screenName()}<br>導覽停在：第 ${num(i)} 步「${s.t}」</small></div><button class="jbt p" data-t="back">帶我回第 ${num(i)} 步</button><button class="jbt" data-t="fold">先收合導覽，我自己逛</button><div class="sec">回到導覽有介紹的畫面時</div><div class="why">卡片會自動跟上，不必再按任何按鈕。</div><div class="sec">原本第 ${num(i)} 步的編號</div></div>`
      : `<div class="jgnote"><div class="jgn">你回到上一個畫面<small>卡片不會自動倒退，以免來回跳動。要看第 ${i} 步，請按下方「上一步」。</small></div></div>`;
    const tl = bd.querySelector(':scope > .tl'); if (tl) tl.insertAdjacentHTML('afterend', html); else bd.insertAdjacentHTML('afterbegin', html);
    panel.classList.add(kind === 'C' ? 'nc' : 'nd');
  }
  function follow() {
    if (!panel || panel.hidden || folded || busy || moving || pendingA || mode !== 'step') return;
    const i = stepI(), s = STEPS[i]; if (!s || !ready(s)) return;
    const key = screenKey(); if (key == null || key === lastKey) return;
    const j = STEPS.findIndex(x => x.end === s.end && x.as === s.as && uniqAt(x) === key);
    if (j > i) { // B
      lastKey = key; const n = STEPS[j]; n._navved = true; n._done = false; n._pre = false;
      flash = { t: `已跟上你的畫面：第 ${num(i)} 步 → 第 ${num(j)} 步`, sub: j - i > 1 ? '跳過的步驟可從「目錄」回看' : '' };
      LS.set(K, String(j)); show(); return;
    }
    const sAt = uniqAt(s); const ok = sAt ? key === sAt : anyFound(s);
    if (ok) { lastKey = key; clearNote(); return; }
    if (j >= 0 && j < i) { lastKey = key; note('D', i, s); return; }
    if (sAt || !anyFound(s)) { lastKey = key; note('C', i, s); }
  }
  const scheduleFollow = () => { clearTimeout(followT); followT = setTimeout(follow, 700); };
  // A：使用者自己點到這一步「幫我點」要點的按鈕
  document.addEventListener('click', e => {
    if (busy || moving || mode !== 'step' || !panel || panel.hidden || e.target.closest('#jg')) return;
    const i = stepI(), s = STEPS[i]; if (!s || !ready(s) || !s.act || !s.act.click || s._done) return;
    const el = find(s.act.click); if (!el || !(el === e.target || el.contains(e.target))) return;
    const label = (el.innerText || el.getAttribute('aria-label') || '').trim().split('\n')[0].replace(/[\s›>→]+$/, '').slice(0, 16);
    s._done = true; pendingA = true; lock(true); clearTimeout(autoT);
    autoT = setTimeout(() => {
      pendingA = false; if (stepI() !== i) { lock(false); return; } const n = STEPS[i + 1];
      if (!n || n.end !== s.end || n.as !== s.as) { show(); return; }
      n._navved = !n.nav || allFound(n); n._done = false; n._pre = false;
      flash = { t: `✓ 已完成第 ${num(i)} 步，自動前往第 ${num(i) + 1} 步`, sub: label ? `偵測到你點了「${label}」` : '' };
      LS.set(K, String(i + 1)); show();
    }, s.act.wait || 800);
  }, true);
  document.addEventListener('click', scheduleFollow, true);
  addEventListener('popstate', scheduleFollow);
  window.JJJGUIDE = { start, stop, show, place, steps: STEPS, isOpen: () => panel && !panel.hidden };
  const begin = () => {
    mergeDemo();
    if (LS.get(OFF)) { openBtn(true); return; }
    if (stepI() == null) LS.set(K, String(Math.max(0, firstOf(roleEnd()))));
    else { const s = STEPS[stepI()]; if (s && ENDS[s.end].page !== PAGE) { const f = firstOf(roleEnd()); const viaGuide = LS.get('jjj_g_nav') === '1'; if (!viaGuide && f >= 0) LS.set(K, String(f)); } }
    LS.del('jjj_g_nav'); show();
  };
  setTimeout(begin, 1400);
})();
