/* 隐蔽遮罩：pin / 粘贴链接 → 全屏查看（图片可捏合缩放、拖动；HTML/PDF 可滚动+按钮缩放） */
(function () {
  var PAGE_OF = function (pin) { return 'https://t.fuulea.com/?pin=' + encodeURIComponent(pin); };

  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }

  function bar(node, hint, extra) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(16,16,18,.97);overflow:hidden';
    var t = document.createElement('div');
    t.style.cssText = 'position:absolute;top:0;left:0;right:0;height:52px;display:flex;align-items:center;gap:2px;padding:0 6px;background:rgba(0,0,0,.45);color:#aaa;font:13px/1 -apple-system,"PingFang SC",sans-serif;z-index:3';
    var sp = document.createElement('span');
    sp.textContent = hint || '';
    sp.style.cssText = 'flex:1;opacity:.5;overflow:hidden;white-space:nowrap;text-overflow:ellipsis';
    function b(txt, fn) {
      var x = document.createElement('button');
      x.textContent = txt;
      x.style.cssText = 'min-width:46px;height:44px;border:0;border-radius:10px;background:transparent;color:#bbb;font:19px/1 inherit;cursor:pointer;padding:0 6px';
      x.onclick = fn;
      return x;
    }
    var kids = [];
    if (extra) kids.push(extra);
    kids.push(
      b('−', function () { node.dispatchEvent(new CustomEvent('zo', { detail: -1 })); }),
      b('＋', function () { node.dispatchEvent(new CustomEvent('zo', { detail: 1 })); }),
      b('⟲', function () { node.dispatchEvent(new CustomEvent('zo', { detail: 0 })); }),
      b('✕', function () { d.remove(); }));
    t.append.apply(t, [sp].concat(kids));
    d.append(t, node);
    document.body.append(d);
    return d;
  }

  // ── 图片：捏合缩放 + 单指拖动 + 双击复位 ──
  function imageView(blob) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;inset:52px 0 0 0;overflow:auto;background:#0e0e10;text-align:center;-webkit-overflow-scrolling:touch';
    var img = new Image();
    img.src = URL.createObjectURL(blob);
    img.draggable = false;
    img.style.cssText = 'display:inline-block;vertical-align:top;margin-top:6px;max-width:none;user-select:none;-webkit-user-drag:none';
    wrap.append(img);

    var z = 1, w0 = 0;
    function fit() {
      w0 = img.naturalWidth || 800;
      var mw = wrap.clientWidth * 0.98;
      z = w0 > mw ? mw / w0 : 1;
      apply();
    }
    function apply() { img.style.width = Math.max(80, Math.round(w0 * z)) + 'px'; }
    img.onload = fit;

    wrap.addEventListener('zo', function (e) {
      var d = e.detail;
      if (!d) { fit(); return; }
      z = clamp(d > 0 ? z * 1.25 : z / 1.25, 0.1, 8);
      apply();
    });

    var lastDist = 0;
    function dist(t) {
      var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    wrap.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) lastDist = dist(e.touches);
    }, { passive: true });
    wrap.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      var d = dist(e.touches);
      if (lastDist) { z = clamp(z * d / lastDist, 0.1, 8); apply(); }
      lastDist = d;
    }, { passive: false });
    wrap.addEventListener('touchend', function () { lastDist = 0; });

    var lastTap = 0;
    wrap.addEventListener('touchend', function (e) {
      var now = Date.now();
      if (now - lastTap < 300 && e.touches.length === 0) fit();
      lastTap = now;
    });

    // 桌面端：Ctrl/⌘+滚轮缩放、拖动平移
    wrap.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      z = clamp(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.1, 8);
      apply();
    }, { passive: false });

    var down = false, mx = 0, my = 0, sl = 0, st = 0;
    wrap.addEventListener('mousedown', function (e) {
      down = true; mx = e.clientX; my = e.clientY; sl = wrap.scrollLeft; st = wrap.scrollTop;
    });
    window.addEventListener('mousemove', function (e) {
      if (!down) return;
      wrap.scrollLeft = sl - (e.clientX - mx);
      wrap.scrollTop = st - (e.clientY - my);
    });
    window.addEventListener('mouseup', function () { down = false; });

    bar(wrap, '双指缩放 · 单指拖动 · 双击复位');
  }

  // ── HTML / PDF：iframe + 整体缩放 ──
  function frameView(src, hint) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;inset:52px 0 0 0;overflow:auto;background:#0e0e10;-webkit-overflow-scrolling:touch';
    var holder = document.createElement('div');
    holder.style.cssText = 'transform-origin:0 0';

    var f = document.createElement('iframe');
    f.src = src;
    f.style.cssText = 'border:0;background:#fff;display:block;transform-origin:0 0';
    holder.append(f);
    wrap.append(holder);

    var z = 1;
    function apply() {
      var w = wrap.clientWidth, h = wrap.clientHeight;
      f.style.width = w + 'px';
      f.style.height = h + 'px';
      f.style.transform = 'scale(' + z + ')';
      holder.style.width = Math.round(w * z) + 'px';
      holder.style.height = Math.round(h * z) + 'px';
    }
    wrap.addEventListener('zo', function (e) {
      var d = e.detail;
      z = !d ? 1 : clamp(d > 0 ? z * 1.15 : z / 1.15, 0.4, 4);
      apply();
    });
    window.addEventListener('resize', apply);
    setTimeout(apply, 60);

    bar(wrap, hint || '');
  }

  // ── 拿不到下载页时：手动粘贴 / 新标签打开 ──
  function manual(pin, why) {
    var box = document.createElement('div');
    box.style.cssText = 'position:absolute;inset:52px 0 0 0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:16px;padding:20px;color:#bbb;font:14px/1.6 -apple-system,"PingFang SC",sans-serif';

    var tip = document.createElement('div');
    tip.textContent = why || '无法自动读取下载页';
    tip.style.cssText = 'max-width:560px;text-align:center;opacity:.6';

    var input = document.createElement('input');
    input.placeholder = '粘贴下载链接（s.100tifen.com/...）';
    input.style.cssText = 'width:min(520px,88vw);padding:14px;border-radius:12px;border:1px solid #3a3a42;background:#1b1b20;color:#eee;font:15px/1.4 inherit;outline:none';

    var go = document.createElement('button');
    go.textContent = '打开';
    go.style.cssText = 'min-width:120px;height:48px;border:0;border-radius:12px;background:#33333b;color:#eee;font:15px/1 inherit;cursor:pointer';

    go.onclick = function () {
      var u = input.value.trim();
      if (!u) return;
      openFile(u);
    };

    var open2 = document.createElement('button');
    open2.textContent = '去下载页复制链接';
    open2.style.cssText = 'min-width:160px;height:48px;border:1px solid #3a3a42;border-radius:12px;background:transparent;color:#999;font:15px/1 inherit;cursor:pointer';
    open2.onclick = function () {
      if (pin) window.open(PAGE_OF(pin), '_blank');
    };

    box.append(tip, input, go, open2);
    bar(box, '手动模式');
  }

  function openFile(url) {
    fetch(url, { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      .then(function (blob) {
        var name = decodeURIComponent(url.split('/').pop().split('?')[0] || '');
        var type = blob.type || '';
        if (/^image\//.test(type) || /\.(png|jpe?g|webp|gif)$/i.test(name)) imageView(blob);
        else if (/pdf/.test(type) || /\.pdf$/i.test(name)) frameView(URL.createObjectURL(blob), name);
        else frameView(URL.createObjectURL(blob), name + ' · 可缩放/滚动');
      })
      .catch(function (e) {
        // 直接当 iframe 用（部分资源不允许 CORS 但可以嵌入）
        document.querySelectorAll('div[style*="2147483646"]').forEach(function (n) { n.remove(); });
        frameView(url, '直连模式 · ' + e.message);
      });
  }

  var pin = prompt('PIN（留空 = 手动粘贴链接）', '');
  if (pin === null) return;
  pin = pin.trim();

  if (!pin) { manual('', '手动模式：粘贴下载链接'); return; }

  fetch(PAGE_OF(pin), { credentials: 'omit' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var links = [].slice.call(doc.querySelectorAll('td.download a'));
      if (!links.length) {
        links = [].slice.call(doc.querySelectorAll('a[href]')).filter(function (a) {
          return /下载|download/i.test(a.textContent || '');
        });
      }
      if (!links.length) throw new Error('页面上没有下载链接');

      var a = links.length > 1 ? links[1] : links[0];
      openFile(new URL(a.getAttribute('href'), 'https://www.fuulea.com/class/task/download/').href);
    })
    .catch(function (e) {
      manual(pin, '自动读取失败（' + e.message + '）。下载页有跨域限制，可以点下面按钮去新标签复制文件链接，再粘回来。');
    });
})();
