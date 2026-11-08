/* fuulea_hack loader — 二级面板（学习/查看/工具/便签）+ 拖动 + 小窗 */
(function () {
  if (document.getElementById('__fh')) return;

  // 自缓存：第一次注入后，把自身源码存进 localStorage，
  // 以后用 <img src=x onerror="eval(localStorage.fhL)"> 就能打开（45 字符）
  var TAG = 'v2.11';
  try { window.__fhTag = TAG; } catch (e) {}
  (function () {
    try {
      if (localStorage.getItem('fhV') === TAG && localStorage.getItem('fhL')) return;
      var x = new XMLHttpRequest();
      x.open('GET', 'https://cdn.jsdelivr.net/gh/zhaoqinhao123/fuulea_hack@' + TAG + '/loader.js', true);
      x.timeout = 6000;
      x.onload = function () {
        if (x.status === 200) {
          try { localStorage.setItem('fhL', x.responseText); localStorage.setItem('fhV', TAG); } catch (e) {}
        }
      };
      x.send();
    } catch (e) {}
  })();

  var MOD_BASES = [
    'https://cdn.jsdelivr.net/gh/zhaoqinhao123/fuulea_hack@' + TAG + '/',
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
      ['🧩 转印', 'mods/tile.js'],
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

  // ── 样式：只注入一次，以后改外观只改这里 ──
  if (!document.getElementById('__fhcss')) {
    var stEl = document.createElement('style');
    stEl.id = '__fhcss';
    stEl.textContent = [
      '#__fh{position:fixed;right:14px;bottom:14px;z-index:2147483647;display:flex;',
      'font:13px/1.45 -apple-system,"PingFang SC",sans-serif;color:#e8e8f0;',
      'user-select:none;-webkit-user-select:none}',
      '#__fh .fh-panel{display:flex;flex-direction:column;width:min(318px,88vw);max-height:86vh;',
      'background:linear-gradient(180deg,rgba(32,32,39,.97),rgba(20,20,26,.98));',
      'border:1px solid rgba(255,255,255,.1);border-radius:16px;overflow:hidden;',
      'box-shadow:0 18px 48px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.07);',
      'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}',
      '#__fh .fh-head{display:flex;align-items:center;gap:7px;padding:9px 10px 8px;',
      'cursor:move;touch-action:none;flex-shrink:0}',
      '#__fh .fh-title{flex:1;min-width:0;font:700 11px/1.2 inherit;color:#898998;',
      'letter-spacing:.9px;text-transform:uppercase;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}',
      '#__fh .fh-ico{width:28px;height:26px;flex-shrink:0;border:0;border-radius:8px;',
      'background:transparent;color:#898998;font:14px/1 inherit;cursor:pointer;',
      'padding:0;display:grid;place-items:center}',
      '#__fh .fh-ico:active{background:rgba(255,255,255,.16);color:#fff}',
      '#__fh .fh-tabs{display:flex;gap:4px;padding:0 10px 9px;flex-shrink:0}',
      '#__fh .fh-tab{flex:1;height:30px;border:0;border-radius:9px;',
      'background:rgba(255,255,255,.05);color:#8a8a99;font:12px/1 inherit;cursor:pointer}',
      '#__fh .fh-tab.on{background:linear-gradient(180deg,#4d7ef8,#3a62d6);color:#fff;',
      'font-weight:600;box-shadow:0 3px 10px rgba(58,98,214,.42)}',
      '#__fh .fh-content{flex:1;min-height:0;overflow:auto;padding:0 10px 10px;',
      'overscroll-behavior:contain}',
      '#__fh .fh-content::-webkit-scrollbar{width:6px}',
      '#__fh .fh-content::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:9px}',
      '#__fh .fh-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
      '#__fh .fh-mod{padding:10px 9px;border:1px solid rgba(255,255,255,.08);border-radius:10px;',
      'background:rgba(255,255,255,.05);color:#dcdce6;cursor:pointer;font:12.5px/1.2 inherit;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}',
      '#__fh .fh-mod:active{background:rgba(255,255,255,.16);transform:scale(.97)}',
      '#__fh .fh-mod[disabled]{opacity:.5;cursor:progress;transform:none}',
      '#__fh .fh-ta{width:100%;min-height:210px;max-height:none;padding:10px;',
      'border:1px solid rgba(255,255,255,.1);border-radius:11px;background:rgba(0,0,0,.34);',
      'color:#d8d8e0;font:12px/1.7 inherit;outline:none;resize:vertical}',
      '#__fh .fh-ta:focus{border-color:rgba(77,126,248,.7);box-shadow:0 0 0 3px rgba(77,126,248,.15)}',
      '#__fh .fh-bar{display:flex;gap:6px;align-items:center;margin-top:6px}',
      '#__fh .fh-stat{flex:1;min-width:0;font-size:11px;color:#6b6b78;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}',
      '#__fh .fh-btn{height:30px;padding:0 11px;border:1px solid rgba(255,255,255,.11);',
      'border-radius:8px;background:rgba(255,255,255,.06);color:#a6a6b4;',
      'font:12px/1 inherit;cursor:pointer}',
      '#__fh .fh-btn:active{background:rgba(255,255,255,.16);color:#fff}',
      '#__fh .fh-cat{width:24px;height:24px;flex-shrink:0;border:0;border-radius:50%;',
      'background:transparent;font:15px/1 inherit;cursor:pointer;padding:0;',
      'display:grid;place-items:center}',
      '#__fh.is-mini .fh-panel{width:88px;border-radius:999px;border-color:rgba(255,255,255,.18);',
      'box-shadow:0 10px 26px rgba(0,0,0,.5)}',
      '#__fh.is-mini .fh-head{padding:5px 6px;gap:2px;justify-content:center;cursor:move}',
      '#__fh.is-mini .fh-title,#__fh.is-mini .fh-tabs,#__fh.is-mini .fh-content,#__fh.is-mini .fh-min{display:none}',
      '#__fh.is-mini .fh-ico{width:26px;height:26px;font:13px/1 inherit;border-radius:50%}',
      '#__fh.is-mini .fh-cat{width:32px;height:32px;font-size:20px}'
    ].join('');
    (document.head || document.documentElement).appendChild(stEl);
  }

  var root = document.createElement('div');
  root.id = '__fh';

  var panel = document.createElement('div');
  panel.className = 'fh-panel';

  // 标题栏
  var head = document.createElement('div');
  head.className = 'fh-head';
  var cat = document.createElement('button');
  cat.className = 'fh-cat';
  cat.textContent = '🐱';
  cat.title = '菜单';
  var title = document.createElement('div');
  title.className = 'fh-title';
  title.textContent = 'fuulea_hack';
  function icon(t, tip) {
    var b = document.createElement('button');
    b.className = 'fh-ico';
    b.textContent = t;
    b.title = tip || '';
    return b;
  }
  var minBtn = icon('−', '收起成小圆点');
  minBtn.className = 'fh-ico fh-min';
  var closeBtn = icon('✕', '关闭');
  closeBtn.className = 'fh-ico fh-close';
  closeBtn.onclick = function () { root.remove(); };
  head.append(cat, title, minBtn, closeBtn);

  // 二级标签
  var tabs = document.createElement('div');
  tabs.className = 'fh-tabs';
  var tabBtns = {};
  Object.keys(GROUPS).forEach(function (name) {
    var b = document.createElement('button');
    b.className = 'fh-tab';
    b.textContent = name;
    b.onclick = function () { show(name); };
    tabBtns[name] = b;
    tabs.append(b);
  });

  // 内容区
  var content = document.createElement('div');
  content.className = 'fh-content';

  function show(name) {
    Object.keys(tabBtns).forEach(function (k) {
      if (k === name) tabBtns[k].classList.add('on');
      else tabBtns[k].classList.remove('on');
    });
    content.innerHTML = '';

    if (name === '便签') return notes();

    var grid = document.createElement('div');
    grid.className = 'fh-grid';
    GROUPS[name].forEach(function (m) {
      var b = document.createElement('button');
      b.className = 'fh-mod';
      b.textContent = m[0];
      b.onclick = function () {
        b.disabled = true;
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
    ta.className = 'fh-ta';
    ta.placeholder = '随手记点什么，自动保存…';
    ta.spellcheck = false;
    // 触屏上原生 resize 手柄不可用：关掉它，改自绘手柄
    ta.style.resize = 'none';
    ta.style.flex = '1';
    ta.style.minHeight = '96px';
    try { var h0 = localStorage.getItem('fh:note:h'); if (h0) ta.style.height = h0 + 'px'; } catch (e) {}
    try { ta.value = localStorage.getItem(KEY) || ''; } catch (e) {}

    var bar = document.createElement('div');
    bar.className = 'fh-bar';
    var stat = document.createElement('div');
    stat.className = 'fh-stat';
    var copy = document.createElement('button');
    copy.className = 'fh-btn';
    copy.textContent = '复制';
    copy.onclick = function () {
      var txt = ta.value;
      function ok() {
        copy.textContent = '已复制';
        setTimeout(function () { copy.textContent = '复制'; }, 1200);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(ok, function () { fallback(); });
      } else fallback();
      function fallback() {
        ta.select();
        try { document.execCommand('copy'); ok(); } catch (e) {}
      }
    };
    var clr = document.createElement('button');
    clr.className = 'fh-btn';
    clr.textContent = '清空';
    clr.onclick = function () {
      if (!confirm('清空便签？')) return;
      ta.value = '';
      try { localStorage.removeItem(KEY); } catch (e) {}
      stat.textContent = '已清空';
    };

    // 自绘纵向拖拽条：上下拖改高度
    var dragBar = document.createElement('div');
    dragBar.style.cssText = 'flex:0 0 14px;height:14px;margin:-3px 0 -1px;cursor:ns-resize;' +
      'touch-action:none;display:grid;place-items:center';
    var dragDot = document.createElement('div');
    dragDot.style.cssText = 'width:48px;height:4px;border-radius:3px;background:rgba(255,255,255,.22)';
    dragBar.append(dragDot);
    (function () {
      var g = null;
      dragBar.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        var r = ta.getBoundingClientRect();
        g = { y: e.clientY, h: r.height };
        ta.style.flex = 'none';
        ta.style.height = r.height + 'px';
        try { dragBar.setPointerCapture(e.pointerId); } catch (err) {}
      });
      dragBar.addEventListener('pointermove', function (e) {
        if (!g) return;
        var nh = Math.max(96, Math.min(g.h + e.clientY - g.y, 4000));
        ta.style.height = nh + 'px';
      });
      dragBar.addEventListener('pointerup', function () {
        if (!g) return;
        g = null;
        try { localStorage.setItem('fh:note:h', String(Math.round(ta.getBoundingClientRect().height))); } catch (e) {}
      });
      dragBar.addEventListener('pointercancel', function () { g = null; });
    })();

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
    wrap.append(ta, dragBar, bar);
    content.append(wrap);
  }

  // 缩放手柄（右下角，仅主面板）
  panel.style.position = 'relative';
  var pGrip = document.createElement('div');
  pGrip.style.cssText = 'position:absolute;right:3px;bottom:3px;width:18px;height:18px;cursor:se-resize;' +
    'touch-action:none;opacity:.55;background:linear-gradient(135deg,transparent 44%,rgba(255,255,255,.35) 44%,' +
    'rgba(255,255,255,.35) 52%,transparent 52%,transparent 64%,rgba(255,255,255,.35) 64%,rgba(255,255,255,.35) 72%,transparent 72%)';
  (function () {
    var g = null;
    pGrip.addEventListener('pointerdown', function (e) {
      e.stopPropagation(); e.preventDefault();
      var r = panel.getBoundingClientRect();
      panel.style.width = r.width + 'px';
      panel.style.height = r.height + 'px';
      panel.style.maxHeight = 'none';
      g = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
      try { pGrip.setPointerCapture(e.pointerId); } catch (err) {}
    });
    pGrip.addEventListener('pointermove', function (e) {
      if (!g) return;
      panel.style.width = Math.max(230, g.w + e.clientX - g.x) + 'px';
      panel.style.height = Math.max(170, g.h + e.clientY - g.y) + 'px';
    });
    pGrip.addEventListener('pointerup', function () { g = null; });
    pGrip.addEventListener('pointercancel', function () { g = null; });
  })();
  panel.append(pGrip);
  panel.append(head, tabs, content);
  root.append(panel);
  document.body.append(root);
  show('学习');

  // 拖动（小窗态不拖）
  var dragMoved = false;
  (function () {
    var sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    head.addEventListener('pointerdown', function (e) {
      if (e.target.tagName === 'BUTTON') return;
      dragMoved = false;
      var r = root.getBoundingClientRect();
      root.style.left = r.left + 'px'; root.style.top = r.top + 'px';
      root.style.right = 'auto'; root.style.bottom = 'auto';
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; on = true;
      try { head.setPointerCapture(e.pointerId); } catch (err) {}
    });
    head.addEventListener('pointermove', function (e) {
      if (!on) return;
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 6) dragMoved = true;
      root.style.left = Math.max(2, Math.min(ox + e.clientX - sx, innerWidth - 60)) + 'px';
      root.style.top = Math.max(2, Math.min(oy + e.clientY - sy, innerHeight - 40)) + 'px';
    });
    head.addEventListener('pointerup', function () { on = false; });
    head.addEventListener('pointercancel', function () { on = false; });
  })();

  // 小窗
  var mini = false;
  var savedW = '', savedH = '', savedMax = '', savedPos = null;
  minBtn.onclick = function () {
    mini = !mini;
    root.classList.toggle('is-mini', mini);
    if (mini) {
      // 自定义尺寸会让 CSS 的 88px 失效，先收起来
      savedW = panel.style.width;
      savedH = panel.style.height;
      savedMax = panel.style.maxHeight;
      panel.style.width = '';
      panel.style.height = '';
      panel.style.maxHeight = '';
      savedPos = {
        left: root.style.left, top: root.style.top,
        right: root.style.right, bottom: root.style.bottom
      };
      root.style.left = 'auto'; root.style.top = 'auto';
      root.style.right = '14px'; root.style.bottom = '14px';
      pGrip.style.display = 'none';
    } else {
      panel.style.width = savedW;
      panel.style.height = savedH;
      panel.style.maxHeight = savedMax;
      pGrip.style.display = 'block';
      if (savedPos) {
        root.style.left = savedPos.left; root.style.top = savedPos.top;
        root.style.right = savedPos.right; root.style.bottom = savedPos.bottom;
      }
    }
  };

  // 小窗态下点猫头展开
  head.addEventListener('click', function (e) {
    if (dragMoved) { dragMoved = false; return; }
    if (mini && (e.target === head || e.target === cat || e.target === title)) {
      minBtn.onclick();
      e.stopPropagation();
    }
  });

  cat.onclick = function (e) {
    e.stopPropagation();
    if (mini) { minBtn.onclick(); return; }
    debugMenu();
  };

  // ── 模块窗口：拖动 / 缩放 / 小窗（按钮插进标题栏，不覆盖原有 ✕）──
  (function () {
    var seen = new WeakSet();

    function findBar(el) {
      for (var i = 0; i < el.children.length; i++) {
        var c = el.children[i];
        if (c.tagName !== 'DIV') continue;
        var r = c.getBoundingClientRect();
        if (r.height >= 22 && r.height <= 84) return c;
      }
      return null;
    }
    function findClose(el) {
      var bs = el.querySelectorAll('button');
      for (var i = 0; i < bs.length; i++) {
        var t = (bs[i].textContent || '').trim();
        if (t === '\u2715' || t === '\u00d7' || t === 'X') return bs[i];
      }
      return null;
    }

    function shell(el) {
      if (seen.has(el) || el.dataset.fhWin) return;
      var bar = findBar(el);
      var xb = findClose(el);
      if (!bar || !xb) return;
      if (getComputedStyle(el).position !== 'fixed') return;
      seen.add(el);
      el.dataset.fhWin = '1';

      // 原 ✕ 字形居中，修掉「绘制有问题」
      xb.style.display = 'grid';
      xb.style.placeItems = 'center';
      xb.style.padding = '0';
      xb.style.lineHeight = '1';
      xb.style.fontSize = '15px';

      // 小窗按钮插进标题栏，位于 ✕ 左侧，绝不遮挡
      var mb = document.createElement('button');
      mb.textContent = '\u25f1';
      mb.title = '小窗 / 全屏';
      mb.style.cssText = 'min-width:34px;height:34px;display:grid;place-items:center;padding:0;border:0;' +
        'border-radius:9px;background:transparent;color:#8a8a99;font:15px/1 inherit;cursor:pointer;flex-shrink:0';
      xb.parentNode.insertBefore(mb, xb);

      // 右下角缩放手柄
      var grip = document.createElement('div');
      grip.style.cssText = 'display:none;position:absolute;right:2px;bottom:2px;width:20px;height:20px;z-index:9;' +
        'cursor:se-resize;touch-action:none;border-radius:0 0 14px 0;' +
        'background:linear-gradient(135deg,transparent 45%,rgba(255,255,255,.32) 45%,rgba(255,255,255,.32) 55%,transparent 55%,' +
        'transparent 67%,rgba(255,255,255,.32) 67%,rgba(255,255,255,.32) 77%,transparent 77%)';
      el.appendChild(grip);

      function toFloat() {
        var W = Math.min(Math.round(innerWidth * 0.9), 760);
        var H = Math.min(Math.round(innerHeight * 0.78), 720);
        el.dataset.fhFloat = '1';
        el.style.inset = 'auto';
        el.style.transform = 'none';
        el.style.left = Math.max(6, Math.round((innerWidth - W) / 2)) + 'px';
        el.style.top = Math.max(30, Math.round((innerHeight - H) / 2)) + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        el.style.width = W + 'px';
        el.style.height = H + 'px';
        el.style.borderRadius = '14px';
        el.style.boxShadow = '0 20px 60px rgba(0,0,0,.6)';
        el.style.overflow = 'hidden';
        grip.style.display = 'block';
        mb.style.color = '#5b8dfa';
      }
      function toFull() {
        el.dataset.fhFloat = '0';
        el.style.inset = '0';
        el.style.left = '';
        el.style.top = '';
        el.style.right = '';
        el.style.bottom = '';
        el.style.transform = '';
        el.style.width = '';
        el.style.height = '';
        el.style.borderRadius = '';
        el.style.boxShadow = '';
        el.style.overflow = '';
        grip.style.display = 'none';
        mb.style.color = '#8a8a99';
      }
      mb.onclick = function (e) {
        e.stopPropagation();
        if (el.dataset.fhFloat === '1') toFull(); else toFloat();
      };

      // 拖动标题栏空白处
      var ds = null;
      bar.style.touchAction = 'none';
      bar.addEventListener('pointerdown', function (e) {
        if (e.target.closest && e.target.closest('button,input,textarea,select,a,label')) return;
        if (el.dataset.fhFloat !== '1') toFloat();
        var r = el.getBoundingClientRect();
        ds = { x: e.clientX, y: e.clientY, l: r.left, t: r.top };
        try { bar.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      });
      bar.addEventListener('pointermove', function (e) {
        if (!ds) return;
        el.style.left = Math.max(2, Math.min(ds.l + e.clientX - ds.x, innerWidth - 70)) + 'px';
        el.style.top = Math.max(2, Math.min(ds.t + e.clientY - ds.y, innerHeight - 50)) + 'px';
      });
      bar.addEventListener('pointerup', function () { ds = null; });
      bar.addEventListener('pointercancel', function () { ds = null; });

      // 缩放
      var rs = null;
      grip.addEventListener('pointerdown', function (e) {
        e.stopPropagation(); e.preventDefault();
        var r = el.getBoundingClientRect();
        rs = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
        try { grip.setPointerCapture(e.pointerId); } catch (err) {}
      });
      grip.addEventListener('pointermove', function (e) {
        if (!rs) return;
        el.style.width = Math.max(280, rs.w + e.clientX - rs.x) + 'px';
        el.style.height = Math.max(200, rs.h + e.clientY - rs.y) + 'px';
      });
      grip.addEventListener('pointerup', function () { rs = null; });
      grip.addEventListener('pointercancel', function () { rs = null; });
    }

    function scan(n) {
      if (!n || n.nodeType !== 1) return;
      if (n.tagName === 'DIV' && n.id && n.id !== '__fh' && n.id !== '__fw' && n.style.position === 'fixed') {
        var cs = n.style;
        var full = cs.inset === '0' || cs.inset === '0px' ||
          (cs.top === '0px' && cs.left === '0px' && cs.right === '0px' && cs.bottom === '0px');
        if (full) shell(n);
      }
      [].forEach.call(n.children || [], scan);
    }

    new MutationObserver(function (ms) {
      ms.forEach(function (m) { [].forEach.call(m.addedNodes, scan); });
    }).observe(document.body, { childList: true });
    [].forEach.call(document.body.children, scan);
  })();

  // ── 排行榜渲染加固：原版用 innerHTML 拼名字，改名会串标签 ──
  (function () {
    if (window.__fhRankPatched) return;
    if (typeof window.renderRank !== 'function') return;
    if (typeof window.loadRank !== 'function') return;
    window.__fhRankPatched = 1;
    window.renderRank = function () {
      var list = loadRank().slice().sort(function (a, b) { return b.earned - a.earned; });
      var box = document.getElementById('rankList');
      var info = document.getElementById('rankInfo');
      if (info) info.textContent = '共 ' + list.length + ' 位同学 · 按累计积分排名（记录保存在本机浏览器）';
      if (!box) return;
      box.innerHTML = '';
      if (!list.length) {
        box.innerHTML = '<div class="mini">还没有记录，快去答题吧！</div>';
        return;
      }
      list.slice(0, 50).forEach(function (r, i) {
        var d = document.createElement('div');
        d.className = 'rankrow' + (r.name === state.name ? ' me' : '');
        var rk = document.createElement('span');
        rk.className = 'rk';
        rk.textContent = i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1);
        var nm = document.createElement('span');
        nm.className = 'nm';
        nm.textContent = r.name + (r.name === state.name ? '（我）' : '');
        var mi = document.createElement('span');
        mi.className = 'mini';
        mi.textContent = (r.rounds || 0) + '组 · 对' + (r.correct || 0) + '题';
        var pt = document.createElement('span');
        pt.className = 'pt';
        pt.textContent = r.earned + '分';
        d.append(rk, nm, mi, pt);
        box.append(d);
      });
    };
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
