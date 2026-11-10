# fuulea_hack

《文言诗文·课下注释闯关》的单文件页面补丁集。每个功能一个独立脚本，由 `loader.js` 拉起一个浮动面板按需加载。

## 注入（最短）

贴进「注释填空」的输入框，随便答错提交：

```html
<img src=x onerror="with(document)body.appendChild(createElement('script')).src='https://fastly.jsdelivr.net/gh/zhaoqinhao123/fuulea_hack@3.3/loader.js'">
```

154 字符，输入框没有长度限制，直接粘贴即可。面板出现在右下角。**再注入一次就是隐形开关**：面板开着时注入 → 整块隐藏；再注入 → 显形。藏起来时页面里只剩你原本的内容，录屏、投屏都不留痕迹。

> 注入串必须带 `https:` 协议。v3.2.1 及更早的 README 示例是不带协议的 `//fastly...`，页面本身用 `file://` 打开时，浏览器会把 `//fastly.jsdelivr.net/...` 解析成 `file://fastly.jsdelivr.net/...`，于是报 `net::ERR_FILE_NOT_FOUND`，插件根本不加载。

之后每次只要 44 字符：

```html
<img src=x onerror="eval(localStorage.fhL)">
```

> 首次注入时 loader 会把自身源码存进 `localStorage.fhL`，并记下版本号 `fhV`；版本一变就自己重新抓一份。
>
> **不用手记版本号**：面板 → 工具 → 🧪 环境自检，顶部有「🔄 查最新版并复制」，会自动查 jsDelivr / GitLab 上的最新标签、验证 CDN 可用、把注入串塞进剪贴板，同时刷新本机缓存。默认每次打开自检就自动跑一次，可在那一行关掉。
>
> 为什么不用 GitLab `/-/raw/`：它返回 `text/plain` + `nosniff`，`<script>` 标签拒执行。jsDelivr 走 GitHub 并给正确的 JS MIME，所以当主源。
>
> `cdn.jsdelivr.net` 在国内常被重置，所以注入串默认用 `fastly.jsdelivr.net`；loader 自身与模块加载会按 `cdn` → `fastly` → `gcore` → raw.githubusercontent → GitLab API 依次重试。

## v3.3

- 修注入串：`mods/test.js` 与 README 改回绝对地址 `https://fastly.jsdelivr.net/...`（原来把 `https:` 剥成 `//`，在 `file://` 页面里会变成 `file://fastly...`，新设备直接加载失败）。
- 新增 ☁ 配置上传 / 下载（工具页）：把本机所有 `fh:*` 配置（API Key 除外，密码/会话/缓存/模型源码除外）加密成一个文件，提交到公开仓库 `config/<id>.json`；换设备或清缓存后输入 PIN 即可找回。配置按用户隔离，同一仓库可以存多份。
  - 首次「⬆ 上传配置」：填 GitLab Token + 设置 PIN（6-30 位）+ 可选管理员密钥；之后「⬇ 更新配置」只需要 PIN，Token 会被加密保存在配置里、自动取用。
  - 每个配置文件用随机 256 位会话密钥加密（AES-GCM），会话密钥分别用 PIN、Token、管理员密钥包裹（PBKDF2-SHA256 15 万次）。PIN 本身不落盘，仓库里只有包裹后的信封。
  - **忘记 PIN**：配置弹窗里有「忘记 PIN」，用上传时的 Token 或管理员密钥解包并重置 PIN（配置内容与 ID 不变，只换 PIN 信封）。仓库管理员也可用 `recover.html` 或 GitLab CI 的 `reset-pin` 手动任务重置。
  - 清缓存后首次打开插件，若云端已有配置，会弹一条可点击的提示「☁ 云端有 N 份配置，点此输入 PIN 恢复」。
