/* 聊天室（共享）v3.8 — 独立于 AI 网页的浮窗；消息存 GitLab message/ */
(function () {
  'use strict';

  var OLD = document.getElementById('__rm');
  if (OLD) { try { OLD.remove(); } catch (e) {} }

  var GIT_HOST = 'https://gitlab.com';
  var GIT_PROJ = 'yq-group2/fuulea_ai_repository';
  var GIT_BRANCH = 'main';
  var ROOM_DIR = 'message';
  var POLL = 30000;
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

  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
  function stamp() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + '-' +
      pad2(d.getHours()) + '-' + pad2(d.getMinutes()) + '-' + pad2(d.getSeconds());
  }
  function rand4() { return String(Math.floor(Math.random() * 10000)).padStart(4, '0'); }
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
  function treeUrl(p) {
    return GIT_HOST + '/api/v4/projects/' + encodeURIComponent(GIT_PROJ) + '/repository/tree' +
      '?ref=' + encodeURIComponent(GIT_BRANCH) + '&per_page=100&path=' + encodeURIComponent(p);
  }
  function gitReq(method, url, body) {
    return new Promise(function (resolve) {
      var x = new XMLHttpRequest();
      try { x.open(method, url, true); } catch (e) { resolve({ ok: false, status: 0, text: String(e) }); return; }
      x.setRequestHeader('PRIVATE-TOKEN', token());
      if (body != null) x.setRequestHeader('Content-Type', 'application/json');
      x.timeout = 45000;
      x.onload = function () {
        resolve({ ok: x.status >= 200 && x.status < 300, status: x.status, text: x.responseText || '' });
      };
      x.onerror = function () { resolve({ ok: false, status: 0, text: '' }); };
      x.ontimeout = function () { resolve({ ok: false, status: 0, text: 'timeout' }); };
      try { x.send(body == null ? null : body); } catch (e) { resolve({ ok: false, status: 0, text: String(e) }); }
    });
  }
  function b64utf8(s) {
    var bytes = new TextEncoder().encode(String(s));
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function gitTree(p) {
    return gitReq('GET', treeUrl(p)).then(function (r) {
      if (!r.ok) return { ok: false, status: r.status, items: [] };
      var arr = [];
      try { arr = JSON.parse(r.text); } catch (e) {}
      if (Object.prototype.toString.call(arr) !== '[object Array]') arr = [];
      return {
        ok: true, status: r.status,
        items: arr.filter(function (x) { return x && x.type === 'blob' && x.path; }).map(function (x) { return x.path; })
      };
    });
  }
  function gitRaw(p) {
    return gitReq('GET', fileUrl(p, true)).then(function (r) {
      return r.ok ? r.text : '';
    });
  }
  function gitPut(p, text) {
    var body = JSON.stringify({
      branch: GIT_BRANCH, content: b64utf8(text), encoding: 'base64',
      commit_message: 'room message ' + p.replace(/^message\//, '')
    });
    return gitReq('POST', fileUrl(p), body);
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
      return m && typeof m === 'object' && (m.text || m.image) && m.p;
    }).map(function (m) {
      return {
        p: String(m.p), at: Number(m.at) || 0, nick: String(m.nick || '匿名'),
        owner: String(m.owner || ''), text: String(m.text || ''), image: String(m.image || '')
      };
    }).slice(-200);
    msgs.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
  }
  function saveCache() {
    msgs = msgs.slice(-200);
    try { save(K_CACHE, JSON.stringify(msgs)); } catch (e) {}
  }
  function merge(list) {
    var map = {};
    msgs.forEach(function (m) { map[m.p] = m; });
    list.forEach(function (m) { if (m && m.p) map[m.p] = m; });
    msgs = Object.keys(map).map(function (k) { return map[k]; });
    msgs.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    if (msgs.length > 200) msgs = msgs.slice(-200);
  }
  function parseMsg(path, text) {
    var j = null;
    try { j = JSON.parse(text); } catch (e) {}
    if (!j || typeof j !== 'object') return null;
    var t = String(j.text == null ? '' : j.text).slice(0, 8000);
    var img = String(j.image == null ? '' : j.image);
    if (!t && !img) return null;
    return {
      p: path, at: Number(j.at) || Date.now(), nick: String(j.nick || '匿名').slice(0, 30),
      owner: String(j.owner || ''), text: t, image: img
    };
  }
  function fetchPaths(paths) {
    var out = [], i = 0;
    function worker() {
      if (i >= paths.length) return Promise.resolve();
      var p = paths[i++];
      return gitRaw(p).then(function (txt) {
        var m = parseMsg(p, txt);
        if (m) out.push(m);
        return worker();
      });
    }
    var ws = [];
    for (var k = 0; k < 4; k++) ws.push(worker());
    return Promise.all(ws).then(function () { return out; });
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
    '#__rm .rm-compose{display:flex;align-items:flex-end;gap:6px;margin-top:4px}',
    '#__rm .rm-ta{flex:1;min-width:0;min-height:36px;max-height:96px;padding:8px 10px;resize:none;border:1px solid var(--line);',
    'border-radius:9px;background:#151821;color:var(--fg);font:13px/1.45 inherit;outline:none}',
    '#__rm .rm-ta:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(77,126,248,.14)}',
    '#__rm .rm-ta:disabled{opacity:.55;cursor:not-allowed}',
    '#__rm .rm-send{height:36px;min-width:58px;padding:0 12px;border:0;border-radius:9px;',
    'background:linear-gradient(180deg,var(--accent),var(--accent2));color:#fff;font:12px/1 inherit;',
    'font-weight:600;cursor:pointer;flex-shrink:0}',
    '#__rm .rm-send:disabled{opacity:.45;cursor:not-allowed}',
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
    '#__rm .rm-zoom .zbar{display:flex;align-items:center;gap:6px;padding:8px 10px;flex-shrink:0}',
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
  badge.textContent = 'v3.8';
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
  compose.append(ta, sendBtn);
  foot.append(tip, compose);

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
      e.appendChild(document.createTextNode(token() ? '还没有消息，来发第一条吧' : '配置 GitLab Token 后就能看到大家的消息'));
      body.appendChild(e);
    } else {
      msgs.forEach(function (m) { body.appendChild(bubbleFor(m)); });
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
      tipText(' · 消息写入 GitLab message/ · 30 秒自动刷新');
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
  function loadRoom(manual) {
    if (!token()) { updateAuth(); return; }
    if (loading) return;
    loading = true;
    if (manual) { refreshBtn.textContent = '…'; refreshBtn.disabled = true; }
    tipClear();
    tipText('正在同步消息…');
    gitTree(ROOM_DIR).then(function (r) {
      if (!r.ok) {
        if (r.status === 404) return [];
        throw new Error('HTTP ' + r.status);
      }
      var known = {};
      msgs.forEach(function (m) { known[m.p] = 1; });
      var fresh = r.items.filter(function (p) { return !known[p]; });
      if (fresh.length > 40) fresh = fresh.slice(-40);
      return fetchPaths(fresh);
    }).then(function (list) {
      merge(list);
      saveCache();
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
      tipText('同步失败：' + (e && e.message ? e.message : e) + '（检查 Token 读权限）', 'warn');
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
    if (!text) { ta.focus(); return; }
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
    var msg = {
      at: Date.now(), nick: r.user, owner: ownerTag(), text: text, image: ''
    };
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
      merge([{
        p: path, at: msg.at, nick: msg.nick, owner: msg.owner, text: msg.text, image: ''
      }]);
      saveCache();
      render(true);
      updateAuth();
    });
  }

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
