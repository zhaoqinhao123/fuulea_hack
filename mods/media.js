/* 相机（拍照/录像） + 本地图片/视频全屏查看 */
(function () {
  if (document.getElementById('__md')) { document.getElementById('__md').remove(); }

  function shell(title, id) {
    var d = document.createElement('div');
    if (id) d.id = id;
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483645;background:rgba(10,10,12,.95);display:flex;flex-direction:column;font:13px/1.5 -apple-system,"PingFang SC",sans-serif;color:#ddd';

    var bar = document.createElement('div');
    bar.style.cssText = 'height:52px;display:flex;align-items:center;gap:6px;padding:0 10px;background:rgba(0,0,0,.45);flex-shrink:0';
    var t = document.createElement('div');
    t.textContent = title || '';
    t.style.cssText = 'flex:1;color:#aaa;font-size:13px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis';
    var x = document.createElement('button');
    x.textContent = '✕';
    x.style.cssText = 'width:46px;height:44px;border:0;border-radius:10px;background:transparent;color:#bbb;font-size:19px;cursor:pointer';
    x.onclick = function () { d.remove(); };
    bar.append(t, x);

    var body = document.createElement('div');
    body.style.cssText = 'flex:1;position:relative;overflow:hidden';
    d.append(bar, body);
    document.body.append(d);
    return { root: d, bar: bar, body: body };
  }

  function btn(txt, style) {
    var b = document.createElement('button');
    b.textContent = txt;
    b.style.cssText = 'height:44px;padding:0 16px;border:1px solid #3a3a42;border-radius:11px;background:#26262c;color:#eee;font:14px/1 inherit;cursor:pointer;' + (style || '');
    return b;
  }

  // ── 查看器：图片 / 视频 ──
  function view(blob, name) {
    var s = shell(name || '预览');
    if (/^video\//.test(blob.type) || /\.(mp4|mov|webm|m4v)$/i.test(name || '')) {
      var v = document.createElement('video');
      v.src = URL.createObjectURL(blob);
      v.controls = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;background:#000;object-fit:contain';
      s.body.append(v);
      v.play().catch(function () {});
    } else {
      var img = new Image();
      img.src = URL.createObjectURL(blob);
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000';
      s.body.append(img);
      var z = 1;
      s.body.style.touchAction = 'none';
      var last = 0;
      s.body.addEventListener('touchstart', function (e) {
        if (e.touches.length === 2) last = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
      }, { passive: true });
      s.body.addEventListener('touchmove', function (e) {
        if (e.touches.length !== 2) return;
        e.preventDefault();
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (last) { z = Math.min(Math.max(z * d / last, 1), 6); img.style.transform = 'scale(' + z + ')'; }
        last = d;
      }, { passive: false });
    }
    return s;
  }

  // ── 相机 ──
  function camera() {
    var s = shell('相机');
    var v = document.createElement('video');
    v.autoplay = true;
    v.playsInline = true;
    v.muted = true;
    v.setAttribute('playsinline', '');
    v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;background:#000;object-fit:cover';
    s.body.append(v);

    var ctl = document.createElement('div');
    ctl.style.cssText = 'position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;justify-content:center;padding:14px;background:linear-gradient(transparent,rgba(0,0,0,.6))';

    var shot = btn('📸 拍照', 'background:#fff;color:#111;border:0');
    var rec = btn('🎥 录像');
    var flip = btn('🔄 翻转');
    ctl.append(shot, rec, flip);
    s.body.append(ctl);

    var stream = null, facing = 'environment', recorder = null, chunks = [];

    function open(f) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        s.body.innerHTML = '<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;color:#999">当前浏览器不支持 getUserMedia<br><span style="font-size:12px;opacity:.6">（file:// 或非安全上下文常见）</span></div>';
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: f }, audio: false })
        .then(function (st) {
          stream = st;
          v.srcObject = st;
          return v.play();
        })
        .catch(function (e) {
          var msg = e.name === 'NotAllowedError' ? '权限被拒绝' : (e.name === 'NotFoundError' ? '没有可用摄像头' : e.message);
          v.style.display = 'none';
          ctl.style.display = 'none';
          var tip = document.createElement('div');
          tip.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;color:#999';
          tip.innerHTML = '无法打开相机：' + msg + '<br><span style="font-size:12px;opacity:.6">可以试试系统相机，或用「本地」从相册选</span>';
          s.body.append(tip);
        });
    }

    shot.onclick = function () {
      if (!stream) return;
      var c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      c.toBlob(function (b) { view(b, 'photo.png'); }, 'image/png');
    };

    rec.onclick = function () {
      if (!stream) return;
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
        rec.textContent = '🎥 录像';
        rec.style.background = '#26262c';
        return;
      }
      if (typeof MediaRecorder === 'undefined') return alert('当前浏览器不支持录像');
      chunks = [];
      try {
        recorder = new MediaRecorder(stream);
      } catch (e) { return alert('录像失败：' + e.message); }
      recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop = function () {
        var b = new Blob(chunks, { type: chunks[0] ? chunks[0].type : 'video/webm' });
        view(b, 'record.webm');
      };
      recorder.start();
      rec.textContent = '⏹ 停止';
      rec.style.background = '#7a2b2b';
    };

    flip.onclick = function () {
      facing = facing === 'environment' ? 'user' : 'environment';
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      open(facing);
    };

    // 关闭时释放摄像头
    s.root.addEventListener('DOMNodeRemoved', function () {});
    var obs = new MutationObserver(function () {
      if (!document.getElementById('__md') && stream) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true });

    open(facing);
  }

  // ── 本地文件 ──
  function local() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = function () {
      var f = input.files && input.files[0];
      if (f) view(f, f.name);
    };
    input.click();
  }

  // ── 入口 ──
  var s = shell('相机 / 本地媒体', '__md');
  var wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:20px';
  var a = btn('📷 打开相机', 'min-width:200px');
  var b = btn('🖼 本地图片/视频', 'min-width:200px');
  var tip = document.createElement('div');
  tip.style.cssText = 'color:#666;font-size:12px;text-align:center;max-width:420px;line-height:1.7';
  tip.textContent = '相机需要浏览器授予权限；file:// 或非 https 页面可能被拒绝，此时请用「本地」从相册选。';
  a.onclick = function () { s.root.remove(); camera(); };
  b.onclick = function () { local(); };
  wrap.append(a, b, tip);
  s.body.append(wrap);
})();