- 主面板重排：学习（改名 / 积分 / 灵宠 / 宠物图 / 加宠物 / 解锁4只）、工具（网页 / 相机 / 文件 / 小说 / 音乐 / 图片 / 转印 / 存档 / 遮罩 / 名单 / 清答案 / 上传配置 / 更新配置 / 解除限时 / 清空）、chat（AI 网页）、白板（占位按钮，功能开发中）、便签。
- AI 网页（chat）：拍照改为网页相机（`getUserMedia`，不走系统相机），支持前后摄像头切换；不可用时才降级为文件选择。附件栏在设置过 GitLab Token 后多一个「上传至 GitLab 仓库」勾选项。
- 相机 / 文件（`mods/media.js`）：设置过 GitLab Token 时，查看媒体窗口顶栏出现 ⬆，可把当前图片/视频直接上传到仓库 `media/`。
- 网页（`mods/embed.js`）：每个网页窗口顶栏最左新增「←」，关闭当前窗口并回到上一个打开的网页；没有上一个时按钮置灰。

## v3.2.1

- 修 CDN：`cdn.jsdelivr.net` 在国内被重置，注入串改用 `fastly.jsdelivr.net`；loader 自身与模块按 `cdn` → `fastly` → `gcore` → raw.githubusercontent → GitLab API 依次重试。
- 环境自检（🧪）也改成先试 fastly 镜像再回退 cdn，生成的注入串直接可用。
- 版本号（`TAG`）升到 `3.2.1`：jsDelivr 上 `v3.2` 标签被旧提交的缓存占住，换个新标签才能立刻生效。

## v3.2

- 新增 ⏱ 解除限时（工具页）：一键永久解除页面 v3.0 起加的限时——上课时段锁、周末封闭、18:20 后每天 20 分钟配额。
- 只改页面自己的判定函数（`lockInfo` / `applyLock` / `tickUsage` / `lockNow`），不动 `LOCK` / `USAGE`；解除标记存本机 `fh:lockfree`，之后每次 loader 一跑就自动生效，不用再点。再点一次确认可恢复原来的规则。

## v3.1

- AI 网页全屏（⛶）；API Key / 上传 Token 保存后只显示「前 7 位 + 后 5 位」，之后不再回显完整密钥，只能点「修改」覆盖。
- 拍照 / 选图：本地压缩后随消息发送；可勾选自动上传 GitLab `media/`；同时把原图存进本机 IndexedDB 相册。
- 支持 OpenAI Responses 接口（`POST /v1/responses`），在「接口」里切换 Chat Completions / Responses（两者都支持流式与思考过程）。
- 自定义模型：可手填，也可点「扫描」从 `GET /models` 拉取列表（最多 300 个，存本机）。
- 自定义 API 地址：兼容中转站，自动补 `/v1` 与 `/chat/completions` / `/responses`，扫描时自动推导 `/models`。
- 新增 🗂 对话列表：多会话切换 / 删除；按 API Key（没有 Key 时按上传 Token）识别用户，不同用户会话互不可见。
- 新增 🖼 相册：IndexedDB 存原图（不压缩、不上传），点开可查看 / 下载 / 删除，按用户隔离。
- 新增 💬 聊天室（共享）：所有用户可见；消息写进 GitLab 仓库 `message/`，30 秒轮询 + 本机缓存。
- 新增 📡 探测 / 缓存：纯前端检测 API 地址、GitLab Token/仓库、`message/` 与 `media/` 目录、localStorage / IndexedDB 用量，可清聊天室缓存。

## v3.0

- 主面板标题栏新增 ◐，主面板透明度最低 5%；每个模块窗口的 ◐ 也降到 5%。标题栏始终不透明，低透明度下仍可关窗、把透明度调回来。
- 新增 🤖 AI 网页：直连 DeepSeek V4.1 Flash（`deepseek-flash`），API Key 只存本机 `localStorage`；支持深/浅/自动主题、思考深度（关闭/低/高/最大）、流式输出、思考过程折叠和本机对话记录。

## 功能

