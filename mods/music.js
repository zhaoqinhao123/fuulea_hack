/* 本地音乐：多仓库/多分支 → 专辑分组 → 缓存或流播 → 单实例 <audio> 连播 */
(function () {
  var OLD = document.getElementById('__ms');
  if (OLD) { OLD.remove(); return; }

  var AUD = /\.(mp3|m4a|aac|flac|ogg|oga|opus|wav|weba)$/i;
  var RKEY = '***';
  var AKEY = '***';
  var DEF = 'xiao_long_long/music@master';
  var DBNAME = 'fh_media';

  // ── IndexedDB ──
  var DB = null;
  function db() {
    return new Promise(function (res, rej) {
      if (DB) return res(DB);
      var r = indexedDB.open(DBNAME, 2);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('blob')) d.createObjectStore('blob');
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
        if (!d.objectStoreNames.contains('zip')) d.createObjectStore('zip');
      };
      r.onsuccess = function () { DB = r.result; res(DB); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function put(store, val, key) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, 'readwrite').objectStore(store).put(val, key);
        t.onsuccess = function () { res(true); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function del(store, key) {
    return db().then(function (d) {
      return new Promise(function (res) {
        var t = d.transaction(store, 'readwrite').objectStore(store)['delete'](key);
        t.onsuccess = t.onerror = function () { res(true); };
      });
    });
  }
  function getAll(store) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, 'readonly').objectStore(store).getAll();
        t.onsuccess = function () { res(t.result || []); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function getOne(store, key) {
    return db().then(function (d) {
      return new Promise(function (res) {
        var t = d.transaction(store, 'readonly').objectStore(store).get(key);
        t.onsuccess = function () { res(t.result || null); };
        t.onerror = function () { res(null); };
      });
    });
  }

  // ── 仓库标识 ──
  function parseRepo(s) {
    s = (s || '').trim();
    var m = s.match(/gitlab\.com\/([^\/\s]+)\/([^\/\s]+?)(?:\/-\/tree\/([^\/\s?#]+)|\/tree\/([^\/\s?#]+))?\/?(?:\.git)?$/);
    if (m) return { proj: m[1] + '/' + m[2], ref: m[3] || m[4] || 'master' };
    m = s.match(/^([^\s@]+)@([^\s@]+)$/);
    if (m) return { proj: m[1], ref: m[2] };
    if (/^[\w.\-]+\/[\w.\-]+$/.test(s)) return { proj: s, ref: 'master' };
    return null;
  }
  function rid(r) { return r.proj + '@' + r.ref; }
  function enc(p) { return encodeURIComponent(p); }
  function bkey(ridStr, path) { return ridStr + '||' + path; }
  function archiveURL(r) {
    return 'https://gitlab.com/api/v4/projects/' + enc(r.proj) + '/repository/archive.zip?sha=' + enc(r.ref);
  }
  function rawURL(r, path) {
    return 'https://gitlab.com/api/v4/projects/' + enc(r.proj) +
      '/repository/files/' + enc(path) + '/raw?ref=' + enc(r.ref);
  }

  // ── 单实例音频 ──
  function getAudio() {
    if (!window.__fhAudio) {
      var a = new Audio();
      a.preload = 'metadata';
      window.__fhAudio = a;
    }
    return window.__fhAudio;
  }
  var audio = getAudio();

  // ── UI ──
  var root = document.createElement('div');
  root.id = '__ms';
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483645;background:#101014;display:flex;flex-direction:column;color:#ddd;font:13px/1.5 -apple-system,"PingFang SC",sans-serif';

  var bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px 10px;background:#1b1b20;border-bottom:1px solid #2c2c34;flex-shrink:0';
  var title = document.createElement('div');
  title.textContent = '音乐';
  title.style.cssText = 'flex:1;font-weight:700;color:#bbb';
  function ib(t, fn, tip) {
    var b = document.createElement('button');
    b.textContent = t;
    b.title = tip || '';
    b.style.cssText = 'min-width:38px;height:36px;border:0;border-radius:9px;background:transparent;color:#aaa;font:15px/1 inherit;cursor:pointer;padding:0 8px';
    if (fn) b.onclick = fn;
    return b;
  }
  var albBtn = ib('☁', function () { albumPanel(); }, '按专辑缓存（大仓库）');
  var impBtn = ib('⤓', function () { importPanel(); }, '整包导入（小仓库）');
  var close = ib('✕', function () { root.remove(); }, '关闭（音乐继续播）');
  bar.append(title, albBtn, impBtn, close);

  var msg = document.createElement('div');
  msg.style.cssText = 'padding:8px 12px 4px;font-size:11.5px;color:#777;flex-shrink:0';

  // 仓库条
  var repoBar = document.createElement('div');
  repoBar.style.cssText = 'display:flex;gap:6px;overflow-x:auto;padding:0 10px 8px;flex-shrink:0';
  // 专辑条
  var chips = document.createElement('div');
  chips.style.cssText = 'display:flex;gap:6px;overflow-x:auto;padding:0 10px 8px;flex-shrink:0';
  // 搜索条
  var r2 = document.createElement('div');
  r2.style.cssText = 'display:flex;gap:6px;padding:0 10px 8px;flex-shrink:0';
  var qIn = document.createElement('input');
  qIn.placeholder = '搜索曲名 / 专辑';
  qIn.style.cssText = 'flex:1;min-width:0;height:32px;padding:0 10px;border:1px solid #2a2a32;border-radius:9px;background:#131317;color:#ccc;font:12px/1 inherit';
  r2.append(qIn);

  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow:auto;min-height:0;padding:0 6px 6px';

  // 播放条
  var player = document.createElement('div');
  player.style.cssText = 'flex-shrink:0;background:#17171c;border-top:1px solid #2c2c34;padding:8px 10px;display:flex;flex-direction:column;gap:6px';
  var line1 = document.createElement('div');
  line1.style.cssText = 'display:flex;align-items:center;gap:6px';
  var now = document.createElement('div');
  now.textContent = '未在播放';
  now.style.cssText = 'flex:1;min-width:0;font-size:12px;color:#999;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  var prevB = ib('⏮', function () { step(-1); }, '上一首');
  var playB = ib('▶', toggle, '播放/暂停');
  var nextB = ib('⏭', function () { step(1); }, '下一首');
  var modeB = ib('⇕', cycleMode, '播放模式');
  line1.append(now, prevB, playB, nextB, modeB);

  var seek = document.createElement('input');
  seek.type = 'range'; seek.min = 0; seek.max = 1000; seek.value = 0;
  seek.style.cssText = 'width:100%;accent-color:#3a6df0';
  var line2 = document.createElement('div');
  line2.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:11px;color:#666';
  var timeEl = document.createElement('span');
  timeEl.textContent = '0:00 / 0:00';
  var vol = document.createElement('input');
  vol.type = 'range'; vol.min = 0; vol.max = 100; vol.value = 100;
  vol.style.cssText = 'flex:1;accent-color:#555';
  line2.append(timeEl, vol);
  player.append(line1, seek, line2);

  root.append(bar, msg, repoBar, chips, r2, body, player);
  document.body.append(root);

  // ── 状态 ──
  var byRepo = {};        // rid -> [track]
  var repoOrder = [];     // 有缓存的仓库
  var repoTree = {};      // rid -> { proj, ref }
  var active = null;      // 当前仓库 rid
  var tracks = [];        // 当前仓库的全部曲目
  var view = [];          // 筛选后
  var album = '';
  var cur = -1;
  var objURL = null;
  var MODES = ['seq', 'one', 'rnd'];
  var mode = 'seq';

  function fmt(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    var m = Math.floor(s / 60), x = Math.floor(s % 60);
    return m + ':' + (x < 10 ? '0' : '') + x;
  }
  function base(p) { return (p.split('/').pop() || p).replace(AUD, ''); }
  function dirOf(p) { return p.indexOf('/') >= 0 ? p.slice(0, p.lastIndexOf('/')) : '.'; }
  function repoOf(ridStr) { return repoTree[ridStr] || parseRepo(ridStr.replace('@', '@')) || null; }

  function modeLabel() {
    modeB.textContent = mode === 'seq' ? '⇕' : (mode === 'one' ? '↺' : '⇄');
    modeB.title = mode === 'seq' ? '顺序播放' : (mode === 'one' ? '单曲循环' : '随机播放');
    modeB.style.color = mode === 'seq' ? '#aaa' : '#5bd06a';
  }
  function cycleMode() {
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    modeLabel(); paintMsg();
  }
  function paintMsg() {
    if (!active) { msg.textContent = '还没有音乐。用 ☁ 按专辑缓存，或 ⤓ 整包导入'; return; }
    var r = repoTree[active];
    var extra = view.length !== tracks.length ? '，筛出 ' + view.length : '';
    msg.textContent = (r ? r.proj + '@' + r.ref : active) + ' · 共 ' + tracks.length + ' 首' + extra +
      ' · ' + (mode === 'seq' ? '顺序' : mode === 'one' ? '单曲' : '随机') + ' · 关窗不停播';
  }

  function drawRepos() {
    repoBar.innerHTML = '';
    if (!repoOrder.length) { repoBar.style.display = 'none'; return; }
    repoBar.style.display = 'flex';
    repoOrder.forEach(function (id) {
      var r = repoTree[id] || {};
      var on = id === active;
      var c = document.createElement('button');
      c.textContent = (r.proj ? r.proj.split('/').pop() : id) + (r.ref ? '@' + r.ref : '');
      c.title = id;
      c.style.cssText = 'flex-shrink:0;height:28px;padding:0 11px;border:1px solid ' +
        (on ? '#3a6df0' : '#2a2a32') + ';border-radius:999px;background:' +
        (on ? 'rgba(58,109,240,.22)' : 'transparent') + ';color:' +
        (on ? '#cfe0ff' : '#8a8a99') + ';font:12px/1 inherit;cursor:pointer;white-space:nowrap';
      c.onclick = function () { switchRepo(id); };
      repoBar.append(c);
    });
  }

  function drawChips() {
    chips.innerHTML = '';
    if (!tracks.length) { chips.style.display = 'none'; return; }
    chips.style.display = 'flex';
    var counts = {};
    tracks.forEach(function (t) { var d = dirOf(t.path); counts[d] = (counts[d] || 0) + 1; });
    var list = [['', tracks.length]].concat(Object.keys(counts).map(function (k) { return [k, counts[k]]; }));
    list.sort(function (a, b) { return b[1] - a[1]; });
    list.forEach(function (it) {
      var k = it[0], n = it[1];
      var c = document.createElement('button');
      c.textContent = (k === '' ? '全部' : k.split('/').pop()) + ' ' + n;
      c.style.cssText = 'flex-shrink:0;height:30px;padding:0 11px;border:1px solid ' +
        (k === album ? '#3a6df0' : '#2a2a32') + ';border-radius:999px;background:' +
        (k === album ? 'rgba(58,109,240,.22)' : 'transparent') + ';color:' +
        (k === album ? '#cfe0ff' : '#8a8a99') + ';font:12px/1 inherit;cursor:pointer;white-space:nowrap';
      c.onclick = function () { album = k; drawChips(); applyFilter(); };
      chips.append(c);
    });
  }

  function applyFilter() {
    var q = qIn.value.trim().toLowerCase();
    view = tracks.filter(function (t) {
      if (album && dirOf(t.path) !== album) return false;
      if (q && t.path.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    paintMsg();
    drawList();
  }

  function drawList() {
    body.innerHTML = '';
    var LIM = 500;
    view.slice(0, LIM).forEach(function (t, i) {
      var row = document.createElement('div');
      var on = (i === cur);
      row.textContent = (i + 1) + '. ' + t.name + (t.cached ? ' ·✓' : '');
      row.title = t.path;
      row.style.cssText = 'padding:10px 12px;border-radius:9px;cursor:pointer;font-size:13px;' +
        'color:' + (on ? '#fff' : '#999') + ';background:' + (on ? '#26262c' : 'transparent') +
        ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      row.onclick = function () { playAt(i); };
      body.append(row);
    });
    if (view.length > LIM) {
      var more = document.createElement('div');
      more.textContent = '…还有 ' + (view.length - LIM) + ' 首，用搜索缩小范围';
      more.style.cssText = 'padding:10px 12px;color:#666;font-size:12px';
      body.append(more);
    }
  }

  function switchRepo(id) {
    active = id;
    album = '';
    cur = -1;
    tracks = byRepo[id] || [];
    drawRepos(); drawChips(); applyFilter();
    try { localStorage.setItem(AKEY, id); } catch (e) {}
  }

  function playAt(i) {
    if (i < 0 || i >= view.length) return;
    cur = i;
    var t = view[i];
    var r = repoTree[active];
    getOne('blob', bkey(active, t.path)).then(function (b) {
      if (objURL) { try { URL.revokeObjectURL(objURL); } catch (e) {} objURL = null; }
      if (b) {
        objURL = URL.createObjectURL(b);
        audio.src = objURL;
      } else if (r) {
        audio.src = rawURL(r, t.path);     // 未缓存：直接流播
      } else return;
      var pr = audio.play();
      if (pr && pr.catch) pr.catch(function () { msg.textContent = '被拦截：点一下 ▶ 手动播放'; });
      now.textContent = t.name + (b ? '' : ' · 流播');
      window.__fhNowTitle = now.textContent;
      drawList();
      try {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: t.name, artist: dirOf(t.path).split('/').pop() || '', album: (r ? r.proj : '')
          });
        }
      } catch (e) {}
    });
  }

  function toggle() {
    if (!audio.src) { if (view.length) playAt(0); return; }
    if (audio.paused) audio.play(); else audio.pause();
  }
  function step(d) {
    if (!view.length) return;
    if (mode === 'rnd') {
      var j = cur;
      if (view.length > 1) { do { j = Math.floor(Math.random() * view.length); } while (j === cur); }
      playAt(j < 0 ? 0 : j);
      return;
    }
    var n = cur + d;
    if (n < 0) n = view.length - 1;
    if (n >= view.length) n = 0;
    playAt(n);
  }

  audio.addEventListener('timeupdate', function () {
    var d = audio.duration || 0;
    timeEl.textContent = fmt(audio.currentTime) + ' / ' + fmt(d);
    if (d) seek.value = Math.round(audio.currentTime / d * 1000);
  });
  audio.addEventListener('loadedmetadata', function () { timeEl.textContent = '0:00 / ' + fmt(audio.duration); });
  audio.addEventListener('play', function () { playB.textContent = '⏸'; });
  audio.addEventListener('pause', function () { playB.textContent = '▶'; });
  audio.addEventListener('ended', function () {
    if (mode === 'one') { try { audio.currentTime = 0; audio.play(); } catch (e) {} return; }
    step(1);
  });

  seek.oninput = function () { if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration; };
  vol.oninput = function () { audio.volume = vol.value / 100; };
  qIn.oninput = function () { applyFilter(); };
  playB.onclick = toggle;
  prevB.onclick = function () { step(-1); };
  nextB.onclick = function () { step(1); };
  modeB.onclick = cycleMode;
  modeLabel();

  if (audio.src && !audio.paused) {
    playB.textContent = '⏸';
    now.textContent = window.__fhNowTitle || '播放中';
  }

  // ── 读取缓存（含旧数据迁移）──
  function refresh() {
    return getAll('meta').then(function (arr) {
      var def = parseRepo((function () { try { return localStorage.getItem(RKEY) || DEF; } catch (e) { return DEF; } })()) || parseRepo(DEF);
      var defRid = rid(def);
      var need = [];
      var acc = {};
      arr.forEach(function (m) {
        var r = m.repo;
        if (!r) {
          // 老数据没有 repo 字段：归到默认仓库，并把 blob 搬到新键
          r = defRid;
          need.push(m.path);
          repoTree[r] = def;
        } else {
          var parts = r.split('@');
          repoTree[r] = parseRepo(parts[0] + '@' + (parts[1] || 'master')) || null;
        }
        var t = { path: m.path, name: m.name, size: m.size || 0, cached: true, repo: r };
        (acc[r] = acc[r] || []).push(t);
      });

      // 迁移旧 blob 键
      var chain = Promise.resolve();
      need.forEach(function (p) {
        chain = chain.then(function () {
          return getOne('blob', p).then(function (b) {
            if (!b) return;
            return put('blob', b, bkey(defRid, p)).then(function () { return del('blob', p); });
          });
        });
      });

      return chain.then(function () {
        byRepo = acc;
        repoOrder = Object.keys(acc).sort(function (a, b) {
          return (acc[b].length || 0) - (acc[a].length || 0);
        });
        repoOrder.forEach(function (id) {
          if (!repoTree[id]) {
            var parts = id.split('@');
            repoTree[id] = parseRepo(parts[0] + '@' + (parts[1] || 'master'));
          }
        });
        var want = null;
        try { want = localStorage.getItem(AKEY); } catch (e) {}
        if (want && byRepo[want]) active = want;
        else if (repoOrder.length) active = repoOrder[0];
        else active = null;
        if (active) {
          tracks = byRepo[active] || [];
          drawRepos(); drawChips(); applyFilter();
        } else {
          drawRepos(); drawChips(); paintMsg();
        }
      });
    }).catch(function (e) {
      msg.textContent = '读取缓存失败：' + (e && e.message ? e.message : e);
    });
  }

  // ── 导入：整包 ──
  function importPanel() {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(8,8,10,.8);display:flex;align-items:center;justify-content:center;padding:16px';
    var box = document.createElement('div');
    box.style.cssText = 'width:min(520px,94vw);background:#1b1b20;border:1px solid #3a3a42;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px';
    var t = document.createElement('div');
    t.textContent = '整包导入';
    t.style.cssText = 'font-weight:700;color:#bbb';
    var hint = document.createElement('div');
    hint.textContent = '小仓库用这个：一次请求拿 zip 再解压。仓库和分支随便换，专辑分组照旧。';
    hint.style.cssText = 'font-size:11.5px;color:#666;line-height:1.6';
    var inp = document.createElement('input');
    inp.placeholder = 'user/repo@分支 或 GitLab 链接';
    inp.style.cssText = 'padding:10px;border:1px solid #333;border-radius:9px;background:#101014;color:#ddd;font:12px/1.5 ui-monospace,monospace';
    try { inp.value = localStorage.getItem(RKEY) || DEF; } catch (e) { inp.value = DEF; }
    var st = document.createElement('div');
    st.style.cssText = 'font-size:12px;color:#777;min-height:18px;white-space:pre-wrap';
    var go = document.createElement('button');
    go.textContent = '下载并解压';
    go.style.cssText = 'height:40px;border:0;border-radius:10px;background:#3a6df0;color:#fff;font:13px/1 inherit;cursor:pointer';

    go.onclick = function () {
      var r = parseRepo(inp.value);
      if (!r) { st.textContent = '写法看不懂'; return; }
      try { localStorage.setItem(RKEY, inp.value.trim()); } catch (e) {}
      var id = rid(r);
      repoTree[id] = r;
      go.disabled = true;
      var zipKey = 'zip:' + id;
      getOne('zip', zipKey).then(function (cached) {
        if (cached) { st.textContent = '用已存整包 ' + (cached.size / 1048576).toFixed(1) + ' MB'; return cached; }
        st.textContent = '下载中 0%';
        return downloadZip(archiveURL(r), function (p, mb) {
          st.textContent = '下载中 ' + Math.round(p * 100) + '%  ·  ' + mb.toFixed(1) + ' MB';
        }).then(function (blob) {
          st.textContent = '保存整包 ' + (blob.size / 1048576).toFixed(1) + ' MB';
          return put('zip', blob, zipKey).then(function () { return blob; });
        });
      }).then(function (blob) {
        st.textContent = '加载 JSZip…';
        return loadJSZip().then(function (Z) { st.textContent = '解压中…'; return Z.loadAsync(blob); });
      }).then(function (zip) {
        var names = Object.keys(zip.files).filter(function (n) { return !zip.files[n].dir && AUD.test(n); });
        if (!names.length) throw new Error('压缩包里没有音频');
        names.sort(function (a, b) { return a.localeCompare(b, 'zh'); });
        var i = 0;
        return names.reduce(function (p, n) {
          return p.then(function () {
            return zip.files[n].async('blob').then(function (b) {
              var path = n.indexOf('/') >= 0 ? n.slice(n.indexOf('/') + 1) : n;
              return put('blob', b, bkey(id, path)).then(function () {
                return put('meta', { repo: id, path: path, name: base(path), size: b.size }, bkey(id, path));
              });
            }).then(function () {
              i++;
              if (i % 10 === 0 || i === names.length) st.textContent = '写入 ' + i + '/' + names.length;
            });
          });
        }, Promise.resolve()).then(function () { return names.length; });
      }).then(function (n) {
        st.textContent = '完成 ' + n + ' 首';
        d.remove();
        return refresh().then(function () { switchRepo(id); });
      }).catch(function (e) {
        st.textContent = '失败：' + (e && e.message ? e.message : e);
        go.disabled = false;
      });
    };

    box.append(t, hint, inp, go, st);
    d.append(box);
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    document.body.append(d);
  }

  function downloadZip(url, onProgress) {
    return new Promise(function (res, rej) {
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.responseType = 'blob';
      x.timeout = 600000;
      x.onprogress = function (e) {
        if (e.lengthComputable) onProgress(e.loaded / e.total, e.loaded / 1048576);
        else onProgress(0, e.loaded / 1048576);
      };
      x.onload = function () { x.status >= 200 && x.status < 300 ? res(x.response) : rej(new Error('HTTP ' + x.status)); };
      x.onerror = function () { rej(new Error('网络错误')); };
      x.ontimeout = function () { rej(new Error('超时')); };
      x.send();
    });
  }

  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      s.onload = function () { res(window.JSZip); };
      s.onerror = function () { rej(new Error('JSZip 加载失败')); };
      document.head.appendChild(s);
    });
  }

  // ── 导入：按专辑缓存（任意仓库/分支）──
  function albumPanel() {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(8,8,10,.82);display:flex;align-items:center;justify-content:center;padding:16px';
    var box = document.createElement('div');
    box.style.cssText = 'width:min(560px,94vw);max-height:86vh;display:flex;flex-direction:column;background:#1b1b20;border:1px solid #3a3a42;border-radius:14px;overflow:hidden';
    var hd = document.createElement('div');
    hd.textContent = '按专辑缓存';
    hd.style.cssText = 'padding:12px 14px;font-weight:700;color:#bbb;border-bottom:1px solid #2c2c34';
    var tips = document.createElement('div');
    tips.textContent = '大仓库用这个：只下选中专辑，已下过的自动跳过，可随时停。仓库和分支随便换。';
    tips.style.cssText = 'padding:8px 14px;font-size:11.5px;color:#777;line-height:1.6';
    var rw = document.createElement('div');
    rw.style.cssText = 'display:flex;gap:6px;padding:0 14px 8px';
    var ri = document.createElement('input');
    ri.placeholder = 'user/repo@分支 或 GitLab 链接';
    ri.style.cssText = 'flex:1;min-width:0;height:34px;padding:0 10px;border:1px solid #333;border-radius:9px;background:#101014;color:#ddd;font:12px/1 ui-monospace,monospace';
    try { ri.value = localStorage.getItem(RKEY) || DEF; } catch (e) { ri.value = DEF; }
    var rgo = document.createElement('button');
    rgo.textContent = '读列表';
    rgo.style.cssText = 'height:34px;padding:0 14px;border:0;border-radius:9px;background:#3a6df0;color:#fff;font:13px/1 inherit;cursor:pointer';
    rw.append(ri, rgo);
    var st = document.createElement('div');
    st.style.cssText = 'padding:0 14px 8px;font-size:12px;color:#888;min-height:18px;white-space:pre-wrap';
    var listBox = document.createElement('div');
    listBox.style.cssText = 'flex:1;overflow:auto;padding:0 10px 10px';
    var ft = document.createElement('div');
    ft.style.cssText = 'display:flex;gap:8px;padding:10px 14px;border-top:1px solid #2c2c34';
    var stopB = document.createElement('button');
    stopB.textContent = '停止';
    stopB.style.cssText = 'height:38px;padding:0 16px;border:1px solid #5a3030;border-radius:9px;background:transparent;color:#c98;font:13px/1 inherit;cursor:pointer';
    var closeB = document.createElement('button');
    closeB.textContent = '关闭';
    closeB.style.cssText = 'height:38px;padding:0 18px;border:0;border-radius:9px;background:#2a2a32;color:#bbb;font:13px/1 inherit;cursor:pointer';
    ft.append(stopB, closeB);

    var tree = null, stop = false, curRepo = null, cachedSet = {};

    function rows() {
      listBox.innerHTML = '';
      if (!tree || !curRepo) return;
      var map = {};
      tree.forEach(function (p) {
        var a = p.indexOf('/') >= 0 ? p.slice(0, p.lastIndexOf('/')) : '.';
        (map[a] = map[a] || []).push(p);
      });
      Object.keys(map).sort(function (a, b) { return map[b].length - map[a].length; }).forEach(function (a) {
        var arr = map[a];
        var done = arr.filter(function (p) { return cachedSet[p]; }).length;
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:#17171c;border:1px solid #26262c;margin:6px 0';
        var nm = document.createElement('div');
        nm.textContent = a.split('/').pop() + ' · ' + done + '/' + arr.length;
        nm.style.cssText = 'flex:1;min-width:0;font-size:13px;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        var b = document.createElement('button');
        b.textContent = done === arr.length ? '已全下' : '缓存';
        b.disabled = done === arr.length;
        b.style.cssText = 'height:32px;padding:0 14px;border:0;border-radius:8px;background:' +
          (done === arr.length ? '#2a2a32' : '#3a6df0') + ';color:' + (done === arr.length ? '#777' : '#fff') +
          ';font:12px/1 inherit;cursor:pointer';
        b.onclick = function () { runQueue(arr, b); };
        row.append(nm, b);
        listBox.append(row);
      });
    }

    function runQueue(arr, btn) {
      var todo = arr.filter(function (p) { return !cachedSet[p]; });
      if (!todo.length) return;
      stop = false;
      btn.disabled = true;
      var i = 0, fail = 0;
      st.textContent = '开始 ' + todo.length + ' 首';
      function nextOne() {
        if (stop || i >= todo.length) {
          st.textContent = (stop ? '已停止 ' : '完成 ') + i + '/' + todo.length + (fail ? '，失败 ' + fail : '');
          btn.disabled = false;
          rows();
          refresh().then(function () { switchRepo(rid(curRepo)); });
          return;
        }
        var path = todo[i];
        st.textContent = '下载 ' + (i + 1) + '/' + todo.length + ' · ' + base(path);
        fetchBlob(rawURL(curRepo, path)).then(function (b) {
          if (!b) throw new Error('empty');
          return put('blob', b, bkey(rid(curRepo), path)).then(function () {
            return put('meta', { repo: rid(curRepo), path: path, name: base(path), size: b.size }, bkey(rid(curRepo), path));
          });
        }).then(function () {
          cachedSet[path] = true;
          i++;
          setTimeout(nextOne, 120);
        }).catch(function () {
          fail++; i++;
          setTimeout(nextOne, 400);
        });
      }
      nextOne();
    }

    function fetchBlob(url, ms) {
      ms = ms || 60000;
      return new Promise(function (res) {
        var x = new XMLHttpRequest();
        x.open('GET', url, true);
        x.responseType = 'blob';
        x.timeout = ms;
        x.onload = function () { res(x.status >= 200 && x.status < 300 ? x.response : null); };
        x.onerror = x.ontimeout = function () { res(null); };
        x.send();
      });
    }

    rgo.onclick = function () {
      var r = parseRepo(ri.value);
      if (!r) { st.textContent = '写法看不懂'; return; }
      curRepo = r;
      repoTree[rid(r)] = r;
      try { localStorage.setItem(RKEY, ri.value.trim()); } catch (e) {}
      st.textContent = '读取列表…';
      tree = null; cachedSet = {};
      listBox.innerHTML = '';
      // 已缓存状态
      getAll('meta').then(function (arr) {
        arr.forEach(function (m) { if (m.repo === rid(r)) cachedSet[m.path] = true; });
        var files = [], page = 1, pages = 1;
        function step() {
          fetch('https://gitlab.com/api/v4/projects/' + enc(r.proj) + '/repository/tree?ref=' + enc(r.ref) +
            '&recursive=true&per_page=100&page=' + page, { credentials: 'omit' })
            .then(function (resp) {
              if (!resp.ok) throw new Error('HTTP ' + resp.status);
              var tp = parseInt(resp.headers.get('x-total-pages') || '1', 10);
              if (tp > pages) pages = tp;
              return resp.json();
            })
            .then(function (a2) {
              if (!Array.isArray(a2)) throw new Error('格式异常');
              a2.forEach(function (x) { if (x.type === 'blob' && AUD.test(x.path)) files.push(x.path); });
              st.textContent = '第 ' + page + '/' + pages + ' 页 · ' + files.length + ' 首';
              if (a2.length && page < pages && page < 40) { page++; return step(); }
              files.sort(function (a, b) { return a.localeCompare(b, 'zh'); });
              tree = files;
              st.textContent = r.proj + '@' + r.ref + ' · 共 ' + files.length + ' 首';
              rows();
            })
            .catch(function (e) { st.textContent = '失败：' + e.message; });
        }
        step();
      });
    };

    stopB.onclick = function () { stop = true; st.textContent = '停止中…'; };
    closeB.onclick = function () { stop = true; d.remove(); };
    box.append(hd, tips, rw, st, listBox, ft);
    d.append(box);
    d.onclick = function (e) { if (e.target === d) { stop = true; d.remove(); } };
    document.body.append(d);
  }

  refresh();
})();
