/* 本机相册 v3.14 — 独立 IndexedDB（fh_album），不再和音乐共用 fh_media
   用途：
     window.__fhAlbum.save(blob, info)        保存原图 / 原视频，返回 id
     window.__fhAlbum.list({owner,kind})      列出当前身份的文件
     window.__fhAlbum.get(id) / remove(id) / update(id, patch) / clear()
     window.__fhAlbum.open({mode:'pick'|'manage', multiple, owner, onPick})
   旧版把相册存在 fh_media（version 1），音乐模块却用同名库 version 2 且不建 media 表，
   导致相册写入 VersionError；这里只读旧库做一次迁移，绝不升级 / 删除 fh_media。
*/
(function () {
  'use strict';
  if (window.__fhAlbum) return;

  var DB_NAME = 'fh_album';
  var DB_STORE = 'media';
  var DB_VER = 1;
  var OLD_DB = 'fh_media';
  var MIG_KEY = 'fh:album:migrated:v1';
  var IDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB;
  var dbP = null;
  var readyP = null;
  var ov = null;
  var viewOv = null;
  var urls = [];

  function read(k, d) {
    try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; }
  }
  function saveLS(k, v) {
    try { localStorage.setItem(k, v); } catch (e) {}
  }
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
  function userKey(u) {
    try {
      if (window.__fhAcct && window.__fhAcct.userKey) return window.__fhAcct.userKey(u);
    } catch (e) {}
    return hash8(String(u || '').toLowerCase());
  }
  function currentOwner() {
    var r = acct();
    if (r && r.user) return 'u' + userKey(r.user);
    var k = String(read('fh:ai:key', '') || '').trim();
    if (k) return 'k' + hash8(k);
    var t = String(read('fh:ai:gitToken', '') || '').trim();
    if (!t) { try { if (window.__fhAcct && window.__fhAcct.token) t = String(window.__fhAcct.token() || '').trim(); } catch (e) {} }
    return t ? 'g' + hash8(t) : 'local';
  }
  // 兼容旧记录（local / 当前 Key / 当前 Token），避免登录状态变化后相册突然变空
  function ownerSet() {
    var out = [currentOwner(), 'local'];
    var k = String(read('fh:ai:key', '') || '').trim();
    if (k) out.push('k' + hash8(k));
    var t = String(read('fh:ai:gitToken', '') || '').trim();
    if (!t) { try { if (window.__fhAcct && window.__fhAcct.token) t = String(window.__fhAcct.token() || '').trim(); } catch (e) {} }
    if (t) out.push('g' + hash8(t));
    return out;
  }
  function own(rec, tags) {
    if (!rec) return false;
    tags = tags || ownerSet();
    return !rec.owner || tags.indexOf(rec.owner) >= 0;
  }

  function openDb() {
    if (dbP) return dbP;
    dbP = new Promise(function (res, rej) {
      if (!IDB) { rej(new Error('当前浏览器没有 IndexedDB')); return; }
      var r;
      try { r = IDB.open(DB_NAME, DB_VER); } catch (e) { rej(e); return; }
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains(DB_STORE)) {
          try { d.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true }); } catch (e) {}
        }
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error || new Error('相册数据库打不开')); };
      r.onblocked = function () { rej(new Error('相册数据库被其它页面占用，请关闭其它标签页')); };
    });
    return dbP;
  }

  function oldDbOpen() {
    return new Promise(function (res, rej) {
      if (!IDB) { rej(new Error('当前浏览器没有 IndexedDB')); return; }
      var r;
      try { r = IDB.open(OLD_DB); } catch (e) { rej(e); return; }
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error || new Error('旧相册打不开')); };
      r.onblocked = function () { rej(new Error('旧相册被其它页面占用')); };
    });
  }

  // 只读旧库；旧库没有 media 表（音乐先建了 v2）就跳过。绝不 upgrade / delete。
  function migrate() {
    if (read(MIG_KEY, '') === '1') return Promise.resolve(0);
    return oldDbOpen().then(function (old) {
      if (!old.objectStoreNames.contains(DB_STORE)) {
        try { old.close(); } catch (e) {}
        saveLS(MIG_KEY, '1');
        return 0;
      }
      return new Promise(function (res, rej) {
        var all = [];
        var t = old.transaction(DB_STORE, 'readonly');
        var q = t.objectStore(DB_STORE).getAll();
        q.onsuccess = function () { all = q.result || []; };
        q.onerror = function () { rej(q.error || new Error('读取旧相册失败')); };
        t.oncomplete = function () {
          try { old.close(); } catch (e) {}
          if (!all.length) { saveLS(MIG_KEY, '1'); res(0); return; }
          openDb().then(function (db) {
            var tx = db.transaction(DB_STORE, 'readwrite');
            var store = tx.objectStore(DB_STORE);
            all.forEach(function (rec) {
              if (!rec || !rec.blob) return;
              try { store.put(rec); } catch (e) {}
            });
            tx.oncomplete = function () { saveLS(MIG_KEY, '1'); res(all.length); };
            tx.onerror = function () { rej(tx.error || new Error('迁移旧相册失败')); };
            tx.onabort = function () { rej(tx.error || new Error('迁移旧相册被中止')); };
          }).catch(rej);
        };
      });
    }).catch(function (e) {
      // 旧库这次打不开（比如被其它标签页占用）不应该影响新相册，但也不要写迁移标记，
      // 下次打开还可以再试，避免把旧照片永久漏掉。
      return 0;
    });
  }

  function ready() {
    // 注意：不能复用 dbP 存 ready 链。migrate() 里还要调用 openDb()，
    // 如果 openDb() 返回的是「等待 migrate 完成」的同一个 Promise，就会死锁。
    if (!readyP) readyP = openDb().then(function (db) { return migrate().then(function () { return db; }); });
    return readyP;
  }

  function tx(mode, fn) {
    return ready().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(DB_STORE, mode);
        var out;
        try { out = fn(t.objectStore(DB_STORE), t); } catch (e) { rej(e); return; }
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { rej(t.error || new Error('相册读写失败')); };
        t.onabort = function () { rej(t.error || new Error('相册读写被中止')); };
      });
    });
  }

  function add(rec) {
    return ready().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(DB_STORE, 'readwrite');
        var q = t.objectStore(DB_STORE).add(rec);
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error || new Error('写入相册失败')); };
        t.onabort = function () { rej(t.error || new Error('写入相册被中止')); };
      });
    });
  }
  function all() {
    return ready().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(DB_STORE, 'readonly');
        var q = t.objectStore(DB_STORE).getAll();
        q.onsuccess = function () { res(q.result || []); };
        q.onerror = function () { rej(q.error || new Error('读取相册失败')); };
      });
    });
  }
  function get(id) {
    return ready().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(DB_STORE, 'readonly');
        var q = t.objectStore(DB_STORE).get(id);
        q.onsuccess = function () { res(q.result || null); };
        q.onerror = function () { rej(q.error || new Error('读取相册失败')); };
      });
    });
  }
  function put(rec) {
    return ready().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(DB_STORE, 'readwrite');
        var q = t.objectStore(DB_STORE).put(rec);
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error || new Error('更新相册失败')); };
        t.onabort = function () { rej(t.error || new Error('更新相册被中止')); };
      });
    });
  }
  function del(id) {
    return ready().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(DB_STORE, 'readwrite');
        var q = t.objectStore(DB_STORE).delete(id);
        q.onsuccess = function () { res(1); };
        q.onerror = function () { rej(q.error || new Error('删除相册失败')); };
        t.onabort = function () { rej(t.error || new Error('删除相册被中止')); };
      });
    });
  }
  function clearAll() {
    return ready().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(DB_STORE, 'readwrite');
        t.objectStore(DB_STORE).clear();
        t.oncomplete = function () { res(1); };
        t.onerror = function () { rej(t.error || new Error('清空相册失败')); };
      });
    });
  }

  function save(blob, info) {
    if (!blob || typeof blob.size !== 'number') return Promise.reject(new Error('保存失败：不是有效的图片/视频文件'));
    info = info || {};
    var type = String(info.type || blob.type || 'application/octet-stream');
    var rec = {
      name: String(info.name || ('media-' + Date.now())),
      type: type,
      size: Number(info.size || blob.size || 0),
      at: Number(info.at || Date.now()),
      owner: String(info.owner || currentOwner()),
      kind: info.kind || (/^video\//i.test(type) ? 'video' : (/^audio\//i.test(type) ? 'voice' : 'image')),
      blob: blob,
      remotePath: String(info.remotePath || ''),
      source: String(info.source || ''),
      dur: Number(info.dur || 0),
      width: Number(info.width || 0),
      height: Number(info.height || 0)
    };
    return add(rec);
  }

  function list(opts) {
    opts = opts || {};
    var tags = opts.owner ? (Object.prototype.toString.call(opts.owner) === '[object Array]' ? opts.owner : [opts.owner]) : ownerSet();
    return all().then(function (a) {
      return a.filter(function (m) {
        if (!m || !m.blob) return false;
        if (opts.kind && m.kind !== opts.kind) return false;
        return opts.all ? true : own(m, tags);
      }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    });
  }

  function update(id, patch) {
    return get(id).then(function (rec) {
      if (!rec) throw new Error('文件不存在');
      patch = patch || {};
      Object.keys(patch).forEach(function (k) {
        if (k !== 'id' && k !== 'blob') rec[k] = patch[k];
      });
      return put(rec).then(function () { return rec; });
    });
  }

  function remove(id) { return del(id); }
  function clear() { return clearAll(); }

  // ── 轻量 UI（不依赖 ai.js / room.js 的变量和样式）──
  function el(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }
  function fmtSize(n) {
    n = Number(n) || 0;
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return (n / 1024).toFixed(0) + ' KB';
    return n + ' B';
  }
  function fmtAt(t) {
    try {
      var d = new Date(t || Date.now()), p = function (x) { return ('0' + x).slice(-2); };
      return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    } catch (e) { return ''; }
  }
  function fmtDur(n) {
    n = Math.max(0, Math.round(Number(n) || 0));
    return Math.floor(n / 60) + ':' + ('0' + (n % 60)).slice(-2);
  }
  function css() {
    if (document.getElementById('fhaCss')) return;
    var s = document.createElement('style');
    s.id = 'fhaCss';
    s.textContent = [
      '#fhaOv{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:14px;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#e9e9ef}',
      '#fhaOv *{box-sizing:border-box}',
      '#fhaOv .fha-card{width:min(880px,100%);height:min(88vh,760px);display:flex;flex-direction:column;background:#17171d;border:1px solid rgba(255,255,255,.14);border-radius:16px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.6)}',
      '#fhaOv .fha-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0}',
      '#fhaOv .fha-tit{flex:1;min-width:0;font:700 14px/1.2 inherit;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#fhaOv .fha-x{width:32px;height:32px;border:0;border-radius:8px;background:rgba(255,255,255,.08);color:#fff;font:16px/1 inherit;cursor:pointer}',
      '#fhaOv .fha-tools{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid rgba(255,255,255,.08);flex-wrap:wrap;flex-shrink:0}',
      '#fhaOv .fha-seg{display:flex;gap:4px;background:rgba(255,255,255,.06);border-radius:9px;padding:3px}',
      '#fhaOv .fha-seg button{height:28px;padding:0 12px;border:0;border-radius:7px;background:transparent;color:#b9b9c6;font:12px/1 inherit;cursor:pointer}',
      '#fhaOv .fha-seg button.on{background:#4d7ef8;color:#fff}',
      '#fhaOv .fha-chk{display:flex;align-items:center;gap:5px;margin-left:auto;color:#b9b9c6;font-size:12px;cursor:pointer;white-space:nowrap}',
      '#fhaOv .fha-chk input{accent-color:#4d7ef8;width:14px;height:14px;margin:0}',
      '#fhaOv .fha-body{flex:1;min-height:0;overflow:auto;padding:10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px;align-content:start;overscroll-behavior:contain}',
      '#fhaOv .fha-item{position:relative;aspect-ratio:1;border:2px solid transparent;border-radius:11px;overflow:hidden;background:#24242c;cursor:pointer;padding:0}',
      '#fhaOv .fha-item.on{border-color:#4d7ef8;box-shadow:0 0 0 2px rgba(77,126,248,.35)}',
      '#fhaOv .fha-item img,#fhaOv .fha-item video{width:100%;height:100%;object-fit:cover;display:block}',
      '#fhaOv .fha-item .fha-play{position:absolute;inset:0;display:grid;place-items:center;color:#fff;font:28px/1 inherit;text-shadow:0 2px 8px #000;pointer-events:none}',
      '#fhaOv .fha-item .fha-meta{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;gap:4px;padding:3px 5px;background:linear-gradient(transparent,rgba(0,0,0,.82));color:#fff;font:9.5px/1.4 ui-monospace,monospace;pointer-events:none}',
      '#fhaOv .fha-item .fha-dot{position:absolute;right:6px;top:6px;width:19px;height:19px;border-radius:50%;border:2px solid #fff;background:rgba(0,0,0,.35);color:#fff;font:12px/15px inherit;text-align:center;pointer-events:none}',
      '#fhaOv .fha-item.on .fha-dot{background:#4d7ef8;border-color:#4d7ef8}',
      '#fhaOv .fha-empty{grid-column:1/-1;padding:48px 16px;text-align:center;color:#8f8f9e;font-size:13px;line-height:1.9}',
      '#fhaOv .fha-foot{display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid rgba(255,255,255,.1);flex-shrink:0}',
      '#fhaOv .fha-status{flex:1;min-width:0;color:#9d9dab;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#fhaOv .fha-btn{height:36px;padding:0 16px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:rgba(255,255,255,.07);color:#fff;font:13px/1 inherit;cursor:pointer}',
      '#fhaOv .fha-btn.primary{background:linear-gradient(180deg,#4d7ef8,#3a62d6);border-color:transparent;font-weight:600}',
      '#fhaOv .fha-btn:disabled{opacity:.5;cursor:default}',
      '#fhaView{position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;flex-direction:column}',
      '#fhaView .v{flex:1;min-height:0;width:100%;object-fit:contain;background:#000}',
      '#fhaView .b{display:flex;gap:8px;justify-content:center;padding:12px;background:rgba(0,0,0,.72);flex-wrap:wrap}',
      '#fhaView .b button{height:34px;padding:0 14px;border:1px solid rgba(255,255,255,.22);border-radius:8px;background:rgba(255,255,255,.08);color:#fff;font:12.5px/1 inherit;cursor:pointer}',
      '@media(max-width:560px){#fhaOv{padding:0}#fhaOv .fha-card{width:100%;height:100%;max-height:none;border:0;border-radius:0}#fhaOv .fha-body{grid-template-columns:repeat(3,1fr);gap:6px;padding:8px}}'
    ].join('');
    document.head.appendChild(s);
  }

  function revoke() {
    urls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    urls = [];
  }
  function close() {
    if (ov) { try { ov.remove(); } catch (e) {} ov = null; }
    revoke();
  }
  function closeView() {
    if (viewOv) { try { viewOv.remove(); } catch (e) {} viewOv = null; }
  }

  function picker(opts) {
    opts = opts || {};
    css();
    if (ov) { close(); if (opts.toggle !== false) return; }
    var selected = {};
    var items = [];
    var filter = 'all';
    var sending = false;

    var root = el('div');
    root.id = 'fhaOv';
    var card = el('div', 'fha-card');
    var head = el('div', 'fha-head');
    var tit = el('div', 'fha-tit', opts.mode === 'manage' ? '本机相册' : '从相册选择');
    var x = el('button', 'fha-x', '✕');
    x.title = '关闭';
    head.append(tit, x);

    var tools = el('div', 'fha-tools');
    var seg = el('div', 'fha-seg');
    var bAll = el('button', 'on', '全部');
    var bImg = el('button', '', '图片');
    var bVid = el('button', '', '视频');
    seg.append(bAll, bImg, bVid);
    var chkWrap = el('label', 'fha-chk');
    var chk = document.createElement('input');
    chk.type = 'checkbox';
    chkWrap.append(chk, document.createTextNode('发送前压缩图片（可选）'));
    if (opts.mode === 'manage') chkWrap.style.display = 'none';
    tools.append(seg, chkWrap);

    var body = el('div', 'fha-body');
    var foot = el('div', 'fha-foot');
    var status = el('div', 'fha-status', '读取相册…');
    var cancel = el('button', 'fha-btn', opts.mode === 'manage' ? '关闭' : '取消');
    var send = el('button', 'fha-btn primary', opts.mode === 'manage' ? '完成' : '发送');
    if (opts.mode === 'manage') send.style.display = 'none';
    foot.append(status, cancel, send);
    card.append(head, tools, body, foot);
    root.append(card);
    document.body.append(root);
    ov = root;

    function count() { return Object.keys(selected).length; }
    function paintSel() {
      send.disabled = count() === 0 || sending;
      send.textContent = sending ? '发送中…' : ('发送' + (count() ? '（' + count() + '）' : ''));
      if (!sending) status.textContent = '共 ' + items.length + ' 个文件 · 已选 ' + count() + ' 个';
    }
    function filtered() {
      if (filter === 'all') return items;
      return items.filter(function (m) { return m.kind === filter; });
    }
    function preview(rec) {
      closeView();
      var v = el('div');
      v.id = 'fhaView';
      var media;
      var url = '';
      try { url = URL.createObjectURL(rec.blob); } catch (e) {}
      urls.push(url);
      if (rec.kind === 'video' || rec.kind === 'voice') {
        media = document.createElement('video');
        media.controls = true;
        media.autoplay = true;
        media.playsInline = true;
      } else {
        media = document.createElement('img');
        media.alt = rec.name || '图片';
      }
      media.className = 'v';
      media.src = url;
      var bar = el('div', 'b');
      var dl = el('button', '', '下载');
      var rm = el('button', '', '删除');
      var cl = el('button', '', '关闭');
      bar.append(dl, rm, cl);
      v.append(media, bar);
      document.body.append(v);
      viewOv = v;
      dl.onclick = function () { download(rec); };
      rm.onclick = function () {
        if (!confirm('从相册删除这个文件？')) return;
        remove(rec.id).then(function () {
          closeView();
          load();
        }).catch(function (e) { status.textContent = '删除失败：' + (e && e.message ? e.message : e); });
      };
      cl.onclick = closeView;
    }
    function download(rec) {
      try {
        var u = URL.createObjectURL(rec.blob);
        var a = document.createElement('a');
        a.href = u;
        a.download = rec.name || ('album-' + rec.id);
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(function () { try { URL.revokeObjectURL(u); } catch (e) {} }, 4000);
      } catch (e) {}
    }
    function render() {
      body.innerHTML = '';
      var list = filtered();
      if (!list.length) {
        body.append(el('div', 'fha-empty', opts.mode === 'manage'
          ? '相册还是空的。\n用聊天室或相机拍照 / 录像后会自动保存到这里。'
          : '相册还是空的。\n先用 📷 拍照或录像，文件会自动存进相册。'));
        paintSel();
        return;
      }
      list.forEach(function (m) {
        var b = el('button', 'fha-item' + (selected[m.id] ? ' on' : ''));
        b.type = 'button';
        var u = '';
        try { u = URL.createObjectURL(m.blob); } catch (e) {}
        urls.push(u);
        if (m.kind === 'video') {
          var v = document.createElement('video');
          v.muted = true;
          v.playsInline = true;
          v.preload = 'metadata';
          v.src = u;
          b.append(v);
          b.append(el('span', 'fha-play', '▶'));
        } else if (m.kind === 'voice') {
          b.append(el('span', 'fha-play', '🎙'));
        } else {
          var im = document.createElement('img');
          im.loading = 'lazy';
          im.alt = m.name || '图片';
          im.src = u;
          b.append(im);
        }
        var meta = el('span', 'fha-meta');
        meta.append(el('span', '', fmtSize(m.size)));
        meta.append(el('span', '', m.kind === 'video' ? fmtDur(m.dur) : fmtAt(m.at)));
        b.append(meta);
        var dot = el('span', 'fha-dot', selected[m.id] ? '✓' : '');
        b.append(dot);
        b.onclick = function () {
          if (opts.mode === 'manage') { preview(m); return; }
          if (sending) return;
          if (selected[m.id]) delete selected[m.id];
          else {
            if (!opts.multiple) selected = {};
            selected[m.id] = true;
          }
          b.classList.toggle('on', !!selected[m.id]);
          dot.textContent = selected[m.id] ? '✓' : '';
          paintSel();
        };
        body.append(b);
      });
      paintSel();
    }
    function load() {
      status.textContent = '读取相册…';
      list({ owner: opts.owner || currentOwner() }).then(function (a) {
        items = a;
        render();
      }).catch(function (e) {
        body.innerHTML = '';
        body.append(el('div', 'fha-empty', '相册打不开：' + (e && e.message ? e.message : e)));
        status.textContent = '读取失败';
      });
    }
    function setFilter(f, btn) {
      filter = f;
      [bAll, bImg, bVid].forEach(function (x) { x.classList.toggle('on', x === btn); });
      render();
    }
    bAll.onclick = function () { setFilter('all', bAll); };
    bImg.onclick = function () { setFilter('image', bImg); };
    bVid.onclick = function () { setFilter('video', bVid); };
    x.onclick = close;
    cancel.onclick = close;
    send.onclick = function () {
      if (sending) return;
      var picks = items.filter(function (m) { return selected[m.id]; });
      if (!picks.length) return;
      if (opts.mode === 'manage') { close(); return; }
      if (typeof opts.onPick !== 'function') { close(); return; }
      sending = true;
      paintSel();
      status.textContent = '正在发送 ' + picks.length + ' 个文件…';
      var ret;
      try { ret = opts.onPick(picks, { compress: !!chk.checked }); } catch (e) { ret = Promise.reject(e); }
      Promise.resolve(ret).then(function () {
        sending = false;
        close();
      }).catch(function (e) {
        sending = false;
        paintSel();
        status.textContent = '发送失败：' + (e && e.message ? e.message : e);
      });
    };
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    load();
  }

  window.__fhAlbum = {
    ready: ready,
    save: save,
    list: list,
    get: get,
    update: update,
    remove: remove,
    clear: clear,
    open: picker,
    close: close,
    owner: currentOwner,
    DB_NAME: DB_NAME
  };
})();
