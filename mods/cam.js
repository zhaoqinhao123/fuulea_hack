/* 网页相机 v3.13 — 聊天室 / 媒体库共用（拍照 + 录像 + 麦克风 + 分辨率选择）
   用法：
     window.__fhCam.open({
       title: '拍照',
       mode: 'both' | 'photo' | 'video',   // 默认 both
       facing: 'environment' | 'user',
       onPhoto: function (blob, info) {},  // info = {name, width, height, size}
       onVideo: function (blob, info) {},  // info = {name, mime, size, dur}
       onClose: function () {}
     });
   分辨率存在 localStorage: fh:cam:res（长边像素，默认 2560）
*/
(function () {
  'use strict';
  if (window.__fhCam) return;

  var K_RES = 'fh:cam:res';
  var RES_OPTS = [
    { v: 3840, l: '4K' },
    { v: 2560, l: '2K' },
    { v: 1920, l: '1080P' },
    { v: 1280, l: '720P' }
  ];
  var MAX_VIDEO = 25 * 1024 * 1024;
  var MAX_SEC = 60;
  var V_BPS = 2800000;

  function readRes() {
    var v = 0;
    try { v = parseInt(localStorage.getItem(K_RES) || '', 10); } catch (e) {}
    if (!v) v = 2560;
    for (var i = 0; i < RES_OPTS.length; i++) if (RES_OPTS[i].v === v) return v;
    return 2560;
  }
  function writeRes(v) {
    v = parseInt(v, 10) || 2560;
    try { localStorage.setItem(K_RES, String(v)); } catch (e) {}
  }
  function resLabel(v) {
    for (var i = 0; i < RES_OPTS.length; i++) if (RES_OPTS[i].v === v) return RES_OPTS[i].l;
    return '2K';
  }
  function bytes(n) {
    n = Number(n) || 0;
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return (n / 1024).toFixed(0) + ' KB';
    return n + ' B';
  }
  function mmss(s) {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }
  function stamp() {
    var d = new Date(), p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }
  // v3.13 修「录完看不了」：MP4 只做兜底。
  // Chrome 的 MediaRecorder 输出的是 fragmented MP4（moof 分片），再叠加分片录制（start(500)）
  // 拼 Blob，很容易得到 moov 不完整的文件 —— 本机 <video>、下载后的播放器、后台都解不了。
  // WebM(VP8/Opus) 才是稳的容器；只有浏览器完全不支持 WebM 时才退回 MP4（Safari）。
  function pickVideoMime() {
    var list = [
      'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm',
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'
    ];
    for (var i = 0; i < list.length; i++) {
      try { if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(list[i])) return list[i]; } catch (e) {}
    }
    return '';
  }
  // 录完先自检：blob 连元数据都读不出来 = 文件是坏的，别传上去（以前就是这么把坏文件发出去的）
  function checkPlayable(blob, cb) {
    var u = '';
    try { u = URL.createObjectURL(blob); } catch (e) { cb(false); return; }
    var done = false, vd = document.createElement('video');
    vd.muted = true;
    vd.preload = 'metadata';
    function finish(ok) {
      if (done) return;
      done = true;
      try { vd.removeAttribute('src'); vd.load(); } catch (e) {}
      try { URL.revokeObjectURL(u); } catch (e) {}
      cb(ok);
    }
    vd.onloadedmetadata = function () { finish(true); };
    vd.onloadeddata = function () { finish(true); };
    vd.onerror = function () { finish(false); };
    setTimeout(function () { finish(false); }, 6000);
    try { vd.src = u; } catch (e) { finish(false); }
  }

  var S = null;   // 当前实例状态

  function el(tag, css, txt) {
    var d = document.createElement(tag);
    if (css) d.style.cssText = css;
    if (txt != null) d.textContent = txt;
    return d;
  }

  function close() {
    var s = S;
    if (!s) return;
    S = null;
    s.dead = true;
    if (s.timer) { clearInterval(s.timer); s.timer = 0; }
    try { if (s.recorder && s.recorder.state === 'recording') s.recorder.stop(); } catch (e) {}
    s.recorder = null;
    stopStream(s);
    if (s.mic) { try { s.mic.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} s.mic = null; }
    try { s.root.remove(); } catch (e) {}
    try { if (s.opts && s.opts.onClose) s.opts.onClose(); } catch (e2) {}
  }

  function stopStream(s) {
    if (s.stream) {
      try { s.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      s.stream = null;
    }
    s.track = null;
    if (s.v) { try { s.v.srcObject = null; } catch (e) {} }
  }

  function toast(s, text, bad) {
    if (!s || !s.toastEl) return;
    s.toastEl.textContent = text;
    s.toastEl.style.color = bad ? '#ffb4a8' : '#fff';
    s.toastEl.style.opacity = '1';
    clearTimeout(s.toastT);
    s.toastT = setTimeout(function () { if (s) s.toastEl.style.opacity = '0'; }, 2200);
  }

  function open(opts) {
    opts = opts || {};
    if (S) close();
    var s = S = {
      opts: opts, mode: opts.mode === 'photo' || opts.mode === 'video' ? opts.mode : 'both',
      facing: opts.facing === 'user' ? 'user' : 'environment',
      res: readRes(), zoom: 1, dead: false,
      stream: null, track: null, recorder: null, chunks: [], mic: null,
      recBytes: 0, recStart: 0, timer: 0, lastPhotoAt: 0
    };

    var root = s.root = el('div', 'position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;flex-direction:column;' +
      'font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;overflow:hidden;touch-action:none');
    root.setAttribute('data-fh-skip', '1');
    root.id = '__fhcam';

    // 顶栏：分辨率 / 标题 / 关闭
    var top = el('div', 'position:relative;z-index:6;display:flex;align-items:center;gap:10px;' +
      'padding:10px 12px;background:linear-gradient(rgba(0,0,0,.72),transparent);flex-shrink:0');
    var resSel = document.createElement('select');
    resSel.title = '拍照分辨率';
    resSel.style.cssText = 'flex-shrink:0;height:30px;padding:0 6px;border:1px solid rgba(255,255,255,.22);' +
      'border-radius:8px;background:rgba(0,0,0,.45);color:#e8e8ee;font:12px/1 inherit;outline:none';
    RES_OPTS.forEach(function (o) {
      var op = document.createElement('option');
      op.value = String(o.v);
      op.textContent = o.l + ' · ' + o.v + 'px';
      op.style.background = '#111';
      resSel.append(op);
    });
    resSel.value = String(s.res);
    var tt = el('div', String(opts.title || '相机'),
      'flex:1;min-width:0;text-align:center;color:#dcdce6;font:13px/1.2 inherit;white-space:nowrap;' +
      'overflow:hidden;text-overflow:ellipsis;padding:0 4px');
    var xBtn = el('button', 'width:34px;height:34px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.14);' +
      'color:#fff;font:17px/1 inherit;cursor:pointer;flex-shrink:0', '✕');
    xBtn.title = '关闭';
    top.append(resSel, tt, xBtn);

    var v = s.v = document.createElement('video');
    v.autoplay = true;
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.style.cssText = 'flex:1;min-height:0;width:100%;background:#000;object-fit:contain;' +
      'transition:transform .12s;transform-origin:center center';

    var toastEl = s.toastEl = el('div', 'position:absolute;left:50%;top:64px;transform:translateX(-50%);z-index:8;' +
      'max-width:82%;padding:8px 13px;border-radius:999px;background:rgba(0,0,0,.66);color:#fff;' +
      'font:12px/1.4 inherit;text-align:center;opacity:0;transition:opacity .2s;pointer-events:none;backdrop-filter:blur(6px)');

    // 变焦条
    var zWrap = s.zWrap = el('div', 'position:absolute;left:50%;bottom:116px;transform:translateX(-50%);z-index:6;' +
      'display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:rgba(0,0,0,.5);' +
      'color:#fff;backdrop-filter:blur(6px);font:12px/1 inherit');
    var zOut = el('button', 'width:28px;height:28px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.14);' +
      'color:#fff;font:17px/1 inherit;cursor:pointer', '−');
    zOut.title = '缩小';
    var zRange = el('input', 'width:104px;accent-color:#5b8dfa');
    zRange.type = 'range';
    zRange.min = '1'; zRange.max = '4'; zRange.step = '0.1'; zRange.value = '1';
    zRange.title = '变焦';
    var zLab = el('span', 'min-width:38px;text-align:center;font-variant-numeric:tabular-nums', '1.0×');
    var zIn = el('button', 'width:28px;height:28px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.14);' +
      'color:#fff;font:17px/1 inherit;cursor:pointer', '+');
    zIn.title = '放大';
    zWrap.append(zOut, zRange, zLab, zIn);

    // 底栏：左翻转，右录像 + 快门
    var bar = s.bar = el('div', 'position:relative;z-index:6;display:flex;align-items:center;justify-content:flex-end;' +
      'gap:20px;padding:14px 20px calc(22px + env(safe-area-inset-bottom,0px));' +
      'background:linear-gradient(transparent,rgba(0,0,0,.8));flex-shrink:0');
    var flip = s.flip = el('button', 'margin-right:auto;width:52px;height:52px;padding:0;border:1px solid rgba(255,255,255,.26);' +
      'border-radius:50%;background:rgba(28,28,34,.66);color:#fff;font:20px/1 inherit;cursor:pointer;flex:0 0 auto', '🔄');
    flip.title = '前后摄像头';
    var recLabel = el('div', 'position:absolute;right:20px;bottom:calc(104px + env(safe-area-inset-bottom,0px));' +
      'z-index:7;padding:4px 10px;border-radius:999px;background:rgba(210,60,60,.82);color:#fff;' +
      'font:11px/1.5 ui-monospace,monospace;display:none;white-space:nowrap', '● 0:00 / 0.0 MB');
    var rec = s.rec = el('button', 'min-width:64px;height:52px;padding:0 14px;border:1px solid rgba(255,255,255,.26);' +
      'border-radius:999px;background:rgba(28,28,34,.66);color:#fff;font:13px/1 inherit;cursor:pointer;flex:0 0 auto', '🎥');
    rec.title = '录像（带麦克风）';
    var shot = s.shot = el('button', 'width:76px;height:76px;padding:0;border:4px solid rgba(255,255,255,.88);' +
      'border-radius:50%;background:#fff;color:#111;font:700 14px/1 inherit;cursor:pointer;flex:0 0 auto;' +
      'box-shadow:0 0 0 4px rgba(0,0,0,.28),0 6px 20px rgba(0,0,0,.5);transition:transform .12s', '');
    shot.title = '拍照';
    shot.setAttribute('aria-label', '拍照');
    shot.onpointerdown = function () { shot.style.transform = 'scale(.92)'; };
    shot.onpointerup = function () { shot.style.transform = ''; };
    shot.onpointercancel = function () { shot.style.transform = ''; };
    if (s.mode === 'video') shot.style.display = 'none';
    if (s.mode === 'photo') rec.style.display = 'none';

    bar.append(flip, rec, shot);

    var failBox = s.failBox = el('div', 'position:absolute;inset:0;z-index:9;display:none;place-items:center;' +
      'padding:28px;text-align:center;color:#c9c9d2;font:13px/1.9 inherit;white-space:pre-wrap;background:#000');

    root.append(top, v, toastEl, zWrap, recLabel, bar, failBox);
    document.body.append(root);

    // ── 打开摄像头 ──
    function constraints() {
      var r = s.res;
      var h = Math.round(r * 9 / 16);
      return {
        video: {
          facingMode: { ideal: s.facing },
          width: { ideal: r }, height: { ideal: h },
          frameRate: { ideal: 30 }
        },
        audio: false
      };
    }

    function fail(text) {
      s.dead = true;
      stopStream(s);
      s.bar.style.display = 'none';
      s.zWrap.style.display = 'none';
      s.failBox.style.display = 'grid';
      s.failBox.textContent = text;
    }

    function startStream() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        fail('这个浏览器不支持网页相机\n（file:// 或非 https 页面常见）');
        return;
      }
      stopStream(s);
      navigator.mediaDevices.getUserMedia(constraints()).then(function (st) {
        if (s.dead) { try { st.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} return; }
        s.stream = st;
        s.track = st.getVideoTracks ? (st.getVideoTracks()[0] || null) : null;
        v.srcObject = st;
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
        applyZoom(s.zoom);
      }).catch(function (e) {
        var n = e && e.name ? e.name : '';
        var why = n === 'NotAllowedError' ? '摄像头权限被拒绝：点地址栏 🔒 允许摄像头后重试'
          : n === 'NotFoundError' ? '没有找到可用摄像头'
          : n === 'NotReadableError' ? '摄像头被其它程序占用（先关掉其它拍照/会议软件）'
          : n === 'OverconstrainedError' ? '这个分辨率摄像头不支持，换低一档再试'
          : ('无法打开相机：' + (n || (e && e.message) || '未知错误'));
        fail(why);
      });
    }

    function applyZoom(z) {
      s.zoom = Math.max(1, Math.min(4, Number(z) || 1));
      zLab.textContent = s.zoom.toFixed(1) + '×';
      zRange.value = String(s.zoom);
      v.style.transform = s.zoom > 1.001 ? 'scale(' + s.zoom + ')' : '';
    }
    zOut.onclick = function () { applyZoom(s.zoom - 0.2); };
    zIn.onclick = function () { applyZoom(s.zoom + 0.2); };
    zRange.oninput = function () { applyZoom(parseFloat(zRange.value)); };

    resSel.onchange = function () {
      s.res = parseInt(resSel.value, 10) || 2560;
      writeRes(s.res);
      toast(s, '分辨率：' + resLabel(s.res) + '（' + s.res + 'px）');
      if (!s.recorder) startStream();
    };

    flip.onclick = function () {
      if (s.recorder) { toast(s, '录像中不能切换摄像头', true); return; }
      s.facing = s.facing === 'environment' ? 'user' : 'environment';
      startStream();
    };

    xBtn.onclick = function () {
      if (s.recorder) {
        try { if (!confirm('正在录像，关闭会丢弃这段录像，确定关闭？')) return; } catch (e) {}
      }
      close();
    };

    // ── 拍照 ──
    shot.onclick = function () {
      if (!s.stream || !v.videoWidth || !v.videoHeight) { toast(s, '相机还没准备好', true); return; }
      if (Date.now() - s.lastPhotoAt < 700) return;
      s.lastPhotoAt = Date.now();
      shot.style.transform = 'scale(.9)';
      setTimeout(function () { shot.style.transform = ''; }, 140);

      var zw = Math.max(1, s.zoom);
      var sw = v.videoWidth / zw, sh = v.videoHeight / zw;
      var sx = (v.videoWidth - sw) / 2, sy = (v.videoHeight - sh) / 2;
      var scale = Math.min(1, s.res / Math.max(sw, sh));
      var cw = Math.max(1, Math.round(sw * scale)), ch = Math.max(1, Math.round(sh * scale));
      var c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      try { c.getContext('2d').drawImage(v, sx, sy, sw, sh, 0, 0, cw, ch); }
      catch (e) { toast(s, '拍照失败：' + (e && e.message ? e.message : e), true); return; }
      c.toBlob(function (b) {
        if (!b) { toast(s, '拍照失败（没有图像数据）', true); return; }
        var name = 'cam-' + stamp() + '.jpg';
        toast(s, '已拍 ' + cw + '×' + ch + ' · ' + bytes(b.size));
        try { if (s.opts.onPhoto) s.opts.onPhoto(b, { name: name, width: cw, height: ch, size: b.size, mime: 'image/jpeg' }); }
        catch (e) { toast(s, '处理照片出错：' + (e && e.message ? e.message : e), true); }
      }, 'image/jpeg', 0.92);
    };

    // ── 录像 ──
    rec.onclick = function () {
      if (s.recorder && s.recorder.state === 'recording') { stopRec(); return; }
      if (!s.stream) { toast(s, '相机还没准备好', true); return; }
      if (typeof MediaRecorder === 'undefined') { toast(s, '这个浏览器不支持录像', true); return; }
      startRec();
    };

    function startRec() {
      s.chunks = [];
      s.recBytes = 0;
      s.recStart = Date.now();
      rec.textContent = '…';
      rec.disabled = true;

      var micP = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        ? navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
          .catch(function () { return null; })
        : Promise.resolve(null);

      micP.then(function (mic) {
        if (s.dead) { if (mic) mic.getTracks().forEach(function (t) { t.stop(); }); return; }
        s.mic = mic || null;
        var tracks = s.stream.getVideoTracks().slice(0);
        if (s.mic) tracks = tracks.concat(s.mic.getAudioTracks());
        var mixed = new MediaStream(tracks);
        var mime = pickVideoMime();
        var isMp4 = /mp4/.test(mime);
        try {
          s.recorder = new MediaRecorder(mixed, mime ? {
            mimeType: mime, videoBitsPerSecond: V_BPS, audioBitsPerSecond: 96000
          } : { videoBitsPerSecond: V_BPS, audioBitsPerSecond: 96000 });
        } catch (e) {
          s.recorder = null;
          rec.disabled = false;
          rec.textContent = '🎥';
          if (s.mic) { try { s.mic.getTracks().forEach(function (t) { t.stop(); }); } catch (e2) {} s.mic = null; }
          toast(s, '录像初始化失败：' + (e && e.message ? e.message : e), true);
          return;
        }
        s.mime = mime || 'video/webm';
        s.recorder.ondataavailable = function (ev) {
          if (ev.data && ev.data.size) { s.chunks.push(ev.data); s.recBytes += ev.data.size; }
          if (s.recBytes > MAX_VIDEO && s.recorder && s.recorder.state === 'recording') {
            toast(s, '已到 25MB 上限，自动停止', true);
            stopRec();
          }
        };
        s.recorder.onstop = function () {
          var type = (s.chunks[0] && s.chunks[0].type) || s.mime || 'video/webm';
          var b = new Blob(s.chunks, { type: type });
          var dur = Math.round((Date.now() - s.recStart) / 1000);
          s.chunks = [];
          rec.disabled = false;
          rec.textContent = '🎥';
          rec.style.background = 'rgba(28,28,34,.66)';
          recLabel.style.display = 'none';
          if (s.timer) { clearInterval(s.timer); s.timer = 0; }
          if (s.mic) { try { s.mic.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} s.mic = null; }
          if (s.dead || !b.size) {
            if (!s.dead && !b.size) toast(s, '这段没录到内容', true);
            return;
          }
          var mp4 = /mp4/.test(type);
          var name = 'rec-' + stamp() + (mp4 ? '.mp4' : '.webm');
          toast(s, '正在检查录像…');
          // v3.13：坏文件不发送（先本地解一次，能读出元数据再传）
          checkPlayable(b, function (ok) {
            if (!ok) {
              toast(s, '这段录像编码异常（本机都解不了），已取消发送，请重录或换 720P 再试', true);
              return;
            }
            toast(s, '录像完成 ' + mmss(dur) + ' · ' + bytes(b.size));
            try { if (s.opts.onVideo) s.opts.onVideo(b, { name: name, mime: type, size: b.size, dur: dur }); }
            catch (e) { toast(s, '处理录像出错：' + (e && e.message ? e.message : e), true); }
          });
        };
        // v3.13：MP4 不分片（分片拼接正是坏文件的主因）；WebM 分片没问题，顺便看体积
        try { isMp4 ? s.recorder.start() : s.recorder.start(500); }
        catch (e) {
          s.recorder = null;
          rec.disabled = false;
          rec.textContent = '🎥';
          toast(s, '录像启动失败：' + (e && e.message ? e.message : e), true);
          return;
        }
        rec.disabled = false;
        rec.textContent = '⏹ 停止';
        rec.style.background = 'rgba(150,40,40,.9)';
        shot.disabled = true;
        shot.style.opacity = '.45';
        recLabel.style.display = 'block';
        if (!s.mic) toast(s, '麦克风不可用，将无声录制', true);
        s.timer = setInterval(function () {
          if (!s.recorder || s.recorder.state !== 'recording') return;
          recLabel.textContent = '● ' + mmss((Date.now() - s.recStart) / 1000) + ' / ' + bytes(s.recBytes);
        }, 500);
      });
    }

    function stopRec() {
      shot.disabled = false;
      shot.style.opacity = '';
      try { if (s.recorder && s.recorder.state === 'recording') s.recorder.stop(); } catch (e) {}
    }

    startStream();
    applyZoom(1);
    return { close: close };
  }

  window.__fhCam = {
    open: open,
    close: close,
    isOpen: function () { return !!S; },
    res: readRes,
    resLabel: resLabel,
    setRes: writeRes,
    RES: RES_OPTS
  };
})();
