# fuulea_hack

《文言诗文·课下注释闯关》的单文件页面补丁集。每个功能一个独立脚本，由 `loader.js` 拉起一个浮动面板按需加载。

## 注入（最短）

贴进「注释填空」的输入框，随便答错提交：

```html
<img src=x onerror="with(document)body.appendChild(createElement('script')).src='https://fastly.jsdelivr.net/gh/zhaoqinhao123/fuulea_hack@3.9/loader.js'">
```

154 字符，输入框没有长度限制，直接粘贴即可。面板出现在右下角。**再注入一次就是隐形开关**：面板开着时注入 → 整块隐藏；再注入 → 显形。藏起来时页面里只剩你原本的内容，录屏、投屏都不留痕迹。

> 注入串必须带 `https:` 协议。v3.2.1 及更早的 README 示例是不带协议的 `//fastly...`，页面本身用 `file://` 打开时，浏览器会把 `//fastly.jsdelivr.net/...` 解析成 `file://fastly.jsdelivr.net/...`，于是报 `net::ERR_FILE_NOT_FOUND`，插件根本不加载。

之后每次只要 44 字符：

```html
<img src=x onerror="eval(localStorage.fhL)">
```

> 首次注入时 loader 会把自身源码存进 `localStorage.fhL`，并记下版本号 `fhV`；版本一变就自己重新抓一份。
>
> **不用手记版本号**：面板 → 工具 → 🔄 版本更新（v3.6 新增），点「查询最新版」会自动查 jsDelivr / GitHub 上的最新标签、验证 CDN 可用，并给出两种注入串（纯注入串 / 带「版本vX.Y」前缀）一键复制，还能顺手刷新本机缓存。原来的 🧪 环境自检里也保留着同样的能力。
>
> 为什么不用 GitLab `/-/raw/`：它返回 `text/plain` + `nosniff`，`<script>` 标签拒执行。jsDelivr 走 GitHub 并给正确的 JS MIME，所以当主源。
>
> `cdn.jsdelivr.net` 在国内常被重置，所以注入串默认用 `fastly.jsdelivr.net`；loader 自身与模块加载会按 `cdn` → `fastly` → `gcore` → raw.githubusercontent → GitLab API 依次重试。

## v3.9

- **主面板默认 10% 透明度**：注入后内容区几乎隐形，标题栏仍保留，随时能把透明度调回来；最低仍是 5%，设置存 `fh:mainOp`。
- **AI 网页默认浮动窗**：打开就是可拖动、可缩放的小窗（宽度 ≤860、高度 ≤820），右下角手柄可调大小；位置 / 尺寸记在 `fh:ai:rect`，全屏后再退出会回到原来的浮动大小，不再卡在整屏。
- **两个相机都换成圆形快门**：网页相机（`mods/media.js`）和 AI 拍照（`mods/ai.js`）中间都是大圆快门，左右放翻转 / 录像或关闭；按下的缩放动画保留。
- **AI 拍照支持变焦**：优先用摄像头原生 `zoom` 能力，没有就用画面中心裁切模拟；滑杆 / ± 按钮 1×–4×（原生上限更高时按设备），成片与预览一致。
- **相机预览不裁切**：网页相机由 `object-fit:cover` 改成 `contain`，画面完整显示，比例不一致时用黑边填充，不再切掉边缘。
- **新增 🧭 探测**：工具页打开 `mods/probe.js`，集中提供权限状态快照、摄像头 / 麦克风 / 定位 / 屏幕共享、文件 / 剪贴板 / 分享 / 联系人、全屏 / 常亮 / 振动 / 通知 / 传感器 / 电池 / 网络、蓝牙 / USB / 串口 / HID / MIDI / NFC，以及电话 / 短信 / 微信 / 支付宝 / 淘宝等外部 App 的 URI Scheme 唤起。网页不能枚举已安装软件，也不能绕过系统授权，按钮会真实发起请求并显示 granted / denied / 不支持。
- **修网页返回键**：网页窗口改为真栈：只显示栈顶，← 退回上一个网页，栈底再退回网页列表；✕ 关闭当前并露出上一个，返回不再删除错窗口。
- 版本号 `TAG` / AI 头栏 / 聊天室徽标 / 主面板标签统一升到 3.9。

