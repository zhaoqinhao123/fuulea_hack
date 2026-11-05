/* 存档：把 state 原样展示出来，方便查看/备份 */
(function () {
  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(10,10,12,.88);padding:24px;overflow:auto';

  var bar = document.createElement('div');
  bar.style.cssText = 'position:sticky;top:0;display:flex;gap:8px;align-items:center;margin-bottom:12px;font:13px/1 -apple-system,"PingFang SC",sans-serif;color:#ddd';

  var copy = document.createElement('button');
  copy.textContent = '复制 JSON';
  copy.style.cssText = 'padding:7px 12px;border:1px solid #444;border-radius:8px;background:#26262c;color:#eee;cursor:pointer;font:inherit';
  var txt = JSON.stringify(state, null, 2);
  copy.onclick = function () {
    navigator.clipboard.writeText(txt).then(function () { copy.textContent = '已复制 ✓'; },
      function () { copy.textContent = '复制失败'; });
  };

  var close = document.createElement('button');
  close.textContent = '关闭';
  close.style.cssText = copy.style.cssText;
  close.onclick = function () { d.remove(); };

  bar.append(copy, close);

  var pre = document.createElement('pre');
  pre.textContent = txt;
  pre.style.cssText = 'margin:0;color:#9fe89f;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-all';

  d.append(bar, pre);
  document.body.append(d);
})();
