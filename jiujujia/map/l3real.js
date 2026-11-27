// 揪居家服務地圖｜第三層：民族店真實街區（B 混合版＋依街景重建）
// 道路、公園、水域、大樓輪廓：OpenStreetMap（© OpenStreetMap 貢獻者，ODbL），scene.json 由 PMTiles 匯出。
// 暖色透天厝：沿真實街道補上的示意建物（OSM 在這一帶的建物資料很少）。
// 民族店與鄰房、路口：依 Google 街景外觀重建的示意量體；看板只用色塊，不放真實廣告或其他店家名稱。
import * as THREE from '../vendor/three.module.min.js';

export const U = 7;                          // 1 單位＝7 公尺
const OX = 45, OZ = -6.5;                    // 讓民族店中心落在原點（scene.json 原點為 120.3166, 22.6600）
const P = (x, z) => [(x + OX) / U, (z + OZ) / U];
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
let DATA = null;
export async function loadScene() { if (!DATA) DATA = await (await fetch(new URL('./real/scene.json', import.meta.url))).json(); return DATA; }

// ---------- 合併繪製：同材質的方塊合成一個 Mesh，900 多棟透天厝也順 ----------
const BOX = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(), CYL = new THREE.CylinderGeometry(.5, .5, 1, 12).toNonIndexed();
function batch(mat) {
  const G = {}, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const add = (geo, c, o, M) => { const k = c + JSON.stringify(o || {}); (G[k] || (G[k] = { c, o, L: [] })).L.push([geo, M]); };
  return {
    box(w, h, d, c, x, y, z, o, parent, rx = 0, ry = 0) { const M = new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), q.setFromEuler(e.set(rx, ry, 0)), new THREE.Vector3(w, h, d)); if (parent) M.premultiply(parent); add(BOX, c, o, M); },
    cyl(r, h, c, x, y, z, o, parent) { const M = new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), q.identity(), new THREE.Vector3(r * 2, h, r * 2)); if (parent) M.premultiply(parent); add(CYL, c, o, M); },
    build(scene) {
      for (const g of Object.values(G)) {
        let n = 0; g.L.forEach(([geo]) => n += geo.attributes.position.count);
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), v = new THREE.Vector3(), nm = new THREE.Matrix3(); let k = 0;
        for (const [geo, M] of g.L) { nm.getNormalMatrix(M); const pa = geo.attributes.position, na = geo.attributes.normal;
          for (let i = 0; i < pa.count; i++, k++) { v.fromBufferAttribute(pa, i).applyMatrix4(M); pos.set([v.x, v.y, v.z], k * 3); v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], k * 3); } }
        const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        const m = new THREE.Mesh(bg, mat(g.c, g.o)); m.castShadow = m.receiveShadow = true; m.userData.base = 1; scene.add(m);
      }
    }
  };
}
const ZX = [[-95, 12, -60, 26], [-200, -98, -12, 40], [-100, 120, 20, 47]];   // 重建區塊：清掉原本補的透天厝
const inZ = (x, z) => ZX.some(([a, b, c, d]) => x > a && x < b && z > c && z < d);
const FACADE = ['#E9DFCF', '#D8D3CB', '#E7D5CC', '#F1EEE8', '#CFC6B8', '#E3E0D6', '#D9CFC2'];

