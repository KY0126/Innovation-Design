// R14：五子登科分頁圖文選單的按鈕範圍不重疊、不超出 2500×1724（與 Supabase line-richmenu-setup 同一套算法）
import test from 'node:test';
import assert from 'node:assert/strict';
const W = 2500, H = 1724, TB = 236;
function areas() {
  const ch = H - TB, rh = Math.floor(ch / 2), xs = [0, 833, 1666, 2500];
  const cells = [0, 1, 2, 3, 4, 5].map(i => { const c = i % 3, r = Math.floor(i / 3); return { x: xs[c], y: TB + r * rh, width: xs[c + 1] - xs[c], height: r ? ch - rh : rh }; });
  return [{ x: 0, y: 0, width: 1250, height: TB }, { x: 1250, y: 0, width: 1250, height: TB }, ...cells];
}
test('8 個按鈕（2 個分頁＋6 格拼圖）都在圖內', () => {
  const A = areas(); assert.equal(A.length, 8);
  for (const a of A) { assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.width <= W && a.y + a.height <= H, JSON.stringify(a)); }
});
test('按鈕彼此不重疊，而且剛好鋪滿整張圖', () => {
  const A = areas();
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
    const a = A[i], b = A[j];
    const ov = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    assert.ok(!ov, `第 ${i + 1}、${j + 1} 個重疊`);
  }
  assert.equal(A.reduce((s, a) => s + a.width * a.height, 0), W * H);
});
