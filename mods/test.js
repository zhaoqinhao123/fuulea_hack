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
