// 領域鐵律的數字守門（R7、R8）：共用設定檔建立前，先檢查程式裡的數字和規範一致
// 規範數字改了（例如 11/27 交流會重算），這裡會先失敗，提醒同步修改程式與計畫書
import test from 'node:test';
import assert from 'node:assert/strict';
import { src } from './_load.mjs';
const store3 = src('jiujujia/store3.js'), wish = src('jiujujia/wish.js');

test('R8：揪心願三段門檻是 30 天 20 戶、90 天 50 戶、最終 100 戶', () => {
  const m = store3.match(/STAGES\s*=\s*(\[\[.*?\]\])/);
  assert.ok(m, '找不到 STAGES');
  assert.deepEqual(JSON.parse(m[1]), [[20, 30], [50, 90], [100, 0]]);
  assert.match(wish, /\[20, 50, 100\]/, '作品頁進度條刻度要和門檻一致');
});
test('R8：沒有訂閱該場域方案的家庭不能按「我也需要」', () => {
  assert.match(store3, /的家庭才能按「我也需要」/);
  assert.match(store3, /403\)/);
});
test('R7：月費基本 299、安心 449；加價 +200／+150／+100', () => {
  assert.match(store3, /基本方案每月 299 元、安心方案每月 449 元/);
  assert.match(store3, /揪食光每月 \+200、揪團聚 \+150、揪清爽 \+100/);
});
