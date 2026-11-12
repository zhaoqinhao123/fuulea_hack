/* 聊天室（共享）v3.11 — 独立于 AI 网页的浮窗；消息存 GitLab message/，图片/视频/语音存 media/ */
(function () {
  'use strict';

  var OLD = document.getElementById('__rm');
  if (OLD) { try { OLD.remove(); } catch (e) {} }

  var GIT_HOST = 'https://gitlab.com';
  var GIT_PROJ = 'yq-group2/fuulea_ai_repository';
  var GIT_BRANCH = 'main';
  var ROOM_DIR = 'message';
  var MEDIA_DIR = 'media';
  var POLL = 30000;
  // v3.11：24 小时只用于「拉取」——本地已有的消息不再 GET；显示与缓存不再按 24h 过滤
  var WINDOW_MS = 24 * 60 * 60 * 1000;
  var MAX_MSGS = 1000;      // v3.11：本地最多保留 1000 条历史
  var MAX_TREE_PAGES = 12;  // v3.11：树分页最多回溯 12 页
  var K_CACHE = 'fh:room:cache';
  var K_RECT = 'fh:ai:roomRect';
  var K_GIT = 'fh:ai:gitToken';
  var K_OLD_CACHE = 'fh:ai:roomCache';

  function read(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function hash8(s) {
    s = String(s);
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function acct() {
    try { if (window.__fhAcct && window.__fhAcct.cur) return window.__fhAcct.cur(); } catch (e) {}
    return null;
  }
  function token() {
    var t = read(K_GIT, '');
    if (!t) { try { if (window.__fhAcct && window.__fhAcct.token) t = window.__fhAcct.token() || ''; } catch (e) {} }
    return String(t || '').trim();
  }
  function ownerTag() {
    var r = acct();
    if (r && r.user) {
      try { return 'u' + (window.__fhAcct.userKey ? window.__fhAcct.userKey(r.user) : hash8(String(r.user).toLowerCase())); } catch (e) {}
    }
    var t = token();
    return t ? 'g' + hash8(t) : 'local';
  }
  function myName() { var r = acct(); return r && r.user ? String(r.user) : ''; }
  function canSend() { return !!(acct() && token()); }
  function mediaUserDir() {
    var r = acct();
    var u = r && r.user ? String(r.user) : '';
    u = String(u).replace(/[\/\\:*?"<>|\u0000-\u001f]+/g, '_').replace(/^\.+|\.+$/g, '').slice(0, 40);
    return u || 'guest';
  }
  function mediaExt(name) {
    var n = String(name || '').toLowerCase();
    var i = n.lastIndexOf('.');
    if (i > 0 && n.length - i <= 6) return n.slice(i);
    return '';
  }
  function mediaType(ext, mime) {
    var m = String(mime || '').toLowerCase();
    if (m.indexOf('video/') === 0) return 'video';
    if (m.indexOf('audio/') === 0) return 'voice';
    if (/^image\//.test(m)) return 'image';
    if (/\.(mp4|webm|mov|m4v|avi|mkv|3gp)$/i.test(ext)) return 'video';
    if (/\.(mp3|wav|m4a|aac|ogg|webm|opus|amr)$/i.test(ext)) return 'voice';
    if (/\.(jpe?g|png|gif|webp|bmp|svg|heic|heif)$/i.test(ext)) return 'image';
    return 'file';
  }
  function mediaName(m) {
    if (m.name) return String(m.name);   // v3.11：优先用发送端记下的原始文件名 / 语音标题
    var p = String(m.file || '');
    var i = p.lastIndexOf('/');
    return i >= 0 ? p.slice(i + 1) : p;
  }
  // 下载用的文件名：显示名没有扩展名时补上（语音消息标题是「语音消息 0:03」这种）
  function dlName(m) {
    var n = mediaName(m);
    if (mediaExt(n)) return n;
    var ext = mediaExt(String(m.file || ''));
    return n + (ext || '');
  }
  function kindLabel(k) {    return k === 'image' ? '图片' : k === 'video' ? '视频' : k === 'voice' ? '语音消息' : '文件';
  }

  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
  function stamp() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + '-' +
      pad2(d.getHours()) + '-' + pad2(d.getMinutes()) + '-' + pad2(d.getSeconds());
  }
  function rand4() { return String(Math.floor(Math.random() * 10000)).padStart(4, '0'); }
  // v3.10：从 message/2026-11-12-17-50-58-1234.json 解析发送时间
  function pathTime(p) {
    var b = String(p || '');
    var i = b.lastIndexOf('/');
    if (i >= 0) b = b.slice(i + 1);
    var m = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/.exec(b);
    if (!m) return 0;
    var t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
    return isNaN(t) ? 0 : t;
  }
  // v3.11：24 小时过滤只用在「拉取」判断（loadRoom 里），不再用于显示/缓存
  function fmtTime(at) {
    var d = new Date(Number(at) || Date.now());
    if (isNaN(d.getTime())) return '';
    var now = new Date();
    var hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    if (d.toDateString() === now.toDateString()) return hm;
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm;
  }

  // ── GitLab REST（只读写 message/） ──
  function fileUrl(p, raw) {
    return GIT_HOST + '/api/v4/projects/' + encodeURIComponent(GIT_PROJ) + '/repository/files/' +
      encodeURIComponent(p) + (raw ? '/raw' : '') + '?ref=' + encodeURIComponent(GIT_BRANCH);
  }
  function treeUrl(p, page) {
    return GIT_HOST + '/api/v4/projects/' + encodeURIComponent(GIT_PROJ) + '/repository/tree' +
      '?ref=' + encodeURIComponent(GIT_BRANCH) + '&per_page=100&path=' + encodeURIComponent(p) +
      (page ? '&page=' + page : '');
  }
  function gitReq(method, url, body, binary) {
    return new Promise(function (resolve) {
      var x = new XMLHttpRequest();
      try { x.open(method, url, true); } catch (e) { resolve({ ok: false, status: 0, text: String(e) }); return; }
      x.setRequestHeader('PRIVATE-TOKEN', token());
      // v3.11 修复：以前 responseType='blob' 被包在 if (body != null) 里，GET 下载（body=null）
      // 永远设不上 blob，x.response 是空字符串 → gitGetBlob 恒为 null → 语音/视频/文件全部「下载失败」
      if (binary) x.responseType = 'blob';
      else if (body != null) x.setRequestHeader('Content-Type', 'application/json');
      x.timeout = 45000;
      x.onload = function () {
        var hs = '';
        try { hs = x.getAllResponseHeaders ? x.getAllResponseHeaders() : ''; } catch (e) {}
        var txt = '';
        // responseType='blob' 时读 responseText 会抛 InvalidStateError，必须包起来
        try { txt = x.responseText || ''; } catch (e) {}
        resolve({ ok: x.status >= 200 && x.status < 300, status: x.status, text: txt, blob: x.response || null, headers: hs });
      };
      x.onerror = function () { resolve({ ok: false, status: 0, text: '', blob: null }); };
      x.ontimeout = function () { resolve({ ok: false, status: 0, text: 'timeout', blob: null }); };
      try { x.send(body == null ? null : body); } catch (e) { resolve({ ok: false, status: 0, text: String(e), blob: null }); }
    });
  }
  function b64utf8(s) {
    var bytes = new TextEncoder().encode(String(s));
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function treeItems(text) {
    var arr = [];
    try { arr = JSON.parse(text); } catch (e) {}
    if (Object.prototype.toString.call(arr) !== '[object Array]') arr = [];
    return arr.filter(function (x) { return x && x.type === 'blob' && x.path; }).map(function (x) { return x.path; });
  }
  function headerNum(h, name) {
    var m = new RegExp('(?:^|\\r?\\n)' + name + ':\\s*(\\d+)', 'i').exec(String(h || ''));
    return m ? Number(m[1]) : 0;
  }
  // v3.11：从最后一页往前逐页翻，翻到「本页最老消息已早于 cutoff」就停（最多 MAX_TREE_PAGES 页）；
  // 第 1 页始终取一次（兜住 junk.json 这类解析不出时间的文件）。以前只取第 1 页 + 最后一页，中间页会漏。
  function gitTree(p, cutoff) {
    return gitReq('GET', treeUrl(p, 1)).then(function (first) {
      if (!first.ok) return { ok: false, status: first.status, items: [] };
      var out = { ok: true, status: first.status, items: treeItems(first.text) };
      var last = headerNum(first.headers, 'X-Total-Pages');
      if (last <= 1) return out;
      var page = last, fetched = 0;
      function step() {
        if (page < 2 || fetched >= MAX_TREE_PAGES) return Promise.resolve(out);
        var cur = page--;
        fetched++;
        return gitReq('GET', treeUrl(p, cur)).then(function (r) {
          if (!r.ok) return out;
          var list = treeItems(r.text);
          if (!list.length) return out;
          out.items = out.items.concat(list);
          var oldest = 0;
          list.forEach(function (x) {
            var t = pathTime(x);
            if (t && (!oldest || t < oldest)) oldest = t;
          });
          if (oldest && oldest < cutoff) return out;
          return step();
        });
      }
      return step();
    });
  }
  function gitRaw(p) {
    return gitReq('GET', fileUrl(p, true)).then(function (r) {
      return r.ok ? r.text : null;
    });
  }
  function gitPut(p, text) {
    var body = JSON.stringify({
      branch: GIT_BRANCH, content: b64utf8(text), encoding: 'base64',
      commit_message: 'room message ' + p.replace(/^message\//, '')
    });
    return gitReq('POST', fileUrl(p), body);
  }
  function gitGetBlob(p) {
    return gitReq('GET', fileUrl(p, true), null, true).then(function (r) {
      return r.ok && r.blob ? r.blob : null;
    });
  }
  // v3.10 媒体上传：blob → base64 → POST GitLab（media/<用户名>/...）
  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || '')); };
      r.onerror = function () { reject(new Error('文件读取失败')); };
      r.readAsDataURL(blob);
    });
  }
  function mediaNewPath(ext) {
    return MEDIA_DIR + '/' + mediaUserDir() + '/' + stamp() + '-' + rand4() + (ext || '.jpg');
  }
  function uploadBlob(blob, name, cb) {
    var ext = mediaExt(name);
    var path = mediaNewPath(ext || mediaExt(blob.name) || (String(blob.type || '').indexOf('video/') === 0 ? '.mp4' : '.jpg'));
    blobToDataURL(blob).then(function (dataUrl) {
      var b64 = String(dataUrl).split(',')[1] || '';
      if (!b64) return cb('读取文件失败');
      var body = JSON.stringify({
        branch: GIT_BRANCH, content: b64, encoding: 'base64',
        commit_message: 'upload media ' + path.replace(/^media\//, '')
      });
      gitReq('POST', fileUrl(path), body).then(function (res) {
        if (res.ok) return cb(null, path);
        if (res.status === 400 && /already exists/i.test(res.text || '')) {
          var p2 = mediaNewPath(ext || mediaExt(blob.name) || '.jpg');
          uploadBlobPath(blob, name, p2, cb);
          return;
        }
        var detail = '';
        try { var j = JSON.parse(res.text || '{}'); detail = j.message || ''; } catch (e) {}
        cb('HTTP ' + res.status + (detail ? ' ' + detail : ''));
      });
    }).catch(function (e) { cb(e && e.message ? e.message : String(e)); });
  }
  function uploadBlobPath(blob, name, path, cb) {
    blobToDataURL(blob).then(function (dataUrl) {
      var b64 = String(dataUrl).split(',')[1] || '';
      if (!b64) return cb('读取文件失败');
      var body = JSON.stringify({
        branch: GIT_BRANCH, content: b64, encoding: 'base64',
        commit_message: 'upload media ' + path.replace(/^media\//, '')
      });
      gitReq('POST', fileUrl(path), body).then(function (res) {
        if (res.ok) return cb(null, path);
        var detail = '';
        try { var j = JSON.parse(res.text || '{}'); detail = j.message || ''; } catch (e) {}
        cb('HTTP ' + res.status + (detail ? ' ' + detail : ''));
      });
    }).catch(function (e) { cb(e && e.message ? e.message : String(e)); });
  }

  // ── 缓存 / 消息 ──
  var msgs = [];
  function loadCache() {
    var raw = read(K_CACHE, '');
    if (!raw) raw = read(K_OLD_CACHE, '');
    var arr = [];
    try { arr = JSON.parse(raw); } catch (e) {}
    if (Object.prototype.toString.call(arr) !== '[object Array]') arr = [];
    msgs = arr.filter(function (m) {
      return m && typeof m === 'object' && (m.text || m.image || m.file) && m.p;
    }).map(function (m) {
      var kind = String(m.kind || '');
      if (!kind) {
        var ext = mediaExt(String(m.file || m.image || ''));
        kind = mediaType(ext, String(m.mime || ''));
      }
      return {
        p: String(m.p), at: Number(m.at) || 0, nick: String(m.nick || '匿名'),
        owner: String(m.owner || ''), text: String(m.text || ''), image: String(m.image || ''),
        file: String(m.file || ''), kind: kind,
        mime: String(m.mime || ''), name: String(m.name || ''),
        size: Number(m.size) || 0, dur: Number(m.dur) || 0,
        transcript: m.transcript == null ? undefined : String(m.transcript)
      };
    }).filter(function (m) { return !!m.p; }).slice(-MAX_MSGS);
    msgs.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
  }
  function saveCache() {
    msgs = msgs.slice(-MAX_MSGS);
    try { save(K_CACHE, JSON.stringify(msgs)); } catch (e) {}
  }
  function merge(list) {
    var map = {};
    msgs.forEach(function (m) { map[m.p] = m; });
    list.forEach(function (m) { if (m && m.p) map[m.p] = m; });
    msgs = Object.keys(map).map(function (k) { return map[k]; });
    // v3.11：本地历史不再按 24 小时裁掉（24h 只用于拉取），只受 MAX_MSGS 上限约束
    msgs.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    if (msgs.length > MAX_MSGS) msgs = msgs.slice(-MAX_MSGS);
  }
  function parseMsg(path, text) {
    var j = null;
    try { j = JSON.parse(text); } catch (e) {}
    if (!j || typeof j !== 'object') return null;
    var t = String(j.text == null ? '' : j.text).slice(0, 8000);
    var img = String(j.image == null ? '' : j.image);
    var file = String(j.file == null ? '' : j.file);
    var kind = String(j.kind == null ? '' : j.kind);
    if (!t && !img && !file) return null;
    if (!kind) {
      var ext = mediaExt(file || img);
      kind = mediaType(ext, String(j.mime || ''));
    }
    return {
      p: path, at: Number(j.at) || Date.now(), nick: String(j.nick || '匿名').slice(0, 30),
      owner: String(j.owner || ''), text: t, image: img,
      file: file, kind: kind,
      mime: String(j.mime == null ? '' : j.mime),
      name: String(j.name == null ? '' : j.name),
      size: Number(j.size) || 0, dur: Number(j.dur) || 0,
      transcript: j.transcript == null ? undefined : String(j.transcript)
    };
  }
  // 拉取失败的消息：不再静默丢弃，返回 { list, failed } 供底部提示
  function fetchPaths(paths, onTick) {
    var out = [], failed = 0, i = 0;
    function worker() {
      if (i >= paths.length) return Promise.resolve();
      var p = paths[i++];
      return gitRaw(p).then(function (txt) {
        if (txt == null) failed++;
        else {
          var m = parseMsg(p, txt);
          if (m) out.push(m);
        }
        if (onTick) { try { onTick(out.length + failed, paths.length); } catch (e) {} }
        return worker();
      });
    }
    var ws = [];
    for (var k = 0; k < 4; k++) ws.push(worker());
    return Promise.all(ws).then(function () { return { list: out, failed: failed }; });
  }

  // ── Markdown + LaTeX（纯 DOM 构建，绝不把消息当 HTML 注入）──
  var katexP = null;
  function ensureKatex() {
    if (window.katex && window.katex.render) return Promise.resolve(true);
    if (katexP) return katexP;
    var bases = ['https://fastly.jsdelivr.net/npm/katex@0.16.11/dist/',
                 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/'];
    katexP = new Promise(function (resolve) {
      var i = 0;
      function tryOne() {
        if (i >= bases.length) { resolve(false); return; }
        var base = bases[i++];
        var css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = base + 'katex.min.css';
        document.head.appendChild(css);
        var s = document.createElement('script');
        s.src = base + 'katex.min.js';
        var fin = false;
        var to = setTimeout(function () {
          if (fin) return; fin = true; try { s.remove(); } catch (e) {} tryOne();
        }, 6000);
        s.onload = function () {
          if (fin) return; fin = true; clearTimeout(to);
          resolve(!!(window.katex && window.katex.render));
        };
        s.onerror = function () {
          if (fin) return; fin = true; clearTimeout(to);
          try { s.remove(); } catch (e) {} tryOne();
        };
        document.head.appendChild(s);
      }
      tryOne();
    });
    return katexP;
  }
  function typesetMath(el) {
    var list = el.querySelectorAll('.rm-math');
    if (!list.length) return;
    ensureKatex().then(function (ok) {
      if (!ok) return;
      [].forEach.call(list, function (n) {
        if (n.dataset.done || !n.dataset.tex) return;
        try {
          window.katex.render(n.dataset.tex, n, {
            displayMode: n.dataset.display === '1',
            throwOnError: false, trust: false, strict: 'ignore'
          });
          n.dataset.done = '1';
        } catch (e) {}
      });
    });
  }
  function mdMath(tex, display) {
    var s = document.createElement('span');
    s.className = 'rm-math';
    s.dataset.tex = tex;
    if (display) s.dataset.display = '1';
    s.textContent = display ? ('$$' + tex + '$$') : ('$' + tex + '$');
    return s;
  }
  function mdInline(parent, text) {
    var src = String(text == null ? '' : text);
    var re = /(`+)([\s\S]*?)\1|\$\$([\s\S]+?)\$\$|\$([^\s$][^$\n]*?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]*)\]\(([^)\s]+)\)|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|\*([^*\n]+?)\*|_([^_\n]+?)_|\n|\\([\\`*_{}\[\]()#+\-.!>~$|])/g;
    var last = 0, m;
    while ((m = re.exec(src))) {
      if (m.index > last) parent.appendChild(document.createTextNode(src.slice(last, m.index)));
      last = re.lastIndex;
      if (m[2] !== undefined) {
        var c = document.createElement('code');
        c.textContent = m[2].replace(/^\n|\n$/g, '');
        parent.appendChild(c);
      } else if (m[3] !== undefined) {
        parent.appendChild(mdMath(m[3].trim(), true));
      } else if (m[4] !== undefined) {
        parent.appendChild(mdMath(m[4].trim(), false));
      } else if (m[5] !== undefined) {
        parent.appendChild(mdMath(m[5].trim(), false));
      } else if (m[6] !== undefined) {
        parent.appendChild(mdMath(m[6].trim(), true));
      } else if (m[7] !== undefined) {
        parent.appendChild(document.createTextNode(m[7] || '图片'));
      } else if (m[9] !== undefined) {
        var a;
        if (/^https?:\/\//i.test(m[10])) {
          a = document.createElement('a');
          a.href = m[10];
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = m[9] || m[10];
        } else {
          a = document.createElement('span');
          a.textContent = (m[9] || '') + ' (' + m[10] + ')';
        }
        parent.appendChild(a);
      } else if (m[11] !== undefined) {
        var b1 = document.createElement('strong'); mdInline(b1, m[11]); parent.appendChild(b1);
      } else if (m[12] !== undefined) {
        var b2 = document.createElement('strong'); mdInline(b2, m[12]); parent.appendChild(b2);
      } else if (m[13] !== undefined) {
        var de = document.createElement('del'); mdInline(de, m[13]); parent.appendChild(de);
      } else if (m[14] !== undefined) {
        var e1 = document.createElement('em'); mdInline(e1, m[14]); parent.appendChild(e1);
      } else if (m[15] !== undefined) {
        var e2 = document.createElement('em'); mdInline(e2, m[15]); parent.appendChild(e2);
      } else if (m[16] !== undefined) {
        parent.appendChild(document.createTextNode(m[16]));
      } else if (m[0] === '\n') {
        parent.appendChild(document.createElement('br'));
      }
    }
    if (last < src.length) parent.appendChild(document.createTextNode(src.slice(last)));
  }
  function mdRow(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (s) { return s.trim(); });
  }
  function mdBlocks(text) {
    var frag = document.createDocumentFragment();
    var lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    var i = 0, para = [];
    function flush() {
      if (!para.length) return;
      var p = document.createElement('p');
      mdInline(p, para.join('\n'));
      frag.appendChild(p);
      para = [];
    }
    while (i < lines.length) {
      var ln = lines[i];
      if (/^\s*$/.test(ln)) { flush(); i++; continue; }
      var fm = ln.match(/^ {0,3}(```+|~~~+)\s*([^\s`]*)\s*$/);
      if (fm) {
        flush();
        var fenceCh = fm[1].charAt(0);
        var lang = fm[2] || '';
        var buf = [];
        i++;
        while (i < lines.length && !(new RegExp('^ {0,3}' + fenceCh + '{3,}\\s*$')).test(lines[i])) {
          buf.push(lines[i]); i++;
        }
        i++;
        var pre = document.createElement('pre');
        var code = document.createElement('code');
        if (lang) code.className = 'lang-' + lang.replace(/[^\w+-]/g, '');
        code.textContent = buf.join('\n');
        pre.appendChild(code);
        frag.appendChild(pre);
        continue;
      }
      var dm = ln.match(/^ {0,3}\$\$\s*(.*)$/);
      if (dm) {
        flush();
        var tex = [];
        var rest = dm[1];
        var end = rest.match(/^(.*?)\$\$\s*$/);
        if (end) { if (end[1].trim()) tex.push(end[1]); i++; }
        else {
          if (rest.trim()) tex.push(rest);
          i++;
          while (i < lines.length) {
            var e2 = lines[i].match(/^(.*?)\$\$\s*$/);
            if (e2) { if (e2[1].trim()) tex.push(e2[1]); i++; break; }
            tex.push(lines[i]); i++;
          }
        }
        var mb = document.createElement('div');
        mb.className = 'rm-math-block';
        mb.appendChild(mdMath(tex.join('\n').trim(), true));
        frag.appendChild(mb);
        continue;
      }
      if (/^ {0,3}\\\[/.test(ln)) {
        flush();
        var tex2 = [];
        var l0 = ln.replace(/^ {0,3}\\\[/, '');
        var e3 = l0.match(/^(.*?)\\\]\s*$/);
        if (e3) { if (e3[1].trim()) tex2.push(e3[1]); i++; }
        else {
          if (l0.trim()) tex2.push(l0);
          i++;
          while (i < lines.length) {
            var e4 = lines[i].match(/^(.*?)\\\]\s*$/);
            if (e4) { if (e4[1].trim()) tex2.push(e4[1]); i++; break; }
            tex2.push(lines[i]); i++;
          }
        }
        var mb2 = document.createElement('div');
        mb2.className = 'rm-math-block';
        mb2.appendChild(mdMath(tex2.join('\n').trim(), true));
        frag.appendChild(mb2);
        continue;
      }
      var hm = ln.match(/^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (hm) {
        flush();
        var h = document.createElement('h' + hm[1].length);
        mdInline(h, hm[2]);
        frag.appendChild(h);
        i++;
        continue;
      }
      if (/^ {0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(ln)) {
        flush();
        frag.appendChild(document.createElement('hr'));
        i++;
        continue;
      }
      if (/^ {0,3}>/.test(ln)) {
        flush();
        var q = [];
        while (i < lines.length && /^ {0,3}>/.test(lines[i])) {
          q.push(lines[i].replace(/^ {0,3}>\s?/, '')); i++;
        }
        var bq = document.createElement('blockquote');
        bq.appendChild(mdBlocks(q.join('\n')));
        frag.appendChild(bq);
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length &&
          /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(lines[i + 1])) {
        flush();
        var head = mdRow(ln);
        i += 2;
        var table = document.createElement('table');
        var thead = document.createElement('thead');
        var trh = document.createElement('tr');
        head.forEach(function (c) {
          var th = document.createElement('th');
          mdInline(th, c);
          trh.appendChild(th);
        });
        thead.appendChild(trh);
        table.appendChild(thead);
        var tbody = document.createElement('tbody');
        while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) {
          var tds = mdRow(lines[i]);
          var tr = document.createElement('tr');
          tds.forEach(function (c) {
            var td = document.createElement('td');
            mdInline(td, c);
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
          i++;
        }
        table.appendChild(tbody);
        frag.appendChild(table);
        continue;
      }
      var lm = ln.match(/^ {0,3}([-*+]|\d+[.)])\s+(.*)$/);
      if (lm) {
        flush();
        var ordered = /\d/.test(lm[1]);
        var list = document.createElement(ordered ? 'ol' : 'ul');
        while (i < lines.length) {
          var m2 = lines[i].match(/^ {0,3}([-*+]|\d+[.)])\s+(.*)$/);
          if (!m2) break;
          var li = document.createElement('li');
          mdInline(li, m2[2]);
          list.appendChild(li);
          i++;
        }
        frag.appendChild(list);
        continue;
      }
      para.push(ln);
      i++;
    }
    flush();
    return frag;
  }

  // ── 样式 ──
  var css = [
    '#__rm{all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;color:#e9e9f2;',
    'font:13px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;',
    '--bg:#1b1e27;--bg2:#222633;--line:rgba(255,255,255,.12);--dim:#8b90a2;--fg:#e9e9f2;--bot:#2a2f3e;',
    '--accent:#3f6fe8;--accent2:#2c53c4;--danger:#e05656}',
    '#__rm *{box-sizing:border-box}',
    '#__rm .rm-win{position:fixed;display:flex;flex-direction:column;min-width:280px;min-height:220px;',
    'background:linear-gradient(180deg,var(--bg2),var(--bg));border:1px solid var(--line);border-radius:14px;',
    'box-shadow:0 24px 70px rgba(0,0,0,.6);overflow:hidden;pointer-events:auto;resize:none}',
    '#__rm .rm-win.full{left:0!important;top:0!important;width:100%!important;height:100%!important;',
    'border-radius:0;border:0;box-shadow:none}',
    '#__rm .rm-head{display:flex;align-items:center;gap:7px;height:44px;padding:0 8px 0 12px;',
    'border-bottom:1px solid var(--line);flex-shrink:0;cursor:move;touch-action:none;user-select:none;',
    '-webkit-user-select:none;background:rgba(255,255,255,.035)}',
    '#__rm .rm-win.full .rm-head{cursor:default}',
    '#__rm .rm-logo{width:24px;height:24px;border-radius:8px;display:flex;align-items:center;justify-content:center;',
    'background:linear-gradient(135deg,#4d7ef8,#2c53c4);font-size:13px;flex-shrink:0}',
    '#__rm .rm-title{font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#__rm .rm-badge{font-size:9px;color:#9dbcff;border:1px solid rgba(120,160,255,.4);border-radius:4px;padding:1px 4px;flex-shrink:0}',
    '#__rm .rm-sp{flex:1;min-width:0}',
    '#__rm .rm-head button{width:32px;height:32px;border:0;border-radius:9px;background:transparent;color:#c9cede;',
    'font:15px/1 inherit;cursor:pointer;flex-shrink:0;padding:0}',
    '#__rm .rm-head button:hover{background:rgba(255,255,255,.1)}',
    '#__rm .rm-head .rm-close{color:#ff9a9a}',
    '#__rm .rm-body{flex:1;min-height:0;overflow:auto;padding:12px;overscroll-behavior:contain;',
    '-webkit-overflow-scrolling:touch;display:flex;flex-direction:column}',
    '#__rm .rm-empty{margin:auto;text-align:center;color:var(--dim);font-size:12px;line-height:1.9;padding:20px}',
    '#__rm .rm-empty .b{font-size:26px;margin-bottom:6px}',
    '#__rm .rm-line{display:flex;flex-direction:column;gap:2px;max-width:90%;margin-bottom:9px;align-self:flex-start}',
    '#__rm .rm-line.me{align-self:flex-end;align-items:flex-end}',
    '#__rm .rm-name{font-size:10px;color:var(--dim);padding:0 3px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#__rm .rm-bubble{padding:8px 11px;border-radius:12px;background:var(--bot);font-size:13px;',
    'white-space:normal;word-break:break-word;overflow-wrap:anywhere;max-width:100%;cursor:default}',
    '#__rm .rm-line.me .rm-bubble{background:linear-gradient(180deg,var(--accent),var(--accent2));color:#fff}',
    '#__rm .rm-bubble img{display:block;max-width:100%;max-height:250px;border-radius:8px;margin-top:5px;cursor:zoom-in}',
    '#__rm .rm-time{font-size:9px;color:var(--dim);padding:0 3px}',
    '#__rm .rm-foot{flex-shrink:0;border-top:1px solid var(--line);padding:6px 9px 7px;background:rgba(0,0,0,.12)}',
    '#__rm .rm-tip{font-size:9.5px;line-height:1.7;color:var(--dim);min-height:16px;display:flex;align-items:center;gap:5px;flex-wrap:wrap}',
    '#__rm .rm-tip button{border:1px solid rgba(120,160,255,.45);border-radius:6px;background:rgba(77,126,248,.14);',
    'color:#a9c3ff;font:9.5px/1 inherit;padding:3px 6px;cursor:pointer}',
    '#__rm .rm-tip .ok{color:#66d19e}',
    '#__rm .rm-tip .warn{color:#f0b46a}',
    // v3.10 拉取失败提示（固定在消息区最底部）
    '#__rm .rm-err{margin-top:8px;padding:8px 10px;border:1px solid rgba(240,120,90,.5);border-radius:9px;',
    'background:rgba(240,90,70,.13);color:#f2a48e;font-size:11.5px;line-height:1.6;display:flex;',
    'align-items:center;gap:8px;flex-wrap:wrap;align-self:center;max-width:96%;flex-shrink:0}',
    '#__rm .rm-err .t{min-width:0;flex:1;word-break:break-word}',
    '#__rm .rm-err button{flex-shrink:0;border:1px solid rgba(240,120,90,.6);border-radius:6px;',
    'background:rgba(240,90,70,.2);color:#ffc3b0;font:10.5px/1 inherit;padding:5px 9px;cursor:pointer}',
    '#__rm .rm-err button:hover{background:rgba(240,90,70,.34)}',
    '#__rm .rm-compose{display:flex;align-items:flex-end;gap:6px;margin-top:4px}',
    '#__rm .rm-ta{flex:1;min-width:0;min-height:36px;max-height:96px;padding:8px 10px;resize:none;border:1px solid var(--line);',
    'border-radius:9px;background:#151821;color:var(--fg);font:13px/1.45 inherit;outline:none}',
    '#__rm .rm-ta:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(77,126,248,.14)}',
    '#__rm .rm-ta:disabled{opacity:.55;cursor:not-allowed}',
    '#__rm .rm-send{height:36px;min-width:58px;padding:0 12px;border:0;border-radius:9px;',
    'background:linear-gradient(180deg,var(--accent),var(--accent2));color:#fff;font:12px/1 inherit;',
    'font-weight:600;cursor:pointer;flex-shrink:0}',
    '#__rm .rm-send:disabled{opacity:.45;cursor:not-allowed}',
    // v3.10 文件卡片 / 语音 / 按钮
    '#__rm .rm-cbtn{height:36px;width:36px;border:1px solid var(--line);border-radius:9px;background:rgba(255,255,255,.05);',
    'color:#c9cede;font:13px/1 inherit;cursor:pointer;flex-shrink:0;padding:0;display:flex;align-items:center;justify-content:center}',
    '#__rm .rm-cbtn:hover{background:rgba(255,255,255,.13)}',
    '#__rm .rm-cbtn.on{background:var(--danger);color:#fff;border-color:var(--danger)}',
    '#__rm .rm-cbtn[hidden]{display:none}',
    '#__rm .rm-file{display:block;margin-top:6px;padding:8px 10px;border:1px dashed rgba(120,160,255,.4);',
    'border-radius:9px;background:rgba(77,126,248,.08);cursor:pointer;max-width:100%}',
    '#__rm .rm-file:hover{border-color:rgba(120,160,255,.75);background:rgba(77,126,248,.16)}',
    '#__rm .rm-file.loading{opacity:.6;pointer-events:none}',
    '#__rm .rm-file-top{display:flex;align-items:center;gap:7px;font-size:12px;color:#a9c3ff}',
    '#__rm .rm-file-ic{font-size:16px;flex-shrink:0}',
    '#__rm .rm-file-lb{min-width:0}',
    '#__rm .rm-file-sub{margin-top:2px;font-size:10px;color:var(--dim)}',
    '#__rm .rm-file video{display:block;max-width:100%;max-height:320px;border-radius:8px;margin-top:7px;background:#000}',
    '#__rm .rm-vrow{display:flex;align-items:center;gap:8px;margin-top:7px;padding:7px 9px;border-radius:9px;',
    'background:rgba(0,0,0,.28);flex-wrap:wrap}',
    '#__rm .rm-vplay{width:30px;height:30px;border:0;border-radius:50%;background:var(--accent);color:#fff;',
    'font:12px/1 inherit;cursor:pointer;flex-shrink:0;padding:0}',
    '#__rm .rm-vplay:hover{background:var(--accent2)}',
    '#__rm .rm-vdur{font:10.5px/1 ui-monospace,monospace;color:var(--dim);flex-shrink:0;min-width:34px}',
    '#__rm .rm-vtt{height:28px;padding:0 10px;border:1px solid rgba(120,160,255,.45);border-radius:7px;',
    'background:rgba(77,126,248,.14);color:#a9c3ff;font:10.5px/1 inherit;cursor:pointer;flex-shrink:0}',
    '#__rm .rm-vtt:hover{background:rgba(77,126,248,.26)}',
    '#__rm .rm-vdl{height:28px;padding:0 9px;border:1px solid rgba(120,160,255,.45);border-radius:7px;',
    'background:rgba(77,126,248,.14);color:#a9c3ff;font:10.5px/1 inherit;cursor:pointer;flex-shrink:0}',
    '#__rm .rm-vdl:hover{background:rgba(77,126,248,.26)}',
    '#__rm .rm-file-err{margin-top:6px;font-size:11px;color:#ff9b9b}',
    '#__rm .rm-file-err.bad{color:#ffb4b4}',
    '#__rm .rm-file-trans{margin-top:7px;padding:7px 9px;border-radius:8px;background:rgba(0,0,0,.28);',
    'font-size:12px;line-height:1.6;color:#d8dcea;white-space:pre-wrap;word-break:break-word}',
    '#__rm .rm-file-trans .none{color:var(--dim)}',
    '#__rm .rm-grip{position:absolute;right:1px;bottom:1px;width:22px;height:22px;z-index:12;cursor:se-resize;',
    'touch-action:none;opacity:.7;border-radius:0 0 12px 0;',
    'background:linear-gradient(135deg,transparent 42%,var(--line) 42%,var(--line) 50%,transparent 50%,transparent 62%,var(--line) 62%,var(--line) 70%,transparent 70%)}',
    '#__rm .rm-win.full .rm-grip{display:none}',
    // Markdown
    '#__rm .rm-md p{margin:0 0 6px}#__rm .rm-md p:last-child{margin-bottom:0}',
    '#__rm .rm-md h1,#__rm .rm-md h2,#__rm .rm-md h3,#__rm .rm-md h4,#__rm .rm-md h5,#__rm .rm-md h6{margin:7px 0 4px;line-height:1.35;font-weight:700}',
    '#__rm .rm-md h1{font-size:17px}#__rm .rm-md h2{font-size:15px}#__rm .rm-md h3{font-size:14px}',
    '#__rm .rm-md ul,#__rm .rm-md ol{margin:2px 0 6px;padding-left:20px}',
    '#__rm .rm-md li{margin:1px 0}',
    '#__rm .rm-md code{padding:1px 4px;border-radius:4px;background:rgba(255,255,255,.12);font:11.5px/1.4 ui-monospace,monospace}',
    '#__rm .rm-md pre{margin:5px 0;padding:8px 9px;border-radius:8px;background:rgba(0,0,0,.32);overflow:auto;max-width:100%}',
    '#__rm .rm-md pre code{padding:0;background:transparent;font-size:11px;white-space:pre}',
    '#__rm .rm-md blockquote{margin:3px 0;padding:2px 0 2px 9px;border-left:3px solid rgba(120,160,255,.55);color:#c3c8d8}',
    '#__rm .rm-md hr{border:0;border-top:1px solid var(--line);margin:8px 0}',
    '#__rm .rm-md table{border-collapse:collapse;margin:5px 0;max-width:100%;display:block;overflow-x:auto}',
    '#__rm .rm-md th,#__rm .rm-md td{border:1px solid var(--line);padding:3px 7px;font-size:11.5px;text-align:left}',
    '#__rm .rm-md th{background:rgba(255,255,255,.07)}',
    '#__rm .rm-md a{color:#9dbcff;text-decoration:underline}',
    '#__rm .rm-md del{opacity:.7}',
    '#__rm .rm-math-block{overflow-x:auto;overflow-y:hidden;margin:5px 0;max-width:100%}',
    // 图片查看
    '#__rm .rm-zoom{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.95);display:none;',
    'flex-direction:column;touch-action:none;overscroll-behavior:contain;pointer-events:auto}',
    '#__rm .rm-zoom.on{display:flex}',
    '#__rm .rm-zoom .zbar{display:flex;align-items:center;gap:6px;padding:8px 10px;flex-shrink:0;background:rgba(0,0,0,.6)}',
    '#__rm .rm-zoom .ztit{flex:1;min-width:0;font-size:12px;color:rgba(255,255,255,.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#__rm .rm-zoom .zpct{font:12px/1 ui-monospace,monospace;color:#9dbcff;min-width:42px;text-align:center}',
    '#__rm .rm-zoom button{height:32px;min-width:34px;padding:0 9px;border:1px solid rgba(255,255,255,.22);border-radius:8px;',
    'background:rgba(255,255,255,.1);color:#fff;font:12px/1 inherit;cursor:pointer}',
    '#__rm .rm-zoom .zstage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:grab}',
    '#__rm .rm-zoom .zstage.drag{cursor:grabbing}',
    '#__rm .rm-zoom .zstage img{max-width:100%;max-height:100%;transform-origin:center center;will-change:transform;',
    'user-select:none;-webkit-user-select:none;-webkit-user-drag:none;pointer-events:none}',
    '#__rm .rm-zoom .zhint{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-size:10px;color:rgba(255,255,255,.45)}',
    '@media (max-width:560px){#__rm .rm-line{max-width:94%}#__rm .rm-body{padding:9px}',
    '#__rm .rm-head{padding-left:9px}#__rm .rm-title{font-size:12.5px}#__rm .rm-grip{display:none}}'
  ].join('');
  var st = document.createElement('style');
  st.id = '__rmcs';
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  // ── DOM ──
  var root = document.createElement('div');
  root.id = '__rm';
  root.style.display = 'none';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', '聊天室（共享）');

  var win = document.createElement('div');
  win.className = 'rm-win';

  var head = document.createElement('div');
  head.className = 'rm-head';
  var logo = document.createElement('div');
  logo.className = 'rm-logo';
  logo.textContent = '💬';
  var title = document.createElement('div');
  title.className = 'rm-title';
  title.textContent = '聊天室（共享）';
  var badge = document.createElement('span');
  badge.className = 'rm-badge';
  badge.textContent = 'v3.11';
  var sp = document.createElement('div');
  sp.className = 'rm-sp';
  var refreshBtn = document.createElement('button');
  refreshBtn.textContent = '⟳';
  refreshBtn.title = '刷新';
  var fullBtn = document.createElement('button');
  fullBtn.textContent = '⛶';
  fullBtn.title = '全屏';
  var closeBtn = document.createElement('button');
  closeBtn.className = 'rm-close';
  closeBtn.textContent = '✕';
  closeBtn.title = '关闭';
  head.append(logo, title, badge, sp, refreshBtn, fullBtn, closeBtn);

  var body = document.createElement('div');
  body.className = 'rm-body';

  var foot = document.createElement('div');
  foot.className = 'rm-foot';
  var tip = document.createElement('div');
  tip.className = 'rm-tip';
  var compose = document.createElement('div');
  compose.className = 'rm-compose';
  var ta = document.createElement('textarea');
  ta.className = 'rm-ta';
  ta.rows = 1;
  ta.maxLength = 8000;
  ta.placeholder = '说点什么…（Enter 发送 / Shift+Enter 换行）';
  var sendBtn = document.createElement('button');
  sendBtn.className = 'rm-send';
  sendBtn.textContent = '发送';
  // v3.10：📎 文件 / 🎙️ 录音 / 🎤 语音输入
  var fileBtn = document.createElement('button');
  fileBtn.className = 'rm-cbtn';
  fileBtn.textContent = '📎';
  fileBtn.title = '发图片 / 视频';
  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,video/*';
  fileInput.multiple = true;
  fileInput.style.display = 'none';
  var recBtn = document.createElement('button');
  recBtn.className = 'rm-cbtn';
  recBtn.textContent = '🎙️';
  recBtn.title = '录语音消息（点开始 / 再点停止）';
  var micBtn = document.createElement('button');
  micBtn.className = 'rm-cbtn';
  micBtn.textContent = '🎤';
  micBtn.title = '语音输入（识别转文字，点击开始 / 再点停止）';
  if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) micBtn.title = '当前浏览器不支持语音识别（点击可查看原因）';
  compose.append(micBtn, fileBtn, recBtn, ta, sendBtn);
  foot.append(tip, compose, fileInput);

  var grip = document.createElement('div');
  grip.className = 'rm-grip';
  grip.title = '拖动调整大小';
  win.append(head, body, foot, grip);
  root.append(win);
  document.body.append(root);

  // ── 窗口位置 / 大小 / 全屏 ──
  var rect = null;
  var full = false;
  var MINW = 280, MINH = 220;

  function viewport() { return { w: window.innerWidth, h: window.innerHeight }; }
  function defaultRect() {
    var v = viewport();
    var w = Math.min(640, Math.max(MINW, v.w - 24));
    var h = Math.min(680, Math.max(MINH, v.h - 40));
    if (v.w <= 560) return { left: 4, top: 4, width: v.w - 8, height: v.h - 8 };
    return { left: Math.round((v.w - w) / 2), top: Math.round((v.h - h) / 2), width: w, height: h };
  }
  function clampRect(r) {
    var v = viewport();
    r.width = Math.max(MINW, Math.min(Number(r.width) || 480, v.w - 8));
    r.height = Math.max(MINH, Math.min(Number(r.height) || 560, v.h - 8));
    r.left = Math.max(4, Math.min(Number(r.left) || 0, v.w - r.width - 4));
    r.top = Math.max(4, Math.min(Number(r.top) || 0, v.h - r.height - 4));
    return r;
  }
  function readRect() {
    try {
      var j = JSON.parse(read(K_RECT, '{}'));
      if (j && typeof j === 'object' && Number(j.width) > 0 && Number(j.height) > 0) return clampRect(j);
    } catch (e) {}
    return defaultRect();
  }
  function applyRect(r) {
    if (full) return;
    rect = clampRect(r);
    win.style.left = rect.left + 'px';
    win.style.top = rect.top + 'px';
    win.style.width = rect.width + 'px';
    win.style.height = rect.height + 'px';
  }
  function saveRect() {
    if (!rect || full) return;
    try { save(K_RECT, JSON.stringify(rect)); } catch (e) {}
  }
  function setFull(on) {
    full = !!on;
    win.classList.toggle('full', full);
    fullBtn.textContent = full ? '⤡' : '⛶';
    fullBtn.title = full ? '退出全屏（Esc）' : '全屏';
    if (!full) applyRect(rect || readRect());
    else saveRect();
    setTimeout(function () { try { ta.focus(); } catch (e) {} }, 60);
  }
  rect = readRect();
  applyRect(rect);

  function dragHead(e) {
    if (full || e.button > 0) return;
    if (e.target && e.target.closest && e.target.closest('button')) return;
    e.preventDefault();
    var sx = e.clientX, sy = e.clientY;
    var l = rect.left, t = rect.top;
    try { head.setPointerCapture(e.pointerId); } catch (err) {}
    function mv(ev) {
      applyRect({ left: l + ev.clientX - sx, top: t + ev.clientY - sy, width: rect.width, height: rect.height });
    }
    function up() {
      try { head.releasePointerCapture(e.pointerId); } catch (err) {}
      head.removeEventListener('pointermove', mv);
      head.removeEventListener('pointerup', up);
      head.removeEventListener('pointercancel', up);
      saveRect();
    }
    head.addEventListener('pointermove', mv);
    head.addEventListener('pointerup', up);
    head.addEventListener('pointercancel', up);
  }
  head.addEventListener('pointerdown', dragHead);
  title.addEventListener('dblclick', function () {
    if (full) return;
    applyRect(defaultRect());
    saveRect();
  });

  function dragGrip(e) {
    if (full || e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    var sx = e.clientX, sy = e.clientY;
    var w = rect.width, h = rect.height;
    function mv(ev) {
      applyRect({ left: rect.left, top: rect.top, width: w + ev.clientX - sx, height: h + ev.clientY - sy });
    }
    function up() {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      saveRect();
    }
    // 用 window 监听而不是 pointer capture：鼠标移出 22px 的把手后仍能继续缩放
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
  grip.addEventListener('pointerdown', dragGrip);

  window.addEventListener('resize', function () {
    if (full) return;
    applyRect(rect || defaultRect());
  });

  // ── 图片查看 ──
  var zoom = document.createElement('div');
  zoom.className = 'rm-zoom';
  var zbar = document.createElement('div');
  zbar.className = 'zbar';
  var ztit = document.createElement('div');
  ztit.className = 'ztit';
  var zpct = document.createElement('div');
  zpct.className = 'zpct';
  zpct.textContent = '100%';
  var zin = document.createElement('button');
  zin.textContent = '＋';
  var zout = document.createElement('button');
  zout.textContent = '－';
  var zreset = document.createElement('button');
  zreset.textContent = '1:1';
  var zclose = document.createElement('button');
  zclose.textContent = '✕';
  zbar.append(ztit, zpct, zout, zreset, zin, zclose);
  var zstage = document.createElement('div');
  zstage.className = 'zstage';
  var zimg = document.createElement('img');
  zimg.alt = '图片';
  var zhint = document.createElement('div');
  zhint.className = 'zhint';
  zhint.textContent = '滚轮缩放 · 拖动平移 · 双击复位 · Esc 关闭';
  zstage.append(zimg);
  zoom.append(zbar, zstage, zhint);
  win.append(zoom);

  var zScale = 1, zx = 0, zy = 0, zDrag = null;
  function zapply() {
    zimg.style.transform = 'translate(' + zx + 'px,' + zy + 'px) scale(' + zScale + ')';
    zpct.textContent = Math.round(zScale * 100) + '%';
  }
  function zopen(src, name) {
    ztit.textContent = name || '图片';
    if (zimg.dataset.src !== src) {
      zimg.dataset.src = src;
      zimg.src = src;
    }
    zScale = 1; zx = 0; zy = 0; zapply();
    zoom.classList.add('on');
  }
  function zhide() { zoom.classList.remove('on'); }
  function zset(s) { zScale = Math.max(0.2, Math.min(6, s)); zapply(); }
  zin.onclick = function () { zset(zScale * 1.25); };
  zout.onclick = function () { zset(zScale / 1.25); };
  zreset.onclick = function () { zScale = 1; zx = 0; zy = 0; zapply(); };
  zclose.onclick = zhide;
  zstage.addEventListener('wheel', function (e) {
    e.preventDefault();
    zset(zScale * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
  }, { passive: false });
  zstage.addEventListener('dblclick', function () { zScale = 1; zx = 0; zy = 0; zapply(); });
  zstage.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    zDrag = { x: e.clientX, y: e.clientY, zx: zx, zy: zy };
    zstage.classList.add('drag');
    try { zstage.setPointerCapture(e.pointerId); } catch (err) {}
  });
  zstage.addEventListener('pointermove', function (e) {
    if (!zDrag) return;
    zx = zDrag.zx + e.clientX - zDrag.x;
    zy = zDrag.zy + e.clientY - zDrag.y;
    zapply();
  });
  function zEnd() { zDrag = null; zstage.classList.remove('drag'); }
  zstage.addEventListener('pointerup', zEnd);
  zstage.addEventListener('pointercancel', zEnd);

  // ── 图片鉴权加载（私有仓库 raw 需要 PRIVATE-TOKEN）──
  var imgCache = {};
  function loadImg(path, imgEl) {
    if (imgCache[path]) { imgEl.src = imgCache[path]; return; }
    fetch(fileUrl(path, true), { headers: { 'PRIVATE-TOKEN': token() }, cache: 'force-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      .then(function (b) {
        var u = URL.createObjectURL(b);
        imgCache[path] = u;
        imgEl.src = u;
      })
      .catch(function () {
        imgEl.alt = '图片加载失败';
        imgEl.style.minWidth = '120px';
        imgEl.style.minHeight = '54px';
        imgEl.style.background = 'rgba(0,0,0,.25)';
      });
  }
  var io = null;
  function hydrateImages() {
    var list = body.querySelectorAll('img[data-path]');
    if (!list.length) return;
    if (!('IntersectionObserver' in window)) {
      [].forEach.call(list, function (im) { loadImg(im.dataset.path, im); });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var im = en.target;
          io.unobserve(im);
          loadImg(im.dataset.path, im);
        });
      }, { root: body, rootMargin: '160px' });
    }
    [].forEach.call(list, function (im) {
      if (im.src) return;
      io.observe(im);
    });
  }

  // ── v3.10 文件卡片：图片/视频/语音 不自动下载，点击才拉取 ── v3.11：下载修复 + 卡片内报错重试 + ⏬ 下载
  var mediaBlobs = {};   // v3.11：path → Blob，同一条点第二次不再重复下载
  function downloadBlob(blob, name) {
    if (!blob) return;
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name || 'file';
    a.style.display = 'none';
    document.body.appendChild(a);
    try { a.click(); } catch (e) {}
    setTimeout(function () { try { a.remove(); } catch (e) {} try { URL.revokeObjectURL(url); } catch (e) {} }, 8000);
  }
  function fileNote(card, s, cls) {
    var n = card.querySelector('.rm-file-err');
    if (!n) { n = document.createElement('div'); n.className = 'rm-file-err'; card.appendChild(n); }
    n.className = 'rm-file-err' + (cls ? ' ' + cls : '');
    n.textContent = s || '';
    n.style.display = s ? '' : 'none';
  }
  function mediaCard(m) {
    var kind = m.kind || mediaType(mediaExt(m.file), m.mime);
    var card = document.createElement('div');
    card.className = 'rm-file';
    card.title = '点击下载查看';
    var top = document.createElement('div');
    top.className = 'rm-file-top';
    var ic = document.createElement('span');
    ic.className = 'rm-file-ic';
    ic.textContent = kind === 'image' ? '🖼️' : kind === 'video' ? '🎞️' : kind === 'voice' ? '🎙️' : '📎';
    var lb = document.createElement('span');
    lb.className = 'rm-file-lb';
    lb.textContent = '该文件为' + kindLabel(kind) + '，点击可下载查看';
    top.append(ic, lb);
    card.appendChild(top);
    var sub = document.createElement('div');
    sub.className = 'rm-file-sub';
    var nm = mediaName(m);
    var durTxt = m.dur ? fmtDur(m.dur) : '';
    sub.textContent = nm + (durTxt && nm.indexOf(durTxt) < 0 ? ' · ' + durTxt : '') + ' · ' + fmtSize(m.size);
    card.appendChild(sub);
    card.__m = m;
    var state = { loaded: false, url: null, blob: null };
    card.addEventListener('click', function () {
      if (state.loaded) {
        previewMedia(m, state.url);
        return;
      }
      loadMedia(m, card, function (b) {
        state.blob = b;
        state.url = URL.createObjectURL(b);
        state.loaded = true;
        if (kind === 'voice') showVoice(m, state, card);
        else if (kind === 'image' || kind === 'video') previewMedia(m, state.url);
        else downloadBlob(b, dlName(m));
      });
    });
    return card;
  }
  function loadMedia(m, card, cb) {
    if (mediaBlobs[m.file]) { fileNote(card, ''); cb(mediaBlobs[m.file]); return; }
    card.classList.add('loading');
    fileNote(card, '');
    gitGetBlob(m.file).then(function (b) {
      card.classList.remove('loading');
      if (!b || !b.size) {
        fileNote(card, '下载失败，点击重试', 'bad');
        tipText('文件下载失败', 'warn');
        return;
      }
      mediaBlobs[m.file] = b;
      cb(b);
    });
  }
  function fmtDur(s) { s = Number(s) || 0; return Math.floor(s / 60) + ':' + pad2(Math.floor(s % 60)); }
  function fmtSize(n) {
    n = Number(n) || 0;
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
    return n + ' B';
  }
  function previewMedia(m, url) {
    var kind = m.kind || mediaType(mediaExt(m.file), m.mime);
    if (kind === 'image') { zopen(url, mediaName(m)); return; }
    if (kind === 'video') { openVideo(url, mediaName(m)); return; }
    if (kind === 'voice') { playVoice(m, url); return; }
    // 其他文件 → 下载
    var a = document.createElement('a');
    a.href = url;
    a.download = mediaName(m);
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { try { a.remove(); } catch (e) {} }, 100);
  }
  // 视频播放层（点击播放，不自动播放）
  var vplay = null;
  function openVideo(url, name) {
    if (!vplay) {
      vplay = document.createElement('div');
      vplay.className = 'rm-zoom';
      var bar = document.createElement('div');
      bar.className = 'zbar';
      var tit = document.createElement('div');
      tit.className = 'ztit';
      var dlv = document.createElement('button');
      dlv.textContent = '⏬';
      dlv.title = '下载视频';
      dlv.onclick = function () {
        var u = vplay.__url || '';
        if (!u) return;
        var a = document.createElement('a');
        a.href = u;
        a.download = vplay.__dname || 'video.mp4';
        a.style.display = 'none';
        document.body.appendChild(a);
        try { a.click(); } catch (e) {}
        setTimeout(function () { try { a.remove(); } catch (e) {} }, 8000);
      };
      var cl = document.createElement('button');
      cl.textContent = '✕';
      cl.onclick = closeVideo;
      bar.append(tit, dlv, cl);
      var vd = document.createElement('video');
      vd.controls = true;
      vd.playsInline = true;
      vd.preload = 'metadata';
      vd.style.maxWidth = '100%';
      vd.style.maxHeight = '100%';
      vd.style.outline = 'none';
      var stage = document.createElement('div');
      stage.className = 'zstage';
      stage.style.cursor = 'default';
      stage.append(vd);
      vplay.append(bar, stage);
      win.append(vplay);
    }
    var v = vplay.querySelector('video');
    v.src = url;
    vplay.__url = url;
    vplay.__dname = name || 'video.mp4';
    vplay.querySelector('.ztit').textContent = name || '视频';
    vplay.classList.add('on');
    v.onended = null;
    // 不自动播放；等用户点播放
  }
  function closeVideo() { if (vplay) { vplay.classList.remove('on'); var v = vplay.querySelector('video'); if (v) { v.pause(); v.removeAttribute('src'); v.load(); } } }
  // 语音：下载后出现播放条 + ▶ 点击播放 + 转文字
  function showVoice(m, state, card) {
    var prev = card.querySelector('.rm-vrow');
    if (prev) prev.remove();
    var row = document.createElement('div');
    row.className = 'rm-vrow';
    var play = document.createElement('button');
    play.className = 'rm-vplay';
    play.textContent = '▶';
    var dur = document.createElement('span');
    dur.className = 'rm-vdur';
    dur.textContent = m.dur ? fmtDur(m.dur) : '0:00';
    var tt = document.createElement('button');
    tt.className = 'rm-vtt';
    tt.textContent = '转文字';
    tt.onclick = function (e) {
      e.stopPropagation();
      showTranscript(m, card);
    };
    var dl = document.createElement('button');
    dl.className = 'rm-vdl';
    dl.textContent = '⏬ 下载';
    dl.title = '下载到本机';
    dl.onclick = function (e) {
      e.stopPropagation();
      downloadBlob(state.blob || mediaBlobs[m.file], dlName(m));
    };
    row.append(play, dur, dl, tt);
    card.appendChild(row);
    var aud = document.createElement('audio');
    aud.src = state.url;
    aud.preload = 'metadata';
    aud.onloadedmetadata = function () {
      if (!m.dur && !isNaN(aud.duration)) dur.textContent = fmtDur(aud.duration);
    };
    var playing = false;
    play.onclick = function (e) {
      e.stopPropagation();
      if (playing) { aud.pause(); play.textContent = '▶'; playing = false; return; }
      aud.play().then(function () { playing = true; play.textContent = '⏸'; })
        .catch(function () { tipText('播放失败', 'warn'); });
    };
    aud.onended = function () { playing = false; play.textContent = '▶'; };
    aud.onpause = function () { playing = false; play.textContent = '▶'; };
    aud.onerror = function () { tipText('语音播放失败', 'warn'); };
  }
  function playVoice(m, url) {
    // 已下载过的语音：直接播放
    var card = null;
    var lines = body.querySelectorAll('.rm-file');
    [].forEach.call(lines, function (c) {
      if (c.__m && c.__m.p === m.p) card = c;
    });
    if (card) {
      var row = card.querySelector('.rm-vrow');
      if (!row) showVoice(m, { url: url, loaded: true }, card);
      else {
        var p = row.querySelector('.rm-vplay');
        var aud = card.querySelector('audio');
        if (p && aud) { aud.play(); p.textContent = '⏸'; }
      }
    }
  }
  function showTranscript(m, card) {
    if (card.__tr) { card.__tr.remove(); card.__tr = null; return; }
    var div = document.createElement('div');
    div.className = 'rm-file-trans';
    var txt = m.transcript == null ? '' : String(m.transcript);
    if (txt) {
      div.textContent = '📝 ' + txt;
    } else {
      // v3.11：不再假装「转文字中…」（旧版这里永远不动，看起来像没反应）
      var n = document.createElement('span');
      n.className = 'none';
      n.textContent = '该语音发送时未识别到文字（发送端语音识别不可用）';
      div.appendChild(n);
    }
    card.appendChild(div);
    card.__tr = div;
  }

  // ── 渲染 ──
  function bubbleFor(m) {
    var line = document.createElement('div');
    line.className = 'rm-line' + (m.owner && m.owner === ownerTag() ? ' me' : '');
    var nm = document.createElement('div');
    nm.className = 'rm-name';
    nm.textContent = m.nick || '匿名';
    var bub = document.createElement('div');
    bub.className = 'rm-bubble';
    if (m.text) {
      var md = document.createElement('div');
      md.className = 'rm-md';
      md.appendChild(mdBlocks(m.text));
      bub.appendChild(md);
      typesetMath(bub);
    }
    if (m.image) {
      var im = document.createElement('img');
      im.dataset.path = m.image;
      im.alt = '聊天图片';
      im.onclick = function () {
        var src = imgCache[m.image];
        if (src) zopen(src, '聊天图片');
        else {
          loadImg(m.image, im);
          setTimeout(function () { if (imgCache[m.image]) zopen(imgCache[m.image], '聊天图片'); }, 800);
        }
      };
      bub.appendChild(im);
    }
    // v3.10 文件消息：图片/视频/语音，不自动下载，点击后才下载/预览
    if (m.file) {
      bub.appendChild(mediaCard(m));
    }
    var tm = document.createElement('div');
    tm.className = 'rm-time';
    tm.textContent = fmtTime(m.at);
    line.append(nm, bub, tm);
    return line;
  }
  function render(forceBottom) {
    var atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 70;
    body.textContent = '';
    if (!msgs.length) {
      var e = document.createElement('div');
      e.className = 'rm-empty';
      var b = document.createElement('div');
      b.className = 'b';
      b.textContent = '💬';
      e.appendChild(b);
      e.appendChild(document.createTextNode(token() ? '还没有消息（每次只同步最近 24 小时的新消息），来发第一条吧' : '配置 GitLab Token 后就能看到大家的消息'));
      body.appendChild(e);
    } else {
      msgs.forEach(function (m) { body.appendChild(bubbleFor(m)); });
    }
    // v3.10：拉取失败时在最底部固定一条错误信息
    if (loadErr) {
      var eb = document.createElement('div');
      eb.className = 'rm-err';
      var et = document.createElement('span');
      et.className = 't';
      et.textContent = '⚠ ' + loadErr;
      var rb = document.createElement('button');
      rb.textContent = '重试';
      rb.onclick = function (ev) { ev.stopPropagation(); loadRoom(true); };
      eb.append(et, rb);
      body.appendChild(eb);
    }
    if (forceBottom || atBottom) body.scrollTop = body.scrollHeight;
    hydrateImages();
  }

  // ── 登录 / Token 提示 ──
  function tipClear() { tip.textContent = ''; }
  function tipText(s, cls) {
    var sp2 = document.createElement('span');
    if (cls) sp2.className = cls;
    sp2.textContent = s;
    tip.appendChild(sp2);
  }
  function tipBtn(txt, fn) {
    var b = document.createElement('button');
    b.textContent = txt;
    b.onclick = function (e) { e.preventDefault(); fn(); };
    tip.appendChild(b);
  }
  function updateAuth(forceLoad) {
    var r = acct();
    var t = token();
    tipClear();
    if (!r) {
      tipText('未登录：', 'warn');
      tipBtn('登录 / 注册', function () {
        if (window.__fhAcct && window.__fhAcct.open) {
          window.__fhAcct.open(function () {
            updateAuth(true);
          });
        } else alert('账号模块不可用，请先打开主面板');
      });
      tipText('登录后发言');
      ta.disabled = true;
      sendBtn.disabled = true;
      ta.placeholder = '先登录账号，再发言…';
    } else if (!t) {
      tipText('已登录 ' + r.user + '，但没配置 GitLab Token', 'warn');
      tipBtn('填 Token', function () {
        var v = prompt('GitLab Token（需要 read_api + write_repository 权限）');
        if (v == null) return;
        v = String(v).trim();
        if (!v) return;
        try {
          if (window.__fhAcct && window.__fhAcct.saveGit) window.__fhAcct.saveGit(v);
          save(K_GIT, v);
        } catch (e) { save(K_GIT, v); }
        updateAuth(true);
        loadRoom(true);
      });
      ta.disabled = false;
      ta.placeholder = '填好 GitLab Token 后就能发送…';
      sendBtn.disabled = true;
    } else {
      tipText('已登录 ');
      tipText(r.user, 'ok');
      tipText(' · 消息写入 GitLab message/ · 30 秒自动刷新 · 只同步最近 24 小时的新消息，本地历史全保留');
      ta.disabled = false;
      ta.placeholder = '以 ' + r.user + ' 的身份发言…（Enter 发送）';
      sendBtn.disabled = false;
    }
    if (busySend) sendBtn.disabled = true;
    if (forceLoad && t) loadRoom(true);
  }

  // ── 加载 / 轮询 ──
  var loading = false;
  var lastLoadAt = 0;
  var pollTimer = null;
  var loadErr = '';   // v3.10：同步失败时固定在消息区底部显示
  function loadRoom(manual) {
    if (!token()) { updateAuth(); return; }
    if (loading) return;
    loading = true;
    if (manual) { refreshBtn.textContent = '…'; refreshBtn.disabled = true; }
    tipClear();
    tipText('正在同步消息…');
    var cutoff = Date.now() - WINDOW_MS;
    gitTree(ROOM_DIR, cutoff).then(function (r) {
      if (!r.ok) {
        if (r.status === 404) return { list: [], failed: 0 };
        throw new Error('HTTP ' + r.status);
      }
      var known = {};
      msgs.forEach(function (m) { known[m.p] = 1; });
      // v3.11：本地已有的消息一律不再 GET；只拉「本地没有 + 时间在最近 24h 内」的新消息（解析不出时间的保留）
      var fresh = r.items.filter(function (p) {
        if (known[p]) return false;
        var t = pathTime(p);
        return t ? t >= cutoff : true;
      });
      fresh = fresh.filter(function (p, i) { return fresh.indexOf(p) === i; });
      fresh.sort(function (a, b) { return (pathTime(a) || 0) - (pathTime(b) || 0); });
      if (!fresh.length) return { list: [], failed: 0 };
      tipClear();
      tipText('正在同步 ' + fresh.length + ' 条新消息…');
      return fetchPaths(fresh, function (done2, total) {
        tipClear();
        tipText('正在同步新消息 ' + done2 + '/' + total + '…');
      });
    }).then(function (res) {
      merge(res.list);
      saveCache();
      loadErr = '';
      if (res.failed) loadErr = '有 ' + res.failed + ' 条消息拉取失败（网络或读取权限问题），可点刷新重试';
      render();
      lastLoadAt = Date.now();
      refreshBtn.textContent = '⟳';
      refreshBtn.disabled = false;
      loading = false;
      updateAuth();
      if (!msgs.length) {
        tipClear();
        tipText('暂无消息；发一条试试');
      }
    }).catch(function (e) {
      loading = false;
      refreshBtn.textContent = '⟳';
      refreshBtn.disabled = false;
      tipClear();
      loadErr = '同步失败：' + (e && e.message ? e.message : e) + '（检查网络 / Token 读权限）';
      tipText('同步失败', 'warn');
      render(true);
    });
  }
  function startPoll() {
    stopPoll();
    pollTimer = setInterval(function () {
      if (root.style.display === 'none') return;
      if (document.hidden) return;
      if (Date.now() - lastLoadAt < POLL - 1000 && lastLoadAt) return;
      loadRoom(false);
    }, POLL);
  }
  function stopPoll() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && root.style.display !== 'none' && token() && Date.now() - lastLoadAt > 15000) {
      loadRoom(false);
    }
  });

  // ── 发送 ──
  var busySend = false;
  function send() {
    if (busySend) return;
    var text = ta.value.trim();
    if (!text && !pendingFiles.length) { ta.focus(); return; }
    if (!canSend()) {
      updateAuth();
      tipClear();
      tipText('登录并配置 GitLab Token 后才能发言', 'warn');
      return;
    }
    busySend = true;
    sendBtn.disabled = true;
    sendBtn.textContent = '…';
    var r = acct();
    var fin = function (msg) {
      var path = ROOM_DIR + '/' + stamp() + '-' + rand4() + '.json';
      gitPut(path, JSON.stringify(msg)).then(function (res) {
        if (!res.ok && res.status === 400 && /already exists/i.test(res.text || '')) {
          path = ROOM_DIR + '/' + stamp() + '-' + rand4() + '.json';
          return gitPut(path, JSON.stringify(msg));
        }
        return res;
      }).then(function (res) {
        busySend = false;
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
        if (!res.ok) {
          var why = res.status === 401 || res.status === 403 ? 'Token 没有写权限' : ('HTTP ' + res.status);
          tipClear();
          tipText('发送失败：' + why + '（消息没发出去）', 'warn');
          updateAuth();
          return;
        }
        ta.value = '';
        ta.style.height = 'auto';
        var full = {};
        for (var k in msg) full[k] = msg[k];
        full.p = path;
        merge([full]);
        saveCache();
        render(true);
        updateAuth();
      });
    };
    if (pendingFiles.length) {
      var files = pendingFiles;
      pendingFiles = [];
      tipClear();
      tipText('正在上传 ' + files.length + ' 个文件…');
      uploadFiles(files, function (errs, ups) {
        if (errs && errs.length) {
          errs.forEach(function (x) { tipText('上传失败：' + x.err, 'warn'); });
          busySend = false;
          sendBtn.disabled = false;
          sendBtn.textContent = '发送';
          return;
        }
        var msg = {
          at: Date.now(), nick: r.user, owner: ownerTag(), text: text, image: '',
          file: ups[0].file, kind: ups[0].kind, name: ups[0].name, size: ups[0].size, mime: ups[0].mime
        };
        tipClear();
        tipText('文件已上传，正在发送消息…');
        fin(msg);
      });
      return;
    }
    var msg = {
      at: Date.now(), nick: r.user, owner: ownerTag(), text: text, image: ''
    };
    fin(msg);
  }

  // ── v3.10 文件 / 语音 / 语音输入 ──
  var pendingFiles = [];
  fileBtn.onclick = function () { if (canSend()) fileInput.click(); else { updateAuth(); tipClear(); tipText('登录并配置 Token 后才能发文件', 'warn'); } };
  fileInput.onchange = function () {
    var files = fileInput.files ? [].slice.call(fileInput.files) : [];
    fileInput.value = '';
    if (!files.length) return;
    pendingFiles = files.slice(0, 9);
    tipClear();
    tipText('已选 ' + pendingFiles.length + ' 个文件，点击"发送"上传', 'ok');
  };

  function fmtMediaSize(n) {
    n = Number(n) || 0;
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
    return n + ' B';
  }
  function compressImageFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        var max = 2048;
        var w = im.naturalWidth, h = im.naturalHeight;
        var sc = 1;
        if (w > max || h > max) sc = Math.min(max / w, max / h);
        var cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
        var cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(im, 0, 0, cw, ch);
        try { URL.revokeObjectURL(url); } catch (e) {}
        cv.toBlob(function (b) { resolve(b || file); }, 'image/jpeg', 0.85);
      };
      im.onerror = function () { try { URL.revokeObjectURL(url); } catch (e) {} reject(new Error('图片解码失败')); };
      im.src = url;
    });
  }
  function uploadFiles(list, done) {
    var i = 0, out = [];
    function next() {
      if (i >= list.length) { done(null, out); return; }
      var f = list[i++];
      var isImg = /^image\//.test(String(f.type || ''));
      var prep = isImg ? compressImageFile(f) : Promise.resolve(f);
      prep.then(function (b) {
        if (!isImg && b.size > 25 * 1048576) { out.push({ err: '视频超过 25MB 上限：' + f.name }); next(); return; }
        uploadBlob(b, f.name || ('file' + mediaExt(b.type)), function (e, path) {
          if (e) { out.push({ err: f.name + '：' + e }); next(); return; }
          out.push({ file: path, name: f.name || path.split('/').pop(), size: b.size, mime: b.type, kind: isImg ? 'image' : 'video' });
          next();
        });
      }).catch(function (e) { out.push({ err: f.name + '：' + (e && e.message ? e.message : e) }); next(); });
    }
    next();
  }

  // 语音录音：MediaRecorder → webm → 上传；v3.11：录音的同时并行跑 SpeechRecognition 生成文字
  var recState = null;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  // v3.11 核心修复：以前是「停止录音之后」才启动识别，那时麦克风已经没声音了，transcript 恒为空。
  // 现在录音开始就并行识别，边录边累积 final 结果。
  function startRecSR() {
    if (!SR) return null;
    var box = { txt: '', sr: null, stop: false, dead: false, n: 0 };
    function spawn() {
      if (box.stop || box.dead || box.n >= 30) return;
      var r;
      try { r = new SR(); } catch (e) { box.dead = true; return; }
      box.n++;
      r.lang = 'zh-CN';
      r.interimResults = false;
      r.continuous = true;
      r.onresult = function (e) {
        var start = typeof e.resultIndex === 'number' ? e.resultIndex : 0;
        for (var i = start; i < e.results.length; i++) {
          if (e.results[i].isFinal) box.txt += e.results[i][0].transcript;
        }
      };
      r.onerror = function (e) {
        var er = e && e.error;
        if (er === 'not-allowed' || er === 'service-not-allowed' || er === 'audio-capture') box.dead = true;
      };
      r.onend = function () {
        if (box.stop || box.dead) return;
        // Chrome 静音约 60 秒会自动断开，录音中自动续上
        setTimeout(function () { if (!box.stop && !box.dead) spawn(); }, 120);
      };
      box.sr = r;
      try { r.start(); } catch (e) { box.dead = true; }
    }
    spawn();
    return box;
  }
  function stopRecSR(box) {
    if (!box) return;
    box.stop = true;
    try { if (box.sr) box.sr.abort(); } catch (e) {}
  }
  function recToggle() {
    if (!canSend()) { updateAuth(); tipClear(); tipText('登录并配置 Token 后才能录音', 'warn'); return; }
    if (recState) { stopRec(); return; }
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      tipClear(); tipText('当前浏览器不支持录音', 'warn'); return;
    }
    tipClear();
    tipText('录音中…（再点 🎙️ 停止并发送）', 'warn');
    recBtn.classList.add('on');
    recBtn.textContent = '⏺';
    var chunks = [];
    var mr = null;
    var stream = null;
    var stopped = false;
    var rec = { start: Date.now(), chunks: chunks };
    recState = rec;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      if (!recState || recState !== rec) { try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} return; }
      stream = s;
      var mime = null;
      ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].forEach(function (m2) {
        if (!mime && window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m2)) mime = m2;
      });
      try { mr = new MediaRecorder(s, mime ? { mimeType: mime } : undefined); } catch (e) {
        tipClear(); tipText('录音初始化失败', 'warn'); recBtn.classList.remove('on'); recBtn.textContent = '🎙️'; recState = null;
        try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        return;
      }
      rec.mr = mr;
      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = function () {
        var srBox = rec.srBox;
        stopRecSR(srBox);
        try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        var b = new Blob(chunks, { type: mime || 'audio/webm' });
        recState = null;
        recBtn.classList.remove('on');
        recBtn.textContent = '🎙️';
        if (rec.cancelled) { tipClear(); return; }
        if (!b.size) { tipClear(); tipText('录音为空，未发送', 'warn'); return; }
        var dur = Math.round((Date.now() - rec.start) / 1000);
        // v3.11：识别与上传并行，最多等 900ms 让最后的 final 结果落地
        var txtP = new Promise(function (resolve) {
          if (!srBox) { resolve(''); return; }
          setTimeout(function () { resolve(String(srBox.txt || '').trim()); }, 900);
        });
        tipClear();
        tipText('正在上传语音…');
        uploadBlob(b, 'voice-' + stamp() + '.webm', function (e, path) {
          if (e) { tipClear(); tipText('语音上传失败：' + e, 'warn'); return; }
          var msg = {
            at: Date.now(), nick: acct().user, owner: ownerTag(), text: '', image: '',
            file: path, kind: 'voice', name: '语音消息 ' + fmtDur(dur), size: b.size, mime: b.type, dur: dur
          };
          txtP.then(function (txt) {
            msg.transcript = txt;
            postMediaMsg(msg);
          });
        });
      };
      mr.onerror = function () {
        tipClear(); tipText('录音出错', 'warn');
        recState = null;
        recBtn.classList.remove('on');
        recBtn.textContent = '🎙️';
        try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      };
      mr.start(200);
      // v3.11：录音一启动就并行识别（不能等停止后再识别，那时已经没有声音了）
      rec.srBox = startRecSR();
    }).catch(function () {
      if (!recState || recState !== rec) return;
      recState = null;
      recBtn.classList.remove('on');
      recBtn.textContent = '🎙️';
      tipClear(); tipText('无法访问麦克风', 'warn');
    });
  }
  function stopRec() {
    if (!recState) return;
    if (recState.mr) { try { recState.mr.stop(); } catch (e) {} }
    else {
      // 录音还没就绪（getUserMedia 未完成）就被点停止 → 直接取消
      recState.cancelled = true;
      recState = null;
      recBtn.classList.remove('on');
      recBtn.textContent = '🎙️';
      tipClear();
    }
  }
  // hide() 时中止录音（不算取消发送，直接停止）
  function abortRec() {
    if (!recState) return;
    recState.cancelled = true;
    stopRecSR(recState.srBox);
    if (recState.mr) { try { recState.mr.stop(); } catch (e) {} }
    recState = null;
    recBtn.classList.remove('on');
    recBtn.textContent = '🎙️';
  }
  function postMediaMsg(msg) {
    var path = ROOM_DIR + '/' + stamp() + '-' + rand4() + '.json';
    msg.p = path;
    gitPut(path, JSON.stringify(msg)).then(function (res) {
      if (!res.ok && res.status === 400 && /already exists/i.test(res.text || '')) {
        path = ROOM_DIR + '/' + stamp() + '-' + rand4() + '.json';
        msg.p = path;
        return gitPut(path, JSON.stringify(msg));
      }
      return res;
    }).then(function (res) {
      if (!res.ok) {
        var why = res.status === 401 || res.status === 403 ? 'Token 没有写权限' : ('HTTP ' + res.status);
        tipClear(); tipText('消息发送失败：' + why, 'warn');
        return;
      }
      merge([msg]);
      saveCache();
      render(true);
      updateAuth();
    });
  }

  // 语音输入（识别转文字填入输入框，不自动发送）
  var srOn = false;
  var srObj = null;
  function srReset() {
    srOn = false; srObj = null;
    micBtn.classList.remove('on'); micBtn.textContent = '🎤';
  }
  function srErrText(err) {
    var k = String(err || '');
    if (k === 'not-allowed' || k === 'service-not-allowed') return '麦克风权限被拒绝：点地址栏 🔒 允许麦克风后重试';
    if (k === 'no-speech') return '没有听到声音，靠近麦克风再说一次';
    if (k === 'audio-capture') return '没有可用的麦克风';
    if (k === 'network') return '语音识别服务连不上（浏览器语音服务需要联网）';
    if (k === 'language-not-supported') return '浏览器不支持中文语音识别';
    return '语音识别失败：' + (k || '未知错误');
  }
  function srToggle() {
    if (!SR) { tipClear(); tipText('当前浏览器不支持语音识别', 'warn'); return; }
    if (srOn) { try { srObj && srObj.abort(); } catch (e) {} srReset(); tipClear(); return; }
    // v3.11：先显式请求麦克风权限，否则 SpeechRecognition 可能静默失败，看起来像「点了没反应」
    if (window.isSecureContext === false) { tipClear(); tipText('当前页面不是 https/localhost，语音识别不可用', 'warn'); return; }
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      tipClear(); tipText('浏览器不支持麦克风采集', 'warn'); return;
    }
    tipClear(); tipText('正在请求麦克风权限…');
    micBtn.textContent = '…';
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      startSrListen();
    }).catch(function (err) {
      srReset();
      var n = err && err.name ? err.name : '';
      tipClear();
      tipText(n === 'NotAllowedError' ? '麦克风权限被拒绝：点地址栏 🔒 允许麦克风后重试'
        : n === 'NotFoundError' ? '没有可用的麦克风' : ('无法访问麦克风：' + (n || '未知错误')), 'warn');
    });
  }
  function startSrListen() {
    var r;
    try { r = new SR(); } catch (e) { srReset(); tipClear(); tipText('语音识别启动失败', 'warn'); return; }
    srObj = r;
    srOn = true;
    micBtn.classList.add('on');
    micBtn.textContent = '⏹';
    tipClear();
    tipText('聆听中…（再点 🎤 停止）', 'warn');
    var live = '';
    r.lang = 'zh-CN';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = function (e) {
      var t = '';
      for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      if (e.results[e.results.length - 1] && e.results[e.results.length - 1].isFinal) live = t;
      ta.value = (ta.value.slice(0, Math.max(0, ta.value.length - live.length)) + t);
      grow();
    };
    r.onerror = function (e) {
      tipClear(); tipText(srErrText(e && e.error), 'warn');
      srReset();
    };
    r.onend = function () {
      if (!srOn) return;
      srReset();
      tipClear();
    };
    try { r.start(); } catch (e) { srReset(); tipClear(); tipText('语音识别启动失败（需要用户手势）', 'warn'); }
  }
  micBtn.onclick = srToggle;
  recBtn.onclick = recToggle;

  function grow() {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight || 36, 96) + 'px';
  }

  // ── 事件 ──
  refreshBtn.onclick = function () { loadRoom(true); };
  fullBtn.onclick = function () { setFull(!full); };
  closeBtn.onclick = function () { hide(); };
  sendBtn.onclick = send;
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (root.style.display === 'none') return;
    if (zoom.classList.contains('on')) { zhide(); return; }
    if (full) { setFull(false); return; }
    hide();
  });

  // 避免公告栏/页面快捷键把 Esc 等拦走（只在聊天室可见时）
  // 注意：不能 stopPropagation，否则 document 上的 Esc 关闭逻辑收不到

  function show() {
    root.style.display = '';
    if (!rect) rect = readRect();
    applyRect(rect);
    updateAuth();
    render(true);
    if (token()) loadRoom(false);
    startPoll();
    setTimeout(function () { try { if (!ta.disabled) ta.focus(); } catch (e) {} }, 80);
  }
  function hide() {
    stopPoll();
    zhide();
    closeVideo();
    if (srOn) { try { srObj && srObj.abort(); } catch (e) {} srReset(); }
    abortRec();
    abortRec();
    if (full) setFull(false);
    saveRect();
    root.style.display = 'none';
  }

  loadCache();
  render(true);
  updateAuth();

  window.__fhRoom = function () {
    if (root.style.display === 'none') show();
    else { try { if (!ta.disabled) ta.focus(); } catch (e) {} }
  };
})();
