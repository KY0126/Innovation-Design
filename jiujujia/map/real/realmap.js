// 揪居家｜真實地圖（MapLibre GL + PMTiles，底圖 © OpenStreetMap 貢獻者，ODbL）
// 圖資只含高雄三民區一帶（試點範圍）；技師位置與路線為示範資料，正式版改接技師 App 的 GPS 回報。
const BASE = new URL('./', import.meta.url).href;
const css = href => new Promise(ok => { if (document.querySelector(`link[href="${href}"]`)) return ok(); const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = ok; l.onerror = ok; document.head.appendChild(l); });
const js = src => new Promise((ok, no) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('地圖元件載入失敗')); document.head.appendChild(s); });
let LIB = null;
export function loadLibs() {
  return LIB || (LIB = (async () => {
    await css(BASE + 'maplibre-gl.css'); await js(BASE + 'maplibre-gl.js'); await js(BASE + 'pmtiles.js'); await js(BASE + 'basemaps.js');
    const p = new pmtiles.Protocol(); maplibregl.addProtocol('pmtiles', p.tile);
    return window.maplibregl;
  })());
}
export const STORES = { 民族店: [120.3166, 22.6597], 澄清店: [120.345, 22.6505], 三民中華店: [120.307, 22.6565] };
export const HOME = [120.3236, 22.6652];
export const ICON = k => BASE + 'icons/' + k + '.png';
let ROUTE = null;
export async function demoRoute() { if (!ROUTE) ROUTE = await (await fetch(BASE + 'route-demo.json')).json(); return ROUTE; }