// 透天厝：騎樓、陽台、鐵窗、冷氣、水塔、鐵皮加蓋、直招
function townhouse(B, seed, M, NIGHT) {
  const r = k => hash(seed + k), w = .9, d = 1.3, fl = 3 + Math.floor(r('f') * 3), fh = .5, H = fl * fh, face = FACADE[Math.floor(r('c') * FACADE.length)];
  const em = (c, i) => NIGHT ? { emissive: c, emissiveIntensity: i } : {};
  B.box(w, fh, d - .32, '#5F5B57', 0, 0, -.16, null, M);
  const lit0 = NIGHT && r('s0') > .25; B.box(w * .84, fh * .72, .03, lit0 ? '#FFE3A3' : '#93A9B5', 0, .03, d / 2 - .33, lit0 ? em('#FFC870', .9) : null, M);
  [-w / 2 + .05, w / 2 - .05].forEach(x => B.box(.09, fh, .09, face, x, 0, d / 2 - .05, null, M));
  B.box(w, H - fh, d, face, 0, fh, 0, null, M);
  for (let i = 1; i < fl; i++) { const y = i * fh, lit = NIGHT && r('w' + i) > .35;
    B.box(w, .035, .16, '#B8B2A8', 0, y, d / 2 + .08, null, M); B.box(w, .15, .012, '#6E6A65', 0, y + .035, d / 2 + .16, null, M);
    B.box(w * .62, fh * .48, .02, lit ? '#FFD98A' : '#56656D', 0, y + fh * .22, d / 2 + .004, lit ? em('#FFC56A', 1.2) : null, M);
    if (r('ac' + i) > .45) B.box(.2, .13, .09, '#EDEBE7', w / 2 - .16, y + .04, d / 2 + .05, null, M); }
  B.box(w, .05, d, '#A39D94', 0, H, 0, null, M);
  if (r('t') > .3) { B.cyl(.12, .24, '#D6DADD', -w * .22, H + .15, -d * .2, null, M); B.box(.28, .1, .28, '#8A867F', -w * .22, H + .05, -d * .2, null, M); }
  if (r('sh') > .55) { B.box(w * .88, .3, d * .42, '#C4CACE', 0, H + .05, -d * .26, null, M); B.box(w * .94, .025, d * .48, '#6F93AA', 0, H + .36, -d * .26, null, M, .1); }
  if (r('sg') > .5) { const c = ['#C42D5A', '#2F6E9E', '#D99A16', '#3C8D5A'][Math.floor(r('sc') * 4)]; B.box(.035, .4, .2, c, w / 2 + .02, fh + .12, d / 2 - .08, em(c, .8), M); }
}
function winTex(NIGHT, seed) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = NIGHT ? '#4B4857' : '#DCE0E5'; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 2; i++) { const on = NIGHT && hash(seed + i) > .4; x.fillStyle = NIGHT ? (on ? '#FFD27A' : '#2E2C36') : '#7E909C'; x.fillRect(8 + i * 28, 18, 20, 24); }
  x.fillStyle = NIGHT ? '#3A3845' : '#C4C9CF'; x.fillRect(0, 58, 64, 6);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.6, 2); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function diagTex(NIGHT) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d'); x.fillStyle = NIGHT ? '#C9C7CC' : '#F4F3F1'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = NIGHT ? '#B3B1B8' : '#E2E0DD'; x.lineWidth = 3; for (let i = -128; i < 256; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 2); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// 背景住家位置（供家庭號碼對應；不代表真實地址）
export function housesNear(D, rmax = 24) {
  return D.houses.map((h, i) => { const [x, z] = P(h.x, h.z); return { i, x, z, a: h.a, d: Math.hypot(x, z), out: inZ(h.x, h.z) }; }).filter(h => !h.out && h.d > 3 && h.d < rmax);
}

