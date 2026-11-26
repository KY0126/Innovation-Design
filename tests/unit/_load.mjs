// 在 Node 裡載入瀏覽器腳本：給一個假的 window，讀出腳本掛上去的物件
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const src = rel => fs.readFileSync(path.join(repo, rel), 'utf8');
export function loadBrowserScript(rel) {
  const window = {};
  vm.runInNewContext(src(rel), { window, console, Math, JSON, Date }, { filename: rel });
  return window;
}