function style() {
  const L = (src, pre) => basemaps.layers(src, basemaps.namedFlavor('light'), { lang: 'zh-Hant' }).map(l => pre ? { ...l, id: pre + l.id } : l);
  const A = L('protomaps'), B = L('p2', 'b_').filter(l => l.type !== 'background'), lab = l => l.type === 'symbol';
  return {
    version: 8, glyphs: BASE + 'fonts/{fontstack}/{range}.pbf', sprite: BASE + 'sprites/light',
    sources: {
      protomaps: { type: 'vector', url: 'pmtiles://' + BASE + 'tiles/kh.pmtiles', attribution: '© OpenStreetMap 貢獻者' },
      p2: { type: 'vector', url: 'pmtiles://' + BASE + 'tiles/kh2.pmtiles' }
    },
    layers: [...A.filter(l => !lab(l)), ...B.filter(l => !lab(l)), ...A.filter(lab), ...B.filter(lab)]
  };
}
export async function createMap(el, { center = STORES.民族店, zoom = 15, interactive = true, fit, padding = 40 } = {}) {
  const ml = await loadLibs(); const bounds = fit && boundsOf(fit);
  const map = new ml.Map({ container: el, style: style(), center, zoom, interactive, attributionControl: { compact: true }, localIdeographFontFamily: "'Noto Sans TC','Noto Sans CJK TC','PingFang TC','Microsoft JhengHei',sans-serif", maxBounds: [[120.234, 22.594], [120.41, 22.675]], dragRotate: false, pitchWithRotate: false });
  if (interactive) map.touchZoomRotate.disableRotation();
  if (bounds) map.fitBounds(bounds, { padding, duration: 0 });
  await new Promise(ok => map.loaded() ? ok() : map.once('load', ok));
  return map;
}
export function boundsOf(pts) { const ml = window.maplibregl, b = new ml.LngLatBounds(); pts.forEach(p => b.extend(p)); return b; }
export function line(map, id, coords, color, width = 5) {
  const data = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } };
  if (map.getSource(id)) { map.getSource(id).setData(data); return; }
  map.addSource(id, { type: 'geojson', data });
  map.addLayer({ id: id + '_c', type: 'line', source: id, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': width + 4 } });
  map.addLayer({ id, type: 'line', source: id, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': width } });
}
// 依路線長度切成「已走／未走」，回傳目前位置
export function split(path, frac) {
  const seg = []; let L = 0; for (let i = 1; i < path.length; i++) { const d = dist(path[i - 1], path[i]); seg.push(d); L += d; }
  let acc = 0; const tgt = L * Math.max(0, Math.min(1, frac));
  for (let i = 1; i < path.length; i++) { if (acc + seg[i - 1] >= tgt) { const k = seg[i - 1] ? (tgt - acc) / seg[i - 1] : 0, p = [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k]; return { done: path.slice(0, i).concat([p]), rest: [p].concat(path.slice(i)), cur: p, next: path[i], len: L }; } acc += seg[i - 1]; }
  const e = path[path.length - 1]; return { done: path, rest: [e], cur: e, next: e, len: L };
}
export function dist(a, b) { const kx = 102700, ky = 110700; return Math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky); }
export function heading(a, b) { return Math.atan2((b[0] - a[0]) * 102700, (b[1] - a[1]) * 110700) * 180 / Math.PI; }
const tag = (t, bg) => `<div class="rmTag" style="background:${bg}">${t}</div>`;
function addCss() {
  if (document.getElementById('rmCss')) return; const s = document.createElement('style'); s.id = 'rmCss';
  s.textContent = `.rmTag{font:600 13px/1.3 'Noto Sans TC',sans-serif;color:#fff;padding:4px 9px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.25)}
.rmPin{display:flex;flex-direction:column;align-items:center;gap:2px}.rmAv{display:flex;align-items:center;gap:4px}.rmAv .rmPh{position:relative;width:54px;height:64px}.rmAv .rmPh img{width:54px;height:64px;display:block}
.rmAv .rmPh b{position:absolute;left:0;top:10px;width:46px;text-align:center;font:900 22px/1 'Noto Sans TC',sans-serif;color:#2F7A4C}
.rmVan{width:64px;height:64px;position:relative}.rmVan i{position:absolute;inset:0;border-radius:50%;background:rgba(196,45,90,.16);border:2px solid rgba(196,45,90,.55);animation:rmPulse 1.8s ease-out infinite}
.rmVan img{position:absolute;left:17px;top:7px;width:30px;transition:transform .6s}@keyframes rmPulse{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.15);opacity:.25}}
.maplibregl-ctrl-attrib{font-size:10px}`;
  document.head.appendChild(s);
}
export function marker(map, ll, html, opt = {}) { addCss(); const el = document.createElement('div'); el.innerHTML = html; return new maplibregl.Marker({ element: el, ...opt }).setLngLat(ll).addTo(map); }
export const storePin = (map, ll, name, w = 34) => marker(map, ll, `<div class="rmPin"><img src="${ICON('store')}" width="${w}" alt="">${tag(name, '#3D3A40')}</div>`, { anchor: 'top', offset: [0, -Math.round(w * 1.25)] });
export const homePin = (map, ll, w = 32) => marker(map, ll, `<img src="${ICON('home')}" width="${w}" alt="住家">`, { anchor: 'bottom' });
export function vanMarker(map, ll, deg) { const m = marker(map, ll, `<div class="rmVan" aria-label="技師工程車"><i></i><img src="${ICON('van')}" alt="" style="transform:rotate(${deg}deg)"></div>`); m.turn = d => { const i = m.getElement().querySelector('img'); if (i) i.style.transform = `rotate(${d}deg)`; }; return m; }
// 技師頭像：k = go 出發中｜work 施工中｜free 空檔；沒有照片時顯示姓氏
export const ST = { go: ['出發中', '#C42D5A'], work: ['施工中', '#B07A10'], free: ['空檔', '#3C8D5A'] };
export function avatar(map, ll, { name, k = 'free', photo = true, text, left = false }) {
  const [lab, c] = ST[k] || ST.free;
  const img = photo ? `<div class="rmPh"><img src="${ICON('av_' + k)}" alt=""></div>` : `<div class="rmPh"><img src="${ICON('av_none')}" alt=""><b>${name.slice(0, 1)}</b></div>`;
  const t = tag(`${name}｜${text || lab}`, c);
  return marker(map, ll, `<div class="rmAv">${left ? t + img : img + t}</div>`, { anchor: left ? 'bottom-right' : 'bottom-left', offset: left ? [29, 0] : [-29, 0] });
}
