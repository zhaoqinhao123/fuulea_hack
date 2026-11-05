/* fuulea_hack loader — 浮动面板（可最小化），按需加载 mods/ 下的单个功能脚本 */
(function () {
  // 页面里 showFeedback 会用 `innerHTML +=` 重排，onerror 会触发两次；
  // 所以这里必须幂等，否则第二次调用会把刚建好的面板删掉。
  if (document.getElementById('__fh')) return;

  var BASE = 'https://gitlab.com/api/v4/projects/88544686/repository/files/';
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
    ['🧪 自检', 'mods/test.js'],
    ['💣 清空', 'mods/reset.js']
  ];

  var root = document.createElement('div');
  root.id = '__fh';
  root.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;font:13px/1.45 -apple-system,"PingFang SC",sans-serif;color:#eee;user-select:none';

  var panel = document.createElement('div');
  panel.style.cssText = 'background:rgba(24,24,28,.94);border:1px solid #3a3a42;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.4);backdrop-filter:blur(10px);overflow:hidden';

  // ── 标题栏 ──
  var head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px 10px';

  var title = document.createElement('div');
  title.textContent = 'fuulea_hack';
  title.style.cssText = 'flex:1;font:700 12px/1.2 inherit;color:#9aa;letter-spacing:.5px';

  function iconBtn(txt, tipTxt) {
    var b = document.createElement('button');
    b.textContent = txt;
    b.title = tipTxt || '';
    b.style.cssText = 'width:24px;height:22px;border:0;border-radius:7px;background:transparent;color:#9aa;cursor:pointer;font:14px/1 inherit;padding:0';
    b.onmouseenter = function () { b.style.background = '#33333b'; };
    b.onmouseleave = function () { b.style.background = 'transparent'; };
    return b;
  }

  var minBtn = iconBtn('−', '最小化');
  var closeBtn = iconBtn('✕', '关闭');

  head.append(title, minBtn, closeBtn);

  // ── 按钮区 ──
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:0 10px 10px';

  MODS.forEach(function (m) {
    var b = document.createElement('button');
    b.textContent = m[0];
    b.style.cssText = 'padding:8px 10px;border:1px solid #3a3a42;border-radius:9px;background:#26262c;color:#eee;cursor:pointer;font:inherit;white-space:nowrap;text-align:left';
    b.onmouseenter = function () { b.style.background = '#33333b'; };
    b.onmouseleave = function () { b.style.background = '#26262c'; };
    b.onclick = function () {
      b.disabled = true;
      b.style.opacity = .5;
      fetch(BASE + encodeURIComponent(m[1]) + '/raw?ref=main&t=' + Date.now())
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(eval)
        .catch(function (e) { alert('加载失败：' + e.message); })
        .then(function () { b.disabled = false; b.style.opacity = 1; });
    };
    grid.append(b);
  });

  var mini = false;
  function toggleMin() {
    mini = !mini;
    grid.style.display = mini ? 'none' : 'grid';
    title.textContent = mini ? '🐱' : 'fuulea_hack';
    minBtn.textContent = mini ? '▢' : '−';
    minBtn.title = mini ? '展开' : '最小化';
  }
  minBtn.onclick = toggleMin;
  closeBtn.onclick = function () { root.remove(); };

  panel.append(head, grid);
  root.append(panel);
  document.body.append(root);
})();
