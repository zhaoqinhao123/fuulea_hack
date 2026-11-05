/* 隐蔽遮罩：PIN / 直链 → 全屏查看（图片捏合缩放、HTML/PDF 滚动、DOCX 解析成网页） */
(function () {
  // fetch 在部分 WebView 会挂起：加超时 + XHR 兜底
  function getText(url, ms) {
    ms = ms || 8000;
    return new Promise(function (resolve, reject) {
      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (ctrl) { try { ctrl.abort(); } catch (e) {} }
        xhr();
      }, ms);
      var settled = false;
      function ok(t) { if (settled) return; settled = true; clearTimeout(timer); resolve(t); }
      function fail(e) { if (settled) return; settled = true; clearTimeout(timer); reject(e); }
      function xhr() {
        try {
          var x = new XMLHttpRequest();
          x.open('GET', url, true);
          x.timeout = ms;
          x.onload = function () { (x.status >= 200 && x.status < 300) ? ok(x.responseText) : fail(new Error('XHR ' + x.status)); };
          x.onerror = function () { fail(new Error('XHR error')); };
          x.ontimeout = function () { fail(new Error('XHR timeout')); };
          x.send();
        } catch (e) { fail(e); }
      }
      fetch(url, ctrl ? { signal: ctrl.signal, credentials: 'omit' } : { credentials: 'omit' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(ok, function () { xhr(); });
    });
  }

  var PAGE_OF = function (pin) { return 'https://t.fuulea.com/?pin=' + encodeURIComponent(pin); };
  var LAST = 'fh:lasturl';

  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }

  function proxyBase() { try { return localStorage.getItem('fh:proxy') || ''; } catch (e) { return ''; } }
  function viaProxy(url) {
    var p = proxyBase();
    return p ? p + encodeURIComponent(url) : url;
  }

  function bar(node, hint) {
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
    t.append(sp,
      b('−', function () { node.dispatchEvent(new CustomEvent('zo', { detail: -1 })); }),
      b('＋', function () { node.dispatchEvent(new CustomEvent('zo', { detail: 1 })); }),
      b('⟲', function () { node.dispatchEvent(new CustomEvent('zo', { detail: 0 })); }),
      b('✕', function () { d.remove(); }));
    d.append(t, node);
    document.body.append(d);
    return d;
  }

  function spinner(text) {
    var w = document.createElement('div');
    w.style.cssText = 'position:absolute;inset:52px 0 0 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#888;font:14px/1.6 -apple-system,"PingFang SC",sans-serif';
    var c = document.createElement('div');
    c.style.cssText = 'width:26px;height:26px;border:2px solid #444;border-top-color:#aaa;border-radius:50%;animation:fhspin .8s linear infinite';
    var st = document.createElement('style');
    st.textContent = '@keyframes fhspin{to{transform:rotate(360deg)}}';
    var p = document.createElement('div');
    p.textContent = text || '加载中…';
    w.append(c, p);
    document.head.append(st);
    return w;
  }

  // ── 图片 ──
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

    var lastDist = 0, dist = function (t) {
      var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };
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

    bar(wrap, '双指缩放 · 单指拖动');
  }

  // ── HTML / PDF ──
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

  // ── DOCX ──
  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      s.onload = function () { res(window.JSZip); };
      s.onerror = function () { rej(new Error('JSZip 加载失败（需要网络）')); };
      document.head.append(s);
    });
  }

  function docxToHtml(xml) {
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var ps = doc.getElementsByTagName('w:p');
    var out = [];
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i], txt = '';
      var ts = p.getElementsByTagName('w:t');
      for (var j = 0; j < ts.length; j++) txt += ts[j].textContent;
      var sty = p.getElementsByTagName('w:pStyle')[0];
      var sv = sty ? (sty.getAttribute('w:val') || '') : '';
      var esc = txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (!esc.trim()) { out.push('<div style="height:.55em"></div>'); continue; }
      if (/^(Heading1|1|标题\s*1)$/.test(sv)) out.push('<h2 style="font-size:1.32em;margin:1.1em 0 .5em;font-weight:700">' + esc + '</h2>');
      else if (/^(Heading2|2|标题\s*2)$/.test(sv)) out.push('<h3 style="font-size:1.14em;margin:.9em 0 .4em;font-weight:700">' + esc + '</h3>');
      else out.push('<p style="margin:.34em 0">' + esc + '</p>');
    }
    return out.join('') || '<p>（文档为空）</p>';
  }

  function docView(blob, hint) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;inset:52px 0 0 0;overflow:auto;background:#2b2b30;padding:16px 8px;-webkit-overflow-scrolling:touch';
    var page = document.createElement('div');
    page.style.cssText = 'max-width:760px;margin:0 auto;background:#fff;color:#222;padding:30px 26px;border-radius:8px;font:16px/1.95 -apple-system,"PingFang SC","Songti SC",serif;box-shadow:0 8px 28px rgba(0,0,0,.4)';
    page.textContent = '解析中…';
    wrap.append(page);

    var z = 1;
    wrap.addEventListener('zo', function (e) {
      var d = e.detail;
      z = !d ? 1 : clamp(d > 0 ? z * 1.12 : z / 1.12, 0.5, 3);
      page.style.fontSize = Math.round(16 * z) + 'px';
    });

    loadJSZip()
      .then(function (Z) { return Z.loadAsync(blob); })
      .then(function (zip) { return zip.file('word/document.xml').async('string'); })
      .then(function (xml) { page.innerHTML = docxToHtml(xml); })
      .catch(function (e) { page.textContent = '解析失败：' + e.message; });

    bar(wrap, hint || 'DOCX · 单指滚动');
  }

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name || 'file';
    a.click();
    alert('该格式无法内嵌预览，已触发下载：' + a.download);
  }

  function openFile(url) {
    try { localStorage.setItem(LAST, url); } catch (e) {}

    var loading = spinner('正在下载…');
    var d = bar(loading, url.split('/').pop().slice(0, 40));

    getText(viaProxy(url))
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      .then(function (blob) {
        d.remove();
        var name = decodeURIComponent(url.split('/').pop().split('?')[0] || '');
        var type = blob.type || '';
        if (/^image\//.test(type) || /\.(png|jpe?g|webp|gif)$/i.test(name)) imageView(blob);
        else if (/pdf/.test(type) || /\.pdf$/i.test(name)) frameView(URL.createObjectURL(blob), name);
        else if (/\.docx$/i.test(name) || /wordprocessingml/.test(type)) docView(blob, name);
        else if (/\.html?$/i.test(name) || /html/.test(type)) frameView(URL.createObjectURL(blob), name + ' · 可缩放/滚动');
        else download(blob, name);
      })
      .catch(function (e) {
        d.remove();
        alert('加载失败：' + e.message);
      });
  }

  function manual(pin, why) {
    var box = document.createElement('div');
    box.style.cssText = 'position:absolute;inset:52px 0 0 0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:16px;padding:20px;color:#bbb;font:14px/1.6 -apple-system,"PingFang SC",sans-serif';
    var tip = document.createElement('div');
    tip.textContent = why || '无法自动读取下载页';
    tip.style.cssText = 'max-width:560px;text-align:center;opacity:.6';

    var input = document.createElement('input');
    input.placeholder = '粘贴下载链接（s.100tifen.com/...）';
    try { input.value = localStorage.getItem(LAST) || ''; } catch (e) {}
    input.style.cssText = 'width:min(520px,88vw);padding:14px;border-radius:12px;border:1px solid #3a3a42;background:#1b1b20;color:#eee;font:15px/1.4 inherit;outline:none';

    var go = document.createElement('button');
    go.textContent = '打开';
    go.style.cssText = 'min-width:120px;height:48px;border:0;border-radius:12px;background:#33333b;color:#eee;font:15px/1 inherit;cursor:pointer';
    go.onclick = function () {
      var u = input.value.trim();
      if (u) openFile(u);
    };

    var open2 = document.createElement('button');
    open2.textContent = '去下载页复制链接';
    open2.style.cssText = 'min-width:160px;height:48px;border:1px solid #3a3a42;border-radius:12px;background:transparent;color:#999;font:15px/1 inherit;cursor:pointer';
    open2.onclick = function () { if (pin) window.open(PAGE_OF(pin), '_blank'); };

    var px = document.createElement('button');
    px.textContent = '⚙ 代理' + (proxyBase() ? '（已设置）' : '');
    px.style.cssText = 'height:34px;border:0;background:transparent;color:#666;font:12px/1 inherit;cursor:pointer';
    px.onclick = function () {
      var v = prompt('代理地址（留空 = 取消）\n格式：http://IP:8787/?url=', proxyBase());
      if (v === null) return;
      v = v.trim();
      try { v ? localStorage.setItem('fh:proxy', v) : localStorage.removeItem('fh:proxy'); } catch (e) {}
      alert(v ? '已保存，重新输入 PIN 即可全自动' : '已取消代理');
    };

    box.append(tip, input, go, open2, px);
    bar(box, '手动模式');
  }

  var saved = '';
  try { saved = localStorage.getItem(LAST) || ''; } catch (e) {}

  var v = prompt('PIN 或直链（留空 = 手动模式）', saved);
  if (v === null) return;
  v = v.trim();
  if (!v) { manual('', '手动模式：粘贴下载链接'); return; }
  if (/^https?:\/\//i.test(v)) { openFile(v); return; }

  getText(viaProxy(PAGE_OF(v)))
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
      manual(v, '自动读取失败（' + e.message + '）。下载页有跨域限制，点下面按钮去新标签复制文件链接再粘回来。');
    });
})();
