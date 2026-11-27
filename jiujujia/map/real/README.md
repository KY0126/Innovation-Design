# 真實地圖元件（揪居家原型）

- 底圖：OpenStreetMap 圖資（© OpenStreetMap 貢獻者，ODbL），PMTiles 切片取自 Rayyu0404/lvji-maps，只含高雄三民區一帶（試點範圍）。
- 繪圖：MapLibre GL JS（BSD-3）、pmtiles（BSD-3）、@protomaps/basemaps（BSD-3）；字型 Noto Sans（OFL，見 fonts/OFL.txt），中文改用裝置字型。
- `scene.json`：同一份圖資匯出的道路、公園、水域、建物輪廓，給服務地圖第三層的 3D 街區用。
- `route-demo.json`：民族店到示範住家的路線（沿民族一路、天祥一路），技師位置為示範資料。
- ICON：技師頭像、門市與住家圖釘由 Gemini 生成後去背；工程車為墨灰梯架款。
