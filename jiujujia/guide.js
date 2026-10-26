// 揪居家導覽：右側說明面板＋畫面上的編號框（和 Demo 影片同一套呈現方式）
// 不加遮罩、不跳視窗；四端各自登入，換端時真的登出再到該端登入頁
(function () {
  const PAGE = /admin\.html/.test(location.pathname) ? 'adm' : /consultant\.html/.test(location.pathname) ? 'con' : 'app';
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
  const K = 'jjj_g_step', OFF = 'jjj_g_off';
  const END_NOW = PAGE === 'app' ? (LS.get('jjj_end') || 'family') : PAGE === 'con' ? 'advisor' : 'admin';
  const ENDS = {
    family: { n: '消費者端', page: 'app', url: 'app.html?end=family' },
    tech: { n: '技師端', page: 'app', url: 'app.html?end=tech' },
    advisor: { n: '生活顧問端', page: 'con', url: 'consultant.html' },
    admin: { n: '企業管理端', page: 'adm', url: 'admin.html' },
  };
  const WHO = { 'chen@example.com': '陳小姐（子女）', 'li@example.com': '李小姐（關懷中家庭）', 'advisor@example.com': '王小明（生活顧問）', 'tech@example.com': '吳技師（全國電子技師）', 'manager@example.com': '張經理（總部）' };
  const CH = ['先評估', '再改善', '後關心', '總部'];
  const F = (o) => Object.assign({ end: 'family', as: 'chen@example.com' }, o);
  const A = (o) => Object.assign({ end: 'advisor', as: 'advisor@example.com' }, o);
  const T = (o) => Object.assign({ end: 'tech', as: 'tech@example.com' }, o);
  const L = (o) => Object.assign({ end: 'family', as: 'li@example.com' }, o);
  const M = (o) => Object.assign({ end: 'admin', as: 'manager@example.com' }, o);
  // items: [目標, 說明]；目標可用 CSS 選擇器，或「~文字」找含這段字的最小元素，「~文字@.class」再往外找到該 class
  const STEPS = [
    F({ ch: 0, t: '首頁就有 AI 顧問阿國', nav: ['home'],
      items: [['.agq', '<b>AI 顧問阿國</b>卡片：長輩開始一個人住，先做 5 分鐘居家診斷'], ['.agq [data-go="b1"]', '按<b>「幫長輩家做居家診斷」</b>開始']],
      why: '子女最常打開的是全國電子 App。入口放在首頁，不必另外下載新 App，也不用先到門市。',
      flow: ['消費者端'], act: { click: '.agq [data-go="b1"]', label: '幫我點 ②' } }),
    F({ ch: 0, t: '由子女代填', nav: ['home', 'b1'],
      items: [['[data-a="loginChild"]', '<b>幫長輩填（我是子女）</b>：長輩不用操作手機'], ['~我是長輩本人', '長輩自己填時，自動切換<b>大字模式</b>']],
      why: '長輩多半不習慣操作手機，實際會打開 App 的是子女。兩種身分都保留，資料存在同一個家庭底下。',
      flow: ['消費者端'], act: { click: '[data-a="loginChild"]', label: '幫我點 ①' } }),
    F({ ch: 0, t: 'AR 掃描（場勘）', nav: ['home', 'ar'],
      items: [['#arBtn', '<b>開始掃描</b>：手機對著走廊掃一遍'], ['~手動輸入', '手機不支援 AR 時，改用<b>手動輸入</b>']],
      why: '子女不必請假回家拿量尺。原始影像只在分析時暫存，分析完就清除，只留下尺寸與材質。',
      flow: ['消費者端'], act: { click: '#arBtn', label: '幫我開始掃描', wait: 8800 } }),
    F({ ch: 0, t: '量尺寸、認材質',
      items: [['~床邊到浴室走道寬@.card', '自動量出<b>走道 92 cm、門檻 2 cm</b>與插座位置'], ['[data-mat="bath|ok"]', 'AI 判讀<b>浴室地板是磁磚</b>，子女按「✓ 對」才算數'], ['~帶入掃描結果', '三種材質都確認後，才能<b>帶入掃描結果</b>']],
      why: 'AI 只提出建議，最後由人確認，避免誤判一路傳到施工現場。材質會決定技師的安裝方式，例如鋁框門改用背膠。',
      flow: ['消費者端', '生活顧問端｜案件量測', '技師端｜安裝方式'], act: { fn: 'diag', label: '幫我確認材質並答完五題' } }),
    F({ ch: 0, t: '推薦：夜間動線照明', nav: ['home', 'b3'],
      items: [['~夜間動線照明', '依五個作息問題，推薦<b>夜間動線照明</b>'], ['#cmp_b3', '<b>安裝前後對比</b>：左右拖曳中間把手'], ['[data-go="optA"]', '看哪裡需要處理']],
      why: '先給一個最需要的建議，不一次塞滿商品；前後對比讓子女在家就看得到裝了之後的樣子。',
      flow: ['消費者端'], act: { click: '[data-go="optA"]', label: '幫我點 ③' } }),
    F({ ch: 0, t: '看結果：先講結論', nav: ['home', 'b3', 'optA'],
      items: [['~個地方建議處理', '先講結論：<b>幾個地方</b>建議處理'], ['~居家安全地圖@.card', '六個空間用<b>紅黃綠燈</b>標出風險'], ['[data-v5go="hall"]', '走道：<b>紅燈</b>，偏暗又有門檻']],
      why: '燈號依《建築物無障礙設施設計規範》判斷，一次只看一個空間，子女不會被資訊淹沒。',
      flow: ['消費者端'], act: { click: '[data-v5go="hall"]', label: '幫我點 ③ 走道' } }),
    F({ ch: 0, t: '選改善方式',
      items: [['~最快轉綠@.seg', '依需求排序：<b>最快轉綠、最省錢、不鑽孔</b>'], ['[data-v5opt="hall|h_part"]', '選<b>感應夜燈＋止滑卡扣地板</b>（簡易施工）']],
      why: '每個紅黃燈都附四類做法：免費調整、全國電子安裝、簡易施工、改造工程。價格是級距，正式報價由生活顧問確認。',
      flow: ['消費者端'], act: { click: '[data-v5opt="hall|h_part"]', label: '幫我選 ②' } }),
    F({ ch: 0, t: '挑款式，先看鋪好的樣子',
      items: [['~選擇款式@.card', '三種地板<b>款式</b>，換款式燈號不變'], ['~現在', '實景<b>前後對比</b>：拖曳看鋪好的樣子'], ['[data-v5ok]', '<b>確定這個方式</b>']],
      why: '用自家走道的實景比對，比看型錄更容易下決定，也減少到府後才改款式。',
      flow: ['消費者端'], act: { click: '[data-v5ok]', label: '幫我點 ③' } }),
    F({ ch: 0, t: '浴室：斜坡墊就能轉綠燈',
      items: [['[data-v5ok]', '浴室推薦<b>斜坡墊＋止滑地墊</b>，千元內、當天安裝']],
      why: '能用免費調整或小設備解決的，就不推大工程；確定後回到全屋總覽。',
      flow: ['消費者端'], act: { click: '[data-v5ok]', label: '幫我確定' } }),
    F({ ch: 0, t: '交給生活顧問',
      items: [['[data-v5toC]', '全國電子與協力工班的項目，放在<b>同一張清單</b>']],
      why: '子女只要面對一位生活顧問，不必自己分別聯絡水電、工班與門市。',
      flow: ['消費者端'], act: { click: '[data-v5toC]', label: '幫我打開' } }),
    F({ ch: 0, t: '請生活顧問報價', nav: ['home', 'b3', 'optA', 'optC'],
      items: [['~全屋改善前後@.card', '<b>全屋改善前後</b>：六個空間全部綠燈（預估）'], ['~已選的改善方式@.card', '已選的方式：<b>簡易施工＋全國電子安裝</b>'], ['[data-v5handoff]', '<b>請生活顧問確認並報價</b>']],
      why: '一張報價含設備與工程；送出後由生活顧問整合，長輩本人到門市同意才成交。',
      flow: ['消費者端', '生活顧問端｜新進案件', '企業管理端｜預約與派工'], act: { click: '[data-v5handoff]', label: '幫我送出 ③' } }),
    F({ ch: 0, t: '儲存或分享給家人',
      items: [['[data-go="share"]', '成果可存入<b>長輩家</b>，或用 LINE 分享摘要']],
      why: '分享只含摘要，不含地址與作息；兄弟姊妹可以一起看、一起分攤。',
      flow: ['消費者端', 'LINE 家人群組'], last: '接下來到生活顧問端，看這筆案件怎麼被接手。' }),
    A({ ch: 0, t: '生活顧問端｜今天', nav: { view: 'wb' },
      items: [['~今日預約@.kp', '<b>今日預約</b>與待處理數量'], ['~新進案件與 AI 分析@.panel', '剛才送出的案件，出現在<b>新進案件</b>'], ['~待整合報價@.panel', '等生活顧問整合的<b>報價</b>']],
      why: '生活顧問登入後先看今天要做的事，依期限排序，不必在多個系統間切換。',
      flow: ['消費者端', '生活顧問端'] }),
    A({ ch: 0, t: '讀懂 AI 分析', nav: { view: 'case', hid: 3, tab: 1 },
      items: [['~林女士家@h2', '案件：<b>林女士家</b>（74 歲，一個人住）'], ['[data-tab="1"]', '先讀懂<b>燈號與理由</b>'], ['#view .panel', 'AI 判定不了的項目，列為<b>待現場確認</b>']],
      why: 'AI 分析是參考，不是正式鑑定。生活顧問先讀懂理由，才能向家人說清楚。',
      flow: ['消費者端｜AR 量測', '生活顧問端'] }),
    A({ ch: 0, t: '整合成一張報價', nav: { view: 'case', hid: 3, tab: 5 },
      items: [['~整合報價（編輯中）@.panel', '設備、安裝與<b>協力工班工程</b>合成一張'], ['~報價版本@.panel', '每次修改都留下<b>版本</b>']],
      why: '家電與工程不再各報各的價。待估價項目不套用示範價格，送出後保留版本，避免事後爭議。',
      flow: ['生活顧問端', '消費者端｜專屬方案'] }),
    A({ ch: 1, t: '工作包與施工順序', nav: { view: 'case', hid: 3, tab: 7 },
      items: [['~協力工班施工@.pkc', '<b>協力工班</b>先做需要動工的項目'], ['~關懷設備@.pkc', '<b>全國電子技師</b>再安裝設備'], ['~長輩逐區驗收@.pkc', '最後由<b>長輩逐區驗收</b>']],
      why: '先工程後設備，前一步沒完成，後一步顯示等待，避免剛裝好的設備被施工拆掉。',
      flow: ['生活顧問端', '技師端｜工作包', '企業管理端｜工單'], last: '接下來到技師端，看吳技師怎麼照圖安裝。' }),
    T({ ch: 1, t: '技師端｜今日工單', nav: ['t1'],
      items: [['.card.focus', '今天的工單聚焦，<b>只看得到自己的</b>'], ['.card.dimmed', '其他日期或已完成的工單淡化顯示'], ['~技師只看得到工單所需資訊', '只看得到<b>工單所需資訊</b>，完整地址出發當天才顯示']],
      why: '技師只拿到完成工作需要的資訊；住址與作息不會出現在其他人的畫面。',
      flow: ['企業管理端｜派工', '技師端'], act: { click: '.card.focus', label: '幫我打開工單 ①' } }),
    T({ ch: 1, t: '施工圖只標號碼',
      items: [['.tmapc', '施工圖只標<b>順序號碼</b>，顏色代表狀態'], ['[data-tgrp="玄關"]', '依區域分組，點開就看到該區工作']],
      why: '圖上不放文字，現場一眼就知道下一步；桃紅待施工、深莓已完成、橘色差異、灰色是其他人員。',
      flow: ['技師端'], act: { click: '[data-tgrp="玄關"]', label: '幫我展開「玄關」②' } }),
    T({ ch: 1, t: 'AI 帶出安裝方式，現場不符就回報', pre: J => { J.S.topen = '玄關'; J.S.tsel = 'pin:D2'; J.render(); },
      items: [['.trow.sel', '大門是鋁框：AI 帶出<b>背膠固定、不鑽孔</b>'], ['[data-a="tDiffGo"]', '現場不符就<b>回報差異</b>']],
      why: '子女在 AR 時確認的材質，直接變成技師的安裝方式。差異回報會出現在生活顧問端「今天」，必要時更新圖面版本。',
      flow: ['技師端', '生活顧問端｜待審差異'], act: { fn: 'diff', label: '幫我回報一則差異' } }),
    T({ ch: 1, t: '全部完成，請長輩驗收',
      items: [['.sum', '做完按「完成安裝」，工單變成<b>待驗收</b>']],
      why: '技師不能自己結案，要由長輩確認才算完成。',
      flow: ['技師端', '消費者端｜服務進度'], act: { fn: 'finish', label: '幫我做完其餘項目' } }),
    T({ ch: 1, t: '長輩逐區驗收', pre: J => { J.S.acc = {}; J.S.accNote = ''; J.go('tacc'); },
      items: [['.tacc', '大字逐區確認：夜燈會不會亮、按鈕按不按得到']],
      why: '全部沒問題才驗收完成，摘要同步到子女的 App；有問題就退回，相關項目改回待施工。',
      flow: ['技師端', '消費者端｜服務進度'], act: { fn: 'accept', label: '幫長輩驗收' }, last: '接下來回到消費者端，看已經在用揪夜安的李小姐。' }),
    L({ ch: 2, t: '後關心｜揪居家', nav: ['home', 'm2'], home: 'parents',
      items: [['~今天平安@.jhero', '打開就知道<b>媽媽今天平安</b>'], ['~要處理的事@.card', '夜燈裝滿一年<b>主動提醒</b>'], ['[data-rbook]', '<b>一鍵預約</b>就送出維護工單草稿']],
      why: '有人顧著，卻不打擾：平常只顯示一句狀態，有事才提醒。',
      flow: ['消費者端', '企業管理端｜預約與派工'], act: { click: '[data-rbook]', label: '幫我一鍵預約 ③' } }),
    L({ ch: 2, t: '異常先問長輩本人', nav: ['home', 'm2', 'gl'], home: 'parents',
      items: [['~異常時的通知順序@.card', '<b>先問長輩</b>，沒回應才依序通知家人'], ['~夜間浴室停留較久@.card', '每一次異常都留下<b>紀錄</b>']],
      why: '臥室到浴室不裝鏡頭，只用感測器。先問本人，尊重長輩，也減少誤報。',
      flow: ['消費者端', '企業管理端｜長輩關懷紀錄'] }),
    L({ ch: 2, t: '揪心願：大家的心願', nav: ['home', 'm2', 'wall'], home: 'parents',
      items: [['~可調光感應夜燈@.card', '同場域家庭的心願，整理成<b>主題</b>'], ['~我也需要', '別家也需要，就按<b>我也需要</b>']],
      why: '達到門檻後由總部評估、再開放預購，先有訂單才進貨，門市不必壓庫存。',
      flow: ['消費者端', '企業管理端｜揪心願彙整'], last: '最後到企業管理端，看總部怎麼看這些資料。' }),
    M({ ch: 3, t: '企業管理端｜即時總覽', nav: { tab: 'live' },
      items: [['#nav', '側欄：今日工作、服務家庭、揪心願、門市與人員、試點與分析'], ['#view', '總部與門市主管看到的是<b>同一份即時資料</b>']],
      why: '四端各自登入，資料即時串接；總部不用等月報，就能看到每一戶走到哪一步。',
      flow: ['消費者端', '生活顧問端', '技師端', '企業管理端'] }),
    M({ ch: 3, t: '預約與派工', nav: { tab: 'bk' },
      items: [['~門市諮詢預約@.panel', '剛才的報價請求與一鍵預約，出現在這裡'], ['~到府工單@.panel', '合併到府：同一天排好技師']],
      why: '一次到府就把夜燈與關懷設備裝好，減少技師來回。',
      flow: ['消費者端', '企業管理端', '技師端'], act: { click: '#nav [data-tab="bk"]', label: '打開預約與派工' } }),
    M({ ch: 3, t: '工單', nav: { tab: 'wo' },
      items: [['#view', '每張工單都有<b>工作包、檢核清單、照片與狀態紀錄</b>']],
      why: '技師的差異回報、生活顧問的核准都留在工單裡，事後查得到。',
      flow: ['技師端', '企業管理端'] }),
    M({ ch: 3, t: '協力工班', nav: { tab: 'partner' },
      items: [['~協力工班名單@.panel', '<b>協力工班</b>：每類每店一家，看保險與保固'], ['~協力工班工單@.panel', '協力工班的工單與進度']],
      why: '會動到房子的工程交給簽約的協力工班，全國電子技師專心安裝設備。',
      flow: ['生活顧問端', '企業管理端'] }),
    M({ ch: 3, t: '服務地圖', nav: { tab: 'ops' },
      items: [['#mapView', '全台 → 縣市 → 門市街區，三層往下看']],
      why: '總部依導入階段決定擴張順序，每一戶的狀態都看得到。',
      flow: ['企業管理端'] }),
    M({ ch: 3, t: '試點指標', nav: { tab: 'kpi' },
      items: [['#view', '續訂率、轉換率、技師負荷、誤報率，<b>四項達標才擴展</b>']],
      why: '試點是為了驗證假設，不是為了衝量；沒達標就回到前面的步驟調整。導覽到這裡結束，可以自由操作。',
      flow: ['企業管理端'] }),
  ];
  // ---------- 樣式 ----------
  const css = document.createElement('style');
  css.textContent = `
#jg{position:fixed;z-index:9995;background:#fff;color:#3D3A40;border-radius:20px;box-shadow:0 14px 36px rgba(61,58,64,.18);font:15px/1.6 "Noto Sans TC","PingFang TC",system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden}
#jg[hidden]{display:none}
#jg .hd{display:flex;justify-content:space-between;align-items:center;padding:16px 20px 0;font-size:13.5px;color:#8C8389}#jg .hd b{color:#C42D5A}
#jg .hd button{border:0;background:none;color:#8C8389;cursor:pointer;font:inherit;padding:4px 6px;border-radius:8px}#jg .hd button:hover{background:#F6F4F2}
#jg .bd{padding:6px 20px 16px;overflow:auto;flex:1}
#jg .tl{display:flex;margin:10px 0 12px}#jg .tl div{flex:1;text-align:center;font-size:12.5px;font-weight:700;color:#A8A5A0;position:relative}
#jg .tl i{display:block;width:14px;height:14px;border-radius:50%;background:#C9C7C3;margin:0 auto 5px;position:relative;z-index:1}
#jg .tl div:not(:last-child)::after{content:"";position:absolute;top:5px;left:50%;right:-50%;height:4px;background:#DDDBD7}
#jg .tl .dn{color:#8E1E42}#jg .tl .dn i,#jg .tl .dn::after{background:#C42D5A!important}
#jg .tl .cu{color:#C42D5A}#jg .tl .cu i{background:#C42D5A;box-shadow:0 0 0 5px #F2C94C;width:18px;height:18px;margin-top:-2px}
#jg .who{display:inline-block;background:#F7E9EE;color:#8E1E42;font-weight:900;font-size:13px;border-radius:8px;padding:2px 10px}
#jg h2{margin:6px 0 8px;font-size:22px;line-height:1.35;font-weight:900}
#jg .sec{font-size:12.5px;color:#8C8389;font-weight:700;margin:10px 0 4px}
#jg .li{display:flex;gap:10px;margin:6px 0;font-size:15px}#jg .li i{flex:none;width:24px;height:24px;border-radius:50%;background:#C42D5A;color:#fff;font-style:normal;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;margin-top:1px}#jg .li b{color:#C42D5A}
#jg .li.miss{opacity:.55}
#jg .why{background:#F6F4F2;border-radius:12px;padding:9px 12px;font-size:14px}
#jg .flow{display:flex;flex-wrap:wrap;gap:5px;align-items:center;font-size:13px}#jg .flow span{border:1.5px solid #E3D3D9;border-radius:14px;padding:2px 9px;font-weight:700}#jg .flow span.me{background:#C42D5A;border-color:#C42D5A;color:#fff}#jg .flow em{font-style:normal;color:#C42D5A;font-weight:900}
#jg .msg{margin-top:10px;background:#FFF6D6;border-radius:10px;padding:8px 12px;font-size:14px}
#jg .ft{display:flex;gap:8px;padding:12px 20px 16px;border-top:1px solid #EEE7E4}
#jg .ft button{height:40px;border-radius:10px;border:1.5px solid #DDD5D0;background:#fff;font:inherit;font-size:14.5px;font-weight:700;padding:0 12px;cursor:pointer;color:#3D3A40}
#jg .ft button.p{flex:1;background:#C42D5A;border-color:#C42D5A;color:#fff}
#jg .ft button:disabled{opacity:.5;cursor:default}
#jg .toc{margin-top:12px;border-top:1px solid #EEE7E4;padding-top:6px;font-size:13px;color:#6F6670}
#jg .toc summary{cursor:pointer;font-weight:700;color:#8E1E42;padding:4px 0}
#jg .toc button{display:block;width:100%;text-align:left;border:0;background:none;font:inherit;padding:3px 4px;border-radius:6px;cursor:pointer;color:#6F6670}
#jg .toc button:hover{background:#F6F4F2}#jg .toc button.d{color:#8E1E42}#jg .toc button.c{color:#C42D5A;font-weight:900}
#jg .toc .e{font-size:12px;color:#A8A1A5;margin:6px 0 2px;font-weight:700}
#jg.sheet{left:8px!important;right:8px!important;bottom:8px!important;top:auto!important;width:auto!important;max-height:46vh;border-radius:16px}
body.jgSheet{padding-bottom:48vh!important}body.jgSheet #view .scroll{padding-bottom:48vh!important}
#jg.sheet.min .bd .rest,#jg.sheet.min .toc{display:none}
#jg.sheet .grab{display:block;width:40px;height:4px;border-radius:2px;background:#D5CDC9;margin:8px auto 0}
#jg .grab{display:none}
.jgb{position:fixed;z-index:9994;border:3px solid #C42D5A;border-radius:10px;box-shadow:0 0 0 3px rgba(255,255,255,.8);pointer-events:none;display:none}
.jgb i{position:absolute;left:-15px;top:-15px;width:26px;height:26px;border-radius:50%;background:#C42D5A;color:#fff;font:900 14px/26px "Noto Sans TC",sans-serif;text-align:center;font-style:normal;box-shadow:0 0 0 3px #fff}
#jgOpen{position:fixed;right:16px;bottom:16px;z-index:9993;background:#C42D5A;color:#fff;border:0;border-radius:22px;padding:10px 16px;font:700 14px "Noto Sans TC",system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.2);cursor:pointer}
body.jgDock{margin-right:var(--jgm,420px)!important}body.jgDock #cGate,body.jgDock #gate{right:var(--jgm,420px)}
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
  let panel, boxes = [], cur = -1, busy = false, raf = 0, mini = innerWidth < 760;
  const stepI = () => { const v = LS.get(K); return v == null ? null : +v; };
  const firstOf = (end) => STEPS.findIndex(s => s.end === end);
  function endOf(i) { return STEPS[i] && STEPS[i].end; }
  function ready(s) { return s && ENDS[s.end].page === PAGE && (PAGE !== 'app' || END_NOW === s.end) && me && me.email === s.as; }
  // ---------- 面板 ----------
  function ensure() {
    if (panel) return;
    panel = document.createElement('div'); panel.id = 'jg'; panel.setAttribute('role', 'complementary'); panel.setAttribute('aria-label', '導覽說明'); document.body.appendChild(panel);
    for (let k = 0; k < 3; k++) { const b = document.createElement('div'); b.className = 'jgb'; b.innerHTML = `<i>${k + 1}</i>`; document.body.appendChild(b); boxes.push(b); }
    panel.addEventListener('click', onClick);
  }
  function stop() { LS.del(K); LS.set(OFF, '1'); if (panel) panel.hidden = true; boxes.forEach(b => b.style.display = 'none'); document.body.classList.remove('jgDock', 'jgSheet'); openBtn(true); relayout(); }
  function openBtn(show) { let b = document.getElementById('jgOpen'); if (!show) { if (b) b.remove(); return; } if (!b) { b = document.createElement('button'); b.id = 'jgOpen'; b.textContent = '開啟導覽'; b.onclick = () => start(); document.body.appendChild(b); } }
  function relayout() { if (window.JJJFRAME && window.JJJFRAME.lay) window.JJJFRAME.lay(); place(); }
  function start(i) { LS.del(OFF); LS.set(K, String(i == null ? Math.max(0, firstOf(PAGE === 'app' ? END_NOW : PAGE === 'con' ? 'advisor' : 'admin')) : i)); openBtn(false); show(); }
  function tlHtml(ch) { return `<div class="tl">${CH.map((c, k) => `<div class="${k < ch ? 'dn' : k === ch ? 'cu' : ''}"><i></i>${c}</div>`).join('')}</div>`; }
  function tocHtml(i) {
    let h = '', lastEnd = '';
    STEPS.forEach((s, k) => { if (s.end + s.as !== lastEnd) { h += `<div class="e">${ENDS[s.end].n}｜${WHO[s.as]}</div>`; lastEnd = s.end + s.as; }
      h += `<button data-go="${k}" class="${k < i ? 'd' : k === i ? 'c' : ''}">${k < i ? '✓' : k === i ? '●' : '○'} ${k + 1}　${s.t}</button>`; });
    return `<details class="toc"><summary>目錄（${STEPS.length} 步）</summary>${h}</details>`;
  }
  async function show() {
    const i = stepI(); if (i == null || LS.get(OFF)) return; const s = STEPS[i]; if (!s) { stop(); return; }
    ensure(); panel.hidden = false; cur = i; await who();
    const head = `<div class="grab"></div><div class="hd"><span><b>導覽 ${i + 1}／${STEPS.length}</b>｜${ENDS[s.end].n}</span><span><button data-t="min" aria-label="收合">${mini ? '展開' : '收合'}</button><button data-t="stop" aria-label="關閉導覽">✕</button></span></div>`;
    let body = '', foot = '';
    const onPage = ENDS[s.end].page === PAGE && (PAGE !== 'app' || END_NOW === s.end);
    if (!onPage) {
      body = `${tlHtml(s.ch)}<span class="who">${ENDS[s.end].n}｜${WHO[s.as]}</span><h2>下一段在${ENDS[s.end].n}</h2><div class="why">四端各自登入。導覽會先登出，帶你到<b>${ENDS[s.end].n}的登入頁</b>，再用示範帳號登入。</div>`;
      foot = `${i ? '<button data-t="prev">上一步</button>' : ''}<button class="p" data-t="goend">前往${ENDS[s.end].n}</button>`;
      setBoxes([]);
    } else if (!(me && me.email === s.as)) {
      const demoSel = PAGE === 'app' ? `[data-demo="${s.as}"]` : PAGE === 'con' ? `[data-demo="${s.as}"]` : `[data-demo="${s.as}"]`;
      body = `${tlHtml(s.ch)}<span class="who">${ENDS[s.end].n}｜${WHO[s.as]}</span><h2>${ENDS[s.end].n}登入</h2><div class="sec">看畫面上的編號</div><div class="li"><i>1</i><span>這是<b>${ENDS[s.end].n}</b>自己的登入頁，只列這一端的帳號</span></div><div class="li"><i>2</i><span>示範帳號<b>一鍵登入｜${WHO[s.as]}</b></span></div><div class="sec">為什麼這樣設計</div><div class="why">四端各自登入，帳號放錯入口會提示改用哪一端；登入後工單與資料即時串接。</div>`;
      foot = `${i ? '<button data-t="prev">上一步</button>' : ''}<button class="p" data-t="login">幫我登入 ②</button>`;
      s._items = [[PAGE === 'app' ? '#loginForm' : PAGE === 'con' ? '#cLogin' : '#gForm'], [demoSel]];
      setBoxes(s._items);
    } else {
      const items = s.items.map((it, k) => `<div class="li" data-k="${k}"><i>${k + 1}</i><span>${it[1]}</span></div>`).join('');
      const flow = s.flow.map((f, k) => `<span class="${k === s.flow.length - 1 && s.flow.length === 1 || f === ENDS[s.end].n ? 'me' : ''}">${f}</span>`).join('<em>→</em>');
      body = `${tlHtml(s.ch)}<span class="who">${ENDS[s.end].n}｜${WHO[s.as]}</span><h2>${s.t}</h2><div class="sec">看畫面上的編號</div>${items}<div class="rest"><div class="sec">為什麼這樣設計</div><div class="why">${s.why}</div><div class="sec">這筆資料會送到</div><div class="flow">${flow}</div>${s.last ? `<div class="msg">${s.last}</div>` : ''}${tocHtml(i)}</div>`;
      const nxt = STEPS[i + 1];
      const nextLabel = !nxt ? '完成導覽' : (nxt.end !== s.end || nxt.as !== s.as) ? `下一步：到${ENDS[nxt.end].n}` : '下一步';
      foot = `${i ? '<button data-t="prev">上一步</button>' : ''}${s.act && !s._done ? `<button class="p" data-t="act">${s.act.label}</button>` : ''}<button ${s.act && !s._done ? '' : 'class="p"'} data-t="next">${nextLabel}</button>`;
      s._items = s.items; setBoxes(s.items);
      if (s.nav && !s._navved) { s._navved = true; await doNav(s); }
      if (s.pre && !s._pre && PAGE === 'app' && window.JJJ) { s._pre = true; try { s.pre(window.JJJ); } catch (e) {} await wait(500); place(); }
    }
    panel.innerHTML = head + `<div class="bd">${body}</div><div class="ft">${foot}</div>`;
    panel.classList.toggle('min', mini);
    relayout(); setTimeout(() => scrollFirst(), 200);
  }
  function setBoxes(items) { boxes.forEach((b, k) => { b.dataset.sel = items[k] ? items[k][0] : ''; }); place(); }
  function scrollFirst() { const b = boxes[0]; const el = b && b.dataset.sel && find(b.dataset.sel); if (!el) return; const r = el.getBoundingClientRect(), c = clipRect(); if (r.top < c.top || r.bottom > c.bottom) el.scrollIntoView({ block: panel && panel.classList.contains('sheet') ? 'start' : 'center' }); place(); }
  function place() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      // 面板位置：手機頁放在手機右側，電腦頁固定在右側；空間不夠就改成底部抽屜
      if (panel && !panel.hidden) {
        const F = window.JJJFRAME;
        const B = document.body.classList;
        if (PAGE === 'app' && F && F.side) { panel.classList.remove('sheet'); Object.assign(panel.style, { left: F.gx + 'px', top: F.top + 'px', width: F.gw + 'px', height: F.h + 'px', right: 'auto', bottom: 'auto' }); B.remove('jgDock', 'jgSheet'); }
        else if (PAGE !== 'app' && innerWidth >= 900) { const w = innerWidth >= 1180 ? 388 : 330; panel.classList.remove('sheet'); Object.assign(panel.style, { left: 'auto', right: '16px', top: '16px', bottom: '16px', width: w + 'px', height: 'auto' }); document.body.style.setProperty('--jgm', w + 32 + 'px'); B.add('jgDock'); B.remove('jgSheet'); }
        else { panel.classList.add('sheet'); Object.assign(panel.style, { height: 'auto' }); B.remove('jgDock'); B.add('jgSheet'); }
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
      else if (PAGE === 'adm') { const b = document.querySelector(`#nav [data-tab="${s.nav.tab}"]`); if (b) b.click(); await wait(900); }
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
    if (t === 'min') { mini = !mini; panel.classList.toggle('min', mini); b.textContent = mini ? '展開' : '收合'; return; }
    if (t === 'prev') { const p = STEPS[i - 1]; if (p) { p._navved = false; p._done = false; p._pre = false; } LS.set(K, String(i - 1)); return show(); }
    if (t === 'next') { const n = STEPS[i + 1]; if (!n) return stop(); n._navved = false; n._done = false; n._pre = false; LS.set(K, String(i + 1)); return show(); }
    if (t === 'goend') { LS.set('jjj_g_nav', '1'); try { await api('/auth/logout', { method: 'POST' }); } catch (x) {} if (s.end === 'family' || s.end === 'tech') LS.set('jjj_end', s.end); location.href = ENDS[s.end].url; return; }
    if (t === 'login') { b.disabled = true; try { await demoLogin(s.as); await who(); s._navved = false; show(); } catch (x) { b.disabled = false; } return; }
    if (t === 'act' && s.act) {
      if (busy) return; busy = true; b.disabled = true;
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
        if (n && n.end === s.end && n.as === s.as && !n.nav) { n._navved = true; LS.set(K, String(i + 1)); }
      } catch (x) { const m = panel.querySelector('.bd'); if (m) m.insertAdjacentHTML('beforeend', `<div class="msg">${x.message}</div>`); }
      busy = false; show();
    }
  }
  // ---------- 事件：只在需要時更新位置，不重畫整頁 ----------
  addEventListener('resize', relayout);
  document.addEventListener('scroll', place, true);
  document.addEventListener('click', e => { if (!e.target.closest('#jg')) setTimeout(place, 350); }, true);
  const mo = new MutationObserver(() => place());
  const target = document.getElementById('view') || document.body; mo.observe(target, { childList: true, subtree: true });
  setInterval(() => { if (panel && !panel.hidden) place(); }, 1200);
  // 頁面載入（含切換帳號後）自動接續導覽；第一次打開自動開始，按 ✕ 關掉後不再自動出現
  window.JJJGUIDE = { start, stop, show, place, steps: STEPS, isOpen: () => panel && !panel.hidden };
  const begin = () => {
    if (LS.get(OFF)) { openBtn(true); return; }
    if (stepI() == null) LS.set(K, String(Math.max(0, firstOf(PAGE === 'app' ? END_NOW : PAGE === 'con' ? 'advisor' : 'admin'))));
    else { const s = STEPS[stepI()]; if (s && s.end !== (PAGE === 'app' ? END_NOW : PAGE === 'con' ? 'advisor' : 'admin')) { const f = firstOf(PAGE === 'app' ? END_NOW : PAGE === 'con' ? 'advisor' : 'admin'); const viaGuide = LS.get('jjj_g_nav') === '1'; if (!viaGuide && f >= 0) LS.set(K, String(f)); } }
    LS.del('jjj_g_nav'); show();
  };
  setTimeout(begin, 1400);
})();
