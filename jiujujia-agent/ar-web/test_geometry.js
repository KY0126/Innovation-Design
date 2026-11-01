// 參考卡量測幾何測試：用針孔相機把已知尺寸的平面投影成照片座標，再用 geometry.js 量回來，比對誤差。
// 用法：node ar-web/test_geometry.js
"use strict";
const G = require("./geometry.js");
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log("PASS ", name, info || ""); } else { fail++; console.log("FAIL ", name, info || ""); } }

// 相機：位置 C、看向平面，焦距 f（像素），影像中心 (cx, cy)。平面座標 (X, Y) 公分 → 世界座標
function makeCamera({ dist = 50, tiltDeg = 35, yawDeg = 10, f = 3000, cx = 2000, cy = 1500 }) {
  const t = tiltDeg * Math.PI / 180, y = yawDeg * Math.PI / 180;
  // 平面在 z=0，相機在 (0, -dist*sin t, dist*cos t) 附近，看向原點
  const C = [dist * Math.sin(y) * Math.cos(t), -dist * Math.sin(t), dist * Math.cos(t) * Math.cos(y)];
  const fwd = C.map((v) => -v), n = Math.hypot(...fwd); const zc = fwd.map((v) => v / n);
  const up0 = [0, 1, 0];
  const xc = [zc[1] * up0[2] - zc[2] * up0[1], zc[2] * up0[0] - zc[0] * up0[2], zc[0] * up0[1] - zc[1] * up0[0]];
  const nx = Math.hypot(...xc); for (let i = 0; i < 3; i++) xc[i] /= nx;
  const yc = [zc[1] * xc[2] - zc[2] * xc[1], zc[2] * xc[0] - zc[0] * xc[2], zc[0] * xc[1] - zc[1] * xc[0]];
  return ([X, Y]) => {
    const d = [X - C[0], Y - C[1], -C[2]];
    const px = d[0] * xc[0] + d[1] * xc[1] + d[2] * xc[2];
    const py = d[0] * yc[0] + d[1] * yc[1] + d[2] * yc[2];
    const pz = d[0] * zc[0] + d[1] * zc[1] + d[2] * zc[2];
    return [cx + f * px / pz, cy + f * py / pz];
  };
}
const CW = G.CARD_W_MM / 10, CH = G.CARD_H_MM / 10;
function card(cam, ox, oy) { return [[ox, oy], [ox + CW, oy], [ox + CW, oy + CH], [ox, oy + CH]].map(cam); }

