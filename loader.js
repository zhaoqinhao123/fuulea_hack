/* fuulea_hack loader — 二级面板（学习/查看/工具/AI/便签）+ 拖动 + 小窗 */
(function () {
  // 破上限：页面的分段表只有 4 项，补到 8 项后第 5 只起也能正常自动分级。
  // 规律：SEG_START[i+1] = SEG_START[i] + PET_REQ[i] + 100
  try {
    if (typeof PET_REQ !== 'undefined' && typeof SEG_START !== 'undefined') {
      var _cap = 8;
      while (PET_REQ.length < _cap) PET_REQ.push(1900);
      while (SEG_START.length < _cap) {
        SEG_START.push(SEG_START[SEG_START.length - 1] + PET_REQ[SEG_START.length - 1] + 100);
      }
    }
  } catch (e) {}

  // 强改等级补丁：页面自己的 petStage/petPts 只认总积分，
  // 这里让带 fs 字段的灵宠直接显示指定等级（不动积分）。
  // 注意：state/PET_REQ/RATIOS 可能是 let/const 声明的全局词法变量，不在 window 上，
  // 必须用裸标识符 + typeof 读，否则拿到 undefined。
  try {
    if (!window.__fhFS && typeof petStage === 'function') {
      var _ps = petStage;
      var _pp = (typeof petPts === 'function') ? petPts : null;
      window.petStage = function (i) {
        var p = null;
        try { p = (typeof state !== 'undefined' && state.pets) ? state.pets[i] : null; } catch (e) {}
        if (p && typeof p.fs === 'number' && p.fs >= 0) return Math.min(p.fs, 7);
        return _ps.apply(this, arguments);
      };
      if (_pp) {
        window.petPts = function (i) {
          var p = null;
          try { p = (typeof state !== 'undefined' && state.pets) ? state.pets[i] : null; } catch (e) {}
          if (p && typeof p.fs === 'number') {
            var req = 0, rt = 0;
            try { req = (typeof PET_REQ !== 'undefined' && PET_REQ[i]) || 0; } catch (e) {}
            try { rt = (typeof RATIOS !== 'undefined' && RATIOS[p.fs]) || 0; } catch (e) {}
            return Math.round(req * rt);
          }
          return _pp.apply(this, arguments);
        };
      }
      window.__fhFS = 1;
    }
  } catch (e) {}

  // ── v3.2 一键永久解除时间限制 ──
  // 针对页面 v3.0 起加的限时：上课时段锁、周末封闭、18:20 后每天 20 分钟配额。
  // 页面里 lockInfo/applyLock/tickUsage/lockNow 都是顶层 function 声明（以 window 属性存在），
  // 直接替换即可；LOCK/USAGE 是 const/let 词法变量，碰不到也不需要碰。
  var LOCKFREE_KEY = 'fh:lockfree';
  function lockFreeOn() {
    try { return localStorage.getItem(LOCKFREE_KEY) === '1'; } catch (e) { return false; }
  }
  function lockEl() {
    return document.getElementById('lockOv') || document.querySelector('.lockov');
  }
  function hideLockOv() {
    var ov = lockEl();
    if (!ov) return;
    ov.classList.remove('show');
    ov.setAttribute('data-locked', '0');
    ov.style.display = 'none';
  }
  function patchLockFree() {
    var el = lockEl();
    if (!el) return false;
    if (!window.__fhLockPatched) {
      window.__fhLockPatched = 1;
      // 页面把判定函数挂在顶层就是 window 属性；万一哪天被包进闭包，就只做 DOM 兜底。
      var canFn = typeof window.lockInfo === 'function';
      window.__fhLockOrig = canFn ? {
        lockInfo: window.lockInfo, lockNow: window.lockNow,
        applyLock: window.applyLock, tickUsage: window.tickUsage
      } : null;
      if (canFn) {
        window.lockInfo = function () { return null; };
        window.lockNow = function () { return null; };
        window.applyLock = hideLockOv;
        window.tickUsage = function () {};
      }
      // 页面若把 LOCK 放在全局词法作用域（顶层 const），也能直接把总开关关掉；
      // 函数替换已足够，这里只是多一层保险。
      try {
        if (typeof LOCK !== 'undefined' && LOCK && typeof LOCK.on === 'boolean') {
          window.__fhLockOnOrig = LOCK.on;
          LOCK.on = false;
        }
      } catch (e) {}
      try {
        // 页面万一又给它加回 show，立刻压掉
        new MutationObserver(function () {
          if (window.__fhLockPatched && el.classList.contains('show')) hideLockOv();
        }).observe(el, { attributes: true, attributeFilter: ['class'] });
      } catch (e) {}
    }
    hideLockOv();
    return true;
  }
  function unpatchLockFree() {
    var o = window.__fhLockOrig;
    window.__fhLockPatched = 0;
    if (o) {
      window.lockInfo = o.lockInfo; window.lockNow = o.lockNow;
      window.applyLock = o.applyLock; window.tickUsage = o.tickUsage;
    }
    try {
      if (typeof LOCK !== 'undefined' && LOCK && typeof window.__fhLockOnOrig === 'boolean') {
        LOCK.on = window.__fhLockOnOrig;
      }
    } catch (e) {}
    var ov = lockEl();
    if (ov) ov.style.display = '';
    try { if (o && o.applyLock) o.applyLock(); } catch (e) {}
  }
  function fhToast(msg) {
    var t = document.getElementById('__fhtoast');
    if (!t) {
      t = document.createElement('div');
      t.id = '__fhtoast';
      t.style.cssText = 'position:fixed;left:50%;bottom:78px;transform:translateX(-50%);z-index:2147483647;' +
        'background:rgba(18,18,24,.96);color:#fff;padding:9px 15px;border-radius:10px;' +
        'font:13px/1.4 -apple-system,"PingFang SC",sans-serif;white-space:nowrap;' +
        'box-shadow:0 8px 30px rgba(0,0,0,.45);opacity:0;transition:opacity .18s;pointer-events:none';
      document.body.append(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(window.__fhToastT);
    window.__fhToastT = setTimeout(function () { t.style.opacity = '0'; }, 2400);
  }
  function toggleLockFree(btn) {
    if (lockFreeOn()) {
      if (!confirm('恢复原来的时间限制？\n（解除状态保存在本机浏览器）')) return false;
      try { localStorage.removeItem(LOCKFREE_KEY); } catch (e) {}
      unpatchLockFree();
      fhToast('⏰ 已恢复时间限制');
      if (btn) btn.textContent = '⏱ 解除限时';
      return false;
    }
    if (!patchLockFree()) { alert('当前页面没有检测到限时功能'); return false; }
    try { localStorage.setItem(LOCKFREE_KEY, '1'); } catch (e) {}
    fhToast('🔓 已永久解除时间限制（本机）');
    if (btn) btn.textContent = '🔓 限时已解除';
    return true;
  }
  // 进页面就跑：只要之前解除过，这一屏也不用再点
  if (lockFreeOn()) {
    if (!patchLockFree()) {
      var lockTries = 0;
      var lockTimer = setInterval(function () {
        if (patchLockFree() || ++lockTries > 20) clearInterval(lockTimer);
      }, 250);
    }
  }

  // 自缓存：第一次注入后，把自身源码存进 localStorage，
  // 以后用 <img src=x onerror="eval(localStorage.fhL)"> 就能打开（45 字符）
  var TAG = '3.13.1';

  // 把自己这份源码存进 localStorage，供 44 字符短串 eval 用。
  function cacheSelf() {
    try {
      if (localStorage.getItem('fhV') === TAG && localStorage.getItem('fhL')) return;
      // 主 CDN 在国内常被重置，按顺序换镜像重试
      var hosts = [
        'https://cdn.jsdelivr.net/gh/zhaoqinhao123/fuulea_hack@',
        'https://fastly.jsdelivr.net/gh/zhaoqinhao123/fuulea_hack@',
        'https://gcore.jsdelivr.net/gh/zhaoqinhao123/fuulea_hack@'
      ];
      var hi = 0;
      (function tryHost() {
        if (hi >= hosts.length) return;
        var x = new XMLHttpRequest();
        x.open('GET', hosts[hi++] + TAG + '/loader.js', true);
        x.timeout = 6000;
        x.onload = function () {
          if (x.status === 200 && x.responseText) {
            try { localStorage.setItem('fhL', x.responseText); localStorage.setItem('fhV', TAG); } catch (e) {}
          } else { tryHost(); }
        };
        x.onerror = x.ontimeout = function () { tryHost(); };
        x.send();
      })();
    } catch (e) {}
  }

  // 再注入一次 = 隐形 / 显形。同一次注入常被页面重复触发（答题重渲染又跑一遍），
  // 用时间戳挡掉 1.5 秒内的重复，否则会「闪一下就消失」。
  // 注意：面板已在页面上时，新注入只会切显示/隐藏，不会替换已加载的旧代码。
  // 所以版本不一致时必须明说，否则用户会以为「注入没生效」。
  var PRE = document.getElementById('__fh');
  if (PRE) {
    var now = Date.now();
    if (window.__fhAt && (now - window.__fhAt) < 1500) return;
    var running = window.__fhTag || '';
    if (running && running !== TAG) {
      fhToast('注入的是 v' + TAG + '，页面还跑着 v' + running + '：刷新页面（F5）后再注入一次');
      cacheSelf();
      PRE.style.display = '';
      window.__fhAt = now;
      return;
    }
    PRE.style.display = (PRE.style.display === 'none') ? '' : 'none';
    window.__fhAt = now;
    return;
  }

  try { window.__fhTag = TAG; } catch (e) {}
  cacheSelf();

  var MOD_BASES = [
    'https://cdn.jsdelivr.net/gh/zhaoqinhao123/fuulea_hack@' + TAG + '/',
    'https://fastly.jsdelivr.net/gh/zhaoqinhao123/fuulea_hack@' + TAG + '/',
    'https://gcore.jsdelivr.net/gh/zhaoqinhao123/fuulea_hack@' + TAG + '/',
    'https://raw.githubusercontent.com/zhaoqinhao123/fuulea_hack/v' + TAG + '/',
    'https://gitlab.com/api/v4/projects/88544686/repository/files/'
  ];

  function loadMod(path, btn, after) {
    function done() { if (btn) { btn.disabled = false; btn.style.opacity = 1; } }
    function ok() {
      done();
      if (typeof after === 'function') { try { after(); } catch (e) {} }
    }
    function cached(why) {
      var c = null;
      try { c = localStorage.getItem('fh:mod:' + path); } catch (e) {}
      if (c) { try { eval(c); return ok(); } catch (e) {} }
      alert('加载失败：' + why);
      done();
    }
    var urls = [
      MOD_BASES[0] + path + '?t=' + Date.now(),
      MOD_BASES[1] + path + '?t=' + Date.now(),
      MOD_BASES[2] + path + '?t=' + Date.now(),
      MOD_BASES[3] + path + '?t=' + Date.now(),
      MOD_BASES[4] + encodeURIComponent(path) + '/raw?ref=v' + TAG + '&t=' + Date.now()
    ];
    var i = 0;
    (function next() {
      if (i >= urls.length) return cached('五个源都没通');
      var s = document.createElement('script');
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true; s.remove(); next();
      }, 5000);
      s.onload = function () { if (settled) return; settled = true; clearTimeout(timer); s.remove(); ok(); };
      s.onerror = function () { if (settled) return; settled = true; clearTimeout(timer); s.remove(); next(); };
      s.src = urls[i++];
      document.body.append(s);
    })();
  }

  // ── v3.3 配置同步（加密存 GitLab；PIN 解锁；Token/管理员密钥可重置 PIN） ──
  // v3.6：配置统一传到 AI 用的私有仓库（AI 聊天室/相册早就在这里）。
  // 仓库私有，所以读接口也要带 Token；新设备先填读权限 Token，再输 PIN 解密。
  var CFG_PROJ = 'yq-group2/fuulea_ai_repository';
  var CFG_BRANCH = 'main';
  var CFG_DIR = 'config/';
  var CFG_RTOK_KEY = 'fh:cfg:rTok';   // 只用于读配置的 Token（恢复成功后不保留）
  var CFG_ID_KEY = 'fh:cfg:id';
  var CFG_AT_KEY = 'fh:cfg:at';
  var CFG_ADM_KEY = 'fh:cfg:admKey';
  var CFG_PIN_KEY = 'fh:cfg:pin';     // v3.5：本机保存的恢复 PIN（上传时自动生成，不再让用户填）
  var CFG_PIN_T = 'fh:cfg:pinAt';
  var CFG_ITER = 150000;

  function cfgLs(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function cfgSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function cfgB64(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function cfgUnb64(s) {
    var bin = atob(String(s || '')), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function cfgBytes(n) { var u = new Uint8Array(n); crypto.getRandomValues(u); return u; }
  function cfgNewId() {
    var abc = 'abcdefghijklmnopqrstuvwxyz0123456789', s = 'u', r = cfgBytes(10);
    for (var i = 0; i < 10; i++) s += abc.charAt(r[i] % abc.length);
    return s;
  }
  function cfgReady() {
    return !!(window.crypto && crypto.subtle && crypto.subtle.deriveKey && window.TextEncoder);
  }
  function cfgKdf(pass, saltB64) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: cfgUnb64(saltB64), iterations: CFG_ITER, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }
  function cfgEnc(key, obj) {
    var iv = cfgBytes(12);
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key,
      new TextEncoder().encode(JSON.stringify(obj)))
      .then(function (ct) { return cfgB64(iv) + '.' + cfgB64(ct); });
  }
  function cfgDec(key, s) {
    var p = String(s || '').split('.');
    if (p.length !== 2) return Promise.reject(new Error('bad cipher'));
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: cfgUnb64(p[0]) }, key, cfgUnb64(p[1]))
      .then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
  }
  function cfgImport(rawB64) {
    return crypto.subtle.importKey('raw', cfgUnb64(rawB64), 'AES-GCM', true, ['encrypt', 'decrypt']);
  }
  function cfgExport(key) { return crypto.subtle.exportKey('raw', key).then(cfgB64); }
  function cfgPinOk(p) { return /^[^\s]{6,30}$/.test(String(p || '')); }
  // v3.5：本地恢复 PIN（自动生成、自动保存；只有换设备/清缓存时才需要用户输入）
  function cfgPinGet() {
    var p = cfgLs(CFG_PIN_KEY);
    return cfgPinOk(p) ? p : '';
  }
  function cfgPinSet(p) {
    if (!cfgPinOk(p)) return false;
    cfgSet(CFG_PIN_KEY, p);
    cfgSet(CFG_PIN_T, String(Date.now()));
    return true;
  }
  function cfgPinNew() {
    var abc = 'abcdefghjkmnpqrstuvwxyz23456789', s = 'FH', r = cfgBytes(12);
    for (var i = 0; i < 12; i++) {
      if (i === 4 || i === 8) s += '-';
      s += abc.charAt(r[i] % abc.length);
    }
    return s;   // 形如 FH7k2m-9xq4-p3wd
  }
  function cfgTokenLocal() {
    var t = cfgLs('fh:ai:gitToken');
    if (!t) { var a = acctCur(); if (a) t = String(a.gitToken || ''); }
    return t;
  }
  function cfgCopy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.append(ta);
      ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }
  function cfgExcluded(k) {
    if (k.indexOf('fh:') !== 0) return true;
    if (k === 'fh:ai:key' || k === 'fh:ai:gitToken' || k === 'fh:ai:sessions' || k === 'fh:ai:sid') return true;
    if (k === 'fh:ai:roomCache' || k === 'fh:room:cache' || k === 'fh:cmdhist') return true;
    if (k === 'fh:acct' || k === 'fh:acct:try') return true;
    if (k === CFG_ID_KEY || k === CFG_AT_KEY || k === CFG_ADM_KEY) return true;
    if (k === CFG_PIN_KEY || k === CFG_PIN_T) return true;
    if (k.indexOf('fh:ai:hist:') === 0 || k.indexOf('fh:ai:usage:') === 0 || k.indexOf('fh:mod:') === 0) return true;
    return false;
  }
  function cfgCollect() {
    var out = {};
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (cfgExcluded(k)) return;
        out[k] = localStorage.getItem(k);
      });
    } catch (e) {}
    return out;
  }
  function cfgApply(keys) {
    var n = 0;
    Object.keys(keys || {}).forEach(function (k) {
      if (cfgExcluded(k)) return;
      try { localStorage.setItem(k, String(keys[k])); n++; } catch (e) {}
    });
    return n;
  }
  // 项目路径含 '/'，GitLab API 里必须整体编码成 %2F
  function cfgProj() {
    return encodeURIComponent(CFG_PROJ);
  }
  function cfgTokenRead() {
    return cfgTokenLocal() || cfgLs(CFG_RTOK_KEY);
  }
  function cfgUrl(p) {
    return 'https://gitlab.com/api/v4/projects/' + cfgProj() + '/repository/files/' +
      encodeURIComponent(p) + '/raw?ref=' + CFG_BRANCH + '&t=' + Date.now();
  }
  function cfgReq(method, url, text, token) {
    return new Promise(function (resolve) {
      var x = new XMLHttpRequest();
      x.open(method, url, true);
      x.timeout = 20000;
      if (token) x.setRequestHeader('PRIVATE-TOKEN', token);
      x.setRequestHeader('Content-Type', 'application/json');
      x.onload = function () {
        resolve({ ok: x.status >= 200 && x.status < 300, status: x.status, text: x.responseText || '' });
      };
      x.onerror = x.ontimeout = function () { resolve({ ok: false, status: 0, text: 'network' }); };
      x.send(text || null);
    });
  }
  // 返回 { ok, status, items }：私有仓库没 Token 时会 401/403/404，调用方要能区分
  function cfgList(tok) {
    var token = (tok === undefined) ? cfgTokenRead() : tok;
    var url = 'https://gitlab.com/api/v4/projects/' + cfgProj() + '/repository/tree?path=config&ref=' +
      CFG_BRANCH + '&per_page=100&t=' + Date.now();
    return cfgReq('GET', url, null, token).then(function (r) {
      var out = { ok: r.ok, status: r.status, items: [] };
      if (!r.ok) return out;
      try {
        JSON.parse(r.text).forEach(function (it) {
          if (it && it.type === 'blob' && /^config\/[^\/]+\.json$/.test(it.path)) out.items.push(it.path);
        });
      } catch (e) {}
      return out;
    });
  }
  function cfgGet(path, tok) {
    var token = (tok === undefined) ? cfgTokenRead() : tok;
    return cfgReq('GET', cfgUrl(path), null, token).then(function (r) {
      if (!r.ok) return null;
      try { return JSON.parse(r.text); } catch (e) { return null; }
    });
  }
  function cfgPut(path, obj, token) {
    var body = JSON.stringify({
      branch: CFG_BRANCH,
      content: JSON.stringify(obj, null, 2),
      encoding: 'text',
      commit_message: 'config ' + obj.id + ' @ ' + new Date().toISOString()
    });
    var u = 'https://gitlab.com/api/v4/projects/' + cfgProj() + '/repository/files/' + encodeURIComponent(path);
    return cfgReq('PUT', u, body, token).then(function (r) {
      if (r.ok) return r;
      return cfgReq('POST', u, body, token).then(function (r2) {
        if (r2.ok) return r2;
        return cfgReq('PUT', u, body, token);
      });
    });
  }
  function cfgBtn(t, bg) {
    var b = document.createElement('button');
    b.textContent = t;
    b.style.cssText = 'height:32px;padding:0 12px;border:1px solid #3a3a42;border-radius:8px;background:' +
      (bg || '#26262e') + ';color:#dcdce6;font:12px/1 inherit;cursor:pointer';
    return b;
  }
  function cfgDialog(title) {
    var old = document.getElementById('__fhcfg');
    if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = '__fhcfg';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(8,8,10,.74);' +
      'display:flex;align-items:center;justify-content:center;padding:16px;' +
      'font:13px/1.5 -apple-system,"PingFang SC",sans-serif';
    var box = document.createElement('div');
    box.style.cssText = 'width:min(390px,94vw);max-height:88vh;overflow:auto;background:#1c1c22;' +
      'border:1px solid #3a3a42;border-radius:14px;padding:14px;color:#ddd;' +
      'box-shadow:0 24px 70px rgba(0,0,0,.6)';
    var h = document.createElement('div');
    h.textContent = title;
    h.style.cssText = 'font-weight:700;font-size:14px;color:#eee;margin-bottom:10px';
    var body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    var stat = document.createElement('div');
    stat.style.cssText = 'min-height:16px;font-size:11.5px;color:#8a8a99;word-break:break-all;margin-top:8px';
    box.append(h, body, stat);
    ov.append(box);
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    document.body.append(ov);
    return { ov: ov, body: body, stat: stat, close: function () { ov.remove(); } };
  }
  function cfgField(box, label, opt) {
    var l = document.createElement('label');
    l.style.cssText = 'display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:#9a9aa8';
    var sp = document.createElement('span');
    sp.textContent = label;
    var inp = document.createElement('input');
    inp.type = (opt && opt.type) || 'text';
    inp.style.cssText = 'height:32px;padding:0 9px;border:1px solid #3a3a42;border-radius:8px;' +
      'background:#141419;color:#e6e6ee;font:12.5px/1 inherit;outline:none';
    l.append(sp, inp);
    box.append(l);
    return inp;
  }

  // v3.5：上传配置不再要求用户设置 PIN —— 首次自动生成并保存在本机，
  // 有 Token 时一键上传，只有缺 Token 才弹一个输入框。
  async function cfgUpload(pin, fresh, tok, say) {
    var stat = say || function () {};
    var id = fresh ? cfgNewId() : (cfgLs(CFG_ID_KEY) || cfgNewId());
    var salt = cfgB64(cfgBytes(16));
    var dk = await cfgImport(cfgB64(cfgBytes(32)));
    var dkRaw = await cfgExport(dk);
    var keys = cfgCollect();
    var now = new Date().toISOString();
    stat('加密并上传 ' + Object.keys(keys).length + ' 项配置…');
    var payload = {
      v: 1, at: now, tag: TAG, id: id,
      kdf: { salt: salt, iter: CFG_ITER },
      hint: cfgLs('fh:ai:nick') || 'fuulea_hack',
      wrapPin: await cfgEnc(await cfgKdf('pin|' + id + '|' + pin, salt), dkRaw),
      wrapTok: await cfgEnc(await cfgKdf('tok|' + id + '|' + tok, salt), dkRaw),
      box: await cfgEnc(dk, { tok: tok, keys: keys })
    };
    var ak = cfgLs(CFG_ADM_KEY);
    if (ak) payload.wrapAdm = await cfgEnc(await cfgKdf('adm|' + id + '|' + ak, salt), dkRaw);
    var r = await cfgPut(CFG_DIR + id + '.json', payload, tok);
    if (!r.ok) return { ok: false, status: r.status, text: r.text, id: id };
    cfgSet(CFG_ID_KEY, id);
    cfgSet(CFG_AT_KEY, now);
    cfgPinSet(pin);
    cfgSet('fh:ai:gitToken', tok);
    acctSetField('gitToken', tok);
    return { ok: true, id: id, n: Object.keys(keys).length };
  }

  function cfgPinBox(box, pin) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'border:1px dashed #3d5a8a;border-radius:10px;padding:8px 10px;background:#182234';
    var t = document.createElement('div');
    t.style.cssText = 'font-size:11px;color:#8aa8d8';
    t.textContent = '恢复 PIN（已自动保存到本机；换设备恢复配置时要用）';
    var v = document.createElement('div');
    v.textContent = pin;
    v.style.cssText = 'font:700 15px/1.6 ui-monospace,monospace;color:#9fc0ff;letter-spacing:.5px;word-break:break-all';
    var cp = cfgBtn('复制 PIN');
    cp.onclick = function () {
      if (cfgCopy(pin)) fhToast('📋 PIN 已复制');
      else fhToast('复制失败，请手动选中上面的 PIN');
    };
    wrap.append(t, v, cp);
    box.append(wrap);
    return wrap;
  }

  function cfgUploadUi(pin, tok) {
    var d = cfgDialog('⬆ 上传配置到云端');
    var tip = document.createElement('div');
    tip.style.cssText = 'font-size:11.5px;color:#8a8a99';
    tip.textContent = 'PIN 已自动生成并保存在本机，无需手动设置。';
    d.body.append(tip);
    d.stat.textContent = '准备中…';
    cfgUpload(pin, !cfgLs(CFG_ID_KEY), tok, function (s) { d.stat.textContent = s; }).then(function (r) {
      if (!r.ok) {
        d.body.innerHTML = '';
        d.stat.textContent = '';
        var err = document.createElement('div');
        err.style.cssText = 'font-size:12px;color:#ff9b9b;word-break:break-all';
        err.textContent = '上传失败（' + (r.status || '网络') + '）：' +
          String(r.text || '').replace(/\s+/g, ' ').slice(0, 160);
        if (r.status === 401 || r.status === 403 || r.status === 404) {
          var e2 = document.createElement('div');
          e2.style.cssText = 'font-size:11.5px;color:#ffcf8a;line-height:1.6';
          e2.textContent = 'Token 对 ' + CFG_PROJ + ' 没有写权限（需要 Developer/Maintainer 及以上）。仓库是私有的，Token 还要有 read_api 才能读取。';
          err.textContent = '上传失败（' + r.status + '）：Token 无权写入该仓库';
          d.body.append(err, e2);
          var again0 = cfgBtn('重试', '#3a6df0');
          again0.onclick = function () { d.close(); uploadConfig(); };
          var cls0 = cfgBtn('关闭');
          cls0.onclick = d.close;
          d.body.append(again0, cls0);
          return;
        }
        d.body.append(err);
        var again = cfgBtn('重试', '#3a6df0');
        again.onclick = function () { d.close(); uploadConfig(); };
        var cls = cfgBtn('关闭');
        cls.onclick = d.close;
        d.body.append(again, cls);
        return;
      }
      d.body.innerHTML = '';
      var ok = document.createElement('div');
      ok.style.cssText = 'font-size:12px;color:#7ee2a8';
      ok.textContent = '✅ 已上传 ' + r.n + ' 项配置（ID ' + r.id + '）';
      d.body.append(ok);
      cfgPinBox(d.body, pin);
      var hint = document.createElement('div');
      hint.style.cssText = 'font-size:11px;color:#8a8a99;line-height:1.6';
      hint.textContent = '以后点「⬆ 上传配置」直接覆盖云端，不再询问 PIN；点「⬇ 更新配置」本机直接恢复，也不用输入 PIN。';
      d.body.append(hint);
      var done = cfgBtn('完成', '#3a6df0');
      done.onclick = d.close;
      d.body.append(done);
      d.stat.textContent = '';
      fhToast('⬆ 配置已上传到云端');
    });
  }

  function uploadConfig() {
    if (!cfgReady()) { alert('当前环境不支持加密（请用 https 或 Chrome 打开本地文件）'); return; }
    if (!acctCur()) {
      fhToast('请先登录账号（用户名 + PIN）');
      acctOpen(uploadConfig);
      return;
    }
    var pin = cfgPinGet();
    if (!pin) { pin = cfgPinNew(); cfgPinSet(pin); }

    var tok = cfgTokenLocal();
    if (tok) { cfgUploadUi(pin, tok); return; }

    // 只有缺 Token 时才弹一个最小的窗口（PIN 不再询问）
    var d = cfgDialog('⬆ 首次上传配置');
    var tip = document.createElement('div');
    tip.style.cssText = 'font-size:11.5px;color:#8a8a99;line-height:1.6';
    tip.textContent = '需要一次 GitLab Token（写权限）用来上传加密配置；PIN 会自动生成并保存在本机。';
    d.body.append(tip);
    var tIn = cfgField(d.body, 'GitLab Token', { type: 'password' });
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;margin-top:4px';
    var okBtn = cfgBtn('开始上传', '#3a6df0');
    var cancel = cfgBtn('取消');
    row.append(okBtn, cancel);
    d.body.append(row);
    cancel.onclick = d.close;
    okBtn.onclick = function () {
      var t = tIn.value.trim();
      if (!t) { d.stat.textContent = '请填 GitLab Token（或在 AI 网页 🔑 里保存）'; return; }
      d.close();
      cfgUploadUi(pin, t);
    };
  }

  async function cfgPull(pin, say, tokArg) {
    var stat = say || function () {};
    var tok = (tokArg === undefined) ? cfgTokenRead() : tokArg;
    stat('读取云端配置列表…');
    var listed = await cfgList(tok);
    if (!listed.ok) {
      var auth = (listed.status === 401 || listed.status === 403 || listed.status === 404);
      return {
        ok: false, auth: auth, status: listed.status,
        msg: auth
          ? ('读取失败（' + listed.status + '）：该仓库是私有的，Token 需有 ' + CFG_PROJ + ' 的读权限')
          : ('读取云端配置失败（' + (listed.status || '网络') + '）')
      };
    }
    var files = listed.items;
    if (!files.length) return { ok: false, msg: '云端暂无配置' };
    for (var i = 0; i < files.length; i++) {
      stat('尝试 ' + (i + 1) + '/' + files.length + '：' + files[i]);
      var o = await cfgGet(files[i], tok);
      if (!o || !o.kdf || !o.wrapPin || !o.box) continue;
      try {
        var k = await cfgKdf('pin|' + o.id + '|' + pin, o.kdf.salt);
        var raw = await cfgDec(k, o.wrapPin);
        var dk = await cfgImport(raw);
        var bx = await cfgDec(dk, o.box);
        var n = cfgApply(bx.keys);
        if (bx.tok) { cfgSet('fh:ai:gitToken', bx.tok); acctSetField('gitToken', bx.tok); }
        cfgSet(CFG_ID_KEY, o.id);
        cfgSet(CFG_AT_KEY, o.at || new Date().toISOString());
        cfgPinSet(pin);
        try { localStorage.removeItem(CFG_RTOK_KEY); } catch (e) {}
        return { ok: true, n: n, id: o.id };
      } catch (e) {}
    }
    return { ok: false, msg: 'PIN 不正确，或云端没有对应的配置' };
  }

  // 私有仓库：新设备先要一个读权限 Token（只用于本次恢复；恢复成功后会用备份里的真 Token 覆盖）
  function cfgAskToken(then) {
    var d = cfgDialog('🔑 私有仓库需要读取 Token');
    var tip = document.createElement('div');
    tip.style.cssText = 'font-size:11.5px;color:#8a8a99;line-height:1.6';
    tip.textContent = '配置仓库 ' + CFG_PROJ + ' 是私有的。请填一个有该仓库读权限的 GitLab Token（read_api 即可），验证通过后再输入恢复 PIN。';
    d.body.append(tip);
    var tIn = cfgField(d.body, 'GitLab Token（读权限）', { type: 'password' });
    tIn.value = cfgLs(CFG_RTOK_KEY) || '';
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;margin-top:4px';
    var okBtn = cfgBtn('继续', '#3a6df0');
    var cancel = cfgBtn('取消');
    row.append(okBtn, cancel);
    d.body.append(row);
    cancel.onclick = d.close;
    okBtn.onclick = function () {
      var t = tIn.value.trim();
      if (!t) { d.stat.textContent = '请填 Token'; return; }
      okBtn.disabled = true;
      d.stat.textContent = '验证 Token…';
      cfgList(t).then(function (res) {
        okBtn.disabled = false;
        if (!res.ok) {
          d.stat.textContent = 'Token 无效或没有读权限（' + (res.status || '网络') + '）';
          return;
        }
        cfgSet(CFG_RTOK_KEY, t);
        d.close();
        then(t);
      });
    };
    setTimeout(function () { try { tIn.focus(); } catch (e) {} }, 60);
  }

  function cfgPullUi(pin, tok) {
    var d = cfgDialog('⬇ 从云端恢复配置');
    var tip = document.createElement('div');
    tip.style.cssText = 'font-size:11.5px;color:#8a8a99';
    tip.textContent = '使用本机保存的恢复 PIN 自动恢复，不需要手动输入。';
    d.body.append(tip);
    d.stat.textContent = '准备中…';
    cfgPull(pin, function (s) { d.stat.textContent = s; }, tok).then(function (r) {
      if (!r.ok) {
        d.body.innerHTML = '';
        d.stat.textContent = '';
        var err = document.createElement('div');
        err.style.cssText = 'font-size:12px;color:#ff9b9b;line-height:1.6';
        err.textContent = r.msg || '恢复失败';
        d.body.append(err);
        if (r.auth) {
          var rt = cfgBtn('重填 Token', '#3a6df0');
          rt.onclick = function () {
            d.close();
            cfgAskToken(function (t) { cfgPullUi(pin, t); });
          };
          d.body.append(rt);
        }
        var retry = cfgBtn('手动输入 PIN', r.auth ? undefined : '#3a6df0');
        retry.onclick = function () { d.close(); pullConfigAsk(); };
        var cls = cfgBtn('关闭');
        cls.onclick = d.close;
        d.body.append(retry, cls);
        return;
      }
      d.body.innerHTML = '';
      var ok = document.createElement('div');
      ok.style.cssText = 'font-size:12px;color:#7ee2a8';
      ok.textContent = '✅ 已恢复 ' + r.n + ' 项配置（ID ' + r.id + '）';
      d.body.append(ok);
      var done = cfgBtn('完成', '#3a6df0');
      done.onclick = d.close;
      d.body.append(done);
      d.stat.textContent = '';
      fhToast('⬇ 配置已恢复（' + r.n + ' 项）');
    });
  }

  function pullConfigAsk() {
    var d = cfgDialog('⬇ 从云端恢复配置（输入 PIN）');
    var tip = document.createElement('div');
    tip.style.cssText = 'font-size:11.5px;color:#8a8a99;line-height:1.6';
    tip.textContent = '本机没有保存的 PIN（换设备 / 清过缓存 / 重新安装）。请输入上次上传完成后显示的恢复 PIN。';
    d.body.append(tip);
    var pin = cfgField(d.body, '恢复 PIN（形如 FH7k2m-9xq4-p3wd）', { type: 'password' });
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;margin-top:4px';
    var okBtn = cfgBtn('恢复', '#3a6df0');
    var forgot = cfgBtn('忘记 PIN');
    var cancel = cfgBtn('取消');
    row.append(okBtn, forgot, cancel);
    d.body.append(row);
    cancel.onclick = d.close;
    forgot.onclick = function () { d.close(); resetPinDialog(); };
    okBtn.onclick = function () {
      var p = pin.value.trim();
      if (!cfgPinOk(p)) { d.stat.textContent = 'PIN 需 6-30 位且不含空格'; return; }
      d.close();
      cfgPullUi(p);
    };
    setTimeout(function () { try { pin.focus(); } catch (e) {} }, 60);
  }

  function pullConfig() {
    if (!cfgReady()) { alert('当前环境不支持加密（请用 https 或 Chrome 打开本地文件）'); return; }
    if (!acctCur()) {
      fhToast('请先登录账号（用户名 + PIN）');
      acctOpen(pullConfig);
      return;
    }
    var tok = cfgTokenRead();
    var pin = cfgPinGet();
    // 仓库私有：没有任何 Token 时先要读权限 Token，再走 PIN
    if (!tok) {
      cfgAskToken(function (t) {
        if (pin) cfgPullUi(pin, t); else pullConfigAsk();
      });
      return;
    }
    if (pin) { cfgPullUi(pin, tok); return; }
    pullConfigAsk();
  }

  function resetPinDialog() {
    var d = cfgDialog('🔑 重置 PIN（忘记 PIN 时）');
    var idIn = cfgField(d.body, '配置 ID（留空则遍历云端全部配置）');
    if (cfgLs(CFG_ID_KEY)) idIn.value = cfgLs(CFG_ID_KEY);
    var tokIn = cfgField(d.body, 'GitLab Token（写权限，用于更新文件）', { type: 'password' });
    var admIn = cfgField(d.body, '管理员密钥（可选，与 Token 二选一解包）', { type: 'password' });
    var pin = cfgField(d.body, '新 PIN', { type: 'password' });
    var pin2 = cfgField(d.body, '再输一次新 PIN', { type: 'password' });
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;margin-top:4px';
    var okBtn = cfgBtn('重置 PIN', '#3a6df0');
    var back = cfgBtn('返回');
    var cancel = cfgBtn('取消');
    row.append(okBtn, back, cancel);
    d.body.append(row);
    cancel.onclick = d.close;
    back.onclick = function () { d.close(); pullConfig(); };

    okBtn.onclick = async function () {
      var np = pin.value.trim();
      if (!cfgPinOk(np)) { d.stat.textContent = '新 PIN 需 6-30 位且不含空格'; return; }
      if (pin2.value.trim() !== np) { d.stat.textContent = '两次 PIN 不一致'; return; }
      var tok = tokIn.value.trim() || cfgTokenRead();
      var ak = admIn.value.trim() || cfgLs(CFG_ADM_KEY);
      if (!tok) { d.stat.textContent = '读取私有仓库需要 Token（读权限即可）；管理员密钥只用于解包'; return; }
      okBtn.disabled = true;
      var listed = idIn.value.trim() ? { ok: true, items: [CFG_DIR + idIn.value.trim().replace(/^config\//, '').replace(/\.json$/, '') + '.json'] } : await cfgList(tok);
      var files = listed.items || [];
      if (!files.length) { okBtn.disabled = false; d.stat.textContent = listed.ok ? '云端暂无配置' : ('读取失败（' + (listed.status || '网络') + '）：Token 需有该仓库读权限'); return; }
      for (var i = 0; i < files.length; i++) {
        d.stat.textContent = '尝试 ' + (i + 1) + '/' + files.length + '：' + files[i];
        var o = await cfgGet(files[i], tok);
        if (!o || !o.kdf) continue;
        var raw = null;
        if (tok && o.wrapTok) {
          try { raw = await cfgDec(await cfgKdf('tok|' + o.id + '|' + tok, o.kdf.salt), o.wrapTok); } catch (e) {}
        }
        if (!raw && ak && o.wrapAdm) {
          try { raw = await cfgDec(await cfgKdf('adm|' + o.id + '|' + ak, o.kdf.salt), o.wrapAdm); } catch (e) {}
        }
        if (!raw || !o.box) continue;
        var dk = await cfgImport(raw);
        var writeTok = tok;
        if (!writeTok) { d.stat.textContent = '解包成功，但更新文件还需要 GitLab Token'; okBtn.disabled = false; return; }
        var npayload = {
          v: o.v || 1, at: new Date().toISOString(), tag: o.tag || TAG, id: o.id,
          kdf: o.kdf, hint: o.hint || 'fuulea_hack',
          wrapPin: await cfgEnc(await cfgKdf('pin|' + o.id + '|' + np, o.kdf.salt), raw),
          wrapTok: o.wrapTok || null,
          wrapAdm: o.wrapAdm || null,
          box: o.box
        };
        var r = await cfgPut(files[i], npayload, writeTok);
        if (!r.ok) { okBtn.disabled = false; d.stat.textContent = '重置失败（' + (r.status || '网络') + '）：' + (r.text || '').slice(0, 120); return; }
        if (ak) cfgSet(CFG_ADM_KEY, ak);
        cfgPinSet(np);
        d.stat.textContent = '✅ PIN 已重置（ID ' + o.id + '），已保存到本机，直接用「⬇ 更新配置」即可恢复';
        fhToast('🔑 PIN 已重置');
        setTimeout(d.close, 1200);
        return;
      }
      okBtn.disabled = false;
      d.stat.textContent = 'Token / 管理员密钥都不匹配，或云端没有对应配置';
    };
  }

  function cfgStartupProbe() {
    try {
      if (cfgLs(CFG_AT_KEY)) return;
      if (sessionStorage.getItem('fh:cfg:probe')) return;
      sessionStorage.setItem('fh:cfg:probe', '1');
    } catch (e) { return; }
    if (!cfgReady()) return;
    if (!cfgTokenRead()) return;   // 私有仓库：没有 Token 就不探测，等用户点「⬇ 更新配置」
    cfgList().then(function (res) {
      var files = (res && res.ok && res.items) || [];
      if (!files.length) return;
      var t = document.createElement('div');
      t.id = '__fhcfgtoast';
      t.style.cssText = 'position:fixed;left:50%;bottom:70px;transform:translateX(-50%);z-index:2147483647;' +
        'background:linear-gradient(180deg,#2b2b36,#1d1d26);color:#dcdce6;border:1px solid #3d3d4a;' +
        'padding:10px 14px;border-radius:12px;font:12.5px/1.4 -apple-system,"PingFang SC",sans-serif;' +
        'cursor:pointer;box-shadow:0 12px 36px rgba(0,0,0,.5)';
      t.textContent = cfgPinGet()
        ? ('☁ 云端有 ' + files.length + ' 份配置，点此一键恢复（PIN 已存本机）')
        : ('☁ 云端有 ' + files.length + ' 份配置，点此输入 PIN 恢复');
      t.onclick = function () { t.remove(); pullConfig(); };
      document.body.append(t);
      setTimeout(function () { if (t.parentNode) t.remove(); }, 20000);
    });
  }

  // ── v3.4 账号：用户名 + PIN（本机持久；AI Key / Token / 网页配置按账号保存） ──
  // 登录状态存 fh:acct，刷新/重开都不用再输，直到手动退出或清空。
  var ACCT_KEY = 'fh:acct';
  var ACCT_TRY = 'fh:acct:try';
  var ACCT_GAP = 5000;

  function acctUserKey(user) {
    var s = String(user || '').trim().toLowerCase(), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function acctStore() {
    try {
      var j = JSON.parse(localStorage.getItem(ACCT_KEY) || 'null');
      if (j && j.v === 1 && j.users && typeof j.users === 'object') return j;
    } catch (e) {}
    return { v: 1, users: {}, cur: '', at: 0 };
  }
  function acctSaveStore(a) { try { localStorage.setItem(ACCT_KEY, JSON.stringify(a)); } catch (e) {} }
  function acctCur() {
    var a = acctStore();
    return (a.cur && a.users[a.cur]) ? a.users[a.cur] : null;
  }
  function acctAdopt() {
    var o = {};
    try {
      o.key = localStorage.getItem('fh:ai:key') || '';
      o.gitToken = localStorage.getItem('fh:ai:gitToken') || '';
      o.sites = localStorage.getItem('fh:sites') || '';
    } catch (e) {}
    return o;
  }
  function acctApply(rec) {
    try {
      localStorage.setItem('fh:ai:key', rec.key || '');
      localStorage.setItem('fh:ai:gitToken', rec.gitToken || '');
      localStorage.setItem('fh:sites', typeof rec.sites === 'string' ? rec.sites : JSON.stringify(rec.sites || ''));
    } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('fh:acct', { detail: { user: rec.user, on: true } })); } catch (e) {}
  }
  function acctEmitOff() {
    try { window.dispatchEvent(new CustomEvent('fh:acct', { detail: { user: '', on: false } })); } catch (e) {}
  }
  function acctHash(user, pin, saltB64) {
    var pass = 'acct|' + String(user).trim().toLowerCase() + '|' + String(pin);
    if (window.crypto && crypto.subtle && crypto.subtle.deriveBits && window.TextEncoder) {
      return crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits'])
        .then(function (base) {
          return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: cfgUnb64(saltB64), iterations: 60000, hash: 'SHA-256' }, base, 256);
        })
        .then(function (bits) { return cfgB64(bits); });
    }
    var h1 = 5381, h2 = 52711, s = pass + '|' + saltB64;
    for (var i = 0; i < s.length; i++) {
      h1 = ((h1 * 33) ^ s.charCodeAt(i)) >>> 0;
      h2 = ((h2 * 31) + s.charCodeAt(i)) >>> 0;
    }
    return Promise.resolve('x' + ('0000000' + h1.toString(16)).slice(-8) + ('0000000' + h2.toString(16)).slice(-8));
  }
  function acctWait() {
    var now = Date.now(), last = 0;
    try { last = parseInt(localStorage.getItem(ACCT_TRY) || '0', 10) || 0; } catch (e) {}
    return now - last < ACCT_GAP ? Math.max(1, Math.ceil((ACCT_GAP - (now - last)) / 1000)) : 0;
  }
  function acctMark() { try { localStorage.setItem(ACCT_TRY, String(Date.now())); } catch (e) {} }

  function acctLogin(user, pin) {
    return new Promise(function (resolve) {
      var u = String(user || '').trim();
      var p = String(pin || '');
      if (!/^[^\s]{2,20}$/.test(u)) return resolve({ ok: false, msg: '用户名需 2-20 位且不含空格' });
      if (!/^[^\s]{4,30}$/.test(p)) return resolve({ ok: false, msg: 'PIN 需 4-30 位且不含空格' });
      var wait = acctWait();
      if (wait) return resolve({ ok: false, wait: wait });
      acctMark();
      var a = acctStore();
      var uk = acctUserKey(u);
      var rec = a.users[uk];
      if (rec && String(rec.user || '').trim().toLowerCase() !== u.toLowerCase()) {
        return resolve({ ok: false, msg: '用户名冲突，请换一个' });
      }
      if (rec) {
        acctHash(u, p, rec.salt).then(function (h) {
          if (h !== rec.pinHash) return resolve({ ok: false, msg: 'PIN 不正确' });
          // 老数据迁移：账号里还没有的字段，沿用本机现有值
          if (!rec.key) rec.key = localStorage.getItem('fh:ai:key') || '';
          if (!rec.gitToken) rec.gitToken = localStorage.getItem('fh:ai:gitToken') || '';
          if (!rec.sites) rec.sites = localStorage.getItem('fh:sites') || '';
          rec.at = Date.now();
          a.cur = uk;
          acctSaveStore(a);
          acctApply(rec);
          resolve({ ok: true, rec: rec });
        });
      } else {
        var salt;
        try { salt = cfgB64(cfgBytes(16)); } catch (e) { salt = 's' + Date.now(); }
        acctHash(u, p, salt).then(function (h) {
          var nr = acctAdopt();
          nr.user = u; nr.salt = salt; nr.pinHash = h; nr.at = Date.now();
          a.users[uk] = nr;
          a.cur = uk;
          acctSaveStore(a);
          acctApply(nr);
          resolve({ ok: true, rec: nr, created: true });
        });
      }
    });
  }

  function acctOut() {
    var a = acctStore();
    a.cur = '';
    a.at = Date.now();
    acctSaveStore(a);
    try {
      localStorage.removeItem('fh:ai:key');
      localStorage.removeItem('fh:ai:gitToken');
      localStorage.removeItem('fh:sites');
    } catch (e) {}
    acctEmitOff();
    fhToast('👤 已退出登录（账号数据仍保存在本机）');
  }

  function acctSetField(field, val) {
    var a = acctStore();
    if (!a.cur || !a.users[a.cur]) return false;
    a.users[a.cur][field] = val;
    a.at = Date.now();
    acctSaveStore(a);
    return true;
  }

  function acctMask(s) {
    s = String(s || '');
    return s.length > 12 ? s.slice(0, 7) + '••••' + s.slice(-4) : '••••';
  }

  function acctOpen(afterLogin) {
    var cur = acctCur();
    var d = cfgDialog(cur ? '👤 账号 · ' + cur.user : '👤 登录 / 注册（用户名 + PIN）');
    if (cur) {
      var info = document.createElement('div');
      info.style.cssText = 'font-size:11.5px;color:#9a9aa8;line-height:1.8;word-break:break-all';
      function line(t) { var x = document.createElement('div'); x.textContent = t; info.append(x); }
      line('当前账号：' + cur.user);
      line('AI Key：' + (cur.key ? '已保存（' + acctMask(cur.key) + '）' : '未保存'));
      line('GitLab Token：' + (cur.gitToken ? '已保存' : '未保存（上传 / 聊天室不可用）'));
      var sp = cfgPinGet();
      line('配置恢复 PIN：' + (sp ? sp + '（已存本机，换设备时用）' : '未生成（首次上传配置时自动生成）'));
      line('登录状态保存在本机，刷新或重开都不用再输；直到这里点“退出登录”。');
      d.body.append(info);
      if (sp) {
        var cpRow = document.createElement('div');
        cpRow.style.cssText = 'display:flex;gap:6px;margin-top:6px';
        var cpPin = cfgBtn('复制恢复 PIN');
        cpPin.onclick = function () {
          if (cfgCopy(sp)) fhToast('📋 PIN 已复制');
          else fhToast('复制失败，请手动选中上面的 PIN');
        };
        cpRow.append(cpPin);
        d.body.append(cpRow);
      }
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;margin-top:6px';
      var out = cfgBtn('退出登录', '#7a2b2b');
      var cls = cfgBtn('关闭');
      row.append(out, cls);
      d.body.append(row);
      out.onclick = function () { acctOut(); d.close(); };
      cls.onclick = d.close;
      return;
    }
    var uIn = cfgField(d.body, '用户名（2-20 位，不含空格）');
    var pIn = cfgField(d.body, 'PIN（4-30 位，不含空格）', { type: 'password' });
    var tip = document.createElement('div');
    tip.style.cssText = 'font-size:11px;color:#7f7f8c;line-height:1.6';
    tip.textContent = '第一次输入的用户名会自动注册。登录后 AI Key / 上传 Token / 网页配置都跟着账号保存。每 5 秒只能提交一次。';
    d.body.append(tip);
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;margin-top:4px';
    var ok = cfgBtn('登录 / 注册', '#3a6df0');
    var cancel = cfgBtn('取消');
    row.append(ok, cancel);
    d.body.append(row);
    cancel.onclick = d.close;
    ok.onclick = function () {
      ok.disabled = true;
      d.stat.textContent = '登录中…';
      acctLogin(uIn.value, pIn.value).then(function (r) {
        if (!r.ok) {
          d.stat.textContent = r.wait ? '每 5 秒只能提交一次' : (r.msg || '登录失败');
          if (r.wait) {
            var left = r.wait;
            ok.textContent = '请等 ' + left + 's';
            var t = setInterval(function () {
              left--;
              if (left <= 0) { clearInterval(t); ok.disabled = false; ok.textContent = '登录 / 注册'; }
              else ok.textContent = '请等 ' + left + 's';
            }, 1000);
          } else ok.disabled = false;
          return;
        }
        fhToast((r.created ? '👤 已注册并登录：' : '👤 已登录：') + r.rec.user);
        d.close();
        if (typeof afterLogin === 'function') { try { afterLogin(r.rec); } catch (e) {} }
      });
    };
    setTimeout(function () { try { uIn.focus(); } catch (e) {} }, 60);
  }

  // 供 mods 读取/写入当前账号
  window.__fhAcct = {
    cur: acctCur,
    userKey: acctUserKey,
    login: acctLogin,
    logout: acctOut,
    open: acctOpen,
    saveKey: function (v) { return acctSetField('key', v); },
    saveGit: function (v) { return acctSetField('gitToken', v); },
    saveSites: function (v) { return acctSetField('sites', v); },
    token: function () { var r = acctCur(); return r ? String(r.gitToken || '') : ''; }
  };

  // v3.12：供 mods 主动把配置推到云端（多 AI 配置存云端后自动同步）
  // 云端文件就是「⬆ 上传配置」那份加密快照，cfgCollect 会自动带上 fh:ai:profiles
  window.__fhCfg = {
    ready: function () {
      return !!(cfgReady() && cfgTokenLocal() && cfgPinGet());
    },
    can: function () { return !!(cfgReady() && cfgTokenLocal()); },
    pin: function () { return cfgPinGet(); },
    push: function (cb) {
      var done = typeof cb === 'function' ? cb : function () {};
      if (!cfgReady()) { done({ ok: false, msg: '浏览器不支持加密（需要 https/localhost）' }); return; }
      var tok = cfgTokenLocal();
      if (!tok) { done({ ok: false, msg: '未配置 GitLab Token，无法上传云端' }); return; }
      var pin = cfgPinGet();
      if (!pin) { pin = cfgPinNew(); cfgPinSet(pin); }
      cfgUpload(pin, !cfgLs(CFG_ID_KEY), tok, function () {}).then(function (r) {
        done(r && r.ok ? { ok: true, id: r.id, n: r.n } : {
          ok: false, status: r && r.status, msg: (r && r.text) || ('HTTP ' + (r && r.status))
        });
      }).catch(function (e) {
        done({ ok: false, msg: String(e && e.message ? e.message : e) });
      });
    }
  };

  // v3.8：聊天室拆成独立模块 mods/room.js，不再借 AI 网页的窗口
  function openChatRoom(btn) {
    if (window.__fhRoom) { try { window.__fhRoom(); return; } catch (e) {} }
    loadMod('mods/room.js', btn, function () {
      if (window.__fhRoom) { try { window.__fhRoom(); } catch (e) {} }
    });
  }

  var GROUPS = {
    '学习': [
      ['✏️ 改名', 'mods/rename.js'],
      ['💰 积分', 'mods/score.js'],
      ['🐾 灵宠', 'mods/pets.js'],
      ['🖼 宠物图', 'mods/petimg.js'],
      ['➕ 加宠物', 'mods/petmax.js'],
      ['🔓 解锁4只', 'mods/unlock.js']
    ],
    '工具': [
      ['🌐 网页', 'mods/embed.js'],
      ['📷 相机', 'mods/media.js'],
      ['🧭 探测', 'mods/probe.js'],
      ['📂 文件', 'mods/browser.js'],
      ['📖 小说', 'mods/novel.js'],
      ['🎵 音乐', 'mods/music.js'],
      ['🖼 图片', 'mods/img.js'],
      ['🧩 转印', 'mods/tile.js'],
      ['📦 存档', 'mods/dump.js'],
      ['🔒 遮罩', 'mods/peek.js'],
      ['📝 名单', 'mods/edit.js'],
      ['🧹 清答案', 'mods/clean.js'],
      ['👤 账号（用户名 + PIN）', acctOpen],
      ['⬆ 上传配置', uploadConfig],
      ['⬇ 更新配置', pullConfig],
      ['🔄 版本更新', 'mods/update.js'],
      ['⏱ 解除限时', toggleLockFree],
      ['💣 清空', 'mods/reset.js']
    ],
    'chat': [
      ['💬 聊天室（共享）', openChatRoom],
      ['🤖 AI 网页 · v3.13.1', 'mods/ai.js']
    ],
    '白板': [
      ['🖌 白板（开发中）', function () { fhToast('🖌 白板功能开发中…'); }]
    ],
    '便签': []
  };

  // ── 样式：只注入一次，以后改外观只改这里 ──
  if (!document.getElementById('__fhcss')) {
    var stEl = document.createElement('style');
    stEl.id = '__fhcss';
    stEl.textContent = [
      '#__fh{position:fixed;right:14px;bottom:14px;z-index:2147483647;display:flex;',
      'font:13px/1.45 -apple-system,"PingFang SC",sans-serif;color:var(--fh-fg);',
      'user-select:none;-webkit-user-select:none;',
      '--fh-fg:#e8e8f0;--fh-title:#898998;--fh-muted:#8a8a99;--fh-dim:#6b6b78;',
      '--fh-panel1:rgba(32,32,39,.97);--fh-panel2:rgba(20,20,26,.98);',
      '--fh-border:rgba(255,255,255,.1);--fh-soft:rgba(255,255,255,.05);',
      '--fh-soft2:rgba(255,255,255,.08);--fh-text:#dcdce6;--fh-btn:#a6a6b4;',
      '--fh-ta:rgba(0,0,0,.34);--fh-scroll:rgba(255,255,255,.15);',
      '--fh-shadow:0 18px 48px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.07)}',
      '#__fh.fh-light{--fh-fg:#1c1c22;--fh-title:#555562;--fh-muted:#5f5f6e;--fh-dim:#73737f;',
      '--fh-panel1:rgba(255,255,255,.98);--fh-panel2:rgba(243,243,248,.99);',
      '--fh-border:rgba(0,0,0,.12);--fh-soft:rgba(0,0,0,.045);--fh-soft2:rgba(0,0,0,.08);',
      '--fh-text:#2a2a32;--fh-btn:#4c4c5a;--fh-ta:rgba(255,255,255,.72);',
      '--fh-scroll:rgba(0,0,0,.18);',
      '--fh-shadow:0 18px 48px rgba(20,20,40,.22),inset 0 1px 0 rgba(255,255,255,.8)}',
      '#__fh .fh-panel{position:relative;display:flex;flex-direction:column;width:min(318px,88vw);',
      'height:min(400px,86vh);max-height:86vh;',
      'background:transparent;',
      'border:1px solid var(--fh-border);border-radius:16px;overflow:hidden;',
      'box-shadow:var(--fh-shadow)}',
      '#__fh .fh-bg{position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit;',
      'background:linear-gradient(180deg,var(--fh-panel1),var(--fh-panel2));',
      'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}',
      '#__fh .fh-head{position:relative;z-index:1;display:flex;align-items:center;gap:7px;padding:9px 10px 8px;',
      'cursor:move;touch-action:none;flex-shrink:0}',
      '#__fh .fh-title{flex:1;min-width:0;font:700 11px/1.2 inherit;color:var(--fh-title);',
      'letter-spacing:.9px;text-transform:uppercase;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}',
      '#__fh .fh-ico{width:28px;height:26px;flex-shrink:0;border:0;border-radius:8px;',
      'background:transparent;color:var(--fh-title);font:14px/1 inherit;cursor:pointer;',
      'padding:0;display:grid;place-items:center}',
      '#__fh .fh-ico:active{background:var(--fh-soft2);color:var(--fh-fg)}',
      '#__fh .fh-tabs{position:relative;z-index:1;display:flex;gap:4px;padding:0 10px 9px;flex-shrink:0}',
      '#__fh .fh-tab{flex:1;height:30px;border:0;border-radius:9px;',
      'background:var(--fh-soft);color:var(--fh-muted);font:12px/1 inherit;cursor:pointer}',
      '#__fh .fh-tab.on{background:linear-gradient(180deg,#4d7ef8,#3a62d6);color:#fff;',
      'font-weight:600;box-shadow:0 3px 10px rgba(58,98,214,.42)}',
      '#__fh .fh-content{position:relative;z-index:1;flex:1;min-height:0;overflow:auto;padding:0 10px 10px;',
      'overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',
      '#__fh .fh-content::-webkit-scrollbar{width:6px}',
      '#__fh .fh-content::-webkit-scrollbar-thumb{background:var(--fh-scroll);border-radius:9px}',
      '#__fh .fh-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
      '#__fh .fh-mod{padding:10px 9px;border:1px solid var(--fh-soft2);border-radius:10px;',
      'background:var(--fh-soft);color:var(--fh-text);cursor:pointer;font:12.5px/1.2 inherit;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}',
      '#__fh .fh-mod:active{background:var(--fh-soft2);transform:scale(.97)}',
      '#__fh .fh-mod[disabled]{opacity:.5;cursor:progress;transform:none}',
      '#__fh .fh-ta{width:100%;min-height:210px;max-height:none;padding:10px;',
      'border:1px solid var(--fh-border);border-radius:11px;background:var(--fh-ta);',
      'color:var(--fh-text);font:12px/1.7 inherit;outline:none;resize:vertical}',
      '#__fh .fh-ta:focus{border-color:rgba(77,126,248,.7);box-shadow:0 0 0 3px rgba(77,126,248,.15)}',
      '#__fh .fh-bar{display:flex;gap:6px;align-items:center;margin-top:6px}',
      '#__fh .fh-stat{flex:1;min-width:0;font-size:11px;color:var(--fh-dim);overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}',
      '#__fh .fh-btn{height:30px;padding:0 11px;border:1px solid var(--fh-border);',
      'border-radius:8px;background:var(--fh-soft);color:var(--fh-btn);',
      'font:12px/1 inherit;cursor:pointer}',
      '#__fh .fh-btn:active{background:var(--fh-soft2);color:var(--fh-fg)}',
      '#__fh .fh-op-pop{display:none;position:absolute;right:8px;top:42px;z-index:40;padding:9px 11px;',
      'border:1px solid var(--fh-border);border-radius:10px;background:var(--fh-panel1);color:var(--fh-text);',
      'font:12px/1.3 inherit;box-shadow:0 8px 24px rgba(0,0,0,.38)}',
      '#__fh .fh-op-pop label{display:block;margin-bottom:6px;white-space:nowrap;color:var(--fh-muted)}',
      '#__fh .fh-op-pop input{width:132px;accent-color:#5b8dfa}',
      '#__fh .fh-cat{width:24px;height:24px;flex-shrink:0;border:0;border-radius:50%;',
      'background:transparent;font:15px/1 inherit;cursor:pointer;padding:0;',
      'display:grid;place-items:center}',
      '#__fh.is-mini .fh-panel{width:88px;border-radius:999px;border-color:var(--fh-border);',
      'height:auto;max-height:none;',
      'box-shadow:0 10px 26px rgba(0,0,0,.5)}',
      '#__fh.is-mini .fh-head{padding:5px 6px;gap:2px;justify-content:center;cursor:move}',
      '#__fh.is-mini .fh-title,#__fh.is-mini .fh-tabs,#__fh.is-mini .fh-content,#__fh.is-mini .fh-min{display:none}',
      // 迷你态只留猫头 + 关闭：之前 4 个图标挤在 88px 里把猫头裁掉，导致点不到还原入口
      '#__fh.is-mini .fh-acct,#__fh.is-mini .fh-theme,#__fh.is-mini .fh-mainop{display:none}',
      '#__fh.is-mini .fh-panel{cursor:pointer}',
      '#__fh.is-mini .fh-close{position:absolute;right:2px;top:50%;transform:translateY(-50%)}',
      '#__fh.is-mini .fh-head{position:relative;padding-right:24px}',
      '#__fh.is-mini .fh-ico{width:26px;height:26px;font:13px/1 inherit;border-radius:50%}',
      '#__fh.is-mini .fh-cat{width:32px;height:32px;font-size:20px}'
    ].join('');
    (document.head || document.documentElement).appendChild(stEl);
  }

  var root = document.createElement('div');
  root.id = '__fh';

  var panel = document.createElement('div');
  panel.className = 'fh-panel';
  var panelBg = document.createElement('div');
  panelBg.className = 'fh-bg';
  panel.append(panelBg);

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
  var themeBtn = icon('🌓', '深色 / 浅色');
  themeBtn.classList.add('fh-theme');
  var acctBtn = icon('👤', '账号（用户名 + PIN）');
  acctBtn.classList.add('fh-acct');
  acctBtn.onclick = function () { acctOpen(); };
  function acctBtnState() {
    var r = acctCur();
    acctBtn.title = r ? ('账号：' + r.user + (r.gitToken ? '（Token 已保存）' : '（还没保存 Token）')) : '登录 / 注册（用户名 + PIN）';
    acctBtn.style.color = r ? '#6f9bff' : '';
  }
  acctBtnState();
  try { window.addEventListener('fh:acct', acctBtnState); } catch (e) {}
  var mainOpBtn = icon('◐', '主面板透明度');
  mainOpBtn.classList.add('fh-mainop');
  var light = false;
  try { light = localStorage.getItem('fh:theme') === 'light'; } catch (e) {}
  if (light) root.classList.add('fh-light');
  themeBtn.onclick = function () {
    light = !light;
    root.classList.toggle('fh-light', light);
    try { localStorage.setItem('fh:theme', light ? 'light' : 'dark'); } catch (e) {}
  };
  var closeBtn = icon('✕', '关闭');
  closeBtn.className = 'fh-ico fh-close';
  closeBtn.onclick = function () { root.remove(); };
  head.append(cat, title, acctBtn, themeBtn, mainOpBtn, minBtn, closeBtn);

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
    if (GROUPS[name].length === 1) grid.style.gridTemplateColumns = '1fr';
    GROUPS[name].forEach(function (m) {
      var b = document.createElement('button');
      b.className = 'fh-mod';
      b.textContent = (m[1] === toggleLockFree && lockFreeOn()) ? '🔓 限时已解除' : m[0];
      b.onclick = function () {
        if (typeof m[1] === 'function') { m[1](b); return; }
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
    dragDot.style.cssText = 'width:48px;height:4px;border-radius:3px;background:var(--fh-scroll)';
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

  // 主面板透明度：只淡背景/标签/内容，标题栏始终可操作，最低 5%
  // v3.9：默认 10%，注入后几乎隐形；标题栏仍保留，方便找回和调回
  var mainOpVal = 10;
  try { mainOpVal = parseInt(localStorage.getItem('fh:mainOp') || '10', 10); } catch (e) {}
  if (isNaN(mainOpVal)) mainOpVal = 10;
  mainOpVal = Math.max(5, Math.min(100, mainOpVal));

  var mainOpPop = document.createElement('div');
  mainOpPop.className = 'fh-op-pop';
  var mainOpLab = document.createElement('label');
  var mainOpRange = document.createElement('input');
  mainOpRange.type = 'range';
  mainOpRange.min = '5';
  mainOpRange.max = '100';
  mainOpRange.step = '5';
  mainOpPop.append(mainOpLab, mainOpRange);

  function applyMainOp() {
    var v = String(mainOpVal / 100);
    panelBg.style.opacity = v;
    tabs.style.opacity = v;
    content.style.opacity = v;
    mainOpLab.textContent = '透明度 ' + mainOpVal + '%';
    mainOpRange.value = String(mainOpVal);
    try { localStorage.setItem('fh:mainOp', String(mainOpVal)); } catch (e) {}
  }
  mainOpRange.oninput = function () {
    mainOpVal = parseInt(mainOpRange.value, 10);
    applyMainOp();
  };
  mainOpBtn.onclick = function (e) {
    e.stopPropagation();
    mainOpPop.style.display = mainOpPop.style.display === 'block' ? 'none' : 'block';
  };
  applyMainOp();

  // 缩放手柄（右下角，仅主面板）
  panel.style.position = 'relative';
  var pGrip = document.createElement('div');
  pGrip.style.cssText = 'position:absolute;z-index:2;right:3px;bottom:3px;width:18px;height:18px;cursor:se-resize;' +
    'touch-action:none;opacity:.55;background:linear-gradient(135deg,transparent 44%,var(--fh-scroll) 44%,' +
    'var(--fh-scroll) 52%,transparent 52%,transparent 64%,var(--fh-scroll) 64%,var(--fh-scroll) 72%,transparent 72%)';
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
  panel.append(head, tabs, content, mainOpPop);
  root.append(panel);
  document.body.append(root);
  window.__fhAt = Date.now();
  show('学习');
  setTimeout(cfgStartupProbe, 1500);

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
  minBtn.onclick = function (e) {
    // 阻止冒泡：否则点「−」收起后，head 的点击处理会把它当成「点胶囊展开」再切回去
    if (e && e.stopPropagation) e.stopPropagation();
    mini = !mini;
    if (mini) mainOpPop.style.display = 'none';
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
      panel.title = '点击展开 fuulea_hack';
    } else {
      panel.style.width = savedW;
      panel.style.height = savedH;
      panel.style.maxHeight = savedMax;
      pGrip.style.display = 'block';
      panel.title = '';
      if (savedPos) {
        root.style.left = savedPos.left; root.style.top = savedPos.top;
        root.style.right = savedPos.right; root.style.bottom = savedPos.bottom;
      }
    }
  };

  // 小窗态下点猫头 / 空白处展开（关闭按钮除外）
  head.addEventListener('click', function (e) {
    if (dragMoved) { dragMoved = false; return; }
    if (mini && e.target !== closeBtn) {
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
    var zTop = 2147483600;

    function findBar(el, xb) {
      // 从关闭按钮往上找标题栏，兼容「卡片套一层全屏壳」的窗口
      var n = xb ? xb.parentElement : null;
      while (n && n !== el) {
        if (n.tagName === 'DIV') {
          var r = n.getBoundingClientRect();
          if (r.height >= 22 && r.height <= 90 && r.width >= 80) return n;
        }
        n = n.parentElement;
      }
      var all = el.querySelectorAll('div');
      for (var i = 0; i < all.length; i++) {
        var d = all[i];
        var rr = d.getBoundingClientRect();
        if (rr.height >= 22 && rr.height <= 90 && rr.width >= 80 && d.querySelector('button')) return d;
      }
      return null;
    }
    function findClose(el) {
      var bs = el.querySelectorAll('button');
      var best = null, bestTop = Infinity;
      for (var i = 0; i < bs.length; i++) {
        var b = bs[i];
        var t = (b.textContent || '').trim();
        var lab = (b.getAttribute('aria-label') || '') + ' ' + (b.title || '');
        if (!/^[\u2715\u00d7X\u2716\u2a2f\u2573]$/.test(t) && !/close|关闭/i.test(t + ' ' + lab)) continue;
        var r = b.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.top < bestTop) { best = b; bestTop = r.top; }
      }
      return best;
    }

    function shell(el) {
      if (seen.has(el) || el.dataset.fhWin) return;
      var xb = findClose(el);
      var bar = xb ? findBar(el, xb) : null;
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

      // 置顶 / 透明度 / 小窗按钮插进标题栏，位于 ✕ 左侧，绝不遮挡
      var pinned = false;
      var pinBtn = document.createElement('button');
      pinBtn.textContent = '📌';
      pinBtn.title = '置于顶层';
      pinBtn.style.cssText = 'min-width:34px;height:34px;display:grid;place-items:center;padding:0;border:0;' +
        'border-radius:9px;background:transparent;color:#8a8a99;font:14px/1 inherit;cursor:pointer;flex-shrink:0';
      xb.parentNode.insertBefore(pinBtn, xb);
      pinBtn.onclick = function (e) {
        e.stopPropagation();
        pinned = !pinned;
        el.dataset.fhPin = pinned ? '1' : '';
        el.style.zIndex = pinned ? '2147483647' : '2147483645';
        pinBtn.style.color = pinned ? '#5b8dfa' : '#8a8a99';
      };

      var opBtn = document.createElement('button');
      opBtn.textContent = '◐';
      opBtn.title = '透明度';
      opBtn.style.cssText = 'min-width:34px;height:34px;display:grid;place-items:center;padding:0;border:0;' +
        'border-radius:9px;background:transparent;color:#8a8a99;font:16px/1 inherit;cursor:pointer;flex-shrink:0';
      xb.parentNode.insertBefore(opBtn, xb);

      // AI 网页自己有 ⛶ 全屏按钮（需求 3）：不重复注入，只保留置顶 / 透明度 / 拖动 / 缩放
      var mb = null;
      if (el.id !== '__ai') {
        mb = document.createElement('button');
        mb.textContent = '\u25f1';
        mb.title = '小窗 / 全屏';
        mb.style.cssText = 'min-width:34px;height:34px;display:grid;place-items:center;padding:0;border:0;' +
          'border-radius:9px;background:transparent;color:#8a8a99;font:15px/1 inherit;cursor:pointer;flex-shrink:0';
        xb.parentNode.insertBefore(mb, xb);
      }

      // 右下角缩放手柄
      var grip = document.createElement('div');
      grip.className = 'fh-grip';
      grip.style.cssText = 'display:none;position:absolute;right:2px;bottom:2px;width:20px;height:20px;z-index:9;' +
        'cursor:se-resize;touch-action:none;border-radius:0 0 14px 0;' +
        'background:linear-gradient(135deg,transparent 45%,rgba(255,255,255,.32) 45%,rgba(255,255,255,.32) 55%,transparent 55%,' +
        'transparent 67%,rgba(255,255,255,.32) 67%,rgba(255,255,255,.32) 77%,transparent 77%)';
      el.appendChild(grip);

      // 透明度面板（只调内容，标题栏保持不透明，低透明度时仍能操作）
      var opVal = 100;
      try {
        var opKey = el.id ? ('fh:op:' + el.id) : '';
        opVal = parseInt(el.dataset.fhOp || (opKey && localStorage.getItem(opKey)) || '100', 10);
      } catch (e) {}
      if (isNaN(opVal)) opVal = 100;
      opVal = Math.max(5, Math.min(100, opVal));
      var opPop = document.createElement('div');
      opPop.style.cssText = 'display:none;position:absolute;right:8px;top:46px;z-index:30;' +
        'padding:9px 11px;border:1px solid #3a3a42;border-radius:10px;background:#1c1c22;' +
        'color:#bbb;font:12px/1.3 inherit;box-shadow:0 8px 24px rgba(0,0,0,.45)';
      var opLab = document.createElement('div');
      opLab.style.cssText = 'margin-bottom:6px;white-space:nowrap';
      var opRange = document.createElement('input');
      opRange.type = 'range';
      opRange.min = '5';
      opRange.max = '100';
      opRange.step = '5';
      opRange.style.cssText = 'width:132px;accent-color:#5b8dfa';
      opPop.append(opLab, opRange);
      el.append(opPop);

      function applyOp() {
        var v = String(opVal / 100);
        // 只淡化「不包含标题栏」的分支；沿标题栏向上，把它每一层的兄弟节点淡化，
        // 这样卡片套全屏壳的窗口也能保持标题栏不透明。
        [].forEach.call(el.children, function (c) {
          if (c !== opPop && !c.contains(bar)) c.style.opacity = v;
        });
        var n = bar;
        while (n && n !== el) {
          var p = n.parentElement;
          if (!p) break;
          [].forEach.call(p.children, function (c) {
            if (c !== n && c !== opPop) c.style.opacity = v;
          });
          n = p;
        }
        opLab.textContent = '透明度 ' + opVal + '%';
        opRange.value = String(opVal);
        el.dataset.fhOp = String(opVal);
        try {
          if (el.id) localStorage.setItem('fh:op:' + el.id, String(opVal));
        } catch (e) {}
      }
      opRange.oninput = function () {
        opVal = parseInt(opRange.value, 10);
        applyOp();
      };
      opBtn.onclick = function (e) {
        e.stopPropagation();
        opPop.style.display = opPop.style.display === 'block' ? 'none' : 'block';
      };
      applyOp();

      // 点击窗口任意位置时抬到最前；📌 锁定的窗口保持最高层
      el.addEventListener('pointerdown', function () {
        if (!pinned) el.style.zIndex = String(Math.min(++zTop, 2147483646));
      }, true);

      // v3.9：AI 窗口默认就是浮动窗；位置/大小按窗口 id 记住，全屏只是临时收起
      var isAI = el.id === '__ai';
      var rectKey = isAI ? 'fh:ai:rect' : '';

      function clampRect(r) {
        var maxW = Math.max(240, innerWidth - 12);
        var maxH = Math.max(200, innerHeight - 12);
        var minW = Math.min(isAI ? 320 : 280, maxW);
        var minH = Math.min(isAI ? 360 : 200, maxH);
        var w = Math.max(minW, Math.min(Number(r.w) || minW, maxW));
        var h = Math.max(minH, Math.min(Number(r.h) || minH, maxH));
        var l = Math.max(6, Math.min(Number(r.l) || 0, innerWidth - w - 6));
        var t = Math.max(6, Math.min(Number(r.t) || 0, innerHeight - h - 6));
        // 手机竖屏不留下左右缝，直接铺满可用宽度
        if (innerWidth < 560) { l = 6; w = maxW; }
        if (innerHeight < 480) { t = 6; h = maxH; }
        return { l: Math.round(l), t: Math.round(t), w: Math.round(w), h: Math.round(h) };
      }
      function savedRect() {
        if (!rectKey) return null;
        try {
          var j = JSON.parse(localStorage.getItem(rectKey) || 'null');
          if (j && isFinite(j.l) && isFinite(j.t) && isFinite(j.w) && isFinite(j.h)) return j;
        } catch (e) {}
        return null;
      }
      function saveRect() {
        if (!rectKey || el.dataset.fhFloat !== '1') return;
        var r = el.getBoundingClientRect();
        try {
          localStorage.setItem(rectKey, JSON.stringify({
            l: Math.round(r.left), t: Math.round(r.top),
            w: Math.round(r.width), h: Math.round(r.height)
          }));
        } catch (e) {}
      }

      function toFloat() {
        var dw = isAI ? Math.min(Math.round(innerWidth * 0.92), 860)
                      : Math.min(Math.round(innerWidth * 0.9), 760);
        var dh = isAI ? Math.min(Math.round(innerHeight * 0.86), 820)
                      : Math.round(innerHeight * 0.78);
        var r = clampRect(el.__fhRect || savedRect() || {
          l: Math.round((innerWidth - dw) / 2),
          t: Math.round((innerHeight - dh) / 2),
          w: dw, h: dh
        });
        el.dataset.fhFloat = '1';
        el.style.inset = 'auto';
        el.style.transform = 'none';
        el.style.left = r.l + 'px';
        el.style.top = r.t + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        el.style.width = r.w + 'px';
        el.style.height = r.h + 'px';
        el.style.maxHeight = 'none';
        el.style.borderRadius = isAI ? '16px' : '14px';
        el.style.boxShadow = isAI ? 'none' : '0 20px 60px rgba(0,0,0,.6)';
        el.style.overflow = 'hidden';
        grip.style.display = 'block';
        if (mb) mb.style.color = '#5b8dfa';
      }
      function toFull() {
        if (el.dataset.fhFloat === '1') {
          var r = el.getBoundingClientRect();
          el.__fhRect = { l: r.left, t: r.top, w: r.width, h: r.height };
          saveRect();
        }
        el.dataset.fhFloat = '0';
        el.style.inset = '0';
        el.style.left = '';
        el.style.top = '';
        el.style.right = '';
        el.style.bottom = '';
        el.style.transform = '';
        el.style.width = '';
        el.style.height = '';
        el.style.maxHeight = '';
        el.style.borderRadius = '';
        el.style.boxShadow = '';
        el.style.overflow = '';
        grip.style.display = 'none';
        if (mb) mb.style.color = '#8a8a99';
      }
      el.__fhToFloat = toFloat;
      el.__fhToFull = toFull;
      if (mb) mb.onclick = function (e) {
        e.stopPropagation();
        if (el.dataset.fhFloat === '1') toFull(); else toFloat();
      };

      // AI 打开即浮动，不再先铺满全屏再等用户拖一下
      if (isAI) toFloat();

      // 视口变化时把窗口收回屏幕内，并记住最终位置
      // 防抖：Chrome 从模拟视口切回真实窗口时会短暂经过一个很小的中间尺寸，
      // 立刻 clamp 会把 AI 压成 320×360 并写进 localStorage。
      if (isAI) var aiRzTimer = 0;
      if (isAI) window.addEventListener('resize', function () {
        if (!el.isConnected || el.dataset.fhFloat !== '1') return;
        clearTimeout(aiRzTimer);
        aiRzTimer = setTimeout(function () {
          if (!el.isConnected || el.dataset.fhFloat !== '1') return;
          // 最小化/切后台时浏览器会给出 0 尺寸，别把窗口压成最小尺寸并写回
          if (innerWidth < 240 || innerHeight < 240) return;
          var br = el.getBoundingClientRect();
          if (br.width < 100 || br.height < 100) return;
          var r = clampRect({ l: br.left, t: br.top, w: br.width, h: br.height });
          el.style.left = r.l + 'px';
          el.style.top = r.t + 'px';
          el.style.width = r.w + 'px';
          el.style.height = r.h + 'px';
          saveRect();
        }, 160);
      });

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
      bar.addEventListener('pointerup', function () { if (ds) saveRect(); ds = null; });
      bar.addEventListener('pointercancel', function () { if (ds) saveRect(); ds = null; });

      // 缩放
      var rs = null;
      grip.addEventListener('pointerdown', function (e) {
        e.stopPropagation(); e.preventDefault();
        var r = el.getBoundingClientRect();
        rs = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, l: r.left, t: r.top };
        try { grip.setPointerCapture(e.pointerId); } catch (err) {}
      });
      grip.addEventListener('pointermove', function (e) {
        if (!rs) return;
        var maxW = Math.max(240, innerWidth - rs.l - 6);
        var maxH = Math.max(200, innerHeight - rs.t - 6);
        el.style.maxHeight = 'none';
        el.style.width = Math.max(280, Math.min(rs.w + e.clientX - rs.x, maxW)) + 'px';
        el.style.height = Math.max(200, Math.min(rs.h + e.clientY - rs.y, maxH)) + 'px';
      });
      grip.addEventListener('pointerup', function () { if (rs) saveRect(); rs = null; });
      grip.addEventListener('pointercancel', function () { if (rs) saveRect(); rs = null; });
    }

    function scan(n) {
      if (!n || n.nodeType !== 1) return;
      if (n.dataset && n.dataset.fhSkip === '1') return;
      if (n.tagName === 'DIV' && n.id !== '__fh' && n.parentElement === document.body) {
        var cs = getComputedStyle(n);
        var full = cs.position === 'fixed' &&
          parseFloat(cs.top) === 0 && parseFloat(cs.left) === 0 &&
          parseFloat(cs.right) === 0 && parseFloat(cs.bottom) === 0;
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
