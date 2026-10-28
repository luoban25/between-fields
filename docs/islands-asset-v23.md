# 碧海沙洲素材记录 · v23

使用内置 ImageGen 编辑模式，未使用 CLI/API 回退。

- 参考原图：`sources/islands-reference-v23.png`，来自用户的 `download.png`。
- 场景素材：`dist/works/islands/assets/islands-ground-v23.png`。
- 输入与输出均为941×1672，保持全宽与原始纵横比。
- 操作：移除固定白云及大块云影，恢复被遮住的水面；保留海岸线、岛屿、沙洲、棕榈、石块和树影。
- 场景云、云影、飞机及尾流均由WebGL分层绘制，海水动画只改变水面光照，不扭曲地景。

最终提示词：

> Use case: precise-object-edit. Edit target: the attached top-down tropical island illustration. Asset type: clean ground plate for an animated layered WebGL scene. Remove ALL white clouds (upper right and lower left) and ALL large diffuse cloud shadows (including left middle, upper right and lower left). Reconstruct the hidden ocean, reef and sand naturally, matching surrounding shallow mint/turquoise sea and deep blue channel. Preserve the exact existing aerial composition, coastlines, all islands, sandbars, palm trees, shrubs, rocks, native palm/tree shadows, water brush texture, palette, scale, and aspect ratio. Do not move, crop, enlarge or redesign the islands. No clouds or large cloud shadows anywhere. No airplane, boats, people, typography, frame, border or watermark. Keep the original charming detailed gouache/painterly top-down style, bright sunny lighting. This is an inpainting/cleanup task, not a new composition. Output a clean full-bleed portrait image matching the source's 941:1672 aspect ratio, as high resolution as practical.
