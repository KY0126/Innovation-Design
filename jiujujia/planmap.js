// 揪居家｜方案圖面（共用）
// 生活顧問電腦版用來編輯方案圖面；繪圖函式與 App 相同（座標、標記樣式一致）。
(function () {
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HPJ={O:[620, 194.8687947858078],EX:[53.19165665853666, 34.190937838807855],EY:[0, -57.62520469000387],EZ:[-53.19165665853666, 34.190937838807855],FT:0.12};
const HPV=[180.5,18.5,932.5,806.0];
const hpp=(x,y,z)=>[HPJ.O[0]+x*HPJ.EX[0]+y*HPJ.EY[0]+z*HPJ.EZ[0],HPJ.O[1]+x*HPJ.EX[1]+y*HPJ.EY[1]+z*HPJ.EZ[1]];
const hps=a=>a.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
const PKC={A:'#C42D5A',B:'#8E1E42',S:'#C42D5A'},PKN={A:'關懷設備',B:'夜間照明',S:'設備檢修'};
const PIC={light:'燈',door:'門',btn:'鈕',gw:'閘',motion:'感',strip:'條',outlet:'插',note:'!'};
const STC={plan:'#C42D5A',done:'#8E1E42',diff:'#FF7A59',lock:'#BDBBB5'};
function hpInv(sx,sy){const a=HPJ.EX[0],b=HPJ.EZ[0],c=HPJ.EX[1],d=HPJ.EZ[1],u=sx-HPJ.O[0],v=sy-HPJ.O[1]-HPJ.FT*HPJ.EY[1],det=a*d-b*c;return [(u*d-b*v)/det,(a*v-c*u)/det]}
function pinColor(p,o){if(o&&o.lockPkg&&o.lockPkg[p.pkg])return STC.lock;if(o&&o.byStatus){if(p.st==='done')return STC.done;if(p.st==='diff')return STC.diff;if(o.mine&&!o.mine[p.pkg])return STC.lock;return STC.plan}return PKC[p.pkg]||PKC.A}
function hpPins(pins,o={}){return (pins||[]).map(p=>{const [x,y]=hpp(p.x,HPJ.FT+.35,p.y),c=pinColor(p,o),on=o.sel===p.id,big=o.big?1.25:1,r=(p.k==='note'?17:21)*big;
 return `<g ${o.click?`data-pin="${esc(p.id)}" style="cursor:pointer"`:''} transform="translate(${x.toFixed(0)},${y.toFixed(0)})">${on?`<circle r="${r+14}" fill="none" stroke="#C42D5A" stroke-width="5"/>`:''}<path d="M0 ${r+16} L${-r*.55} ${r*.55} A${r} ${r} 0 1 1 ${r*.55} ${r*.55} Z" fill="${c}" stroke="#fff" stroke-width="4"/><text y="${r*.36}" font-size="${r*1.05}" font-weight="700" text-anchor="middle" fill="#fff">${p.k==='note'?'!':o.letters?p.pkg:(PIC[p.k]||'•')}</text>${p.st==='done'&&o.byStatus?`<circle cx="${r*.8}" cy="${-r*.8}" r="11" fill="#fff"/><path d="M${r*.8-6} ${-r*.8} l4 4 l8 -8" stroke="#8E1E42" stroke-width="3.5" fill="none"/>`:''}</g>`}).join('')}
function hpPath(){const FT=HPJ.FT,pts=[[2.85,1.4],[3.05,2.6],[3.45,3.5],[3.6,4.05],[4.8,4.05],[5.0,3.5],[4.9,2.3],[4.75,1.3]].map(([x,z])=>hpp(x,FT+.02,z));
 return `<polyline points="${hps(pts)}" fill="none" stroke="#fff" stroke-width="14" stroke-dasharray="1 16" stroke-linecap="round"/><polyline points="${hps(pts)}" fill="none" stroke="#8E1E42" stroke-width="8" stroke-dasharray="1 16" stroke-linecap="round"/>`}
function render(pins, o = {}) {
  return `<div class="hpw pm ${o.edit ? 'edit' : ''}" ${o.edit ? 'data-pmap="1"' : ''} style="position:relative;border-radius:10px;overflow:hidden;background:#F6F3EE;user-select:none"><img src="home/plan.jpg" alt="${esc(o.alt || '方案圖面')}" style="display:block;width:100%"><svg viewBox="${HPV.join(' ')}" style="position:absolute;inset:0;width:100%;height:100%">${o.path ? hpPath() : ''}${hpPins(pins, { ...o, click: true })}</svg></div>`;
}
// 點圖面時換算成平面座標（公尺）
function toPlan(e, el) {
  const sv = el.querySelector('svg'), rc = sv.getBoundingClientRect();
  const sx = HPV[0] + (e.clientX - rc.left) / rc.width * HPV[2], sy = HPV[1] + (e.clientY - rc.top) / rc.height * HPV[3];
  let [x, z] = hpInv(sx, sy); x = Math.max(0, Math.min(9, x)); z = Math.max(0, Math.min(9, z));
  return [Math.round(x * 100) / 100, Math.round(z * 100) / 100];
}
window.JJJPM = { render, toPlan, PKC, PKN };
})();
