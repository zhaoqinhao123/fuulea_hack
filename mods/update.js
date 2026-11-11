/* 版本更新：查最新版本 → 生成注入串 → 一键复制（不自动注入，不改页面） */
(function () {
  var OLD = document.getElementById('__upd');
  if (OLD) OLD.remove();

  var REPO = 'zhaoqinhao123/fuulea_hack';
  var HOSTS = ['https://fastly.jsdelivr.net', 'https://cdn.jsdelivr.net'];
  var cur = '';
  try { cur = window.__fhTag || localStorage.getItem('fhV') || ''; } catch (e) { cur = window.__fhTag || ''; }
  if (!cur) cur = '?';

  function vnum(s) {
    var m = String(s || '').match(/(\d+)\.(\d+)/);
    return m ? [+m[1], +m[2]] : null;
  }
  function desc(a, b) { return (b[0] - a[0]) || (b[1] - a[1]); }

  function withTimeout(url, ms) {
    var c = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (c) c.abort(); }, ms);
    var opt = { cache: 'no-store' };
    if (c) opt.signal = c.signal;
    return fetch(url, opt).then(function (r) { clearTimeout(t); return r; },
      function (e) { clearTimeout(t); throw e; });
  }

  function copyText(t, done) {
    var fin = false;
    function once(ok) { if (fin) return; fin = true; done(ok); }
    setTimeout(function () { once(false); }, 1600);
    function fallback() {
      try {
        var x = document.createElement('textarea');
        x.value = t;
        x.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.append(x);
        x.select();
        var ok = document.execCommand('copy');
        x.remove();
        once(ok);
      } catch (e) { once(false); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { navigator.clipboard.writeText(t).then(function () { once(true); }, fallback); }
      catch (e) { fallback(); }
    } else fallback();
  }

  // CDN 与 GitHub tag 双源查最新版；本机版本也参与比较，源比本机旧时不退版
  function findLatest() {
    function fromCdn() {
      return withTimeout('https://data.jsdelivr.com/v1/packages/gh/' + REPO, 7000)
        .then(function (r) { return r.json(); })
        .then(function (j) {
          return (j.versions || []).map(function (v) { return v.version; }).filter(vnum);
        })
        .catch(function () { return []; });
    }
    function fromGithub() {
      return withTimeout('https://api.github.com/repos/' + REPO + '/tags?per_page=100', 7000)
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (a) {
          return (a || []).map(function (t) { return t.name; }).filter(vnum);
        })
        .catch(function () { return []; });
    }
    return Promise.all([fromCdn(), fromGithub()]).then(function (rs) {
      var vers = rs[0].concat(rs[1]);
      if (vnum(cur)) vers.push(cur);
      vers = vers.filter(vnum);
      if (!vers.length) throw new Error('查不到版本');
      vers.sort(function (a, b) { return desc(vnum(a), vnum(b)); });
      return vers[0];
    });
  }

  // 先用 fastly 镜像逐源试拉 loader.js，验证这个 tag 真能加载，再给出串
  function probe(tag) {
    var ref = String(tag).replace(/^v/i, '');
    var cands = [];
    HOSTS.forEach(function (h) { cands.push(h + '/gh/' + REPO + '@' + ref + '/loader.js'); });
    var i = 0;
    function next() {
      if (i >= cands.length) return Promise.resolve({ ok: false, url: cands[0], text: '' });
      var u = cands[i++];
      return withTimeout(u + '?t=' + Date.now(), 8000).then(function (r) {
        return r.text().then(function (t) {
          var good = r.ok && t.length > 1000;
          return good ? { ok: true, url: u, text: t } : next();
        });
      }, function () { return next(); });
    }
    return next();
  }

  function mkBtn(t) {
    var b = document.createElement('button');
    b.textContent = t;
    b.style.cssText = 'height:30px;padding:0 11px;border:1px solid #3a3a42;border-radius:8px;' +
      'background:#26262c;color:#ccc;font:12px/1 inherit;cursor:pointer';
    return b;
  }

  var d = document.createElement('div');
  d.id = '__upd';
  d.style.cssText = 'position:fixed;inset:0;z-index:2147483645;background:rgba(10,10,12,.94);' +
    'display:flex;align-items:center;justify-content:center;padding:14px;' +
    'font:13px/1.55 -apple-system,"PingFang SC",sans-serif;color:#ddd';

  var card = document.createElement('div');
  card.style.cssText = 'width:min(680px,100%);max-height:86vh;display:flex;flex-direction:column;' +
    'background:#1b1b20;border:1px solid #3a3a42;border-radius:14px;overflow:hidden';

  var head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #2e2e35';
  var title = document.createElement('div');
  title.textContent = '🔄 版本更新';
  title.style.cssText = 'flex:1;font-weight:700;color:#ccc';
  var close = document.createElement('button');
  close.textContent = '✕';
  close.style.cssText = 'width:40px;height:36px;border:0;border-radius:9px;background:transparent;color:#999;font-size:16px;cursor:pointer';
  close.onclick = function () { d.remove(); };
  head.append(title, close);

  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;min-height:0';

  var stat = document.createElement('div');
  stat.style.cssText = 'font:11.5px/1.6 ui-monospace,Menlo,Consolas,monospace;color:#9a9aa8;' +
    'word-break:break-all;padding:8px 10px;border:1px solid #2e2e35;border-radius:9px;background:#151519';
  stat.textContent = '当前 ' + cur + ' · 点「查询最新版」获取最新注入串';

  var ta = document.createElement('textarea');
  ta.readOnly = true;
  ta.rows = 3;
  ta.placeholder = '查询后这里显示注入串';
  ta.style.cssText = 'width:100%;box-sizing:border-box;padding:8px 9px;border:1px solid #2e2e35;' +
    'border-radius:9px;background:#101014;color:#9fd6a0;font:11px/1.55 ui-monospace,Menlo,Consolas,monospace;' +
    'resize:vertical;word-break:break-all';

  var btns = document.createElement('div');
  btns.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center';

  var get = mkBtn('🔄 查询最新版');
  var copyInj = mkBtn('📋 复制注入串');
  var copyFull = mkBtn('📋 复制带版本前缀');
  var refresh = mkBtn('♻ 刷新本机缓存');
  copyInj.disabled = true;
  copyFull.disabled = true;
  refresh.disabled = true;

  btns.append(get, copyInj, copyFull, refresh);

  var note = document.createElement('div');
  note.style.cssText = 'font-size:11px;line-height:1.65;color:#7a7a88;border-top:1px dashed #2e2e35;padding-top:8px';
  note.textContent = '「带版本前缀」= 版本v' + cur + ' + 注入串；「刷新本机缓存」会把最新 loader.js 写入本机缓存（fhL/fhV），' +
    '只影响本机加载。注：来源 GitHub tag，经 jsDelivr 镜像（fastly → cdn）校验，不自动注入。';

  body.append(stat, ta, btns, note);
  card.append(head, body);
  d.append(card);
  document.body.append(d);
  ta.focus();

  var inj = '';
  var full = '';

  function setResult(tag, res) {
    var ref = String(tag).replace(/^v/i, '');
    var base = res.ok ? res.url : (HOSTS[0] + '/gh/' + REPO + '@' + ref + '/loader.js');
    inj = '<img src=x onerror="with(document)body.appendChild(createElement(\'script\')).src=\'' + base + '\'">';
    full = '版本v' + ref + ' ' + inj;
    ta.value = full;
    copyInj.disabled = false;
    copyFull.disabled = false;
    refresh.disabled = !res.ok;
    note.textContent = '「带版本前缀」= 版本v' + ref + ' + 注入串；「刷新本机缓存」会把最新 loader.js 写入本机缓存（fhL/fhV），' +
      '只影响本机加载。注：来源 GitHub tag，经 jsDelivr 镜像（fastly → cdn）校验，不自动注入。';
    var kn = vnum(cur);
    var same = kn && desc(vnum(ref), kn) === 0;
    var cmp;
    if (!kn) cmp = '当前版本未知';
    else if (same) cmp = '当前 v' + cur + '（已是最新）';
    else cmp = '当前 v' + cur + '（可更新）';
    stat.textContent = cmp + ' · 最新 v' + ref + ' · ' + (res.ok ? 'CDN 已校验' : 'CDN 未通，给出兜底地址');
  }

  get.onclick = function () {
    get.disabled = true;
    get.textContent = '查询中…';
    stat.textContent = '正在查最新版…';
    findLatest().then(function (tag) {
      return probe(tag).then(function (res) {
        setResult(tag, res);
        get.disabled = false;
        get.textContent = '🔄 重新查询';
      });
    }).catch(function (e) {
      stat.textContent = '查不到最新版：' + (e.name === 'AbortError' ? '超时' : (e.message || e.name)) +
        '（可稍后重试；GitHub 访问受限时也会失败）';
      get.disabled = false;
      get.textContent = '🔄 重试';
    });
  };

  copyInj.onclick = function () {
    copyText(inj, function (ok) { stat.textContent = ok ? '注入串已复制' : '复制失败，请长按框内文字手动复制'; });
  };
  copyFull.onclick = function () {
    copyText(full, function (ok) { stat.textContent = ok ? '带版本前缀的注入串已复制' : '复制失败，请长按框内文字手动复制'; });
  };
  refresh.onclick = function () {
    var m = ta.value.match(/gh\/[^@]+@([^/]+)\/loader\.js/);
    var tag = m ? m[1] : '';
    probe(tag).then(function (res) {
      if (!res.ok) { stat.textContent = '拉取失败，未刷新缓存'; return; }
      try {
        localStorage.setItem('fhL', res.text);
        localStorage.setItem('fhV', String(tag).replace(/^v/i, ''));
      } catch (e) {}
      stat.textContent = '本机缓存已刷新到 v' + String(tag).replace(/^v/i, '') + '（刷新页面生效）';
    });
  };
})();
