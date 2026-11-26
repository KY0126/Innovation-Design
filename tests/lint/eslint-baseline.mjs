// 揪居家｜ESLint 基準線：現有問題記在 eslint-baseline.json，只有「新增」的問題會讓檢查失敗
// 用法：npm run lint（檢查）、npm run lint:update（使用者同意後更新基準線）
import { ESLint } from 'eslint';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const basePath = path.join(here, 'eslint-baseline.json');
const eslint = new ESLint({ cwd: repo, overrideConfigFile: path.join(here, 'eslint.config.mjs') });
const results = await eslint.lintFiles(['jiujujia/*.js']);
const now = {};
for (const r of results) for (const m of r.messages) {
  const k = `${path.relative(repo, r.filePath).replace(/\\/g, '/')}|${m.ruleId || 'parse'}`;
  now[k] = (now[k] || 0) + 1;
}
if (process.argv.includes('--update')) { fs.writeFileSync(basePath, JSON.stringify(now, null, 2) + '\n'); console.log('已更新基準線：', Object.keys(now).length, '項'); process.exit(0); }
const base = fs.existsSync(basePath) ? JSON.parse(fs.readFileSync(basePath, 'utf8')) : {};
const worse = Object.entries(now).filter(([k, n]) => n > (base[k] || 0));
const better = Object.entries(base).filter(([k, n]) => (now[k] || 0) < n);
if (better.length) console.log('比基準線少的問題（可以 npm run lint:update 收緊）：', better.map(([k]) => k).join('、'));
if (worse.length) {
  console.error('新增的 ESLint 問題：');
  for (const r of results) for (const m of r.messages) {
    const k = `${path.relative(repo, r.filePath).replace(/\\/g, '/')}|${m.ruleId || 'parse'}`;
    if (worse.some(([w]) => w === k)) console.error(`  ${k.split('|')[0]}:${m.line}:${m.column} ${m.ruleId} ${m.message}`);
  }
  process.exit(1);
}
console.log('ESLint：沒有新增問題（基準線', Object.keys(base).length, '項）');
