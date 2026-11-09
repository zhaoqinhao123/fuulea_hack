# fuulea_hack

《文言诗文·课下注释闯关》的单文件页面补丁集。每个功能一个独立脚本，由 `loader.js` 拉起一个浮动面板按需加载。

## 注入（最短）

贴进「注释填空」的输入框，随便答错提交：

```html
<img src=x onerror="with(document)body.appendChild(createElement('script')).src='//cdn.jsdelivr.net/gh/zhaoqinhao123/fuulea_hack@v2.19/loader.js'">
```

147 字符，刚好卡在输入框上限内。面板出现在右下角。**再注入一次就是隐形开关**：面板开着时注入 → 整块隐藏；再注入 → 显形。藏起来时页面里只剩你原本的内容，录屏、投屏都不留痕迹。

之后每次只要 44 字符：

```html
<img src=x onerror="eval(localStorage.fhL)">
```

> 首次注入时 loader 会把自身源码存进 `localStorage.fhL`，并记下版本号 `fhV`；版本一变就自己重新抓一份。
>
> **不用手记版本号**：面板 → 工具 → 🧪 环境自检，顶部有「🔄 查最新版并复制」，会自动查 jsDelivr / GitLab 上的最新标签、验证 CDN 可用、把注入串塞进剪贴板，同时刷新本机缓存。默认每次打开自检就自动跑一次，可在那一行关掉。
>
> 为什么不用 GitLab `/-/raw/`：它返回 `text/plain` + `nosniff`，`<script>` 标签拒执行。jsDelivr 走 GitHub 并给正确的 JS MIME，所以当主源。

## 功能

| 按钮 | 文件 | 作用 |
|---|---|---|
| 💰 积分 | `mods/score.js` | 设 `score` + `earned`（两个一起改才生效） |
| 🐾 灵宠 | `mods/pets.js` | 数量（≤4）、种类（fox/qilin/cat/dog）、名字 |
| 🔓 解锁4只 | `mods/unlock.js` | 补满填空题进度 + 积分到 5400 |
| ✏️ 改名 | `mods/rename.js` | 清玩家名 / 灵宠名 / 排行榜里的旧记录 |
| 🧹 清答案 | `mods/clean.js` | 删错题本里存的答题原文 `yourAns` |
| 🖼 图片 | `mods/img.js` | 直链图片全屏弹窗 |
| 🌐 网页 | `mods/embed.js` | 网址 iframe 弹窗（受对方 X-Frame-Options 限制） |
| 📦 存档 | `mods/dump.js` | 展示并复制完整 `state` JSON |
| 💣 清空 | `mods/reset.js` | 清 `wycg_v3` + `wycg_rank_v1` |

## 存档结构

```js
{
  score, earned,                                  // 顶栏数字 / 灵宠等级依据
  pets: [{ sp, name, pts }],                      // sp ∈ fox|qilin|cat|dog，pts 是旧字段
  wrong: { "fill:123": { ...q, yourAns, correct } },
  fav:   { "note:456": { ...q } },
  fillDone: { "123": 1 },
  name, history: [{ ts, mode, total, correct, gain, items }]
}
```

`localStorage` 键：`wycg_v3`（学习数据）、`wycg_rank_v1`（排行榜）、`wycg_lock_v1`（家长密码）。

## 注意

- 面板脚本运行在页面上下文，能读写全部 localStorage。
- GitLab API 的 raw 有缓存，改了文件加 `&t=` 时间戳即可绕过（loader 里已经带上）。
- 各模块用 `prompt()` 交互，改到一半取消不会写入。
