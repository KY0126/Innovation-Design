// 揪居家｜資料補正層 第三部分（2026/11/25 待實作清單）
// ① 線上購物購物車 ② 揪問 AI 轉真人 ③ 常見問題集 ④ 保固清單與線上報修 ⑤ 揪心願（樂高式：作品、自訂零件、共鳴、審查、點數）
// 載入順序：store2.js 之後。
(function () {
  const S = window.JJJSTORE; if (!S || !S.now) return;
  const { all, one, run, persist, myHousehold, J, ERR, parse } = S;
  const now = S.now, lastId = S.lastId;
  const n1 = (sql, a = []) => { try { return (one(sql, a) || {}).n || 0; } catch (e) { return 0; } };
  const phaseNow = () => { const r = one("SELECT value FROM config WHERE key='phase'"); return r ? +r.value : 2; };
  const hidOfUser = uid => { const r = one('SELECT id FROM households WHERE owner_id=?', [uid]) || one('SELECT household_id AS id FROM members WHERE user_id=?', [uid]); return r ? r.id : null; };
  const notify = (hid, title, body, link, kind = 'plan') => { if (hid) run('INSERT INTO notifications(household_id,audience,channel,kind,title,body,link,created_at) VALUES(?,?,?,?,?,?,?,?)', [hid, 'owner', 'App', kind, title, body || '', link || '', now()]); };

  // ===================== ① 線上購物購物車（實體商品） =====================
  const SHOP = [
    { sku: 'light', n: '感應夜燈', price: 390 }, { sku: 'strip', n: '門檻提示燈條', price: 590 }, { sku: 'btn', n: '床邊大按鍵開關', price: 490 },
    { sku: 'mat', n: '止滑地墊', price: 350 }, { sku: 'rail', n: '起身扶手（含技師安裝）', price: 2800 }, { sku: 'gas', n: '瓦斯偵測器', price: 1290 },
    { sku: 'smoke', n: '煙霧偵測器', price: 690 }, { sku: 'plug', n: '智慧插座', price: 590 }, { sku: 'ih', n: 'IH 單口爐', price: 2490 },
    { sku: 'speaker', n: '語音報平安音箱', price: 1490 }, { sku: 'hygro', n: '溫濕度計', price: 490 }, { sku: 'rack', n: '電動曬衣架（含技師安裝）', price: 6990 },
    { sku: 'washer', n: '洗脫烘洗衣機（1 級能效，含舊機回收）', price: 26900 }, { sku: 'ac', n: '1 級變頻冷氣（含標準安裝、舊機回收）', price: 32900 }, { sku: 'fridge', n: '1 級能效冰箱（含舊機回收）', price: 28900 },
    { sku: 'dimlight', n: '可調光感應夜燈（心願預購）', price: 590 },
  ];
  S.add('cart_items', `
CREATE TABLE IF NOT EXISTS cart_items (user_id INTEGER NOT NULL, sku TEXT NOT NULL, name TEXT NOT NULL, price INTEGER NOT NULL, qty INTEGER NOT NULL DEFAULT 1, src TEXT, PRIMARY KEY (user_id, sku));
CREATE TABLE IF NOT EXISTS support_tickets (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, household_id INTEGER, target TEXT NOT NULL, topic TEXT NOT NULL, transcript TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT '待回覆', created_at TEXT NOT NULL, handled_at TEXT);`, [
    ['GET', /^\/api\/shop\/products$/, null, () => J({ products: SHOP })],
    ['GET', /^\/api\/cart$/, 'any', (u) => J({ items: u ? all('SELECT sku,name,price,qty,src FROM cart_items WHERE user_id=?', [u.id]) : [] })],
    ['POST', /^\/api\/cart$/, 'any', (u, m, b) => {
      if (!u) return ERR('請先登入', 401);
      let n = 0;
      for (const it of b.items || []) { const p = SHOP.find(x => x.sku === it.sku); if (!p) continue; const q = Math.max(1, Math.min(20, it.qty | 0 || 1)); run('INSERT INTO cart_items(user_id,sku,name,price,qty,src) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,sku) DO UPDATE SET qty=MIN(20,qty+excluded.qty)', [u.id, p.sku, p.n, p.price, q, String(it.src || '')]); n += q; }
      persist(); return J({ added: n, count: n1('SELECT COALESCE(SUM(qty),0) AS n FROM cart_items WHERE user_id=?', [u.id]) });
    }],
    ['PUT', /^\/api\/cart\/(\w+)$/, 'any', (u, m, b) => { if (!u) return ERR('請先登入', 401); const q = b.qty | 0; if (q <= 0) run('DELETE FROM cart_items WHERE user_id=? AND sku=?', [u.id, m[1]]); else run('UPDATE cart_items SET qty=? WHERE user_id=? AND sku=?', [Math.min(20, q), u.id, m[1]]); persist(); return J({ ok: true }); }],
    ['POST', /^\/api\/cart\/checkout$/, 'any', (u, m, b) => {
      if (!u) return ERR('請先登入', 401);
      const L = all('SELECT sku,name,price,qty FROM cart_items WHERE user_id=?', [u.id]); if (!L.length) return ERR('購物車是空的', 400);
      if (!String(b.name || '').trim() || !String(b.phone || '').trim() || !String(b.address || '').trim()) return ERR('請填寫收件人、電話與地址', 400);
      if (!b.pay) return ERR('請選擇付款方式', 400);
      const hid = hidOfUser(u.id) || 0, total = L.reduce((a, x) => a + x.price * x.qty, 0), code = 'EC' + Date.now().toString(36).slice(-6).toUpperCase();
      run('INSERT INTO orders(household_id,code,items,monthly,one_time,pay,status,note,by_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', [hid, code, JSON.stringify(L.map(x => ({ id: x.sku, n: x.name + (x.qty > 1 ? ' ×' + x.qty : ''), monthly: 0, one: x.price * x.qty, g: '商品' }))), 0, total, String(b.pay), '已成立', JSON.stringify({ name: b.name, phone: b.phone, address: b.address, kind: '線上購物' }), u.id, now()]);
      run('DELETE FROM cart_items WHERE user_id=?', [u.id]);
      notify(hid, '線上購物訂單已成立 ' + code, '商品將依物流配送；大型家電由技師到府安裝', 'order');
      persist(); return J({ code, total });
    }],
    // 揪問 AI 轉真人：揪居家相關轉綁定門市生活顧問（同時進門市待辦）；購物、會員相關轉全國電子客服
    ['POST', /^\/api\/support\/handoff$/, 'any', async (u, m, b) => {
      if (!u) return ERR('請先登入', 401);
      const target = b.target === 'cs' ? '全國電子客服' : '綁定門市生活顧問';
      const hid = u.role === 'family' ? await myHousehold(u) : null;
      run('INSERT INTO support_tickets(user_id,household_id,target,topic,transcript,created_at) VALUES(?,?,?,?,?,?)', [u.id, hid, target, String(b.topic || '').slice(0, 80), JSON.stringify((b.transcript || []).slice(-12)), now()]);
      const id = lastId();
      if (target === '綁定門市生活顧問' && hid) run("INSERT INTO requests(household_id,user_id,kind,note) VALUES(?,?,'揪問 AI 轉生活顧問',?)", [hid, u.id, String(b.topic || '').slice(0, 80)]);
      persist(); return J({ id, target, eta: target === '全國電子客服' ? '客服專線 0800-021-921；線上留言 1 個工作天內回覆' : '生活顧問 1 個工作天內聯絡您' });
    }],
    ['GET', /^\/api\/admin\/support$/, ['hq', 'advisor'], () => J({ tickets: all('SELECT t.*, u.name FROM support_tickets t JOIN users u ON u.id=t.user_id ORDER BY t.id DESC LIMIT 50').map(t => ({ ...t, transcript: parse(t.transcript) || [] })) })],
    ['POST', /^\/api\/admin\/support\/(\d+)\/close$/, ['hq', 'advisor'], (u, m) => { run("UPDATE support_tickets SET status='已回覆', handled_at=? WHERE id=?", [now(), +m[1]]); persist(); return J({ ok: true }); }],
  ]);
  S.SHOP = SHOP;

  // ===================== ③ 常見問題集 =====================
  const EL = 'https://www.elifemall.com.tw/faq/', APPFAQ = 'https://app.elifemall.com.tw/', Q7 = 'http://www.elifemall.com.tw/newweb/images/right_banner/pop-left05.htm', SVC = 'https://www.elifemall.com.tw/page/returns-refunds';
  const PROP = '揪居家提案（第二階段）';
  const FAQ0 = [
    // [分類, 問題, 答案, 同義詞, 身分, 來源, 連結]
    ['揪居家方案與費用', '揪夜安月費多少？', '揪夜安基本方案每月 299 元、安心方案每月 449 元。加購揪食光每月 +200、揪團聚 +150、揪清爽 +100；四個場域都要時改用揪全家每月 699 元。', '月費、多少錢、價格、費用、方案、揪夜安、揪全家', 'all', PROP, ''],
    ['揪居家方案與費用', '月費可以取消嗎？要綁約嗎？', '月付不綁約，可以隨時變更或取消；取消後設備由生活顧問協助回收或改為買斷。', '取消、退訂、綁約、解約、不續', 'all', PROP, ''],
    ['揪居家方案與費用', '兄弟姊妹可以一起分攤嗎？', '可以。家庭方案不依人數加價，家人加入後可以分攤月費；異常通知只送主要聯絡人與第二聯絡人。', '分攤、兄弟、姊妹、家人付款、多少人', 'family', PROP, ''],
    ['揪居家方案與費用', '設定費怎麼算？', '設備與設定費一次付清；選揪全家首年設定費減免。正式金額以生活顧問電腦版送出的正式報價（有版本號）為準。', '設定費、安裝費、一次付清、報價', 'all', PROP, ''],
    ['長輩關懷與隱私', '會不會裝鏡頭？', '揪夜安預設不裝鏡頭，只用燈光與感測器。進階影像版只裝在門口、本機錄影不上傳，而且要長輩本人同意才裝，隨時可以撤回。', '鏡頭、攝影機、監視、錄影、隱私', 'all', PROP, ''],
    ['長輩關懷與隱私', '誰看得到長輩的作息？', '誰能看到作息由長輩本人決定；家人只看關懷狀態與每月摘要，未成年成員不接收異常通知。', '作息、誰看得到、權限、隱私、孫子', 'all', PROP, ''],
    ['長輩關懷與隱私', '有異常時會怎麼通知？', '先用燈光與語音問長輩本人，長輩按「我很好」就結束；沒有回應才依序通知主要聯絡人（LINE＋語音電話）、第二聯絡人、就近聯絡人。由家人判斷是否撥打 119，門市不參與緊急處理。', '異常、通知、沒回應、跌倒、緊急、怎麼通知', 'all', PROP, ''],
    ['長輩關懷與隱私', '長輩不同意可以安裝嗎？', '不行。不論子女或長輩付費，都要長輩本人確認、同意才成交；長輩不同意，子女不能代為下單。', '不同意、代簽、代下單、長輩同意', 'all', PROP, ''],
    ['評估與到府安裝', '手機不支援 AR 怎麼辦？', 'Android 手機可在揪居家裡用 AR 點兩點量距離；iPhone 與其他手機可拍一張放信用卡的照片換算長度，或用捲尺量好後手動輸入。都量不準時，門市會派人到府補量。', 'AR、量不準、iPhone、量測、捲尺、測量', 'family', PROP, ''],
    ['評估與到府安裝', '誰會來家裡安裝？', '全國電子技師負責設備安裝與教學；需要打門檻、改浴室門等工程時，由協力工班先施工，全國電子技師後安裝。', '誰來、技師、工班、施工、安裝', 'all', PROP, ''],
    ['評估與到府安裝', '安裝要多久？', '揪夜安臥室到浴室一般半天內完成；含改造工程時，生活顧問會先排工程再排安裝，完成後請長輩跟著走一次動線驗收。', '多久、時間、半天、驗收', 'all', PROP, ''],
    ['揪心願', '誰可以按「我也需要」？', '只有訂閱該場域方案的家庭可以按「我也需要」（例如臥室到浴室的作品要訂閱揪夜安）；其他人可以先追蹤，有進度會通知。', '我也需要、支持、按讚、共鳴、誰可以', 'all', PROP, ''],
    ['揪心願', '作品達到 100 戶之後呢？', '共鳴分三段：30 天內 20 戶、90 天內 50 戶、累積 100 戶後進入總部每季審查。通過後開放預購，達成團戶數才量產，未達全額退款。', '100 戶、門檻、審查、預購、量產', 'all', PROP, ''],
    ['揪心願', '我的作品被量產有什麼回饋？', '量產後商品包裝標示設計者，依銷售回饋全國電子點數（有上限），並贈送首批商品。不做現金分潤。', '回饋、分潤、獎勵、量產、設計者', 'all', PROP, ''],
    ['揪心願', '可以提出現在還沒有的商品嗎？', '可以。拼作品時用「我想要但還沒有的」新增自訂零件；同一個自訂零件被 5 件以上作品用到，或所在作品達 100 戶共鳴，就會進入總部的選品評估。', '自訂零件、新商品、沒有的、設計', 'all', PROP, ''],
    ['家電保固與報修', '保固要去哪裡查？', '到會員中心「保固清單」：分「我的購買」與「揪居家｜長輩家」兩區；揪夜安的關懷設備由綁定門市負責。', '保固、查保固、保固期、到期', 'all', '全國電子 App', APPFAQ],
    ['家電保固與報修', '家電壞了怎麼報修？', '在會員中心「保固清單」或家電詳情按「線上報修」，進度在「線上報修清單」追蹤；揪夜安關懷設備故障請找生活顧問。', '報修、壞了、維修、故障、修理', 'all', '全國電子 App', APPFAQ],
    ['家電保固與報修', '有延長保固嗎？', '全國電子網路購買享安心保固服務；官網活動曾標示空調免費延長保固 8 年、冰箱與洗衣機 5 年，實際依各檔期活動說明為準。', '延長保固、延保、幾年', 'all', '全國電子官網', EL],
    ['訂單、付款、退換貨', '可以退換貨嗎？', '購物 7 日內憑發票退換貨，需零配件齊全、紙盒與主機無磨損、條碼完整、保證書與說明書齊全；影音軟體、耗材、個人衛生用品等拆封後無法退換。此為官網舊版說明，實際以門市公告與客服說明為準。', '退貨、換貨、退換、鑑賞期、7 天', 'all', '全國電子官網｜品質 7 日保證', Q7],
    ['訂單、付款、退換貨', '訂單要去哪裡看？', '會員中心「購買紀錄」：揪居家的訂閱與加購、線上購物的商品訂單都在這裡。', '訂單、購買紀錄、查訂單、出貨', 'all', '全國電子 App', APPFAQ],
    ['訂單、付款、退換貨', '要怎麼聯絡客服？', '在揪問 AI 按「找真人」；或撥全國電子客服專線 0800-021-921。', '客服、電話、真人、聯絡', 'all', '全國電子官網｜售後服務', SVC],
    ['會員與點數', '會員點數 1 點可以抵多少錢？', '1 點可折抵 1 元，可全額或部分折抵，沒有金額門檻，也可以和其他付款方式合併使用。', '點數、折抵、1 點、抵多少', 'all', '全國電子官網｜常見問題', EL],
    ['會員與點數', '會員點數有使用期限嗎？', '有。交易產生的點數基本上自發送日起算 1 年，活動點數依實際到期日；可在會員中心「點數紀錄」查即將到期的點數。', '期限、到期、過期、點數期限', 'all', '全國電子 App｜點數規則', APPFAQ],
    ['會員與點數', '點數可以給家人用嗎？', '不行，點數限會員本人使用，目前沒有轉贈功能；折抵時要出示動態會員卡確認是本人。', '轉贈、給家人、別人、借用', 'all', '全國電子官網｜常見問題', EL],
    ['會員與點數', '加入會員要錢嗎？', '加入全國電子線上購物會員不需要任何費用。', '入會、年費、加入會員', 'all', '全國電子官網｜常見問題', EL],
    ['生活顧問', '鏡頭怎麼跟家人說明？', '可以這樣說：「揪夜安預設不裝鏡頭，只有燈和感測器。夜裡停留太久，會先用燈光和語音問長輩本人，長輩按『我很好』就結束，不會驚動家人。」', '話術、鏡頭、說明、怎麼說', 'advisor', PROP, ''],
    ['生活顧問', '報價要在哪裡做？', '手機只產出方案草稿；正式報價（有版本號）、排工作包、差異核准都在門市電腦（生活顧問電腦版）。長輩同意的是電腦版正式版本。', '報價、正式報價、版本、電腦版', 'advisor', PROP, ''],
    ['生活顧問', '門市要負責緊急處理嗎？', '不用。門市負責事前設定與事後關心；緊急狀況由家人判斷是否撥打 119。', '緊急、119、門市責任', 'advisor', PROP, ''],
  ];
  S.add('faq', `
CREATE TABLE IF NOT EXISTS faq (id INTEGER PRIMARY KEY, cat TEXT NOT NULL, q TEXT NOT NULL, a TEXT NOT NULL, alias TEXT NOT NULL DEFAULT '', roles TEXT NOT NULL DEFAULT 'all', status TEXT NOT NULL DEFAULT '上架', source TEXT, url TEXT, updated_at TEXT NOT NULL, updated_by TEXT);
CREATE TABLE IF NOT EXISTS faq_logs (id INTEGER PRIMARY KEY, user_id INTEGER, role TEXT, q TEXT NOT NULL, faq_id INTEGER, handed INTEGER NOT NULL DEFAULT 0, helpful INTEGER, created_at TEXT NOT NULL);`, [
    ['GET', /^\/api\/faq$/, 'any', (u) => { const r = u && u.role === 'advisor' ? ['all', 'advisor'] : ['all', 'family']; return J({ faq: all("SELECT id,cat,q,a,source,url,updated_at FROM faq WHERE status='上架' AND roles IN (?,?) ORDER BY id", r) }); }],
    ['GET', /^\/api\/faq\/match$/, 'any', (u, m, b, q) => {
      const text = String((q && q.get('q')) || '').replace(/\s+/g, ''); if (!text) return J({ best: null });
      const r = u && u.role === 'advisor' ? ['all', 'advisor'] : ['all', 'family'];
      let best = null, bs = 0;
      for (const f of all("SELECT * FROM faq WHERE status='上架' AND roles IN (?,?)", r)) {
        let s = 0; for (const k of String(f.alias).split('、').map(x => x.replace(/\s+/g, '')).filter(Boolean)) if (text.includes(k)) s += k.length;
        if (text.includes(f.q.replace(/[？?「」\s]/g, '').slice(0, 6))) s += 3;
        if (s > bs) { bs = s; best = f; }
      }
      return J({ best: bs >= 2 ? best : null, score: bs });
    }],
    ['POST', /^\/api\/faq\/log$/, 'any', (u, m, b) => { run('INSERT INTO faq_logs(user_id,role,q,faq_id,handed,created_at) VALUES(?,?,?,?,?,?)', [u ? u.id : null, u ? u.role : null, String(b.q || '').slice(0, 120), b.faq_id || null, b.handed ? 1 : 0, now()]); const id = lastId(); persist(); return J({ id }); }],
    ['POST', /^\/api\/faq\/helpful$/, 'any', (u, m, b) => { run('UPDATE faq_logs SET helpful=? WHERE id=?', [b.helpful ? 1 : 0, +b.id]); persist(); return J({ ok: true }); }],
    ['GET', /^\/api\/admin\/faq$/, ['hq', 'advisor'], () => J({
      faq: all('SELECT f.*, (SELECT COUNT(*) FROM faq_logs l WHERE l.faq_id=f.id) AS hits, (SELECT COUNT(*) FROM faq_logs l WHERE l.faq_id=f.id AND l.helpful=1) AS up, (SELECT COUNT(*) FROM faq_logs l WHERE l.faq_id=f.id AND l.helpful=0) AS down FROM faq f ORDER BY f.cat, f.id'),
      gaps: all('SELECT q, COUNT(*) AS n, MAX(created_at) AS last FROM faq_logs WHERE faq_id IS NULL GROUP BY q ORDER BY n DESC, last DESC LIMIT 20'),
      stats: { asked: n1('SELECT COUNT(*) AS n FROM faq_logs'), matched: n1('SELECT COUNT(*) AS n FROM faq_logs WHERE faq_id IS NOT NULL'), handed: n1('SELECT COUNT(*) AS n FROM faq_logs WHERE handed=1') },
    })],
    ['POST', /^\/api\/admin\/faq$/, ['hq'], (u, m, b) => {
      const f = { cat: String(b.cat || '').trim(), q: String(b.q || '').trim(), a: String(b.a || '').trim(), alias: String(b.alias || '').trim(), roles: ['all', 'family', 'advisor'].includes(b.roles) ? b.roles : 'all', status: b.status === '草稿' ? '草稿' : '上架', source: String(b.source || '總部'), url: String(b.url || '') };
      if (!f.cat || !f.q || !f.a) return ERR('分類、問題、答案都要填', 400);
      if (b.id) run('UPDATE faq SET cat=?,q=?,a=?,alias=?,roles=?,status=?,source=?,url=?,updated_at=?,updated_by=? WHERE id=?', [f.cat, f.q, f.a, f.alias, f.roles, f.status, f.source, f.url, now(), u.name, +b.id]);
      else run('INSERT INTO faq(cat,q,a,alias,roles,status,source,url,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?)', [f.cat, f.q, f.a, f.alias, f.roles, f.status, f.source, f.url, now(), u.name]);
      persist(); return J({ ok: true });
    }],
  ], () => { const t = now(); for (const [c, q, a, al, r, src, url] of FAQ0) run('INSERT INTO faq(cat,q,a,alias,roles,status,source,url,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?)', [c, q, a, al, r, '上架', src, url, t.slice(0, 10) === t.slice(0, 10) ? '2026-11-25 10:00:00' : t, '總部']); });

  // ===================== ④ 保固清單與線上報修 =====================
  S.add('repairs_v1', `CREATE TABLE IF NOT EXISTS repairs_v1 (done INTEGER);`, [
    ['GET', /^\/api\/home\/warranty$/, 'family', async (u) => {
      const hid = await myHousehold(u); if (!hid) return J({ mine: [], parents: [], care: [] });
      const D = all('SELECT id,home,name,years,status,warn,warranty,source FROM devices WHERE household_id=? ORDER BY id', [hid]);
      const open = all("SELECT note FROM requests WHERE household_id=? AND kind='線上報修' AND status='待處理'", [hid]).map(r => String(r.note || '').split('｜')[0]);
      const m = d => ({ ...d, repairing: open.includes(d.name), expired: /已過保/.test(d.warranty || '') });
      return J({ mine: D.filter(d => d.home === 'mine').map(m), parents: D.filter(d => d.home === 'parents' && d.source !== '到府安裝').map(m), care: D.filter(d => d.source === '到府安裝').map(m) });
    }],
    ['POST', /^\/api\/home\/repair$/, 'family', async (u, m, b) => {
      const hid = await myHousehold(u), d = one('SELECT * FROM devices WHERE id=? AND household_id=?', [+b.device_id, hid]); if (!d) return ERR('找不到家電', 404);
      if (d.source === '到府安裝') return ERR('揪夜安關懷設備請找生活顧問處理', 400);
      if (one("SELECT id FROM requests WHERE household_id=? AND kind='線上報修' AND status='待處理' AND note LIKE ?", [hid, d.name + '｜%'])) return J({ duplicate: true });
      run("INSERT INTO requests(household_id,user_id,kind,note) VALUES(?,?,'線上報修',?)", [hid, u.id, d.name + '｜' + String(b.note || '待技師聯絡').slice(0, 60)]);
      persist(); return J({ ok: true });
    }],
  ]);

  // ===================== ⑤ 揪心願（樂高式） =====================
  const FIELDS = ['臥室到浴室', '廚房', '客廳', '洗衣陽台', '全屋'];
  // 拼圖用的空間座標沿用居家安全地圖（公尺）：每個場域模板的可擺放位置
  const SLOTS = {
    '臥室到浴室': [['床邊', 3.08, 1.0], ['床尾', 3.35, 2.6], ['走道', 4.2, 3.66], ['門檻', 4.7, 3.55], ['浴室門口', 5.3, 3.25], ['浴室內', 5.6, 2.0]],
    '廚房': [['爐台', 1.0, 5.4], ['流理台', 2.6, 5.2], ['廚房門口', 3.4, 6.6], ['窗邊', 0.8, 7.4]],
    '客廳': [['沙發旁', 5.0, 6.2], ['電視櫃', 7.8, 5.2], ['茶几', 6.2, 7.0], ['客廳入口', 4.4, 7.6]],
    '洗衣陽台': [['洗衣機旁', 6.8, 1.0], ['曬衣區', 8.2, 1.8], ['陽台門口', 6.8, 3.0]],
    '全屋': [['臥室', 1.8, 1.6], ['走道', 4.2, 4.0], ['廚房', 1.8, 6.2], ['客廳', 6.4, 6.4], ['玄關', 8.0, 8.4]],
  };
  const PARTS = [
    { id: 'light', n: '感應夜燈', c: '燈', p: 390, tool: 0, min: 5, f: ['臥室到浴室', '洗衣陽台', '全屋'] },
    { id: 'strip', n: '門檻提示燈條', c: '條', p: 590, tool: 0, min: 8, f: ['臥室到浴室', '全屋'] },
    { id: 'btn', n: '床邊大按鍵開關', c: '鈕', p: 490, tool: 0, min: 5, f: ['臥室到浴室'] },
    { id: 'mat', n: '止滑地墊', c: '墊', p: 350, tool: 0, min: 2, f: ['臥室到浴室', '廚房', '洗衣陽台'] },
    { id: 'rail', n: '起身扶手', c: '扶', p: 2800, tool: 1, min: 40, f: ['臥室到浴室', '全屋'] },
    { id: 'gas', n: '瓦斯偵測器', c: '瓦', p: 1290, tool: 0, min: 10, f: ['廚房'] },
    { id: 'smoke', n: '煙霧偵測器', c: '煙', p: 690, tool: 0, min: 10, f: ['廚房', '全屋'] },
    { id: 'ih', n: 'IH 單口爐', c: 'IH', p: 2490, tool: 0, min: 5, f: ['廚房'] },
    { id: 'plug', n: '智慧插座', c: '插', p: 590, tool: 0, min: 3, f: ['廚房', '客廳', '全屋'] },
    { id: 'speaker', n: '語音報平安音箱', c: '音', p: 1490, tool: 0, min: 10, f: ['客廳', '全屋'] },
    { id: 'hygro', n: '溫濕度計', c: '溫', p: 490, tool: 0, min: 2, f: ['客廳', '全屋'] },
    { id: 'rack', n: '電動曬衣架', c: '架', p: 6990, tool: 1, min: 90, f: ['洗衣陽台'] },
  ];
  const STAGES = [[20, 30], [50, 90], [100, 0]]; // [戶數, 天內]
  const FIELD_PLAN = { '臥室到浴室': ['night_basic', 'night_plus', 'all'], '廚房': ['food', 'all'], '客廳': ['tv', 'all'], '洗衣陽台': ['wash', 'all'], '全屋': ['all'] };
  const PLAN_NAME = { '臥室到浴室': '揪夜安', '廚房': '揪食光', '客廳': '揪團聚', '洗衣陽台': '揪清爽', '全屋': '揪全家' };
  const BAN = [[/治療|療效|醫療|保證不跌|防止中風/, '不寫醫療效果'], [/飛利浦|Philips|小米|國際牌|Panasonic|大金|日立|三星|LG|Tapo/i, '不指名品牌'], [/門牌|地址|住址/, '不放地址或門牌']];
  function eligible(uid, field) {
    const hid = hidOfUser(uid); if (!hid) return false;
    const ids = FIELD_PLAN[field] || [];
    if (field === '臥室到浴室' && one("SELECT id FROM plans WHERE household_id=? AND status='已確認'", [hid])) return true;
    return all("SELECT items FROM orders WHERE household_id=? AND status<>'已取消'", [hid]).some(o => (parse(o.items) || []).some(i => ids.includes(i.id)));
  }
  const count = w => w.base + n1("SELECT COUNT(*) AS n FROM wish_supports WHERE work_id=? AND kind='support'", [w.id]);
  function stageOf(w, c) {
    const d = Math.floor((Date.now() - new Date(String(w.created_at).replace(' ', 'T')).getTime()) / 864e5);
    const i = STAGES.findIndex(([n]) => c < n);
    if (i < 0) return { i: 3, left: null, need: 0, label: '已達 100 戶，進入每季審查' };
    const [n, days] = STAGES[i]; const left = days ? Math.max(0, days - d) : null;
    return { i, left, need: n - c, label: `第 ${i + 1} 關：${days ? days + ' 天內 ' : ''}${n} 戶，還差 ${n - c} 戶${left != null ? `、剩 ${left} 天` : ''}` };
  }
  const nameOf = uid => { const u = one('SELECT name FROM users WHERE id=?', [uid]); const h = one('SELECT elder_name FROM households WHERE owner_id=?', [uid]); return (u ? u.name : '使用者') + (h ? `（${h.elder_name}家）` : ''); };
  function brief(w, uid) {
    const c = count(w), st = stageOf(w, c), mine = uid ? one('SELECT kind FROM wish_supports WHERE work_id=? AND user_id=?', [w.id, uid]) : null;
    return { id: w.id, title: w.title, field: w.field, status: w.status, theme_id: w.theme_id, parent_id: w.parent_id, designer: nameOf(w.user_id), user_id: w.user_id, count: c, stage: st, build: parse(w.build) || [], story: parse(w.story) || {}, mine: mine ? mine.kind : null, created_at: w.created_at, derivs: n1('SELECT COUNT(*) AS n FROM wish_works WHERE parent_id=?', [w.id]) };
  }
  const addPoints = (uid, wid, reason, pts) => { if (!one('SELECT id FROM wish_points WHERE user_id=? AND work_id=? AND reason=?', [uid, wid, reason])) run("INSERT INTO wish_points(user_id,work_id,reason,points,status,created_at) VALUES(?,?,?,?,'待檢核',?)", [uid, wid, reason, pts, now()]); };
  function supportersHids(wid) { return all("SELECT DISTINCT user_id FROM wish_supports WHERE work_id=?", [wid]).map(r => hidOfUser(r.user_id)).filter(Boolean); }

  S.add('wish_works', `
CREATE TABLE IF NOT EXISTS wish_works (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, household_id INTEGER, title TEXT NOT NULL, field TEXT NOT NULL, theme_id INTEGER, parent_id INTEGER, story TEXT NOT NULL DEFAULT '{}', build TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT '共鳴中', review_note TEXT, base INTEGER NOT NULL DEFAULT 0, terms INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT);
CREATE TABLE IF NOT EXISTS wish_cparts (id INTEGER PRIMARY KEY, work_id INTEGER, user_id INTEGER NOT NULL, name TEXT NOT NULL, purpose TEXT, photo TEXT, status TEXT NOT NULL DEFAULT '待評估', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS wish_supports (work_id INTEGER NOT NULL, user_id INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'support', buy TEXT, price TEXT, created_at TEXT NOT NULL, PRIMARY KEY (work_id, user_id));
CREATE TABLE IF NOT EXISTS wish_updates (id INTEGER PRIMARY KEY, work_id INTEGER NOT NULL, by_name TEXT, text TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS wish_comments (id INTEGER PRIMARY KEY, work_id INTEGER NOT NULL, user_id INTEGER NOT NULL, name TEXT, text TEXT NOT NULL, status TEXT NOT NULL DEFAULT '待審核', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS wish_points (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, work_id INTEGER, reason TEXT NOT NULL, points INTEGER NOT NULL, status TEXT NOT NULL DEFAULT '待檢核', created_at TEXT NOT NULL, checked_at TEXT);
CREATE TABLE IF NOT EXISTS wish_themes (id INTEGER PRIMARY KEY, title TEXT NOT NULL, by_name TEXT, reward TEXT, deadline TEXT, phase INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT '進行中', created_at TEXT NOT NULL);`, [
    ['GET', /^\/api\/wish\/parts$/, null, () => J({ parts: PARTS, slots: SLOTS, fields: FIELDS, stages: STAGES, planName: PLAN_NAME, phase: phaseNow() })],
    ['GET', /^\/api\/wish\/works$/, 'any', (u, m, b, q) => {
      const tab = (q && q.get('tab')) || 'all', f = (q && q.get('field')) || '', sort = (q && q.get('sort')) || 'near', hid = q && q.get('hid');
      let L = all("SELECT * FROM wish_works WHERE status<>'草稿' OR user_id=? ORDER BY id DESC", [u ? u.id : 0]);
      if (tab === 'mine') L = L.filter(w => u && w.user_id === u.id);
      else if (tab === 'theme') L = L.filter(w => w.theme_id);
      else if (tab === 'all') L = L.filter(w => w.status !== '草稿');
      if (hid) L = L.filter(w => w.household_id === +hid);
      if (f) L = L.filter(w => w.field === f);
      let R = L.map(w => brief(w, u && u.id));
      if (sort === 'near') R.sort((a, c) => (a.stage.need || 999) - (c.stage.need || 999)); else R.sort((a, c) => c.id - a.id);
      return J({ works: R, themes: all('SELECT * FROM wish_themes ORDER BY id') });
    }],
    ['GET', /^\/api\/wish\/works\/(\d+)$/, 'any', (u, m) => {
      const w = one('SELECT * FROM wish_works WHERE id=?', [+m[1]]); if (!w) return ERR('找不到作品', 404);
      const d = brief(w, u && u.id);
      d.parent = w.parent_id ? (one('SELECT id,title,user_id FROM wish_works WHERE id=?', [w.parent_id]) || null) : null; if (d.parent) d.parent.designer = nameOf(d.parent.user_id);
      d.derivatives = all('SELECT * FROM wish_works WHERE parent_id=? ORDER BY id', [w.id]).map(x => brief(x, u && u.id));
      d.updates = all('SELECT by_name,text,created_at FROM wish_updates WHERE work_id=? ORDER BY id DESC', [w.id]);
      d.comments = all("SELECT id,name,text,status,created_at,user_id FROM wish_comments WHERE work_id=? AND (status='顯示' OR user_id=?) ORDER BY id DESC", [w.id, u ? u.id : 0]);
      d.cparts = all('SELECT id,name,purpose,photo,status FROM wish_cparts WHERE work_id=?', [w.id]);
      d.eligible = !!(u && u.role === 'family' && eligible(u.id, w.field)); d.plan = PLAN_NAME[w.field];
      d.theme = w.theme_id ? one('SELECT * FROM wish_themes WHERE id=?', [w.theme_id]) : null;
      return J({ work: d });
    }],
    ['POST', /^\/api\/wish\/works$/, ['family', 'advisor'], async (u, m, b) => {
      const s = b.story || {}, title = String(b.title || s.hope || '').trim().slice(0, 40), field = FIELDS.includes(b.field) ? b.field : '';
      if (!title || !field) return ERR('請寫下希望，並選擇場域', 400);
      const txt = [s.when, s.stuck, s.hope, title].join(' '), bad = BAN.filter(([re]) => re.test(txt)).map(x => x[1]); if (bad.length) return ERR('內容要修改：' + bad.join('、'), 400);
      if (!b.terms || !b.terms.rules || !b.terms.license) return ERR('送出前要勾選投稿規範與授權', 400);
      const build = (b.build || []).filter(x => x && (x.part || x.cpart != null)).slice(0, 12);
      if (!build.length) return ERR('至少擺一個零件', 400);
      const draft = phaseNow() < 1 && field !== '臥室到浴室';
      const hid = u.role === 'family' ? await myHousehold(u) : (+b.hid || null), t = now();
      run('INSERT INTO wish_works(user_id,household_id,title,field,theme_id,parent_id,story,build,status,terms,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)', [u.id, hid, title, field, b.theme_id || null, b.parent_id || null, JSON.stringify(s), '[]', draft ? '草稿' : '共鳴中', t, t]);
      const wid = lastId(), map = {};
      for (const c of (b.cparts || []).slice(0, 5)) { if (!String(c.name || '').trim()) continue; run('INSERT INTO wish_cparts(work_id,user_id,name,purpose,photo,created_at) VALUES(?,?,?,?,?,?)', [wid, u.id, String(c.name).slice(0, 30), String(c.purpose || '').slice(0, 80), String(c.photo || '').slice(0, 90000), t]); map[c.tmp] = lastId(); }
      const B = build.map(x => x.cpart != null ? { slot: x.slot, cpart: map[x.cpart] || null } : { slot: x.slot, part: x.part }).filter(x => x.part || x.cpart);
      run('UPDATE wish_works SET build=? WHERE id=?', [JSON.stringify(B), wid]);
      run('INSERT INTO wish_updates(work_id,by_name,text,created_at) VALUES(?,?,?,?)', [wid, nameOf(u.id), draft ? '存成草稿：試點期只開放臥室到浴室，這件會當作擴展期的需求證據' : '送出作品，開始累積共鳴', t]);
      addPoints(u.id, wid, b.parent_id ? '送出衍生版（第 3 關）' : '送出作品', b.parent_id ? 100 : 50);
      if (b.parent_id) { const p = one('SELECT user_id,title FROM wish_works WHERE id=?', [+b.parent_id]); if (p) { notify(hidOfUser(p.user_id), '有人改了你的作品：' + p.title, title, 'wish:' + wid, 'wish'); run('INSERT INTO wish_updates(work_id,by_name,text,created_at) VALUES(?,?,?,?)', [+b.parent_id, nameOf(u.id), '新增衍生版「' + title + '」', t]); } }
      persist(); return J({ id: wid, status: draft ? '草稿' : '共鳴中' });
    }],
    ['POST', /^\/api\/wish\/works\/(\d+)\/support$/, 'any', (u, m, b) => {
      if (!u) return ERR('請先登入', 401);
      const w = one('SELECT * FROM wish_works WHERE id=?', [+m[1]]); if (!w) return ERR('找不到作品', 404);
      if (w.user_id === u.id) return ERR('不能支持自己的作品', 400);
      if (b.follow) { run("INSERT OR IGNORE INTO wish_supports(work_id,user_id,kind,created_at) VALUES(?,?,'follow',?)", [w.id, u.id, now()]); persist(); return J({ follow: true }); }
      if (u.role !== 'family' || !eligible(u.id, w.field)) return ERR(`訂閱「${PLAN_NAME[w.field]}」的家庭才能按「我也需要」，可以先追蹤`, 403);
      const before = count(w);
      run("INSERT INTO wish_supports(work_id,user_id,kind,buy,price,created_at) VALUES(?,?,'support',?,?,?) ON CONFLICT(work_id,user_id) DO UPDATE SET kind='support',buy=excluded.buy,price=excluded.price", [w.id, u.id, String(b.buy || ''), String(b.price || ''), now()]);
      const c = count(w);
      if (before < 20 && c >= 20) { addPoints(w.user_id, w.id, '作品共鳴達 20 戶（第 4 關）', 200); notify(hidOfUser(w.user_id), '你的作品達 20 戶共鳴：' + w.title, '+200 點待檢核', 'wish:' + w.id, 'wish'); }
      if (c >= 100 && w.status === '共鳴中') { run("UPDATE wish_works SET status='待審查', updated_at=? WHERE id=?", [now(), w.id]); run('INSERT INTO wish_updates(work_id,by_name,text,created_at) VALUES(?,?,?,?)', [w.id, '揪居家', '達到 100 戶，排入下一次每季審查', now()]); notify(hidOfUser(w.user_id), '你的作品達 100 戶，進入每季審查', w.title, 'wish:' + w.id, 'wish'); }
      persist(); return J({ count: c });
    }],
    ['POST', /^\/api\/wish\/works\/(\d+)\/comments$/, 'any', (u, m, b) => {
      if (!u) return ERR('請先登入', 401);
      const t = String(b.text || '').trim().slice(0, 200); if (!t) return ERR('請寫下留言', 400);
      const bad = BAN.filter(([re]) => re.test(t)).map(x => x[1]); if (bad.length) return ERR('留言要修改：' + bad.join('、'), 400);
      run('INSERT INTO wish_comments(work_id,user_id,name,text,created_at) VALUES(?,?,?,?,?)', [+m[1], u.id, nameOf(u.id), t, now()]); persist(); return J({ ok: true, status: '待審核' });
    }],
    ['GET', /^\/api\/points$/, 'any', (u) => { if (!u) return J({ items: [], total: 0, pending: 0 }); const L = all('SELECT p.*, w.title FROM wish_points p LEFT JOIN wish_works w ON w.id=p.work_id WHERE p.user_id=? ORDER BY p.id DESC', [u.id]); return J({ items: L, total: L.filter(x => x.status === '已入帳').reduce((a, x) => a + x.points, 0), pending: L.filter(x => x.status === '待檢核').reduce((a, x) => a + x.points, 0) }); }],
    // ---- 企業管理端 ----
    ['GET', /^\/api\/admin\/wish\/board$/, ['hq', 'advisor'], () => {
      const W = all('SELECT * FROM wish_works ORDER BY id DESC').map(w => { const d = brief(w, null); const S2 = all("SELECT buy,price FROM wish_supports WHERE work_id=? AND kind='support'", [w.id]); d.buy = { 會: S2.filter(x => x.buy === '會').length, 看價格: S2.filter(x => x.buy === '看價格').length, 不會: S2.filter(x => x.buy === '不會').length }; d.price = S2.reduce((a, x) => { if (x.price) a[x.price] = (a[x.price] || 0) + 1; return a; }, {}); d.review_note = w.review_note; return d; });
      return J({ works: W, themes: all('SELECT * FROM wish_themes ORDER BY id DESC') });
    }],
    ['POST', /^\/api\/admin\/wish\/works\/(\d+)\/status$/, ['hq'], (u, m, b) => {
      const ok = ['審查中', '評估中', '通過', '不通過', '預購', '量產'];
      if (!ok.includes(b.status)) return ERR('狀態不正確', 400);
      if (b.status === '不通過' && !String(b.note || '').trim()) return ERR('不通過要寫理由', 400);
      const w = one('SELECT * FROM wish_works WHERE id=?', [+m[1]]); if (!w) return ERR('找不到作品', 404);
      run('UPDATE wish_works SET status=?, review_note=?, updated_at=? WHERE id=?', [b.status, String(b.note || ''), now(), w.id]);
      run('INSERT INTO wish_updates(work_id,by_name,text,created_at) VALUES(?,?,?,?)', [w.id, '總部', `狀態更新：${b.status}${b.note ? '｜' + b.note : ''}`, now()]);
      const hs = new Set([hidOfUser(w.user_id), ...supportersHids(w.id)]);
      for (const h of hs) notify(h, `揪心願「${w.title}」${b.status}`, b.note || '', 'wish:' + w.id, 'wish');
      if (b.status === '量產') addPoints(w.user_id, w.id, '作品量產（設計者回饋）', 1000);
      persist(); return J({ ok: true, notified: hs.size });
    }],
    ['GET', /^\/api\/admin\/wish\/parts$/, ['hq', 'advisor'], () => {
      const P = all('SELECT c.*, w.title AS work FROM wish_cparts c LEFT JOIN wish_works w ON w.id=c.work_id ORDER BY c.id DESC');
      return J({ parts: P.map(p => { const same = P.filter(x => x.name.trim() === p.name.trim()); const used = new Set(same.map(x => x.work_id)).size; const maxc = Math.max(0, ...same.map(x => { const w = one('SELECT * FROM wish_works WHERE id=?', [x.work_id]); return w ? count(w) : 0; })); return { ...p, photo: p.photo ? 1 : 0, used, maxc, ready: used >= 5 || maxc >= 100 }; }) });
    }],
    ['POST', /^\/api\/admin\/wish\/parts\/(\d+)$/, ['hq'], (u, m, b) => { if (!['選品評估中', '通過', '不採用'].includes(b.status)) return ERR('狀態不正確', 400); run('UPDATE wish_cparts SET status=? WHERE id=?', [b.status, +m[1]]); persist(); return J({ ok: true }); }],
    ['POST', /^\/api\/admin\/wish\/themes$/, ['hq'], (u, m, b) => { if (!String(b.title || '').trim()) return ERR('請寫題目', 400); run('INSERT INTO wish_themes(title,by_name,reward,deadline,phase,created_at) VALUES(?,?,?,?,?,?)', [String(b.title).slice(0, 40), '全國電子', String(b.reward || '點數加倍'), String(b.deadline || ''), b.phase | 0, now()]); persist(); return J({ ok: true }); }],
    ['GET', /^\/api\/admin\/wish\/points$/, ['hq', 'advisor'], () => J({ points: all("SELECT p.*, u.name, w.title FROM wish_points p JOIN users u ON u.id=p.user_id LEFT JOIN wish_works w ON w.id=p.work_id ORDER BY p.status='待檢核' DESC, p.id DESC LIMIT 60") })],
    ['POST', /^\/api\/admin\/wish\/points\/(\d+)$/, ['hq', 'advisor'], (u, m, b) => { run('UPDATE wish_points SET status=?, checked_at=? WHERE id=?', [b.ok ? '已入帳' : '退回', now(), +m[1]]); persist(); return J({ ok: true }); }],
    ['GET', /^\/api\/admin\/wish\/comments$/, ['hq', 'advisor'], () => J({ comments: all("SELECT c.*, w.title FROM wish_comments c JOIN wish_works w ON w.id=c.work_id WHERE c.status='待審核' ORDER BY c.id DESC") })],
    ['POST', /^\/api\/admin\/wish\/comments\/(\d+)$/, ['hq', 'advisor'], (u, m, b) => { run('UPDATE wish_comments SET status=? WHERE id=?', [b.show ? '顯示' : '隱藏', +m[1]]); persist(); return J({ ok: true }); }],
  ], () => {
    const t = '2026-11-01 10:00:00', uid = e => (one('SELECT id FROM users WHERE email=?', [e]) || {}).id;
    const chen = uid('chen@example.com'), li = uid('li@example.com'), huang = uid('huang@example.com'), zhou = uid('zhou@example.com');
    const W = [
      [chen, '可調光感應夜燈', '臥室到浴室', { who: '長輩', when: '半夜起床上廁所', stuck: '感應夜燈太亮，很刺眼', hope: '亮度可以調低的感應夜燈' }, [{ slot: 0, part: 'light' }, { slot: 2, part: 'light' }, { slot: 3, part: 'strip' }, { slot: 4, part: 'light' }], 61, '2026-10-02 09:00:00'],
      [huang, '床邊大按鍵開關', '臥室到浴室', { who: '長輩', when: '起身找不到開關', stuck: '開關太小、在門邊', hope: '床邊伸手就按得到的大按鍵' }, [{ slot: 0, part: 'btn' }, { slot: 2, part: 'light' }], 22, '2026-10-20 09:00:00'],
      [zhou, '睡前語音報平安', '全屋', { who: '長輩', when: '每天睡前', stuck: '不會用手機傳訊息', hope: '按一下就跟家人說晚安' }, [{ slot: 0, part: 'speaker' }], 9, '2026-11-04 09:00:00'],
      [li, '浴室門口止滑地墊', '臥室到浴室', { who: '長輩', when: '洗完澡出浴室', stuck: '門口地板濕滑', hope: '吸水又不會翹起的止滑墊' }, [{ slot: 4, part: 'mat' }, { slot: 3, part: 'strip' }], 5, '2026-11-12 09:00:00'],
    ];
    const ids = [];
    for (const [u2, ti, f, st, bd, base, at] of W) { if (!u2) continue; run('INSERT INTO wish_works(user_id,household_id,title,field,story,build,status,base,terms,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?,?)', [u2, hidOfUser(u2), ti, f, JSON.stringify(st), JSON.stringify(bd), '共鳴中', base, at, at]); ids.push(lastId()); run('INSERT INTO wish_updates(work_id,by_name,text,created_at) VALUES(?,?,?,?)', [lastId(), nameOf(u2), '送出作品，開始累積共鳴', at]); }
    if (ids[0] && li) {
      run('INSERT INTO wish_works(user_id,household_id,title,field,parent_id,story,build,status,base,terms,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)', [li, hidOfUser(li), '床底燈條版夜燈', '臥室到浴室', ids[0], JSON.stringify({ who: '長輩', when: '半夜起床', stuck: '光從上面照下來刺眼', hope: '光從床底照地面' }), JSON.stringify([{ slot: 0, part: 'strip' }, { slot: 2, part: 'light' }]), '共鳴中', 3, '2026-11-15 09:00:00', '2026-11-15 09:00:00']);
      run('INSERT INTO wish_updates(work_id,by_name,text,created_at) VALUES(?,?,?,?)', [ids[0], '總部', '已開始評估可調光款式的供應商', '2026-11-20 15:00:00']);
      run("INSERT INTO wish_comments(work_id,user_id,name,text,status,created_at) VALUES(?,?,?,?,'顯示',?)", [ids[0], huang, nameOf(huang), '我家也是，燈太亮爸爸睡不著', '2026-11-18 20:00:00']);
    }
    run("INSERT INTO wish_themes(title,by_name,reward,deadline,phase,created_at) VALUES('500 元內，讓夜路更亮','全國電子','點數加倍＋零件 9 折券','2026-12-31',0,?)", [t]);
    run("INSERT INTO wish_themes(title,by_name,reward,deadline,phase,created_at) VALUES('好鄰居題：幫隔壁獨居長輩想一個方法','全國電子｜揪感心','點數加倍＋社區健檢日優先名額','2026-12-20',0,?)", [t]);
    run("INSERT INTO wish_themes(title,by_name,reward,deadline,phase,created_at) VALUES('補助結束後，舊冷氣怎麼養得更久','全國電子 × 居家清潔夥伴','點數加倍＋冷氣清洗搭打掃折扣','2027-01-31',1,?)", [t]);
  });
  S.WISH = { PARTS, SLOTS, FIELDS, PLAN_NAME };
})();
