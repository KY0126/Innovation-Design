#!/usr/bin/env node
// Scan source files for terms banned in GLOSSARY.md (the 禁用 column).
// Usage: node scripts/check-glossary.mjs [dir ...]   (default: app components lib src)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const GLOSSARY = "GLOSSARY.md";
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".mdx"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "coverage"]);

function loadBanned() {
  const rules = [];
  for (const line of readFileSync(GLOSSARY, "utf8").split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2 || cells[0] === "使用" || /^-+$/.test(cells[0])) continue;
    const [use, banned] = cells;
    for (const term of banned.split("、").map((t) => t.trim()).filter(Boolean)) {
      rules.push({ term, use });
    }
  }
  return rules;
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTS.has(extname(name))) out.push(p);
  }
  return out;
}

const dirs = (process.argv.length > 2 ? process.argv.slice(2) : ["app", "components", "lib", "src"]).filter(existsSync);
const rules = loadBanned();
const hits = [];
for (const file of dirs.flatMap((d) => walk(d, []))) {
  readFileSync(file, "utf8").split("\n").forEach((text, i) => {
    for (const { term, use } of rules) {
      if (text.includes(term)) hits.push(`${file}:${i + 1}  「${term}」→ 請改用「${use}」`);
    }
  });
}

if (hits.length) {
  console.error(`用語檢查未通過（${hits.length} 處）：\n` + hits.join("\n"));
  process.exit(1);
}
console.log(`用語檢查通過：掃描 ${dirs.join(", ") || "（無目錄）"}，共 ${rules.length} 個禁用詞。`);
