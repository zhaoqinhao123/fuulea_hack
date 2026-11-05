/* 网页弹窗：给一个网址，全屏 iframe 嵌入（对方设了 X-Frame-Options 就会白屏） */
(function () {
  var u = prompt('要嵌入的网址', 'https://www.baidu.com');
  if (!u || u === 'https://') return;

  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff';

  var f = document.createElement('iframe');
  f.src = u;
  f.style.cssText = 'width:100%;height:100%;border:0';

  var b = document.createElement('button');
  b.textContent = '关闭';
  b.style.cssText = 'position:absolute;top:12px;right:12px;z-index:2;padding:8px 14px;border:0;border-radius:8px;background:#222;color:#fff;cursor:pointer;font:13px/1 -apple-system,"PingFang SC",sans-serif';
  b.onclick = function () { d.remove(); };

  d.append(f, b);
  document.body.append(d);
})();
