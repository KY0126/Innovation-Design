// 揪居家｜業界圖面（2D 施工圖畫法）
// 一棟住宅模板（mm）：雙線牆（RC 實心、磚牆斜線）、門弧、窗三線、尺寸線、軸線、房名坪數地坪天花、家具、設備符號。
// 揪心願「拼出來」白板、作品頁平面圖、設備施工圖共用；3D（cad3d.js）也讀這份模型。
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // ---------- 住宅模板（與居家安全地圖同一組空間：9 m × 9 m） ----------
  const ROOMS = {
    bed: ['臥室', 0, 0, 4000, 3500, 'wood', 2600], bath: ['浴室', 4000, 0, 2200, 3500, 'tile', 2400], ldy: ['洗衣陽台', 6200, 0, 2800, 3500, 'tile', 2600],
    hall: ['走道', 0, 3500, 9000, 1100, 'wood', 2400], kit: ['廚房', 0, 4600, 3800, 3400, 'tile', 2400], liv: ['客廳', 3800, 4600, 5200, 3400, 'wood', 2600], door: ['玄關', 7200, 8000, 1800, 1000, 'tile', 2400]
  };
  const FIN = { wood: '超耐磨木地板', tile: '300×300 止滑磚' };
  const TAGAT = { bed: [1950, 3050], bath: [4600, 2600], ldy: [7600, 2400], hall: [1500, 4050], kit: [1900, 6500], liv: [6400, 6200], door: [7900, 8500] };
  // 牆中心線：x1,y1,x2,y2,厚度,種類
  const WALLS = [
    [0, 0, 1000, 0, 150, 'rc'], [2400, 0, 4800, 0, 150, 'rc'], [5400, 0, 6700, 0, 150, 'rc'], [8500, 0, 9000, 0, 150, 'rc'],
    [9000, 0, 9000, 5200, 150, 'rc'], [9000, 7000, 9000, 9000, 150, 'rc'], [7200, 9000, 7600, 9000, 150, 'rc'], [8500, 9000, 9000, 9000, 150, 'rc'],
    [7200, 8000, 7200, 9000, 150, 'rc'], [0, 8000, 4600, 8000, 150, 'rc'], [6400, 8000, 7200, 8000, 150, 'rc'], [0, 0, 0, 5400, 150, 'rc'], [0, 6600, 0, 8000, 150, 'rc'],
    [4000, 0, 4000, 3500, 120, 'brick'], [6200, 0, 6200, 3500, 120, 'brick'],
    [0, 3500, 3000, 3500, 120, 'brick'], [3800, 3500, 4600, 3500, 120, 'brick'], [5350, 3500, 6600, 3500, 120, 'brick'], [7400, 3500, 9000, 3500, 120, 'brick'],
    [0, 4600, 2800, 4600, 120, 'brick'], [3600, 4600, 4400, 4600, 120, 'brick'], [8600, 4600, 9000, 4600, 120, 'brick'], [3800, 4600, 3800, 8000, 120, 'brick']
  ];
  const WINS = [[1000, 0, 2400, 0, 150, 'W1', '1400×1200', 900], [4800, 0, 5400, 0, 150, 'W2', '600×600', 1500], [6700, 0, 8500, 0, 150, 'W3', '1800×2000', 0],
    [0, 5400, 0, 6600, 150, 'W4', '1200×1000', 1000], [4600, 8000, 6400, 8000, 150, 'W5', '1800×1500', 600], [9000, 5200, 9000, 7000, 150, 'W6', '1800×1500', 600]];
  // 門：鉸鏈點、關閉方向、開啟方向、寬、編號
  const DOORS = [[[3800, 3500], [-1, 0], [0, -1], 800, 'D1'], [[4600, 3500], [1, 0], [0, -1], 750, 'D2'], [[7400, 3500], [-1, 0], [0, -1], 800, 'D3'], [[2800, 4600], [1, 0], [0, 1], 800, 'D4'], [[8500, 9000], [-1, 0], [0, -1], 900, 'D5']];
  const FURN = [['bed', 1200, 250, 1500, 2000, 450], ['stand', 650, 250, 450, 450, 550], ['stand', 2750, 250, 450, 450, 550], ['ward', 250, 2850, 2000, 550, 2100],
    ['basin', 4150, 100, 560, 450, 850], ['toilet', 5650, 100, 420, 680, 750], ['shower', 5100, 1500, 1000, 950, 0],
    ['washer', 6400, 150, 600, 600, 850], ['basin', 7150, 150, 500, 450, 850],
    ['counter', 80, 4900, 600, 3000, 900], ['fridge', 2950, 7150, 750, 750, 1700],
    ['sofa', 5000, 7050, 2000, 850, 800], ['tv', 5100, 4800, 1800, 400, 500], ['table', 5550, 6000, 900, 500, 420], ['shoe', 8600, 8050, 350, 800, 1000]];
  // 既有電器：種類、x、y
  const ELEC = [['ceil', 1950, 1500], ['ceil', 5100, 900], ['ceil', 7600, 1700], ['ceil', 2000, 4050], ['ceil', 6400, 4050], ['ceil', 1900, 6300], ['ceil', 6400, 6300], ['ceil', 8100, 8500],
    ['sw', 3900, 3350], ['sw', 4500, 3650], ['sw', 7500, 3650], ['sw', 2700, 4750], ['sw', 8400, 8850], ['out', 650, 80], ['out', 3700, 80], ['out', 4250, 3400], ['out', 700, 4720], ['out', 8900, 7600]];
  const FR = { '臥室到浴室': ['bed', 'hall', 'bath'], '廚房': ['kit', 'hall'], '客廳': ['liv', 'hall'], '洗衣陽台': ['ldy', 'hall'], '全屋': Object.keys(ROOMS) };
  // 零件規格：寬、深（mm）、高、安裝方式、安裝高度、符號
  const SPEC = {
    light: [140, 140, 260, 'wall', 'H=300', 'pir'], strip: [1500, 120, 40, 'floor', 'H=50', 'strip'], btn: [160, 160, 120, 'any', '櫃面', 'btn'], mat: [700, 550, 15, 'floor', '地面', 'mat'],
    rail: [650, 80, 800, 'wall', 'H=700–1500', 'rail'], gas: [140, 140, 200, 'wall', '距天花 300', 'det'], smoke: [180, 180, 60, 'any', '天花板', 'det'], ih: [600, 500, 80, 'any', '檯面', 'box'],
    plug: [120, 120, 120, 'wall', 'H=300', 'plug'], speaker: [200, 200, 260, 'any', '桌面', 'box'], hygro: [140, 140, 160, 'any', 'H=1500', 'box'], rack: [1200, 400, 60, 'any', '天花板', 'box']
  };
  const CSPEC = [300, 300, 200, 'any', '待評估', 'new'];
  const spec = id => SPEC[id] || CSPEC;
  const INK = '#1E1E1E', MID = '#555', LT = '#A3A3A3', RED = '#D4003C', F = "font-family:'Noto Sans TC',sans-serif";
  const f = v => (+v).toFixed(0);

  function joint(px, py, me) { return WALLS.some(w => w !== me && Math.min(w[0], w[2]) - 1 <= px && px <= Math.max(w[0], w[2]) + 1 && Math.min(w[1], w[3]) - 1 <= py && py <= Math.max(w[1], w[3]) + 1); }
  function wallRect(w) { const [x1, y1, x2, y2, t] = w, h = t / 2; if (y1 === y2) { const a = x1 - (joint(x1, y1, w) ? h : 0), b = x2 + (joint(x2, y2, w) ? h : 0); return [a, y1 - h, b - a, t]; } const a = y1 - (joint(x1, y1, w) ? h : 0), b = y2 + (joint(x2, y2, w) ? h : 0); return [x1 - h, a, t, b - a]; }
  // 點到最近牆面的距離（mm），與那面牆的方向
  function nearWall(x, y) { let best = [1e9, 'h']; WALLS.forEach(([x1, y1, x2, y2, t]) => { const cx = Math.max(Math.min(x, Math.max(x1, x2)), Math.min(x1, x2)), cy = Math.max(Math.min(y, Math.max(y1, y2)), Math.min(y1, y2)), d = Math.max(0, Math.hypot(x - cx, y - cy) - t / 2); if (d < best[0]) best = [d, y1 === y2 ? 'h' : 'v']; }); return best; }
  // 每個場域的裁切範圍（走道只取相鄰那段）
  const CROP = { '臥室到浴室': [0, 0, 6200, 4600], '廚房': [0, 3500, 4400, 8000], '客廳': [3800, 3500, 9000, 9000], '洗衣陽台': [5600, 0, 9000, 4600] };
  function bbox(field) { if (CROP[field]) return CROP[field].slice(); const ks = FR[field] || FR['全屋']; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; ks.forEach(k => { const r = ROOMS[k]; x0 = Math.min(x0, r[1]); y0 = Math.min(y0, r[2]); x1 = Math.max(x1, r[1] + r[3]); y1 = Math.max(y1, r[2] + r[4]); }); return [x0, y0, x1, y1]; }
  const inBox = (x, y, B, m = 0) => x >= B[0] - m && x <= B[2] + m && y >= B[1] - m && y <= B[3] + m;

  function plan(field, items, o = {}) {
    const B = bbox(field), M = o.sheet ? 1500 : 900, vx = B[0] - M, vy = B[1] - M * (o.sheet ? 1.4 : 1), vw = B[2] - B[0] + M * 2, vh = B[3] - B[1] + M * (o.sheet ? 2.35 : 1.6);
    const k = vw / (o.px || 360), g = [], add = s => g.push(s), lightE = o.sheet === 'E';
    const tile = 300, wood = 150;
    add(`<defs><pattern id="cbrk" patternUnits="userSpaceOnUse" width="${f(3 * k)}" height="${f(3 * k)}" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${f(3 * k)}" stroke="${INK}" stroke-width="${(0.45 * k).toFixed(1)}"/></pattern>
      <pattern id="ctile" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}"><path d="M${tile} 0V${tile}H0" fill="none" stroke="${LT}" stroke-width="${(0.3 * k).toFixed(1)}"/></pattern>
      <pattern id="cwood" patternUnits="userSpaceOnUse" width="1200" height="${wood * 2}"><path d="M0 ${wood}H1200M0 ${wood * 2}H1200M400 0V${wood}M1000 ${wood}V${wood * 2}" fill="none" stroke="#BDB8B4" stroke-width="${(0.28 * k).toFixed(1)}"/></pattern></defs>`);
    add(`<clipPath id="ccrop"><rect x="${B[0] - 160}" y="${B[1] - 160}" width="${B[2] - B[0] + 320}" height="${B[3] - B[1] + 320}"/></clipPath><g clip-path="url(#ccrop)">`);
    // 地坪
    for (const [key, [n, x, y, w, h, fin]] of Object.entries(ROOMS)) {
      add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>`);
      if (!lightE) add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${fin === 'tile' ? 'ctile' : 'cwood'})"/>`);
    }
    // 家具
    const fc = lightE ? '#BDB8B4' : MID, sw = (lightE ? .55 : .75) * k, st = `fill="#fff" stroke="${fc}" stroke-width="${sw.toFixed(1)}"`, th = `fill="none" stroke="${fc}" stroke-width="${(sw * .7).toFixed(1)}"`;
    const R = (a, b, w, d, r = 0, s = st) => add(`<rect x="${f(a)}" y="${f(b)}" width="${f(w)}" height="${f(d)}" rx="${f(r)}" ${s}/>`);
    FURN.forEach(([kd, x, y, w, d]) => {
      if (kd === 'bed') { R(x, y, w, d); R(x, y, w, 70); R(x + 90, y + 120, 600, 330, 60); R(x + w - 690, y + 120, 600, 330, 60); add(`<path d="M${x} ${y + 720}H${x + w}M${x} ${y + 720}L${x + 260} ${y + 980}H${x + w}" ${th}/>`); }
      else if (kd === 'stand') { R(x, y, w, d); const cx = x + w / 2, cy = y + d / 2; add(`<circle cx="${cx}" cy="${cy}" r="120" ${th}/><path d="M${cx - 85} ${cy - 85}L${cx + 85} ${cy + 85}M${cx + 85} ${cy - 85}L${cx - 85} ${cy + 85}" ${th}/>`); }
      else if (kd === 'ward') { R(x, y, w, d); add(`<path d="M${x + 40} ${y + d / 2}H${x + w - 40}" ${th} stroke-dasharray="${f(3 * k)} ${f(2 * k)}"/>`); for (let i = 1; i < 3; i++) add(`<path d="M${f(x + w * i / 3)} ${y}V${y + d}" ${th}/>`); for (let i = 0; i < 9; i++) { const hx = x + 160 + i * 210; add(`<path d="M${hx - 70} ${y + d / 2 - 150}L${hx + 70} ${y + d / 2 + 150}" ${th}/>`); } }
      else if (kd === 'toilet') { R(x, y, w, 190, 20); add(`<ellipse cx="${x + w / 2}" cy="${y + 440}" rx="190" ry="250" ${st}/><ellipse cx="${x + w / 2}" cy="${y + 450}" rx="130" ry="180" ${th}/>`); }
      else if (kd === 'basin') { R(x, y, w, d); add(`<ellipse cx="${x + w / 2}" cy="${y + d / 2 + 30}" rx="${w * .36}" ry="${d * .31}" ${th}/><circle cx="${x + w / 2}" cy="${y + 70}" r="25" ${th}/>`); }
      else if (kd === 'shower') { R(x, y, w, d, 0, `fill="none" stroke="${fc}" stroke-width="${sw.toFixed(1)}"`); add(`<path d="M${x} ${y}L${x + w} ${y + d}M${x + w} ${y}L${x} ${y + d}" ${th}/><circle cx="${x + w / 2}" cy="${y + d / 2}" r="60" ${st}/><path d="M${x - 60} ${y}H${x + w}" stroke="${fc}" stroke-width="${(sw * 1.8).toFixed(1)}"/>`); }
      else if (kd === 'sofa') { R(x, y, w, d, 40); R(x, y + d - 200, w, 200, 30); R(x, y, 180, d, 30); R(x + w - 180, y, 180, d, 30); add(`<path d="M${x + w / 2} ${y}V${y + d - 200}" ${th}/>`); }
      else if (kd === 'tv') { R(x, y, w, d); add(`<path d="M${x + 200} ${y + 60}H${x + w - 200}" stroke="${fc}" stroke-width="${(sw * 2.4).toFixed(1)}"/>`); }
      else if (kd === 'washer') { R(x, y, w, d, 30); add(`<circle cx="${x + w / 2}" cy="${y + d / 2 + 30}" r="200" ${th}/>`); }
      else if (kd === 'counter') { R(x, y, w, d); add(`<circle cx="${x + w / 2}" cy="${y + 500}" r="150" ${th}/><circle cx="${x + w / 2}" cy="${y + 900}" r="150" ${th}/><rect x="${x + 100}" y="${y + 1700}" width="${w - 200}" height="600" rx="60" ${th}/>`); }
      else if (kd === 'fridge') { R(x, y, w, d); add(`<path d="M${x} ${y + 80}H${x + w}" ${th}/><text x="${x + w / 2}" y="${y + d / 2 + 80}" font-size="${f(7 * k)}" text-anchor="middle" fill="${fc}" style="${F}">冰箱</text>`); }
      else if (kd === 'table') R(x, y, w, d, 40);
      else if (kd === 'shoe') { R(x, y, w, d); add(`<path d="M${x} ${y}L${x + w} ${y + d}" ${th}/>`); }
    });
    // 牆：先畫外框再蓋填充，交接處不留線
    const rects = WALLS.map(w => [w, wallRect(w)]), ws = (1.6 * k).toFixed(1);
    rects.forEach(([w, [x, y, ww, hh]]) => add(`<rect x="${f(x)}" y="${f(y)}" width="${f(ww)}" height="${f(hh)}" fill="${w[5] === 'rc' ? INK : '#fff'}" stroke="${INK}" stroke-width="${ws}"/>`));
    rects.forEach(([w, [x, y, ww, hh]]) => add(w[5] === 'rc' ? `<rect x="${f(x)}" y="${f(y)}" width="${f(ww)}" height="${f(hh)}" fill="${INK}"/>` : `<rect x="${f(x)}" y="${f(y)}" width="${f(ww)}" height="${f(hh)}" fill="#fff"/><rect x="${f(x)}" y="${f(y)}" width="${f(ww)}" height="${f(hh)}" fill="url(#cbrk)"/>`));
    // 窗
    const tg = (cx, cy, t, ell) => ell ? `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(11 * k)}" ry="${f(6.5 * k)}" fill="#fff" stroke="${INK}" stroke-width="${(.6 * k).toFixed(1)}"/><text x="${f(cx)}" y="${f(cy + 3 * k)}" font-size="${f(7.5 * k)}" text-anchor="middle" fill="${INK}" style="${F}">${t}</text>` : `<rect x="${f(cx - 10 * k)}" y="${f(cy - 6 * k)}" width="${f(20 * k)}" height="${f(12 * k)}" fill="#fff" stroke="${INK}" stroke-width="${(.6 * k).toFixed(1)}"/><text x="${f(cx)}" y="${f(cy + 3 * k)}" font-size="${f(7.5 * k)}" text-anchor="middle" fill="${INK}" style="${F}">${t}</text>`;
    WINS.forEach(([x1, y1, x2, y2, t, id]) => {
      const h = t / 2, hz = y1 === y2;
      add(hz ? `<rect x="${x1}" y="${y1 - h}" width="${x2 - x1}" height="${t}" fill="#fff" stroke="${INK}" stroke-width="${(.9 * k).toFixed(1)}"/><path d="M${x1} ${y1 - 22}H${x2}M${x1} ${y1 + 22}H${x2}" stroke="${INK}" stroke-width="${(.5 * k).toFixed(1)}"/>` : `<rect x="${x1 - h}" y="${y1}" width="${t}" height="${y2 - y1}" fill="#fff" stroke="${INK}" stroke-width="${(.9 * k).toFixed(1)}"/><path d="M${x1 - 22} ${y1}V${y2}M${x1 + 22} ${y1}V${y2}" stroke="${INK}" stroke-width="${(.5 * k).toFixed(1)}"/>`);
      if (o.tags !== false && inBox((x1 + x2) / 2, (y1 + y2) / 2, B, 100)) { const out = hz ? (y1 <= B[1] + 10 ? -1 : 1) : (x1 <= B[0] + 10 ? -1 : 1); add(hz ? tg((x1 + x2) / 2, y1 + out * 15 * k, id, 1) : tg(x1 + out * 22 * k, (y1 + y2) / 2, id, 1)); }
    });
    // 門
    DOORS.forEach(([[hx, hy], [cx, cy], [ox, oy], w, id]) => {
      const ex = hx + ox * w, ey = hy + oy * w, sx = hx + cx * w, sy = hy + cy * w, nx = cx * 40, ny = cy * 40, sweep = (cx * oy - cy * ox) < 0 ? 1 : 0;
      add(`<path d="M${hx} ${hy}L${ex} ${ey}L${ex + nx} ${ey + ny}L${hx + nx} ${hy + ny}Z" fill="#fff" stroke="${INK}" stroke-width="${(.9 * k).toFixed(1)}"/><path d="M${sx} ${sy}A${w} ${w} 0 0 ${sweep} ${ex} ${ey}" fill="none" stroke="${INK}" stroke-width="${(.45 * k).toFixed(1)}"/>`);
      if (o.tags !== false && inBox(hx, hy, B)) add(tg(hx + cx * w / 2 + ox * 200, hy + cy * w / 2 + oy * 200, id, 0));
    });
    add('</g>');
    // 尺寸線（斜短線端點）與軸線
    const tk = (x, y) => `<path d="M${f(x - 3 * k)} ${f(y + 3 * k)}L${f(x + 3 * k)} ${f(y - 3 * k)}" stroke="${INK}" stroke-width="${(.9 * k).toFixed(1)}"/>`, dl = (.45 * k).toFixed(1);
    const chain = (pts, side, off) => {
      if (side === 'top' || side === 'bottom') { const y = side === 'top' ? B[1] - off * k : B[3] + off * k; add(`<path d="M${f(pts[0] - 6 * k)} ${f(y)}H${f(pts[pts.length - 1] + 6 * k)}" stroke="${INK}" stroke-width="${dl}"/>`); pts.forEach(p => add(`<path d="M${p} ${f(y - 5 * k)}V${f(y + 5 * k)}" stroke="${INK}" stroke-width="${dl}"/>` + tk(p, y))); pts.slice(1).forEach((b, i) => { const a = pts[i]; if ((b - a) / k > 22) add(`<text x="${f((a + b) / 2)}" y="${f(y - 3 * k)}" font-size="${f(7.5 * k)}" text-anchor="middle" fill="${INK}" style="${F}">${b - a}</text>`); }); }
      else { const x = side === 'left' ? B[0] - off * k : B[2] + off * k; add(`<path d="M${f(x)} ${f(pts[0] - 6 * k)}V${f(pts[pts.length - 1] + 6 * k)}" stroke="${INK}" stroke-width="${dl}"/>`); pts.forEach(p => add(`<path d="M${f(x - 5 * k)} ${p}H${f(x + 5 * k)}" stroke="${INK}" stroke-width="${dl}"/>` + tk(x, p))); pts.slice(1).forEach((b, i) => { const a = pts[i], cy = (a + b) / 2; if ((b - a) / k > 22) add(`<text x="${f(x - 3 * k)}" y="${f(cy)}" font-size="${f(7.5 * k)}" text-anchor="middle" fill="${INK}" transform="rotate(-90 ${f(x - 3 * k)} ${f(cy)})" style="${F}">${b - a}</text>`); }); }
    };
    const ks = FR[field] || FR['全屋'], xs = [...new Set(ks.flatMap(r => [ROOMS[r][1], ROOMS[r][1] + ROOMS[r][3]]).concat([B[0], B[2]]))].filter(v => v >= B[0] && v <= B[2]).sort((a, b) => a - b), ys = [...new Set(ks.flatMap(r => [ROOMS[r][2], ROOMS[r][2] + ROOMS[r][4]]).concat([B[1], B[3]]))].filter(v => v >= B[1] && v <= B[3]).sort((a, b) => a - b);
    const ax = o.sheet ? 62 : 44, ay = o.sheet ? 62 : 40;
    xs.forEach((gx, i) => add(`<path d="M${gx} ${f(B[1] - ax * k)}V${f(B[3] + 14 * k)}" stroke="${LT}" stroke-width="${(.4 * k).toFixed(1)}" stroke-dasharray="${f(10 * k)} ${f(2 * k)} ${f(2 * k)} ${f(2 * k)}"/><circle cx="${gx}" cy="${f(B[1] - (ax + 8) * k)}" r="${f(8 * k)}" fill="#fff" stroke="${INK}" stroke-width="${(.7 * k).toFixed(1)}"/><text x="${gx}" y="${f(B[1] - (ax + 5) * k)}" font-size="${f(8.5 * k)}" text-anchor="middle" fill="${INK}" style="${F}">${i + 1}</text>`));
    ys.forEach((gy, i) => add(`<path d="M${f(B[0] - ay * k)} ${gy}H${f(B[2] + 14 * k)}" stroke="${LT}" stroke-width="${(.4 * k).toFixed(1)}" stroke-dasharray="${f(10 * k)} ${f(2 * k)} ${f(2 * k)} ${f(2 * k)}"/><circle cx="${f(B[0] - (ay + 8) * k)}" cy="${gy}" r="${f(8 * k)}" fill="#fff" stroke="${INK}" stroke-width="${(.7 * k).toFixed(1)}"/><text x="${f(B[0] - (ay + 8) * k)}" y="${f(gy + 3 * k)}" font-size="${f(8.5 * k)}" text-anchor="middle" fill="${INK}" style="${F}">${'ABCDEFG'[i]}</text>`));
    chain(xs, 'top', 18); chain(ys, 'left', 18);
    if (o.sheet) { chain([B[0], B[2]], 'top', 36); chain([B[1], B[3]], 'left', 36); }
    // 房名、坪數、地坪、天花
    ks.forEach(key => {
      const [n, x, y, w, h, fin, ch] = ROOMS[key], [cx, cy] = key === 'hall' ? [(Math.max(B[0], 0) + Math.min(B[2], 9000)) / 2 - 700, 4050] : TAGAT[key], ar = (w * h / 1e6).toFixed(1), lt = o.lights && o.lights[key];
      add(`<text x="${cx}" y="${cy}" font-size="${f(9.5 * k)}" font-weight="700" text-anchor="middle" fill="${INK}" paint-order="stroke" stroke="#fff" stroke-width="${f(3 * k)}" style="${F}">${n}<tspan font-weight="400" font-size="${f(7.5 * k)}"> ${ar} m²</tspan></text>`);
      if (o.sheet || o.full) add(`<text x="${cx}" y="${f(cy + 11 * k)}" font-size="${f(6.5 * k)}" text-anchor="middle" fill="${MID}" paint-order="stroke" stroke="#fff" stroke-width="${f(2.5 * k)}" style="${F}">${FIN[fin]}｜CH ${ch}</text>`);
      if (lt) add(`<circle cx="${f(cx - (n.length * 6 + 26) * k)}" cy="${f(cy - 3.5 * k)}" r="${f(3.6 * k)}" fill="${{ r: '#E5484D', y: '#F5A524', g: '#2E9E5B' }[lt]}"/>`);
    });
    // 既有電器（設備施工圖）
    if (lightE) ELEC.forEach(([t, x, y]) => { if (!inBox(x, y, B)) return; const r = 5 * k, s = (.7 * k).toFixed(1);
      if (t === 'ceil') add(`<circle cx="${x}" cy="${y}" r="${f(r)}" fill="#fff" stroke="${INK}" stroke-width="${s}"/><path d="M${f(x - r * .7)} ${f(y - r * .7)}L${f(x + r * .7)} ${f(y + r * .7)}M${f(x + r * .7)} ${f(y - r * .7)}L${f(x - r * .7)} ${f(y + r * .7)}" stroke="${INK}" stroke-width="${s}"/>`);
      else if (t === 'out') add(`<circle cx="${x}" cy="${y}" r="${f(r * .8)}" fill="#fff" stroke="${INK}" stroke-width="${s}"/><path d="M${f(x - 1.5 * k)} ${f(y - 2 * k)}V${f(y + 2 * k)}M${f(x + 1.5 * k)} ${f(y - 2 * k)}V${f(y + 2 * k)}" stroke="${INK}" stroke-width="${s}"/>`);
      else add(`<circle cx="${x}" cy="${y}" r="${f(2.2 * k)}" fill="${INK}"/><path d="M${x} ${y}L${f(x + 6 * k)} ${f(y - 6 * k)}H${f(x + 8.5 * k)}" fill="none" stroke="${INK}" stroke-width="${s}"/>`); });
    // 心願新增的零件：紅色符號＋六角編號
    (items || []).forEach((it, i) => {
      const id = it.idx != null ? it.idx : i, [w, d, , , H, sym] = it.spec || spec(it.part), x = it.x, y = it.y, on = o.sel === id, nw = nearWall(x, y), vert = sym === 'rail' && nw[1] === 'v';
      const s = (1 * k).toFixed(1), body = [];
      const W2 = vert ? d : w, D2 = vert ? w : d;
      if (sym === 'strip') body.push(`<path d="M${f(x - W2 / 2)} ${y}H${f(x + W2 / 2)}" stroke="${RED}" stroke-width="${f(2.4 * k)}" stroke-dasharray="${f(5 * k)} ${f(2 * k)}"/>`);
      else if (sym === 'mat') body.push(`<rect x="${f(x - w / 2)}" y="${f(y - d / 2)}" width="${w}" height="${d}" fill="rgba(212,0,60,.07)" stroke="${RED}" stroke-width="${s}" stroke-dasharray="${f(3 * k)} ${f(1.5 * k)}"/>`);
      else if (sym === 'rail') body.push(vert ? `<path d="M${x} ${f(y - w / 2)}V${f(y + w / 2)}" stroke="${RED}" stroke-width="${f(2.6 * k)}" stroke-linecap="round"/>` : `<path d="M${f(x - w / 2)} ${y}H${f(x + w / 2)}" stroke="${RED}" stroke-width="${f(2.6 * k)}" stroke-linecap="round"/>`);
      else if (sym === 'pir') body.push(`<circle cx="${x}" cy="${y}" r="${f(5 * k)}" fill="#fff" stroke="${RED}" stroke-width="${s}"/><path d="M${f(x - 3.5 * k)} ${f(y - 3.5 * k)}L${f(x + 3.5 * k)} ${f(y + 3.5 * k)}M${f(x + 3.5 * k)} ${f(y - 3.5 * k)}L${f(x - 3.5 * k)} ${f(y + 3.5 * k)}" stroke="${RED}" stroke-width="${(.8 * k).toFixed(1)}"/>`);
      else if (sym === 'btn') body.push(`<rect x="${f(x - 4.5 * k)}" y="${f(y - 4.5 * k)}" width="${f(9 * k)}" height="${f(9 * k)}" fill="#fff" stroke="${RED}" stroke-width="${s}"/><circle cx="${x}" cy="${y}" r="${f(2.2 * k)}" fill="${RED}"/>`);
      else if (sym === 'plug') body.push(`<circle cx="${x}" cy="${y}" r="${f(4.5 * k)}" fill="#fff" stroke="${RED}" stroke-width="${s}"/><path d="M${f(x - 1.5 * k)} ${f(y - 2 * k)}V${f(y + 2 * k)}M${f(x + 1.5 * k)} ${f(y - 2 * k)}V${f(y + 2 * k)}" stroke="${RED}" stroke-width="${s}"/>`);
      else if (sym === 'det') body.push(`<circle cx="${x}" cy="${y}" r="${f(5 * k)}" fill="#fff" stroke="${RED}" stroke-width="${s}"/><circle cx="${x}" cy="${y}" r="${f(2 * k)}" fill="none" stroke="${RED}" stroke-width="${s}"/>`);
      else if (sym === 'new') body.push(`<rect x="${f(x - w / 2)}" y="${f(y - d / 2)}" width="${w}" height="${d}" fill="#FAEEDA" stroke="#BA7517" stroke-width="${s}" stroke-dasharray="${f(3 * k)} ${f(2 * k)}"/>`);
      else body.push(`<rect x="${f(x - Math.max(w, 6 * k) / 2)}" y="${f(y - Math.max(d, 6 * k) / 2)}" width="${f(Math.max(w, 6 * k))}" height="${f(Math.max(d, 6 * k))}" fill="#fff" stroke="${RED}" stroke-width="${s}"/>`);
      // 六角標籤放在零件右上
      const lx = x + 12 * k, ly = y - 12 * k, hx = 9 * k, hy = 7.5 * k, col = sym === 'new' ? '#BA7517' : RED;
      const hex = `<path d="M${f(lx - hx)} ${f(ly)}L${f(lx - hx / 2)} ${f(ly - hy)}H${f(lx + hx / 2)}L${f(lx + hx)} ${f(ly)}L${f(lx + hx / 2)} ${f(ly + hy)}H${f(lx - hx / 2)}Z" fill="${on ? col : '#fff'}" stroke="${col}" stroke-width="${(.9 * k).toFixed(1)}"/><text x="${f(lx)}" y="${f(ly + 3 * k)}" font-size="${f(7.5 * k)}" font-weight="700" text-anchor="middle" fill="${on ? '#fff' : col}" style="${F}">${esc(it.tag)}</text>`;
      const hl = lightE ? `<text x="${f(lx)}" y="${f(ly + 17 * k)}" font-size="${f(6.5 * k)}" text-anchor="middle" fill="${col}" paint-order="stroke" stroke="#fff" stroke-width="${f(2.5 * k)}" style="${F}">${esc(H)}</text>` : '';
      const hit = o.edit ? `<rect x="${f(x - 16 * k)}" y="${f(y - 24 * k)}" width="${f(40 * k)}" height="${f(40 * k)}" fill="transparent"/>` : '';
      add(`<g ${o.edit ? `data-wpin="${id}" style="cursor:grab"` : ''} ${on ? 'class="on"' : ''}>${hit}${on ? `<circle cx="${x}" cy="${y}" r="${f(13 * k)}" fill="none" stroke="${col}" stroke-width="${(1.2 * k).toFixed(1)}" stroke-dasharray="${f(3 * k)} ${f(2 * k)}"/>` : ''}${body.join('')}${hex}${hl}</g>`);
    });
    // 圖名
    if (o.sheet) add(`<text x="${f(B[0])}" y="${f(B[3] + 46 * k)}" font-size="${f(11 * k)}" font-weight="700" fill="${INK}" style="${F}">${o.sheet === 'E' ? '設備施工圖' : '平面配置圖'}<tspan font-weight="400" font-size="${f(7.5 * k)}" fill="${MID}">　${o.sheet === 'E' ? 'E-01' : 'A-01'}｜SCALE 1:50｜單位 mm</tspan></text><path d="M${f(B[0])} ${f(B[3] + 51 * k)}H${f(B[2])}" stroke="${INK}" stroke-width="${(1.4 * k).toFixed(1)}"/>`);
    return `<svg class="cad" viewBox="${f(vx)} ${f(vy)} ${f(vw)} ${f(vh)}" role="img" aria-label="${esc(o.alt || field + '平面圖')}" style="display:block;width:100%;height:auto;background:#fff;touch-action:${o.edit ? 'none' : 'auto'}">${g.join('')}</svg>`;
  }
  // 螢幕座標轉成 mm
  function toMM(e, svg) { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [Math.round(q.x), Math.round(q.y)]; }
  function clampTo(field, x, y) { const B = bbox(field); return [Math.max(B[0] + 60, Math.min(B[2] - 60, x)), Math.max(B[1] + 60, Math.min(B[3] - 60, y))]; }
  window.JJJCAD = { ROOMS, WALLS, WINS, DOORS, FURN, ELEC, FR, SPEC, spec, FIN, plan, toMM, nearWall, bbox, clampTo, inBox };
})();
