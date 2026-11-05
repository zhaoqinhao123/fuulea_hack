/* 文件浏览：只能看用户主动选择的范围（文件夹 / 多个文件 / 拖入） */
(function () {
  if (document.getElementById('__fb')) { document.getElementById('__fb').remove(); }

  var TEXT = /\.(txt|md|json|js|ts|css|html?|xml|csv|log|ini|yml|yaml|php|py|java|c|cpp|h|sh)$/i;

  var root = document.createElement('div');
  root.id = '__fb';
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483645;background:rgba(12,12,14,.92);display:flex;align-items:center;justify-content:center;padding:16px;font:13px/1.5 -apple-system,"PingFang SC",sans-serif;color:#ddd';

  var card = document.createElement('div');
  card.style.cssText = 'width:min(720px,100%);max-height:86vh;display:flex;flex-direction:column;background:#1b1b20;border:1px solid #3a3a42;border-radius:14px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.5)';

  var head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #2e2e35';
  var tt = document.createElement('div');
  tt.textContent = '本机文件 · 仅限你主动选择的范围';
  tt.style.cssText = 'flex:1;font-weight:700;font-size:13px;color:#ccc';
  var x = document.createElement('button');
  x.textContent = '✕';
  x.style.cssText = 'width:40px;height:36px;border:0;border-radius:9px;background:transparent;color:#999;font-size:17px;cursor:pointer';
  x.onclick = function () { root.remove(); };
  head.append(tt, x);

  var bar2 = document.createElement('div');
  bar2.style.cssText = 'display:flex;gap:8px;padding:12px 12px 6px;flex-wrap:wrap';

  function mkBtn(txt, fn) {
    var b = document.createElement('button');
    b.textContent = txt;
    b.style.cssText = 'height:44px;padding:0 16px;border:1px solid #3a3a42;border-radius:11px;background:#26262c;color:#eee;font:14px/1 inherit;cursor:pointer';
    b.onclick = fn;
    return b;
  }

  var pickDir = document.createElement('input');
  pickDir.type = 'file';
  pickDir.multiple = true;
  pickDir.setAttribute('webkitdirectory', '');
  pickDir.setAttribute('directory', '');
  pickDir.style.display = 'none';

  var pickFiles = document.createElement('input');
  pickFiles.type = 'file';
  pickFiles.multiple = true;
  pickFiles.style.display = 'none';

  var support = ('webkitdirectory' in pickDir);

  var bDir = mkBtn('📁 选择文件夹', function () { pickDir.click(); });
  var bFile = mkBtn('📄 选择文件', function () { pickFiles.click(); });
  if (!support) {
    bDir.disabled = true;
    bDir.style.opacity = '.4';
    bDir.title = '当前浏览器不支持文件夹选择';
  }
  bar2.append(bDir, bFile);

  var info = document.createElement('div');
  info.style.cssText = 'padding:0 14px 8px;color:#777;font-size:12px';
  info.textContent = support ? '选择后只会列出你选中的文件夹内容' : '此浏览器不支持选文件夹，只能用「选择文件」或拖入';

  var list = document.createElement('div');
  list.style.cssText = 'flex:1;overflow:auto;padding:0 8px 8px;-webkit-overflow-scrolling:touch';

  var drop = document.createElement('div');
  drop.textContent = '也可以把文件/文件夹拖进来';
  drop.style.cssText = 'padding:10px 14px;color:#555;font-size:12px;border-top:1px solid #2e2e35;text-align:center';

  card.append(head, bar2, info, list, drop);
  root.append(card);
  document.body.append(root);

  // ── 渲染 ──
  var files = [];

  function human(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }

  function render() {
    list.innerHTML = '';
    if (!files.length) {
      list.innerHTML = '<div style="padding:24px;text-align:center;color:#555">还没有选择文件</div>';
      return;
    }

    var head2 = document.createElement('div');
    head2.style.cssText = 'padding:8px 10px;color:#8a8;font-size:12px';
    head2.textContent = '共 ' + files.length + ' 个文件 · ' + human(files.reduce(function (s, f) { return s + f.f.size; }, 0));
    list.append(head2);

    files.forEach(function (f) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;align-items:center;padding:9px 10px;border-radius:9px;cursor:pointer';
      row.onmouseenter = function () { row.style.background = '#26262c'; };
      row.onmouseleave = function () { row.style.background = 'transparent'; };

      var nm = document.createElement('div');
      nm.textContent = f.path;
      nm.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px';

      var sz = document.createElement('div');
      sz.textContent = human(f.f.size);
      sz.style.cssText = 'color:#666;font-size:11px;flex-shrink:0';

      row.append(nm, sz);
      row.onclick = function () { preview(f.f, f.path); };
      list.append(row);
    });
  }

  function preview(f, path) {
    var d = document.createElement('div');
    d.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:16px;z-index:2';
    var box = document.createElement('div');
    box.style.cssText = 'width:min(760px,100%);max-height:80vh;display:flex;flex-direction:column;background:#15151a;border:1px solid #333;border-radius:12px;overflow:hidden';
    var h = document.createElement('div');
    h.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #2a2a32';
    var t = document.createElement('div');
    t.textContent = path;
    t.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#aaa';
    var c = document.createElement('button');
    c.textContent = '✕';
    c.style.cssText = 'width:40px;height:34px;border:0;border-radius:8px;background:transparent;color:#999;font-size:16px;cursor:pointer';
    c.onclick = function () { d.remove(); };
    h.append(t, c);

    var body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow:auto;padding:14px';

    if (/^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f.name)) {
      var img = new Image();
      img.src = URL.createObjectURL(f);
      img.style.cssText = 'max-width:100%;height:auto;display:block;margin:0 auto';
      body.append(img);
    } else if (TEXT.test(f.name) || /^text\//.test(f.type)) {
      var pre = document.createElement('pre');
      pre.textContent = '读取中…';
      pre.style.cssText = 'margin:0;color:#cfd;font:12px/1.6 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all';
      body.append(pre);
      f.slice(0, 200 * 1024).text().then(function (txt) {
        pre.textContent = txt + (f.size > 200 * 1024 ? '\n\n…（仅显示前 200 KB）' : '');
      });
    } else {
      body.innerHTML = '<div style="color:#777">该类型无法预览</div>';
    }

    box.append(h, body);
    d.append(box);
    root.append(d);
    d.onclick = function (e) { if (e.target === d) d.remove(); };
  }

  function collect(fileList, fromDrop) {
    files = [].map.call(fileList, function (f) {
      return { f: f, path: f.webkitRelativePath || f.name };
    });
    if (fromDrop) {
      // 拖进来的条目相对路径在 webkitGetAsEntry 里，这里只对文件生效
      files = files.filter(function (x) { return x.path; });
    }
    render();
  }

  pickDir.onchange = function () { collect(pickDir.files); };
  pickFiles.onchange = function () { collect(pickFiles.files); };

  ['dragenter', 'dragover'].forEach(function (ev) {
    root.addEventListener(ev, function (e) { e.preventDefault(); drop.style.color = '#9aa'; });
  });
  root.addEventListener('dragleave', function () { drop.style.color = '#555'; });
  root.addEventListener('drop', function (e) {
    e.preventDefault();
    drop.style.color = '#555';
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) collect(e.dataTransfer.files, true);
  });
})();
