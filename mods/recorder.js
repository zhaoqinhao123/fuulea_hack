/* 录音机 v3.18 — 独立小窗；录音自动存本机相册（kind:'voice'）
   用法：window.__fhRecorder.open()
   小窗故意不参与 loader 的通用窗口壳（data-fh-skip=1），自己实现拖动 /
   透明度 / 黑白背景，避免被 📌/◱ 按钮撑大。
*/
(function () {
  'use strict';
  if (window.__fhRecorder) return;

  var SELF_SRC = (document.currentScript && document.currentScript.src) || '';
  var BASE = SELF_SRC.split('?')[0].split('#')[0].replace(/\/mods\/[^\/]+$/, '');
  var K_OP = 'fh:rec:op';
  var K_THEME = 'fh:rec:theme';
  var K_POS = 'fh:rec:pos';
  var MAX_SEC = 60 * 60;
  var MAX_BYTES = 100 * 1024 * 1024;

  var S = null;

  function read(k, d) {
    try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, v); } catch (e) {}
  }
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
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var p = function (n) { return ('0' + n).slice(-2); };
    return h ? (p(h) + ':' + p(m) + ':' + p(s)) : (p(m) + ':' + p(s));
  }
  function stamp() {
    var d = new Date(), p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
      p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }
  function pickMime() {
    var list = [
      'audio/webm;codecs=opus', 'audio/webm',
      'audio/mp4;codecs=mp4a.40.2', 'audio/mp4',
      'audio/ogg;codecs=opus', 'audio/ogg'
    ];
    for (var i = 0; i < list.length; i++) {
      try {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(list[i])) return list[i];
      } catch (e) {}
    }
    return '';
  }
  function mimeExt(m) {
    m = String(m || '');
    if (/mp4|m4a|aac/i.test(m)) return '.m4a';
    if (/ogg/i.test(m)) return '.ogg';
    return '.webm';
  }
  function css() {
    if (document.getElementById('__fhrecCss')) return;
    var st = document.createElement('style');
    st.id = '__fhrecCss';
    st.textContent = [
      '#__fhrec{position:fixed;z-index:2147483645;box-sizing:border-box;width:min(252px,calc(100vw - 20px));display:flex;flex-direction:column;',
      'border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 14px 40px rgba(0,0,0,.5);',
      'font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:var(--fg);user-select:none;-webkit-user-select:none}',
      '#__fhrec .r-bg{position:absolute;inset:0;background:var(--panel);opacity:var(--op,.94);pointer-events:none}',
      '#__fhrec .r-head{position:relative;z-index:2;display:flex;align-items:center;gap:2px;padding:7px 6px 5px 11px;cursor:move;touch-action:none}',
      '#__fhrec .r-title{flex:1;min-width:0;font:700 11.5px/1.2 inherit;letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#__fhrec .r-ico{width:25px;height:25px;flex-shrink:0;padding:0;border:0;border-radius:50%;background:transparent;',
      'color:var(--dim);font:13px/1 inherit;cursor:pointer;display:grid;place-items:center}',
      '#__fhrec .r-ico:active{background:var(--soft);color:var(--fg)}',
      '#__fhrec .r-body{position:relative;z-index:2;padding:0 11px 11px;display:flex;flex-direction:column;align-items:center;gap:6px}',
      '#__fhrec .r-time{font:300 26px/1.1 ui-monospace,Menlo,monospace;letter-spacing:1px;font-variant-numeric:tabular-nums;margin-top:1px}',
      '#__fhrec .r-meter{display:flex;align-items:flex-end;justify-content:center;gap:2px;height:18px;width:100%}',
      '#__fhrec .r-meter i{display:block;width:3px;height:2px;border-radius:2px;background:var(--red);opacity:.8;transition:height .08s linear}',
      '#__fhrec .r-stat{min-height:14px;max-width:100%;font:10.5px/1.4 inherit;color:var(--dim);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#__fhrec .r-ctrls{display:flex;align-items:center;justify-content:center;gap:12px;min-height:56px}',
      '#__fhrec .r-rec{width:54px;height:54px;padding:0;border:0;border-radius:50%;background:var(--red);color:#fff;font:24px/1 inherit;cursor:pointer;',
      'box-shadow:0 0 0 4px var(--ring),0 4px 14px rgba(0,0,0,.35);transition:transform .1s}',
      '#__fhrec .r-rec:active{transform:scale(.93)}',
      '#__fhrec .r-pause{width:34px;height:34px;padding:0;border:1px solid var(--line);border-radius:50%;background:var(--btnbg);color:var(--fg);font:15px/1 inherit;cursor:pointer}',
      '#__fhrec .r-pause[hidden]{display:none}',
      '#__fhrec .r-audio{display:none;width:100%;height:34px;margin:1px 0}',
      '#__fhrec .r-acts{display:none;width:100%;gap:5px}',
      '#__fhrec .r-acts button{flex:1;height:30px;padding:0 4px;border:1px solid var(--line);border-radius:8px;background:var(--btnbg);color:var(--fg);font:11px/1 inherit;cursor:pointer;white-space:nowrap}',
      '#__fhrec .r-acts button:disabled{opacity:.5;cursor:default}',
      '#__fhrec .r-pop{display:none;position:absolute;right:6px;top:34px;z-index:8;padding:8px 10px;border:1px solid var(--line);border-radius:10px;',
      'background:var(--pop);color:var(--fg);box-shadow:0 8px 24px rgba(0,0,0,.35);font:11px/1.3 inherit}',
      '#__fhrec .r-pop label{display:block;margin-bottom:5px;white-space:nowrap;color:var(--dim)}',
      '#__fhrec .r-pop input{width:132px;accent-color:#5b8dfa}',
      '#__fhrec.is-light{--fg:#1b1b22;--dim:#6a6a76;--line:rgba(0,0,0,.14);--soft:rgba(0,0,0,.07);',
      '--btnbg:rgba(0,0,0,.06);--ring:rgba(229,72,77,.16);--pop:#fff}',
      '#__fhrec{--fg:#f0f0f5;--dim:#9a9aa8;--line:rgba(255,255,255,.16);--soft:rgba(255,255,255,.08);',
      '--btnbg:rgba(255,255,255,.08);--red:#e5484d;--ring:rgba(229,72,77,.2);--pop:#202027;',
      '--panel:linear-gradient(180deg,rgba(34,34,42,.97),rgba(20,20,26,.98))}',
      '#__fhrec.is-light{--panel:linear-gradient(180deg,rgba(255,255,255,.99),rgba(242,242,247,.99))}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  function ensureAlbum(cb) {
    if (window.__fhAlbum) { cb(true); return; }
    if (window.__fhLoadMod) {
      try {
        window.__fhLoadMod('mods/album.js', null, function () { cb(!!window.__fhAlbum); }, true);
        return;
      } catch (e) {}
    }
    var sc = document.createElement('script');
    sc.src = (BASE || '') + '/mods/album.js?v=3.18';
    sc.onload = function () { cb(!!window.__fhAlbum); };
    sc.onerror = function () { cb(false); };
    document.head.appendChild(sc);
  }

  function open() {
    if (S) {
      try { S.root.style.display = 'flex'; } catch (e) {}
      return;
    }
    css();
    var theme = read(K_THEME, 'dark') === 'light' ? 'light' : 'dark';
    var op = Math.max(40, Math.min(100, parseInt(read(K_OP, '94'), 10) || 94));
    var pos = {};
    try { pos = JSON.parse(read(K_POS, '{}')) || {}; } catch (e) { pos = {}; }

    var s = S = {
      theme: theme, op: op, state: 'idle', root: null, stream: null, mr: null,
      chunks: [], bytes: 0, startedAt: 0, pausedAt: 0, pausedTotal: 0, endedAt: 0,
      finalDur: 0, blob: null, dur: 0, saved: false, albumId: null,
      audioUrl: '', timer: 0, raf: 0, actx: null, analyser: null, meterData: null
    };

    var root = s.root = el('div');
    root.id = '__fhrec';
    root.setAttribute('data-fh-skip', '1');
    root.style.left = (pos.left != null ? pos.left : 14) + 'px';
    // 手机屏窄，默认放左上，避免和右下角主面板叠在一起；桌面仍放左下。
    var defaultTop = window.innerWidth < 560 ? 76 : Math.max(8, window.innerHeight - 230);
    root.style.top = (pos.top != null ? pos.top : defaultTop) + 'px';

    var bg = el('div', 'r-bg');

    var head = el('div', 'r-head');
    var title = el('div', 'r-title', '🎙️ 录音机');
    var opBtn = el('button', 'r-ico', '◐');
    opBtn.title = '背景透明度';
    var themeBtn = el('button', 'r-ico', '🌓');
    themeBtn.title = '黑白背景';
    var closeBtn = el('button', 'r-ico', '✕');
    closeBtn.title = '关闭';
    head.append(title, opBtn, themeBtn, closeBtn);

    var body = el('div', 'r-body');
    var time = el('div', 'r-time', '00:00');
    var meter = el('div', 'r-meter');
    var bars = [];
    for (var i = 0; i < 14; i++) {
      var bar = el('i');
      bars.push(bar);
      meter.append(bar);
    }
    var stat = el('div', 'r-stat', '点红色按钮开始录音');
    var audio = document.createElement('audio');
    audio.className = 'r-audio';
    audio.controls = true;
    audio.preload = 'metadata';

    var ctrls = el('div', 'r-ctrls');
    var recBtn = el('button', 'r-rec', '●');
    recBtn.title = '开始录音';
    var pauseBtn = el('button', 'r-pause', '⏸');
    pauseBtn.title = '暂停';
    pauseBtn.hidden = true;
    ctrls.append(recBtn, pauseBtn);

    var acts = el('div', 'r-acts');
    var againBtn = el('button', '', '重录');
    var dlBtn = el('button', '', '下载');
    var saveBtn = el('button', '', '存相册');
    acts.append(againBtn, dlBtn, saveBtn);

    body.append(time, meter, stat, audio, ctrls, acts);

    var pop = el('div', 'r-pop');
    var opLab = el('label', '', '背景透明度 ' + s.op + '%');
    var opRange = document.createElement('input');
    opRange.type = 'range';
    opRange.min = '40'; opRange.max = '100'; opRange.step = '1'; opRange.value = String(s.op);
    pop.append(opLab, opRange);

    root.append(bg, head, body, pop);
    document.body.append(root);
    clampPos();

    function applyTheme() {
      root.classList.toggle('is-light', s.theme === 'light');
      root.style.setProperty('--op', String(s.op / 100));
      themeBtn.textContent = s.theme === 'light' ? '🌙' : '☀️';
      themeBtn.title = s.theme === 'light' ? '切换黑底' : '切换白底';
    }
    function setStatus(txt, bad) {
      stat.textContent = txt || '';
      stat.style.color = bad ? '#ff9d95' : '';
    }
    function clampPos() {
      var r = root.getBoundingClientRect();
      var maxL = Math.max(4, window.innerWidth - r.width - 4);
      var maxT = Math.max(4, window.innerHeight - r.height - 4);
      var l = Math.max(4, Math.min(maxL, parseInt(root.style.left, 10) || 4));
      var t = Math.max(4, Math.min(maxT, parseInt(root.style.top, 10) || 4));
      root.style.left = l + 'px';
      root.style.top = t + 'px';
    }
    function savePos() {
      try { write(K_POS, JSON.stringify({ left: parseInt(root.style.left, 10) || 0, top: parseInt(root.style.top, 10) || 0 })); } catch (e) {}
    }
    function elapsedMs() {
      if (!s.startedAt) return 0;
      var end = s.state === 'recording' ? Date.now() : (s.endedAt || Date.now());
      var paused = s.state === 'paused' && s.pausedAt ? (Date.now() - s.pausedAt) : 0;
      return Math.max(0, end - s.startedAt - s.pausedTotal - paused);
    }
    function stopTimer() {
      if (s.timer) { clearInterval(s.timer); s.timer = 0; }
    }
    function stopMeter() {
      if (s.raf) { try { cancelAnimationFrame(s.raf); } catch (e) {} s.raf = 0; }
      if (s.actx) { try { s.actx.close(); } catch (e) {} s.actx = null; }
      s.analyser = null;
      s.meterData = null;
      bars.forEach(function (b) { b.style.height = '2px'; });
    }
    function stopTracks() {
      if (s.stream) {
        try { s.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        s.stream = null;
      }
    }
    function revokeAudio() {
      if (s.audioUrl) { try { URL.revokeObjectURL(s.audioUrl); } catch (e) {} s.audioUrl = ''; }
      try { audio.pause(); } catch (e) {}
      audio.removeAttribute('src');
      audio.style.display = 'none';
    }
    function startMeter(stream) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || !stream) return;
      try {
        s.actx = new AC();
        var src = s.actx.createMediaStreamSource(stream);
        s.analyser = s.actx.createAnalyser();
        s.analyser.fftSize = 256;
        src.connect(s.analyser);
        s.meterData = new Uint8Array(s.analyser.frequencyBinCount);
        var draw = function () {
          if (!S || S !== s || !s.analyser) return;
          s.analyser.getByteFrequencyData(s.meterData);
          var n = bars.length;
          for (var j = 0; j < n; j++) {
            var idx = Math.floor((j / n) * s.meterData.length * 0.7);
            var v = s.meterData[idx] / 255;
            bars[j].style.height = Math.max(2, Math.round(v * 16)) + 'px';
          }
          s.raf = requestAnimationFrame(draw);
        };
        draw();
      } catch (e) {
        stopMeter();
      }
    }
    function render() {
      var rec = s.state === 'recording';
      var paused = s.state === 'paused';
      var stopped = s.state === 'stopped';
      root.classList.toggle('is-rec', rec);
      root.classList.toggle('is-paused', paused);
      recBtn.hidden = stopped;
      pauseBtn.hidden = !(rec || paused);
      pauseBtn.textContent = paused ? '▶' : '⏸';
      pauseBtn.title = paused ? '继续' : '暂停';
      if (rec || paused) {
        recBtn.textContent = '■';
        recBtn.title = '停止录音';
        recBtn.style.background = '#e5484d';
        recBtn.style.color = '#fff';
      } else {
        recBtn.textContent = '●';
        recBtn.title = '开始录音';
        recBtn.style.background = '';
        recBtn.style.color = '';
      }
      audio.style.display = stopped ? 'block' : 'none';
      acts.style.display = stopped ? 'flex' : 'none';
      saveBtn.textContent = s.saved ? '已存' : '存相册';
      saveBtn.disabled = !!s.saved;
      if (stopped) time.textContent = fmtTime(s.dur);
      // 停止后多出播放器和操作按钮，窗口会变高；重新夹回视口内，避免按钮被底部裁掉
      if (root.isConnected) clampPos();
    }
    function reset() {
      stopTimer();
      stopMeter();
      stopTracks();
      revokeAudio();
      s.chunks = [];
      s.bytes = 0;
      s.startedAt = 0;
      s.pausedAt = 0;
      s.pausedTotal = 0;
      s.endedAt = 0;
      s.finalDur = 0;
      s.blob = null;
      s.dur = 0;
      s.saved = false;
      s.albumId = null;
      s.stopping = false;
      s.closeAfterFinish = false;
      s.state = 'idle';
      time.textContent = '00:00';
      setStatus('点红色按钮开始录音');
      render();
    }
    function setPlayback(blob) {
      revokeAudio();
      try {
        s.audioUrl = URL.createObjectURL(blob);
        audio.src = s.audioUrl;
      } catch (e) {}
    }
    function saveToAlbum() {
      if (!s.blob || s.saved) return;
      var blob = s.blob, dur = s.dur;
      var rec = {
        name: 'rec-' + stamp() + mimeExt(blob.type),
        kind: 'voice', type: blob.type, size: blob.size, dur: dur, source: 'recorder'
      };
      setStatus('正在存相册…');
      // 保存动作不依赖窗口还开着：用户停止后立刻关窗，也要把录音落进相册。
      ensureAlbum(function (ok) {
        if (!ok || !window.__fhAlbum) {
          if (S && S === s) setStatus('已录好，但相册模块加载失败；可下载保存', true);
          return;
        }
        window.__fhAlbum.save(blob, rec).then(function (id) {
          if (!S || S !== s) return;
          s.saved = true;
          s.albumId = id;
          setStatus('已存相册 · ' + fmtSize(blob.size));
          render();
        }).catch(function (e) {
          if (!S || S !== s) return;
          setStatus('存相册失败：' + (e && e.message ? e.message : e) + '；可下载保存', true);
        });
      });
    }
    function finish() {
      stopTimer();
      stopMeter();
      stopTracks();
      s.stopping = false;
      var type = (s.chunks[0] && s.chunks[0].type) || s.mime || 'audio/webm';
      var blob = new Blob(s.chunks, { type: type });
      s.chunks = [];
      s.mr = null;
      s.dur = Math.max(1, Math.round(s.finalDur || elapsedMs() / 1000));
      if (!blob.size) {
        s.state = 'idle';
        setStatus('这段没录到内容，请重试', true);
        render();
        if (s.closeAfterFinish) close(true);
        return;
      }
      s.blob = blob;
      s.state = 'stopped';
      time.textContent = fmtTime(s.dur);
      setPlayback(blob);
      render();
      setStatus('录音完成 · ' + fmtTime(s.dur) + ' · ' + fmtSize(blob.size));
      saveToAlbum();
      if (s.closeAfterFinish) close(true);
    }
    function stop() {
      if (!s.mr || (s.mr.state !== 'recording' && s.mr.state !== 'paused')) return;
      s.finalDur = elapsedMs() / 1000;
      s.endedAt = Date.now();
      // 已经按下停止、但 onstop 还没回来；这时关窗要等 finish 把 blob 收完
      s.stopping = true;
      try { s.mr.stop(); } catch (e) { s.stopping = false; }
    }
    function pause() {
      if (!s.mr || s.mr.state !== 'recording') return;
      try { s.mr.pause(); } catch (e) { return; }
      s.pausedAt = Date.now();
      s.state = 'paused';
      setStatus('已暂停');
      render();
    }
    function resume() {
      if (!s.mr || s.mr.state !== 'paused') return;
      s.pausedTotal += Date.now() - s.pausedAt;
      s.pausedAt = 0;
      try { s.mr.resume(); } catch (e) { return; }
      s.state = 'recording';
      setStatus('录音中…');
      render();
    }
    function start() {
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
        setStatus('当前浏览器不支持录音', true);
        return;
      }
      if (!window.MediaRecorder) {
        setStatus('当前浏览器不支持 MediaRecorder', true);
        return;
      }
      reset();
      setStatus('正在打开麦克风…');
      recBtn.disabled = true;
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      }).then(function (stream) {
        if (!S || S !== s) {
          try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
          return;
        }
        s.stream = stream;
        var mime = pickMime();
        var mr;
        try {
          mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        } catch (e) {
          stopTracks();
          setStatus('录音初始化失败：' + (e && e.message ? e.message : e), true);
          recBtn.disabled = false;
          return;
        }
        s.mr = mr;
        s.mime = mime || 'audio/webm';
        s.chunks = [];
        s.bytes = 0;
        s.startedAt = Date.now();
        s.pausedAt = 0;
        s.pausedTotal = 0;
        s.endedAt = 0;
        s.finalDur = 0;
        s.state = 'recording';
        s.saved = false;
        s.blob = null;
        mr.ondataavailable = function (ev) {
          if (ev.data && ev.data.size) {
            s.chunks.push(ev.data);
            s.bytes += ev.data.size;
            if (s.state === 'recording') {
              setStatus('录音中 · ' + fmtTime(elapsedMs() / 1000) + ' · ' + fmtSize(s.bytes));
            }
            if (s.bytes >= MAX_BYTES) {
              setStatus('已到 100MB 上限，自动停止', true);
              stop();
            }
          }
        };
        mr.onstop = function () { finish(); };
        mr.onerror = function (e) {
          setStatus('录音出错：' + (e && e.error ? e.error : '未知错误'), true);
          s.state = 'idle';
          stopTracks();
          stopMeter();
          stopTimer();
          render();
        };
        try { mr.start(500); } catch (e) {
          s.mr = null;
          stopTracks();
          setStatus('录音启动失败：' + (e && e.message ? e.message : e), true);
          recBtn.disabled = false;
          return;
        }
        recBtn.disabled = false;
        startMeter(stream);
        setStatus('录音中…');
        render();
        stopTimer();
        s.timer = setInterval(function () {
          if (!S || S !== s) return;
          if (s.state === 'recording') {
            time.textContent = fmtTime(elapsedMs() / 1000);
            if (elapsedMs() / 1000 >= MAX_SEC) {
              setStatus('已到 60 分钟上限，自动停止', true);
              stop();
            }
          }
        }, 200);
      }).catch(function (e) {
        if (!S || S !== s) return;
        recBtn.disabled = false;
        var n = e && e.name ? e.name : '';
        setStatus(n === 'NotAllowedError' ? '麦克风权限被拒绝：允许后重试' :
          n === 'NotFoundError' ? '没有找到可用麦克风' :
          n === 'NotReadableError' ? '麦克风被其它程序占用' :
          ('无法打开麦克风：' + (n || (e && e.message) || '未知错误')), true);
        s.state = 'idle';
        render();
      });
    }

    applyTheme();
    render();
    setTimeout(clampPos, 0);

    opBtn.onclick = function () {
      pop.style.display = pop.style.display === 'block' ? 'none' : 'block';
    };
    opRange.oninput = function () {
      s.op = Math.max(40, Math.min(100, parseInt(opRange.value, 10) || 94));
      root.style.setProperty('--op', String(s.op / 100));
      opLab.textContent = '背景透明度 ' + s.op + '%';
      write(K_OP, String(s.op));
    };
    themeBtn.onclick = function () {
      s.theme = s.theme === 'light' ? 'dark' : 'light';
      write(K_THEME, s.theme);
      applyTheme();
    };
    // close() 内部已经会确认录音中关窗，这里不要再弹一次
    closeBtn.onclick = function () { close(); };
    recBtn.onclick = function () {
      if (s.state === 'recording' || s.state === 'paused') stop();
      else start();
    };
    pauseBtn.onclick = function () {
      if (s.state === 'recording') pause();
      else if (s.state === 'paused') resume();
    };
    againBtn.onclick = function () { start(); };
    dlBtn.onclick = function () {
      if (!s.blob) return;
      try {
        var u = URL.createObjectURL(s.blob);
        var a = document.createElement('a');
        a.href = u;
        a.download = 'rec-' + stamp() + mimeExt(s.blob.type);
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(function () { try { URL.revokeObjectURL(u); } catch (e) {} }, 4000);
      } catch (e) {
        setStatus('下载失败：' + (e && e.message ? e.message : e), true);
      }
    };
    saveBtn.onclick = function () { saveToAlbum(); };

    // 拖动标题栏；按钮上不触发
    head.addEventListener('pointerdown', function (e) {
      if (e.target && e.target.tagName === 'BUTTON') return;
      var sx = e.clientX, sy = e.clientY;
      var ol = parseInt(root.style.left, 10) || 0, ot = parseInt(root.style.top, 10) || 0;
      try { head.setPointerCapture(e.pointerId); } catch (e2) {}
      function move(ev) {
        var l = Math.max(4, Math.min(window.innerWidth - root.offsetWidth - 4, ol + ev.clientX - sx));
        var t = Math.max(4, Math.min(window.innerHeight - root.offsetHeight - 4, ot + ev.clientY - sy));
        root.style.left = l + 'px';
        root.style.top = t + 'px';
      }
      function up() {
        try { head.releasePointerCapture(e.pointerId); } catch (e2) {}
        head.removeEventListener('pointermove', move);
        head.removeEventListener('pointerup', up);
        head.removeEventListener('pointercancel', up);
        savePos();
      }
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', up);
      head.addEventListener('pointercancel', up);
      e.preventDefault();
    });
    window.addEventListener('resize', function () { if (S && S === s) clampPos(); });
  }

  function close(force) {
    if (!S) return;
    var s = S;
    // 已按停止但 MediaRecorder 还没回调：等 finish 收完 blob 再关，避免丢录音
    if (!force && s.stopping) {
      s.closeAfterFinish = true;
      try {
        var st = s.root && s.root.querySelector('.r-stat');
        if (st) st.textContent = '正在保存录音…';
      } catch (e) {}
      return;
    }
    if (!force && (s.state === 'recording' || s.state === 'paused')) {
      try { if (!confirm('正在录音，关闭会丢弃这段录音，确定关闭？')) return; } catch (e) {}
    }
    S = null;
    if (s.mr) {
      try { s.mr.onstop = null; if (s.mr.state !== 'inactive') s.mr.stop(); } catch (e) {}
      s.mr = null;
    }
    if (s.timer) { clearInterval(s.timer); s.timer = 0; }
    if (s.raf) { try { cancelAnimationFrame(s.raf); } catch (e) {} }
    if (s.actx) { try { s.actx.close(); } catch (e) {} }
    if (s.stream) { try { s.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
    if (s.audioUrl) { try { URL.revokeObjectURL(s.audioUrl); } catch (e) {} }
    try { s.root.remove(); } catch (e) {}
  }

  window.__fhRecorder = {
    open: open,
    close: close,
    isOpen: function () { return !!S; }
  };
})();