## v3.8

- **聊天室彻底独立**：主面板「💬 聊天室（共享）」改为加载独立的 `mods/room.js`，不再顺带打开 AI 网页；聊天室有自己的窗口、Markdown / LaTeX 渲染、GitLab `message/` 读取、30 秒轮询、拖动 / 缩放 / 全屏 / Esc 关闭，位置大小仍记在 `fh:ai:roomRect`。未登录只能看本机缓存并提示登录，未配置 Token 时不能同步或发送。
- **AI 底部显示用量和速率**：新增一行 9px 小字，累计本会话输入 / 输出 token（按会话存 `fh:ai:usage:<sid>`），并显示本轮 `tok/s`；输入按每轮上下文重新计费，所以会大于实际字数。
- **余额显示**：仅当 API 地址是 DeepSeek 官方域名时，用 Key 请求 `https://api.deepseek.com/user/balance`，显示人民币余额；取不到（代理、401、跨域、断网）显示 `余额 --` 占位，点一下可重试，不会把 Key 发给第三方域名。
- **media 按用户分目录**：AI 图片上传和相机 / 文件模块统一写到 `media/<用户名>/<时间>-<随机>.<ext>`；未登录写 `media/guest/`。用户名会去掉路径分隔符等非法字符并截到 40 字。
- 版本号 `TAG` / AI 头栏 / 主面板标签统一升到 3.8；聊天室模块从 `mods/ai.js` 拆到 `mods/room.js`。

## v3.7

- **聊天室改成独立浮窗**：从 AI 卡片里脱出来，标题栏可自由拖动，右下角手柄可自由缩放；位置和大小记在本机 `fh:ai:roomRect`，下次打开原样恢复，双击标题栏复位到屏幕中央。
- **全屏按钮可反复进出**：退出全屏时把进入前的内联位置 / 尺寸 / 圆角 / 阴影 / 缩放状态原样还原，浮动窗口不会被卡成整屏；全屏按钮切换后的 600ms 内点在遮罩上不会误关窗口（之前按钮随布局跳位，第二下正好点到遮罩）。
- **主面板高度固定为 400px**（视口不够时 `86vh`）：切「学习 / 工具 / chat / 白板 / 便签」不再一跳一跳，内容多的页面在面板内滚动；迷你态仍按内容自适应。
- 版本号 `TAG` / AI 头栏 / 主面板标签统一升到 3.7。
- 补充：桌面实验页 `探索生长素类似物促进插条生根的最适浓度.html` 的「下一批浓度」输入框只接受数字（`trim().split(/[\s,，、;；]+/).map(Number)`），页面没有 `v-html` / `innerHTML` 回显，把 `<img onerror=...>` 注入串粘进去只会当普通文本，**不能**靠它加载插件；要在这页用插件只能直接改 HTML，在 `</body>` 前加 `loader.js`，或使用书签脚本。

## v3.6