| 按钮 | 文件 | 作用 |
|---|---|---|
| 🤖 AI 网页 | `mods/ai.js` | 全屏、密钥掩码、网页相机拍照/相册、多会话、Chat/Responses、模型扫描、共享聊天室、探测缓存 |
| ⬆ 上传配置 | `loader.js` | 本机 `fh:*` 配置加密上传到 `config/<id>.json`（除 API Key / 会话 / 缓存） |
| ⬇ 更新配置 | `loader.js` | 输入 PIN 从云端解密取回配置，换设备/清缓存后一键恢复 |
| ◐ 透明度 | `loader.js` | 主面板与模块窗口 5%–100%，标题栏保持可操作 |
| 💰 积分 | `mods/score.js` | 设 `score` + `earned`（两个一起改才生效） |
| 🐾 灵宠 | `mods/pets.js` | 数量（≤4）、种类（fox/qilin/cat/dog）、名字 |
| 🔓 解锁4只 | `mods/unlock.js` | 补满填空题进度 + 积分到 5400 |
| ✏️ 改名 | `mods/rename.js` | 清玩家名 / 灵宠名 / 排行榜里的旧记录 |
| 🧹 清答案 | `mods/clean.js` | 删错题本里存的答题原文 `yourAns` |
| 🖼 图片 | `mods/img.js` | 直链图片全屏弹窗 |
| 🌐 网页 | `mods/embed.js` | 网址 iframe 弹窗；顶栏「←」回到上一个网页（受对方 X-Frame-Options 限制） |
| 📷 相机 / 📂 文件 | `mods/media.js` | 网页相机拍照录像 / 本地媒体查看；有 Token 时可 ⬆ 上传到 GitLab `media/` |
| 📦 存档 | `mods/dump.js` | 展示并复制完整 `state` JSON |
| 💣 清空 | `mods/reset.js` | 清 `wycg_v3` + `wycg_rank_v1` |
| ⏱ 解除限时 | `loader.js` | 一键永久解除上课时段 / 周末 / 20 分钟配额 |
| 🖌 白板 | `loader.js` | 占位按钮（v3.3 仅提示「开发中」） |

## 配置同步（v3.3）

`config/<id>.json` 结构（公开仓库，加密后才提交）：

```js
{
  v: 1, at, tag, id,                            // 版本 / 时间 / 插件版本 / 配置 ID（u+10 位 base36）
  kdf: { salt, iter: 150000 },                  // PBKDF2-SHA256
  hint,                                         // 昵称（明文，方便认领）
  wrapPin,                                      // AES-GCM(DK, KDF('pin|'+id+'|'+PIN))     ← 日常解锁
  wrapTok,                                      // AES-GCM(DK, KDF('tok|'+id+'|'+TOKEN))   ← 忘记 PIN 用
  wrapAdm,                                      // AES-GCM(DK, KDF('adm|'+id+'|'+管理员密钥)) ← 管理员重置用
  box: { tok, keys }                            // AES-GCM(DK, {上传用 Token, 全部配置键值})
}
```

- `DK` 是每份配置随机的 256 位密钥；PIN / Token / 管理员密钥只用来包裹 `DK`，都不落盘。
- 配置 ID 与 PIN 无关：重置 PIN 不改文件名，旧 PIN 立即失效。
- `box.keys` 只收 `fh:*`（主题、透明度、网页站点、便签、解除限时标记、AI 地址/模型/思考深度等）；排除 API Key、会话、聊天记录、聊天室缓存、指令历史、`fh:mod:*` 源码缓存、`fh:cfg:*` 自身。
- 恢复流程：`pullConfig` → 列出 `config/` → 逐个试解 `wrapPin` → 命中即解 `box` → 写回 localStorage（含 `fh:ai:gitToken`）。

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

`localStorage` 键：`wycg_v3`（学习数据）、`wycg_rank_v1`（排行榜）、`wycg_lock_v1`（家长密码）、`fh:lockfree`（本机解除限时标记）；插件自身配置 `fh:*`（主题、主面板透明度、`fh:sites`、`fh:note`、AI 地址/模型/思考深度/Token 等），其中 `fh:ai:key` 永不上传，`fh:cfg:id` / `fh:cfg:at` / `fh:cfg:admKey` 记录本机云端配置状态。

## 注意

- 面板脚本运行在页面上下文，能读写全部 localStorage。
- GitLab API 的 raw 有缓存，改了文件加 `&t=` 时间戳即可绕过（loader 里已经带上）。
- 各模块用 `prompt()` 交互，改到一半取消不会写入。
