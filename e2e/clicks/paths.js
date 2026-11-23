// 各任務在改版前（before）與改版後（after）的最短點擊路徑；done 是抵達目標時一定看得到的元素
const TASKS = [
  ['T1', '幫林媽媽家開始居家診斷', 'app.html', 'chen@example.com', '家庭（陳小姐）'],
  ['T2', '找到林媽媽家的通知設定', 'app.html', 'chen@example.com', '家庭（陳小姐）'],
  ['T3', '看長輩家昨晚有沒有異常', 'app.html', 'li@example.com', '家庭（李家）'],
  ['T4', '找到黃先生家的報價草稿並送出', 'consultant.html', 'advisor@example.com', '生活顧問（電腦）'],
  ['T5', '回報「浴室門是推拉門」現場差異', 'app.html', 'tech@example.com', '技師'],
  ['T6', '找到待回覆的揪心願', 'admin.html', 'manager@example.com', '總部'],
];
const mk = (S) => TASKS.map(([id, name, page, who, whoName]) => ({ id, name, page, who, whoName, ...S[id] }));
const LAND = (S) => [
  { id: 'L1', name: '家庭端首頁', page: 'app.html', who: 'chen@example.com' },
  { id: 'L2', name: '揪居家主頁（先評估）', page: 'app.html', who: 'chen@example.com', steps: S.m2c },
  { id: 'L3', name: '揪居家主頁（後關心）', page: 'app.html', who: 'li@example.com', steps: [S.m2] },
  { id: 'L4', name: '會員中心', page: 'app.html', who: 'chen@example.com', steps: ['[data-nav="m1"]'] },
  { id: 'L5', name: '生活顧問手機版首頁', page: 'app.html', who: 'advisor@example.com' },
  { id: 'L6', name: '生活顧問電腦版首頁', page: 'consultant.html', who: 'advisor@example.com' },
  { id: 'L7', name: '技師施工頁', page: 'app.html', who: 'tech@example.com', steps: ['[data-id="6"]'] },
  { id: 'L8', name: '企業管理端首頁', page: 'admin.html', who: 'manager@example.com' },
];
const TXT = { fill: '#tdfTxt', text: '浴室門是推拉門，感測器要改裝在門框側邊' };
module.exports = {
  before: {
    tasks: mk({
      T1: { steps: ['.agq [data-go="b1"]'], done: ['[data-a="loginChild"]', 'text=開始 AR 掃描'] },
      T2: { steps: ['[data-nav="m1"]', '[data-go="nset"]'], done: 'text=通知設定' },
      T3: { steps: ['.entry'], done: '.jhero' },
      T4: { steps: ['[data-case="2"]', '[data-tab="5"]', '[data-q="send"]'], done: ['text=/已送出|已建立|v\\d/'] },
      T5: { steps: ['[data-id="6"]', '[data-tgrp="浴室"]', '[data-tsel="pin:D1"]', '[data-a="tDiffGo"]', TXT, '[data-a="tdfSend"]'], done: 'text=差異' },
      T6: { steps: ['[data-tab="wl"]'], done: 'text=揪心願' },
    }),
    landing: LAND({ m2: '.entry', m2c: ['[data-nav="m1"]', '[data-go="m2"]'] }),
  },
  after: {
    tasks: mk({
      T1: { steps: ['[data-hb="0"]'], done: ['[data-a="loginChild"]', 'text=開始 AR 掃描'] },
      T2: { steps: ['[data-nav="m1"]', '[data-go="nset"]'], done: 'text=通知設定' },
      T3: { steps: ['[data-go="m2"]'], done: '.today-sum' },
      T4: { steps: ['[data-case="2"]', '[data-tab="5"]', '[data-q="send"]'], done: ['text=/已送出|已建立|v\\d/'] },
      T5: { steps: ['[data-id="6"]', '[data-a="tDiffNow"]', { select: '#tdfPin', value: 'D1' }, TXT, '[data-a="tdfSend"]'], done: 'text=差異' },
      T6: { steps: ['[data-tab="wl"]'], done: 'text=揪心願' },
    }),
    landing: LAND({ m2: '[data-go="m2"]', m2c: ['[data-go="m2"]'] }),
  },
};