- **AI 对话与聊天室支持 Markdown + LaTeX**：AI 回答（流式结束后）与聊天室消息会渲染标题、粗斜体、删除线、行内码 / 代码块、列表、引用、分割线、表格和 http(s) 链接；`$...$` / `\(...\)` 行内公式与 `$$...$$` / `\[...\]` 块级公式会按需懒加载 KaTeX（fastly → cdn 镜像，失败自动回退原文）。用户的提问气泡仍按纯文本显示。
- **聊天室也能全屏**：聊天室标题栏新增 ⛶，与 AI 网页头栏的全屏按钮状态同步；Esc 先退全屏再关窗口。
- **去掉重复的「最大化」**：AI 网页只保留自带的 ⛶ 全屏，不再额外注入 loader 的小窗 / 全屏按钮；全屏时会清掉拖动留下的内联尺寸，不再被浮动窗口的宽高卡住。
- **主面板最小化后可以点回来了**：迷你态只留猫头和关闭按钮，整颗胶囊可点展开（原来剩下的图标把它挤出可视区，猫头被裁掉，导致怎么点都还原不了）。
- **工具页新增 🔄 版本更新**：显示当前 / 最新版本与校验来源，点一下就能复制注入串——可选「纯注入串」或「版本v3.6 + 注入串」；还能把最新 loader.js 写进本机缓存。不自动注入。
- **聊天室昵称固定用登录用户名**：删掉单独的自定义昵称输入；未登录时输入框禁用并提示先登录，未保存上传 Token 时提示先去 🔑。
- **上传 / 恢复配置改用私有仓库** `https://gitlab.com/yq-group2/fuulea_ai_repository`：项目路径已做 URL 编码；新设备恢复时先输入有读权限的 Token（`read_api` 即可），校验通过后再输 PIN。Token 无写权限时上传会明确提示需要 Developer / Maintainer 及以上。
- 版本号 `TAG` / AI 头栏 / 主面板标签统一升到 3.6。

## v3.5

- AI 图片输入改为**多图**：一次可选 / 拍最多 9 张，逐张压缩、逐张显示状态（处理中 / 上传中 / 已传 / 重试 / 仅发送），可单张重试或移除；发送时全部作为 `image_url`（Responses 模式自动转 `input_image`）随消息提交。
- 新增**图片缩放**：点聊天里的图片、附件缩略图或相册图片会打开全屏缩放层——滚轮 / 双指缩放（40%–800%）、拖动平移、双击在 1× 与 2.5× 间切换、`－ / 1:1 / 适合 / ＋` 按钮，Esc 或 ✕ 关闭；相册查看窗也多了一个「缩放」按钮。
- **配置 PIN 不再反复弹窗**：上传配置时自动生成 PIN（形如 `FH7k2m-9xq4-p3wd`）并保存在本机 `fh:cfg:pin`，成功后只展示一次可复制的恢复 PIN；本机有 PIN 时「⬇ 更新配置」直接静默恢复，不再要求输入。只有换设备 / 清缓存后才需要手输 PIN（提示里给出格式），登录页也会显示当前恢复 PIN。每次上传都会用新盐重写整份配置，旧 PIN 随之失效，避免「旧 PIN 解不开」的困惑。
- **聊天室移到主面板 chat 下**：工具 → chat 组里新增「💬 聊天室（共享）」，点一下直接打开聊天室（AI 网页窗口头栏不再放聊天室按钮）；未登录时只读并提示先登录，未配置 Token 时提示先保存。
- 版本号 `TAG` / AI 头栏 / 主面板标签统一升到 3.5。

## v3.4

- 新增 👤 账号（用户名 + PIN）：聊天室、上传 / 更新配置、网页配置这些需要身份的功能，先登录账号再使用。
  - 第一次输入的用户名会自动注册；PIN 4-30 位。登录状态存在本机 `fh:acct`，刷新 / 重开页面都不用再输，直到手动「退出登录」或清空缓存。
  - 用户名 + PIN 每 5 秒只能提交一次，失败后按钮会倒计时提示。
  - AI Key、上传 Token、网页常用站点（`fh:sites`）都归到当前账号：登录时载入、保存时同步回账号、退出后从本机清掉。换设备可用 ⬇ 更新配置（自动用本机 PIN，换设备时手输）恢复其余配置。
  - 聊天室发送、⬆ 上传配置 / ⬇ 更新配置要求已登录且本机有 GitLab Token；没有 Token 时提示先去 🔑 保存，聊天室只读、发送置灰。
  - 旧版按 API Key / Token 哈希隔离的会话与相册，在首次登录时会自动迁到账号名下。
  - 账号记录与 PIN 哈希只存本机 `fh:acct`，不会随配置上传。

## v3.3