// 1) 門檻高度：卡片立靠在門檻正面（同一垂直面），量地面線到門檻頂端 2.0 cm
for (const [tilt, yaw] of [[10, 0], [30, 15], [45, -20]]) {
  const cam = makeCamera({ dist: 45, tiltDeg: tilt, yawDeg: yaw });
  const v = G.cardDistanceCm(card(cam, 0, 0), cam([12, 0]), cam([12, 2.0]));
  check(`門檻 2.0 cm，相機傾斜 ${tilt}°、偏 ${yaw}°：精確點擊量回 ${v.toFixed(3)} cm`, Math.abs(v - 2.0) < 0.01);
}
// 2) 走道寬：卡片平放在走道地上，量兩側牆腳 92 cm
for (const [dist, tilt] of [[150, 50], [120, 60]]) {
  const cam = makeCamera({ dist, tiltDeg: tilt, yawDeg: 5, f: 2600 });
  const v = G.cardDistanceCm(card(cam, -4, 0), cam([-46, 10]), cam([46, 10]));
  check(`走道 92 cm，相機距離 ${dist} cm：精確點擊量回 ${v.toFixed(2)} cm`, Math.abs(v - 92) < 0.05);
}
// 3) 點擊誤差：信心度 70% 的意思是「95% 誤差區間 ≤ 分界容忍值」（門檻 0.5 cm、走道 3 cm）
{
  const near = makeCamera({ dist: 25, tiltDeg: 30, yawDeg: 10 });
  const far = makeCamera({ dist: 45, tiltDeg: 30, yawDeg: 10 });
  const good = G.cardMeasure("threshold_cm", card(near, 0, 0), near([12, 0]), near([12, 2.0]), 6);
  const ok45 = G.cardMeasure("threshold_cm", card(far, 0, 0), far([12, 0]), far([12, 2.0]), 6);
  const sloppy = G.cardMeasure("threshold_cm", card(far, 0, 0), far([12, 0]), far([12, 2.0]), 20);
  check(`門檻：25 cm 近拍、放大點（誤差 6px）→ ${good.value} cm，信心度 ${good.confidence_pct}%（±${good.spread_cm}）`,
        good.confidence_pct >= 70 && good.value === 2);
  check(`門檻：45 cm 拍、放大點 → 信心度 ${ok45.confidence_pct}%（±${ok45.spread_cm} cm），仍可用`, ok45.confidence_pct >= 70);
  check(`門檻：45 cm 拍、沒放大就點（誤差 20px）→ 信心度 ${sloppy.confidence_pct}% < 70%，要求重拍`,
        sloppy.confidence_pct < 70 && sloppy.notes.some((n) => n.includes("近拍")));
}
// 3b) 走道：卡片在照片裡太小 → 不可用並建議改 A4；A4 紙平放走道中間、蹲低約 1.2 m 拍 → 可用
{
  const cam150 = makeCamera({ dist: 150, tiltDeg: 50, yawDeg: 5, f: 2600 });
  const r = G.cardMeasure("corridor_cm", card(cam150, -4, 0), cam150([-46, 10]), cam150([46, 10]), 6);
  check(`走道：用卡片站著拍 → 信心度 ${r.confidence_pct}% < 70%，提醒改用 A4`,
        r.confidence_pct < 70 && r.notes.some((n) => n.includes("A4")), r.notes.join("；"));
  const cam = makeCamera({ dist: 120, tiltDeg: 55, yawDeg: 5, f: 2600 });
  const a4 = [[-14.85, 0], [14.85, 0], [14.85, 21], [-14.85, 21]].map(cam);
  const r2 = G.cardMeasure("corridor_cm", a4, cam([-46, 10]), cam([46, 10]), 6, 7, "a4");
  check(`走道：A4 紙平放、約 1.2 m 拍 → ${r2.value} cm，信心度 ${r2.confidence_pct}%（±${r2.spread_cm} cm）`,
        Math.abs(r2.value - 92) <= 1 && r2.confidence_pct >= 70, r2.notes.join("；"));
}
// 4) 量測點離卡片太遠：信心度上限 60%
{
  const cam = makeCamera({ dist: 150, tiltDeg: 50, yawDeg: 5, f: 2600 });
  const r = G.cardMeasure("corridor_cm", card(cam, 200, 0), cam([-46, 10]), cam([46, 10]), 4);
  check(`走道：卡片放在 2 m 外，信心度 ${r.confidence_pct}% ≤ 60% 並提醒`, r.confidence_pct <= 60 && r.notes.length > 0, r.notes.join("；"));
}
// 5) 卡片四角點錯順序（交叉）→ 拒絕
{
  const cam = makeCamera({});
  const c = card(cam, 0, 0); const crossed = [c[0], c[2], c[1], c[3]];
  let msg = ""; try { G.cardDistanceCm(crossed, cam([0, 0]), cam([1, 0])); } catch (e) { msg = e.message; }
  check("四角點成交叉 → 拒絕並請重點", msg.includes("依序"), msg);
}
// 6) 只支援門檻與走道
{
  let msg = ""; try { G.cardMeasure("bed_bath_m", [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 0], [1, 1]); } catch (e) { msg = e.message; }
  check("床邊到浴室距離不能用參考物量 → 拒絕", msg.includes("只能量"), msg);
}
// 7) AR 兩次量測交叉檢查（只量地面距離）
{
  const a = G.repeatCheck("corridor_cm", 91.5, 92.5), b = G.repeatCheck("corridor_cm", 90, 95);
  const c = G.repeatCheck("corridor_cm", 91, 93.5), m = G.repeatCheck("bed_bath_m", 5.02, 4.96);
  check(`AR 走道兩次 91.5／92.5 → ${a.confidence_pct}%、取平均 ${a.value} cm`, a.confidence_pct === 85 && a.value === 92);
  check(`AR 走道兩次 90／95 → ${b.confidence_pct}%，要求重量`, b.confidence_pct < 70);
  check(`AR 走道兩次 91／93.5 → ${c.confidence_pct}%`, c.confidence_pct === 70);
  check(`AR 床邊到浴室兩次 5.02／4.96 m → ${m.confidence_pct}%、${m.value} m`, m.confidence_pct === 85 && m.value === 5 && m.unit === "m");
  let msg = ""; try { G.repeatCheck("threshold_cm", 2, 2); } catch (e) { msg = e.message; }
  check("AR 不量門檻（太小、抓不到平面）→ 拒絕", msg.includes("只量"), msg);
}
// 8) 進位與 Python 規則一致（3.05 → 3.1）
check("進位：3.05 → 3.1（與 servers/rules.py 相同）", G.round1(3.05) === 3.1);
console.log(`\n量測幾何測試：${pass}/${pass + fail} 通過`);
process.exit(fail ? 1 : 0);
