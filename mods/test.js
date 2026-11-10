/* 自检：一次性跑完环境 / 编解码 / 网络 / 页面状态，结果可一键复制 */
(function () {
  if (document.getElementById('__tb')) { document.getElementById('__tb').remove(); }

  var rows = [];
  function add(name, ok, detail) { rows.push({ name: name, ok: ok, detail: detail }); }

  function shell() {
    var d = document.createElement('div');
    d.id = '__tb';
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483645;background:rgba(10,10,12,.95);display:flex;align-items:center;justify-content:center;padding:14px;font:13px/1.5 -apple-system,"PingFang SC",sans-serif;color:#ddd';
    var card = document.createElement('div');
    card.style.cssText = 'width:min(720px,100%);max-height:88vh;display:flex;flex-direction:column;background:#1b1b20;border:1px solid #3a3a42;border-radius:14px;overflow:hidden';

    var head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #2e2e35';
    var t = document.createElement('div');
    t.textContent = '环境自检';
    t.style.cssText = 'flex:1;font-weight:700;color:#ccc';
    var cp = document.createElement('button');
    cp.textContent = '复制';
    cp.style.cssText = 'height:36px;padding:0 12px;border:1px solid #3a3a42;border-radius:9px;background:#26262c;color:#ddd;font:13px/1 inherit;cursor:pointer';
    var x = document.createElement('button');
    x.textContent = '✕';
    x.style.cssText = 'width:40px;height:36px;border:0;border-radius:9px;background:transparent;color:#999;font-size:16px;cursor:pointer';
    x.onclick = function () { d.remove(); };
    head.append(t, cp, x);

    var list = document.createElement('div');
    list.style.cssText = 'flex:1;overflow:auto;padding:8px';

    card.append(head, list);
    d.append(card);
    document.body.append(d);
    return { root: d, list: list, copy: cp };
  }

  function render(ui) {
    ui.list.innerHTML = '';
    rows.forEach(function (r) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:10px;padding:8px 10px;border-bottom:1px solid #26262c';
      var s = document.createElement('div');
      s.textContent = r.ok === null ? '•' : (r.ok ? '✓' : '✕');
      s.style.cssText = 'width:18px;color:' + (r.ok === null ? '#888' : (r.ok ? '#5bd06a' : '#e06060'));
      var n = document.createElement('div');
      n.textContent = r.name;
      n.style.cssText = 'width:150px;flex-shrink:0;color:#bbb';
      var v = document.createElement('div');
      v.textContent = r.detail == null ? '' : String(r.detail);
      v.style.cssText = 'flex:1;color:#777;font:12px/1.5 ui-monospace,Menlo,monospace;word-break:break-all';
      row.append(s, n, v);
      ui.list.append(row);
    });
  }

  function text() {
    return rows.map(function (r) {
      return (r.ok === null ? '-' : (r.ok ? 'OK' : 'FAIL')) + '  ' + r.name + ': ' + (r.detail || '');
    }).join('\n');
  }

  var ui = shell();
  ui.copy.onclick = function () {
    navigator.clipboard && navigator.clipboard.writeText(text()).then(function () {
      ui.copy.textContent = '已复制';
    }, function () { ui.copy.textContent = '失败'; });
  };

  // ── 注入串（自动更新） ──
  var REPO = 'zhaoqinhao123/fuulea_hack';
  var PROJ = '88544686';
  var cur = window.__fhTag || '?';

  function mkBtn(t) {
    var b = document.createElement('button');
    b.textContent = t;
    b.style.cssText = 'height:30px;padding:0 10px;border:1px solid #3a3a42;border-radius:8px;' +
      'background:#26262c;color:#ccc;font:12px/1 inherit;cursor:pointer';
    return b;
  }

  function copyText(t, done) {
    var fin = false;
    function doneOnce(ok) { if (fin) return; fin = true; done(ok); }
    setTimeout(function () { doneOnce(false); }, 1600);
    function fallback() {
      try {
        var x = document.createElement('textarea');
        x.value = t;
        x.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.append(x);
        x.select();
        var ok = document.execCommand('copy');
        x.remove();
        doneOnce(ok);
      } catch (e) { doneOnce(false); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        navigator.clipboard.writeText(t).then(function () { doneOnce(true); }, fallback);
      } catch (e) { fallback(); }
    } else fallback();
  }

  function withTimeout(url, ms) {
    var c = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (c) c.abort(); }, ms);
    var opt = { cache: 'no-store' };
    if (c) opt.signal = c.signal;
    return fetch(url, opt).then(function (r) { clearTimeout(t); return r; },
      function (e) { clearTimeout(t); throw e; });
  }

  function vnum(s) {
    var m = String(s).match(/(\d+)\.(\d+)/);
    return m ? [+m[1], +m[2]] : null;
  }
  function desc(a, b) { return (b[0] - a[0]) || (b[1] - a[1]); }

  function findLatest() {
    function fromCdn() {
      return withTimeout('https://data.jsdelivr.com/v1/packages/gh/' + REPO, 6000)
        .then(function (r) { return r.json(); })
        .then(function (j) { return (j.versions || []).map(function (v) { return v.version; }).filter(vnum); })
        .catch(function () { return []; });
    }
    function fromGitlab() {
      return withTimeout('https://gitlab.com/api/v4/projects/' + PROJ + '/repository/tags?per_page=100', 6000)
        .then(function (r) { return r.json(); })
        .then(function (a) {
          return a.map(function (t) { return { ver: t.name, sha: (t.commit && t.commit.id) ? t.commit.id.slice(0, 7) : '' }; })
            .filter(function (x) { return vnum(x.ver); });
        })
        .catch(function () { return []; });
    }
    return Promise.all([fromCdn(), fromGitlab()]).then(function (rs) {
      var tags = rs[1];
      var vers = rs[0].concat(tags.map(function (x) { return x.ver; }));
      if (cur && vnum(cur)) vers.push(cur);      // 源比本机还旧时，不退版
      vers = vers.filter(vnum);
      if (!vers.length) throw new Error('查不到版本');
      vers.sort(function (a, b) { return desc(vnum(a), vnum(b)); });
      var win = vers[0];
      var sha = '';
      for (var i = 0; i < tags.length; i++) {
        if (vnum(tags[i].ver) && vnum(win) && desc(vnum(tags[i].ver), vnum(win)) === 0) { sha = tags[i].sha; break; }
      }
      return { ver: win, sha: sha };
    });
  }

  var box = document.createElement('div');
  box.style.cssText = 'padding:9px 10px 8px;border-bottom:1px solid #2e2e35;display:flex;flex-direction:column;gap:7px';

  var top = document.createElement('div');
  top.style.cssText = 'display:flex;align-items:center;gap:8px';
  var lab = document.createElement('div');
  lab.textContent = '注入串';
  lab.style.cssText = 'font-weight:700;color:#bbb;font-size:12px';
  var stat = document.createElement('div');
  stat.style.cssText = 'flex:1;min-width:0;font:11px/1.4 ui-monospace,Menlo,monospace;color:#7a7a88;' +
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  stat.textContent = '当前 ' + cur;
  top.append(lab, stat);

  var ta = document.createElement('textarea');
  ta.readOnly = true;
  ta.rows = 2;
  ta.placeholder = '点下面的按钮获取最新注入串';
  ta.style.cssText = 'width:100%;box-sizing:border-box;padding:7px 8px;border:1px solid #2e2e35;' +
    'border-radius:8px;background:#101014;color:#9fd6a0;font:11px/1.5 ui-monospace,Menlo,monospace;' +
    'resize:none;word-break:break-all';

  var btns = document.createElement('div');
  btns.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center';
  var get = mkBtn('🔄 查最新版并复制');
  var shortB = mkBtn('复制短串');

  var chkWrap = document.createElement('label');
  chkWrap.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:11px;color:#8a8a99;margin-left:auto';
  var chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.style.cssText = 'width:15px;height:15px;accent-color:#3a6df0';
  try { chk.checked = localStorage.getItem('fh:autoUpd') !== '0'; } catch (e) { chk.checked = true; }
  chk.onchange = function () {
    try { localStorage.setItem('fh:autoUpd', chk.checked ? '1' : '0'); } catch (e) {}
  };
  chkWrap.append(chk, document.createTextNode('打开时自动查'));

  btns.append(get, shortB, chkWrap);
  box.append(top, ta, btns);
  ui.list.parentNode.insertBefore(box, ui.list);

  var SHORT = '<img src=x onerror="eval(localStorage.fhL)">';

  function run() {
    get.disabled = true;
    get.textContent = '查询中…';
    stat.textContent = '正在查最新版…';
    findLatest().then(function (found) {
      var tag = /^v/.test(found.ver) ? found.ver : ('v' + found.ver);
      // cdn.jsdelivr.net 在国内常被重置，先试 fastly 镜像
      var HOSTS = ['https://fastly.jsdelivr.net', 'https://cdn.jsdelivr.net'];
      function tryFetch(u) {
        return withTimeout(u + '?t=' + Date.now(), 8000)
          .then(function (r) { return r.text().then(function (t) { return { ok: r.ok && t.length > 1000, text: t, url: u }; }); })
          .catch(function () { return { ok: false, text: '', url: u }; });
      }
      var refs = found.sha ? [tag, found.sha] : [tag];
      var cands = [];
      refs.forEach(function (ref) {
        HOSTS.forEach(function (h) { cands.push(h + '/gh/' + REPO + '@' + ref + '/loader.js'); });
      });
      var ci = 0;
      function nextFetch() {
        if (ci >= cands.length) return Promise.resolve({ ok: false, text: '', url: cands[cands.length - 1] });
        return tryFetch(cands[ci++]).then(function (r) { return r.ok ? r : nextFetch(); });
      }
      return nextFetch().then(function (res) {
          var base = res.ok ? res.url
            : (HOSTS[0] + '/gh/' + REPO + '@' + (found.sha || tag) + '/loader.js');
          var inj = '<img src=x onerror="with(document)body.appendChild(createElement(\'script\')).src=\'' +
            base.replace(/^https:/, '') + '\'">';
          ta.value = inj;

          if (res.ok) {
            try {
              localStorage.setItem('fhL', res.text);
              localStorage.setItem('fhV', tag);
            } catch (e) {}
          }

          copyText(inj, function (ok) {
            var same = vnum(tag) && vnum(cur) && desc(vnum(tag), vnum(cur)) === 0;
            stat.textContent = '最新 ' + tag + (same ? '（与当前相同）' : '（当前 ' + cur + '）') +
              ' · ' + (res.ok ? 'CDN 通' : '走 GitHub') + ' · ' + inj.length + ' 字 · ' +
              (ok ? '已复制' : '复制失败，长按框内文字');
            get.disabled = false;
            get.textContent = '🔄 重新查';
            shortB.textContent = res.ok ? '复制短串' : '复制短串（未更新缓存）';
            render(ui);
          });
        });
    }).catch(function (e) {
      stat.textContent = '查不到最新版：' + (e.name === 'AbortError' ? '超时' : (e.message || e.name));
      get.disabled = false;
      get.textContent = '🔄 重试';
    });
  }

  get.onclick = run;
  shortB.onclick = function () {
    copyText(SHORT, function (ok) {
      stat.textContent = ok ? '短串已复制（需本机缓存已是新版）' : '复制失败，长按框内文字';
    });
  };

  add('loader 版本', null, cur);
  try {
    if (chk.checked) setTimeout(run, 200);
  } catch (e) {}

  // ── 环境 ──
  add('协议', null, location.protocol + '  secure=' + window.isSecureContext);
  add('UA', null, navigator.userAgent);
  add('屏幕', null, screen.width + '×' + screen.height + '  dpr=' + (window.devicePixelRatio || 1));
  add('触摸', 'ontouchstart' in window, '');

  // ── 存储 ──
  try {
    localStorage.setItem('__t', '1');
    localStorage.removeItem('__t');
    add('localStorage', true, '可读写');
  } catch (e) { add('localStorage', false, e.message); }

  // ── 文件 ──
  var fi = document.createElement('input');
  add('webkitdirectory', ('webkitdirectory' in fi), '选文件夹');
  add('File API', typeof File !== 'undefined' && typeof FileReader !== 'undefined', '');

  // ── 媒体 ──
  add('getUserMedia', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), '');
  add('MediaRecorder', typeof MediaRecorder !== 'undefined', '');
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
    var mimes = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'audio/webm'];
    mimes.forEach(function (m) { add('  录制 ' + m, MediaRecorder.isTypeSupported(m), ''); });
  }
  var v = document.createElement('video');
  ['video/mp4; codecs="avc1.42E01E"', 'video/webm; codecs="vp8"', 'video/webm; codecs="vp9"'].forEach(function (m) {
    add('  播放 ' + m.split(';')[0].replace('video/', ''), !!v.canPlayType(m), v.canPlayType(m) || '');
  });

  // ── 网络 ──
  add('fetch', typeof fetch === 'function', '');
  add('Blob URL', typeof URL !== 'undefined' && !!URL.createObjectURL, '');

  var ctrl = window.AbortController ? new AbortController() : null;
  var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
  fetch('https://gitlab.com/api/v4/projects/88544686/repository/files/loader.js/raw?ref=main&t=' + Date.now(), ctrl ? { signal: ctrl.signal } : {})
    .then(function (r) { return r.text(); })
    .then(function (t) {
      clearTimeout(timer);
      add('GitLab 连通', t.length > 100, t.length + ' bytes');
      render(ui);
    })
    .catch(function (e) {
      clearTimeout(timer);
      add('GitLab 连通', false, e.name === 'AbortError' ? '超时 6s' : e.message);
      render(ui);
    });

  // ── 页面状态 ──
  try {
    add('state.pets', true, (typeof state !== 'undefined' ? state.pets.length : '?') + ' 只');
    add('MAX_PETS', null, typeof MAX_PETS !== 'undefined' ? MAX_PETS : '?');
    add('PET_REQ', null, typeof PET_REQ !== 'undefined' ? PET_REQ.join(',') : '?');
    add('PET_IMG', null, typeof PET_IMG !== 'undefined' ? Object.keys(PET_IMG).length + ' 张' : '?');
    add('错题/收藏', null, (typeof state !== 'undefined' ? Object.keys(state.wrong || {}).length : '?') + ' / ' + (typeof state !== 'undefined' ? Object.keys(state.fav || {}).length : '?'));
  } catch (e) { add('页面状态', false, e.message); }

  render(ui);
})();
