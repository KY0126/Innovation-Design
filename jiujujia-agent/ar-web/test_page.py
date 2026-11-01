"""量測頁面端到端測試（Playwright）：用合成照片（已知尺寸投影）走一次完整流程，確認畫面算出的值、信心度與隱私清除。
用法：python ar-web/test_page.py
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
PROJ = r'''
const src=require("fs").readFileSync(process.argv[1]+"/test_geometry.js","utf8");
eval(src.split("const CW")[0].split("function makeCamera")[1].replace(/^/,"function makeCamera"));
const cam=makeCamera({dist:25,tiltDeg:30,yawDeg:10,f:1100,cx:700,cy:700});
const c=[[0,0],[8.56,0],[8.56,5.398],[0,5.398]].map(cam);
console.log(JSON.stringify({card:c,a:cam([12,0]),b:cam([12,2.0]),fl:cam([-4,0]),fr:cam([20,0]),tl:cam([9.5,2]),tr:cam([20,2]),
  tb:cam([9.5,-6]),tbr:cam([20,-6])}));
'''
results = []


def check(name, cond, info=""):
    results.append(cond)
    print(("PASS " if cond else "FAIL ") + name, info)


def main():
    pts = json.loads(subprocess.run(["node", "-e", PROJ, str(HERE)], capture_output=True, text=True, check=True).stdout)
    W, H = 1600, 1200
    im = Image.new("RGB", (W, H), (200, 196, 188))
    d = ImageDraw.Draw(im)
    d.polygon([tuple(pts["fl"]), tuple(pts["fr"]), tuple(pts["tbr"]), tuple(pts["tb"])], fill=(150, 140, 130))  # 地面
    d.polygon([tuple(pts["tl"]), tuple(pts["tr"]), tuple(pts["fr"]), tuple(pts["a"])], fill=(235, 235, 230))   # 門檻正面
    d.polygon([tuple(p) for p in pts["card"]], fill=(40, 120, 200), outline=(255, 255, 255))                    # 卡片
    tmp = Path(tempfile.mkdtemp()) / "threshold.png"
    im.save(tmp)

    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto((HERE / "measure.html").as_uri())
        pg.click('[data-field="corridor_cm"]')
        pg.wait_for_timeout(300)
        check("瀏覽器不支援 WebXR 時，AR 掃描按鈕會停用（iPhone Safari 情況）",
              pg.is_disabled('[data-method="ar"]'))
        # 門檻：卡片近拍
        pg.click('[data-field="threshold_cm"]')
        check("門檻沒有 AR 選項（太小，AR 抓不到）", pg.locator('[data-method="ar"]').count() == 0)
        pg.click('[data-method="card"]')
        pg.set_input_files("#file", str(tmp))
        pg.wait_for_function("document.getElementById('photo').width > 1")
        pg.click("#zoomBtn")
        for key in ["card0", "card1", "card2", "card3", "a", "b"]:
            pt = pts["card"][int(key[-1])] if key.startswith("card") else pts[key]
            box = pg.locator("#photo").bounding_box()
            x = box["x"] + pt[0] * box["width"] / W
            y = box["y"] + pt[1] * box["height"] / H
            pg.evaluate(f"document.getElementById('photo').scrollIntoView({{block:'nearest'}})")
            pg.evaluate(f"""(() => {{ const st=document.getElementById('stage'); st.scrollLeft={max(0, x - box['x'] - 150)};
                             st.scrollTop={max(0, y - box['y'] - 150)}; }})()""")
            box = pg.locator("#photo").bounding_box()
            pg.mouse.click(box["x"] + pt[0] * box["width"] / W, box["y"] + pt[1] * box["height"] / H)
        pg.wait_for_selector("#resultBox:not([hidden])")
        val = float(pg.get_attribute("#result", "data-value"))
        conf = pg.get_attribute("#result", "data-conf")
        check(f"卡片近拍量門檻：畫面算出 {val} cm（實際 2.0 cm），信心度 {conf}%", abs(val - 2.0) <= 0.2)
        cw = pg.evaluate("document.getElementById('photo').width")
        check("算完照片立即清除（畫布歸零、檔案欄清空）",
              cw == 1 and pg.evaluate("document.getElementById('file').value") == "")
        txt = pg.input_value("#copyText")
        check("產生給阿國的文字含欄位、來源與信心度", '"field": "threshold_cm"' in txt.replace('":"', '": "') or
              '"field":"threshold_cm"' in txt, txt.splitlines()[0])
        pg.screenshot(path=str(HERE / "screenshot_result.png"), full_page=True)
        # 手動輸入：超出範圍不給複製
        pg.click('[data-field="corridor_cm"]')
        pg.click('[data-method="manual"]')
        pg.fill("#manualVal", "0.92")
        pg.click("#manualOk")
        check("走道輸入 0.92（單位錯）→ 提醒超出範圍、不能複製", pg.is_disabled("#copyBtn"))
        pg.fill("#manualVal", "92")
        pg.click("#manualOk")
        check("走道輸入 92 cm → 可複製，來源為家人手動輸入", not pg.is_disabled("#copyBtn") and
              "家人手動輸入" in pg.input_value("#copyText"))
        check("頁面沒有 JavaScript 錯誤", not errors, "；".join(errors))
        b.close()
    print(f"\n量測頁面測試：{sum(results)}/{len(results)} 通過")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
