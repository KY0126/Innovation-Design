// 揪居家｜用語檢查：讀 docs/context/用語規範.md 的「不用」欄，掃原型畫面（jiujujia/*.html、*.js）
// 現有用法記在 terms-baseline.json；只有「新增」的禁用詞會讓檢查失敗（見測試規範 Q3）
// 用法：npm run terms（檢查）、npm run terms:update（使用者同意後更新基準線）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const basePath = path.join(here, 'terms-baseline.json');
const md = fs.readFileSync(path.join(repo, 'docs/context/用語規範.md'), 'utf8');
// 解析表格：| G? | 用 | 不用 |；括號內是適用範圍說明，帶範圍的詞（只限正式文件、LINE 素材）不在原型掃
const terms = [];
for (const line of md.split('\n')) {
  const m = line.match(/^\|\s*(G\d+)\s*\|[^|]*\|\s*([^|]+?)\s*\|$/);
  if (!m || m[2] === '—') continue;
  for (let t of m[2].split('、')) {
    t = t.trim(); if (!t) continue;
    const scope = (t.match(/（([^）]*)）/) || [])[1];
    t = t.replace(/（[^）]*）/g, '').replace(/^單稱「(.+)」$/, '$1').trim();
    if (scope && scope !== '舊稱') continue;            // 例：爸媽（正式文件）、全國電子（在 LINE 素材內）
    if (t === '阿國') continue;                          // 單稱阿國要看上下文，交給人工審查
    if (/^圖表與簡報用箭頭/.test(t)) continue;           // 箭頭規則只管簡報與圖表
    if (/^只有箭頭|^膠囊/.test(t)) continue;             // 畫面樣式規則，靠截圖比對與人工審查
    terms.push({ id: m[1], t });
  }
}
const files = fs.readdirSync(path.join(repo, 'jiujujia')).filter(f => /\.(html|js)$/.test(f) && f !== 'backend.js' && !f.startsWith('_')).map(f => 'jiujujia/' + f);
const now = {}; const hits = [];
for (const f of files) {
  const lines = fs.readFileSync(path.join(repo, f), 'utf8').split('\n');
  lines.forEach((ln, i) => {
    for (const { id, t } of terms) {
      const re = /^[A-Za-z]+$/.test(t) ? new RegExp(`(?<![A-Za-z_$.])${t}(?![A-Za-z_$])`, 'g') : new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const n = (ln.match(re) || []).length;
      if (n) { const k = `${f}|${t}`; now[k] = (now[k] || 0) + n; hits.push({ k, f, line: i + 1, id, t }); }
    }
  });
}
if (process.argv.includes('--update')) { fs.writeFileSync(basePath, JSON.stringify(now, null, 2) + '\n'); console.log('已更新用語基準線：', Object.keys(now).length, '項'); process.exit(0); }
const base = fs.existsSync(basePath) ? JSON.parse(fs.readFileSync(basePath, 'utf8')) : {};
const worse = Object.entries(now).filter(([k, n]) => n > (base[k] || 0)).map(([k]) => k);
if (worse.length) {
  console.error('新增的禁用詞（見 docs/context/用語規範.md）：');
  for (const h of hits) if (worse.includes(h.k)) console.error(`  ${h.f}:${h.line}  ${h.id}「${h.t}」`);
  process.exit(1);
}
console.log(`用語檢查：${terms.length} 個禁用詞，沒有新增（基準線 ${Object.keys(base).length} 項）`);
