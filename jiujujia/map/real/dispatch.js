// 揪居家｜總部：即時派工地圖（⑥）
// 只在「出發到抵達」與「施工中」顯示技師位置；空檔或下班只顯示所屬門市，不追蹤個人位置。
// 技師、家庭、時間皆為示範資料；正式版接技師 App 的位置回報（約每 10 秒）。
import * as R from './realmap.js?v=20261127a';

const TECHS = [
  { n: '吳技師', st: '民族店', k: 'go', job: 'W-20261127-06｜李先生家｜夜間照明 3 盞', note: '7 分鐘後抵達', today: 4 },
  { n: '陳技師', st: '民族店', k: 'work', job: 'W-20261127-04｜林媽媽家｜夜燈＋門檻燈條', note: '預計 17:30 完成', today: 1, at: [120.3205, 22.6630] },
  { n: '林技師', st: '民族店', k: 'free', note: '下一件 18:00', today: 3 },
];
// 非試點門市：只列基本資訊，不上地圖
const OTHERS = [['蔡技師', '澄清店', '今日 3 件'], ['黃技師', '三民中華店', '今日 3 件']];
const CAP = 12;
let CACHE = null, F = 'all';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function side() {
  const cnt = k => TECHS.filter(t => k === 'all' || t.k === k).length;
  const chips = [['all', '全部'], ['go', '出發中'], ['work', '施工中'], ['free', '空檔']].map(([k, n]) => `<button class="b ${F === k ? 'pri' : ''}" data-dpf="${k}">${n} ${cnt(k)}</button>`).join('');
  const list = TECHS.filter(t => F === 'all' || t.k === F).map(t => { const [lab, c] = R.ST[t.k], w = Math.round(t.today / CAP * 100);
    return `<div style="display:flex;flex-direction:column;gap:3px;padding:8px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px"><b>${t.n}<small class="c-mu" style="font-weight:400">｜${t.st}</small></b><span style="color:${c};font-size:12.5px">${lab}｜${t.note}</span></div>
      <div style="height:6px;border-radius:3px;background:#EEE8EB"><div style="width:${w}%;height:6px;border-radius:3px;background:${c}"></div></div><span class="c-mu" style="font-size:12px">今日 ${t.today} 件｜上限 10–12 件（訪談）${t.job ? '｜' + esc(t.job) : ''}</span></div>`; }).join('');
  const go = TECHS[0];
  return `<div style="display:flex;gap:6px;flex-wrap:wrap">${chips}</div><div>${list}</div>
   <div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px"><b>${go.n}｜${esc(go.job)}</b>
    <span style="font-size:12.5px">● 16:35 出發　○ 預計 16:42 抵達　○ 施工、長輩驗收</span>
    <span class="c-mu" style="font-size:12px">若比預計晚 15 分鐘，自動通知家庭與門市</span>
    <div style="display:flex;gap:6px"><button class="b" data-dpa="re">改派給空檔技師</button><button class="b" data-dpa="call">撥給技師</button></div></div>
   <div class="c-mu" style="font-size:12px;display:flex;flex-direction:column;gap:2px"><b style="color:inherit">其他門市（非試點，只列基本資訊）</b>${OTHERS.map(([n, s, t]) => `<span>${n}｜${s}｜${t}</span>`).join('')}</div>`;
}
export async function mountDispatch(el, { toast } = {}) {
  const sideEl = document.getElementById('dpSide');
  const wire = () => { if (sideEl) sideEl.innerHTML = side(); };
  if (CACHE) { el.replaceWith(CACHE.box); CACHE.map.resize(); wire(); return; }
  const box = document.createElement('div'); box.id = 'dpMap'; box.style.cssText = el.style.cssText; el.replaceWith(box);
  const path = await R.demoRoute(), S = R.STORES;
  const map = await R.createMap(box, { fit: [S.民族店, R.HOME, [120.3205, 22.6630], [120.3121, 22.6535]], padding: { top: 90, bottom: 60, left: 90, right: 150 } });
  CACHE = { box, map, mk: [] };
  const s = R.split(path, .3); R.line(map, 'rest', s.rest, '#C42D5A', 4); R.line(map, 'done', s.done, '#9AA0A6', 4);
  R.storePin(map, S.民族店, '民族店', 32); R.homePin(map, R.HOME, 30);
  const off = { 民族店: [[0, 0], [-0.0045, -0.0062]] }, used = {};
  const draw = () => {
    CACHE.mk.forEach(m => m.remove()); CACHE.mk = [];
    TECHS.forEach(t => { if (F !== 'all' && t.k !== F) return;
      let ll = t.k === 'go' ? s.cur : t.at; if (!ll) { const i = used[t.st] = (used[t.st] || 0) + 1, o = (off[t.st] || [[0, 0]])[i % (off[t.st] || [1]).length] || [0, 0]; ll = [S[t.st][0] + o[0], S[t.st][1] + o[1]]; }
      CACHE.mk.push(R.avatar(map, ll, { name: t.n, k: t.k, photo: t.photo !== false, text: t.k === 'go' ? '7 分鐘' : null, left: t.k === 'go' })); });
    Object.keys(used).forEach(k => delete used[k]);
  };
  CACHE.draw = draw; draw(); wire();
  document.addEventListener('click', e => {
    const f = e.target.closest('[data-dpf]'), a = e.target.closest('[data-dpa]');
    if (f) { F = f.dataset.dpf; CACHE.draw(); const se = document.getElementById('dpSide'); if (se) se.innerHTML = side(); }
    if (a && toast) toast(a.dataset.dpa === 're' ? '示範：會列出同門市空檔技師（林技師），確認後通知家庭新的到府時間' : '示範：經由門市總機轉接技師');
  });
}
