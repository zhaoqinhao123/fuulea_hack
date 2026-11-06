/* fuulea_hack loader — 二级面板（学习/查看/工具/便签）+ 拖动 + 小窗 */
(function () {
  if (document.getElementById('__fh')) return;

  // 自缓存：第一次注入后，把自身源码存进 localStorage，
  // 以后用 <img src=x onerror="eval(localStorage.fhL)"> 就能打开（45 字符）
  (function () {
    try {
      if (localStorage.getItem('fhL')) return;
      var x = new XMLHttpRequest();
      x.open('GET', 'https://cdn.jsdelivr.net/gh/zhaoqinhao123/fuulea_hack@v2.1/loader.js', true);
      x.timeout = 6000;
      x.onload = function () {
        if (x.status === 200) { try { localStorage.setItem('fhL', x.responseText); } catch (e) {} }
      };
      x.send();
    } catch (e) {}
  })();

  var MOD_BASES = [
    'https://cdn.jsdelivr.net/gh/zhaoqinhao123/fuulea_hack@v2.1/',
    'https://raw.githubusercontent.com/zhaoqinhao123/fuulea_hack/main/',
    'https://gitlab.com/api/v4/projects/88544686/repository/files/'
  ];

  function loadMod(path, btn) {
    function done() { if (btn) { btn.disabled = false; btn.style.opacity = 1; } }
    function cached(why) {
      var c = null;
      try { c = localStorage.getItem('fh:mod:' + path); } catch (e) {}
      if (c) { try { eval(c); return done(); } catch (e) {} }
      alert('加载失败：' + why);
      done();
    }
    var urls = [
      MOD_BASES[0] + path + '?t=' + Date.now(),
      MOD_BASES[1] + path + '?t=' + Date.now(),
      MOD_BASES[2] + encodeURIComponent(path) + '/raw?ref=main&t=' + Date.now()
    ];
    var i = 0;
    (function next() {
      if (i >= urls.length) return cached('三个源都没通');
      var s = document.createElement('script');
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true; s.remove(); next();
      }, 5000);
      s.onload = function () { if (settled) return; settled = true; clearTimeout(timer); s.remove(); done(); };
      s.onerror = function () { if (settled) return; settled = true; clearTimeout(timer); s.remove(); next(); };
      s.src = urls[i++];
      document.body.append(s);
    })();
  }

  var GROUPS = {
    '学习': [
      ['💰 积分', 'mods/score.js'],
      ['🐾 灵宠', 'mods/pets.js'],
      ['🖼 宠物图', 'mods/petimg.js'],
      ['➕ 加宠物', 'mods/petmax.js'],
      ['🔓 解锁4只', 'mods/unlock.js']
    ],
    '查看': [
      ['🔒 遮罩', 'mods/peek.js'],
      ['🌐 网页', 'mods/embed.js'],
      ['📖 小说', 'mods/novel.js'],
      ['🎵 音乐', 'mods/music.js'],
      ['🖼 图片', 'mods/img.js'],
      ['📦 存档', 'mods/dump.js']
    ],
    '工具': [
      ['📝 名单', 'mods/edit.js'],
      ['✏️ 改名', 'mods/rename.js'],
      ['🧹 清答案', 'mods/clean.js'],
      ['📂 文件', 'mods/browser.js'],
      ['📷 相机', 'mods/media.js'],
      ['💣 清空', 'mods/reset.js']
    ],
    '便签': []
  };

  var root = document.createElement('div');
  root.id = '__fh';
  root.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;font:13px/1.45 -apple-system,"PingFang SC",sans-serif;color:#eee;user-select:none;max-height:86vh;display:flex';

  var panel = document.createElement('div');
  panel.style.cssText = 'display:flex;flex-direction:column;width:min(300px,86vw);max-height:86vh;background:rgba(24,24,28,.96);border:1px solid #3a3a42;border-radius:14px;box-shadow:0 12px 34px rgba(0,0,0,.45);backdrop-filter:blur(10px);overflow:hidden';

  // 标题栏
  var head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px 10px;cursor:move;touch-action:none;flex-shrink:0';
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
  closeBtn.onclick = function () { root.remove(); };
  head.append(cat, title, minBtn, closeBtn);

  // 二级标签
  var tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;gap:4px;padding:0 10px 8px;flex-shrink:0';
  var tabBtns = {};
  Object.keys(GROUPS).forEach(function (name) {
    var b = document.createElement('button');
    b.textContent = name;
    b.style.cssText = 'flex:1;height:30px;border:1px solid #33333b;border-radius:8px;background:transparent;color:#8a8;font:12px/1 inherit;cursor:pointer';
    b.onclick = function () { show(name); };
    tabBtns[name] = b;
    tabs.append(b);
  });

  // 内容区
  var content = document.createElement('div');
  content.style.cssText = 'flex:1;min-height:0;overflow:auto;padding:0 10px 10px';

  function show(name) {
    Object.keys(tabBtns).forEach(function (k) {
      tabBtns[k].style.background = k === name ? '#2e2e37' : 'transparent';
      tabBtns[k].style.color = k === name ? '#ddd' : '#8a8';
    });
    content.innerHTML = '';

    if (name === '便签') return notes();

    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px';
    GROUPS[name].forEach(function (m) {
      var b = document.createElement('button');
      b.textContent = m[0];
      b.style.cssText = 'padding:9px 8px;border:1px solid #3a3a42;border-radius:9px;background:#26262c;color:#eee;cursor:pointer;font:inherit;white-space:nowrap;text-align:left';
      b.onmouseenter = function () { b.style.background = '#33333b'; };
      b.onmouseleave = function () { b.style.background = '#26262c'; };
      b.onclick = function () {
        b.disabled = true; b.style.opacity = .5;
        loadMod(m[1], b);
      };
      grid.append(b);
    });
    content.append(grid);
  }

  // 便签：一直写，自动保存
  function notes() {
    var KEY = 'fh:note';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;height:100%';

    var ta = document.createElement('textarea');
    ta.placeholder = '随手记点什么，自动保存…';
    ta.spellcheck = false;
    ta.style.cssText = 'width:100%;box-sizing:border-box;min-height:210px;max-height:52vh;padding:10px;border:1px solid #33333b;border-radius:10px;background:#141418;color:#ddd;font:12px/1.7 -apple-system,"PingFang SC",sans-serif;outline:none;resize:vertical';
    try { ta.value = localStorage.getItem(KEY) || ''; } catch (e) {}

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:6px;align-items:center';
    var stat = document.createElement('div');
    stat.style.cssText = 'flex:1;font-size:11px;color:#666';
    var copy = document.createElement('button');
    copy.textContent = '复制';
    copy.style.cssText = 'height:30px;padding:0 10px;border:1px solid #3a3a42;border-radius:8px;background:#222228;color:#bbb;font:12px/1 inherit;cursor:pointer';
    copy.onclick = function () {
      navigator.clipboard && navigator.clipboard.writeText(ta.value).then(function () {
        copy.textContent = '已复制';
        setTimeout(function () { copy.textContent = '复制'; }, 1200);
      });
    };
    var clr = document.createElement('button');
    clr.textContent = '清空';
    clr.style.cssText = copy.style.cssText;
    clr.onclick = function () {
      if (!confirm('清空便签？')) return;
      ta.value = '';
      try { localStorage.removeItem(KEY); } catch (e) {}
      stat.textContent = '已清空';
    };

    var t = null;
    ta.oninput = function () {
      clearTimeout(t);
      stat.textContent = '输入中…';
      t = setTimeout(function () {
        try { localStorage.setItem(KEY, ta.value); } catch (e) {}
        stat.textContent = '已保存 · ' + ta.value.length + ' 字';
      }, 300);
    };

    stat.textContent = ta.value ? ('已保存 · ' + ta.value.length + ' 字') : '';
    bar.append(stat, copy, clr);
    wrap.append(ta, bar);
    content.append(wrap);
  }

  panel.append(head, tabs, content);
  root.append(panel);
  document.body.append(root);
  show('学习');

  // 拖动
  (function () {
    var sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    head.addEventListener('pointerdown', function (e) {
      if (e.target.tagName === 'BUTTON') return;
      var r = root.getBoundingClientRect();
      root.style.left = r.left + 'px'; root.style.top = r.top + 'px';
      root.style.right = 'auto'; root.style.bottom = 'auto';
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; on = true;
      try { head.setPointerCapture(e.pointerId); } catch (err) {}
    });
    head.addEventListener('pointermove', function (e) {
      if (!on) return;
      root.style.left = Math.max(2, Math.min(ox + e.clientX - sx, innerWidth - 60)) + 'px';
      root.style.top = Math.max(2, Math.min(oy + e.clientY - sy, innerHeight - 40)) + 'px';
    });
    head.addEventListener('pointerup', function () { on = false; });
    head.addEventListener('pointercancel', function () { on = false; });
  })();

  // 小窗
  var mini = false;
  minBtn.onclick = function () {
    mini = !mini;
    tabs.style.display = mini ? 'none' : 'flex';
    content.style.display = mini ? 'none' : 'block';
    title.style.display = mini ? 'none' : 'block';
    minBtn.style.display = mini ? 'none' : 'block';
    closeBtn.style.display = mini ? 'none' : 'block';
    panel.style.borderRadius = mini ? '50%' : '14px';
    panel.style.width = mini ? 'auto' : 'min(300px,86vw)';
    head.style.padding = mini ? '4px' : '8px 10px';
    head.style.cursor = mini ? 'pointer' : 'move';
    cat.style.fontSize = mini ? '20px' : '15px';
    cat.style.width = mini ? '38px' : '26px';
    cat.style.height = mini ? '38px' : '24px';
    if (mini) {
      root.style.left = 'auto'; root.style.top = 'auto';
      root.style.right = '14px'; root.style.bottom = '14px';
      head.onclick = function (e) { if (e.target === head || e.target === cat) minBtn.onclick(); };
    } else {
      head.onclick = null;
    }
  };

  cat.onclick = function (e) {
    e.stopPropagation();
    if (mini) { minBtn.onclick(); return; }
    debugMenu();
  };

  // ── 通用小窗：给模块的全屏遮罩自动加一个 ◱ 按钮 ──
  (function () {
    var seen = new WeakSet();
    function decorate(el) {
      if (seen.has(el) || el.dataset.fhMini) return;
      seen.add(el);
      el.dataset.fhMini = '1';
      var b = document.createElement('button');
      b.textContent = '◱';
      b.title = '小窗/全屏';
      b.style.cssText = 'position:absolute;top:8px;right:8px;z-index:9;width:38px;height:34px;border:0;border-radius:9px;background:rgba(0,0,0,.45);color:#bbb;font-size:15px;cursor:pointer';
      b.onclick = function (e) {
        e.stopPropagation();
        if (el.dataset.mini === '1') {
          el.dataset.mini = '0';
          el.style.inset = '0';
          el.style.left = '';
          el.style.top = '';
          el.style.transform = '';
          el.style.width = '';
          el.style.height = '';
          el.style.borderRadius = '0';
          el.style.boxShadow = 'none';
        } else {
          el.dataset.mini = '1';
          el.style.inset = 'auto';
          el.style.left = '50%';
          el.style.top = '50%';
          el.style.transform = 'translate(-50%,-50%)';
          el.style.width = 'min(72vw,760px)';
          el.style.height = '72vh';
          el.style.borderRadius = '14px';
          el.style.boxShadow = '0 20px 60px rgba(0,0,0,.6)';
        }
      };
      el.appendChild(b);
    }
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        [].forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1 && n.tagName === 'DIV') {
            var cs = n.style;
            var full = (cs.position === 'fixed') && (
              cs.inset === '0px' ||
              (cs.top === '0px' && cs.left === '0px' && cs.right === '0px' && cs.bottom === '0px')
            );
            if (full) decorate(n);
          }
        });
      });
    }).observe(document.body, { childList: true });
  })();

  function debugMenu() {
    if (document.getElementById('__fhd')) { document.getElementById('__fhd').remove(); return; }
    var d = document.createElement('div');
    d.id = '__fhd';
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(8,8,10,.72);display:flex;align-items:center;justify-content:center;padding:16px';
    var box = document.createElement('div');
    box.style.cssText = 'width:min(380px,92vw);background:#1b1b20;border:1px solid #3a3a42;border-radius:14px;overflow:hidden';
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
      Object.keys(localStorage).filter(function (k) { return k.indexOf('fh:') === 0 && k !== 'fh:note'; })
        .forEach(function (k) { localStorage.removeItem(k); });
      alert('缓存已清空（便签保留）');
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

  function openCmd() {
    if (document.getElementById('__fhc')) { document.getElementById('__fhc').remove(); return; }
    var d = document.createElement('div');
    d.id = '__fhc';
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(8,8,10,.82);display:flex;align-items:flex-end;justify-content:center';
    var box = document.createElement('div');
    box.style.cssText = 'width:min(760px,100%);max-height:88vh;display:flex;flex-direction:column;background:#17171c;border:1px solid #34343c;border-radius:16px 16px 0 0;overflow:hidden';
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
    ta.placeholder = '任意 JS，Ctrl/⌘+Enter 运行';
    ta.spellcheck = false;
    ta.style.cssText = 'min-height:150px;max-height:46vh;padding:14px;border:0;outline:none;background:#111116;color:#d8e8d8;font:13px/1.7 ui-monospace,Menlo,monospace;resize:vertical';
    var out = document.createElement('div');
    out.style.cssText = 'flex:1;overflow:auto;padding:10px 14px;min-height:56px;max-height:24vh;color:#8a8;font:12px/1.7 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all;border-top:1px solid #2a2a32';
    out.textContent = '输出…';
    var hist = document.createElement('div');
    hist.style.cssText = 'display:flex;gap:6px;padding:6px 12px 10px;overflow:auto';
    var HKEY = 'fh:cmdhist';
    function getHist() { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) { return []; } }
    function drawHist() {
      hist.innerHTML = '';
      getHist().slice(0, 6).forEach(function (c) {
        var b = document.createElement('button');
        b.textContent = c.length > 16 ? c.slice(0, 16) + '…' : c;
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
      var arr = getHist().filter(function (x) { return x !== code; });
      arr.unshift(code);
      try { localStorage.setItem(HKEY, JSON.stringify(arr.slice(0, 12))); } catch (e) {}
      drawHist();
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
