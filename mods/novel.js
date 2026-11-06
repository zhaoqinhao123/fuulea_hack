/* TXT 小说：本地导入、正则分章、本地持久化 */
(function () {
  if (document.getElementById('__nv')) { document.getElementById('__nv').remove(); return; }

  var KEY = 'novel';
  var DEF_RE = '第[零一二三四五六七八九十百千0-9]{1,6}[章回节卷][^\\n]{0,30}';

  var db = null;
  function openDB(cb) {
    if (db) return cb(db);
    var r = indexedDB.open('fh_store', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
    r.onsuccess = function () { db = r.result; cb(db); };
    r.onerror = function () { cb(null); };
  }
  function idbGet(k, cb) {
    openDB(function (d) {
      if (!d) return cb(null);
      var t = d.transaction('kv', 'readonly').objectStore('kv').get(k);
      t.onsuccess = function () { cb(t.result || null); };
      t.onerror = function () { cb(null); };
    });
  }
  function idbSet(k, v, cb) {
    openDB(function (d) {
      if (!d) return cb && cb(false);
      var t = d.transaction('kv', 'readwrite').objectStore('kv').put(v, k);
      t.onsuccess = function () { cb && cb(true); };
      t.onerror = function () { cb && cb(false); };
    });
  }

  // ── UI ──
  var root = document.createElement('div');
  root.id = '__nv';
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483645;background:#121214;display:flex;flex-direction:column;color:#ddd;font:14px/1.7 -apple-system,"PingFang SC",serif';

  var bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px 10px;background:#1b1b20;border-bottom:1px solid #2c2c34;flex-shrink:0';
  var title = document.createElement('div');
  title.textContent = '小说';
  title.style.cssText = 'flex:1;font:700 13px/1.2 -apple-system,"PingFang SC",sans-serif;color:#bbb';
  function ib(t, tip, size) {
    var b = document.createElement('button');
    b.textContent = t;
    b.title = tip || '';
    b.style.cssText = 'min-width:' + (size || 36) + 'px;height:36px;border:0;border-radius:9px;background:transparent;color:#aaa;font:15px/1 inherit;cursor:pointer;padding:0 8px';
    return b;
  }
  var listBtn = ib('☰', '目录');
  var minus = ib('A−', '字号');
  var plus = ib('A+', '字号');
  var close = ib('✕', '关闭');
  close.onclick = function () { root.remove(); };
  bar.append(title, minus, plus, listBtn, close);

  var body = document.createElement('div');
  body.style.cssText = 'flex:1;display:flex;min-height:0';

  var side = document.createElement('div');
  side.style.cssText = 'width:38%;max-width:260px;overflow:auto;border-right:1px solid #2c2c34;display:none;background:#15151a';

  var main = document.createElement('div');
  main.style.cssText = 'flex:1;overflow:auto;padding:18px 20px;-webkit-overflow-scrolling:touch;white-space:pre-wrap';

  body.append(side, main);
  root.append(bar, body);
  document.body.append(root);

  // 导入区
  var setup = document.createElement('div');
  setup.style.cssText = 'padding:20px;display:flex;flex-direction:column;gap:10px;align-items:flex-start';
  var file = document.createElement('input');
  file.type = 'file';
  file.accept = '.txt,text/plain';
  file.style.cssText = 'color:#999';
  var reIn = document.createElement('input');
  reIn.value = DEF_RE;
  reIn.placeholder = '章节正则';
  reIn.style.cssText = 'width:100%;box-sizing:border-box;padding:10px;border:1px solid #333;border-radius:9px;background:#101014;color:#ddd;font:12px/1.5 ui-monospace,monospace';
  var hint = document.createElement('div');
  hint.style.cssText = 'font-size:12px;color:#666;line-height:1.8';
  hint.textContent = '默认匹配「第X章/回/节/卷」。导入后按正则切分，可随时改正则重新切。';

  main.append(setup);
  setup.append(file, reIn, hint);

  var text = '';
  var chapters = [];
  var cur = 0;
  var fontSize = 17;

  function parse() {
    if (!text) return;
    var re;
    try { re = new RegExp(reIn.value || DEF_RE, 'g'); }
    catch (e) { return alert('正则写错了：' + e.message); }

    var marks = [], m;
    while ((m = re.exec(text)) !== null) {
      marks.push({ i: m.index, t: (m[0] || '').trim().slice(0, 40) || ('第 ' + (marks.length + 1) + ' 节') });
      if (m.index === re.lastIndex) re.lastIndex++;
    }

    chapters = [];
    if (!marks.length) {
      chapters.push({ t: '全文', s: 0 });
    } else {
      if (marks[0].i > 0) chapters.push({ t: '序', s: 0 });
      marks.forEach(function (mk, k) {
        chapters.push({ t: mk.t, s: mk.i, e: marks[k + 1] ? marks[k + 1].i : text.length });
      });
    }
    chapters.forEach(function (c) { if (c.e == null) c.e = text.length; });
    idbSet(KEY, { text: text, re: reIn.value, cur: 0 });
    drawSide();
    show(0);
  }

  function drawSide() {
    side.innerHTML = '';
    chapters.forEach(function (c, i) {
      var b = document.createElement('div');
      b.textContent = (i + 1) + '. ' + c.t;
      b.style.cssText = 'padding:10px 12px;font-size:13px;color:' + (i === cur ? '#fff' : '#888') + ';background:' + (i === cur ? '#26262c' : 'transparent') + ';cursor:pointer;border-bottom:1px solid #1e1e24';
      b.onclick = function () { show(i); };
      side.append(b);
    });
  }

  function show(i) {
    if (!chapters.length) return;
    cur = Math.max(0, Math.min(i, chapters.length - 1));
    var c = chapters[cur];
    var t = text.slice(c.s, c.e);
    main.innerHTML = '';
    var h = document.createElement('div');
    h.textContent = c.t;
    h.style.cssText = 'font-size:' + (fontSize + 4) + 'px;font-weight:700;margin-bottom:14px;color:#e8e8e8';
    var pre = document.createElement('div');
    pre.textContent = t;
    pre.style.cssText = 'font-size:' + fontSize + 'px;line-height:1.9;color:#c8c8c8;white-space:pre-wrap';
    main.append(h, pre);
    main.scrollTop = 0;
    title.textContent = (cur + 1) + '/' + chapters.length + ' · ' + c.t;
    drawSide();
    idbSet(KEY, { text: text, re: reIn.value, cur: cur });
  }

  minus.onclick = function () { fontSize = Math.max(12, fontSize - 1); show(cur); };
  plus.onclick = function () { fontSize = Math.min(30, fontSize + 1); show(cur); };
  listBtn.onclick = function () {
    side.style.display = side.style.display === 'block' ? 'none' : 'block';
  };

  file.onchange = function () {
    var f = file.files && file.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      text = String(r.result || '');
      setup.style.display = 'none';
      parse();
    };
    r.readAsText(f, 'utf-8');
  };

  reIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') parse(); });

  // 恢复上次
  idbGet(KEY, function (v) {
    if (!v || !v.text) return;
    text = v.text;
    reIn.value = v.re || DEF_RE;
    setup.style.display = 'none';
    var marks = [];
    try {
      var re = new RegExp(reIn.value, 'g'), m;
      while ((m = re.exec(text)) !== null) {
        marks.push({ i: m.index, t: (m[0] || '').trim().slice(0, 40) });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    } catch (e) {}
    chapters = [];
    if (!marks.length) chapters.push({ t: '全文', s: 0, e: text.length });
    else {
      if (marks[0].i > 0) chapters.push({ t: '序', s: 0, e: marks[0].i });
      marks.forEach(function (mk, k) { chapters.push({ t: mk.t, s: mk.i, e: marks[k + 1] ? marks[k + 1].i : text.length }); });
    }
    drawSide();
    show(v.cur || 0);
  });

  // 换书
  var again = document.createElement('div');
  again.textContent = '重新导入';
  again.style.cssText = 'padding:10px 12px;color:#5a8;font-size:12px;cursor:pointer;border-bottom:1px solid #1e1e24';
  again.onclick = function () { setup.style.display = 'flex'; main.innerHTML = ''; main.append(setup); };
  side.append(again);
  side.addEventListener('click', function () {}, true);
})();