- 修注入串：`mods/test.js` 与 README 改回绝对地址 `https://fastly.jsdelivr.net/...`（原来把 `https:` 剥成 `//`，在 `file://` 页面里会变成 `file://fastly...`，新设备直接加载失败）。
- 新增 ☁ 配置上传 / 下载（工具页）：把本机所有 `fh:*` 配置（API Key 除外，密码/会话/缓存/用量/模型源码除外）加密成一个文件，提交到公开仓库 `config/<id>.json`；换设备或清缓存后输入 PIN 即可找回。配置按用户隔离，同一仓库可以存多份。
  - 首次「⬆ 上传配置」：填 GitLab Token + 设置 PIN（6-30 位）+ 可选管理员密钥；之后「⬇ 更新配置」只需要 PIN，Token 会被加密保存在配置里、自动取用。
  - 每个配置文件用随机 256 位会话密钥加密（AES-GCM），会话密钥分别用 PIN、Token、管理员密钥包裹（PBKDF2-SHA256 15 万次）。PIN 本身不落盘，仓库里只有包裹后的信封。
  - **忘记 PIN**：配置弹窗里有「忘记 PIN」，用上传时的 Token 或管理员密钥解包并重置 PIN（配置内容与 ID 不变，只换 PIN 信封）。仓库管理员也可用 `recover.html` 或 GitLab CI 的 `reset-pin` 手动任务重置。
  - 清缓存后首次打开插件，若云端已有配置，会弹一条可点击的提示「☁ 云端有 N 份配置，点此输入 PIN 恢复」。
