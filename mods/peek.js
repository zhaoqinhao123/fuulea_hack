/* 隐蔽遮罩：pin → t.fuulea.com → 取第二个下载按钮 → 全屏查看（缩放 / 拖动 / 滚动） */
(function () {
  var pin = prompt('PIN', '');
  if (pin === null) return;
  pin = pin.trim();
  if (!pin) return;

  var PAGE = 'https://t.fuulea.com/?pin=' + encodeURIComponent(pin);

  function mkOverlay(node, hint) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(16,16,18,.97);overflow:hidden';
    var bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;top:0;left:0;right:0;height:36px;display:flex;align-items:center;gap:6px;padding:0 10px;background:rgba(0,0,0,.4);color:#aaa;font:12px/1 -apple-system,"PingFang SC",sans-serif;z-index:3';
    var tip = document.createElement('span');
    tip.textContent = hint || '';
    tip.style.cssText = 'flex:1;opacity:.5;overflow:hidden;white-space:nowrap;text-overflow:ellipsis';
    function btn(t, fn) {
      var b = document.createElement('button');
      b.textContent = t;
      b.style.cssText = 'border:0;background:transparent;color:#aaa;font-size:14px;cursor:pointer;padding:5px 9px;font-family:inherit';
      b.onclick = fn;
      return b;
    }
    bar.append(tip,
      btn('−', function () { node.dispatchEvent(new CustomEvent('zoomout')); }),
      btn('＋', function () { node.dispatchEvent(new CustomEvent('zoomin')); }),
      btn('⟲', function () { node.dispatchEvent(new CustomEvent('zoomreset')); }),
      btn('✕', function () { d.remove(); }));
    d.append(bar, node);
    document.body.append(d);
    return d;
  }

  function viewer(blob) {
    var url = URL.createObjectURL(blob);
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;inset:36px 0 0 0;overflow:auto;background:#0e0e10;touch-action:pan-x pan-y;text-align:center;white-space:nowrap';

    var img = new Image();
    img.src = url;
    img.style.cssText = 'display:inline-block;vertical-align:top;margin:0 auto;max-width:none;user-select:none;-webkit-user-drag:none;cursor:grab';
    img.draggable = false;
    wrap.append(img);

    var z = 1, w0 = 0;
    function fit() {
      w0 = img.naturalWidth || 800;
      var maxW = wrap.clientWidth * 0.96;
      z = w0 > maxW ? maxW / w0 : 1;
      apply();
    }
    function apply() { img.style.width = Math.max(80, Math.round(w0 * z)) + 'px'; }
    img.onload = fit;
    wrap.addEventListener('zoomin', function () { z = Math.min(z * 1.25, 8); apply(); });
    wrap.addEventListener('zoomout', function () { z = Math.max(z / 1.25, 0.1); apply(); });
    wrap.addEventListener('zoomreset', fit);

    wrap.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      var r = img.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      var nz = Math.min(Math.max(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.1), 8);
      var sx = wrap.scrollLeft + e.clientX - wrap.getBoundingClientRect().left;
      var sy = wrap.scrollTop + e.clientY - wrap.getBoundingClientRect().top;
      z = nz; apply();
      wrap.scrollLeft = sx - px * img.clientWidth;
      wrap.scrollTop = sy - py * img.clientHeight;
    }, { passive: false });

    var down = false, mx = 0, my = 0, sl = 0, st = 0;
    wrap.addEventListener('mousedown', function (e) {
      down = true; mx = e.clientX; my = e.clientY; sl = wrap.scrollLeft; st = wrap.scrollTop;
      img.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', function (e) {
      if (!down) return;
      wrap.scrollLeft = sl - (e.clientX - mx);
      wrap.scrollTop = st - (e.clientY - my);
    });
    window.addEventListener('mouseup', function () { down = false; img.style.cursor = 'grab'; });

    mkOverlay(wrap, '滚轮=滚动 · Ctrl+滚轮=缩放 · 拖动=平移');
  }

  function showPdf(blob) {
    var f = document.createElement('iframe');
    f.src = URL.createObjectURL(blob);
    f.style.cssText = 'position:absolute;inset:36px 0 0 0;width:100%;height:calc(100% - 36px);border:0;background:#fff';
    mkOverlay(f, 'PDF');
  }

  function fallback(msg) {
    var f = document.createElement('iframe');
    f.src = PAGE;
    f.style.cssText = 'position:absolute;inset:36px 0 0 0;width:100%;height:calc(100% - 36px);border:0;background:#fff';
    mkOverlay(f, msg || '直接打开页面');
  }

  fetch(PAGE, { credentials: 'omit' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var all = [].slice.call(doc.querySelectorAll('a[href],button,[onclick]'));
      var cands = all.filter(function (el) {
        var h = el.getAttribute('href') || el.getAttribute('data-href') || el.getAttribute('data-url') || '';
        var t = (el.textContent || '') + ' ' + (el.getAttribute('title') || '') + ' ' + (el.getAttribute('download') || '');
        return /\.(pdf|png|jpe?g|webp|gif|zip|docx?)(\?|#|$)/i.test(h) || /下载|download|原图|答案|查看/i.test(t);
      });
      var pick = cands[1] || cands[0];
      var href = pick && (pick.getAttribute('href') || pick.getAttribute('data-href') || pick.getAttribute('data-url'));
      if (!href) throw new Error('没找到下载按钮（页面可能有 JS 校验）');
      var abs = new URL(href, PAGE).href;
      return fetch(abs, { credentials: 'omit' }).then(function (r) {
        if (!r.ok) throw new Error('文件 HTTP ' + r.status);
        return r.blob();
      }).then(function (b) {
        if (/^image\//.test(b.type) || /\.(png|jpe?g|webp|gif)$/i.test(abs)) viewer(b);
        else if (/pdf/i.test(b.type) || /\.pdf$/i.test(abs)) showPdf(b);
        else {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = decodeURIComponent(abs.split('/').pop().split('?')[0]) || 'file';
          a.click();
          alert('已触发下载：' + a.download);
        }
      });
    })
    .catch(function (e) {
      fallback('自动获取失败（' + e.message + '）· 已切到直连页面');
    });
})();
