// 揪居家｜3D 鳥瞰（WebGL，three.js）
// 讀 cad.js 的住宅模板：牆剖切到腰高、木地板與止滑磚材質、光影；零件位置與 2D 相同（mm）。
// 手指拖曳旋轉、雙指或滾輪縮放；夜間模擬會讓夜燈與燈條亮起。
import * as THREE from './vendor/three.module.min.js';

const C = window.JJJCAD;
const m = v => v / 1000;
let R = null; // 共用一個 renderer，畫面重繪時搬到新的容器

let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function tex(w, h, draw, rx, ry) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const woodC = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), ph = 64; seed = 7; for (let i = 0; i < 8; i++) { let x = -rnd() * 200; while (x < 512) { const L = 190 + rnd() * 210, t = .88 + rnd() * .14; g.fillStyle = `rgb(${200 * t | 0},${170 * t | 0},${132 * t | 0})`; g.fillRect(x, i * ph, L, ph); for (let k = 0; k < 8; k++) { g.strokeStyle = `rgba(120,85,55,${.05 + rnd() * .08})`; g.lineWidth = 1 + rnd(); const yy = i * ph + rnd() * ph; g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + L * .3, yy + rnd() * 4 - 2, x + L * .7, yy + rnd() * 4 - 2, x + L, yy); g.stroke(); } g.fillStyle = 'rgba(90,65,45,.55)'; g.fillRect(x, i * ph, 2, ph); x += L; } g.fillStyle = 'rgba(90,65,45,.5)'; g.fillRect(0, i * ph, 512, 2); } return c; })();
const tileC = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#cfcac4'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const t = .95 + rnd() * .05; g.fillStyle = `rgb(${226 * t | 0},${224 * t | 0},${219 * t | 0})`; g.fillRect(i * 128 + 2, j * 128 + 2, 124, 124); } return c; })();
const fromC = (c, rx, ry) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const fab = col => tex(64, 64, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(0,0,0,${rnd() * .05})`; g.fillRect(rnd() * w, rnd() * h, 1, 1); } }, 4, 4);

function build(o) {
  const night = !!o.night, scene = new THREE.Scene(), B = C.bbox(o.field), pad = 400;
  scene.background = new THREE.Color(night ? 0x1b1c22 : 0xf4f2ef);
  const inB = (x, y) => x >= B[0] - pad && x <= B[2] + pad && y >= B[1] - pad && y <= B[3] + pad;
  const M = {
    wall: new THREE.MeshStandardMaterial({ color: 0xf3f1ee, roughness: .92 }), cut: new THREE.MeshBasicMaterial({ color: 0x2b2b2e }),
    white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .6 }), oak: new THREE.MeshStandardMaterial({ map: fromC(woodC, 1, 1), roughness: .6 }),
    linen: new THREE.MeshStandardMaterial({ map: fab('#e9e4dc'), roughness: .95 }), sage: new THREE.MeshStandardMaterial({ map: fab('#9aa79a'), roughness: .95 }), sofa: new THREE.MeshStandardMaterial({ map: fab('#8c8f96'), roughness: .95 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xfdfdfb, roughness: .15 }), glass: new THREE.MeshStandardMaterial({ color: 0xdfeff3, roughness: .05, transparent: true, opacity: .3 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: .25, metalness: .9 }), dark: new THREE.MeshStandardMaterial({ color: 0x26262a, roughness: .4 }), door: new THREE.MeshStandardMaterial({ color: 0xe8e2d8, roughness: .7 }),
    mat: new THREE.MeshStandardMaterial({ map: fab('#7e8b95'), roughness: 1 }), red: new THREE.MeshStandardMaterial({ color: 0xd4003c, roughness: .45 }),
    led: new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffc985, emissiveIntensity: night ? 3.2 : .5 }), cust: new THREE.MeshStandardMaterial({ color: 0xfaeeda, roughness: .8 })
  };
  const box = (w, h, d, mat, x, y, z, cast = true) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); b.castShadow = cast; b.receiveShadow = true; scene.add(b); return b; };
  const cyl = (r1, r2, h, mat, x, y, z, sz = 1) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 24), mat); b.scale.z = sz; b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; scene.add(b); return b; };
  // 地坪
  box(m(B[2] - B[0]) + .5, .1, m(B[3] - B[1]) + .5, new THREE.MeshStandardMaterial({ color: night ? 0x34353b : 0xdedad5, roughness: 1 }), m((B[0] + B[2]) / 2), -.06, m((B[1] + B[3]) / 2), false);
  for (const key of C.FR[o.field] || C.FR['全屋']) {
    const [, x, y, w, h, fin] = C.ROOMS[key];
    const mat = fin === 'tile' ? new THREE.MeshStandardMaterial({ map: fromC(tileC, m(w) / .6, m(h) / .6), roughness: .35 }) : new THREE.MeshStandardMaterial({ map: fromC(woodC, m(w) / 2.4, m(h) / 1.2), roughness: .55 });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(m(w), m(h)), mat); p.rotation.x = -Math.PI / 2; p.position.set(m(x + w / 2), .001, m(y + h / 2)); p.receiveShadow = true; scene.add(p);
  }
  // 牆（剖切 1.15 m，頂面深色表示剖到）
  const CUT = 1.15;
  const touches = (px, py, me) => C.WALLS.some(w => w !== me && Math.min(w[0], w[2]) - 1 <= px && px <= Math.max(w[0], w[2]) + 1 && Math.min(w[1], w[3]) - 1 <= py && py <= Math.max(w[1], w[3]) + 1);
  const piece = (x1, y1, x2, y2, t, y0, y1h, e1, e2) => {
    const hz = y1 === y2, h = t / 2, a = (hz ? x1 : y1) - (e1 ? h : 0), b = (hz ? x2 : y2) + (e2 ? h : 0), L = m(b - a), T = m(t), hh = y1h - y0, c = m((a + b) / 2);
    if (hz) box(L, hh, T, M.wall, c, y0 + hh / 2, m(y1)); else box(T, hh, L, M.wall, m(x1), y0 + hh / 2, c);
    if (Math.abs(y1h - CUT) < 1e-6) { if (hz) box(L, .006, T, M.cut, c, CUT + .003, m(y1), false); else box(T, .006, L, M.cut, m(x1), CUT + .003, c, false); }
  };
  const near = (x1, y1, x2, y2) => inB(x1, y1) || inB(x2, y2) || inB((x1 + x2) / 2, (y1 + y2) / 2);
  C.WALLS.forEach(w => { const [x1, y1, x2, y2, t] = w; if (near(x1, y1, x2, y2)) piece(x1, y1, x2, y2, t, 0, CUT, touches(x1, y1, w), touches(x2, y2, w)); });
  C.WINS.forEach(([x1, y1, x2, y2, t, , size, sill]) => { if (!near(x1, y1, x2, y2)) return; const s = m(sill); if (s > 0) piece(x1, y1, x2, y2, t, 0, Math.min(s, CUT), false, false); if (s < CUT) { const hz = y1 === y2, L = m(hz ? x2 - x1 : y2 - y1), top = CUT; if (hz) box(L, top - s, .01, M.glass, m((x1 + x2) / 2), (s + top) / 2, m(y1), false); else box(.01, top - s, L, M.glass, m(x1), (s + top) / 2, m((y1 + y2) / 2), false); } });
  C.DOORS.forEach(([[hx, hy], , [ox, oy], w]) => { if (!inB(hx, hy)) return; const L = m(w), hh = CUT - .03; box(ox ? L : .04, hh, oy ? L : .04, M.door, m(hx + ox * w / 2), hh / 2, m(hy + oy * w / 2)); });
  // 家具
  C.FURN.forEach(([k, x, y, w, d]) => {
    if (!inB(x + w / 2, y + d / 2)) return;
    const X = m(x), Z = m(y), W = m(w), D = m(d), cx = X + W / 2, cz = Z + D / 2;
    if (k === 'bed') { box(W, .28, D, M.oak, cx, .14, cz); box(W, .9, .06, M.oak, cx, .45, Z + .03); box(W - .06, .2, D - .1, M.white, cx, .38, cz + .03); box(.58, .1, .34, M.linen, X + .38, .53, Z + .3); box(.58, .1, .34, M.linen, X + W - .38, .53, Z + .3); box(W + .02, .05, D * .62, M.sage, cx, .5, Z + D - D * .31); }
    else if (k === 'stand') { box(W, .5, D, M.oak, cx, .25, cz); cyl(.09, .12, .2, new THREE.MeshStandardMaterial({ color: 0xf6efe2, roughness: .9 }), cx, .72, cz); }
    else if (k === 'ward' || k === 'shoe') { const hh = Math.min(k === 'ward' ? 2.1 : 1, CUT - .05); box(W, hh, D, M.white, cx, hh / 2, cz); }
    else if (k === 'toilet') { box(W * .9, .42, .18, M.ceramic, cx, .55, Z + .12); cyl(.19, .15, .4, M.ceramic, cx, .2, Z + .45, 1.3); }
    else if (k === 'basin') { box(W, .8, D, M.oak, cx, .4, cz); box(W + .02, .04, D + .02, M.ceramic, cx, .82, cz); cyl(.16, .12, .1, M.ceramic, cx, .88, cz + .03, .75); }
    else if (k === 'shower') { box(W, .03, D, new THREE.MeshStandardMaterial({ color: 0xe4e2de, roughness: .4 }), cx, .015, cz, false); box(W, CUT - .05, .01, M.glass, cx, (CUT - .05) / 2, Z, false); }
    else if (k === 'sofa') { box(W, .42, D, M.sofa, cx, .21, cz); box(W, .4, .2, M.sofa, cx, .62, Z + D - .1); box(.18, .22, D, M.sofa, X + .09, .53, cz); box(.18, .22, D, M.sofa, X + W - .09, .53, cz); }
    else if (k === 'tv') { box(W, .45, D, M.white, cx, .225, cz); box(1.2, .62, .04, M.dark, cx, .45 + .33, Z + .12); }
    else if (k === 'washer') { box(W, .85, D, M.white, cx, .425, cz); cyl(.2, .2, .02, M.dark, cx, .86, cz); }
    else if (k === 'counter') { box(W, .86, D, M.white, cx, .43, cz); box(W + .02, .04, D + .02, M.dark, cx, .88, cz); }
    else if (k === 'fridge') { const hh = Math.min(1.7, CUT - .05); box(W, hh, D, M.chrome, cx, hh / 2, cz); }
    else if (k === 'table') box(W, .42, D, M.oak, cx, .21, cz);
  });
  // 心願零件（位置與 2D 相同）
  const tags = [];
  (o.items || []).forEach(it => {
    const [w, d, h, , , sym] = it.spec || C.spec(it.part), X = m(it.x), Z = m(it.y), nw = C.nearWall(it.x, it.y), vert = nw[1] === 'v';
    let top = .1;
    if (sym === 'strip') { box(m(w), .015, .012, M.led, X, .05, Z, false); top = .08; }
    else if (sym === 'pir') { box(.08, .08, .03, M.led, X, .3, Z); top = .36; }
    else if (sym === 'mat') { box(m(w), .012, m(d), M.mat, X, .006, Z); top = .03; }
    else if (sym === 'rail') { const L = m(w); const g = new THREE.Mesh(new THREE.CylinderGeometry(.017, .017, L, 12), M.chrome); g.rotation[vert ? 'x' : 'z'] = Math.PI / 2; g.position.set(X, .8, Z); g.castShadow = true; scene.add(g); top = .86; }
    else if (sym === 'btn') { box(.1, .04, .1, M.white, X, .57, Z); box(.07, .015, .07, M.red, X, .6, Z); top = .62; }
    else if (sym === 'new') { box(m(w), m(h), m(d), M.cust, X, m(h) / 2, Z); top = m(h) + .02; }
    else { const hh = Math.max(m(h), .06), y0 = sym === 'det' ? CUT - .1 : (sym === 'plug' ? .3 : .45); box(Math.max(m(w), .06), hh, Math.max(m(d), .06), M.red, X, y0, Z); top = y0 + hh / 2; }
    tags.push([it.tag, new THREE.Vector3(X, top, Z), sym === 'new']);
  });
  // 燈光
  if (!night) {
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d2c8, 1.1)); scene.add(new THREE.AmbientLight(0xffffff, .35));
    const sun = new THREE.DirectionalLight(0xfff3e2, 2.4), cx = m((B[0] + B[2]) / 2), cz = m((B[1] + B[3]) / 2); sun.position.set(cx - 2.5, 7, cz - 4.5); sun.target.position.set(cx, 0, cz); scene.add(sun.target);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 25 }); sun.shadow.bias = -.0005; scene.add(sun);
  } else {
    scene.add(new THREE.HemisphereLight(0x5b6a90, 0x1a1a1e, .35));
    const moon = new THREE.DirectionalLight(0x8fa3d8, .4); moon.position.set(-3, 8, -2); scene.add(moon);
    (o.items || []).forEach(it => { const sym = (it.spec || C.spec(it.part))[5]; if (sym !== 'pir' && sym !== 'strip') return; const l = new THREE.PointLight(0xffc27a, sym === 'pir' ? 1.6 : 1.1, sym === 'pir' ? 3.2 : 2.2, 2); l.position.set(m(it.x), sym === 'pir' ? .32 : .08, m(it.y)); scene.add(l); });
  }
  return { scene, tags, B };
}

function ensure() {
  if (R) return R;
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const cam = new THREE.PerspectiveCamera(32, 1, .1, 100);
  R = { r, cam, key: '', az: .42, el: .98, dist: 13, target: new THREE.Vector3(), host: null, lab: null, built: null };
  const cv = r.domElement; cv.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
  const P = new Map(); let pinch = 0;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]); if (P.size === 2) { const [a, b] = [...P.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  cv.addEventListener('pointermove', e => { if (!P.has(e.pointerId)) return; const [px, py] = P.get(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]);
    if (P.size === 2) { const [a, b] = [...P.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) R.dist = Math.max(5, Math.min(26, R.dist * pinch / d)); pinch = d; }
    else { R.az -= (e.clientX - px) * .008; R.el = Math.max(.35, Math.min(1.45, R.el + (e.clientY - py) * .006)); } draw(); });
  const up = e => { P.delete(e.pointerId); if (P.size < 2) pinch = 0; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); R.dist = Math.max(5, Math.min(26, R.dist * (1 + Math.sign(e.deltaY) * .08))); draw(); }, { passive: false });
  return R;
}
function draw() {
  if (!R || !R.built || !R.host) return;
  const { r, cam, target } = R, w = R.host.clientWidth || 320, h = R.host.clientHeight || 240;
  r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  cam.position.set(target.x + R.dist * Math.cos(R.el) * Math.sin(R.az), target.y + R.dist * Math.sin(R.el), target.z + R.dist * Math.cos(R.el) * Math.cos(R.az)); cam.lookAt(target);
  const sx = R.before ? Math.round(w * R.pos / 100) : 0;
  if (R.before) { r.setScissorTest(true); r.setScissor(0, 0, sx, h); r.render(R.before.scene, cam); r.setScissor(sx, 0, w - sx, h); r.render(R.built.scene, cam); r.setScissorTest(false); if (R.hd) R.hd.style.left = R.pos + '%'; }
  else r.render(R.built.scene, cam);
  if (R.lab) R.lab.innerHTML = R.built.tags.map(([t, v, nw]) => { const p = v.clone().project(cam); if (p.z > 1 || (p.x + 1) / 2 * w < sx) return ''; return `<span class="w3tag${nw ? ' nw' : ''}" style="left:${((p.x + 1) / 2 * w).toFixed(0)}px;top:${((1 - p.y) / 2 * h).toFixed(0)}px">${t}</span>`; }).join('');
}
// 掛到容器上：o = { field, items:[{tag,part,x,y,spec?}], night }
// o.compare = true：關燈看看，左邊裝之前、右邊裝之後，中間的軸可左右拖
export function mount(host, o) {
  const S = ensure(), key = JSON.stringify([o.field, o.night, !!o.compare, (o.items || []).map(i => [i.tag, i.part, i.x, i.y])]);
  if (S.key !== key) {
    S.built = build(o); S.key = key; S.before = o.compare ? build(Object.assign({}, o, { items: [] })) : null; S.r.toneMappingExposure = o.night ? .95 : 1.05;
    const B = S.built.B, span = Math.max(B[2] - B[0], (B[3] - B[1]) * 1.3) / 1000; S.target.set(m((B[0] + B[2]) / 2), 0, m((B[1] + B[3]) / 2) + .2); if (S.field !== o.field) { S.dist = span * 1.85 + 2; S.field = o.field; }
  }
  host.innerHTML = ''; host.appendChild(S.r.domElement); const lab = document.createElement('div'); lab.className = 'w3lab'; host.appendChild(lab);
  S.host = host; S.lab = lab; S.hd = null;
  if (o.compare) {
    S.pos = o.pos == null ? 50 : o.pos;
    host.insertAdjacentHTML('beforeend', '<div class="wcmp-l">裝之前</div><div class="wcmp-r">裝之後</div><div class="wcmp-h" role="slider" tabindex="0" aria-label="左右拖曳比較裝之前與裝之後" aria-valuemin="0" aria-valuemax="100"><i>‹ ›</i></div>');
    const hd = S.hd = host.querySelector('.wcmp-h'), set = x => { S.pos = Math.max(2, Math.min(98, x)); hd.setAttribute('aria-valuenow', Math.round(S.pos)); if (o.onPos) o.onPos(S.pos); draw(); };
    hd.addEventListener('pointerdown', e => { e.stopPropagation(); hd.setPointerCapture(e.pointerId); const mv = ev => { const r = host.getBoundingClientRect(); set((ev.clientX - r.left) / r.width * 100); }, upx = () => { hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', upx); }; hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', upx); });
    hd.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); set(S.pos + (e.key === 'ArrowLeft' ? -5 : 5)); } });
  }
  draw();
  return S;
}
window.JJJ3D = { mount };
