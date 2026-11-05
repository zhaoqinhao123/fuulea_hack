/* fuulea_hack loader — 可拖动面板 / 小猫进入调试 / 指令板 */
(function () {
  if (document.getElementById('__fh')) return;

  var BASES = [
    'https://raw.githubusercontent.com/zhaoqinhao123/fuulea_hack/main/',
    'https://cdn.jsdelivr.net/gh/zhaoqinhao123/fuulea_hack@main/',
    'https://gitlab.com/api/v4/projects/88544686/repository/files/'
  ];
  function srcUrl(i, path) {
    if (i === 2) return BASES[2] + encodeURIComponent(path) + '/raw?ref=main&t=' + Date.now();
    return BASES[i] + path + '?t=' + Date.now();
  }

  var MODS = [
    ['💰 积分', 'mods/score.js'],
    ['🐾 灵宠', 'mods/pets.js'],
    ['🖼 宠物图', 'mods/petimg.js'],
    ['➕ 加宠物', 'mods/petmax.js'],
    ['🔓 解锁4只', 'mods/unlock.js'],
    ['✏️ 改名', 'mods/rename.js'],
    ['🧹 清答案', 'mods/clean.js'],
    ['🔒 遮罩', 'mods/peek.js'],
    ['🖼 图片', 'mods/img.js'],
    ['🌐 网页', 'mods/embed.js'],
    ['📦 存档', 'mods/dump.js'],
    ['📂 文件', 'mods/browser.js'],
    ['📷 相机', 'mods/media.js'],
    ['💣 清空', 'mods/reset.js']
  ];

  // ── 加载模块（三级源 + 缓存） ──
  function loadMod(path, btn) {
    var key = 'fh:mod:' + path;
    function done() { if (btn) { btn.disabled = false; btn.style.opacity = 1; } }
    function cached(why) {
      var c = null;
      try { c = localStorage.getItem(key); } catch (e) {}
      if (c) { try { eval(c); return done(); } catch (e) {} }
      alert('加载失败：' + why);
      done();
    }
    var i = 0;
    (function next() {
      if (i >= BASES.length) return cached('三个源都没通');
      fetch(srcUrl(i++, path))
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (t) {
          try { localStorage.setItem(key, t); } catch (e) {}
          eval(t);
          done();
        })
        .catch(next);
    })();
  }

  // ── 基础 UI ──
  var root = document.createElement('div');
  root.id = '__fh';
  root.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;font:13px/1.45 -apple-system,"PingFang SC",sans-serif;color:#eee;user-select:none';

  var panel = document.createElement('div');
  panel.style.cssText = 'background:rgba(24,24,28,.95);border:1px solid #3a3a42;border-radius:14px;box-shadow:0 12px 34px rgba(0,0,0,.45);backdrop-filter:blur(10px);overflow:hidden;transition:border-radius .15s';

  var head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px 10px;cursor:move;touch-action:none';

  var cat = document.createElement('button');
  cat.textContent = '🐱';
  cat.title = '调试';
  cat.style.cssText = 'width:26px;height:24px;border:0;border-radius:7px;background:transparent;font:15px/1 inherit;cursor:pointer;padding:0';

  var title = document.createElement('div');
  title.textContent = 'fuulea_hack';
  title.style.cssText = 'flex:1;font:700 12px/1.2 inherit;color:#9aa;letter-spacing:.5px';

  function icon(t, tip) {
    var b = document.createElement('button');
    b.textContent = t;
    b.title = tip || '';
    b.style.cssText = 'width:26px;height:24px;border:0;border-radius:7px;background:transparent;color:#9aa;font:14px/1 inherit;cursor:pointer;padding:0';
    b.onmouseenter = function () { b.style.background = '#33333b'; };
    b.onmouseleave = function () { b.style.background = 'transparent'; };
    return b;
  }
  var minBtn = icon('−', '小窗');
  var closeBtn = icon('✕', '关闭');
  head.append(cat, title, minBtn, closeBtn);

  var body = document.createElement('div');
  body.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:0 10px 10px';

  MODS.forEach(function (m) {
    var b = document.createElement('button');
    b.textContent = m[0];
    b.style.cssText = 'padding:8px 10px;border:1px solid #3a3a42;border-radius:9px;background:#26262c;color:#eee;cursor:pointer;font:inherit;white-space:nowrap;text-align:left';
    b.onmouseenter = function () { b.style.background = '#33333b'; };
    b.onmouseleave = function () { b.style.background = '#26262c'; };
    b.onclick = function () {
      b.disabled = true; b.style.opacity = .5;
      loadMod(m[1], b);
    };
    body.append(b);
  });

  panel.append(head, body);
  root.append(panel);
  document.body.append(root);

  // ── 拖动 ──
  (function () {
    var sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    head.addEventListener('pointerdown', function (e) {
      if (e.target.tagName === 'BUTTON') return;
      var r = root.getBoundingClientRect();
      root.style.left = r.left + 'px';
      root.style.top = r.top + 'px';
      root.style.right = 'auto';
      root.style.bottom = 'auto';
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; on = true;
      try { head.setPointerCapture(e.pointerId); } catch (err) {}
    });
    head.addEventListener('pointermove', function (e) {
      if (!on) return;
      var nx = ox + e.clientX - sx, ny = oy + e.clientY - sy;
      nx = Math.max(2, Math.min(nx, innerWidth - 60));
      ny = Math.max(2, Math.min(ny, innerHeight - 40));
      root.style.left = nx + 'px';
      root.style.top = ny + 'px';
    });
    head.addEventListener('pointerup', function () { on = false; });
    head.addEventListener('pointercancel', function () { on = false; });
  })();

  // ── 小窗 ──
  var mini = false;
  minBtn.onclick = function () {
    mini = !mini;
    body.style.display = mini ? 'none' : 'grid';
    title.style.display = mini ? 'none' : 'block';
    minBtn.style.display = mini ? 'none' : 'block';
    panel.style.borderRadius = mini ? '50%' : '14px';
    head.style.padding = mini ? '4px' : '8px 10px';
    head.style.cursor = mini ? 'pointer' : 'move';
    closeBtn.style.display = mini ? 'none' : 'block';
    cat.style.fontSize = mini ? '20px' : '15px';
    cat.style.width = mini ? '38px' : '26px';
    cat.style.height = mini ? '38px' : '24px';
    if (mini) {
      root.style.left = 'auto';
      root.style.top = 'auto';
      root.style.right = '14px';
      root.style.bottom = '14px';
      head.onclick = function (e) {
        if (e.target === head || e.target === cat) { minBtn.onclick(); }
      };
    } else {
      head.onclick = null;
    }
  };

  // ── 小猫 → 调试菜单 ──
  cat.onclick = function (e) {
    e.stopPropagation();
    if (mini) { minBtn.onclick(); return; }
    debugMenu();
  };

  function debugMenu() {
    if (document.getElementById('__fhd')) { document.getElementById('__fhd').remove(); return; }
    var d = document.createElement('div');
    d.id = '__fhd';
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(8,8,10,.72);display:flex;align-items:center;justify-content:center;padding:16px';
    var box = document.createElement('div');
    box.style.cssText = 'width:min(380px,92vw);background:#1b1b20;border:1px solid #3a3a42;border-radius:14px;overflow:hidden;color:#ddd;font:13px/1.5 -apple-system,"PingFang SC",sans-serif';
    var h = document.createElement('div');
    h.style.cssText = 'padding:12px 14px;border-bottom:1px solid #2e2e35;color:#bbb;font-weight:700';
    h.textContent = '🐱 调试';
    var list = document.createElement('div');
    list.style.cssText = 'padding:8px';

    function item(t, fn) {
      var b = document.createElement('button');
      b.textContent = t;
      b.style.cssText = 'display:block;width:100%;text-align:left;padding:12px 10px;margin:2px 0;border:0;border-radius:9px;background:transparent;color:#ddd;font:13px/1 inherit;cursor:pointer';
      b.onmouseenter = function () { b.style.background = '#26262c'; };
      b.onmouseleave = function () { b.style.background = 'transparent'; };
      b.onclick = fn;
      list.append(b);
    }

    item('🧪 环境自检', function () { d.remove(); loadMod('mods/test.js'); });
    item('⌨ 指令板', function () { d.remove(); openCmd(); });
    item('🧹 清缓存（所有 fh:*）', function () {
      Object.keys(localStorage).filter(function (k) { return k.indexOf('fh:') === 0; })
        .forEach(function (k) { localStorage.removeItem(k); });
      alert('缓存已清空');
    });
    item('📋 查看缓存键', function () {
      var ks = Object.keys(localStorage).filter(function (k) { return k.indexOf('fh:') === 0; });
      alert(ks.length ? ks.join('\n') : '（无）');
    });
    item('🚪 关闭', function () { d.remove(); });

    box.append(h, list);
    d.append(box);
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    document.body.append(d);
  }

  // ── 指令板 ──
  function openCmd() {
    if (document.getElementById('__fhc')) { document.getElementById('__fhc').remove(); return; }
    var d = document.createElement('div');
    d.id = '__fhc';
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(8,8,10,.82);display:flex;align-items:flex-end;justify-content:center;padding:0';
    var box = document.createElement('div');
    box.style.cssText = 'width:min(760px,100%);max-height:88vh;display:flex;flex-direction:column;background:#17171c;border:1px solid #34343c;border-radius:16px 16px 0 0;overflow:hidden;font:13px/1.55 -apple-system,"PingFang SC",sans-serif;color:#ddd';

    var h = document.createElement('div');
    h.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #2a2a32';
    var t = document.createElement('div');
    t.textContent = '指令板';
    t.style.cssText = 'flex:1;font-weight:700;color:#bbb';
    var clr = document.createElement('button');
    clr.textContent = '清空';
    clr.style.cssText = 'height:34px;padding:0 12px;border:1px solid #3a3a42;border-radius:9px;background:#222228;color:#bbb;font:13px/1 inherit;cursor:pointer';
    var run = document.createElement('button');
    run.textContent = '▶ 运行';
    run.style.cssText = 'height:34px;padding:0 14px;border:0;border-radius:9px;background:#3a6df0;color:#fff;font:13px/1 inherit;cursor:pointer';
    var x = document.createElement('button');
    x.textContent = '✕';
    x.style.cssText = 'width:34px;height:34px;border:0;border-radius:9px;background:transparent;color:#999;font-size:16px;cursor:pointer';
    x.onclick = function () { d.remove(); };
    h.append(t, clr, run, x);

    var ta = document.createElement('textarea');
    ta.placeholder = '任意 JS，例如：state.score=9999; save(); renderHome()';
    ta.spellcheck = false;
    ta.style.cssText = 'flex:0 0 auto;min-height:150px;max-height:46vh;padding:14px;border:0;outline:none;background:#111116;color:#d8e8d8;font:13px/1.7 ui-monospace,Menlo,monospace;resize:vertical';
    ta.oninput = function () {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight + 4, Math.round(innerHeight * 0.46)) + 'px';
    };

    var out = document.createElement('div');
    out.style.cssText = 'flex:1;overflow:auto;padding:10px 14px;min-height:60px;max-height:26vh;color:#8a8;font:12px/1.7 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all;border-top:1px solid #2a2a32';
    out.textContent = '输出…';

    var hist = document.createElement('div');
    hist.style.cssText = 'display:flex;gap:6px;padding:6px 12px 10px;overflow:auto';
    var HKEY = 'fh:cmdhist';
    function getHist() { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) { return []; } }
    function pushHist(code) {
      var arr = getHist().filter(function (x) { return x !== code; });
      arr.unshift(code);
      try { localStorage.setItem(HKEY, JSON.stringify(arr.slice(0, 12))); } catch (e) {}
      drawHist();
    }
    function drawHist() {
      hist.innerHTML = '';
      getHist().slice(0, 6).forEach(function (c) {
        var b = document.createElement('button');
        b.textContent = c.length > 18 ? c.slice(0, 18) + '…' : c;
        b.title = c;
        b.style.cssText = 'flex-shrink:0;padding:6px 10px;border:1px solid #333;border-radius:8px;background:#1e1e24;color:#888;font:11px/1 inherit;cursor:pointer';
        b.onclick = function () { ta.value = c; ta.focus(); };
        hist.append(b);
      });
    }
    drawHist();

    function log(s) { out.textContent += (out.textContent === '输出…' ? '' : '\n') + s; out.scrollTop = out.scrollHeight; }

    run.onclick = function () {
      var code = ta.value.trim();
      if (!code) return;
      out.textContent = '';
      pushHist(code);
      var old = { log: console.log, warn: console.warn, error: console.error };
      console.log = console.warn = console.error = function () {
        log(Array.prototype.map.call(arguments, function (a) {
          try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch (e) { return String(a); }
        }).join(' '));
      };
      try {
        var r = eval(code);
        if (r !== undefined) log('⇒ ' + (typeof r === 'object' ? JSON.stringify(r) : String(r)));
        if (!out.textContent) log('（无输出）');
      } catch (e) {
        log('✕ ' + (e && e.message ? e.message : String(e)));
      } finally {
        console.log = old.log; console.warn = old.warn; console.error = old.error;
      }
    };

    clr.onclick = function () { ta.value = ''; out.textContent = '输出…'; ta.focus(); };

    ta.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run.click(); }
    });

    box.append(h, ta, out, hist);
    d.append(box);
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    document.body.append(d);
    setTimeout(function () { ta.focus(); }, 50);
  }
})();
