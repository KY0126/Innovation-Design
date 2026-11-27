# 從 Demo 模擬後端（jiujujia/backend.js）抽出純規則模組，產生 jiujujia/live-rules.js
# 讓實用版（Live）與 Demo 用同一份門市、時段、方案、診斷燈號規則；backend.js 改了就重跑這支
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
s = (root / 'jiujujia/backend.js').read_text()
def mod(name):
    i = s.find('var ' + name + '=Ae(')
    assert i >= 0, name
    m = re.compile(r'var [A-Za-z0-9_$]+=Ae\(').search(s, i + 10)
    return s[i:m.start()]
body = '\n'.join(mod(n) for n in ['Da', 'Za', 'Ja'])
out = f"""// 自動產生：python3 tools/gen-live-rules.py（來源 jiujujia/backend.js 的門市與方案、診斷燈號、時間三個純規則模組）
// 實用版與 Demo 用同一份規則；請勿手改這個檔案
(function () {{
  if (!window.JJJ_LIVE) return;
  const Ae = (f) => {{ let m; return () => {{ if (!m) {{ m = {{ exports: {{}} }}; f(m.exports, m); }} return m.exports; }}; }};
{body}
  window.JJJRULES = Object.assign({{}}, Da(), Za(), {{ T: Ja() }});
}})();
"""
(root / 'jiujujia/live-rules.js').write_text(out)
print('ok', len(out))
