/* 网页小窗：常用网址列表（本地保存、可编辑）+ 任意地址，窗口可拖动/缩放/全屏 */
(function () {
  var KEY = 'fh:sites';
  var DEF = [
    { n: '百度', u: 'https://www.baidu.com' },
    { n: '必应', u: 'https://www.bing.com' },
    { n: 'B站', u: 'https://www.bilibili.com' },
    { n: '知乎', u: 'https://www.zhihu.com' }
  ];

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (Array.isArray(s)) return s;
    } catch (e) {}
    return DEF.slice();
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    // v3.4：网页配置同时归到当前登录账号（没有账号时只存本机）
    try {
      if (window.__fhAcct && window.__fhAcct.saveSites) window.__fhAcct.saveSites(JSON.stringify(list));
    } catch (e) {}
  }

  var old = document.getElementById('__fw');
  if (old) { old.remove(); return; }

  // v3.3：网页窗口栈。← 关闭当前页并回到上一个网页。
  var vstack = [];
  function refreshBacks() {
    vstack.forEach(function (w, i) {
      if (w.__backBtn) {
        w.__backBtn.disabled = i === 0;
        w.__backBtn.style.opacity = i === 0 ? '.3' : '1';
        w.__backBtn.title = i === 0 ? '没有上一个网页' : '返回上一个网页';
      }
    });
  }

  var sites = load();
  function closeRoot() { window.__fhEmbRefresh = null; root.remove(); }
  // 账号切换后刷新常用站点（账号里的 sites 已在登录时写回 fh:sites）
  window.__fhEmbRefresh = function () { sites = load(); draw(); };
  if (!window.__fhEmbHooked) {
    window.__fhEmbHooked = 1;
    try {
      window.addEventListener('fh:acct', function () {
        try { if (window.__fhEmbRefresh) window.__fhEmbRefresh(); } catch (e) {}
      });
    } catch (e) {}
  }
  var editing = false;

  var root = document.createElement('div');
  root.id = '__fw';
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483645;background:rgba(8,8,10,.75);display:flex;align-items:center;justify-content:center;padding:16px;font:13px/1.5 -apple-system,"PingFang SC",sans-serif;color:#ddd';

  var card = document.createElement('div');
  card.style.cssText = 'width:min(560px,94vw);max-height:86vh;display:flex;flex-direction:column;background:#1b1b20;border:1px solid #3a3a42;border-radius:14px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.5)';

  var head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #2e2e35';
  var tt = document.createElement('div');
  tt.textContent = '网页';
  tt.style.cssText = 'flex:1;font-weight:700;color:#ccc';
  var edit = document.createElement('button');
  edit.textContent = '编辑';
  edit.style.cssText = 'height:34px;padding:0 12px;border:1px solid #3a3a42;border-radius:9px;background:#222228;color:#bbb;font:13px/1 inherit;cursor:pointer';
  var x = document.createElement('button');
  x.textContent = '✕';
  x.style.cssText = 'width:34px;height:34px;border:0;border-radius:9px;background:transparent;color:#999;font-size:16px;cursor:pointer';
  x.onclick = function () { closeRoot(); };
  head.append(tt, edit, x);

  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow:auto;padding:12px';

  // 地址栏
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:12px';
  var input = document.createElement('input');
  input.placeholder = '输入网址';
  input.style.cssText = 'flex:1;min-width:0;height:42px;padding:0 12px;border:1px solid #3a3a42;border-radius:10px;background:#15151a;color:#eee;font:14px/1 inherit;outline:none';
  var go = document.createElement('button');
  go.textContent = '打开';
  go.style.cssText = 'height:42px;padding:0 18px;border:0;border-radius:10px;background:#3a6df0;color:#fff;font:14px/1 inherit;cursor:pointer';
  function openInput() {
    var u = input.value.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    viewer(u);
  }
  go.onclick = openInput;
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') openInput(); });
  row.append(input, go);

  // 常用列表
  var grid = document.createElement('div');
  // 标签多了横向滑动，不折行（折行会顶出卡片）
  grid.style.cssText = 'display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;overflow-y:hidden;padding:0 0 8px;margin-bottom:-4px;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity';

  function draw() {
    grid.innerHTML = '';
    sites.forEach(function (s, i) {
      var chip = document.createElement('div');
      chip.style.cssText = 'flex:0 0 auto;scroll-snap-align:start;display:flex;align-items:center;gap:6px;padding:9px 12px;border:1px solid #33333b;border-radius:10px;background:#222228;cursor:pointer;max-width:72vw';
      var nm = document.createElement('span');
      nm.textContent = s.n;
      nm.style.cssText = 'font-size:13px;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      chip.append(nm);
      chip.onclick = function () { if (!editing) viewer(s.u); };
      if (editing) {
        chip.style.cursor = 'default';
        chip.style.borderColor = '#5a3a3a';
        var del = document.createElement('button');
        del.textContent = '✕';
        del.style.cssText = 'width:24px;height:24px;border:0;border-radius:6px;background:transparent;color:#d66;font-size:13px;cursor:pointer;padding:0';
        del.onclick = function (e) {
          e.stopPropagation();
          sites.splice(i, 1);
          save(sites);
          draw();
        };
        chip.append(del);
      }
      grid.append(chip);
    });

    if (editing) {
      var add = document.createElement('button');
      add.textContent = '＋ 添加';
      add.style.cssText = 'padding:9px 14px;border:1px dashed #3a3a42;border-radius:10px;background:transparent;color:#999;font:13px/1 inherit;cursor:pointer';
      add.onclick = function () {
        var n = prompt('名称（比如「作业帮」）', '');
        if (!n) return;
        var u = prompt('网址', 'https://');
        if (!u || u === 'https://') return;
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        sites.push({ n: n.trim(), u: u.trim() });
        save(sites);
        draw();
      };
      grid.append(add);
    }
  }

  edit.onclick = function () {
    editing = !editing;
    edit.textContent = editing ? '完成' : '编辑';
    edit.style.color = editing ? '#5bd06a' : '#bbb';
    draw();
  };

  body.append(row, grid);
  card.append(head, body);
  root.append(card);
  root.onclick = function (e) { if (e.target === root) closeRoot(); };
  document.body.append(root);
  draw();

  // ── 小窗 ──
  function viewer(url) {
    var win = document.createElement('div');
    win.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(76vw,900px);height:70vh;min-width:280px;min-height:200px;z-index:2147483647;display:flex;flex-direction:column;background:#15151a;border:1px solid #3a3a42;border-radius:12px;overflow:hidden;resize:both;box-shadow:0 20px 60px rgba(0,0,0,.6)';

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 8px;background:#222228;border-bottom:1px solid #2e2e35;touch-action:none;cursor:move';

    var host = document.createElement('div');
    try { host.textContent = new URL(url).host; } catch (e) { host.textContent = url; }
    host.style.cssText = 'flex:1;font-size:12px;color:#999;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';

    function ib(t, tip) {
      var b = document.createElement('button');
      b.textContent = t;
      b.title = tip;
      b.style.cssText = 'width:32px;height:28px;border:0;border-radius:7px;background:transparent;color:#aaa;font-size:14px;cursor:pointer';
      return b;
    }

    var max = ib('⤢', '全屏/小窗');
    var close = ib('✕', '关闭');
    var back = ib('←', '返回上一个网页');
    back.style.fontSize = '16px';
    function closeWin() {
      var i = vstack.indexOf(win);
      if (i >= 0) vstack.splice(i, 1);
      win.remove();
      // 抬出上一个网页（它一直在 DOM 里，重新 append 到最前）
      var prev = vstack[vstack.length - 1];
      if (prev) { try { document.body.appendChild(prev); } catch (e) {} }
      refreshBacks();
    }
    back.onclick = closeWin;
    close.onclick = closeWin;

    var saved = null;
    max.onclick = function () {
      if (win.dataset.max === '1') {
        // 还原：用记录下来的位置/尺寸，别依赖 cssText 字符串匹配
        win.dataset.max = '0';
        var r = saved || { l: 40, t: 40, w: 620, h: 460 };
        win.style.transform = 'none';
        win.style.left = Math.max(0, Math.min(r.l, innerWidth - 200)) + 'px';
        win.style.top = Math.max(0, Math.min(r.t, innerHeight - 160)) + 'px';
        win.style.width = Math.min(r.w, innerWidth) + 'px';
        win.style.height = Math.min(r.h, innerHeight) + 'px';
        win.style.borderRadius = '12px';
      } else {
        var rect = win.getBoundingClientRect();
        saved = { l: rect.left, t: rect.top, w: rect.width, h: rect.height };
        win.dataset.max = '1';
        win.style.left = '0';
        win.style.top = '0';
        win.style.transform = 'none';
        win.style.width = '100vw';
        win.style.height = '100vh';
        win.style.borderRadius = '0';
      }
    };

    var frame = document.createElement('iframe');
    frame.src = url;
    frame.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write');
    frame.setAttribute('allowfullscreen', '');
    frame.style.cssText = 'flex:1;width:100%;border:0;background:#fff';

    var tip = document.createElement('div');
    tip.textContent = '若空白：对方设置了 X-Frame-Options';
    tip.style.cssText = 'position:absolute;left:0;right:0;bottom:6px;text-align:center;font-size:11px;color:#666;pointer-events:none';

    bar.append(back, host, max, close);
    win.append(bar, frame, tip);
    win.__backBtn = back;
    vstack.push(win);
    refreshBacks();

    // 拖动
    var sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    bar.addEventListener('pointerdown', function (e) {
      if (e.target.tagName === 'BUTTON') return;
      var r = win.getBoundingClientRect();
      win.style.left = r.left + 'px';
      win.style.top = r.top + 'px';
      win.style.transform = 'none';
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; on = true;
      try { bar.setPointerCapture(e.pointerId); } catch (err) {}
    });
    bar.addEventListener('pointermove', function (e) {
      if (!on || win.dataset.max === '1') return;
      win.style.left = Math.max(0, Math.min(ox + e.clientX - sx, innerWidth - 80)) + 'px';
      win.style.top = Math.max(0, Math.min(oy + e.clientY - sy, innerHeight - 40)) + 'px';
    });
    bar.addEventListener('pointerup', function () { on = false; });

    // 右下角缩放把手（触摸/鼠标都可用）
    var grip = document.createElement('div');
    grip.style.cssText = 'position:absolute;right:0;bottom:0;width:24px;height:24px;cursor:nwse-resize;touch-action:none;z-index:2;background:linear-gradient(135deg,transparent 46%,#5a5a66 46%,#5a5a66 56%,transparent 56%,transparent 68%,#5a5a66 68%,#5a5a66 78%,transparent 78%);border-bottom-right-radius:10px';
    var rx = 0, ry = 0, rw = 0, rh = 0, ron = false;
    grip.addEventListener('pointerdown', function (e) {
      var r = win.getBoundingClientRect();
      rx = e.clientX; ry = e.clientY; rw = r.width; rh = r.height; ron = true;
      try { grip.setPointerCapture(e.pointerId); } catch (err) {}
      e.stopPropagation();
    });
    grip.addEventListener('pointermove', function (e) {
      if (!ron || win.dataset.max === '1') return;
      win.style.width = Math.max(280, rw + e.clientX - rx) + 'px';
      win.style.height = Math.max(200, rh + e.clientY - ry) + 'px';
    });
    grip.addEventListener('pointerup', function () { ron = false; });
    grip.addEventListener('pointercancel', function () { ron = false; });
    win.append(grip);

    document.body.append(win);
    return win;
  }
})();
