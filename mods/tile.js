/* 屏幕转印：把图片切成 1:1 图块全屏轮播，配合系统录屏，事后在电脑上拼回原图 */
(function () {
  var OLD = document.getElementById('__tl');
  if (OLD) { OLD.remove(); return; }

  var root = document.createElement('div');
  root.id = '__tl';
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#0d0d10;color:#ddd;' +
    'display:flex;flex-direction:column;font:13px/1.5 -apple-system,"PingFang SC",sans-serif';

  // ---- 全屏播放层 ----
  var stage = document.createElement('canvas');
  stage.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:none;background:#000;z-index:2147483647';

  // ---- 设置面板 ----
  var bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px 10px;background:#1b1b20;border-bottom:1px solid #2c2c34;flex-shrink:0';
  var title = document.createElement('div');
  title.textContent = '屏幕转印';
  title.style.cssText = 'flex:1;font-weight:700;color:#bbb';
  function ib(t, fn, tip) {
    var b = document.createElement('button');
    b.textContent = t;
    b.title = tip || '';
    b.style.cssText = 'min-width:38px;height:36px;border:0;border-radius:9px;background:transparent;color:#aaa;font:15px/1 inherit;cursor:pointer;padding:0 8px';
    if (fn) b.onclick = fn;
    return b;
  }
  var tutB = ib('❓', function () { tutorial(); }, '教程');
  tutB.style.fontSize = '16px';
  var closeB = ib('✕', function () { root.remove(); stage.remove(); }, '关闭');
  bar.append(title, tutB, closeB);

  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px';

  var hint = document.createElement('div');
  hint.style.cssText = 'font-size:12px;color:#8a8a99;line-height:1.8';
  hint.textContent = '流程：选图 → 看清分块数 → 开系统录屏 → 回来点「开始」→ 等播完 → 停止录屏 → 把录屏文件送到电脑跑 stitch.py';

  // 取源
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  var shotBtn = document.createElement('button');
  shotBtn.textContent = '📷 拍摄';
  var pickBtn = document.createElement('button');
  pickBtn.textContent = '🖼 选图';
  [shotBtn, pickBtn].forEach(function (b) {
    b.style.cssText = 'flex:1;min-width:120px;height:40px;border:0;border-radius:10px;background:#2a2a32;color:#ddd;font:13px/1 inherit;cursor:pointer';
  });

  var shotIn = document.createElement('input');
  shotIn.type = 'file';
  shotIn.accept = 'image/*';
  shotIn.setAttribute('capture', 'environment');
  shotIn.style.display = 'none';
  var pickIn = document.createElement('input');
  pickIn.type = 'file';
  pickIn.accept = 'image/*';
  pickIn.style.display = 'none';
  row.append(shotBtn, pickBtn, shotIn, pickIn);

  // 预览与信息
  var info = document.createElement('div');
  info.style.cssText = 'font:12px/1.8 ui-monospace,Menlo,monospace;color:#9a9aa8;white-space:pre-wrap;background:#131317;border:1px solid #26262c;border-radius:10px;padding:10px';
  info.textContent = '还没选图';

  var prev = document.createElement('img');
  prev.style.cssText = 'max-width:100%;max-height:34vh;border-radius:10px;display:none;object-fit:contain';

  var opts = document.createElement('div');
  opts.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;color:#8a8a99';
  var secIn = document.createElement('input');
  secIn.type = 'number';
  secIn.value = '1.4';
  secIn.step = '0.1';
  secIn.min = '0.6';
  secIn.max = '5';
  secIn.style.cssText = 'width:74px;height:32px;padding:0 8px;border:1px solid #333;border-radius:8px;background:#101014;color:#ddd;font:12px/1 inherit';
  opts.append(document.createTextNode('每块停留(s)'), secIn);

  var go = document.createElement('button');
  go.textContent = '开始转印';
  go.disabled = true;
  go.style.cssText = 'height:46px;border:0;border-radius:12px;background:#3a6df0;color:#fff;font:15px/1 inherit;cursor:pointer';
  go.style.opacity = '.5';

  body.append(hint, row, prev, info, opts, go);
  root.append(bar, body);
  document.body.append(root, stage);

  // ---- 状态 ----
  var img = null;
  var plan = null;      // {w,h,cols,rows,tw,th,dpr}
  var playing = false;

  function dpr() { return Math.max(1, Math.min(4, window.devicePixelRatio || 1)); }

  function computePlan(im) {
    var d = dpr();
    var tw = Math.round(window.innerWidth * d);
    var th = Math.round(window.innerHeight * d);
    var cols = Math.max(1, Math.ceil(im.naturalWidth / tw));
    var rows = Math.max(1, Math.ceil(im.naturalHeight / th));
    return {
      w: im.naturalWidth, h: im.naturalHeight,
      cols: cols, rows: rows, tw: tw, th: th, dpr: d
    };
  }

  function refresh() {
    if (!img) { go.disabled = true; go.style.opacity = '.5'; return; }
    plan = computePlan(img);
    var n = plan.cols * plan.rows;
    var total = (n * parseFloat(secIn.value || '1.4')) + 2;
    info.textContent =
      '原图   ' + plan.w + ' × ' + plan.h + '\n' +
      '屏(设备像素) ' + plan.tw + ' × ' + plan.th + '   dpr=' + plan.dpr + '\n' +
      '分块   ' + plan.cols + ' 列 × ' + plan.rows + ' 行 = ' + n + ' 块\n' +
      '预计   录屏约 ' + total.toFixed(1) + ' 秒\n' +
      '拼接参数 cols=' + plan.cols + ' rows=' + plan.rows + ' tw=' + plan.tw + ' th=' + plan.th + ' W=' + plan.w + ' H=' + plan.h;
    go.disabled = false;
    go.style.opacity = '1';
  }

  function loadFile(f) {
    if (!f) return;
    var url = URL.createObjectURL(f);
    var im = new Image();
    im.onload = function () {
      if (img && img.dataset && img.dataset.url) URL.revokeObjectURL(img.dataset.url);
      im.dataset.url = url;
      img = im;
      prev.src = url;
      prev.style.display = 'block';
      refresh();
    };
    im.onerror = function () { info.textContent = '这张图读不出来'; };
    im.src = url;
  }

  shotBtn.onclick = function () { shotIn.click(); };
  pickBtn.onclick = function () { pickIn.click(); };
  shotIn.onchange = function () { loadFile(shotIn.files[0]); };
  pickIn.onchange = function () { loadFile(pickIn.files[0]); };
  secIn.oninput = function () { if (img) refresh(); };

  // ---- 播放 ----
  function tileAt(i) {
    var c = i % plan.cols, r = Math.floor(i / plan.cols);
    var sx = c * plan.tw, sy = r * plan.th;
    stage.width = plan.tw;
    stage.height = plan.th;
    var ctx = stage.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, plan.tw, plan.th);
    ctx.drawImage(img, sx, sy, plan.tw, plan.th, 0, 0, plan.tw, plan.th);
  }

  function play() {
    if (!img || !plan || playing) return;
    playing = true;
    // 播放时把设置面板藏掉，画面里不能有我们的 UI
    root.style.display = 'none';
    stage.style.display = 'block';
    stage.width = plan.tw;
    stage.height = plan.th;

    var per = Math.max(600, parseFloat(secIn.value || '1.4') * 1000);
    var n = plan.cols * plan.rows;
    var ctx = stage.getContext('2d');

    // 开头 2 秒纯黑：给录屏留启动余量，stitch 会自动跳过
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, plan.tw, plan.th);

    var i = 0;
    setTimeout(function tick() {
      if (i >= n) {
        // 结尾 1.2 秒纯黑
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, plan.tw, plan.th);
        setTimeout(function () {
          stage.style.display = 'none';
          root.style.display = 'flex';
          playing = false;
          info.textContent = '播放完成（共 ' + n + ' 块）。可以停止录屏了。';
        }, 1200);
        return;
      }
      tileAt(i);
      i++;
      setTimeout(tick, per);
    }, 2000);
  }

  go.onclick = play;

  // ── 教程 ──
  function tutorial() {
    var seen = false;
    try { seen = localStorage.getItem('fh:tile:seen') === '1'; } catch (e) {}

    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(6,6,9,.86);' +
      'display:flex;align-items:center;justify-content:center;padding:14px';

    var card = document.createElement('div');
    card.style.cssText = 'width:min(560px,94vw);max-height:88vh;display:flex;flex-direction:column;' +
      'background:#1b1b20;border:1px solid #33333b;border-radius:14px;overflow:hidden';

    var hd = document.createElement('div');
    hd.textContent = '🧩 屏幕转印 · 教程';
    hd.style.cssText = 'padding:12px 14px;font-weight:700;color:#ccc;border-bottom:1px solid #2c2c34';

    var box = document.createElement('div');
    box.style.cssText = 'flex:1;overflow:auto;padding:14px;font-size:13px;line-height:1.85;color:#bbb';

    var cols = plan ? plan.cols : 'A', rows = plan ? plan.rows : 'B';
    var cmd = 'python3 tools/stitch.py rec.mp4 --cols ' + cols + ' --rows ' + rows + ' -o out.png';

    function step(n, t, body) {
      var d = document.createElement('div');
      d.style.cssText = 'display:flex;gap:9px;margin:0 0 12px';
      var num = document.createElement('div');
      num.textContent = n;
      num.style.cssText = 'flex:0 0 22px;height:22px;border-radius:50%;background:#3a6df0;color:#fff;' +
        'font:700 12px/22px inherit;text-align:center';
      var txt = document.createElement('div');
      txt.style.cssText = 'flex:1;min-width:0';
      var h = document.createElement('div');
      h.textContent = t;
      h.style.cssText = 'color:#ddd;font-weight:600;margin-bottom:2px';
      txt.append(h);
      if (body) {
        var b = document.createElement('div');
        b.style.cssText = 'color:#8f8f9e;font-size:12.5px';
        b.textContent = body;
        txt.append(b);
      }
      d.append(num, txt);
      box.append(d);
    }

    step('1', '取图', '点「📷 拍摄」现场拍，或「🖼 选图」挑一张。拍完图片直接进内存，不用去相册里找。');
    step('2', '记下分块', '面板会显示「cols=… rows=…」。这是拼图要用的参数，两个数必须和录屏时一致。');
    step('3', '先开录屏', '用系统录屏，画质调到最高（默认可能压到 720p，那样还原上限也跟着降）。');
    step('4', '回来点开始', '转印时我们的界面全部隐藏。开头黑屏 2 秒给录屏留余量，之后每块停留一次，播完自动返回。');
    step('5', '停止录屏', '看到「播放完成」再停，别提前停，否则最后一块会缺。');
    step('6', '送到电脑', '把 mp4 传过去，在仓库目录执行下面这条命令（参数已按当前图片填好）：');

    var code = document.createElement('div');
    code.textContent = cmd;
    code.style.cssText = 'margin:6px 0 0;padding:9px 10px;border-radius:9px;background:#101014;' +
      'border:1px solid #2a2a32;color:#9fd6a0;font:11.5px/1.6 ui-monospace,Menlo,monospace;' +
      'white-space:pre-wrap;word-break:break-all;user-select:text;-webkit-user-select:text';
    box.append(code);

    var cp = document.createElement('button');
    cp.textContent = '复制命令';
    cp.style.cssText = 'margin:6px 0 14px;height:32px;padding:0 14px;border:1px solid #33333b;' +
      'border-radius:8px;background:#222228;color:#bbb;font:12px/1 inherit;cursor:pointer';
    cp.onclick = function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cmd).then(function () { cp.textContent = '已复制'; },
          function () { cp.textContent = '复制失败，长按上面手动选'; });
      } else {
        var ta = document.createElement('textarea');
        ta.value = cmd;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); cp.textContent = '已复制'; } catch (e) { cp.textContent = '复制失败'; }
        ta.remove();
      }
    };
    box.append(cp);

    var tips = document.createElement('div');
    tips.style.cssText = 'padding:10px 12px;border-radius:10px;background:#191d16;border:1px solid #2e3a2a;' +
      'color:#8fa889;font-size:12px;line-height:1.8';
    tips.textContent = '常见问题：① 录屏分辨率要等于屏幕（用 ffprobe 查，期望 1920x1200 这类）② 边缘有状态栏或圆角，加 --crop 0:0:屏宽:屏高 ③ 脚本提示块数对不上，说明录屏中途被打断或提前停止。';
    box.append(tips);

    var ft = document.createElement('div');
    ft.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid #2c2c34';
    var wrapChk = document.createElement('label');
    wrapChk.style.cssText = 'flex:1;display:flex;align-items:center;gap:7px;font-size:12px;color:#8a8a99';
    var chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = seen;
    chk.style.cssText = 'width:16px;height:16px;accent-color:#3a6df0';
    wrapChk.append(chk, document.createTextNode('以后不再自动弹出'));
    var ok = document.createElement('button');
    ok.textContent = '知道了';
    ok.style.cssText = 'height:36px;padding:0 18px;border:0;border-radius:9px;background:#3a6df0;color:#fff;font:13px/1 inherit;cursor:pointer';
    ok.onclick = function () {
      try { localStorage.setItem('fh:tile:seen', chk.checked ? '1' : '0'); } catch (e) {}
      wrap.remove();
    };
    ft.append(wrapChk, ok);

    card.append(hd, box, ft);
    wrap.append(card);
    wrap.onclick = function (e) { if (e.target === wrap) wrap.remove(); };
    document.body.append(wrap);
  }

  // 首次使用自动弹一次
  try {
    if (localStorage.getItem('fh:tile:seen') !== '1') setTimeout(tutorial, 260);
  } catch (e) {}
})();
