/* 网页相机 v3.17 — 聊天室 / 媒体库共用（拍照 + 录像 + 麦克风 + 比例/分辨率选择）
   用法：
     window.__fhCam.open({
       title: '拍照',
       mode: 'both' | 'photo' | 'video',   // 默认 both
       facing: 'environment' | 'user',
       preview: true,                       // 拍完/录完先预览；聊天室用 true
       onPhoto: function (blob, info) {},   // info = {name, width, height, size, kind}
       onVideo: function (blob, info) {},   // info = {name, mime, size, dur, kind}
       onClose: function () {}
     });
   拍到的照片 / 视频会自动存进本机相册（window.__fhAlbum）。
   分辨率存在 localStorage: fh:cam:res（长边像素，默认 1080P）
    比例存在 localStorage: fh:cam:ratio（默认 16:9）
*/
(function () {
  'use strict';
  if (window.__fhCam) return;

  var SELF_SRC = (document.currentScript && document.currentScript.src) || '';
  var CAM_BASE = SELF_SRC.split('?')[0].split('#')[0].replace(/\/mods\/[^\/]+$/, '');
  var albumWait = null;

  function ensureAlbum(cb) {
    if (window.__fhAlbum) { cb(); return; }
    if (albumWait) { albumWait.push(cb); return; }
    albumWait = [cb];
    function ok() {
      var q = albumWait || [];
      albumWait = null;
      q.forEach(function (f) { try { f(); } catch (e) {} });
    }
    function fail() {
      albumWait = null;
      if (S) toast(S, '相册模块加载失败，这次拍摄不会自动保存', true);
    }
    var sc = document.createElement('script');
    sc.src = (CAM_BASE || '') + '/mods/album.js?v=3.17';
    sc.onload = function () { if (window.__fhAlbum) ok(); else fail(); };
    sc.onerror = fail;
    document.head.appendChild(sc);
  }

  var K_RES = 'fh:cam:res';
  var K_RATIO = 'fh:cam:ratio';
  var RES_OPTS = [
    { v: 3840, l: '4K' },
    { v: 2560, l: '2K' },
    { v: 1920, l: '1080P' },
    { v: 1280, l: '720P' }
  ];
  // 16:9 默认；原始 = 摄像头轨道实际比例（多数手机后置是 4:3，选它可吃满传感器）
  var RATIO_OPTS = [
    { k: '16:9', l: '16:9', w: 16, h: 9 },
    { k: '9:16', l: '9:16', w: 9, h: 16 },
    { k: '4:3', l: '4:3', w: 4, h: 3 },
    { k: '3:4', l: '3:4', w: 3, h: 4 },
    { k: '21:9', l: '21:9', w: 21, h: 9 },
    { k: 'auto', l: '原始', w: 0, h: 0 }
  ];
  var MAX_VIDEO = 25 * 1024 * 1024;
  var MAX_SEC = 60;

  function readRes() {
    var v = 0;
    try { v = parseInt(localStorage.getItem(K_RES) || '', 10); } catch (e) {}
    if (!v) v = 1920;
    for (var i = 0; i < RES_OPTS.length; i++) if (RES_OPTS[i].v === v) return v;
    return 1920;
  }
  function writeRes(v) {
    v = parseInt(v, 10) || 1920;
    try { localStorage.setItem(K_RES, String(v)); } catch (e) {}
  }
  function resLabel(v) {
    for (var i = 0; i < RES_OPTS.length; i++) if (RES_OPTS[i].v === v) return RES_OPTS[i].l;
    return '1080P';
  }
  function readRatio() {
    var k = '';
    try { k = localStorage.getItem(K_RATIO) || ''; } catch (e) {}
    for (var i = 0; i < RATIO_OPTS.length; i++) if (RATIO_OPTS[i].k === k) return k;
    return '16:9';
  }
  function writeRatio(k) {
    try { localStorage.setItem(K_RATIO, String(k || '16:9')); } catch (e) {}
  }
  function ratioLabel(k) {
    for (var i = 0; i < RATIO_OPTS.length; i++) if (RATIO_OPTS[i].k === k) return RATIO_OPTS[i].l;
    return '16:9';
  }
  // 录像比特率随分辨率走：1080P 3Mbps，2K 6Mbps，4K 10Mbps。
  function videoBps(longEdge) {
    var n = Number(longEdge) || 1920;
    if (n >= 3000) return 10000000;
    if (n >= 2000) return 6000000;
    return 3000000;
  }
  function even(n) { return Math.max(2, Math.round(n / 2) * 2); }
  function mmss2(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), ss = sec % 60;
    return ('0' + m).slice(-2) + ':' + ('0' + ss).slice(-2);
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
    if (s.onResize) {
      try { window.removeEventListener('resize', s.onResize); } catch (e) {}
      try { window.removeEventListener('orientationchange', s.onResize); } catch (e) {}
      s.onResize = null;
    }
    if (s.previewUrl) { try { URL.revokeObjectURL(s.previewUrl); } catch (e) {} s.previewUrl = ''; }
    if (s.timer) { clearInterval(s.timer); s.timer = 0; }
    try { if (s.recorder && s.recorder.state === 'recording') s.recorder.stop(); } catch (e) {}
    s.recorder = null;
    stopCanvasRec(s);
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

  function stopCanvasRec(s) {
    if (!s) return;
    if (s.recRaf) {
      try { cancelAnimationFrame(s.recRaf); } catch (e) {}
      s.recRaf = 0;
    }
    if (s.recCanvasStream) {
      try { s.recCanvasStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      s.recCanvasStream = null;
    }
    s.recCanvas = null;
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
      opts: opts,
      mode: opts.mode === 'video' ? 'video' : 'photo',
      canBoth: opts.mode !== 'photo' && opts.mode !== 'video',
      facing: opts.facing === 'user' ? 'user' : 'environment',
      res: readRes(), ratio: readRatio(), zoom: 1, dead: false, preview: !!opts.preview,
      stream: null, track: null, recorder: null, chunks: [], mic: null,
      recBytes: 0, recStart: 0, timer: 0, lastPhotoAt: 0,
      stageW: 0, stageH: 0,
      recCanvas: null, recRaf: 0, recCanvasStream: null,
      previewEl: null, previewUrl: '', previewBlob: null, previewInfo: null, previewKind: '',
      sending: false
    };

    var root = s.root = el('div', 'position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;flex-direction:column;' +
      'font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;overflow:hidden;touch-action:none');
    root.setAttribute('data-fh-skip', '1');
    root.id = '__fhcam';

    // 顶栏：分辨率 / 标题 / 关闭
    var top = el('div', 'position:relative;z-index:6;display:flex;align-items:center;gap:10px;' +
      'padding:10px 12px;background:linear-gradient(rgba(0,0,0,.72),transparent);flex-shrink:0');
    var resSel = document.createElement('select');
    resSel.title = '拍照/录像分辨率';
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

    // v3.14：拍照 / 录像 明确切换（单快门）
    var modeBar = null, modeBtns = {};
    if (s.canBoth) {
      modeBar = el('div', 'position:relative;z-index:6;display:flex;justify-content:center;gap:6px;' +
        'padding:0 12px 8px;background:linear-gradient(rgba(0,0,0,.55),transparent);flex-shrink:0');
      [['photo', '📷 拍照'], ['video', '🎥 录像']].forEach(function (it) {
        var b = el('button', 'min-width:88px;height:32px;padding:0 14px;border:1px solid rgba(255,255,255,.24);' +
          'border-radius:999px;background:rgba(0,0,0,.42);color:#cfcfd8;font:12px/1 inherit;cursor:pointer', it[1]);
        b.setAttribute('data-mode', it[0]);
        b.onclick = function () { setMode(it[0]); };
        modeBtns[it[0]] = b;
        modeBar.appendChild(b);
      });
    }

    // v3.17：比例栏（取景框和成片共用同一比例）
    var ratioBar = el('div', 'position:relative;z-index:6;display:flex;align-items:center;justify-content:center;' +
      'gap:6px;padding:0 10px 8px;overflow-x:auto;background:linear-gradient(rgba(0,0,0,.55),transparent);' +
      'flex-shrink:0;-webkit-overflow-scrolling:touch');
    var ratioBtns = {};
    RATIO_OPTS.forEach(function (o) {
      var b = el('button', 'flex:0 0 auto;min-width:50px;height:30px;padding:0 10px;border:1px solid rgba(255,255,255,.24);' +
        'border-radius:999px;background:rgba(0,0,0,.42);color:#cfcfd8;font:12px/1 inherit;cursor:pointer', o.l);
      b.setAttribute('data-ratio', o.k);
      b.onclick = function () { setRatio(o.k); };
      ratioBtns[o.k] = b;
      ratioBar.appendChild(b);
    });

    // v3.17：stageWrap 负责黑边留白，stage 是严格按比例计算的取景框；
    // 框内才是最终成片范围，变焦只裁框内画面，不再缩放整个页面。
    var stageWrap = s.stageWrap = el('div', 'position:relative;flex:1;min-height:0;width:100%;overflow:hidden;' +
      'background:#000;display:flex;align-items:center;justify-content:center');
    var stage = s.stage = el('div', 'position:relative;flex:0 0 auto;overflow:hidden;background:#000;' +
      'box-shadow:0 0 0 1px rgba(255,255,255,.18)');
    var v = s.v = document.createElement('video');
    v.autoplay = true;
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    // 宽高由 applyFrame() 按源尺寸、目标比例和变焦倍数算，居中裁切
    v.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#000;' +
      'max-width:none;max-height:none;pointer-events:none';
    stage.appendChild(v);

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

    // 录像状态：放在取景框顶部，显示已录时长 + 当前体积 + 比例
    var recLabel = s.recLabel = el('div', 'position:absolute;left:50%;top:10px;transform:translateX(-50%);' +
      'z-index:7;padding:5px 11px;border-radius:999px;background:rgba(210,60,60,.86);color:#fff;' +
      'font:11px/1.5 ui-monospace,monospace;display:none;white-space:nowrap;pointer-events:none', '● 00:00 · 0.0 MB');
    stage.appendChild(recLabel);

    // 底栏：左翻转，右侧快门（拍照 / 开始-停止录像）
    var bar = s.bar = el('div', 'position:relative;z-index:6;display:flex;align-items:center;justify-content:space-between;' +
      'gap:0;padding:14px 20px calc(22px + env(safe-area-inset-bottom,0px));' +
      'background:linear-gradient(transparent,rgba(0,0,0,.8));flex-shrink:0');
    var flip = s.flip = el('button', 'width:52px;height:52px;padding:0;border:1px solid rgba(255,255,255,.26);' +
      'border-radius:50%;background:rgba(28,28,34,.66);color:#fff;font:20px/1 inherit;cursor:pointer;flex:0 0 auto', '🔄');
    flip.title = '前后摄像头';
    var spacer = el('div', 'flex:1;height:52px');
    var shot = s.shot = el('button', 'width:76px;height:76px;padding:0;border:4px solid rgba(255,255,255,.88);' +
      'border-radius:50%;background:#fff;color:#111;font:700 14px/1 inherit;cursor:pointer;flex:0 0 auto;' +
      'box-shadow:0 0 0 4px rgba(0,0,0,.28),0 6px 20px rgba(0,0,0,.5);transition:transform .12s,background .12s', '');
    shot.title = '拍照';
    shot.setAttribute('aria-label', '拍照');
    shot.onpointerdown = function () { shot.style.transform = 'scale(.92)'; };
    shot.onpointerup = function () { shot.style.transform = ''; };
    shot.onpointercancel = function () { shot.style.transform = ''; };

    bar.append(flip, spacer, shot);

    var failBox = s.failBox = el('div', 'position:absolute;inset:0;z-index:9;display:none;place-items:center;' +
      'padding:28px;text-align:center;color:#c9c9d2;font:13px/1.9 inherit;white-space:pre-wrap;background:#000');

    root.append(top);
    if (modeBar) root.append(modeBar);
    root.append(ratioBar, stageWrap, toastEl, zWrap, bar, failBox);
    stageWrap.appendChild(stage);
    document.body.append(root);

    // ── 打开摄像头 ──
    function constraints() {
      // 请求 4:3 的传感器尺寸，不锁 16:9；具体取景比例由 stage / srcRect 裁切。
      var r = s.res;
      var h = Math.round(r * 3 / 4);
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
      stopCanvasRec(s);
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

    function targetAspect() {
      for (var i = 0; i < RATIO_OPTS.length; i++) {
        if (RATIO_OPTS[i].k === s.ratio && RATIO_OPTS[i].w) return RATIO_OPTS[i].w / RATIO_OPTS[i].h;
      }
      var vw = Number(v.videoWidth) || 0, vh = Number(v.videoHeight) || 0;
      return vw && vh ? vw / vh : 16 / 9;
    }

    // 取景框按目标比例 layout；框外留黑边，框内就是最终输出。
    function layoutStage() {
      if (!s.stage || s.dead) return;
      var aw = stageWrap.clientWidth, ah = stageWrap.clientHeight;
      if (!aw || !ah) return;
      var ar = targetAspect();
      var w = aw, h = w / ar;
      if (h > ah) { h = ah; w = h * ar; }
      w = Math.max(2, Math.floor(w));
      h = Math.max(2, Math.floor(h));
      s.stageW = w; s.stageH = h;
      stage.style.width = w + 'px';
      stage.style.height = h + 'px';
      applyFrame();
    }

    function applyZoom(z) {
      s.zoom = Math.max(1, Math.min(4, Number(z) || 1));
      zLab.textContent = s.zoom.toFixed(1) + '×';
      zRange.value = String(s.zoom);
      applyFrame();
    }

    // 当前取景框对应的源区域：先按目标比例中心裁切，再按 zoom 向中心收窄。
    // 预览的 video 尺寸和拍照/录像 drawImage 都用这一套几何，保证所见即所得。
    function srcRect() {
      var vw = Number(v.videoWidth) || 0, vh = Number(v.videoHeight) || 0;
      if (!vw || !vh) return null;
      var ar = targetAspect();
      var sar = vw / vh;
      var bw, bh;
      if (sar > ar) { bh = vh; bw = vh * ar; }
      else { bw = vw; bh = vw / ar; }
      var z = Math.max(1, s.zoom);
      var sw = bw / z, sh = bh / z;
      if (sw < 2 || sh < 2) return null;
      return {
        sx: (vw - sw) / 2, sy: (vh - sh) / 2,
        sw: sw, sh: sh,
        vw: vw, vh: vh, ar: ar
      };
    }

    // 把完整源画面按「取景框/裁切区」的倍率铺开，stage 的 overflow 负责裁切。
    function applyFrame() {
      if (!s.stageW || !s.stageH) return;
      var r = srcRect();
      if (!r) return;
      var scale = s.stageW / r.sw;
      v.style.width = (r.vw * scale) + 'px';
      v.style.height = (r.vh * scale) + 'px';
    }

    function updateRatio() {
      Object.keys(ratioBtns).forEach(function (k) {
        var on = k === s.ratio;
        ratioBtns[k].style.background = on ? '#fff' : 'rgba(0,0,0,.42)';
        ratioBtns[k].style.color = on ? '#111' : '#cfcfd8';
        ratioBtns[k].style.borderColor = on ? '#fff' : 'rgba(255,255,255,.24)';
      });
    }

    function setRatio(k) {
      if (s.recorder && s.recorder.state === 'recording') {
        toast(s, '录像中不能切换比例', true);
        return;
      }
      s.ratio = k;
      writeRatio(k);
      s.zoom = 1;
      updateRatio();
      layoutStage();
      applyZoom(1);
      toast(s, '比例：' + ratioLabel(k));
    }

    function onResize() {
      layoutStage();
      applyZoom(s.zoom);
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    s.onResize = onResize;

    v.onloadedmetadata = function () { layoutStage(); applyZoom(s.zoom); };
    v.onresize = function () { layoutStage(); applyZoom(s.zoom); };

    zOut.onclick = function () { applyZoom(s.zoom - 0.2); };
    zIn.onclick = function () { applyZoom(s.zoom + 0.2); };
    zRange.oninput = function () { applyZoom(parseFloat(zRange.value)); };

    resSel.onchange = function () {
      if (s.recorder && s.recorder.state === 'recording') {
        resSel.value = String(s.res);
        toast(s, '录像中不能切换分辨率', true);
        return;
      }
      s.res = parseInt(resSel.value, 10) || 1920;
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

    // ── v3.14：模式 / 快门外观 / 相册 / 预览 ──
    function setMode(m) {
      if (s.recorder) { toast(s, '录像中不能切换模式', true); return; }
      if (m !== 'photo' && m !== 'video') return;
      s.mode = m;
      updateMode();
      updateShutter();
      toast(s, m === 'photo' ? '拍照模式' : '录像模式');
    }

    function updateMode() {
      if (!modeBar) return;
      Object.keys(modeBtns).forEach(function (k) {
        var on = k === s.mode;
        modeBtns[k].style.background = on ? '#fff' : 'rgba(0,0,0,.42)';
        modeBtns[k].style.color = on ? '#111' : '#cfcfd8';
        modeBtns[k].style.borderColor = on ? '#fff' : 'rgba(255,255,255,.24)';
      });
    }

    function updateShutter() {
      var recording = !!(s.recorder && s.recorder.state === 'recording');
      if (recording) {
        shot.textContent = '■';
        shot.style.background = '#e5484d';
        shot.style.color = '#fff';
        shot.style.borderColor = 'rgba(255,255,255,.9)';
        shot.title = '停止录像';
        shot.setAttribute('aria-label', '停止录像');
      } else if (s.mode === 'video') {
        shot.textContent = '●';
        shot.style.background = '#e5484d';
        shot.style.color = '#fff';
        shot.style.borderColor = 'rgba(255,255,255,.9)';
        shot.title = '开始录像';
        shot.setAttribute('aria-label', '开始录像');
      } else {
        shot.textContent = '';
        shot.style.background = '#fff';
        shot.style.color = '#111';
        shot.style.borderColor = 'rgba(255,255,255,.88)';
        shot.title = '拍照';
        shot.setAttribute('aria-label', '拍照');
      }
    }

    function archive(blob, info, kind) {
      var meta = {
        name: info.name, kind: kind, source: 'camera',
        dur: info.dur || 0, width: info.width || 0, height: info.height || 0
      };
      function doSave() {
        if (!window.__fhAlbum || !window.__fhAlbum.save) {
          toast(s, '已保存到相机，但相册模块未加载', true);
          return;
        }
        try {
          window.__fhAlbum.save(blob, meta).catch(function (e) {
            toast(s, '存相册失败：' + (e && e.message ? e.message : e), true);
          });
        } catch (e) {
          toast(s, '存相册失败：' + (e && e.message ? e.message : e), true);
        }
      }
      ensureAlbum(doSave);
    }

    function closePreview() {
      if (s.previewUrl) { try { URL.revokeObjectURL(s.previewUrl); } catch (e) {} s.previewUrl = ''; }
      if (s.previewEl) { try { s.previewEl.remove(); } catch (e) {} s.previewEl = null; }
      s.previewBlob = null;
      s.previewInfo = null;
      s.previewKind = '';
      s.sending = false;
      updateShutter();
    }

    function showPreview(kind, blob, info) {
      closePreview();
      s.previewBlob = blob;
      s.previewInfo = info;
      s.previewKind = kind;
      var url = '';
      try { url = URL.createObjectURL(blob); } catch (e) { toast(s, '预览失败：' + (e && e.message ? e.message : e), true); return; }
      s.previewUrl = url;

      var ov = el('div', 'position:absolute;inset:0;z-index:20;background:#000;display:flex;flex-direction:column;' +
        'font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif');
      var head = el('div', 'display:flex;align-items:center;gap:10px;padding:12px 14px;color:#e8e8ee;flex-shrink:0');
      head.appendChild(el('div', 'flex:1;font:13px/1.3 inherit', kind === 'image' ? '照片预览' : '录像预览'));
      var t = el('div', 'color:#8f8f9c;font:11px/1.3 inherit', bytes(blob.size) + (kind === 'video' && info.dur ? ' · ' + mmss(info.dur) : ''));
      head.appendChild(t);
      var x2 = el('button', 'width:32px;height:32px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font:16px/1 inherit;cursor:pointer', '✕');
      x2.title = '关闭预览';
      x2.onclick = closePreview;
      head.appendChild(x2);

      var box = el('div', 'flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden');
      if (kind === 'image') {
        var im = document.createElement('img');
        im.src = url;
        im.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain';
        box.appendChild(im);
      } else {
        var vd = document.createElement('video');
        vd.src = url;
        vd.controls = true;
        vd.autoplay = true;
        vd.loop = true;
        vd.playsInline = true;
        vd.setAttribute('playsinline', '');
        vd.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;background:#000';
        box.appendChild(vd);
        var p = vd.play();
        if (p && p.catch) p.catch(function () {});
      }

      var foot = el('div', 'display:flex;align-items:center;gap:10px;padding:14px 16px calc(20px + env(safe-area-inset-bottom,0px));flex-shrink:0');
      function pbtn(txt, bg, color) {
        return el('button', 'flex:1;height:44px;border:1px solid rgba(255,255,255,.22);border-radius:12px;' +
          'background:' + bg + ';color:' + color + ';font:13px/1 inherit;cursor:pointer', txt);
      }
      var redo = pbtn('重拍', 'rgba(28,28,34,.8)', '#e8e8ee');
      var done = pbtn('完成', 'rgba(28,28,34,.8)', '#e8e8ee');
      var send = pbtn('发送', '#fff', '#111');
      redo.onclick = function () {
        closePreview();
        toast(s, '已存入相册，可以重拍');
      };
      done.onclick = function () {
        closePreview();
        toast(s, '已存入相册');
      };
      var fn = kind === 'image' ? s.opts.onPhoto : s.opts.onVideo;
      if (typeof fn !== 'function') send.style.display = 'none';
      send.onclick = function () {
        if (s.sending || typeof fn !== 'function') return;
        s.sending = true;
        send.disabled = true;
        send.textContent = '发送中…';
        send.style.opacity = '.65';
        var ret;
        try { ret = fn(blob, info); } catch (e) {
          s.sending = false; send.disabled = false; send.textContent = '发送'; send.style.opacity = '';
          toast(s, '发送失败：' + (e && e.message ? e.message : e), true);
          return;
        }
        Promise.resolve(ret).then(function () {
          s.sending = false;
          toast(s, kind === 'image' ? '照片已发送' : '视频已发送');
          closePreview();
        }).catch(function (e) {
          s.sending = false;
          send.disabled = false;
          send.textContent = '发送';
          send.style.opacity = '';
          toast(s, '发送失败：' + (e && e.message ? e.message : e), true);
        });
      };
      foot.append(redo, done, send);
      ov.append(head, box, foot);
      root.appendChild(ov);
      s.previewEl = ov;
    }

    function deliver(kind, blob, info) {
      if (s.preview) { showPreview(kind, blob, info); return; }
      var fn = kind === 'image' ? s.opts.onPhoto : s.opts.onVideo;
      if (typeof fn !== 'function') return;
      try {
        var ret = fn(blob, info);
        if (ret && ret.catch) ret.catch(function (e) { toast(s, '处理失败：' + (e && e.message ? e.message : e), true); });
      } catch (e) {
        toast(s, '处理失败：' + (e && e.message ? e.message : e), true);
      }
    }

    updateMode();
    updateShutter();

    // ── 拍照 ──
    shot.onclick = function () {
      if (s.recorder && s.recorder.state === 'recording') { stopRec(); return; }
      if (s.previewEl) return;
      if (s.mode === 'video') { startRec(); return; }
      if (!s.stream || !v.videoWidth || !v.videoHeight) { toast(s, '相机还没准备好', true); return; }
      if (Date.now() - s.lastPhotoAt < 700) return;
      s.lastPhotoAt = Date.now();
      shot.style.transform = 'scale(.9)';
      setTimeout(function () { shot.style.transform = ''; }, 140);

      var cr = srcRect();
      if (!cr) { toast(s, '相机还没准备好', true); return; }
      var sw = cr.sw, sh = cr.sh;
      var scale = Math.min(1, s.res / Math.max(sw, sh));
      var cw = Math.max(1, Math.round(sw * scale)), ch = Math.max(1, Math.round(sh * scale));
      var c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      try { c.getContext('2d').drawImage(v, cr.sx, cr.sy, sw, sh, 0, 0, cw, ch); }
      catch (e) { toast(s, '拍照失败：' + (e && e.message ? e.message : e), true); return; }
      c.toBlob(function (b) {
        if (!b) { toast(s, '拍照失败（没有图像数据）', true); return; }
        var name = 'cam-' + stamp() + '.jpg';
        var info = { name: name, width: cw, height: ch, size: b.size, mime: 'image/jpeg', kind: 'image' };
        toast(s, '已拍 ' + cw + '×' + ch + ' · ' + bytes(b.size) + '，已存相册');
        archive(b, info, 'image');
        deliver('image', b, info);
      }, 'image/jpeg', 0.92);
    };

    // ── 录像 ──
    function startRec() {
      if (s.recorder && s.recorder.state === 'recording') return;
      if (!s.stream) { toast(s, '相机还没准备好', true); return; }
      if (typeof MediaRecorder === 'undefined') { toast(s, '这个浏览器不支持录像', true); return; }
      s.chunks = [];
      s.recBytes = 0;
      s.recStart = Date.now();
      shot.textContent = '…';
      shot.disabled = true;

      var micP = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        ? navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
          .catch(function () { return null; })
        : Promise.resolve(null);

      micP.then(function (mic) {
        if (s.dead) { if (mic) mic.getTracks().forEach(function (t) { t.stop(); }); return; }
        s.mic = mic || null;
        // v3.17：取景框 = 成片比例；逐帧从 srcRect 裁切，变焦/比例与预览一致。
        var capture = s.stream.getVideoTracks().slice(0);
        var useCanvas = false;
        var bps = videoBps(s.res);
        var cr = srcRect();
        if (cr && window.HTMLCanvasElement && HTMLCanvasElement.prototype.captureStream) {
          var longEdge = Math.min(s.res, 3840);
          var outScale = Math.min(1, longEdge / Math.max(cr.sw, cr.sh));
          var cw = even(cr.sw * outScale);
          var ch = even(cr.sh * outScale);
          bps = videoBps(Math.max(cw, ch));
          var cv = document.createElement('canvas');
          cv.width = cw; cv.height = ch;
          var ctx = cv.getContext('2d');
          if (ctx) {
            var draw = function () {
              if (!s || s.dead || !s.recCanvas) return;
              var r2 = srcRect();
              if (r2) {
                try { ctx.drawImage(v, r2.sx, r2.sy, r2.sw, r2.sh, 0, 0, cw, ch); } catch (e) {}
              }
              s.recRaf = requestAnimationFrame(draw);
            };
            s.recCanvas = cv;
            draw();
            try {
              var vs = cv.captureStream(30);
              if (vs && vs.getVideoTracks && vs.getVideoTracks().length) {
                s.recCanvasStream = vs;
                capture = vs.getVideoTracks().slice(0);
                useCanvas = true;
              } else {
                stopCanvasRec(s);
              }
            } catch (e) {
              stopCanvasRec(s);
            }
          }
        }
        if (!useCanvas) {
          capture = s.stream.getVideoTracks().slice(0);
          if (s.zoom > 1.001 || s.ratio !== 'auto') {
            toast(s, '当前浏览器不支持裁切录像，将录原始画面', true);
          }
        }
        var tracks = capture;
        if (s.mic) tracks = tracks.concat(s.mic.getAudioTracks());
        var mixed = new MediaStream(tracks);
        var mime = pickVideoMime();
        var isMp4 = /mp4/.test(mime);
        try {
          s.recorder = new MediaRecorder(mixed, mime ? {
            mimeType: mime, videoBitsPerSecond: bps, audioBitsPerSecond: 96000
          } : { videoBitsPerSecond: bps, audioBitsPerSecond: 96000 });
        } catch (e) {
          s.recorder = null;
          stopCanvasRec(s);
          shot.disabled = false;
          updateShutter();
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
          s.recorder = null;
          stopCanvasRec(s);
          shot.disabled = false;
          updateShutter();
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
            var info = { name: name, mime: type, size: b.size, dur: dur, kind: 'video' };
            toast(s, '录像完成 ' + mmss(dur) + ' · ' + bytes(b.size) + '，已存相册');
            archive(b, info, 'video');
            deliver('video', b, info);
          });
        };
        // v3.13：MP4 不分片（分片拼接正是坏文件的主因）；WebM 分片没问题，顺便看体积
        try { isMp4 ? s.recorder.start() : s.recorder.start(500); }
        catch (e) {
          s.recorder = null;
          stopCanvasRec(s);
          shot.disabled = false;
          updateShutter();
          toast(s, '录像启动失败：' + (e && e.message ? e.message : e), true);
          return;
        }
        shot.disabled = false;
        updateShutter();
        recLabel.textContent = '● 00:00 · 0.0 MB · ' + ratioLabel(s.ratio);
        recLabel.style.display = 'block';
        if (!s.mic) toast(s, '麦克风不可用，将无声录制', true);
        s.timer = setInterval(function () {
          if (!s.recorder || s.recorder.state !== 'recording') return;
          var sec = (Date.now() - s.recStart) / 1000;
          recLabel.textContent = '● ' + mmss2(sec) + ' · ' + bytes(s.recBytes) + ' · ' + ratioLabel(s.ratio);
          if (sec >= MAX_SEC) {
            toast(s, '已到 ' + MAX_SEC + ' 秒上限，自动停止', true);
            stopRec();
          }
        }, 500);
      });
    }

    function stopRec() {
      shot.disabled = false;
      shot.style.opacity = '';
      try { if (s.recorder && s.recorder.state === 'recording') s.recorder.stop(); } catch (e) {}
    }

    updateRatio();
    layoutStage();
    setTimeout(layoutStage, 0);
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
    ratio: readRatio,
    ratioLabel: ratioLabel,
    setRatio: writeRatio,
    RES: RES_OPTS,
    RATIO: RATIO_OPTS
  };
})();
