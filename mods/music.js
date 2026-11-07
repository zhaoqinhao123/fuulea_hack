/* 本地音乐：从 GitLab 仓库压缩包导入 → 解压 → IndexedDB 缓存 → 播放器 */
(function () {
  if (document.getElementById('__ms')) { document.getElementById('__ms').remove(); return; }

  var AUDIO = /\.(mp3|m4a|aac|flac|ogg|oga|opus|wav|weba)$/i;
  var DB = null;

  function db() {
    return new Promise(function (res, rej) {
      if (DB) return res(DB);
      var r = indexedDB.open('fh_media', 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('blob')) d.createObjectStore('blob');
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
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
      return new Promise(function (res, rej) {
        var t = d.transaction(store, 'readonly').objectStore(store).get(key);
        t.onsuccess = function () { res(t.result || null); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function clearAll() {
    return db().then(function (d) {
      return new Promise(function (res) {
        var tx = d.transaction(['blob', 'meta'], 'readwrite');
        tx.objectStore('blob').clear();
        tx.objectStore('meta').clear();
        tx.oncomplete = function () { res(true); };
      });
    });
  }

  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      s.onload = function () { res(window.JSZip); };
      s.onerror = function () { rej(new Error('JSZip 加载失败')); };
      document.head.append(s);
    });
  }

  // GitLab 归档地址归一化：支持网页地址 / 项目路径 / API 地址
  function normArchive(u) {
    u = u.trim();
    var m = u.match(/^https?:\/\/gitlab\.com\/([^\/]+)\/([^\/]+)\/-\/archive\/([^\/]+)\//);
    if (m) return 'https://gitlab.com/api/v4/projects/' + encodeURIComponent(m[1] + '/' + m[2]) + '/repository/archive.zip?sha=' + encodeURIComponent(m[3]);
    m = u.match(/^([\w.-]+)\/([\w.-]+)(?:@([\w.\/-]+))?$/);
    if (m) return 'https://gitlab.com/api/v4/projects/' + encodeURIComponent(m[1] + '/' + m[2]) + '/repository/archive.zip?sha=' + encodeURIComponent(m[3] || 'main');
    return u;
  }

  function download(url, onProgress) {
    return new Promise(function (res, rej) {
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.responseType = 'blob';
      x.timeout = 120000;
      x.onprogress = function (e) { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      x.onload = function () { (x.status >= 200 && x.status < 300) ? res(x.response) : rej(new Error('HTTP ' + x.status)); };
      x.onerror = function () { rej(new Error('网络错误')); };
      x.ontimeout = function () { rej(new Error('超时')); };
      x.send();
    });
  }

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
    b.onclick = fn;
    return b;
  }
  var impBtn = ib('⤓', null, '导入');
  var close = ib('✕', function () {
    try { audio.pause(); } catch (e) {}
    if (objURL) { try { URL.revokeObjectURL(objURL); } catch (e) {} objURL = null; }
    root.remove();
  });
  bar.append(title, impBtn, close);

  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow:auto;min-height:0';

  var list = document.createElement('div');
  list.style.cssText = 'padding:6px';

  var msg = document.createElement('div');
  msg.style.cssText = 'padding:8px 12px;font-size:12px;color:#777';

  body.append(msg, list);

  // 播放条
  var player = document.createElement('div');
  player.style.cssText = 'flex-shrink:0;background:#17171c;border-top:1px solid #2c2c34;padding:8px 10px;display:flex;flex-direction:column;gap:6px';

  var line1 = document.createElement('div');
  line1.style.cssText = 'display:flex;align-items:center;gap:8px';
  var now = document.createElement('div');
  now.textContent = '未在播放';
  now.style.cssText = 'flex:1;font-size:12px;color:#999;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';

  var prev = ib('⏮', null);
  var play = ib('▶', null);
  var next = ib('⏭', null);
  var loop = ib('🔁', null, '单曲循环');
  line1.append(now, prev, play, next, loop);

  var seek = document.createElement('input');
  seek.type = 'range';
  seek.min = 0; seek.max = 1000; seek.value = 0;
  seek.style.cssText = 'width:100%;accent-color:#3a6df0';

  var line2 = document.createElement('div');
  line2.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:11px;color:#666';
  var time = document.createElement('span');
  time.textContent = '0:00 / 0:00';
  var vol = document.createElement('input');
  vol.type = 'range'; vol.min = 0; vol.max = 100; vol.value = 100;
  vol.style.cssText = 'flex:1;accent-color:#555';
  line2.append(time, vol);

  player.append(line1, seek, line2);
  root.append(bar, body, player);
  document.body.append(root);

  // 导入面板
  function importPanel() {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(8,8,10,.8);display:flex;align-items:center;justify-content:center;padding:16px';
    var box = document.createElement('div');
    box.style.cssText = 'width:min(520px,94vw);background:#1b1b20;border:1px solid #3a3a42;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px';
    var t = document.createElement('div');
    t.textContent = '导入音乐仓库';
    t.style.cssText = 'font-weight:700;color:#bbb';
    var inp = document.createElement('input');
    inp.placeholder = 'GitLab 归档地址 / 项目路径（user/repo@main）';
    inp.style.cssText = 'padding:10px;border:1px solid #333;border-radius:9px;background:#101014;color:#ddd;font:12px/1.5 ui-monospace,monospace';
    var st = document.createElement('div');
    st.style.cssText = 'font-size:12px;color:#777;min-height:18px';
    var go = document.createElement('button');
    go.textContent = '下载并缓存';
    go.style.cssText = 'height:40px;border:0;border-radius:10px;background:#3a6df0;color:#fff;font:13px/1 inherit;cursor:pointer';

    go.onclick = function () {
      var u = inp.value.trim();
      if (!u) return;
      go.disabled = true;
      var url = normArchive(u);
      st.textContent = '下载中…';
      download(url, function (p) { st.textContent = '下载中 ' + Math.round(p * 100) + '%'; })
        .then(function (blob) {
          st.textContent = '解压中…（' + (blob.size / 1048576).toFixed(1) + ' MB）';
          return loadJSZip().then(function (Z) { return Z.loadAsync(blob); });
        })
        .then(function (zip) {
          var names = Object.keys(zip.files).filter(function (n) { return !zip.files[n].dir && AUDIO.test(n); });
          if (!names.length) throw new Error('压缩包里没有音频文件');
          names.sort();
          st.textContent = '写入缓存 0/' + names.length;
          var i = 0;
          return names.reduce(function (p, n) {
            return p.then(function () {
              return zip.files[n].async('blob').then(function (b) {
                var short = n.split('/').pop();
                return put('blob', b, n).then(function () {
                  return put('meta', { path: n, name: short.replace(AUDIO, ''), size: b.size }, n);
                });
              }).then(function () {
                i++;
                st.textContent = '写入缓存 ' + i + '/' + names.length;
              });
            });
          }, Promise.resolve());
        })
        .then(function () {
          st.textContent = '完成';
          d.remove();
          refresh();
        })
        .catch(function (e) {
          st.textContent = '失败：' + e.message;
          go.disabled = false;
        });
    };

    box.append(t, inp, go, st);
    d.append(box);
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    document.body.append(d);
    setTimeout(function () { inp.focus(); }, 50);
  }
  impBtn.onclick = importPanel;

  // ── 列表与播放 ──
  var tracks = [];
  var objURL = null;
  var idx = -1;
  var audio = new Audio();
  audio.preload = 'metadata';

  function fmt(s) {
    if (!isFinite(s)) return '0:00';
    var m = Math.floor(s / 60), x = Math.floor(s % 60);
    return m + ':' + (x < 10 ? '0' : '') + x;
  }

  function refresh() {
    getAll('meta').then(function (arr) {
      tracks = arr.sort(function (a, b) { return a.path.localeCompare(b.path, 'zh'); });
      drawList();
      msg.textContent = tracks.length ? ('共 ' + tracks.length + ' 首 · ' + (tracks.reduce(function (s, t) { return s + t.size; }, 0) / 1048576).toFixed(1) + ' MB') : '还没有音乐，点右上角 ⤓ 导入';
    });
  }

  function drawList() {
    list.innerHTML = '';
    tracks.forEach(function (t, i) {
      var row = document.createElement('div');
      row.textContent = (i + 1) + '. ' + t.name;
      row.style.cssText = 'padding:11px 12px;border-radius:9px;cursor:pointer;font-size:13px;color:' + (i === idx ? '#fff' : '#999') + ';background:' + (i === idx ? '#26262c' : 'transparent') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      row.onclick = function () { play(i); };
      list.append(row);
    });
  }

  function play(i) {
    if (i < 0 || i >= tracks.length) return;
    idx = i;
    var t = tracks[i];
    getOne('blob', t.path).then(function (b) {
      if (!b) return alert('缓存里找不到这个文件');
      if (objURL) { try { URL.revokeObjectURL(objURL); } catch (e) {} }
      objURL = URL.createObjectURL(b);
      audio.src = objURL;
      audio.play().catch(function () {});
      now.textContent = t.name;
      play.textContent = '⏸';
      drawList();
    });
  }

  play.onclick = function () {
    if (!audio.src) { if (tracks.length) play(0); return; }
    if (audio.paused) { audio.play(); play.textContent = '⏸'; }
    else { audio.pause(); play.textContent = '▶'; }
  };
  prev.onclick = function () { if (tracks.length) play((idx - 1 + tracks.length) % tracks.length); };
  next.onclick = function () { if (tracks.length) play((idx + 1) % tracks.length); };
  loop.onclick = function () {
    audio.loop = !audio.loop;
    loop.style.color = audio.loop ? '#5bd06a' : '#aaa';
  };

  audio.addEventListener('timeupdate', function () {
    var d = audio.duration || 0;
    time.textContent = fmt(audio.currentTime) + ' / ' + fmt(d);
    if (d) seek.value = Math.round(audio.currentTime / d * 1000);
  });
  audio.addEventListener('ended', function () {
    if (!audio.loop && tracks.length > 1) play((idx + 1) % tracks.length);
  });
  audio.addEventListener('loadedmetadata', function () {
    time.textContent = '0:00 / ' + fmt(audio.duration);
  });
  seek.oninput = function () {
    if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration;
  };
  vol.oninput = function () { audio.volume = vol.value / 100; };

  refresh();
})();
