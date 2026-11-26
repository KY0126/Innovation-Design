// 圖面計算（領域鐵律 R10；資料模型 M10）
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBrowserScript } from './_load.mjs';
const C = loadBrowserScript('jiujujia/cad.js').JJJCAD;

test('臥室到浴室的圖框固定為 0,0–6200,4600 mm', () => {
  assert.deepEqual([...C.bbox('臥室到浴室')], [0, 0, 6200, 4600]); // 展開成本地陣列（vm 內的陣列原型不同）
});
test('沒有圖框設定的場域，用房間範圍算出外框', () => {
  const B = C.bbox('全屋');
  assert.equal(B.length, 4); assert.ok(B[2] > B[0] && B[3] > B[1]);
});
test('零件拖出圖框時，會被拉回圖框內並留 60 mm 邊', () => {
  const [x, y] = C.clampTo('臥室到浴室', -500, 99999);
  assert.equal(x, 60); assert.equal(y, 4600 - 60);
});
test('R10：貼著外牆的點離牆很近，房間正中央離牆很遠', () => {
  const B = C.bbox('臥室到浴室');
  const nearEdge = C.nearWall(B[0] + 150, (B[1] + B[3]) / 2)[0];
  const middle = C.nearWall(2000, 2000)[0];
  assert.ok(nearEdge < 200, `外牆旁 ${nearEdge} mm`);
  assert.ok(middle > nearEdge, `中央 ${middle} mm`);
});
test('零件規格：扶手裝在牆上、燈條在地面', () => {
  assert.equal(C.spec('rail')[3], 'wall');
  assert.equal(C.spec('strip')[3], 'floor');
});
test('會發光的零件才算燈（關燈看看按鈕的條件）', () => {
  assert.equal(C.isLight({ part: 'light' }), true);
  assert.equal(C.isLight({ part: 'rail' }), false);
  assert.equal(C.isLight({ name: '自訂小夜燈' }), true);
});
test('關燈看看：放一盞夜燈後，照得到的路比例不會變少', () => {
  const before = C.coverage('臥室到浴室', []);
  const after = C.coverage('臥室到浴室', [{ part: 'light', x: 2800, y: 700 }, { part: 'strip', x: 4450, y: 3380 }]);
  assert.ok(after >= before, `${before}% → ${after}%`);
  assert.ok(after >= 0 && after <= 100);
});
