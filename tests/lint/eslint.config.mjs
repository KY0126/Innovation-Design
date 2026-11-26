// 揪居家｜ESLint 設定：只抓「真的會出錯」的規則，不管排版（見 docs/context/測試規範.md Q1）
import globals from 'globals';
const basePath = '../..'; // 設定檔放在 tests/lint，檢查範圍是 repo 根目錄
export default [
  { basePath, ignores: ['**/vendor/**', '**/backend.js', '**/live-rules.js', '**/node_modules/**', '**/_*'] },
  {
    basePath,
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      globals: { ...globals.browser, THREE: 'readonly' },
    },
    rules: {
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-case': 'error',
      'no-redeclare': 'error',
      'no-unreachable': 'error',
      'no-self-assign': 'error',
      'no-unsafe-finally': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-func-assign': 'error',
      'no-const-assign': 'error',
      'no-import-assign': 'error',
      'getter-return': 'error',
    },
  },
  { basePath, files: ['**/cad3d.js'], languageOptions: { sourceType: 'module' } },
];
