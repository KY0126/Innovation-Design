/* 揪居家量測幾何（v1.3）：參考卡照片量測、兩次量測交叉檢查、信心度。
 * 瀏覽器與 Node 共用（Node 測試：node ar-web/test_geometry.js）。
 *
 * 參考卡照片量測：把一張標準尺寸卡片（悠遊卡、信用卡、健保卡都是 ISO/IEC 7810 ID-1：85.60 × 53.98 mm）
 * 貼在要量的平面上拍照，點卡片四角算出平面的透視轉換（homography），再點要量的兩點換算成公分。
 * 限制：兩點必須和卡片在同一個平面上（量門檻高度時卡片立靠在門檻正面；量走道寬時卡片平放在地上）。
 */
(function (root) {
  "use strict";
  const CARD_W_MM = 85.6, CARD_H_MM = 53.98;
  // 參考物：卡片適合近拍小尺寸（門檻）；A4 紙（ISO 216，297 × 210 mm）適合站著拍地面（走道寬）
  const REFS = { card: { w: CARD_W_MM, h: CARD_H_MM, name: "卡片（悠遊卡、信用卡、健保卡）" },
                 a4: { w: 297, h: 210, name: "A4 紙" } };

  // 每個欄位允許的誤差（cm）：和 servers/rules.py 的分界容忍值一致，用來算信心度
  const FIELD_TOLERANCE_CM = { threshold_cm: 0.5, corridor_cm: 3 };
  const FIELD_LABEL = { threshold_cm: "浴室門檻高度", corridor_cm: "床邊到浴室走道寬" };

  // 解 n×n 線性方程（高斯消去，部分選主元）
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) throw new Error("點的位置無法算出平面，請重新點卡片四角");
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((r, i) => r[n] / r[i]);
  }

  // 由 4 組對應點（影像 → 平面）算 3×3 homography
  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = solve(A, b);
    return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
  }

  function apply(H, [x, y]) {
    const w = H[2][0] * x + H[2][1] * y + H[2][2];
    return [(H[0][0] * x + H[0][1] * y + H[0][2]) / w, (H[1][0] * x + H[1][1] * y + H[1][2]) / w];
  }

  function polygonIsConvex(p) {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a = p[i], b = p[(i + 1) % 4], c = p[(i + 2) % 4];
      const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(z) < 1e-9) return false;
      if (sign === 0) sign = Math.sign(z); else if (Math.sign(z) !== sign) return false;
    }
    return true;
  }

  // corners：卡片四角（依序繞一圈，第一段是長邊）；a、b：要量的兩點。回傳公分。
  function cardDistanceCm(corners, a, b, ref = "card") {
    if (!polygonIsConvex(corners)) throw new Error("參考物四角要依序繞一圈點，不能交叉");
    const { w, h } = REFS[ref];
    const dst = [[0, 0], [w, 0], [w, h], [0, h]];
    const H = homography(corners, dst);
    const pa = apply(H, a), pb = apply(H, b);
    return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) / 10;
  }

  // 可重現的亂數（測試結果固定）
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function gauss(r) { const u = Math.max(r(), 1e-12), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  // 信心度：假設每次點擊有 tapPx 像素的誤差，模擬 300 次，取 95% 區間的半寬（用百分位數，不受極端值影響）；
  // 半寬等於分界容忍值（門檻 0.5 cm、走道 3 cm）→ 信心度 70%（和 rules.MIN_CONFIDENCE_PCT 對齊）。
  // 這樣只要信心度 ≥ 70%，量到的值若在容忍帶外，95% 確定落在分界正確的一側；在容忍帶內則由規則標成需技師確認
  function confidenceFromHalfWidth(field, halfCm) {
    const tol = FIELD_TOLERANCE_CM[field];
    return Math.max(0, Math.min(99, Math.round(100 - 30 * halfCm / tol)));
  }

  function cardMeasure(field, corners, a, b, tapPx = 3, seed = 7, ref = "card") {
    if (!(field in FIELD_TOLERANCE_CM)) throw new Error("參考物照片只能量門檻高度與走道寬");
    if (!(ref in REFS)) throw new Error("參考物只能是卡片或 A4 紙");
    const value = cardDistanceCm(corners, a, b, ref);
    const r = rng(seed), xs = [];
    const jit = (p) => [p[0] + gauss(r) * tapPx, p[1] + gauss(r) * tapPx];
    for (let i = 0; i < 300; i++) {
      try { xs.push(cardDistanceCm(corners.map(jit), jit(a), jit(b), ref)); } catch (e) { /* 退化的抽樣略過 */ }
    }
    xs.sort((p, q) => p - q);
    const q = (f) => xs[Math.min(xs.length - 1, Math.max(0, Math.round(f * (xs.length - 1))))];
    const half = (q(0.975) - q(0.025)) / 2;
    // 量測點離卡片太遠（超過卡片長邊 6 倍）時透視誤差會放大，信心度上限 60%
    const sideLen = Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]);
    const reach = Math.max(...[a, b].map((p) => Math.min(...corners.map((c) => Math.hypot(p[0] - c[0], p[1] - c[1]))))) / sideLen;
    let conf = confidenceFromHalfWidth(field, half);
    const notes = [];
    if (reach > 6) { conf = Math.min(conf, 60); notes.push("量測點離參考物太遠，請把參考物放近一點再拍"); }
    if (sideLen < 80) { conf = Math.min(conf, 60); notes.push("參考物在照片裡太小，請靠近一點拍"); }
    if (conf < 70 && field === "threshold_cm") notes.push("門檻請在 25 cm 內近拍，並放大後再點");
    if (conf < 70 && field === "corridor_cm" && ref === "card") notes.push("量走道寬建議改用 A4 紙平放在走道中間");
    return { field, label: FIELD_LABEL[field], value: round1(value), unit: "cm", source: "參考卡照片", reference: REFS[ref].name,
             confidence_pct: conf, spread_cm: round2(half), notes };
  }

  // 兩次量測交叉檢查（AR 掃描用）：兩次差距在容忍值一半內 85%、在容忍值內 70%，超過就要重量
  // AR 只量地面上的水平距離（走道寬、床邊到浴室門口）；門檻只有幾公分，AR 平面偵測抓不準，改用參考物近拍
  const REPEAT_TOL = { corridor_cm: [3, "cm"], bed_bath_m: [0.2, "m"] };
  function repeatCheck(field, v1, v2) {
    if (!(field in REPEAT_TOL)) throw new Error("AR 掃描只量走道寬與床邊到浴室門口距離");
    const [tol, unit] = REPEAT_TOL[field];
    const diff = Math.abs(v1 - v2);
    const value = round1((v1 + v2) / 2);
    let conf, note;
    if (diff <= tol / 2) { conf = 85; note = "兩次量測一致"; }
    else if (diff <= tol) { conf = 70; note = "兩次量測略有差距，可以使用"; }
    else { conf = 50; note = "兩次量測差太多，請再量一次或改用捲尺"; }
    return { field, value, unit, source: "AR 掃描", confidence_pct: conf, diff: round2(diff), note };
  }

  // 和 servers/rules.py validate_measures 相同的進位（JavaScript Math.round，.5 進位）
  function round1(x) { return Math.round(x * 10) / 10; }
  function round2(x) { return Math.round(x * 100) / 100; }

  const api = { CARD_W_MM, CARD_H_MM, REFS, FIELD_TOLERANCE_CM, homography, apply, cardDistanceCm, cardMeasure, repeatCheck, REPEAT_TOL,
                polygonIsConvex, round1 };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.JiujuGeometry = api;
})(typeof window !== "undefined" ? window : globalThis);
