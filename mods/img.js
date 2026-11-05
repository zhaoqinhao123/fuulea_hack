/* 图片弹窗：给一个直链，全屏遮罩展示，点一下关闭 */
(function () {
  var u = prompt('图片直链', 'https://');
  if (!u || u === 'https://') return;

  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.8);display:grid;place-items:center;cursor:zoom-out';
  d.onclick = function () { d.remove(); };

  var i = new Image();
  i.src = u;
  i.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.5)';
  i.onerror = function () { d.remove(); alert('图片加载失败：' + u); };

  d.append(i);
  document.body.append(d);
})();