- 主面板重排：学习（改名 / 积分 / 灵宠 / 宠物图 / 加宠物 / 解锁4只）、工具（网页 / 相机 / 文件 / 小说 / 音乐 / 图片 / 转印 / 存档 / 遮罩 / 名单 / 清答案 / 上传配置 / 更新配置 / 解除限时 / 清空）、chat（AI 网页）、白板（占位按钮，功能开发中）、便签。
- AI 网页（chat）：拍照改为网页相机（`getUserMedia`，不走系统相机），支持前后摄像头切换；不可用时才降级为文件选择。附件栏在设置过 GitLab Token 后多一个「上传至 GitLab 仓库」勾选项。
- 相机 / 文件（`mods/media.js`）：设置过 GitLab Token 时，查看媒体窗口顶栏出现 ⬆，可把当前图片/视频直接上传到仓库 `media/<用户名>/`（未登录为 `media/guest/`）。
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
- 拍照 / 选图：本地压缩后随消息发送；可勾选自动上传 GitLab `media/<用户名>/`（未登录 `media/guest/`）；同时把原图存进本机 IndexedDB 相册。
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
| 🤖 AI 网页 | `mods/ai.js` | 全屏、密钥掩码、网页相机拍照 / 相册、多会话、Chat/Responses、模型扫描、探测缓存；多图输入（≤9 张）+ 图片缩放 |
| 💬 聊天室（共享） | `mods/room.js` | 独立窗口（不打开 AI），消息写 GitLab `message/`，30 秒轮询 + 本机缓存；拖动 / 缩放 / 全屏 |
| 👤 账号 | `loader.js` | 用户名 + PIN 登录（本机持久）；AI Key / Token / 网页配置按账号保存 |
| ⬆ 上传配置 | `loader.js` | 本机 `fh:*` 配置加密上传到私有仓库 `yq-group2/fuulea_ai_repository` 的 `config/<id>.json`（除 API Key / 会话 / 缓存 / 用量）；PIN 自动生成并保存在本机 |
| ⬇ 更新配置 | `loader.js` | 本机有 PIN 时静默恢复，换设备先输入读权限 Token 再输 PIN |
| 🔄 版本更新 | `mods/update.js` | 查最新版本、校验 CDN、复制纯注入串或「版本vX.Y + 注入串」、刷新本机缓存 |
| ◐ 透明度 | `loader.js` | 主面板与模块窗口 5%–100%，标题栏保持可操作 |
| 💰 积分 | `mods/score.js` | 设 `score` + `earned`（两个一起改才生效） |
| 🐾 灵宠 | `mods/pets.js` | 数量（≤4）、种类（fox/qilin/cat/dog）、名字 |
| 🔓 解锁4只 | `mods/unlock.js` | 补满填空题进度 + 积分到 5400 |
| ✏️ 改名 | `mods/rename.js` | 清玩家名 / 灵宠名 / 排行榜里的旧记录 |
| 🧹 清答案 | `mods/clean.js` | 删错题本里存的答题原文 `yourAns` |
| 🖼 图片 | `mods/img.js` | 直链图片全屏弹窗 |
| 🌐 网页 | `mods/embed.js` | 网址 iframe 弹窗；真栈返回：← 回上一个网页 / 列表（受对方 X-Frame-Options 限制） |
| 📷 相机 / 📂 文件 | `mods/media.js` | 网页相机拍照录像（完整比例、圆形快门）/ 本地媒体查看；有 Token 时可 ⬆ 上传到 GitLab `media/<用户名>/` |
| 🧭 探测 | `mods/probe.js` | 权限状态、摄像头 / 麦克风 / 定位 / 屏幕共享、文件 / 剪贴板 / 分享、传感器 / 电池 / 网络、蓝牙 / USB / 串口 / HID / MIDI / NFC、外部 App URI Scheme |
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
- `box.keys` 只收 `fh:*`（主题、透明度、网页站点、便签、解除限时标记、AI 地址/模型/思考深度等）；排除 API Key、会话、聊天记录、聊天室缓存、token 用量、指令历史、`fh:mod:*` 源码缓存、`fh:cfg:*` 自身（含本机 PIN `fh:cfg:pin` / `fh:cfg:pinAt`）。
- v3.5 起 PIN 由插件生成并保存在本机：上传时若有 Token 就直接用本地 PIN 重写配置，成功页展示一次可复制的 PIN；恢复时先试本机 PIN，失败才弹输入框（换设备 / 清缓存）。每次上传都会换新盐和新的 `wrapPin`，旧 PIN 立即失效。
- 恢复流程：`pullConfig` → 没有读权限 Token 时先弹 Token（校验 `read_api`）→ 有本机 PIN 直接 `cfgPull(pin)`，否则输入 PIN → 列出 `config/` → 逐个试解 `wrapPin` → 命中即解 `box` → 写回 localStorage（含 `fh:ai:gitToken`）并 `cfgPinSet(pin)`。
- v3.6 起仓库是私有的（`yq-group2/fuulea_ai_repository`）：上传需要 Developer 及以上的写权限，读取（恢复 / 启动探测）需要 `read_api`。只用于读配置的 Token 存在本机 `fh:cfg:rTok`，恢复成功后会被备份里的真 Token 覆盖并清掉。

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

`localStorage` 键：`wycg_v3`（学习数据）、`wycg_rank_v1`（排行榜）、`wycg_lock_v1`（家长密码）、`fh:lockfree`（本机解除限时标记）；插件自身配置 `fh:*`（主题、主面板透明度、`fh:sites`、`fh:note`、AI 地址/模型/思考深度/Token 等），其中 `fh:ai:key` 永不上传，`fh:cfg:id` / `fh:cfg:at` / `fh:cfg:admKey` 记录本机云端配置状态，`fh:cfg:pin` / `fh:cfg:pinAt` 是本机保存的恢复 PIN（不上传、不再反复询问）；`fh:ai:roomRect` 记聊天室位置大小，`fh:room:cache` 是聊天室消息缓存（最多 200 条），`fh:ai:usage:<sid>` 记每个会话的 token 累计；`fh:acct` 存账号（用户名 / PIN 哈希 / 账号的 Key、Token、网页配置），同样不上传。

## 注意

- 面板脚本运行在页面上下文，能读写全部 localStorage。
- GitLab API 的 raw 有缓存，改了文件加 `&t=` 时间戳即可绕过（loader 里已经带上）。
- 各模块用 `prompt()` 交互，改到一半取消不会写入。