// 建場景：回傳 { store: 民族店 Group, house(i): 單棟透天厝 Group, graph: 道路網 }
export function buildReal(scene, D, { mat, NIGHT, skip = new Set() }) {
  const B = batch(mat), em = (c, i = 1) => NIGHT ? { emissive: c, emissiveIntensity: i } : {};
  const C = NIGHT ? { gr: '#2B2A31', rd: '#3A3940', sw: '#57555B', ln: '#C9C6BF' } : { gr: '#D8D2CA', rd: '#86848A', sw: '#DCD6CF', ln: '#F4F2EE' };
  B.box(80, .2, 64, C.gr, -OX / U, -.2, -OZ / U);
  // 道路（明誠一路改成實際的多車道寬度）
  const roads = D.roads.map(r => ({ ...r, w: /明誠/.test(r.n || '') ? 24 : r.w }));
  for (const r of roads) { const w = r.w / U; for (let i = 1; i < r.p.length; i++) { const a = P(...r.p[i - 1]), b = P(...r.p[i]), len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < .01) continue;
    const ang = Math.atan2(b[0] - a[0], b[1] - a[1]), cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
    B.box(w + .5, .02, len + .5, C.sw, cx, 0, cz, null, null, 0, ang); B.box(w, .03, len + w * .9, C.rd, cx, .005, cz, null, null, 0, ang);
    if (r.w >= 10) for (let t = .6; t < len - .3; t += 1.1) { const k = t / len; B.box(.05, .01, .5, C.ln, a[0] + (b[0] - a[0]) * k, .04, a[1] + (b[1] - a[1]) * k, null, null, 0, ang); } } }
  for (const a of (D.areas || [])) { const sh = new THREE.Shape(a.p.map(([x, z]) => { const [u, v] = P(x, z); return new THREE.Vector2(u, -v); })); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat(a.t === 'w' ? (NIGHT ? '#24344A' : '#A9D3E8') : (NIGHT ? '#2F4A36' : '#B5D3A2'))); m.position.y = a.t === 'w' ? .012 : .008; m.receiveShadow = true; m.userData.base = 1; scene.add(m); }
  // OSM 建物
  const roofM = mat(NIGHT ? '#3E3B48' : '#C9CDD2');
  D.blds.forEach((b, i) => { const cx = b.p.reduce((s, p) => s + p[0], 0) / b.p.length, cz = b.p.reduce((s, p) => s + p[1], 0) / b.p.length; if (inZ(cx, cz)) return;
    const sh = new THREE.Shape(b.p.map(([x, z]) => { const [u, v] = P(x, z); return new THREE.Vector2(u, -v); })), h = (b.h || (14 + Math.floor(hash('b' + i) * 4) * 3.5)) / U;
    const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, [roofM, new THREE.MeshStandardMaterial({ map: winTex(NIGHT, 'b' + i), roughness: .8 })]); m.castShadow = m.receiveShadow = true; m.userData.base = 1; scene.add(m); });
  // 透天厝（家庭用的那幾棟另外建，才能點選）
  const keep = {};
  D.houses.forEach((h, i) => { if (inZ(h.x, h.z)) return; const [x, z] = P(h.x, h.z), M = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.a), new THREE.Vector3(1, 1, 1));
    if (skip.has(i)) { keep[i] = M; return; } townhouse(B, 'h' + i, M, NIGHT); });
  // ===== 民族店與鄰房（公尺，原座標；M() 換算）=====
  const M = (w, h, d, c, x, y, z, o) => { const [u, v] = P(x, z); B.box(w / U, h / U, d / U, c, u, y / U, v, o); };
  const store = new THREE.Group(), SM = (w, h, d, c, x, y, z, o) => { const [u, v] = P(x, z); const m = new THREE.Mesh(new THREE.BoxGeometry(w / U, h / U, d / U), mat(c, o)); m.position.set(u, (y + h / 2) / U, v); m.castShadow = m.receiveShadow = true; store.add(m); };
  const RED = '#D7263D', glass = NIGHT ? '#FFE7B8' : '#3E5563', gO = NIGHT ? { emissive: '#FFD9A0', emissiveIntensity: 1.1 } : { roughness: .15, metalness: .3 };
  { const w = 42, d = 25, h = 12.5, cx = -45, cz = 6.5, wall = new THREE.MeshStandardMaterial({ map: diagTex(NIGHT), roughness: .8 });
    const [u, v] = P(cx, cz), m = new THREE.Mesh(new THREE.BoxGeometry(w / U, h / U, d / U), [wall, wall, mat('#E9E7E4'), wall, wall, wall]); m.position.set(u, h / 2 / U, v); m.castShadow = m.receiveShadow = true; store.add(m);
    const fz = cz + d / 2, wx = cx - w / 2;
    SM(w - .4, 4.4, .3, glass, cx, 0, fz + .1, gO); for (let i = 0; i < 7; i++) SM(.9, 4.4, .6, '#F7F6F4', cx - w / 2 + .5 + i * (w - 1) / 6, 0, fz + .3);
    SM(w + .2, 2.4, .7, RED, cx, 4.4, fz + .3, em(RED, .9)); SM(w + .2, .25, .75, '#FFFFFF', cx, 5.5, fz + .32, em('#FFFFFF', .6));
    [[-14, '#2C4A7A'], [0, '#DCE8F2'], [14, '#1F2B3A']].forEach(([dx, c]) => { SM(9, 4.6, .25, '#FFFFFF', cx + dx, 7.2, fz + .15); SM(8.4, 4, .3, c, cx + dx, 7.5, fz + .2, em(c, .55)); });
    SM(.3, 4.4, d - .4, glass, wx - .1, 0, cz, gO); SM(.7, 2.4, d + .2, RED, wx - .3, 4.4, cz, em(RED, .9));
    [[-6, '#E8EEF3'], [5, '#F08A3C']].forEach(([dz, c]) => { SM(.25, 4.6, 9, '#FFFFFF', wx - .15, 7.2, cz + dz); SM(.3, 4, 8.4, c, wx - .2, 7.5, cz + dz, em(c, .55)); });
    SM(w + .6, .6, .6, RED, cx, h - .3, fz + .05, em(RED, .7)); SM(.6, .6, d + .6, RED, wx - .05, h - .3, cz, em(RED, .7));
    for (let i = 0; i < 9; i++) { const x = cx - w / 2 + 2 + i * (w - 4) / 8; SM(.15, .15, 1.6, '#555', x, h + .1, fz + .6); SM(.4, .3, .4, NIGHT ? '#FFF6D8' : '#777', x, h - .1, fz + 1.4, em('#FFF6D8', 2)); }
    SM(8, 6.5, 15, '#F4F3F1', -70, 0, 11.5); SM(8.4, 1.6, 15.4, RED, -70, 5, 11.5, em(RED, .9)); SM(9, .35, 4, RED, -70, 3.6, 20.8, em(RED, .7)); SM(7.6, 3.4, .3, glass, -70, 0, 19.1, gO); }
  scene.add(store);
  // 店前紅磚廣場、綠籬、機車、停車場
  M(52, .06, 6, NIGHT ? '#5A3E3A' : '#C98F7E', -45, 0, 22);
  for (let x = -66; x < -26; x += 7) M(5, 1, 1.2, NIGHT ? '#2F4A36' : '#5E8C4E', x + 2.5, 0, 24.4);
  for (let i = 0; i < 12; i++) M(.5, .9, 1.8, ['#E6E6E6', '#2A2A2A', '#9AA4AD', '#7C2A2A'][i % 4], -38 + i * 1.1, 0, 21.5);
  M(12, .05, 40, NIGHT ? '#3E3D44' : '#B9B7B4', -80, 0, 0); for (let z = -18; z < 20; z += 2.6) M(5, .06, .12, '#F4F2EE', -82.5, 0, z);
  for (let z = -16.7, i = 0; z < 18; z += 2.6, i++) { if (hash('c' + i) < .3) continue; const c = ['#F2F2F2', '#3B3B3B', '#8C8F94', '#B12A2A', '#2F4E79'][i % 5]; M(4.2, 1.3, 1.8, c, -82.5, .2, z); M(2.4, .7, 1.6, c, -82.8, 1.5, z); }
  // 右邊鄰房：石材外牆、連續金屬雨遮、百葉
  M(20, 13.5, 22, '#A39486', -14, 0, 7); M(20, .3, 3.2, '#4A4C50', -14, 3.6, 19.6); for (let x = -23; x <= -5; x += 4.5) M(.2, 3.6, .2, '#4A4C50', x, 0, 21);
  for (let i = 0; i < 6; i++) M(19.6, .18, .4, '#3F4246', -14, 5 + i * .5, 18.2);
  M(19.6, 3.4, .2, NIGHT ? '#FFDFA8' : '#5B6A72', -14, 0, 18.05, NIGHT ? { emissive: '#FFC983', emissiveIntensity: .8 } : null); M(5, 3, .6, '#8D7F72', -18, 13.5, 10);
  M(12, 10, 20, '#D9D2C6', -1, 0, 7); M(12, .3, 3, '#4A4C50', -1, 3.4, 18.6);
  // 路口對角：圓弧轉角大樓
  { const [u, v] = P(-110, 14), add = (geo, m, y) => { const o = new THREE.Mesh(geo, m); o.position.set(u, y / U, v); o.castShadow = true; o.userData.base = 1; scene.add(o); };
    add(new THREE.CylinderGeometry(10 / U, 10 / U, 30 / U, 32), new THREE.MeshStandardMaterial({ map: winTex(NIGHT, 'tw'), roughness: .8 }), 15);
    add(new THREE.CylinderGeometry(10.3 / U, 10.3 / U, 6 / U, 32, 1, true, 0, Math.PI), mat('#2B4C8C', { side: THREE.DoubleSide, ...em('#4A78D8', .7) }), 26);
    add(new THREE.CylinderGeometry(10.35 / U, 10.35 / U, 3 / U, 32, 1, true, 0, Math.PI), mat('#E2B93B', { side: THREE.DoubleSide, ...em('#E2B93B', .7) }), 30);
    add(new THREE.CylinderGeometry(10.2 / U, 10.2 / U, 4 / U, 32), mat(RED, em(RED, .6)), 2);
    const [u2, v2] = P(-155, 10), bl = new THREE.Mesh(new THREE.BoxGeometry(60 / U, 14 / U, 40 / U), new THREE.MeshStandardMaterial({ map: winTex(NIGHT, 'bl'), roughness: .8 })); bl.position.set(u2, 7 / U, v2); bl.castShadow = true; bl.userData.base = 1; scene.add(bl); }
  // 民族一路往北：大型賣場＋立柱招牌
  M(34, 9, 22, '#EFEDEA', -66, 0, -42); M(34.3, 2, 22.3, RED, -66, 6, -42, em(RED, .8)); M(34, 3.6, .3, glass, -66, 0, -30.9, gO);
  M(1.2, 16, 1.2, '#B8B8B8', -84, 0, -26); M(3.4, 7, 1, '#E3A61D', -84, 14, -26, em('#E3A61D', .9));
  // 後方高樓
  [[-150, -70, 60], [-118, -110, 70], [-40, -120, 52], [30, -100, 58]].forEach(([x, z, h], i) => { const [u, v] = P(x, z), m = new THREE.Mesh(new THREE.BoxGeometry(16 / U, h / U, 14 / U), new THREE.MeshStandardMaterial({ map: winTex(NIGHT, 't' + i), roughness: .8, color: '#F2E9DD' })); m.position.set(u, h / 2 / U, v); m.castShadow = true; m.userData.base = 1; scene.add(m); M(16.4, 1, 14.4, '#B9A894', x, h, z); });
  // 號誌、斑馬線
  [[-77, 24], [-92, 36], [-77, 36]].forEach(([x, z]) => { M(.35, 6, .35, '#6A6A6A', x, 0, z); M(3.5, .3, .3, '#6A6A6A', x + 1.7, 5.6, z); M(1.6, .5, .5, '#222', x + 3, 5.2, z); M(.3, .3, .1, NIGHT ? '#3BFF7A' : '#2A8A4A', x + 3.4, 5.3, z + .3, em('#3BFF7A', 3)); });
  for (let x = -93; x < -77; x += 1.4) M(.7, .05, 5, '#F4F2EE', x, .04, 30);
  B.build(scene);
  if (NIGHT) [[-45, 4, 24], [-70, 4, 22], [-14, 3, 22], [-60, 8, 26], [-30, 8, 26]].forEach(([x, y, z]) => { const [u, v] = P(x, z), l = new THREE.PointLight('#FFC98A', 14, 9, 2); l.position.set(u, y / U, v); scene.add(l); });
  // 家庭那幾棟：獨立 Group，可點選、可轉灰
  const house = i => { const g = new THREE.Group(), BB = batch(mat); townhouse(BB, 'h' + i, new THREE.Matrix4(), NIGHT); const tmp = new THREE.Group(); BB.build(tmp); tmp.children.slice().forEach(c => { c.userData.base = 0; g.add(c); }); g.applyMatrix4(keep[i]); return g; };
  return { store, house, graph: roadGraph(roads) };
}
// 道路網：技師車沿真實道路行駛
function roadGraph(roads) {
  const N = [], key = {}, adj = [];
  const id = p => { const k = Math.round(p[0] * 2) + ',' + Math.round(p[1] * 2); if (key[k] == null) { key[k] = N.length; N.push(p); adj.push([]); } return key[k]; };
  for (const r of roads) for (let i = 1; i < r.p.length; i++) { const a = id(P(...r.p[i - 1])), b = id(P(...r.p[i])); if (a === b) continue; const d = Math.hypot(N[a][0] - N[b][0], N[a][1] - N[b][1]); adj[a].push([b, d]); adj[b].push([a, d]); }
  const near = p => { let b = 0, bd = 1e9; N.forEach((q, i) => { if (!adj[i].length) return; const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; b = i; } }); return b; };
  return {
    path(from, to) { const s = near(from), t = near(to), dist = { [s]: 0 }, prev = {}, done = {}, Q = [[0, s]];
      while (Q.length) { Q.sort((a, b) => a[0] - b[0]); const [d, u] = Q.shift(); if (done[u]) continue; done[u] = 1; if (u === t) break; for (const [v, w] of adj[u]) { const nd = d + w; if (dist[v] == null || nd < dist[v]) { dist[v] = nd; prev[v] = u; Q.push([nd, v]); } } }
      const out = []; let u = t; while (u != null) { out.unshift(N[u]); u = prev[u]; } return [from, ...out, to]; }
  };
}
// 沿折線取點
export function along(path, k) { let L = 0; const seg = []; for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(d); L += d; }
  let t = L * k; for (let i = 1; i < path.length; i++) { if (t <= seg[i - 1]) { const f = seg[i - 1] ? t / seg[i - 1] : 0, a = path[i - 1], b = path[i]; return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, ang: Math.atan2(b[0] - a[0], b[1] - a[1]) }; } t -= seg[i - 1]; }
  const e = path[path.length - 1]; return { x: e[0], z: e[1], ang: 0 }; }
