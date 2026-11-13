/* AI 网页 v3.1 — 直连/中转（Chat Completions 与 Responses），多会话，Key 本机保存 */
(function () {
  'use strict';

  // 已开着一个就聚焦，不重复叠窗口
  var OLD = document.getElementById('__ai');
  if (OLD) {
    var oi = OLD.querySelector('textarea');
    if (oi) { try { oi.focus(); } catch (e) {} }
    return;
  }

  var K_KEY = 'fh:ai:key';
  var K_BASE = 'fh:ai:base';
  var K_DEPTH = 'fh:ai:depth';
  var K_THEME = 'fh:ai:theme';
  var K_HIST = 'fh:ai:hist';            // 旧版单会话记录，仅用于迁移
  var K_GIT = 'fh:ai:gitToken';
  var K_AUTO = 'fh:ai:gitAuto';
  var K_MODEL = 'fh:ai:model';
  var K_MODELS = 'fh:ai:models';
  var K_PROFILES = 'fh:ai:profiles';    // v3.12：多份 API 配置
  var K_PROFILE = 'fh:ai:profileId';
  var K_MODE = 'fh:ai:mode';
  var K_SESS = 'fh:ai:sessions';
  var K_SID = 'fh:ai:sid';
  var K_HIST_P = 'fh:ai:hist:';
  var K_USE = 'fh:ai:usage:';           // 每个会话的累计 token 用量
  var K_NICK = 'fh:ai:nick';
  var K_ROOM_AT = 'fh:ai:roomAt';
  var K_ROOM_MODE = 'fh:ai:roomMode';
  var K_ROOM_RECT = 'fh:ai:roomRect';
  var GIT_HOST = 'https://gitlab.com';
  var GIT_PROJ = 'yq-group2/fuulea_ai_repository';
  var GIT_BRANCH = 'main';
  var ROOM_DIR = 'message';
  var MEDIA_DIR = 'media';
  var ROOM_POLL = 30000;

  function read(k, d) {
    try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; }
  }
  function save(k, v) {
    try { localStorage.setItem(k, v); } catch (e) {}
  }

  var cfg = {
    key: read(K_KEY, ''),
    base: read(K_BASE, 'https://api.deepseek.com'),
    depth: read(K_DEPTH, 'high'),
    theme: read(K_THEME, 'auto'),
    gitToken: read(K_GIT, ''),
    autoUpload: read(K_AUTO, '1') !== '0',
    model: read(K_MODEL, 'deepseek-flash'),
    mode: read(K_MODE, 'chat'),
    nick: read(K_NICK, '')
  };
  if (!/^https?:\/\//i.test(cfg.base)) cfg.base = 'https://api.deepseek.com';
  if (['off', 'low', 'high', 'max'].indexOf(cfg.depth) < 0) cfg.depth = 'high';
  if (['auto', 'dark', 'light'].indexOf(cfg.theme) < 0) cfg.theme = 'auto';
  if (['chat', 'responses'].indexOf(cfg.mode) < 0) cfg.mode = 'chat';
  cfg.model = String(cfg.model || 'deepseek-flash').trim() || 'deepseek-flash';
  if (!cfg.nick) cfg.nick = '';

  var MODE_NAME = { chat: '对话', responses: 'Responses' };
  var DEPTH_NAME = { off: '关闭', low: '低', high: '高', max: '最大' };

  function cleanHist(a) {
    if (Object.prototype.toString.call(a) !== '[object Array]') return [];
    return a.filter(function (m) {
      return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
    }).slice(-40);
  }
  function titleOf(a) {
    for (var i = 0; i < a.length; i++) {
      if (a[i].role === 'user' && a[i].content) {
        var t = String(a[i].content).replace(/\s+/g, ' ');
        if (t === '[图片]') return '图片对话';
        return t.slice(0, 22) || '新对话';
      }
    }
    return '新对话';
  }
  function readHist(id) {
    try { return cleanHist(JSON.parse(localStorage.getItem(K_HIST_P + id) || '[]')); } catch (e) { return []; }
  }

  // 不同身份：优先用登录账号（用户名 + PIN），其次回退旧 Key / Token 哈希
  function hash8(s) {
    s = String(s);
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function acctRec() {
    try { if (window.__fhAcct && window.__fhAcct.cur) return window.__fhAcct.cur(); } catch (e) {}
    return null;
  }
  function acctUid() {
    var r = acctRec();
    if (!r || !r.user) return '';
    try { return 'u' + (window.__fhAcct.userKey ? window.__fhAcct.userKey(r.user) : hash8(String(r.user).toLowerCase())); } catch (e) { return ''; }
  }
  function computeOwner() {
    var u = acctUid();
    if (u) return u;
    var t = String(cfg.gitToken || '').trim();
    var k = String(cfg.key || '').trim();
    return k ? 'k' + hash8(k) : (t ? 'g' + hash8(t) : 'local');
  }
  var ownerTag = computeOwner();
  function rebindOwner() {
    var n = computeOwner();
    if (n === ownerTag) return;
    if (busy) { try { stop(); } catch (e) {} }
    ownerTag = n;
    // 只有还没身份（local）的旧数据跟着走；已归属其他身份的不动
    sessions.forEach(function (s) {
      if (!s.owner || s.owner === 'local') s.owner = n;
    });
    // 当前会话不属于新身份时，切到新身份的第一个会话（没有就开空白）
    var cur = sessionById(sid);
    if (!cur || cur.owner !== n) {
      var mine = sessions.filter(function (s) { return s.owner === n; });
      sid = mine.length ? mine[0].id : '';
      save(K_SID, sid);
      history = sid ? readHist(sid) : [];
      if (typeof renderHistory === 'function') { renderHistory(); }
      if (typeof setStat === 'function') { setStat(); }
    }
    saveSessions();
    if (typeof renderSessList === 'function') renderSessList();
  }

  var sessions = [];
  try {
    var sessRaw = JSON.parse(localStorage.getItem(K_SESS) || '[]');
    if (Object.prototype.toString.call(sessRaw) === '[object Array]') {
      sessions = sessRaw.filter(function (s) { return s && typeof s.id === 'string'; });
    }
  } catch (e) {}
  var sessDirty = false;
  sessions.forEach(function (s) {
    if (!s.owner) { s.owner = ownerTag; sessDirty = true; }
  });
  if (sessDirty) saveSessions();
  function saveSessions() {
    try { localStorage.setItem(K_SESS, JSON.stringify(sessions)); } catch (e) {}
  }

  var modelList = [];
  try {
    var modelRaw = JSON.parse(localStorage.getItem(K_MODELS) || '[]');
    if (Object.prototype.toString.call(modelRaw) === '[object Array]') {
      modelList = modelRaw.filter(function (m) { return typeof m === 'string' && m; }).slice(0, 300);
    }
  } catch (e) {}

  var sid = read(K_SID, '');
  var mySess = sessions.filter(function (s) { return s.owner === ownerTag; });
  var sidOk = false;
  mySess.forEach(function (s) { if (s.id === sid) sidOk = true; });
  if (!sidOk) sid = mySess.length ? mySess[0].id : '';

  // v3.0 只有一个会话：第一次升级时把它迁成会话记录，旧聊天不丢（只迁给第一个用户）
  if (!sessions.length) {
    var oldHist = [];
    try { oldHist = cleanHist(JSON.parse(localStorage.getItem(K_HIST) || '[]')); } catch (e) {}
    if (oldHist.length) {
      sid = 's' + Date.now();
      sessions = [{ id: sid, title: 'v3.0 对话（已迁移）', at: Date.now(), owner: ownerTag }];
      try { localStorage.setItem(K_HIST_P + sid, JSON.stringify(oldHist)); } catch (e) {}
      saveSessions();
    }
  }

  var history = sid ? readHist(sid) : [];

  // ── 样式 ──
  if (!document.getElementById('__aics')) {
    var st = document.createElement('style');
    st.id = '__aics';
    st.textContent = [
      '#__ai{position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483645;display:flex;align-items:center;justify-content:center;padding:12px;',
      'font:13px/1.55 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:var(--fg);',
      '--bg:#17171d;--card:#1b1b22;--panel:#22222b;--soft:#292931;--line:#35353f;--fg:#e6e6ef;',
      '--muted:#9696a7;--dim:#70707f;--accent:#4d7ef8;--accent2:#3a62d6;--user:#345fc9;',
      '--bot:#24242d;--code:#111116;--danger:#e06060;--ok:#5bd06a;',
      '-webkit-tap-highlight-color:transparent}',
      '#__ai.ai-light{--bg:#fbfbfd;--card:#ffffff;--panel:#f2f2f7;--soft:#ececf3;--line:#d9d9e3;',
      '--fg:#1d1d26;--muted:#626274;--dim:#8a8a99;--accent:#3a6df0;--accent2:#2f57c9;--user:#3a6df0;',
      '--bot:#f1f1f7;--code:#f6f6fa;--danger:#c74444;--ok:#249a3b}',
      '#__ai *{box-sizing:border-box}',
      '#__ai .ai-shade{position:absolute;left:0;top:0;right:0;bottom:0;background:rgba(8,8,12,.58)}',
      '#__ai .ai-card{position:relative;z-index:1;width:min(860px,100%);height:100%;max-height:880px;',
      'display:flex;flex-direction:column;min-width:0;min-height:0;background:transparent;border:1px solid var(--line);',
      'border-radius:16px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.55)}',
      '#__ai .ai-bg{position:absolute;left:0;top:0;right:0;bottom:0;z-index:0;pointer-events:none;',
      'background:linear-gradient(180deg,var(--card),var(--panel))}',
      '#__ai .ai-head{position:relative;z-index:1;display:flex;align-items:center;gap:7px;padding:9px 11px;',
      'min-height:48px;border-bottom:1px solid var(--line);flex-shrink:0}',
      '#__ai .ai-logo{width:28px;height:28px;flex-shrink:0;border-radius:9px;display:grid;place-items:center;',
      'background:linear-gradient(180deg,#4d7ef8,#3a62d6);font-size:16px;box-shadow:0 3px 10px rgba(58,98,214,.35)}',
      '#__ai .ai-title{min-width:0;font-weight:700;font-size:13.5px;white-space:nowrap;overflow:hidden;',
      'text-overflow:ellipsis;letter-spacing:.2px}',
      '#__ai .ai-ver{display:inline-block;margin-left:5px;padding:1px 5px;border-radius:999px;',
      'background:var(--soft);color:var(--muted);font:9px/1.5 ui-monospace,Menlo,monospace;vertical-align:1px}',
      '#__ai .ai-badge{flex-shrink:0;padding:2px 7px;border:1px solid var(--line);border-radius:999px;',
      'color:var(--muted);font:9.5px/1.5 ui-monospace,Menlo,monospace;white-space:nowrap}',
      '#__ai .ai-spacer{flex:1;min-width:2px}',
      '#__ai .ai-dot{width:7px;height:7px;flex-shrink:0;border-radius:50%;background:var(--danger);',
      'position:relative;cursor:pointer;box-shadow:0 0 0 3px rgba(224,96,96,.12)}',
      '#__ai .ai-dot::after{content:"";position:absolute;left:-9px;top:-9px;right:-9px;bottom:-9px}',
      '#__ai .ai-dot.on{background:var(--ok);box-shadow:0 0 0 3px rgba(91,208,106,.12)}',
      '#__ai .ai-ico{width:32px;height:32px;flex-shrink:0;border:0;border-radius:9px;background:transparent;',
      'color:var(--muted);font:14px/1 inherit;cursor:pointer;padding:0;display:grid;place-items:center}',
      '#__ai .ai-ico:active{background:var(--soft);color:var(--fg)}',
      '#__ai .ai-cfg{position:relative;z-index:1;display:none;flex-direction:column;gap:7px;padding:10px 12px;',
      'min-width:0;background:var(--panel);border-bottom:1px solid var(--line);flex-shrink:0}',
      '#__ai .ai-cfg.on{display:flex;max-height:44vh;overflow:auto}',
      '#__ai .ai-in[readonly]{opacity:.9;cursor:default}',
      '#__ai .ai-key-actions{display:flex;gap:4px;flex-shrink:0}',
      '#__ai .ai-check{display:flex;align-items:center;gap:6px;padding-left:62px;color:var(--muted);font-size:11.5px;min-height:20px}',
      '#__ai .ai-check input{accent-color:var(--accent);margin:0}',
      '#__ai[data-fh-float="1"]{padding:0;background:transparent}',
      '#__ai[data-fh-float="1"] .ai-shade{display:none}',
      '#__ai[data-fh-float="1"] .ai-card{width:100%;height:100%;max-height:none}',
      '#__ai.ai-full{padding:0}',
      '#__ai.ai-full .ai-shade{display:none}',
      '#__ai.ai-full .ai-card{width:100%;height:100%;max-height:none;border:0;border-radius:0;box-shadow:none}',
      '#__ai .ai-row{display:flex;align-items:center;gap:6px;min-width:0}',
      '#__ai .ai-row>label{width:56px;flex-shrink:0;color:var(--muted);font-size:11.5px;white-space:nowrap}',
      '#__ai .ai-in{flex:1;min-width:0;height:32px;padding:0 9px;border:1px solid var(--line);border-radius:8px;',
      'background:var(--bg);color:var(--fg);font:12px/1.3 inherit;outline:none}',
      '#__ai .ai-in:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(77,126,248,.14)}',
      '#__ai .ai-sel{flex:1;min-width:0;height:32px;padding:0 7px;border:1px solid var(--line);border-radius:8px;',
      'background:var(--bg);color:var(--fg);font:12px/1.3 inherit;outline:none}',
      '#__ai .ai-mini{height:30px;padding:0 9px;border:1px solid var(--line);border-radius:8px;',
      'background:var(--soft);color:var(--muted);font:11px/1 inherit;cursor:pointer;flex-shrink:0}',
      '#__ai .ai-mini:active{background:var(--line);color:var(--fg)}',
      '#__ai .ai-hint{color:var(--dim);font-size:10.5px;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#__ai .ai-cfgmsg{color:var(--muted);font-size:10.5px;min-height:14px}',
      '#__ai .ai-msgs{position:relative;z-index:1;flex:1;min-width:0;min-height:0;overflow:auto;padding:14px;',
      'display:flex;flex-direction:column;gap:12px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',
      '#__ai .ai-msgs::-webkit-scrollbar{width:6px}',
      '#__ai .ai-msgs::-webkit-scrollbar-thumb{background:var(--line);border-radius:9px}',
      '#__ai .ai-empty{margin:auto;padding:18px 8px;text-align:center;color:var(--muted);width:100%;max-width:420px}',
      '#__ai .ai-empty .b{color:var(--fg);font-weight:700;font-size:15px;margin-bottom:5px}',
      '#__ai .ai-empty .p{font-size:12px;line-height:1.7}',
      '#__ai .ai-chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:14px}',
      '#__ai .ai-chip{padding:7px 10px;border:1px solid var(--line);border-radius:999px;background:var(--soft);',
      'color:var(--muted);font:11.5px/1.2 inherit;cursor:pointer}',
      '#__ai .ai-chip:active{background:var(--line);color:var(--fg)}',
      '#__ai .ai-msg{display:flex;align-items:flex-start;gap:8px;min-width:0}',
      '#__ai .ai-msg.user{flex-direction:row-reverse}',
      '#__ai .ai-ava{width:26px;height:26px;flex-shrink:0;border-radius:8px;display:grid;place-items:center;',
      'background:var(--soft);color:var(--muted);font-size:13px}',
      '#__ai .ai-msg.assistant .ai-ava{background:linear-gradient(180deg,#4d7ef8,#3a62d6);color:#fff}',
      '#__ai .ai-body{min-width:0;max-width:82%}',
      '#__ai .ai-msg.user .ai-body{display:flex;flex-direction:column;align-items:flex-end}',
      '#__ai .ai-meta{display:flex;align-items:center;gap:5px;min-height:16px;margin:0 2px 3px;',
      'color:var(--dim);font-size:9.5px}',
      '#__ai .ai-copy{margin-left:auto;border:0;background:transparent;color:var(--dim);font:9.5px/1 inherit;',
      'cursor:pointer;padding:2px 0}',
      '#__ai .ai-bubble{padding:9px 11px;border-radius:12px;background:var(--bot);color:var(--fg);',
      'white-space:normal;word-break:break-word;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text}',
      '#__ai .ai-msg.user .ai-bubble{white-space:pre-wrap}',
      // v3.6：Markdown / LaTeX 渲染样式
      '#__ai .ai-md p{margin:0 0 6px}',
      '#__ai .ai-md>*:first-child{margin-top:0}',
      '#__ai .ai-md>*:last-child{margin-bottom:0}',
      '#__ai .ai-md h1,#__ai .ai-md h2,#__ai .ai-md h3,#__ai .ai-md h4,#__ai .ai-md h5,#__ai .ai-md h6{',
      'margin:10px 0 5px;line-height:1.35;font-weight:700}',
      '#__ai .ai-md h1{font-size:17px}#__ai .ai-md h2{font-size:15.5px}#__ai .ai-md h3{font-size:14px}',
      '#__ai .ai-md h4,#__ai .ai-md h5,#__ai .ai-md h6{font-size:13px;color:var(--muted)}',
      '#__ai .ai-md pre{margin:6px 0;padding:8px 10px;border-radius:8px;background:var(--code);',
      'overflow:auto;font:11.5px/1.55 ui-monospace,Menlo,Consolas,monospace}',
      '#__ai .ai-md code{padding:1px 4px;border-radius:4px;background:var(--code);',
      'font:11.5px/1.5 ui-monospace,Menlo,Consolas,monospace;word-break:break-word}',
      '#__ai .ai-md pre code{padding:0;background:transparent;font:inherit}',
      '#__ai .ai-md blockquote{margin:6px 0;padding:2px 10px;border-left:2px solid var(--line);color:var(--muted)}',
      '#__ai .ai-md ul,#__ai .ai-md ol{margin:4px 0 6px;padding-left:20px}',
      '#__ai .ai-md li{margin:2px 0}',
      '#__ai .ai-md hr{border:0;border-top:1px solid var(--line);margin:9px 0}',
      '#__ai .ai-md table{border-collapse:collapse;margin:6px 0;max-width:100%;display:block;overflow:auto}',
      '#__ai .ai-md th,#__ai .ai-md td{border:1px solid var(--line);padding:3px 7px;font-size:11.5px;text-align:left}',
      '#__ai .ai-md th{background:var(--soft);font-weight:700}',
      '#__ai .ai-md a{color:var(--accent);text-decoration:underline;word-break:break-all}',
      '#__ai .ai-md .ai-math-block{overflow-x:auto;overflow-y:hidden;margin:6px 0;max-width:100%}',
      '#__ai .ai-md .katex{font-size:1.05em}',
      '#__ai .ai-md .katex-display{margin:4px 0}',
      '#__ai .ai-line .m .katex{font-size:1.02em}',
      '#__ai .ai-msg.assistant .ai-bubble{border-bottom-left-radius:4px}',
      '#__ai .ai-msg.user .ai-bubble{background:linear-gradient(180deg,var(--user),var(--accent2));color:#fff;',
      'border-bottom-right-radius:4px}',
      '#__ai .ai-bubble.err{background:rgba(224,96,96,.10);border:1px solid rgba(224,96,96,.38);color:var(--danger)}',
      '#__ai .ai-wait{color:var(--dim)}',
      '#__ai .ai-think{display:none;margin:0 0 6px;padding:7px 9px;border-left:2px solid var(--line);',
      'border-radius:0 8px 8px 0;background:var(--code);color:var(--dim);font-size:11px;line-height:1.6}',
      '#__ai .ai-think summary{cursor:pointer;color:var(--muted);font-size:10.5px;user-select:none}',
      '#__ai .ai-think-txt{margin-top:5px;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto}',
      '#__ai .ai-foot{position:relative;z-index:1;flex-shrink:0;min-width:0;padding:9px 12px 7px;border-top:1px solid var(--line)}',
      '#__ai .ai-inputrow{display:flex;align-items:flex-end;gap:7px}',
      '#__ai .ai-shot{width:38px;height:38px;border:1px solid var(--line);border-radius:10px;',
      'background:var(--soft);color:var(--muted);font-size:17px;flex-shrink:0}',
      '#__ai .ai-shot:active{background:var(--line);color:var(--fg)}',
      // v3.5：多图附件（横向缩略图条）+ 图片缩放查看
      '#__ai .ai-attach{display:none;flex-direction:column;gap:6px;margin-bottom:7px;padding:6px;',
      'border:1px solid var(--line);border-radius:10px;background:var(--soft);min-width:0}',
      '#__ai .ai-attach.on{display:flex}',
      '#__ai .ai-thumbs{display:flex;gap:6px;overflow-x:auto;padding:1px 1px 3px;overscroll-behavior-x:contain}',
      '#__ai .ai-thumb{position:relative;flex:0 0 58px;width:58px;height:58px;border-radius:8px;overflow:hidden;',
      'background:var(--bg);cursor:zoom-in}',
      '#__ai .ai-thumb img{width:100%;height:100%;object-fit:cover;display:block}',
      '#__ai .ai-thumb .ph{width:100%;height:100%;display:grid;place-items:center;color:var(--dim);font-size:16px}',
      '#__ai .ai-thumb .s{position:absolute;left:0;right:0;bottom:0;height:14px;line-height:14px;text-align:center;',
      'font-size:9px;color:#fff;background:rgba(0,0,0,.6);white-space:nowrap;overflow:hidden}',
      '#__ai .ai-thumb .s.ok{background:rgba(38,150,88,.86)}',
      '#__ai .ai-thumb .s.bad{background:rgba(190,58,58,.9);cursor:pointer}',
      '#__ai .ai-thumb .x{position:absolute;right:0;top:0;width:16px;height:16px;border:0;border-radius:0 0 0 8px;',
      'background:rgba(0,0,0,.62);color:#fff;font:10px/16px inherit;padding:0;cursor:pointer}',
      '#__ai .ai-attach-bar{display:flex;align-items:center;gap:6px;min-width:0}',
      '#__ai .ai-attach-tit{flex:1;min-width:0;font-size:10px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#__ai .ai-attach-bar .ai-mini{flex-shrink:0}',
      '#__ai .ai-bubble img{display:block;max-width:100%;max-height:280px;border-radius:8px;margin-top:6px;cursor:zoom-in}',
      '#__ai .ai-bubble .ai-bimgs{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}',
      '#__ai .ai-bubble .ai-bimgs img{margin-top:0;max-height:150px;max-width:46%}',
      '#__ai .ai-bubble .ai-bimgs:not(.multi) img{max-width:100%;max-height:260px}',
      // 缩放层（fixed 到视口，滚轮/双指缩放、拖动平移；挂在 body 上，不能用 #__ai 前缀）
      '.ai-zoom{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.95);',
      'display:flex;flex-direction:column;touch-action:none;overscroll-behavior:contain}',
      '.ai-zoom .zbar{display:flex;align-items:center;gap:5px;padding:8px 10px;flex-shrink:0}',
      '.ai-zoom .ztit{flex:1;min-width:0;font-size:12px;color:rgba(255,255,255,.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ai-zoom .zpct{flex-shrink:0;font:12px/1 ui-monospace,monospace;color:#9dbcff;min-width:42px;text-align:center}',
      '.ai-zoom .zbar button{flex-shrink:0;height:30px;min-width:32px;padding:0 8px;border:1px solid rgba(255,255,255,.22);',
      'border-radius:8px;background:rgba(255,255,255,.1);color:#fff;font:12px/1 inherit;cursor:pointer}',
      '.ai-zoom .zbar button:active{background:rgba(255,255,255,.22)}',
      '.ai-zoom .zstage{flex:1;min-height:0;position:relative;overflow:hidden;display:flex;',
      'align-items:center;justify-content:center;cursor:grab}',
      '.ai-zoom .zstage.drag{cursor:grabbing}',
      '.ai-zoom .zstage img{max-width:100%;max-height:100%;transform-origin:center center;',
      'will-change:transform;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;pointer-events:none}',
      '.ai-zoom .zhint{position:absolute;left:0;right:0;bottom:6px;text-align:center;font-size:10px;',
      'color:rgba(255,255,255,.45);pointer-events:none}',
      '#__ai .ai-ta{flex:1;min-width:0;min-height:38px;max-height:120px;padding:9px 10px;resize:none;',
      'border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--fg);',
      'font:13px/1.5 inherit;outline:none}',
      '#__ai .ai-ta:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(77,126,248,.13)}',
      '#__ai .ai-send{height:38px;min-width:64px;padding:0 14px;border:0;border-radius:10px;',
      'background:linear-gradient(180deg,var(--accent),var(--accent2));color:#fff;font:13px/1 inherit;',
      'font-weight:600;cursor:pointer;flex-shrink:0;box-shadow:0 3px 10px rgba(58,98,214,.32)}',
      '#__ai .ai-send.stop{background:var(--danger);box-shadow:none}',
      '#__ai .ai-stat{display:flex;align-items:center;gap:7px;margin-top:5px;color:var(--dim);font-size:9.5px}',
      '#__ai .ai-stat .grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      // v3.8 底部用量行：token / 速率 / 余额（小字，窄屏可换行）
      '#__ai .ai-usage{display:flex;align-items:center;flex-wrap:wrap;margin-top:2px;color:var(--dim);font-size:9px;line-height:1.5}',
      '#__ai .ai-usage .u{flex:1;min-width:0;word-break:break-word}',
      '#__ai .ai-usage .sep{flex:none;white-space:pre;opacity:.55}',
      '#__ai .ai-usage .bal{flex-shrink:0;color:var(--muted);cursor:pointer;border-bottom:1px dashed rgba(127,127,140,.45)}',
      '#__ai .ai-usage .bal.loading{opacity:.55;cursor:default}',
      // 覆盖层（会话列表 / 相册 / 聊天室）共用
      '#__ai .ai-ov{position:absolute;left:0;top:0;right:0;bottom:0;z-index:8;display:none;flex-direction:column;',
      'background:var(--bg);min-width:0;min-height:0}',
      '#__ai .ai-ov.on{display:flex}',
      // v3.7 聊天室浮窗：脱离卡片、固定定位，可拖拽/缩放
      '#__ai .ai-ov.ai-win{position:fixed;left:auto;top:auto;right:auto;bottom:auto;min-width:300px;min-height:240px;',
      'border:1px solid var(--line);border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.58);overflow:hidden}',
      '#__ai .ai-ov.ai-win .ai-ovbar{cursor:move;touch-action:none;user-select:none;-webkit-user-select:none}',
      '#__ai .ai-ov.ai-win .ai-ovbar .ai-ovtit{pointer-events:none}',
      '#__ai .ai-ov.ai-win .ai-roomrow{padding-right:26px}',
      '#__ai .ai-roomgrip{position:absolute;right:2px;bottom:2px;width:22px;height:22px;z-index:12;',
      'cursor:se-resize;touch-action:none;border-radius:0 0 12px 0;opacity:.75;',
      'background:linear-gradient(135deg,transparent 42%,var(--line) 42%,var(--line) 50%,transparent 50%,transparent 62%,var(--line) 62%,var(--line) 70%,transparent 70%)}',
      '#__ai .ai-ovbar{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--line);flex-shrink:0}',
      '#__ai .ai-ovtit{flex:1;min-width:0;font-weight:700;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#__ai .ai-ovbody{flex:1;min-height:0;overflow:auto;padding:8px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',
      '#__ai .ai-item{display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid var(--line);',
      'border-radius:10px;background:var(--soft);margin-bottom:6px;min-width:0;cursor:pointer}',
      '#__ai .ai-item:active{background:var(--line)}',
      '#__ai .ai-item .t{flex:1;min-width:0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#__ai .ai-item .d{flex-shrink:0;color:var(--dim);font-size:10px;white-space:nowrap}',
      '#__ai .ai-item.on{border-color:var(--accent);background:rgba(77,126,248,.12)}',
      '#__ai .ai-x{flex-shrink:0;width:26px;height:26px;border:0;border-radius:7px;',
      'background:transparent;color:var(--danger);font:12px/1 inherit;cursor:pointer;padding:0}',
      // 相册
      '#__ai .ai-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px;margin-bottom:8px}',
      '#__ai .ai-gal .c{position:relative;aspect-ratio:1;border-radius:9px;overflow:hidden;background:var(--soft);cursor:pointer}',
      '#__ai .ai-gal .c img,#__ai .ai-gal .c video{width:100%;height:100%;object-fit:cover;display:block}',
      '#__ai .ai-gal .c .k{position:absolute;left:0;right:0;bottom:0;padding:2px 4px;color:#fff;font-size:8.5px;',
      'background:linear-gradient(transparent,rgba(0,0,0,.7));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#__ai .ai-view{position:absolute;left:0;top:0;right:0;bottom:0;z-index:9;display:none;flex-direction:column;background:#000}',
      '#__ai .ai-view.on{display:flex}',
      '#__ai .ai-view .v{flex:1;min-height:0;object-fit:contain;width:100%}',
      '#__ai .ai-view .b{display:flex;gap:6px;padding:8px;justify-content:center;background:rgba(0,0,0,.6)}',
      '#__ai .ai-view .b button{height:32px;padding:0 12px;border:1px solid rgba(255,255,255,.2);border-radius:8px;',
      'background:rgba(255,255,255,.1);color:#fff;font:12px/1 inherit;cursor:pointer}',
      // 聊天室
      '#__ai .ai-room{display:flex;flex-direction:column;gap:7px;padding-bottom:4px}',
      '#__ai .ai-line{display:flex;flex-direction:column;gap:2px;max-width:88%}',
      '#__ai .ai-line.me{align-self:flex-end;align-items:flex-end}',
      '#__ai .ai-line .n{font-size:9.5px;color:var(--dim)}',
      '#__ai .ai-line .m{padding:7px 10px;border-radius:11px;background:var(--bot);color:var(--fg);',
      'font-size:12px;white-space:normal;word-break:break-word;overflow-wrap:anywhere}',
      '#__ai .ai-line.me .m{background:linear-gradient(180deg,var(--user),var(--accent2));color:#fff}',
      '#__ai .ai-line .m img{display:block;max-width:100%;max-height:220px;border-radius:7px;margin-top:4px;cursor:zoom-in}',
      '#__ai .ai-line .t{font-size:9px;color:var(--dim)}',
      '#__ai .ai-roomrow{display:flex;align-items:center;gap:6px;padding:7px 9px;border-top:1px solid var(--line);flex-shrink:0}',
      '#__ai .ai-roomrow input{flex:1;min-width:0;height:34px;padding:0 9px;border:1px solid var(--line);',
      'border-radius:9px;background:var(--bg);color:var(--fg);font:12.5px/1.4 inherit;outline:none}',
      '#__ai .ai-roomrow button{height:34px;padding:0 11px;border:0;border-radius:9px;',
      'background:linear-gradient(180deg,var(--accent),var(--accent2));color:#fff;font:12px/1 inherit;cursor:pointer;flex-shrink:0}',
      '#__ai .ai-modebar{display:flex;gap:4px;padding:0 10px 7px;flex-shrink:0;position:relative;z-index:1}',
      '#__ai .ai-modebar .ai-mini.on{background:linear-gradient(180deg,var(--accent),var(--accent2));color:#fff;border-color:transparent}',
      '#__ai .ai-ico.on{color:var(--accent)}',
      '@media (max-width:560px){#__ai{padding:0}#__ai .ai-card{width:100%;height:100%;max-height:100%;',
      'border:0;border-radius:0}#__ai .ai-badge,#__ai .ai-themebtn{display:none}#__ai .ai-msgs{padding:10px}',
      '#__ai .ai-body{max-width:86%}}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  // ── DOM ──
  function div(cls, text) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }
  function button(txt, cls, title) {
    var b = document.createElement('button');
    b.className = cls || '';
    b.textContent = txt;
    if (title) b.title = title;
    return b;
  }

  // ── Markdown + LaTeX（v3.6：AI 回答与聊天室；纯 DOM 构建，绝不把消息当 HTML 注入）──
  var katexP = null;
  function ensureKatex() {
    if (window.katex && window.katex.render) return Promise.resolve(true);
    if (katexP) return katexP;
    var bases = ['https://fastly.jsdelivr.net/npm/katex@0.16.11/dist/',
                 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/'];
    katexP = new Promise(function (resolve) {
      var i = 0;
      function tryOne() {
        if (i >= bases.length) { resolve(false); return; }
        var base = bases[i++];
        var css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = base + 'katex.min.css';
        document.head.appendChild(css);
        var s = document.createElement('script');
        s.src = base + 'katex.min.js';
        var fin = false;
        var to = setTimeout(function () {
          if (fin) return; fin = true; try { s.remove(); } catch (e) {} tryOne();
        }, 6000);
        s.onload = function () {
          if (fin) return; fin = true; clearTimeout(to);
          resolve(!!(window.katex && window.katex.render));
        };
        s.onerror = function () {
          if (fin) return; fin = true; clearTimeout(to);
          try { s.remove(); } catch (e) {} tryOne();
        };
        document.head.appendChild(s);
      }
      tryOne();
    });
    return katexP;
  }
  function typesetMath(el) {
    var list = el.querySelectorAll('.ai-math');
    if (!list.length) return;
    ensureKatex().then(function (ok) {
      if (!ok) return;
      [].forEach.call(list, function (n) {
        if (n.dataset.done || !n.dataset.tex) return;
        try {
          window.katex.render(n.dataset.tex, n, {
            displayMode: n.dataset.display === '1',
            throwOnError: false, trust: false, strict: 'ignore'
          });
          n.dataset.done = '1';
        } catch (e) {}
      });
    });
  }
  function mdMath(tex, display) {
    var s = document.createElement('span');
    s.className = 'ai-math';
    s.dataset.tex = tex;
    if (display) s.dataset.display = '1';
    s.textContent = display ? ('$$' + tex + '$$') : ('$' + tex + '$');
    return s;
  }
  function mdInline(parent, text) {
    var src = String(text == null ? '' : text);
    var re = /(`+)([\s\S]*?)\1|\$\$([\s\S]+?)\$\$|\$([^\s$][^$\n]*?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]*)\]\(([^)\s]+)\)|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|\*([^*\n]+?)\*|_([^_\n]+?)_|\n|\\([\\`*_{}\[\]()#+\-.!>~$|])/g;
    var last = 0, m;
    while ((m = re.exec(src))) {
      if (m.index > last) parent.appendChild(document.createTextNode(src.slice(last, m.index)));
      last = re.lastIndex;
      if (m[2] !== undefined) {
        var c = document.createElement('code');
        c.textContent = m[2].replace(/^\n|\n$/g, '');
        parent.appendChild(c);
      } else if (m[3] !== undefined) {
        parent.appendChild(mdMath(m[3].trim(), true));
      } else if (m[4] !== undefined) {
        parent.appendChild(mdMath(m[4].trim(), false));
      } else if (m[5] !== undefined) {
        parent.appendChild(mdMath(m[5].trim(), false));
      } else if (m[6] !== undefined) {
        parent.appendChild(mdMath(m[6].trim(), true));
      } else if (m[7] !== undefined) {
        parent.appendChild(document.createTextNode(m[7] || '图片'));
      } else if (m[9] !== undefined) {
        var a;
        if (/^https?:\/\//i.test(m[10])) {
          a = document.createElement('a');
          a.href = m[10];
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = m[9] || m[10];
        } else {
          a = document.createElement('span');
          a.textContent = (m[9] || '') + ' (' + m[10] + ')';
        }
        parent.appendChild(a);
      } else if (m[11] !== undefined) {
        var b1 = document.createElement('strong'); mdInline(b1, m[11]); parent.appendChild(b1);
      } else if (m[12] !== undefined) {
        var b2 = document.createElement('strong'); mdInline(b2, m[12]); parent.appendChild(b2);
      } else if (m[13] !== undefined) {
        var de = document.createElement('del'); mdInline(de, m[13]); parent.appendChild(de);
      } else if (m[14] !== undefined) {
        var e1 = document.createElement('em'); mdInline(e1, m[14]); parent.appendChild(e1);
      } else if (m[15] !== undefined) {
        var e2 = document.createElement('em'); mdInline(e2, m[15]); parent.appendChild(e2);
      } else if (m[16] !== undefined) {
        parent.appendChild(document.createTextNode(m[16]));
      } else if (m[0] === '\n') {
        parent.appendChild(document.createElement('br'));
      }
    }
    if (last < src.length) parent.appendChild(document.createTextNode(src.slice(last)));
  }
  function mdRow(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (s) { return s.trim(); });
  }
  function mdBlocks(text) {
    var frag = document.createDocumentFragment();
    var lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    var i = 0, para = [];
    function flush() {
      if (!para.length) return;
      var p = document.createElement('p');
      mdInline(p, para.join('\n'));
      frag.appendChild(p);
      para = [];
    }
    while (i < lines.length) {
      var ln = lines[i];
      if (/^\s*$/.test(ln)) { flush(); i++; continue; }
      var fm = ln.match(/^ {0,3}(```+|~~~+)\s*([^\s`]*)\s*$/);
      if (fm) {
        flush();
        var fenceCh = fm[1].charAt(0);
        var lang = fm[2] || '';
        var buf = [];
        i++;
        while (i < lines.length && !(new RegExp('^ {0,3}' + fenceCh + '{3,}\\s*$')).test(lines[i])) {
          buf.push(lines[i]); i++;
        }
        i++;
        var pre = document.createElement('pre');
        var code = document.createElement('code');
        if (lang) code.className = 'lang-' + lang.replace(/[^\w+-]/g, '');
        code.textContent = buf.join('\n');
        pre.appendChild(code);
        frag.appendChild(pre);
        continue;
      }
      // $$ 块级公式
      var dm = ln.match(/^ {0,3}\$\$\s*(.*)$/);
      if (dm) {
        flush();
        var tex = [];
        var rest = dm[1];
        var end = rest.match(/^(.*?)\$\$\s*$/);
        if (end) { if (end[1].trim()) tex.push(end[1]); i++; }
        else {
          if (rest.trim()) tex.push(rest);
          i++;
          while (i < lines.length) {
            var e2 = lines[i].match(/^(.*?)\$\$\s*$/);
            if (e2) { if (e2[1].trim()) tex.push(e2[1]); i++; break; }
            tex.push(lines[i]); i++;
          }
        }
        var mb = document.createElement('div');
        mb.className = 'ai-math-block';
        mb.appendChild(mdMath(tex.join('\n').trim(), true));
        frag.appendChild(mb);
        continue;
      }
      // \[ 块级公式
      if (/^ {0,3}\\\[/.test(ln)) {
        flush();
        var tex2 = [];
        var l0 = ln.replace(/^ {0,3}\\\[/, '');
        var e3 = l0.match(/^(.*?)\\\]\s*$/);
        if (e3) { if (e3[1].trim()) tex2.push(e3[1]); i++; }
        else {
          if (l0.trim()) tex2.push(l0);
          i++;
          while (i < lines.length) {
            var e4 = lines[i].match(/^(.*?)\\\]\s*$/);
            if (e4) { if (e4[1].trim()) tex2.push(e4[1]); i++; break; }
            tex2.push(lines[i]); i++;
          }
        }
        var mb2 = document.createElement('div');
        mb2.className = 'ai-math-block';
        mb2.appendChild(mdMath(tex2.join('\n').trim(), true));
        frag.appendChild(mb2);
        continue;
      }
      var hm = ln.match(/^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (hm) {
        flush();
        var h = document.createElement('h' + hm[1].length);
        mdInline(h, hm[2]);
        frag.appendChild(h);
        i++;
        continue;
      }
      if (/^ {0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(ln)) {
        flush();
        frag.appendChild(document.createElement('hr'));
        i++;
        continue;
      }
      if (/^ {0,3}>/.test(ln)) {
        flush();
        var q = [];
        while (i < lines.length && /^ {0,3}>/.test(lines[i])) {
          q.push(lines[i].replace(/^ {0,3}>\s?/, '')); i++;
        }
        var bq = document.createElement('blockquote');
        bq.appendChild(mdBlocks(q.join('\n')));
        frag.appendChild(bq);
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length &&
          /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(lines[i + 1])) {
        flush();
        var head = mdRow(ln);
        i += 2;
        var table = document.createElement('table');
        var thead = document.createElement('thead');
        var trh = document.createElement('tr');
        head.forEach(function (c) {
          var th = document.createElement('th');
          mdInline(th, c);
          trh.appendChild(th);
        });
        thead.appendChild(trh);
        table.appendChild(thead);
        var tbody = document.createElement('tbody');
        while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) {
          var tds = mdRow(lines[i]);
          var tr = document.createElement('tr');
          tds.forEach(function (c) {
            var td = document.createElement('td');
            mdInline(td, c);
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
          i++;
        }
        table.appendChild(tbody);
        frag.appendChild(table);
        continue;
      }
      var lm = ln.match(/^ {0,3}([-*+]|\d+[.)])\s+(.*)$/);
      if (lm) {
        flush();
        var ordered = /\d/.test(lm[1]);
        var list = document.createElement(ordered ? 'ol' : 'ul');
        while (i < lines.length) {
          var m2 = lines[i].match(/^ {0,3}([-*+]|\d+[.)])\s+(.*)$/);
          if (!m2) break;
          var li = document.createElement('li');
          mdInline(li, m2[2]);
          list.appendChild(li);
          i++;
        }
        frag.appendChild(list);
        continue;
      }
      para.push(ln);
      i++;
    }
    flush();
    return frag;
  }
  // 把 Markdown 渲染进元素；原文留在 dataset.raw，复制按钮用它
  function mdInto(el, text) {
    el.textContent = '';
    el.classList.add('ai-md');
    el.dataset.raw = String(text == null ? '' : text);
    el.appendChild(mdBlocks(text));
    typesetMath(el);
  }

  var root = document.createElement('div');
  root.id = '__ai';

  // 打开 AI 时收起主面板，避免它压在 AI 全屏窗上；关闭时原样恢复
  var fhPanel = document.getElementById('__fh');
  var fhDisplay = null;
  if (fhPanel) {
    fhDisplay = fhPanel.style.display;
    fhPanel.style.display = 'none';
  }

  var shade = div('ai-shade');
  var card = div('ai-card');
  card.append(div('ai-bg'));

  var head = div('ai-head');
  var logo = div('ai-logo', '🤖');
  var title = div('ai-title');
  title.append(document.createTextNode('AI 网页'));
  var ver = document.createElement('span');
  ver.className = 'ai-ver';
  ver.textContent = 'v3.13';
  title.append(ver);
  var badge = div('ai-badge', 'ds-41-f');
  var spacer = div('ai-spacer');
  var dot = div('ai-dot');
  dot.title = '未配置 API Key';
  var newBtn = button('＋', 'ai-ico', '新建对话');
  var sessBtn = button('🗂', 'ai-ico', '对话列表');
  var galBtn = button('🖼', 'ai-ico', '相册');
  var probeBtn = button('📡', 'ai-ico', '探测 / 缓存');
  var acctBtn = button('👤', 'ai-ico', '账号（用户名 + PIN）');
  var cfgBtn = button('🔑', 'ai-ico', 'API Key / 设置');
  var fullBtn = button('⛶', 'ai-ico', '全屏');
  var themeBtn = button('🌓', 'ai-ico ai-themebtn', '主题');
  var closeBtn = button('✕', 'ai-ico ai-close', '关闭');
  head.append(logo, title, badge, spacer, dot, newBtn, sessBtn, galBtn, probeBtn, acctBtn, cfgBtn, fullBtn, themeBtn, closeBtn);

  // 设置抽屉
  var cfgBox = div('ai-cfg');

  // 密钥只显示前 7/后 5；首次输入时是明文，保存后只能点“修改”重填
  function maskSecret(s) {
    s = String(s || '');
    if (!s) return '';
    if (s.length <= 12) return s.slice(0, 2) + '••••' + s.slice(-2);
    return s.slice(0, 7) + '••••••' + s.slice(-5);
  }
  function makeSecretRow(labelText, initial, placeholder, onSave) {
    var row = div('ai-row');
    var lab = document.createElement('label');
    lab.textContent = labelText;
    var inp = document.createElement('input');
    inp.className = 'ai-in';
    inp.type = 'text';
    inp.autocomplete = 'off';
    inp.spellcheck = false;
    inp.setAttribute('autocapitalize', 'off');
    inp.setAttribute('autocorrect', 'off');
    var acts = div('ai-key-actions');
    var editBtn = button('设置', 'ai-mini');
    var cancelBtn = button('取消', 'ai-mini');
    cancelBtn.style.display = 'none';
    acts.append(editBtn, cancelBtn);
    row.append(lab, inp, acts);

    var value = String(initial || '');
    var editing = false;

    function paint() {
      if (editing) return;
      inp.readOnly = true;
      inp.value = value ? maskSecret(value) : '';
      inp.placeholder = placeholder;
      editBtn.textContent = value ? '修改' : '设置';
      cancelBtn.style.display = 'none';
    }
    function begin() {
      if (editing) return;
      editing = true;
      inp.readOnly = false;
      inp.value = '';
      inp.placeholder = placeholder;
      editBtn.textContent = '保存';
      cancelBtn.style.display = value ? '' : 'none';
      setTimeout(function () { try { inp.focus(); } catch (e) {} }, 30);
    }
    function cancel() {
      if (!editing) return;
      editing = false;
      paint();
    }
    function commit() {
      var v = inp.value.trim();
      if (!v) { try { inp.focus(); } catch (e) {} return; }
      value = v;
      editing = false;
      onSave(v);
      paint();
    }

    editBtn.onclick = function (e) {
      e.stopPropagation();
      if (editing) commit(); else begin();
    };
    cancelBtn.onclick = function (e) {
      e.stopPropagation();
      cancel();
    };
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (editing) commit(); }
      else if (e.key === 'Escape' && editing) {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      }
    });
    paint();

    return {
      row: row,
      get: function () { return value; },
      set: function (v) { value = String(v || ''); editing = false; paint(); },
      begin: begin,
      cancel: cancel,
      focus: function () { try { inp.focus(); } catch (e) {} }
    };
  }

  var keyField = makeSecretRow('API Key', cfg.key, 'sk-...（只存本机）', function (v) {
    cfg.key = v;
    save(K_KEY, v);
    try { if (window.__fhAcct && window.__fhAcct.saveKey) window.__fhAcct.saveKey(v); } catch (e) {}
    rebindOwner();
    setDot();
    setStat();
    paintAcct();
    syncProfile();
    cfgMsg.textContent = 'Key 已保存到本机（之后只显示掩码）· 用户隔离：' + ownerTag + (acctUid() ? '（账号）' : '');
  });

  var baseRow = div('ai-row');
  var baseLab = document.createElement('label');
  baseLab.textContent = 'API 地址';
  var baseIn = document.createElement('input');
  baseIn.className = 'ai-in';
  baseIn.placeholder = 'https://api.deepseek.com';
  baseIn.value = cfg.base;
  baseIn.autocomplete = 'off';
  baseIn.spellcheck = false;
  baseRow.append(baseLab, baseIn);

  var gitField = makeSecretRow('上传 Token', cfg.gitToken, 'GitLab Token（可选）', function (v) {
    cfg.gitToken = v;
    save(K_GIT, v);
    try { if (window.__fhAcct && window.__fhAcct.saveGit) window.__fhAcct.saveGit(v); } catch (e) {}
    rebindOwner();
    renderAttach();
    paintAcct();
    cfgMsg.textContent = v ? 'Token 已保存，拍照后会自动上传 GitLab media/<用户名>/' : '已清除上传 Token';
  });

  // 账号：用户名 + PIN，本机持久；AI Key / Token / 网页配置跟着账号走
  var acctRow = div('ai-row');
  var acctLab = document.createElement('label');
  acctLab.textContent = '账号';
  var acctVal = div('ai-in');
  acctVal.style.cssText = 'display:flex;align-items:center;overflow:hidden;text-overflow:ellipsis;' +
    'white-space:nowrap;color:#9a9aa8;flex:1;min-width:0';
  var acctGo = button('登录', 'ai-mini');
  acctRow.append(acctLab, acctVal, acctGo);

  function paintAcct() {
    var r = acctRec();
    if (r) {
      acctVal.textContent = r.user;
      acctVal.title = r.gitToken ? 'AI Key / Token 已保存到账号' : '已登录（还没保存上传 Token）';
      acctGo.textContent = '退出';
    } else {
      acctVal.textContent = '未登录';
      acctVal.title = '登录后 AI Key / Token / 网页配置跟着账号保存';
      acctGo.textContent = '登录';
    }
    acctGo.onclick = function (e) {
      e.stopPropagation();
      if (r) {
        if (!confirm('退出当前账号？登录状态会清掉，账号里的配置仍保存在本机。')) return;
        try { if (window.__fhAcct && window.__fhAcct.logout) window.__fhAcct.logout(); } catch (e2) {}
      } else {
        openAcct();
      }
    };
  }
  function openAcct(after) {
    try {
      if (window.__fhAcct && window.__fhAcct.open) { window.__fhAcct.open(after); return; }
    } catch (e) {}
    cfgMsg.textContent = '账号功能未就绪（请刷新页面）';
  }

  function migrateMedia(oldOwner, newOwner) {
    try {
      dbAll().then(function (all) {
        (all || []).forEach(function (m) {
          if (m && m.owner === oldOwner) { m.owner = newOwner; dbPut(m); }
        });
      });
    } catch (e) {}
  }
  function acctSync() {
    var old = ownerTag;
    cfg.key = read(K_KEY, '');
    cfg.gitToken = read(K_GIT, '');
    keyField.set(cfg.key);
    gitField.set(cfg.gitToken);
    var n = computeOwner();
    if (n !== old) {
      if (n !== 'local') {
        sessions.forEach(function (s) { if (!s.owner || s.owner === 'local' || s.owner === old) s.owner = n; });
        migrateMedia(old, n);
      }
      ownerTag = n;
      saveSessions();
      var cur = sessionById(sid);
      if (!cur || cur.owner !== n) {
        var mine = sessions.filter(function (s) { return s.owner === n; });
        sid = mine.length ? mine[0].id : '';
        save(K_SID, sid);
        history = sid ? readHist(sid) : [];
        renderHistory();
      }
      renderSessList();
    }
    renderAttach();
    setDot();
    setStat();
    paintAcct();
    try {
      var ar = acctRec();
      acctBtn.style.color = ar ? '#6f9bff' : '';
      acctBtn.title = ar ? ('账号：' + ar.user) : '账号（用户名 + PIN）';
    } catch (e) {}
    try { syncProfile(); } catch (e2) {}
  }
  try { window.addEventListener('fh:acct', acctSync); } catch (e) {}
  paintAcct();

  var autoRow = div('ai-check');
  var autoIn = document.createElement('input');
  autoIn.type = 'checkbox';
  autoIn.checked = !!cfg.autoUpload;
  var autoLab = document.createElement('span');
  autoLab.textContent = '拍照后自动上传到 GitLab media/<用户名>/';
  autoRow.append(autoIn, autoLab);
  autoIn.onchange = function () {
    cfg.autoUpload = !!autoIn.checked;
    save(K_AUTO, cfg.autoUpload ? '1' : '0');
    if (cfg.autoUpload && cfg.gitToken) {
      pendingImages.forEach(function (it) {
        if (it.dataUrl && (it.state === 'off' || it.state === 'no-token')) uploadImage(it);
      });
    }
    renderAttach();
  };

  var themeRow = div('ai-row');
  var themeLab = document.createElement('label');
  themeLab.textContent = '主题';
  var themeSel = document.createElement('select');
  themeSel.className = 'ai-sel';
  [['auto', '自动（跟随面板）'], ['dark', '深色'], ['light', '浅色']].forEach(function (o) {
    var op = document.createElement('option');
    op.value = o[0];
    op.textContent = o[1];
    themeSel.append(op);
  });
  themeSel.value = cfg.theme;
  themeRow.append(themeLab, themeSel);

  var depthRow = div('ai-row');
  var depthLab = document.createElement('label');
  depthLab.textContent = '思考深度';
  var depthSel = document.createElement('select');
  depthSel.className = 'ai-sel';
  [['off', '关闭（最快，不显示思考）'], ['low', '低'], ['high', '高（默认）'], ['max', '最大']].forEach(function (o) {
    var op = document.createElement('option');
    op.value = o[0];
    op.textContent = o[1];
    depthSel.append(op);
  });
  depthSel.value = cfg.depth;
  depthRow.append(depthLab, depthSel);

  // 模型：可手填，也可点“扫描”从 /models 拉列表
  var modelRow = div('ai-row');
  var modelLab = document.createElement('label');
  modelLab.textContent = '模型';
  var modelSel = document.createElement('select');
  modelSel.className = 'ai-sel';
  modelSel.style.display = 'none';
  var modelIn = document.createElement('input');
  modelIn.className = 'ai-in';
  modelIn.type = 'text';
  modelIn.autocomplete = 'off';
  modelIn.spellcheck = false;
  modelIn.placeholder = 'deepseek-flash';
  modelIn.value = cfg.model;
  var scanBtn = button('扫描', 'ai-mini', '从 API 地址扫描可用模型');
  scanBtn.style.flexShrink = '0';
  modelRow.append(modelLab, modelIn, modelSel, scanBtn);

  // 接口模式：chat = /chat/completions，responses = /v1/responses
  var modeRow = div('ai-row');
  var modeLab = document.createElement('label');
  modeLab.textContent = '接口';
  var modeSel = document.createElement('select');
  modeSel.className = 'ai-sel';
  [['chat', 'Chat Completions（/chat/completions）'], ['responses', 'Responses（/v1/responses）']].forEach(function (o) {
    var op = document.createElement('option');
    op.value = o[0];
    op.textContent = o[1];
    modeSel.append(op);
  });
  modeSel.value = cfg.mode;
  modeRow.append(modeLab, modeSel);

  // ── v3.12：多份 API 配置（Key / 地址 / 模型 / 接口），本机保存并随云端配置同步 ──
  var profiles = [];
  var profileId = '';
  var profTimer = 0;
  var pushTimer = 0;

  function pidNew() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function profSnap() {
    return {
      key: cfg.key || '',
      base: cfg.base,
      model: cfg.model,
      mode: cfg.mode,
      models: (modelList || []).slice(0, 300)
    };
  }
  function profById(id) {
    for (var i = 0; i < profiles.length; i++) if (profiles[i].id === id) return profiles[i];
    return null;
  }
  // 配置变动 → 延迟上传加密配置（云端），没有 Token 就静默跳过
  function cloudPush(now) {
    try {
      if (!(window.__fhCfg && window.__fhCfg.can && window.__fhCfg.can())) return;
    } catch (e) { return; }
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      try {
        window.__fhCfg.push(function (r) {
          if (r && r.ok) {
            cfgMsg.title = '配置已同步到云端 · ' + new Date().toLocaleTimeString();
            cfgMsg.textContent = '已同步到云端' + (r.n ? '（' + r.n + ' 个键）' : '');
          } else {
            cfgMsg.title = '云端同步失败：' + ((r && (r.msg || r.status)) || '未知错误');
          }
        });
      } catch (e) {}
    }, now ? 60 : 1200);
  }
  function saveProfiles(noPush) {
    try { save(K_PROFILES, JSON.stringify(profiles)); } catch (e) {}
    if (!noPush) cloudPush();
  }
  // 表单里的值回写当前配置（防抖，避免每敲一个字都写）
  // 注意：快照要在调用时就取，否则切换配置后定时器会把新值写回旧配置
  function syncProfile(now) {
    clearTimeout(profTimer);
    var pid = profileId;
    var s = profSnap();
    profTimer = setTimeout(function () {
      var p = profById(pid);
      if (!p) return;
      p.key = s.key; p.base = s.base; p.model = s.model; p.mode = s.mode; p.models = s.models;
      saveProfiles(now);
    }, now ? 0 : 400);
  }
  function rebuildModelSel(ids) {
    ids = Array.isArray(ids) ? ids : [];
    modelSel.innerHTML = '';
    ids.forEach(function (id) {
      var o = document.createElement('option');
      o.value = id;
      o.textContent = id;
      modelSel.append(o);
    });
    modelSel.style.display = ids.length ? '' : 'none';
    if (ids.indexOf(cfg.model) >= 0) modelSel.value = cfg.model;
  }

  // 首次升级：用现有单份配置生成「默认配置」
  try {
    var rawProf = read(K_PROFILES, '');
    if (rawProf) {
      var arr = JSON.parse(rawProf);
      if (Object.prototype.toString.call(arr) === '[object Array]') {
        profiles = arr.filter(function (p) { return p && typeof p === 'object'; }).map(function (p) {
          return {
            id: p.id || pidNew(),
            name: String(p.name || '配置'),
            key: String(p.key || ''),
            base: /^https?:\/\//i.test(p.base || '') ? p.base : 'https://api.deepseek.com',
            model: String(p.model || 'deepseek-flash'),
            mode: p.mode === 'responses' ? 'responses' : 'chat',
            models: Object.prototype.toString.call(p.models) === '[object Array]' ? p.models.slice(0, 300) : []
          };
        });
      }
    }
  } catch (e) {}
  if (!profiles.length) {
    var p0 = profSnap();
    p0.id = pidNew();
    p0.name = '默认配置';
    profiles = [p0];
    saveProfiles(true);   // 首次迁移不必立刻上云
  }
  profileId = read(K_PROFILE, '') || profiles[0].id;
  if (!profById(profileId)) profileId = profiles[0].id;

  var profRow = div('ai-row');
  var profLab = document.createElement('label');
  profLab.textContent = '配置';
  var profSel = document.createElement('select');
  profSel.className = 'ai-sel';
  profSel.title = '切换 API 配置（Key / 地址 / 模型 / 接口）';
  var profAdd = button('＋', 'ai-mini', '把当前设置另存为新配置');
  var profRen = button('✎', 'ai-mini', '重命名当前配置');
  var profDel = button('🗑', 'ai-mini', '删除当前配置');
  [profAdd, profRen, profDel].forEach(function (b) { b.style.flexShrink = '0'; });
  profRow.append(profLab, profSel, profAdd, profRen, profDel);

  function paintProfiles() {
    profSel.innerHTML = '';
    profiles.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      profSel.append(o);
    });
    profSel.value = profileId;
    profDel.title = profiles.length < 2 ? '至少保留一份配置' : '删除当前配置';
  }
  function applyProfile(id, silent) {
    var p = profById(id);
    if (!p) return;
    profileId = p.id;
    save(K_PROFILE, p.id);
    cfg.key = p.key || '';
    cfg.base = /^https?:\/\//i.test(p.base || '') ? p.base : 'https://api.deepseek.com';
    cfg.model = String(p.model || 'deepseek-flash').trim() || 'deepseek-flash';
    cfg.mode = p.mode === 'responses' ? 'responses' : 'chat';
    modelList = Array.isArray(p.models) ? p.models.slice(0, 300) : [];
    save(K_KEY, cfg.key);
    save(K_BASE, cfg.base);
    save(K_MODEL, cfg.model);
    save(K_MODE, cfg.mode);
    save(K_MODELS, JSON.stringify(modelList));
    keyField.set(cfg.key);
    baseIn.value = cfg.base;
    modelIn.value = cfg.model;
    modeSel.value = cfg.mode;
    rebuildModelSel(modelList);
    try { if (window.__fhAcct && window.__fhAcct.saveKey) window.__fhAcct.saveKey(cfg.key); } catch (e) {}
    profSel.value = p.id;
    setDot();
    setStat();
    paintAcct();
    if (!silent) cfgMsg.textContent = '已切换到「' + p.name + '」· ' + cfg.base + ' · ' + cfg.model;
  }
  profSel.onchange = function () {
    syncProfile(true);
    applyProfile(profSel.value);
  };
  profAdd.onclick = function (e) {
    e.stopPropagation();
    syncProfile(true);
    var name = prompt('新配置名称（例如：DeepSeek 官方 / 中转 / 本地）', '配置 ' + (profiles.length + 1));
    if (name == null) return;
    name = String(name).trim() || ('配置 ' + (profiles.length + 1));
    var s = profSnap();
    s.id = pidNew();
    s.name = name;
    profiles.push(s);
    saveProfiles();
    paintProfiles();
    applyProfile(s.id);
    cfgMsg.textContent = '已另存为「' + name + '」并切换过去';
  };
  profRen.onclick = function (e) {
    e.stopPropagation();
    var p = profById(profileId);
    if (!p) return;
    var name = prompt('重命名配置', p.name);
    if (name == null) return;
    name = String(name).trim();
    if (!name) return;
    p.name = name;
    saveProfiles();
    paintProfiles();
    cfgMsg.textContent = '已重命名为「' + name + '」';
  };
  profDel.onclick = function (e) {
    e.stopPropagation();
    if (profiles.length < 2) { cfgMsg.textContent = '至少要保留一份配置'; return; }
    var p = profById(profileId);
    if (!p) return;
    if (!confirm('删除配置「' + p.name + '」？只删本机这一份记录，不影响模型服务商那边。')) return;
    profiles = profiles.filter(function (x) { return x.id !== p.id; });
    saveProfiles();
    applyProfile(profiles[0].id);
    paintProfiles();
    cfgMsg.textContent = '已删除「' + p.name + '」';
  };

  var hint = div('ai-hint', 'Key / Token 只存本机；配置可多份保存，有上传 Token 时会随加密配置同步到云端；图片上传到 ' + GIT_PROJ + ':' + GIT_BRANCH + '/media/<用户名>/。');
  var cfgMsg = div('ai-cfgmsg', '');
  cfgBox.append(profRow, acctRow, keyField.row, baseRow, modelRow, modeRow, gitField.row, autoRow, themeRow, depthRow, hint, cfgMsg);
  paintProfiles();
  applyProfile(profileId, true);

  // 对话区
  var msgs = div('ai-msgs');
  var empty = null;

  // 输入区
  var foot = div('ai-foot');

  // v3.5：多图（最多 9 张）——缩略图条 + 每张单独上传状态
  var MAX_IMAGES = 9;
  var attach = div('ai-attach');
  var thumbs = div('ai-thumbs');
  var attachBar = div('ai-attach-bar');
  var attachTit = div('ai-attach-tit', '');
  // v3.3：配置了 GitLab Token 才显示「上传至 GitLab 仓库」，勾选状态持久保存
  var gitUpWrap = document.createElement('label');
  gitUpWrap.style.cssText = 'display:none;align-items:center;gap:4px;font-size:10.5px;color:var(--dim);' +
    'white-space:nowrap;flex-shrink:0;cursor:pointer';
  var gitUp = document.createElement('input');
  gitUp.type = 'checkbox';
  gitUp.style.cssText = 'margin:0;width:12px;height:12px;accent-color:#5b8dfa';
  var gitUpTxt = document.createElement('span');
  gitUpTxt.textContent = '传 GitLab';
  gitUpWrap.append(gitUp, gitUpTxt);
  gitUp.onchange = function () {
    cfg.autoUpload = !!gitUp.checked;
    save(K_AUTO, cfg.autoUpload ? '1' : '0');
    if (!pendingImages || !pendingImages.length) return;
    if (cfg.autoUpload && cfg.gitToken) {
      pendingImages.forEach(function (it) {
        if (it.dataUrl && it.state !== 'uploaded' && it.state !== 'uploading') uploadImage(it);
      });
    } else if (!cfg.autoUpload) {
      pendingImages.forEach(function (it) {
        if (it.xhr) { try { it.xhr.abort(); } catch (e) {} it.xhr = null; }
        if (it.state !== 'uploaded') it.state = 'off';
      });
      renderAttach();
    }
  };
  var attachUp = button('上传', 'ai-mini', '把还没上传的图片传到 GitLab media/<用户名>/');
  var attachRm = button('清空', 'ai-mini', '移除全部图片');
  attachBar.append(attachTit, gitUpWrap, attachUp, attachRm);
  attach.append(thumbs, attachBar);
  renderAttach();

  var inputRow = div('ai-inputrow');
  var photoBtn = button('📷', 'ai-ico ai-shot', '拍照（网页相机）/ 选图（自动上传 GitLab）');
  var micBtn = button('🎤', 'ai-ico ai-shot', '语音输入（语音识别转文字）');
  var ta = document.createElement('textarea');
  ta.className = 'ai-ta';
  ta.placeholder = '问点什么…（Enter 发送 / Shift+Enter 换行）';
  ta.maxLength = 8000;
  ta.spellcheck = false;
  var sendBtn = button('发送', 'ai-send');
  inputRow.append(photoBtn, micBtn, ta, sendBtn);

  var stat = div('ai-stat');
  var statTxt = div('grow', '');
  var clearBtn = button('清空', 'ai-mini', '清空本机对话记录');
  stat.append(statTxt, clearBtn);
  // v3.8 用量行：本会话 token、上一轮速度、DeepSeek 余额
  var usageRow = div('ai-usage');
  var usageTxt = div('u', '本会话 ↑0 ↓0 tokens · 本轮 — tok/s');
  var balTxt = div('bal', '余额 --');
  var usageSep = div('sep', ' · ');
  balTxt.title = '点击刷新余额';
  usageRow.append(usageTxt, usageSep, balTxt);
  foot.append(attach, inputRow, stat, usageRow);

  card.append(head, cfgBox, msgs, foot);
  root.append(shade, card);

  // ── 叠加层通用（会话列表 / 相册 / 聊天室 / 探测） ──
  function mkOv(t) {
    var ov = div('ai-ov');
    var bar = div('ai-ovbar');
    var tit = div('ai-ovtit', t);
    var x = button('✕', 'ai-mini', '关闭');
    bar.append(tit, x);
    var body = div('ai-ovbody');
    ov.append(bar, body);
    card.append(ov);
    ov.hide = function () { ov.classList.remove('on'); };
    x.onclick = function () { ov.hide(); };
    return { el: ov, bar: bar, tit: tit, body: body };
  }

  // ── 媒体库：IndexedDB 存原图/原视频，不压缩 ──
  var DB_NAME = 'fh_media', DB_STORE = 'media', dbP = null;
  function dbOpen() {
    if (dbP) return dbP;
    dbP = new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('当前浏览器没有 IndexedDB')); return; }
      var r;
      try { r = indexedDB.open(DB_NAME, 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains(DB_STORE)) {
          try { d.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true }); } catch (e) {}
        }
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error || new Error('IndexedDB 打不开')); };
    });
    return dbP;
  }
  function dbAdd(rec) {
    return dbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(DB_STORE, 'readwrite');
        var q = t.objectStore(DB_STORE).add(rec);
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error || new Error('写入失败')); };
      });
    });
  }
  function dbAll() {
    return dbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(DB_STORE, 'readonly');
        var q = t.objectStore(DB_STORE).getAll();
        q.onsuccess = function () { res(q.result || []); };
        q.onerror = function () { rej(q.error || new Error('读取失败')); };
      });
    });
  }
  function dbDel(id) {
    return dbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(DB_STORE, 'readwrite');
        var q = t.objectStore(DB_STORE).delete(id);
        q.onsuccess = function () { res(1); };
        q.onerror = function () { rej(q.error || new Error('删除失败')); };
      });
    });
  }
  function saveMedia(blob, nameImage, extra) {
    if (!blob) return Promise.resolve(null);
    return dbAdd({
      name: nameImage || 'media',
      type: blob.type || 'application/octet-stream',
      size: blob.size,
      at: Date.now(),
      owner: ownerTag,
      kind: /^video\//i.test(blob.type || '') ? 'video' : 'image',
      blob: blob,
      remotePath: (extra && extra.remotePath) || ''
    }).catch(function (e) { cfgMsg.textContent = '存相册失败：' + (e && e.message ? e.message : e); return null; });
  }
  function dbGet(id) {
    return dbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(DB_STORE, 'readonly');
        var q = t.objectStore(DB_STORE).get(id);
        q.onsuccess = function () { res(q.result || null); };
        q.onerror = function () { rej(q.error || new Error('读取失败')); };
      });
    });
  }
  function dbPut(rec) {
    return dbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(DB_STORE, 'readwrite');
        var q = t.objectStore(DB_STORE).put(rec);
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error || new Error('写入失败')); };
      });
    });
  }

  // ── GitLab 仓库 REST（聊天室 / 相册远端 / 探测共用，全前端） ──
  function b64utf8(s) {
    var bytes = new TextEncoder().encode(String(s));
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function gitFileUrl(p, raw) {
    var base = GIT_HOST + '/api/v4/projects/' + encodeURIComponent(GIT_PROJ) +
      '/repository/files/' + encodeURIComponent(p);
    return raw ? base + '/raw?ref=' + encodeURIComponent(GIT_BRANCH) : base;
  }
  function gitTreeUrl(p) {
    return GIT_HOST + '/api/v4/projects/' + encodeURIComponent(GIT_PROJ) +
      '/repository/tree?ref=' + encodeURIComponent(GIT_BRANCH) + '&per_page=100' +
      (p ? '&path=' + encodeURIComponent(p) : '');
  }
  // method → { ok, status, text, blob, ms }
  function gitReq(method, url, body, binary, noToken) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      var x = new XMLHttpRequest();
      try {
        x.open(method, url, true);
        if (binary) x.responseType = 'blob';
        if (!noToken && cfg.gitToken) x.setRequestHeader('PRIVATE-TOKEN', cfg.gitToken.trim());
        if (body != null) x.setRequestHeader('Content-Type', 'application/json');
        x.timeout = 45000;
      } catch (e) {
        resolve({ ok: false, status: 0, text: String(e && e.message || e), blob: null, ms: 0 });
        return;
      }
      x.onload = function () {
        resolve({
          ok: x.status >= 200 && x.status < 300,
          status: x.status,
          text: binary ? '' : String(x.responseText || ''),
          blob: binary ? x.response : null,
          ms: Date.now() - t0
        });
      };
      x.onerror = function () { resolve({ ok: false, status: 0, text: '网络/CORS 错误', blob: null, ms: Date.now() - t0 }); };
      x.ontimeout = function () { resolve({ ok: false, status: 0, text: '超时', blob: null, ms: Date.now() - t0 }); };
      try { x.send(body == null ? null : body); } catch (e) {
        resolve({ ok: false, status: 0, text: String(e && e.message || e), blob: null, ms: 0 });
      }
    });
  }
  function gitTree(p) {
    return gitReq('GET', gitTreeUrl(p)).then(function (r) {
      if (!r.ok) return { ok: false, status: r.status, text: r.text, items: [], ms: r.ms };
      var items = [];
      try {
        var j = JSON.parse(r.text);
        if (Object.prototype.toString.call(j) === '[object Array]') {
          j.forEach(function (it) { if (it && it.type === 'blob' && it.path) items.push(it.path); });
        }
      } catch (e) {}
      return { ok: true, status: r.status, text: '', items: items, ms: r.ms };
    });
  }
  function gitRaw(p) {
    return gitReq('GET', gitFileUrl(p, true), null, true).then(function (r) {
      if (r.ok && r.blob) return r.blob.text();
      return '';
    }).catch(function () { return ''; });
  }
  function gitPut(p, text) {
    return gitReq('POST', gitFileUrl(p), JSON.stringify({
      branch: GIT_BRANCH,
      content: b64utf8(text),
      encoding: 'base64',
      commit_message: 'room message ' + p.replace(/^message\//, '')
    }));
  }

  function fmtAt(ms) {
    var d = new Date(ms || Date.now());
    return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  // ── 会话（按 owner 隔离） ──
  function refreshSessions() {
    sessions.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    saveSessions();
  }
  function sessionById(id) {
    for (var i = 0; i < sessions.length; i++) if (sessions[i].id === id) return sessions[i];
    return null;
  }
  function newSession() {
    if (busy) stop();
    saveHistory();
    var id = 's' + Date.now() + '-' + rand4();
    sid = id;
    sessions.unshift({ id: id, title: '新对话', at: Date.now(), owner: ownerTag });
    save(K_SID, sid);
    saveSessions();
    history = [];
    clearPending(true);
    renderHistory();
    setStat();
    closeOverlays();
    try { ta.focus(); } catch (e) {}
  }
  function switchSession(id) {
    if (id === sid) { closeOverlays(); return; }
    if (busy) stop();
    saveHistory();
    sid = id;
    save(K_SID, sid);
    history = readHist(id);
    clearPending(true);
    renderHistory();
    setStat();
    closeOverlays();
  }
  function deleteSession(id) {
    var s = sessionById(id);
    if (!s) return;
    if (!confirm('删除对话「' + (s.title || '新对话') + '」？')) return;
    if (busy && id === sid) stop();
    try { localStorage.removeItem(K_HIST_P + id); } catch (e) {}
    sessions = sessions.filter(function (x) { return x.id !== id; });
    saveSessions();
    if (sid === id) {
      var rest = sessions.filter(function (x) { return x.owner === ownerTag; });
      sid = rest.length ? rest[0].id : '';
      save(K_SID, sid);
      history = sid ? readHist(sid) : [];
      renderHistory();
      setStat();
    }
    renderSessList();
  }

  // ── 覆盖层栈 ──
  var overlayStack = [];
  function regOverlay(o) {
    var orig = o.el.hide;
    o.el.hide = function () {
      orig();
      var i = overlayStack.indexOf(o);
      if (i >= 0) overlayStack.splice(i, 1);
      if (o.onHide) o.onHide();
    };
    // 覆盖层自带的 ✕ 绑的是旧 hide，换成本地这份
    if (o.bar && o.bar.lastChild) o.bar.lastChild.onclick = function () { o.el.hide(); };
    return o;
  }
  function closeOverlays() {
    while (overlayStack.length) overlayStack[overlayStack.length - 1].el.hide();
  }

  // ── 会话列表 ──
  var sessOv = null, sessList = null;
  function renderSessList() {
    if (!sessList) return;
    sessList.innerHTML = '';
    var mine = sessions.filter(function (s) { return s.owner === ownerTag; });
    if (!mine.length) {
      sessList.append(div('ai-hint', '还没有对话，点右上角 ＋ 新建。'));
      return;
    }
    mine.forEach(function (s) {
      var it = div('ai-item' + (s.id === sid ? ' on' : ''));
      var t = div('t', s.title || '新对话');
      var d = div('d', fmtAt(s.at));
      var x = button('✕', 'ai-x', '删除');
      x.onclick = function (e) { e.stopPropagation(); deleteSession(s.id); };
      it.append(t, d, x);
      it.onclick = function () { switchSession(s.id); };
      sessList.append(it);
    });
  }
  function openSessions() {
    if (!sessOv) {
      sessOv = regOverlay(mkOv('对话列表'));
      sessList = div('');
      sessOv.body.append(sessList);
      var add = button('＋ 新建对话', 'ai-mini');
      add.style.cssText = 'width:100%;height:34px;margin-top:4px';
      add.onclick = function () { newSession(); };
      sessOv.body.append(add);
    }
    sessOv.el.classList.add('on');
    if (overlayStack.indexOf(sessOv) < 0) overlayStack.push(sessOv);
    renderSessList();
  }

  // ── 相册（IndexedDB 原图，按 owner 隔离） ──
  var galOv = null, galBody = null, galUrls = [];
  function revokeGalUrls() {
    galUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    galUrls = [];
  }
  function openAlbum() {
    if (!galOv) {
      galOv = regOverlay(mkOv('相册（原图，仅本机）'));
      galOv.onHide = revokeGalUrls;
      galBody = galOv.body;
    }
    galOv.el.classList.add('on');
    if (overlayStack.indexOf(galOv) < 0) overlayStack.push(galOv);
    renderAlbum();
  }
  function renderAlbum() {
    if (!galBody) return;
    revokeGalUrls();
    galBody.innerHTML = '';
    var loading = div('ai-hint', '读取相册…');
    galBody.append(loading);
    dbAll().then(function (all) {
      if (!galBody) return;
      var mine = all.filter(function (m) {
        return m && m.blob && (m.owner === ownerTag || !m.owner || m.owner === 'local');
      }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
      galBody.innerHTML = '';
      if (!mine.length) {
        galBody.append(div('ai-hint', '相册还是空的：点 📷 拍照后会自动存到本机相册（原图，不压缩）。'));
        return;
      }
      var grid = div('ai-gal');
      mine.forEach(function (m) {
        var c = div('c');
        var url = '';
        try { url = URL.createObjectURL(m.blob); } catch (e) {}
        if (m.kind === 'video') {
          var v = document.createElement('video');
          v.muted = true;
          v.playsInline = true;
          v.preload = 'metadata';
          v.src = url;
          c.append(v);
        } else {
          var im = document.createElement('img');
          im.loading = 'lazy';
          im.alt = m.name || '照片';
          im.src = url;
          c.append(im);
        }
        galUrls.push(url);
        c.append(div('k', fmtAt(m.at)));
        c.onclick = function () { openViewer(m); };
        grid.append(c);
      });
      galBody.append(grid);
      galBody.append(div('ai-hint', '共 ' + mine.length + ' 张 · 点开可查看/下载/删除（原图存在本机 IndexedDB）'));
    }).catch(function (e) {
      if (galBody) galBody.innerHTML = '';
      if (galBody) galBody.append(div('ai-hint', '相册打不开：' + (e && e.message ? e.message : e)));
    });
  }
  var viewer = null;
  var zoomOv = null, zoomCloseFn = null;
  // ── v3.5 图片缩放：滚轮 / 双指缩放，拖动平移，双击还原 ──
  function openZoom(src, name) {
    if (!src) return;
    if (zoomOv) { try { zoomOv.remove(); } catch (e) {} zoomOv = null; }
    var ov = div('ai-zoom');
    var bar = div('zbar');
    var tit = div('ztit', name || '图片');
    var pct = div('zpct', '100%');
    var out = button('－', '', '缩小');
    var inn = button('＋', '', '放大');
    var one = button('1:1', '', '实际大小');
    var fit = button('适合', '', '适合窗口');
    var cl = button('✕', '', '关闭（Esc）');
    bar.append(tit, pct, out, one, fit, inn, cl);
    var stage = div('zstage');
    var im = document.createElement('img');
    im.src = src;
    im.alt = name || '图片';
    stage.append(im);
    stage.append(div('zhint', '滚轮 / 双指缩放 · 拖动平移 · 双击还原'));
    ov.append(bar, stage);
    document.body.append(ov);
    zoomOv = ov;

    var s = 1, x = 0, y = 0;
    function clampS(v) { return Math.min(8, Math.max(0.4, v)); }
    function paint() {
      im.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
      pct.textContent = Math.round(s * 100) + '%';
    }
    function zoomAt(ns, cx, cy) {
      ns = clampS(ns);
      if (!(ns > 0)) return;
      var r = stage.getBoundingClientRect();
      var px = (typeof cx === 'number') ? cx - r.left - r.width / 2 : 0;
      var py = (typeof cy === 'number') ? cy - r.top - r.height / 2 : 0;
      x = px - (px - x) * (ns / s);
      y = py - (py - y) * (ns / s);
      s = ns;
      paint();
    }
    function reset() { s = 1; x = 0; y = 0; paint(); }
    function closeZoom() {
      try { ov.remove(); } catch (e) {}
      if (zoomOv === ov) zoomOv = null;
      if (zoomCloseFn === closeZoom) zoomCloseFn = null;
    }
    zoomCloseFn = closeZoom;
    out.onclick = function () { zoomAt(s / 1.25); };
    inn.onclick = function () { zoomAt(s * 1.25); };
    one.onclick = reset;
    fit.onclick = reset;
    cl.onclick = closeZoom;
    ov.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoomAt(s * (e.deltaY < 0 ? 1.16 : 1 / 1.16), e.clientX, e.clientY);
    }, { passive: false });

    var pts = {}, lastDist = 0, lastMid = null;
    function count() { return Object.keys(pts).length; }
    stage.addEventListener('pointerdown', function (e) {
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (count() === 2) {
        var k = Object.keys(pts);
        lastDist = Math.hypot(pts[k[0]].x - pts[k[1]].x, pts[k[0]].y - pts[k[1]].y) || 0;
        lastMid = { x: (pts[k[0]].x + pts[k[1]].x) / 2, y: (pts[k[0]].y + pts[k[1]].y) / 2 };
      }
      stage.classList.add('drag');
    });
    stage.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      var prev = pts[e.pointerId];
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (count() >= 2) {
        var k = Object.keys(pts);
        var d = Math.hypot(pts[k[0]].x - pts[k[1]].x, pts[k[0]].y - pts[k[1]].y) || 0;
        var mid = { x: (pts[k[0]].x + pts[k[1]].x) / 2, y: (pts[k[0]].y + pts[k[1]].y) / 2 };
        if (lastDist > 0 && d > 0) zoomAt(s * (d / lastDist), mid.x, mid.y);
        if (lastMid) { x += mid.x - lastMid.x; y += mid.y - lastMid.y; paint(); }
        lastDist = d;
        lastMid = mid;
        return;
      }
      x += e.clientX - prev.x;
      y += e.clientY - prev.y;
      paint();
    });
    function up(e) {
      delete pts[e.pointerId];
      if (count() < 2) { lastDist = 0; lastMid = null; }
      if (!count()) stage.classList.remove('drag');
    }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse' && e.buttons === 0) up(e);
    });
    stage.addEventListener('dblclick', function (e) {
      if (s > 1.05) reset();
      else zoomAt(2.5, e.clientX, e.clientY);
    });
  }
  function openViewer(rec) {
    if (!viewer) {
      viewer = div('ai-view');
      var v = div('v');
      var bar = div('b');
      var dl = button('下载', '', '保存到本机');
      var zo = button('缩放', '', '放大 / 缩小（滚轮、双指）');
      var del = button('删除', '', '从相册删除');
      var cl = button('关闭', '', '');
      bar.append(dl, zo, del, cl);
      viewer.append(v, bar);
      card.append(viewer);
      viewer._v = v;
      cl.onclick = function () { viewer.classList.remove('on'); };
    }
    viewer._rec = rec;
    var v = viewer._v;
    v.innerHTML = '';
    v.className = 'v';
    var url = '';
    try { url = URL.createObjectURL(rec.blob); } catch (e) {}
    if (rec.kind === 'video') {
      var vid = document.createElement('video');
      vid.controls = true;
      vid.autoplay = true;
      vid.playsInline = true;
      vid.src = url;
      v.append(vid);
    } else {
      var im = document.createElement('img');
      im.className = 'v';
      im.alt = rec.name || '照片';
      im.src = url;
      v.append(im);
    }
    viewer.classList.add('on');
    var bar = viewer.querySelector('.b');
    bar.children[1].style.display = rec.kind === 'video' ? 'none' : '';
    bar.children[1].onclick = function () {
      if (rec.kind === 'video') return;
      openZoom(url, rec.name || '照片');
    };
    bar.children[0].onclick = function () {
      try {
        var a = document.createElement('a');
        a.href = url;
        a.download = rec.name || ('photo-' + rec.id + '.jpg');
        document.body.append(a);
        a.click();
        a.remove();
      } catch (e) {}
    };
    bar.children[2].onclick = function () {
      if (!confirm('从相册删除这张？')) return;
      dbDel(rec.id).then(function () {
        viewer.classList.remove('on');
        labelToast('已删除');
        renderAlbum();
      }).catch(function (e) { labelToast('删除失败：' + (e && e.message ? e.message : e)); });
    };
  }
  var toastT = null;
  function labelToast(s) {
    var t = document.getElementById('__ai_toast');
    if (!t) {
      t = div('ai-hint');
      t.id = '__ai_toast';
      t.style.cssText = 'position:absolute;left:50%;bottom:70px;transform:translateX(-50%);z-index:20;' +
        'background:rgba(0,0,0,.78);color:#fff;padding:6px 12px;border-radius:8px;max-width:80%;text-align:center';
      card.append(t);
    }
    t.textContent = s;
    t.style.display = '';
    if (toastT) clearTimeout(toastT);
    toastT = setTimeout(function () { t.style.display = 'none'; }, 1800);
  }

  // ── 聊天室（GitLab 仓库 message/ 目录，所有人共享可见） ──
  var K_ROOM_CACHE = 'fh:ai:roomCache';
  var roomOv = null, roomBody = null, roomRow = null, roomInput = null, roomSend = null;
  var roomTimer = null, roomMsgs = [], roomObj = {}, roomBusy = false;
  function loadRoomCache() {
    try {
      var a = JSON.parse(localStorage.getItem(K_ROOM_CACHE) || '[]');
      if (Object.prototype.toString.call(a) === '[object Array]') {
        return a.filter(function (m) { return m && m.path && typeof m.text === 'string'; });
      }
    } catch (e) {}
    return [];
  }
  function saveRoomCache(a) {
    try { localStorage.setItem(K_ROOM_CACHE, JSON.stringify(a.slice(-200))); } catch (e) {}
  }
  function roomImage(path, img) {
    if (roomObj[path]) { img.src = roomObj[path]; return; }
    gitReq('GET', gitFileUrl(path, true), null, true).then(function (r) {
      if (r.ok && r.blob) {
        try {
          var u = URL.createObjectURL(r.blob);
          roomObj[path] = u;
          img.src = u;
        } catch (e) {}
      }
    });
  }
  function renderRoom() {
    if (!roomBody) return;
    roomBody.innerHTML = '';
    var box = div('ai-room');
    if (!acctRec()) box.append(div('ai-hint', '未登录：可以查看，发言需先在 👤 登录（用户名 + PIN）。'));
    else if (!cfg.gitToken) box.append(div('ai-hint', '未配置上传 Token：可以查看，发言需先在 🔑 保存 GitLab Token。'));
    if (!roomMsgs.length) {
      box.append(div('ai-hint', '聊天室还是空的。发一条，所有人（所有用户）都能看到。'));
    }
    roomMsgs.forEach(function (m) {
      var mine = m.owner && m.owner === ownerTag;
      var line = div('ai-line' + (mine ? ' me' : ''));
      var n = div('n', (m.nick || '匿名') + ' · ' + fmtAt(m.at));
      var b = div('m');
      mdInto(b, m.text || '');
      if (m.image) {
        var im = document.createElement('img');
        im.alt = '图片';
        im.loading = 'lazy';
        im.onclick = function () { if (im.src) openZoom(im.src, '聊天室图片'); };
        roomImage(m.image, im);
        b.append(im);
      }
      var t = div('t', '');
      line.append(n, b, t);
      box.append(line);
    });
    roomBody.append(box);
    roomBody.scrollTop = roomBody.scrollHeight;
  }
  function mergeRoom(list) {
    var by = {};
    roomMsgs.concat(list).forEach(function (m) { if (m && m.path) by[m.path] = m; });
    roomMsgs = Object.keys(by).map(function (k) { return by[k]; });
    roomMsgs.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    roomMsgs = roomMsgs.slice(-200);
    saveRoomCache(roomMsgs);
  }
  function refreshRoom(silent) {
    if (roomBusy) return;
    roomBusy = true;
    var tit = roomOv ? roomOv.tit : null;
    if (tit && !silent) tit.textContent = '聊天室 · 同步中…';
    gitTree(ROOM_DIR).then(function (r) {
      if (!r.ok) {
        if (tit) tit.textContent = '聊天室 · ' + (r.status === 404 ? '仓库里还没有 message/ 目录，发一条就会创建' : ('读取失败 ' + r.status));
        return;
      }
      var known = {};
      roomMsgs.forEach(function (m) { known[m.path] = 1; });
      var news = r.items.filter(function (p) { return /\.json$/i.test(p) && !known[p]; });
      if (tit) tit.textContent = '聊天室 · ' + roomMsgs.length + ' 条' + (news.length ? ' · 新增 ' + news.length : '');
      if (!news.length) return;
      var jobs = news.slice(-40).map(function (p) {
        return gitRaw(p).then(function (txt) {
          if (!txt) return null;
          try {
            var j = JSON.parse(txt);
            if (!j || typeof j.text !== 'string') return null;
            return {
              path: p,
              at: Number(j.at) || 0,
              nick: String(j.nick || '匿名').slice(0, 20),
              owner: String(j.owner || ''),
              text: String(j.text || '').slice(0, 2000),
              image: typeof j.image === 'string' ? j.image : ''
            };
          } catch (e) { return null; }
        });
      });
      Promise.all(jobs).then(function (arr) {
        var got = arr.filter(Boolean);
        if (got.length) { mergeRoom(got); renderRoom(); }
      });
    }).then(function () {
      roomBusy = false;
    });
  }
  function sendRoom() {
    if (!roomInput || roomBusy) return;
    var text = String(roomInput.value || '').trim();
    if (!text) { try { roomInput.focus(); } catch (e) {} return; }
    if (!acctRec()) {
      roomOv.tit.textContent = '聊天室需要先登录账号（点 👤 用户名 + PIN）';
      return;
    }
    if (!cfg.gitToken) {
      roomOv.tit.textContent = '聊天室需要先在 🔑 里保存「上传 Token」';
      return;
    }
    // 昵称固定用登录用户名（需求 7），不再让用户单独填
    var nick = String(acctRec().user || '').trim().slice(0, 20);
    roomBusy = true;
    roomSend.disabled = true;
    roomSend.textContent = '发送中';
    var p = ROOM_DIR + '/' + stamp() + '-' + rand4() + '.json';
    var rec = { at: Date.now(), nick: nick, owner: ownerTag, text: text.slice(0, 2000), image: '' };
    gitPut(p, JSON.stringify(rec)).then(function (r) {
      roomBusy = false;
      roomSend.disabled = false;
      roomSend.textContent = '发送';
      if (!r.ok) {
        var detail = '';
        try {
          var j = JSON.parse(r.text || '{}');
          detail = j.message || (j.error && j.error.message) || '';
        } catch (e) {}
        roomOv.tit.textContent = '发送失败（' + r.status + '）' + (detail ? ' ' + detail : '');
        return;
      }
      roomInput.value = '';
      rec.path = p;
      mergeRoom([rec]);
      renderRoom();
      refreshRoom(true);
    });
  }
  // ── v3.7 聊天室浮窗：独立于卡片，可拖拽 / 缩放 / 记住位置 ──
  var roomGrip = null, roomRect = null;

  function roomWinDefault() {
    var w = Math.max(300, Math.min(620, innerWidth - 28));
    var h = Math.max(240, Math.min(660, innerHeight - 70));
    return {
      l: Math.round((innerWidth - w) / 2),
      t: Math.round((innerHeight - h) / 2),
      w: w, h: h
    };
  }
  function roomWinClamp(r) {
    r = r || {};
    var maxW = Math.max(300, innerWidth - 8);
    var maxH = Math.max(240, innerHeight - 8);
    var w = Math.min(Math.max(300, +r.w || 0), maxW);
    var h = Math.min(Math.max(240, +r.h || 0), maxH);
    var l = Math.min(Math.max(0, +r.l || 0), Math.max(0, innerWidth - w));
    var t = Math.min(Math.max(0, +r.t || 0), Math.max(0, innerHeight - h));
    return { l: l, t: t, w: w, h: h };
  }
  function roomWinApply(r) {
    roomRect = roomWinClamp(r);
    var s = roomOv.el.style;
    s.left = roomRect.l + 'px';
    s.top = roomRect.t + 'px';
    s.right = 'auto';
    s.bottom = 'auto';
    s.width = roomRect.w + 'px';
    s.height = roomRect.h + 'px';
  }
  function roomWinSave() {
    if (roomRect) save(K_ROOM_RECT, JSON.stringify(roomRect));
  }
  function roomWinInit() {
    if (roomGrip) return;
    roomOv.el.classList.add('ai-win');
    // 移出卡片，挂到 #__ai 根节点：不受卡片布局/全屏影响
    root.appendChild(roomOv.el);
    roomGrip = div('ai-roomgrip');
    roomGrip.title = '拖动调整大小';
    roomOv.el.append(roomGrip);

    var j = null;
    try { j = JSON.parse(read(K_ROOM_RECT, '') || 'null'); } catch (e) {}
    roomWinApply(j || roomWinDefault());

    var bar = roomOv.bar, ds = null;
    bar.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('button,input,textarea,select,a')) return;
      var r = roomOv.el.getBoundingClientRect();
      ds = { x: e.clientX, y: e.clientY, l: r.left, t: r.top };
      try { bar.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    bar.addEventListener('pointermove', function (e) {
      if (!ds) return;
      roomWinApply({
        l: ds.l + e.clientX - ds.x,
        t: ds.t + e.clientY - ds.y,
        w: roomRect.w, h: roomRect.h
      });
    });
    function dragEnd() {
      if (!ds) return;
      ds = null;
      roomWinSave();
    }
    bar.addEventListener('pointerup', dragEnd);
    bar.addEventListener('pointercancel', dragEnd);
    bar.addEventListener('dblclick', function (e) {
      if (e.target && e.target.closest && e.target.closest('button')) return;
      roomWinApply(roomWinDefault());
      roomWinSave();
    });

    var rs = null;
    roomGrip.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var r = roomOv.el.getBoundingClientRect();
      rs = { x: e.clientX, y: e.clientY, l: r.left, t: r.top, w: r.width, h: r.height };
      try { roomGrip.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
      e.stopPropagation();
    });
    roomGrip.addEventListener('pointermove', function (e) {
      if (!rs) return;
      roomWinApply({
        l: rs.l, t: rs.t,
        w: rs.w + e.clientX - rs.x,
        h: rs.h + e.clientY - rs.y
      });
    });
    function sizeEnd() {
      if (!rs) return;
      rs = null;
      roomWinSave();
    }
    roomGrip.addEventListener('pointerup', sizeEnd);
    roomGrip.addEventListener('pointercancel', sizeEnd);

    window.addEventListener('resize', function () {
      if (!root.isConnected) return;
      if (roomRect && roomOv.el.classList.contains('on')) roomWinApply(roomRect);
    });
  }

  function openRoom() {
    if (!roomOv) {
      roomOv = regOverlay(mkOv('聊天室（共享）'));
      roomOv.onHide = function () {
        if (roomTimer) { clearInterval(roomTimer); roomTimer = null; }
        if (root.classList.contains('ai-full')) toggleFull(false);
      };
      var bar = roomOv.bar;
      var ref = button('刷新', 'ai-mini', '重新拉取');
      ref.onclick = function () { refreshRoom(); };
      // 聊天室也能全屏（复用 AI 自身的 ⛶，和头栏图标同步）
      var roomFull = button('⛶', 'ai-mini', '全屏');
      roomFull.onclick = function (e) { e.stopPropagation(); toggleFull(); };
      bar.insertBefore(ref, bar.lastChild);
      bar.insertBefore(roomFull, ref);
      fullBtns.push(roomFull);
      roomBody = roomOv.body;
      roomRow = div('ai-roomrow');
      roomInput = document.createElement('input');
      roomInput.type = 'text';
      roomInput.placeholder = '发到聊天室（所有人可见）';
      roomInput.maxLength = 2000;
      roomSend = button('发送', '');
      roomRow.append(roomInput, roomSend);
      roomOv.el.append(roomRow);
      roomSend.onclick = function (e) { e.stopPropagation(); sendRoom(); };
      roomInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendRoom(); }
      });
      roomSend.disabled = true;
      roomSend.style.opacity = '.5';
      roomWinInit();
      syncFullBtns();
    }
    // 昵称固定用登录用户名（需求 7）：没登录 / 没 Token 时禁用输入
    var acctNow = acctRec();
    var canSend = !!(acctNow && cfg.gitToken);
    roomInput.disabled = !canSend;
    roomSend.disabled = !canSend;
    roomSend.style.opacity = canSend ? '' : '.5';
    roomInput.placeholder = !acctNow
      ? '请先在 👤 登录（用户名 + PIN）'
      : (!cfg.gitToken ? '请先在 🔑 保存上传 Token' : '发到聊天室（所有人可见）');
    roomOv.el.classList.add('on');
    if (roomGrip) roomWinApply(roomRect || roomWinDefault());
    if (overlayStack.indexOf(roomOv) < 0) overlayStack.push(roomOv);
    roomMsgs = loadRoomCache();
    renderRoom();
    refreshRoom();
    if (!roomTimer) roomTimer = setInterval(function () { refreshRoom(true); }, ROOM_POLL);
  }

  // ── 探测 / 缓存 ──
  var probeOv = null, probeLog = null;
  function plog(s) {
    if (!probeLog) return;
    var line = div('', '[' + new Date().toLocaleTimeString() + '] ' + s);
    line.style.cssText = 'font-size:10.5px;padding:3px 0;border-bottom:1px solid var(--line);word-break:break-all';
    probeLog.append(line);
    probeLog.scrollTop = probeLog.scrollHeight;
  }
  function probeApi() {
    var b = String(cfg.base || '').trim().replace(/\/+$/, '').replace(/\/(chat\/completions|responses|models)$/i, '');
    if (!/\/(v\d+)$/i.test(b)) b += '/v1';
    var url = b + '/models';
    plog('探测 API：' + url + (cfg.key ? '（带 Key）' : '（无 Key）'));
    var t0 = Date.now();
    gitReq('GET', url, null, false, true).then(function (r) {
      plog('→ HTTP ' + r.status + ' · ' + (Date.now() - t0) + 'ms');
      if (r.ok) {
        var n = 0;
        try {
          var j = JSON.parse(r.text || '{}');
          var arr = j.data || j.models || (Object.prototype.toString.call(j) === '[object Array]' ? j : []);
          n = arr.length || 0;
        } catch (e) {}
        plog('✓ 可用，模型 ' + n + ' 个（点 🔑 → 扫描 可载入列表）');
      } else {
        plog('✗ ' + String(r.text || '').slice(0, 160));
      }
    });
  }
  function probeGit() {
    if (!cfg.gitToken) { plog('探测 GitLab：未填 Token，跳过'); return; }
    var t0 = Date.now();
    plog('探测 GitLab：' + GIT_PROJ);
    gitReq('GET', GIT_HOST + '/api/v4/user').then(function (u) {
      plog('→ Token 用户：' + (u.ok ? (JSON.parse(u.text || '{}').username || '?') : ('HTTP ' + u.status)));
      return gitReq('GET', GIT_HOST + '/api/v4/projects/' + encodeURIComponent(GIT_PROJ));
    }).then(function (r) {
      plog('→ 仓库 HTTP ' + r.status + ' · ' + (Date.now() - t0) + 'ms');
      if (r.ok) {
        var j = {};
        try { j = JSON.parse(r.text || '{}'); } catch (e) {}
        plog('✓ ' + (j.path_with_namespace || GIT_PROJ) + ' · 可见性 ' + (j.visibility || '?') +
          ' · 默认分支 ' + (j.default_branch || '?') + ' · ' + (j.repository_size || 0) + ' KB');
      } else plog('✗ ' + String(r.text || '').slice(0, 160));
    });
  }
  function probeRoom() {
    plog('探测聊天室目录 ' + ROOM_DIR + '/ …');
    gitTree(ROOM_DIR).then(function (r) {
      if (!r.ok) { plog('→ HTTP ' + r.status + (r.status === 404 ? '（目录还没创建，发第一条消息会自动建）' : '')); return; }
      var js = r.items.filter(function (p) { return /\.json$/i.test(p); });
      plog('✓ ' + r.ms + 'ms · ' + js.length + ' 条消息（列表上限 100）');
    });
    gitTree(MEDIA_DIR).then(function (r) {
      if (!r.ok) { plog('媒体目录 → HTTP ' + r.status); return; }
      plog('✓ 媒体目录 media/：' + r.items.length + ' 项（含用户子目录，列表上限 100）');
    });
  }
  function probeCache() {
    var total = 0, keys = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('fh:') === 0) { total += (localStorage.getItem(k) || '').length; keys++; }
      }
    } catch (e) {}
    plog('本地缓存：' + keys + ' 个 fh:* 键 · 约 ' + (total / 1024).toFixed(1) + ' KB（聊天室 ' +
      loadRoomCache().length + ' 条）');
    dbAll().then(function (a) {
      var n = a.filter(function (m) { return m && m.owner === ownerTag; }).length;
      plog('相册（IndexedDB）：本用户 ' + n + ' 个原件，总 ' + a.length + ' 个');
    }).catch(function (e) { plog('相册读取失败：' + (e && e.message ? e.message : e)); });
  }
  function openProbe() {
    if (!probeOv) {
      probeOv = regOverlay(mkOv('探测 / 缓存（纯前端）'));
      var bar = probeOv.bar;
      var clr = button('清缓存', 'ai-mini', '清空聊天室缓存（不影响相册）');
      clr.onclick = function () {
        try { localStorage.removeItem(K_ROOM_CACHE); } catch (e) {}
        roomMsgs = [];
        plog('已清空聊天室本地缓存');
      };
      bar.insertBefore(clr, bar.lastChild);
      var row = div('ai-row');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:0 0 8px';
      [['API 地址', probeApi], ['GitLab', probeGit], ['聊天室目录', probeRoom], ['本地缓存', probeCache]].forEach(function (b) {
        var x = button(b[0], 'ai-mini');
        x.onclick = function () { b[1](); };
        row.append(x);
      });
      probeOv.body.append(row);
      probeLog = div('');
      probeOv.body.append(probeLog);
      plog('全部探测都在本机浏览器里发请求（不经过任何自建服务器）。');
    }
    probeOv.el.classList.add('on');
    if (overlayStack.indexOf(probeOv) < 0) overlayStack.push(probeOv);
  }

  var busy = false;
  var xhr = null;
  var pendingImages = [];       // v3.5：多图附件（每张独立状态 / 上传）
  var photoBusy = false;
  var photoQueue = [];
  var imgSeq = 0;
  var closed = false;
  var camStop = null;

  var photoIn = document.createElement('input');
  photoIn.type = 'file';
  photoIn.accept = 'image/*';
  photoIn.multiple = true;
  try { photoIn.removeAttribute('capture'); } catch (e) {}
  photoIn.style.display = 'none';

  function isLight() {
    if (cfg.theme === 'light') return true;
    if (cfg.theme === 'dark') return false;
    var fh = document.getElementById('__fh');
    return !!(fh && fh.classList.contains('fh-light'));
  }
  function applyTheme() {
    root.classList.toggle('ai-light', isLight());
    themeSel.value = cfg.theme;
    themeBtn.title = '主题：' + ({ auto: '自动', dark: '深色', light: '浅色' }[cfg.theme] || '自动');
  }

  function openCfg(force) {
    var on = force === true ? true : (force === false ? false : !cfgBox.classList.contains('on'));
    cfgBox.classList.toggle('on', on);
    if (on && !keyField.get()) {
      keyField.begin();
      setTimeout(function () { keyField.focus(); }, 60);
    } else if (!on) {
      keyField.cancel();
      gitField.cancel();
    }
  }

  function setDot() {
    dot.classList.toggle('on', !!cfg.key);
    dot.title = cfg.key ? 'API Key 已配置 · 点开设置' : '未配置 API Key · 点开设置';
  }

  // ── v3.8 用量 / 速率 / 余额 ──
  var K_USAGE_TIP = '本会话累计输入 / 输出 token；输入按每轮上下文重新计费，所以会大于字数。';
  var balanceState = { loading: false, text: '--', title: '点击刷新 DeepSeek 余额', at: 0 };

  function num0(v) {
    v = Number(v);
    return isFinite(v) && v > 0 ? Math.round(v) : 0;
  }
  function fmtTok(n) {
    n = num0(n);
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }
  function readUsage(id) {
    var o = { p: 0, c: 0, n: 0, rate: 0, lastP: 0, lastC: 0, at: 0 };
    if (!id) return o;
    try {
      var j = JSON.parse(read(K_USE + id, '{}'));
      if (j && typeof j === 'object') {
        o.p = num0(j.p); o.c = num0(j.c); o.n = num0(j.n);
        o.rate = Number(j.rate) > 0 ? Number(j.rate) : 0;
        o.lastP = num0(j.lastP); o.lastC = num0(j.lastC);
        o.at = num0(j.at);
      }
    } catch (e) {}
    return o;
  }
  function renderUsage() {
    if (!usageTxt) return;
    var u = readUsage(sid);
    var txt = '本会话 ↑' + fmtTok(u.p) + ' ↓' + fmtTok(u.c) + ' tokens · 本轮 ' +
      (u.rate > 0 ? Math.round(u.rate) + ' tok/s' : '—');
    usageTxt.textContent = txt;
    usageTxt.title = K_USAGE_TIP;
    balTxt.textContent = '余额 ' + (balanceState.text || '--');
    balTxt.title = balanceState.title || '点击刷新 DeepSeek 余额';
    balTxt.classList.toggle('loading', !!balanceState.loading);
  }
  function recordUsage(u, startedAt, firstAt, endedAt, id) {
    if (!u) return;
    var p = num0(u.prompt_tokens != null ? u.prompt_tokens : u.input_tokens);
    var c = num0(u.completion_tokens != null ? u.completion_tokens : u.output_tokens);
    if (!p && !c) return;
    id = id || sid;
    if (!id) return;
    var rec = readUsage(id);
    rec.p += p;
    rec.c += c;
    rec.n += 1;
    rec.lastP = p;
    rec.lastC = c;
    rec.at = Date.now();
    var base = firstAt || startedAt;
    if (c > 0 && base && endedAt > base) {
      var sec = (endedAt - base) / 1000;
      if (sec >= 0.05) rec.rate = c / sec;
    }
    try { localStorage.setItem(K_USE + id, JSON.stringify(rec)); } catch (e) {}
    renderUsage();
  }
  function refreshBalance(force) {
    if (!cfg.key) {
      balanceState.text = '--';
      balanceState.title = '未填 API Key；点这里去填';
      renderUsage();
      return;
    }
    if (balanceState.loading) return;
    if (!force && Date.now() - balanceState.at < 60000) return;
    var host = '';
    try { host = new URL(cfg.base).hostname; } catch (e) {}
    if (!/(^|\.)deepseek\.com$/i.test(host)) {
      balanceState.text = '--';
      balanceState.title = '当前 API 地址不是 DeepSeek 官方，无法查询余额';
      balanceState.at = Date.now();
      renderUsage();
      return;
    }
    balanceState.loading = true;
    renderUsage();
    var ctl = null;
    try { ctl = new AbortController(); } catch (e) {}
    var timer = setTimeout(function () { if (ctl) { try { ctl.abort(); } catch (e) {} } }, 12000);
    fetch('https://api.deepseek.com/user/balance', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + String(cfg.key).trim() },
      cache: 'no-store',
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = JSON.parse(t); } catch (e) {}
        return { ok: r.ok, status: r.status, j: j };
      });
    }).then(function (r) {
      clearTimeout(timer);
      balanceState.loading = false;
      balanceState.at = Date.now();
      if (!r.ok || !r.j) {
        balanceState.text = '--';
        balanceState.title = r.status === 401 ? 'API Key 无效（401），无法查询余额'
          : ('余额查询失败（' + (r.status || '网络错误') + '），点此重试');
        renderUsage();
        return;
      }
      if (r.j.is_available === false) {
        balanceState.text = '不可用';
        balanceState.title = '账户余额不可用';
        renderUsage();
        return;
      }
      var arr = r.j.balance_infos || [];
      var b = null;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].currency === 'CNY') { b = arr[i]; break; }
      }
      if (!b && arr.length) b = arr[0];
      if (!b) {
        balanceState.text = '--';
        balanceState.title = '接口未返回余额信息，点此重试';
      } else {
        var cur = String(b.currency || '');
        var sym = cur === 'CNY' ? '¥' : (cur ? cur + ' ' : '');
        balanceState.text = sym + String(b.total_balance == null ? '--' : b.total_balance);
        balanceState.title = '充值余额 ' + sym + String(b.topped_up_balance == null ? '--' : b.topped_up_balance) +
          ' · 赠送余额 ' + sym + String(b.granted_balance == null ? '--' : b.granted_balance) + '（点击刷新）';
      }
      renderUsage();
    }).catch(function () {
      clearTimeout(timer);
      balanceState.loading = false;
      balanceState.at = Date.now();
      balanceState.text = '--';
      balanceState.title = '余额查询失败（网络或跨域限制），点此重试';
      renderUsage();
    });
  }
  balTxt.onclick = function () {
    if (!cfg.key) {
      openCfg(true);
      keyField.begin();
      keyField.focus();
      return;
    }
    refreshBalance(true);
  };

  function setStat() {
    // v3.12：「配置」行在状态栏之前创建，初始化时会先调用到这里
    if (!statTxt) return;
    var m = cfg.model || 'deepseek-flash';
    if (m.length > 22) m = m.slice(0, 21) + '…';
    statTxt.textContent = 'v3.13 · ' + m + ' · ' + (MODE_NAME[cfg.mode] || '对话') +
      ' · 思考 ' + (DEPTH_NAME[cfg.depth] || '高') + ' · 本会话 ' + history.length +
      ' 条 · 共 ' + sessions.filter(function (s) { return s.owner === ownerTag; }).length + ' 个对话';
    badge.textContent = m.length > 18 ? m.slice(0, 17) + '…' : m;
    badge.title = cfg.model + ' · ' + (MODE_NAME[cfg.mode] || '对话');
    renderUsage();
  }

  function scrollBottom() {
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showEmpty() {
    msgs.innerHTML = '';
    empty = div('ai-empty');
    empty.append(div('b', '🤖 DeepSeek V4.1 Flash'));
    empty.append(div('p', cfg.key
      ? '直接提问。Key 只保存在本机，不经过第三方服务器。'
      : (acctRec()
        ? '在上方 🔑 填 API Key，然后直接提问。'
        : '先点 👤 登录（用户名 + PIN），再填 API Key；Key / Token 跟着账号保存。')));
    var chips = div('ai-chips');
    [
      ['总结一段话', '帮我用三句话总结下面这段话：\n'],
      ['解释概念', '请用初中生能听懂的话解释这个概念：\n'],
      ['出填空题', '根据下面的内容，出一道类似的填空题：\n']
    ].forEach(function (c) {
      var b = button(c[0], 'ai-chip');
      b.onclick = function () {
        ta.value = c[1];
        grow();
        ta.focus();
      };
      chips.append(b);
    });
    empty.append(chips);
    msgs.append(empty);
  }

  function copyText(t, done) {
    function fallback() {
      try {
        var x = document.createElement('textarea');
        x.value = t;
        x.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.append(x);
        x.select();
        var ok = document.execCommand('copy');
        x.remove();
        done(ok);
      } catch (e) { done(false); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        navigator.clipboard.writeText(t).then(function () { done(true); }, fallback);
      } catch (e) { fallback(); }
    } else fallback();
  }

  function addBubble(role, text, reasoning) {
    if (empty) {
      if (empty.parentNode) empty.parentNode.removeChild(empty);
      empty = null;
    }
    var wrap = div('ai-msg ' + role);
    var ava = div('ai-ava', role === 'user' ? '你' : '🤖');
    var body = div('ai-body');
    var meta = null;

    var think = null, thinkTxt = null, thinkSum = null;
    if (role === 'assistant') {
      meta = div('ai-meta');
      meta.append(document.createTextNode('ds-41-f'));
      think = document.createElement('details');
      think.className = 'ai-think';
      thinkSum = document.createElement('summary');
      thinkSum.textContent = '思考过程';
      thinkTxt = div('ai-think-txt');
      think.append(thinkSum, thinkTxt);
      if (reasoning) {
        think.style.display = 'block';
        thinkSum.textContent = '思考过程 · ' + reasoning.length + ' 字（点开）';
        thinkTxt.textContent = reasoning;
      }

      var cp = button('复制', 'ai-copy', '复制回答');
      cp.onclick = function () {
        copyText(bubble.dataset.raw || bubble.textContent, function (ok) {
          cp.textContent = ok ? '已复制' : '失败';
          setTimeout(function () { cp.textContent = '复制'; }, 1200);
        });
      };
      meta.append(cp);
    }

    var bubble = div('ai-bubble');
    if (text) {
      if (role === 'assistant') mdInto(bubble, text);
      else bubble.textContent = text;
    }
    if (meta) body.append(meta);
    if (think) body.append(think);
    body.append(bubble);
    wrap.append(ava, body);
    msgs.append(wrap);
    scrollBottom();

    return {
      wrap: wrap,
      bubble: bubble,
      meta: meta,
      think: think,
      thinkTxt: thinkTxt,
      thinkSum: thinkSum
    };
  }

  function setReason(ui, s) {
    if (!s) return;
    if (ui.think.style.display !== 'block') {
      ui.think.style.display = 'block';
      ui.think.open = true;
    }
    ui.thinkTxt.textContent = (ui.thinkTxt.textContent || '') + s;
    ui.thinkSum.textContent = '思考中 · ' + ui.thinkTxt.textContent.length + ' 字';
  }

  function setContent(ui, s) {
    if (!s) return;
    var old = ui.bubble.textContent;
    if (old === '正在思考…' || old === '…') ui.bubble.textContent = '';
    ui.bubble.classList.remove('ai-wait');
    ui.bubble.textContent += s;
    if (ui.think && ui.think.style.display === 'block' && ui.think.open && ui.thinkTxt.textContent) {
      ui.think.open = false;
      ui.thinkSum.textContent = '思考过程 · ' + ui.thinkTxt.textContent.length + ' 字（点开）';
    }
    scrollBottom();
  }

  function saveHistory() {
    history = history.slice(-40);
    var out = history.map(function (m) {
      var o = { role: m.role, content: String(m.content || '').slice(0, 12000) };
      if (m.reasoning) o.reasoning = String(m.reasoning).slice(0, 12000);
      return o;
    });
    // 没有会话就先建一个，再按会话 ID 分开存（不同 Token = 不同用户，互不可见）
    if (!sid) {
      sid = 's' + Date.now() + '-' + rand4();
      save(K_SID, sid);
    }
    try { localStorage.setItem(K_HIST_P + sid, JSON.stringify(out)); } catch (e) {}
    var s = sessionById(sid);
    if (!s) {
      s = { id: sid, owner: ownerTag };
      sessions.unshift(s);
    }
    s.owner = ownerTag;
    s.title = titleOf(history);
    s.at = Date.now();
    refreshSessions();
  }

  function renderHistory() {
    msgs.innerHTML = '';
    empty = null;
    if (!history.length) { showEmpty(); return; }
    history.forEach(function (m) {
      addBubble(m.role, m.content, m.reasoning);
    });
    scrollBottom();
  }

  function grow() {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight || 38, 120) + 'px';
  }

  function setBusy(b) {
    busy = b;
    sendBtn.textContent = b ? '停止' : '发送';
    sendBtn.classList.toggle('stop', b);
  }

  function stop() {
    if (!xhr) return;
    try { xhr.abort(); } catch (e) {}
  }

  function endpoint() {
    var b = String(cfg.base || '').trim().replace(/\/+$/, '');
    if (!b) b = 'https://api.deepseek.com';
    if (cfg.mode === 'responses') {
      if (/\/responses$/i.test(b)) return b;
      if (/\/chat\/completions$/i.test(b)) return b.replace(/\/chat\/completions$/i, '/responses');
      if (/\/v\d+$/i.test(b)) return b + '/responses';
      return b + '/v1/responses';
    }
    if (/\/chat\/completions$/i.test(b)) return b;
    if (/\/responses$/i.test(b)) return b.replace(/\/responses$/i, '/chat/completions');
    return b + '/chat/completions';
  }
  function modelsUrl() {
    var b = String(cfg.base || '').trim().replace(/\/+$/, '').replace(/\/(chat\/completions|responses|models)$/i, '');
    if (!b) b = 'https://api.deepseek.com';
    if (!/\/(v\d+)$/i.test(b)) b += '/v1';
    return b + '/models';
  }

  function apiError(status, raw) {
    var detail = '';
    try {
      var j = JSON.parse(raw);
      detail = (j.error && (j.error.message || j.error.type)) || j.message || '';
    } catch (e) {}
    if (status === 401) return 'API Key 无效或未授权（401）' + (detail ? '：' + detail : '');
    if (status === 402) return '余额不足（402）' + (detail ? '：' + detail : '');
    if (status === 429) return '请求太频繁（429），稍后再试' + (detail ? '：' + detail : '');
    if (status === 400) return '请求参数有误（400）' + (detail ? '：' + detail : '');
    if (status === 0) return '网络请求失败：检查网络/代理，或点 🔑 换 API 地址';
    return '请求失败（' + status + '）' + (detail ? '：' + detail : '');
  }

  function pad2(n) {
    n = String(n);
    return n.length < 2 ? '0' + n : n;
  }
  function stamp() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + '-' +
      pad2(d.getHours()) + '-' + pad2(d.getMinutes()) + '-' + pad2(d.getSeconds());
  }
  function rand4() {
    return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  }
  // v3.8：媒体按登录用户名分目录；未登录放 guest
  function mediaUserDir() {
    var r = acctRec();
    var u = r && r.user ? String(r.user) : '';
    u = u.replace(/[\/\\:*?"<>|\u0000-\u001f]+/g, '_').replace(/^\.+|\.+$/g, '').slice(0, 40);
    return u || 'guest';
  }
  function mediaNewPath(ext) {
    return 'media/' + mediaUserDir() + '/' + stamp() + '-' + rand4() + ext;
  }

  function compressImage(file, maxEdge) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          if (!w || !h) throw new Error('图片尺寸为空');
          var limit = Number(maxEdge) > 0 ? Number(maxEdge) : 2048;
          var scale = Math.min(1, limit / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var c = document.createElement('canvas');
          c.width = cw;
          c.height = ch;
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(img, 0, 0, cw, ch);
          URL.revokeObjectURL(url);
          c.toBlob(function (b) {
            if (b) resolve(b);
            else reject(new Error('图片压缩失败'));
          }, 'image/jpeg', 0.85);
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('图片读取失败'));
      };
      img.src = url;
    });
  }

  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || '')); };
      r.onerror = function () { reject(new Error('图片读取失败')); };
      r.readAsDataURL(blob);
    });
  }

  function attachStateText(item) {
    if (!item) return '';
    if (item.state === 'compress') return '压缩中…';
    if (item.state === 'uploading') return '上传 GitLab ' + (item.remotePath || '') + '…';
    if (item.state === 'uploaded') return '已上传 GitLab：' + (item.remotePath || '');
    if (item.state === 'failed') return '上传失败：' + (item.error || '网络错误') + '（可重试）';
    if (item.state === 'error') return '处理失败：' + (item.error || '图片读取失败');
    if (item.state === 'no-token') return '未配置上传 Token，仅随消息发送';
    if (item.state === 'off') return '已附加（自动上传已关闭）';
    return '已附加（可上传 GitLab）';
  }

  function renderAttach() {
    var list = pendingImages || [];
    gitUpWrap.style.display = cfg.gitToken ? 'flex' : 'none';
    gitUp.checked = !!cfg.autoUpload;
    thumbs.innerHTML = '';
    if (!list.length) {
      attach.classList.remove('on');
      attachTit.textContent = '';
      attachUp.style.display = 'none';
      return;
    }
    attach.classList.add('on');
    var done = 0, running = 0, bad = 0;
    list.forEach(function (item) {
      var cell = div('ai-thumb');
      if (item.dataUrl) {
        var im = document.createElement('img');
        im.src = item.dataUrl;
        im.alt = item.name || '照片';
        im.onclick = function () { openZoom(item.dataUrl, item.name); };
        cell.append(im);
      } else {
        cell.append(div('ph', '⏳'));
      }
      var st = div('s'), txt;
      if (item.state === 'compress') { txt = '压缩中'; running++; }
      else if (item.state === 'uploading') { txt = '上传中'; running++; }
      else if (item.state === 'uploaded') { txt = '✓ 已传'; st.classList.add('ok'); done++; }
      else if (item.state === 'failed' || item.state === 'error') { txt = '! 重试'; st.classList.add('bad'); bad++; }
      else if (item.state === 'no-token') txt = '仅发送';
      else if (item.state === 'off') txt = '未上传';
      else txt = '就绪';
      st.textContent = txt;
      st.title = attachStateText(item);
      if ((item.state === 'failed' || item.state === 'error') && item.dataUrl) {
        st.onclick = function (e) { e.stopPropagation(); uploadImage(item); };
      }
      var x = button('✕', 'x', '移除这张');
      x.onclick = function (e) { e.stopPropagation(); removeImage(item); };
      cell.append(st, x);
      thumbs.append(cell);
    });
    attachTit.textContent = '已选 ' + list.length + '/' + MAX_IMAGES + ' 张' +
      (done ? ' · 已传 ' + done : '') + (running ? ' · 处理中 ' + running : '') +
      (bad ? ' · 待重试 ' + bad : '');
    // v3.12：没 Token 也显示，点了引导去设置，而不是「按钮消失」
    var canUp = list.some(function (i) {
      return i.dataUrl && i.state !== 'uploaded' && i.state !== 'uploading';
    });
    attachUp.style.display = canUp ? '' : 'none';
    attachUp.title = cfg.gitToken ? '把还没上传的图片传到 GitLab media/<用户名>/'
      : '还没设置上传 Token：点这里去设置里填';
  }

  function removeImage(item) {
    if (item.xhr) { try { item.xhr.abort(); } catch (e) {} item.xhr = null; }
    var i = pendingImages.indexOf(item);
    if (i >= 0) pendingImages.splice(i, 1);
    renderAttach();
  }

  function clearPending(abortUpload) {
    if (abortUpload) {
      pendingImages.forEach(function (it) {
        if (it.xhr) { try { it.xhr.abort(); } catch (e) {} it.xhr = null; }
      });
      photoQueue = [];
    }
    pendingImages = [];
    renderAttach();
  }

  function uploadImage(item) {
    if (closed) return;
    if (!item || !item.dataUrl) return;
    if (!cfg.gitToken) { item.state = 'no-token'; renderAttach(); return; }
    if (item.xhr) {
      try { item.xhr.abort(); } catch (e) {}
      item.xhr = null;
    }
    item.state = 'uploading';
    item.error = '';
    item.remotePath = mediaNewPath('.jpg');
    renderAttach();

    var b64 = String(item.dataUrl || '').split(',')[1] || '';
    if (!b64) {
      item.state = 'failed';
      item.error = '没有图片数据';
      renderAttach();
      return;
    }

    var x = new XMLHttpRequest();
    item.xhr = x;
    var url = 'https://gitlab.com/api/v4/projects/' + encodeURIComponent(GIT_PROJ) +
      '/repository/files/' + encodeURIComponent(item.remotePath);
    try {
      x.open('POST', url, true);
      x.setRequestHeader('Content-Type', 'application/json');
      x.setRequestHeader('PRIVATE-TOKEN', cfg.gitToken.trim());
      x.timeout = 60000;
    } catch (e) {
      item.xhr = null;
      item.state = 'failed';
      item.error = e && e.message ? e.message : String(e);
      renderAttach();
      return;
    }

    x.onload = function () {
      if (item.xhr !== x) return;
      item.xhr = null;
      if (x.status >= 200 && x.status < 300) {
        item.state = 'uploaded';
      } else {
        item.state = 'failed';
        var detail = '';
        try {
          var j = JSON.parse(x.responseText || '{}');
          detail = j.message || (j.error && j.error.message) || '';
        } catch (e) {}
        item.error = 'HTTP ' + x.status + (detail ? ' ' + detail : '');
        // 同一秒/同名冲突：换一个名字再试一次
        if (x.status === 400 && /already exists/i.test(x.responseText || '') && !item.retried) {
          item.retried = true;
          item.remotePath = mediaNewPath('.jpg');
          uploadImage(item);
          return;
        }
        // v3.12：上传失败要看得见，不再只藏在 title 里
        labelToast('照片上传失败：' + item.error);
        cfgMsg.textContent = '照片上传失败：' + item.error + '（可点缩略图右下角重试）';
      }
      renderAttach();
    };
    x.onerror = function () {
      if (item.xhr !== x) return;
      item.xhr = null;
      item.state = 'failed';
      item.error = '网络/CORS 错误';
      renderAttach();
    };
    x.ontimeout = function () {
      if (item.xhr !== x) return;
      item.xhr = null;
      item.state = 'failed';
      item.error = '上传超时';
      renderAttach();
    };
    x.onabort = function () {
      if (item.xhr !== x) return;
      item.xhr = null;
      if (item.state === 'uploading') {
        item.state = 'failed';
        item.error = '已取消';
        renderAttach();
      }
    };

    try {
      x.send(JSON.stringify({
        branch: GIT_BRANCH,
        content: b64,
        encoding: 'base64',
        commit_message: 'upload photo ' + item.remotePath.replace(/^media\//, '')
      }));
    } catch (e) {
      item.xhr = null;
      item.state = 'failed';
      item.error = e && e.message ? e.message : String(e);
      renderAttach();
    }
  }

  function queuePhoto(file) {
    var item = {
      id: ++imgSeq,
      name: 'photo-' + stamp() + '-' + imgSeq + '.jpg',
      dataUrl: '',
      state: 'compress',
      error: '',
      remotePath: '',
      file: file,
      xhr: null,
      maxEdge: file && file._cam ? Math.min(camMax(), 2560) : 2048
    };
    pendingImages.push(item);
    photoQueue.push(item);
    renderAttach();
    pumpPhotos();
  }

  function handlePhotos(files) {
    if (!files || !files.length || closed) return;
    var arr = Array.prototype.slice.call(files);
    var room = MAX_IMAGES - pendingImages.length;
    if (room <= 0) { cfgMsg.textContent = '最多只能附加 ' + MAX_IMAGES + ' 张图片'; return; }
    var cut = 0;
    if (arr.length > room) { cut = arr.length - room; arr = arr.slice(0, room); }
    var skipped = 0;
    arr.forEach(function (f) {
      if (!f || !/^image\//i.test(f.type || '')) { skipped++; return; }
      if (f.size > 30 * 1024 * 1024) { skipped++; return; }
      queuePhoto(f);
    });
    if (skipped) cfgMsg.textContent = '已跳过 ' + skipped + ' 个非图片或超过 30MB 的文件';
    else if (cut) cfgMsg.textContent = '最多 ' + MAX_IMAGES + ' 张，已添加前 ' + room + ' 张';
  }

  function handlePhoto(file) { handlePhotos([file]); }

  // 逐张压缩（避免 9 张大图同时解码把页面卡死）
  function pumpPhotos() {
    if (photoBusy || !photoQueue.length || closed) return;
    var item = photoQueue.shift();
    photoBusy = true;
    photoBtn.disabled = true;
    compressImage(item.file, item.maxEdge).then(blobToDataURL).then(function (dataUrl) {
      if (closed) return null;
      if (!dataUrl || dataUrl.indexOf('data:image/') !== 0) throw new Error('图片格式异常');
      item.dataUrl = dataUrl;
      var file = item.file;
      item.file = null;
      // 相册存原图（IndexedDB，不压缩、不上传）；存不进也不影响发送
      return saveMedia(file, item.name, {}).then(function (id) {
        item.mediaId = id;
        if (galOv && galOv.el.classList.contains('on')) renderAlbum();
      }).catch(function () {});
    }).then(function () {
      if (closed) return;
      if (cfg.autoUpload && cfg.gitToken) uploadImage(item);
      else {
        item.state = cfg.gitToken ? 'off' : 'no-token';
        if (!cfg.gitToken) labelToast('没有上传 Token：照片先存本机相册，填 Token 后可再上传');
        renderAttach();
      }
    }).catch(function (e) {
      if (closed) return;
      item.state = 'error';
      item.error = e && e.message ? e.message : String(e);
      item.file = null;
      renderAttach();
      cfgMsg.textContent = '照片处理失败：' + item.error;
    }).then(function () {
      photoBusy = false;
      photoBtn.disabled = false;
      renderAttach();
      pumpPhotos();
    });
  }

  // v3.12：相机拍照分辨率（长边）；和聊天室相机共用 fh:cam:res
  var CAM_RES = [[3840, '4K'], [2560, '2K'], [1920, '1080P'], [1280, '720P']];
  function camMax() {
    var r = parseInt(read('fh:cam:res', '2560'), 10);
    for (var i = 0; i < CAM_RES.length; i++) if (r === CAM_RES[i][0]) return r;
    return 2560;
  }
  function camMaxLabel() {
    var r = camMax();
    for (var i = 0; i < CAM_RES.length; i++) if (r === CAM_RES[i][0]) return CAM_RES[i][1];
    return '2K';
  }
  function downscaleBlob(blob, cb) {
    var max = camMax();
    var url = URL.createObjectURL(blob);
    var im = new Image();
    im.onload = function () {
      var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
      var sc = Math.min(1, max / Math.max(w, h));
      if (!w || !h || sc >= 0.999) {
        try { URL.revokeObjectURL(url); } catch (e) {}
        cb(blob);
        return;
      }
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * sc));
      c.height = Math.max(1, Math.round(h * sc));
      try { c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); } catch (e) {}
      try { URL.revokeObjectURL(url); } catch (e) {}
      c.toBlob(function (b) { cb(b || blob); }, 'image/jpeg', 0.92);
    };
    im.onerror = function () { try { URL.revokeObjectURL(url); } catch (e) {} cb(blob); };
    im.src = url;
  }

  // v3.3 拍照：优先调用网页相机（getUserMedia），不支持时回退文件选择
  function openCam() {
    if (closed) return;
    if (camStop) { try { camStop(); } catch (e) {} }
    var ov = div('ai-cam');
    ov.dataset.fhSkip = '1';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;flex-direction:column';
    var v = document.createElement('video');
    v.setAttribute('playsinline', '');
    v.muted = true;
    v.style.cssText = 'flex:1;min-height:0;width:100%;object-fit:contain;background:#000';
    var bar = div('ai-cambar');
    // v3.12：快门移到右侧，翻转留在左侧，✕ 挪到右上角
    bar.style.cssText = 'position:relative;z-index:3;display:flex;align-items:center;justify-content:flex-end;gap:24px;' +
      'padding:16px 26px 28px;background:#111';

    // v3.9：圆形快门，放在中间；翻转/关闭分列两侧
    var snap = document.createElement('button');
    snap.type = 'button';
    snap.title = '拍照';
    snap.setAttribute('aria-label', '拍照');
    snap.style.cssText = 'width:68px;height:68px;padding:0;border:4px solid rgba(255,255,255,.85);' +
      'border-radius:50%;background:#fff;box-shadow:0 0 0 4px rgba(0,0,0,.25),0 4px 18px rgba(0,0,0,.45);' +
      'cursor:pointer;flex:0 0 auto;transition:transform .12s';
    snap.onpointerdown = function () { snap.style.transform = 'scale(.92)'; };
    snap.onpointerup = function () { snap.style.transform = ''; };
    var flip = button('🔄', 'ai-mini');
    flip.title = '翻转';
    flip.style.cssText = 'margin-right:auto;width:44px;height:44px;border-radius:50%;font-size:19px';
    var x = button('✕', 'ai-mini');
    x.title = '关闭';
    x.style.cssText = 'position:absolute;top:14px;right:14px;z-index:7;width:36px;height:36px;padding:0;' +
      'border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.55);color:#fff;font-size:16px;line-height:1';
    bar.append(flip, snap);
    ov.append(v, bar, x);

    // 拍照分辨率：4K / 2K / 1080P / 720P（长边）
    var resSel = document.createElement('select');
    resSel.title = '拍照分辨率（长边）';
    resSel.style.cssText = 'position:absolute;top:14px;left:14px;z-index:7;padding:7px 9px;border-radius:8px;' +
      'border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.55);color:#fff;font:12px/1 inherit;outline:none';
    CAM_RES.forEach(function (r) {
      var o = document.createElement('option');
      o.value = String(r[0]);
      o.textContent = '拍照 ' + r[1];
      resSel.append(o);
    });
    resSel.value = String(camMax());
    resSel.onchange = function () {
      save('fh:cam:res', resSel.value);
      cfgMsg.textContent = '拍照分辨率已设为 ' + camMaxLabel() + '（长边 ' + resSel.value + 'px）';
    };
    ov.append(resSel);
    // 挂到 body：AI 根窗口本身是层叠上下文，放 card 里会被网页/列表遮罩压住
    document.body.appendChild(ov);

    // 变焦条：优先摄像头原生 zoom，不支持时用画面缩放 + 中心裁切
    var zBox = div();
    zBox.style.cssText = 'position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:5;display:flex;align-items:center;' +
      'gap:7px;padding:7px 10px;border-radius:999px;background:rgba(0,0,0,.58);color:#fff;' +
      'backdrop-filter:blur(8px);font:12px/1 inherit';
    var zOut = document.createElement('button');
    zOut.type = 'button'; zOut.textContent = '−'; zOut.title = '缩小';
    zOut.style.cssText = 'width:28px;height:28px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;font:17px/1 inherit;cursor:pointer';
    var zRange = document.createElement('input');
    zRange.type = 'range'; zRange.title = '变焦';
    zRange.style.cssText = 'width:96px;accent-color:#5b8dfa';
    var zLab = document.createElement('span');
    zLab.textContent = '1.0×';
    zLab.style.cssText = 'min-width:38px;text-align:center;font-variant-numeric:tabular-nums';
    var zIn = document.createElement('button');
    zIn.type = 'button'; zIn.textContent = '+'; zIn.title = '放大';
    zIn.style.cssText = 'width:28px;height:28px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;font:17px/1 inherit;cursor:pointer';
    zBox.append(zOut, zRange, zLab, zIn);
    ov.append(zBox);

    var stream = null, track = null, facing = 'environment', dead = false;
    var nativeZoom = false, zMin = 1, zMax = 4, zoom = 1;
    function stopCam() {
      if (dead) return;
      dead = true;
      if (stream) {
        stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
        stream = null;
      }
      if (camStop === stopCam) camStop = null;
      v.style.transform = '';
      ov.remove();
    }
    camStop = stopCam;

    function applyZoom(z) {
      zoom = Math.max(zMin, Math.min(zMax, Number(z) || zMin));
      zLab.textContent = zoom.toFixed(1) + '×';
      zRange.value = String(zoom);
      if (!nativeZoom || !track) {
        v.style.transform = zoom > 1.001 ? 'scale(' + zoom + ')' : '';
        return;
      }
      try {
        track.applyConstraints({ advanced: [{ zoom: zoom }] }).catch(function () {
          nativeZoom = false;
          v.style.transform = zoom > 1.001 ? 'scale(' + zoom + ')' : '';
        });
      } catch (e) {
        nativeZoom = false;
        v.style.transform = zoom > 1.001 ? 'scale(' + zoom + ')' : '';
      }
    }
    function setupZoom(s) {
      track = s.getVideoTracks ? (s.getVideoTracks()[0] || null) : null;
      nativeZoom = false;
      zMin = 1; zMax = 4; zoom = 1;
      v.style.transform = '';
      var caps = {};
      try { caps = (track && track.getCapabilities) ? track.getCapabilities() : {}; } catch (e) {}
      var zc = caps.zoom;
      if (zc && typeof zc.max === 'number' && zc.max > (typeof zc.min === 'number' ? zc.min : 1)) {
        nativeZoom = true;
        zMin = typeof zc.min === 'number' ? zc.min : 1;
        zMax = Math.min(zc.max, 8);
      }
      zRange.min = String(zMin);
      zRange.max = String(zMax);
      zRange.step = nativeZoom ? String(zc.step || 0.1) : '0.1';
      applyZoom(zMin);
    }
    zOut.onclick = function () { applyZoom(zoom - (parseFloat(zRange.step) || 0.1)); };
    zIn.onclick = function () { applyZoom(zoom + (parseFloat(zRange.step) || 0.1)); };
    zRange.oninput = function () { applyZoom(parseFloat(zRange.value)); };
    function fallbackPick() {
      stopCam();
      try { photoIn.removeAttribute('capture'); } catch (e) {}
      photoIn.value = '';
      try { photoIn.click(); } catch (e) { cfgMsg.textContent = '无法打开相机/文件选择器'; }
    }
    function startCam() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { fallbackPick(); return; }
      if (stream) {
        stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
        stream = null;
      }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 4096 }, height: { ideal: 2160 }, frameRate: { ideal: 30 } }, audio: false })
        .then(function (s) {
          if (dead) {
            s.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
            return;
          }
          stream = s;
          v.srcObject = s;
          setupZoom(s);
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        })
        .catch(function () { fallbackPick(); });
    }
    function snapNow() {
      if (!v.videoWidth || !v.videoHeight) { cfgMsg.textContent = '相机还没准备好'; return; }
      // v3.10 高清拍照：优先 ImageCapture.takePhoto() 取原生最大静态像素（不调系统相机 App）
      if (track && typeof window.ImageCapture !== 'undefined') {
        var cap = null;
        try { cap = new window.ImageCapture(track); } catch (e) {}
        if (cap && typeof cap.takePhoto === 'function') {
          // 无原生变焦时才用 takePhoto 全帧；有原生变焦则摄像头已放大画面，仍需 canvas 裁切
          var done = false;
          var finish = function (blob) {
            if (done) return;
            done = true;
            deliver(blob);
          };
          try {
            // 有软件变焦（zoom>1 且非原生）时，takePhoto 后 canvas 中心裁切 zoom 比例，保持成片=预览
            if (!nativeZoom && zoom > 1.001) {
              var pr2 = cap.takePhoto();
              if (pr2 && pr2.then) {
                pr2.then(function (b) {
                  if (done) return;
                  done = true;
                  if (!b) { snapCanvas(); return; }
                  cropZoomBlob(b, zoom, function (cropped) { deliver(cropped); });
                }).catch(function () { snapCanvas(); });
                return;
              }
              cropZoomBlob(pr2, zoom, function (cropped) { deliver(cropped); });
              return;
            }
            var pr = cap.takePhoto();
            if (pr && pr.then) { pr.then(finish).catch(function () { snapCanvas(); }); return; }
            finish(pr);
            return;
          } catch (e) { /* 回退 canvas */ }
        }
      }
      snapCanvas();
    }
    // v3.12：成片统一按分辨率设置降采样再入队，避免 4K 大图传不上去
    function deliver(blob) {
      if (!blob) { snapCanvas(); return; }
      downscaleBlob(blob, function (b) {
        var name = 'cam-' + stamp() + '.jpg';
        var f;
        try { f = new File([b], name, { type: 'image/jpeg' }); }
        catch (e) { f = b; try { f.name = name; } catch (e2) {} }
        try { f._cam = true; } catch (e) {}
        stopCam();
        handlePhoto(f);
      });
    }
    function snapCanvas() {
      if (!v.videoWidth || !v.videoHeight) { cfgMsg.textContent = '相机还没准备好'; return; }
      var zw = nativeZoom ? 1 : Math.max(1, zoom);
      var sw = v.videoWidth / zw, sh = v.videoHeight / zw;
      var sx = (v.videoWidth - sw) / 2, sy = (v.videoHeight - sh) / 2;
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(sw));
      c.height = Math.max(1, Math.round(sh));
      try { c.getContext('2d').drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height); }
      catch (e) { cfgMsg.textContent = '拍照失败：' + (e && e.message ? e.message : e); return; }
      c.toBlob(function (blob) {
        if (!blob) { cfgMsg.textContent = '拍照失败（无图像数据）'; return; }
        deliver(blob);
      }, 'image/jpeg', 0.92);
    }
    function cropZoomBlob(blob, z, cb) {
      var url = URL.createObjectURL(blob);
      var im = new Image();
      im.onload = function () {
        var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
        var cw = Math.max(1, Math.round(w / z)), ch = Math.max(1, Math.round(h / z));
        var c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        try { c.getContext('2d').drawImage(im, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cw, ch); } catch (e) {}
        try { URL.revokeObjectURL(url); } catch (e) {}
        c.toBlob(function (b) { cb(b || blob); }, 'image/jpeg', 0.95);
      };
      im.onerror = function () { try { URL.revokeObjectURL(url); } catch (e) {} cb(blob); };
      im.src = url;
    }
    snap.onclick = snapNow;
    flip.onclick = function () { facing = facing === 'environment' ? 'user' : 'environment'; startCam(); };
    x.onclick = stopCam;
    startCam();
  }

  function addImageToBubble(bubble, list) {
    var urls = (list || []).filter(function (u) { return !!u; });
    if (!urls.length) return;
    var box = div('ai-bimgs' + (urls.length > 1 ? ' multi' : ''));
    urls.forEach(function (u, i) {
      var im = document.createElement('img');
      im.src = u;
      im.alt = '照片 ' + (i + 1);
      im.onclick = function () { openZoom(u, '照片 ' + (i + 1)); };
      box.append(im);
    });
    bubble.append(box);
  }

  // v3.10 语音输入：语音识别转文字填入输入框（不自动发送）；v3.11 修「点了没反应」
  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var sr = null, srOn = false;
  micBtn.title = SpeechRec ? '语音输入（点击开始 / 再点停止）' : '当前浏览器不支持语音识别';
  function micReset() {
    srOn = false;
    micBtn.style.background = '';
    micBtn.style.color = '';
    micBtn.textContent = '🎤';
  }
  function micMsg(s) { if (s) labelToast('🎤 ' + s); }
  function micErrText(k) {
    if (k === 'not-allowed' || k === 'service-not-allowed') return '麦克风权限被拒绝：点地址栏 🔒 允许麦克风后重试';
    if (k === 'no-speech') return '没有听到声音，靠近麦克风再说一次';
    if (k === 'audio-capture') return '没有可用的麦克风';
    if (k === 'network') return '语音识别服务连不上（浏览器语音服务需要联网）';
    if (k === 'language-not-supported') return '浏览器不支持中文语音识别';
    return '语音识别失败：' + (k || '未知错误');
  }
  function startSr() {
    try { sr = new SpeechRec(); } catch (e) { micReset(); micMsg('语音识别启动失败：' + (e && e.message ? e.message : e)); return; }
    sr.lang = 'zh-CN';
    sr.interimResults = true;
    sr.continuous = false;
    srOn = true;
    micBtn.style.background = '#7a2b2b';
    micBtn.style.color = '#fff';
    micBtn.textContent = '⏹';
    var finalTxt = '';
    sr.onresult = function (ev) {
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i];
        if (r.isFinal) finalTxt += r[0].transcript;
        else interim += r[0].transcript;
      }
      ta.value = finalTxt + interim;
      grow();
    };
    sr.onerror = function (ev) {
      micReset();
      var k = ev && ev.error;
      if (k !== 'aborted') micMsg(micErrText(k));
      try { sr.abort(); } catch (e) {}
    };
    sr.onend = function () {
      micReset();
      if (finalTxt) { ta.value = finalTxt; grow(); labelToast('已识别 ' + finalTxt.length + ' 字'); }
    };
    try { sr.start(); } catch (e) {
      micReset();
      micMsg('语音识别启动失败（需要 https 或用户手势）');
    }
  }
  micBtn.onclick = function () {
    if (!SpeechRec) { labelToast('当前浏览器不支持语音识别（可用系统输入法的语音键）'); return; }
    if (srOn) { try { sr.stop(); } catch (e) {} return; }
    // v3.11：先显式请求一次麦克风权限，否则 SpeechRecognition 可能静默失败，看起来像「点了没反应」
    if (window.isSecureContext === false) { micMsg('当前页面不是 https/localhost，语音识别不可用'); return; }
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { micMsg('浏览器不支持麦克风采集'); return; }
    micBtn.textContent = '…';
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      startSr();
    }).catch(function (err) {
      micReset();
      var n = err && err.name ? err.name : '';
      micMsg(n === 'NotAllowedError' ? '麦克风权限被拒绝：点地址栏 🔒 允许麦克风后重试'
        : n === 'NotFoundError' ? '没有可用的麦克风' : ('无法访问麦克风：' + (n || '未知错误')));
    });
  };

  function send() {
    if (busy) { stop(); return; }
    if (!cfg.key) {
      openCfg(true);
      keyField.begin();
      keyField.focus();
      cfgMsg.textContent = '请先填 API Key（sk-...）';
      return;
    }
    var text = ta.value.trim();
    var imgs = pendingImages.slice();
    if (!text && !imgs.length) { ta.focus(); return; }
    if (imgs.some(function (i) { return !i.dataUrl; })) {
      cfgMsg.textContent = '图片还在处理中，稍等一下';
      return;
    }
    var urls = imgs.map(function (i) { return i.dataUrl; });
    var label = urls.length > 1 ? '[' + urls.length + ' 张图片]' : '[图片]';

    ta.value = '';
    grow();
    history.push({ role: 'user', content: text || label });
    saveHistory();
    var sendSid = sid, sendOwner = ownerTag;
    setStat();
    var userUi = addBubble('user', text || (urls.length > 1 ? '📷 ' + urls.length + ' 张图片' : '📷 图片'));
    if (urls.length) addImageToBubble(userUi.bubble, urls);
    // 附件已随消息发出，清空输入区（不打断仍在后台进行的上传）
    clearPending(false);

    var ui = addBubble('assistant', '');
    ui.bubble.textContent = '正在思考…';
    ui.bubble.classList.add('ai-wait');

    var apiMessages = history.slice(-24).map(function (m) {
      return { role: m.role, content: m.content };
    });
    if (urls.length) {
      var lastMsg = apiMessages[apiMessages.length - 1];
      if (lastMsg && lastMsg.role === 'user') {
        var parts = [{ type: 'text', text: text || '请看看这些图片。' }];
        urls.forEach(function (u) {
          parts.push({ type: 'image_url', image_url: { url: u } });
        });
        lastMsg.content = parts;
      }
    }

    function responsesInput(list) {
      return list.map(function (m) {
        if (Object.prototype.toString.call(m.content) === '[object Array]') {
          return {
            role: m.role,
            content: m.content.map(function (c) {
              if (c.type === 'text') return { type: 'input_text', text: c.text };
              if (c.type === 'image_url') return { type: 'input_image', image_url: (c.image_url && c.image_url.url) || '' };
              return c;
            })
          };
        }
        return { role: m.role, content: m.content };
      });
    }

    var payload;
    if (cfg.mode === 'responses') {
      payload = { model: cfg.model, input: responsesInput(apiMessages), stream: true };
      if (cfg.depth !== 'off') payload.reasoning = { effort: cfg.depth === 'max' ? 'high' : cfg.depth };
    } else {
      payload = {
        model: cfg.model,
        messages: apiMessages,
        stream: true
      };
      if (cfg.depth === 'off') {
        payload.thinking = { type: 'disabled' };
      } else {
        payload.thinking = { type: 'enabled' };
        payload.reasoning_effort = cfg.depth;
      }
      // 官方接口要求显式打开才会在流末尾返回 usage；中转地址不猜，避免 400
      try {
        if (/(^|\.)deepseek\.com$/i.test(new URL(endpoint()).hostname)) {
          payload.stream_options = { include_usage: true };
        }
      } catch (e) {}
    }

    var content = '';
    var reasoning = '';
    var gotContent = false;
    var gotReason = false;
    var done = false;
    var aborted = false;
    var err = '';
    var sseBuf = '';
    var lastLen = 0;
    var reqUsage = null;
    var reqStart = Date.now();
    var firstAt = 0;

    function finish() {
      if (done) return;
      done = true;
      xhr = null;
      // 先把本轮 usage 记到发起请求的会话（即使用户中途切走）
      if (reqUsage) {
        recordUsage(reqUsage, reqStart, firstAt, Date.now(), sendSid);
        reqUsage = null;
      }
      refreshBalance();
      setBusy(false);
      ui.bubble.classList.remove('ai-wait');
      // 用户中途换了 Key / 切了会话：结果不能写进新身份的会话
      var same = (sid === sendSid && ownerTag === sendOwner);

      if (aborted) {
        ui.meta.textContent = '已停止';
        if (!content) {
          ui.bubble.textContent = reasoning ? '（已停止，仅返回了思考过程）' : '已停止';
          ui.bubble.classList.add('err');
        }
        if (same && (content || reasoning)) {
          history.push({ role: 'assistant', content: content, reasoning: reasoning || undefined });
          saveHistory();
        }
        setStat();
        return;
      }

      if (err) {
        ui.meta.textContent = '⚠ 请求失败';
        if (content) {
          ui.bubble.textContent = content;
          ui.meta.textContent = '⚠ ' + err;
        } else {
          ui.bubble.textContent = err;
          ui.bubble.classList.add('err');
        }
        setStat();
        return;
      }

      if (!gotContent && !gotReason) {
        ui.bubble.textContent = '接口没有返回内容，请重试。';
        ui.bubble.classList.add('err');
        setStat();
        return;
      }
      if (!content && reasoning) {
        ui.bubble.textContent = '（只返回了思考过程，没有正文）';
        ui.bubble.classList.add('err');
      }
      if (reasoning) {
        ui.thinkSum.textContent = '思考过程 · ' + reasoning.length + ' 字（点开）';
      }
      // 流式过程是纯文本，结束后一次性按 Markdown / LaTeX 渲染
      if (content) mdInto(ui.bubble, content);
      if (same) {
        history.push({ role: 'assistant', content: content, reasoning: reasoning || undefined });
        saveHistory();
      }
      setStat();
      scrollBottom();
    }

    function takeReason(s) {
      if (!s) return;
      if (!firstAt) firstAt = Date.now();
      gotReason = true;
      reasoning += s;
      setReason(ui, s);
    }
    function takeContent(s) {
      if (!s) return;
      if (!firstAt) firstAt = Date.now();
      gotContent = true;
      content += s;
      setContent(ui, s);
    }
    function errText(e, dflt) {
      return (e && (e.message || e.type)) || dflt;
    }
    function handleChatJson(j) {
      if (j.usage) reqUsage = j.usage;
      if (j.error) { err = errText(j.error, '接口返回错误'); return; }
      var ch = j.choices && j.choices[0];
      if (!ch) return;
      var d = ch.delta || ch.message || {};
      if (d.reasoning_content) takeReason(d.reasoning_content);
      if (d.reasoning) takeReason(d.reasoning);
      if (d.content) takeContent(d.content);
    }
    function extractResponsesOutput(j) {
      var out = (j && j.output) || (j && j.response && j.response.output) || [];
      var txt = '';
      out.forEach(function (o) {
        var arr = (o && o.content) || [];
        arr.forEach(function (c) {
          if (!c) return;
          if ((c.type === 'output_text' || c.type === 'text') && c.text) txt += c.text;
        });
      });
      if (!txt && typeof (j && j.output_text) === 'string') txt = j.output_text;
      return txt;
    }
    function handleResponsesJson(j) {
      var gu = (j && j.usage) || (j && j.response && j.response.usage);
      if (gu) reqUsage = gu;
      var t = String((j && j.type) || '');
      if (t === 'error' || j.error) { err = errText(j.error || j, '接口返回错误'); return; }
      if (/\.delta$/.test(t)) {
        if (/output_text\.delta$/.test(t)) takeContent(j.delta);
        else if (/reasoning.*\.delta$/.test(t)) takeReason(j.delta);
        return;
      }
      if (/^response\.(completed|done)$/.test(t)) {
        var uu = (j.response && j.response.usage) || j.usage;
        if (uu) reqUsage = uu;
        if (!gotContent) {
          var txt = extractResponsesOutput(j.response || j);
          if (txt) takeContent(txt);
        }
        var rr = j.response && j.response.error;
        if (rr && !err) err = errText(rr, '接口返回错误');
        return;
      }
      if (/^response\.(failed|incomplete)$/.test(t)) {
        var r2 = j.response || {};
        var reason = r2.incomplete_details && r2.incomplete_details.reason;
        err = errText(r2.error, '响应未完成' + (reason ? '：' + reason : ''));
        return;
      }
    }
    function handleJson(j) {
      if (!j || typeof j !== 'object') return;
      if (cfg.mode === 'responses') handleResponsesJson(j);
      else handleChatJson(j);
    }

    function handleEvent(ev) {
      var lines = ev.split(/\r?\n/);
      var data = [];
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('data:') === 0) {
          data.push(lines[i].slice(5).replace(/^ /, ''));
        }
      }
      if (!data.length) return;
      var s = data.join('\n');
      if (s === '[DONE]') return;
      var j;
      try { j = JSON.parse(s); } catch (e) { return; }
      handleJson(j);
    }

    function parseStream(final) {
      var raw = xhr ? (xhr.responseText || '') : '';
      if (raw.length > lastLen) {
        sseBuf += raw.slice(lastLen);
        lastLen = raw.length;
      }
      var parts = sseBuf.split(/\r?\n\r?\n/);
      if (final) {
        sseBuf = '';
        for (var k = 0; k < parts.length; k++) {
          if (parts[k].trim()) handleEvent(parts[k]);
        }
      } else {
        sseBuf = parts.pop();
        for (var i = 0; i < parts.length; i++) handleEvent(parts[i]);
      }
    }

    function parseJson(raw) {
      try {
        var j = JSON.parse(raw);
        if (cfg.mode === 'responses') {
          if (j.error) { err = errText(j.error, '接口返回错误'); return; }
          handleResponsesJson(j);
          if (!gotContent && !gotReason) {
            var txt = extractResponsesOutput(j);
            if (txt) takeContent(txt);
          }
        } else {
          handleChatJson(j);
        }
      } catch (e) {
        err = '接口返回格式异常';
      }
    }

    setBusy(true);

    xhr = new XMLHttpRequest();
    try {
      xhr.open('POST', endpoint(), true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', 'Bearer ' + cfg.key.trim());
      xhr.timeout = 180000;
    } catch (e) {
      err = '无法发起请求：' + (e && e.message ? e.message : String(e));
      finish();
      return;
    }

    xhr.onprogress = function () { parseStream(false); };
    xhr.onreadystatechange = function () {
      if (xhr && xhr.readyState === 3) parseStream(false);
    };
    xhr.onload = function () {
      if (done) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        parseStream(true);
        var raw = (xhr.responseText || '').trim();
        if (!gotContent && !gotReason && raw && raw.charAt(0) === '{') parseJson(raw);
        if (!gotContent && !gotReason && !err) err = '接口返回为空';
      } else {
        err = apiError(xhr.status, xhr.responseText || '');
      }
      finish();
    };
    xhr.onerror = function () {
      if (done) return;
      err = apiError(0, '');
      finish();
    };
    xhr.ontimeout = function () {
      if (done) return;
      err = '请求超时（180 秒），可缩短问题或稍后再试';
      finish();
    };
    xhr.onabort = function () {
      if (done) return;
      aborted = true;
      finish();
    };

    try {
      xhr.send(JSON.stringify(payload));
    } catch (e) {
      err = '发送失败：' + (e && e.message ? e.message : String(e));
      finish();
    }
  }

  // ── 事件 ──
  dot.onclick = function (e) {
    e.stopPropagation();
    openCfg();
  };
  cfgBtn.onclick = function (e) {
    e.stopPropagation();
    openCfg();
  };
  newBtn.onclick = function (e) { e.stopPropagation(); newSession(); };
  sessBtn.onclick = function (e) { e.stopPropagation(); openSessions(); };
  galBtn.onclick = function (e) { e.stopPropagation(); openAlbum(); };
  probeBtn.onclick = function (e) { e.stopPropagation(); openProbe(); };
  modelIn.onchange = function () {
    var m = String(modelIn.value || '').trim();
    if (!m) { modelIn.value = cfg.model; return; }
    cfg.model = m;
    save(K_MODEL, m);
    modelSel.value = m;
    setStat();
    syncProfile();
  };
  modelSel.onchange = function () {
    var m = String(modelSel.value || '').trim();
    if (!m) return;
    cfg.model = m;
    modelIn.value = m;
    save(K_MODEL, m);
    setStat();
    syncProfile();
  };
  scanBtn.onclick = function (e) {
    e.stopPropagation();
    if (!cfg.key) {
      openCfg(true);
      keyField.begin();
      cfgMsg.textContent = '先填 API Key，再扫描模型';
      return;
    }
    var url = modelsUrl();
    scanBtn.disabled = true;
    scanBtn.textContent = '…';
    cfgMsg.textContent = '扫描 ' + url + ' …';
    var x = new XMLHttpRequest();
    function done() {
      scanBtn.disabled = false;
      scanBtn.textContent = '扫描';
    }
    try {
      x.open('GET', url, true);
      x.setRequestHeader('Authorization', 'Bearer ' + cfg.key.trim());
      x.timeout = 20000;
    } catch (err) {
      done();
      cfgMsg.textContent = '扫描失败：' + (err && err.message ? err.message : err);
      return;
    }
    x.onload = function () {
      done();
      if (x.status < 200 || x.status >= 300) {
        cfgMsg.textContent = '扫描失败：' + apiError(x.status, x.responseText || '');
        return;
      }
      var ids = [];
      try {
        var j = JSON.parse(x.responseText || '{}');
        var arr = j.data || j.models || (Object.prototype.toString.call(j) === '[object Array]' ? j : []);
        arr.forEach(function (m) {
          var id = typeof m === 'string' ? m : (m && (m.id || m.name));
          if (id) ids.push(String(id));
        });
      } catch (err2) {}
      ids = ids.filter(function (v, i) { return v && ids.indexOf(v) === i; }).slice(0, 300);
      if (!ids.length) {
        cfgMsg.textContent = '扫描完成，但没有解析到模型名（可手填）';
        return;
      }
      modelList = ids;
      save(K_MODELS, JSON.stringify(ids));
      syncProfile(true);
      modelSel.innerHTML = '';
      ids.forEach(function (id) {
        var o = document.createElement('option');
        o.value = id;
        o.textContent = id;
        modelSel.append(o);
      });
      modelSel.style.display = '';
      if (ids.indexOf(cfg.model) < 0) {
        cfg.model = ids[0];
        modelIn.value = ids[0];
        save(K_MODEL, ids[0]);
        setStat();
      }
      modelSel.value = cfg.model;
      syncProfile(true);
      cfgMsg.textContent = '扫描到 ' + ids.length + ' 个模型 · 已保存在本机，可在「模型」下拉里选';
    };
    x.onerror = function () {
      done();
      cfgMsg.textContent = '扫描失败：网络/CORS 错误';
    };
    x.ontimeout = function () {
      done();
      cfgMsg.textContent = '扫描超时';
    };
    try { x.send(); } catch (err3) {
      done();
      cfgMsg.textContent = '扫描失败：' + (err3 && err3.message ? err3.message : err3);
    }
  };
  modeSel.onchange = function () {
    cfg.mode = modeSel.value;
    save(K_MODE, cfg.mode);
    setStat();
    syncProfile();
    cfgMsg.textContent = '接口已切到 ' + (MODE_NAME[cfg.mode] || '对话') + ' · ' + endpoint();
  };
  themeBtn.onclick = function (e) {
    e.stopPropagation();
    var order = ['auto', 'dark', 'light'];
    cfg.theme = order[(order.indexOf(cfg.theme) + 1) % order.length];
    save(K_THEME, cfg.theme);
    applyTheme();
  };
  themeSel.onchange = function () {
    cfg.theme = themeSel.value;
    save(K_THEME, cfg.theme);
    applyTheme();
  };
  depthSel.onchange = function () {
    cfg.depth = depthSel.value;
    save(K_DEPTH, cfg.depth);
    setStat();
  };
  baseIn.onchange = function () {
    var b = baseIn.value.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(b)) b = 'https://api.deepseek.com';
    cfg.base = b;
    baseIn.value = b;
    save(K_BASE, b);
    syncProfile();
  };
  var fullBtns = [fullBtn];
  var lastFullAt = 0;
  function syncFullBtns() {
    var on = root.classList.contains('ai-full');
    fullBtns.forEach(function (b) {
      if (!b) return;
      b.textContent = on ? '⤡' : '⛶';
      b.title = on ? '退出全屏' : '全屏';
    });
  }
  function toggleFull(force) {
    var on = typeof force === 'boolean' ? force : !root.classList.contains('ai-full');
    if (on === root.classList.contains('ai-full')) {
      syncFullBtns();
      return;
    }
    lastFullAt = Date.now();
    if (on) {
      root.classList.add('ai-full');
      // loader 的浮动窗 API：先把当前浮动位置记进 fh:ai:rect，再铺满视口
      if (root.__fhToFull) root.__fhToFull();
      else {
        root.dataset.fhFloat = '0';
        root.style.inset = '0';
        root.style.left = '';
        root.style.top = '';
        root.style.right = '';
        root.style.bottom = '';
        root.style.width = '';
        root.style.height = '';
        root.style.maxHeight = '';
        root.style.transform = '';
      }
    } else {
      root.classList.remove('ai-full');
      if (root.__fhToFloat) root.__fhToFloat();
      else {
        root.style.inset = '';
        root.style.left = '';
        root.style.top = '';
        root.style.width = '';
        root.style.height = '';
      }
    }
    syncFullBtns();
  }
  fullBtn.onclick = function (e) {
    e.stopPropagation();
    toggleFull();
  };
  photoBtn.onclick = function (e) {
    e.stopPropagation();
    openCam();
  };
  photoIn.onchange = function () {
    var fs = photoIn.files;
    if (fs && fs.length) handlePhotos(fs);
    photoIn.value = '';
  };
  attachUp.onclick = function () {
    if (!cfg.gitToken) {
      openCfg(true);
      cfgMsg.textContent = '先在上面的「上传 Token」里填 GitLab Token，再点上传';
      gitField.begin();
      return;
    }
    pendingImages.forEach(function (it) {
      if (it.dataUrl && it.state !== 'uploaded' && it.state !== 'uploading') uploadImage(it);
    });
  };
  attachRm.onclick = function () { clearPending(true); };
  clearBtn.onclick = function () {
    if (!history.length && !msgs.querySelector('.ai-msg')) return;
    if (!confirm('清空本机对话记录？')) return;
    history = [];
    saveHistory();
    renderHistory();
    setStat();
  };
  sendBtn.onclick = send;
  ta.oninput = grow;
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  });

  function close() {
    closed = true;
    if (sr) { try { sr.abort(); } catch (e) {} sr = null; }
    srOn = false;
    if (camStop) { try { camStop(); } catch (e) {} camStop = null; }
    try { stop(); } catch (e) {}
    pendingImages.forEach(function (it) {
      if (it.xhr) { try { it.xhr.abort(); } catch (e) {} it.xhr = null; }
    });
    photoQueue = [];
    try { if (zoomCloseFn) zoomCloseFn(); } catch (e) {}
    try { document.removeEventListener('keydown', onKey); } catch (e) {}
    if (window.__fhAIStop === stop) window.__fhAIStop = null;
    if (window.__fhAiRoom) window.__fhAiRoom = null;
    if (fhPanel) fhPanel.style.display = fhDisplay == null ? '' : fhDisplay;
    try { photoIn.remove(); } catch (e) {}
    root.remove();
  }
  function onKey(e) {
    if (e.key !== 'Escape') return;
    if (zoomCloseFn) { zoomCloseFn(); return; }
    if (viewer && viewer.classList.contains('on')) { viewer.classList.remove('on'); return; }
    // 先退全屏，再关覆盖层（聊天室全屏时 Esc 一步退全屏）
    if (root.classList.contains('ai-full')) { toggleFull(false); return; }
    if (overlayStack.length) { overlayStack[overlayStack.length - 1].el.hide(); return; }
    if (cfgBox.classList.contains('on')) { openCfg(false); return; }
    close();
  }
  closeBtn.onclick = close;
  // 刚点完全屏按钮，布局还在切换，落在遮罩上的这一下不应关闭窗口
  shade.onclick = function () {
    if (Date.now() - lastFullAt < 600) return;
    close();
  };
  acctBtn.onclick = function (e) { e.stopPropagation(); openAcct(); };
  acctBtn.style.color = acctRec() ? '#6f9bff' : '';
  acctBtn.title = acctRec() ? ('账号：' + acctRec().user) : '账号（用户名 + PIN）';
  document.addEventListener('keydown', onKey);
  window.__fhAIStop = stop;

  document.body.append(root);
  document.body.append(photoIn);
  applyTheme();
  setDot();
  setStat();
  renderHistory();
  grow();
  if (cfg.key) setTimeout(function () { refreshBalance(false); }, 800);

  // v3.8：聊天室已拆成独立 mods/room.js，这里只清理旧版一次性开关
  try { localStorage.removeItem('fh:ai:roomOpen'); } catch (e) {}

  if (!cfg.key) {
    openCfg(true);
    cfgMsg.textContent = acctRec()
      ? '已登录：输入 API Key 后点“保存”，之后只显示掩码，Key 会归到当前账号。'
      : '首次使用：先点上方 👤 登录（用户名 + PIN），AI Key / Token 会跟着账号保存。';
    if (!acctRec()) setTimeout(function () { openAcct(); }, 220);
  } else {
    setTimeout(function () { ta.focus(); }, 80);
  }
})();
