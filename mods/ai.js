/* AI 网页 v3.0 — 直连 DeepSeek V4.1 Flash（ds-41-f），Key 本机保存 */
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
  var K_HIST = 'fh:ai:hist';

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
    theme: read(K_THEME, 'auto')
  };
  if (!/^https?:\/\//i.test(cfg.base)) cfg.base = 'https://api.deepseek.com';
  if (['off', 'low', 'high', 'max'].indexOf(cfg.depth) < 0) cfg.depth = 'high';
  if (['auto', 'dark', 'light'].indexOf(cfg.theme) < 0) cfg.theme = 'auto';

  var DEPTH_NAME = { off: '关闭', low: '低', high: '高', max: '最大' };

  var history = [];
  try {
    var hs = JSON.parse(localStorage.getItem(K_HIST) || '[]');
    if (Object.prototype.toString.call(hs) === '[object Array]') {
      history = hs.filter(function (m) {
        return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
      }).slice(-40);
    }
  } catch (e) {}

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
      'display:flex;flex-direction:column;min-height:0;background:transparent;border:1px solid var(--line);',
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
      'background:var(--panel);border-bottom:1px solid var(--line);flex-shrink:0}',
      '#__ai .ai-cfg.on{display:flex}',
      '#__ai .ai-row{display:flex;align-items:center;gap:6px;min-width:0}',
      '#__ai .ai-row>label{width:56px;flex-shrink:0;color:var(--muted);font-size:11.5px}',
      '#__ai .ai-in{flex:1;min-width:0;height:32px;padding:0 9px;border:1px solid var(--line);border-radius:8px;',
      'background:var(--bg);color:var(--fg);font:12px/1.3 inherit;outline:none}',
      '#__ai .ai-in:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(77,126,248,.14)}',
      '#__ai .ai-sel{flex:1;min-width:0;height:32px;padding:0 7px;border:1px solid var(--line);border-radius:8px;',
      'background:var(--bg);color:var(--fg);font:12px/1.3 inherit;outline:none}',
      '#__ai .ai-mini{height:30px;padding:0 9px;border:1px solid var(--line);border-radius:8px;',
      'background:var(--soft);color:var(--muted);font:11px/1 inherit;cursor:pointer;flex-shrink:0}',
      '#__ai .ai-mini:active{background:var(--line);color:var(--fg)}',
      '#__ai .ai-hint{color:var(--dim);font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#__ai .ai-cfgmsg{color:var(--muted);font-size:10.5px;min-height:14px}',
      '#__ai .ai-msgs{position:relative;z-index:1;flex:1;min-height:0;overflow:auto;padding:14px;',
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
      'white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text}',
      '#__ai .ai-msg.assistant .ai-bubble{border-bottom-left-radius:4px}',
      '#__ai .ai-msg.user .ai-bubble{background:linear-gradient(180deg,var(--user),var(--accent2));color:#fff;',
      'border-bottom-right-radius:4px}',
      '#__ai .ai-bubble.err{background:rgba(224,96,96,.10);border:1px solid rgba(224,96,96,.38);color:var(--danger)}',
      '#__ai .ai-wait{color:var(--dim)}',
      '#__ai .ai-think{display:none;margin:0 0 6px;padding:7px 9px;border-left:2px solid var(--line);',
      'border-radius:0 8px 8px 0;background:var(--code);color:var(--dim);font-size:11px;line-height:1.6}',
      '#__ai .ai-think summary{cursor:pointer;color:var(--muted);font-size:10.5px;user-select:none}',
      '#__ai .ai-think-txt{margin-top:5px;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto}',
      '#__ai .ai-foot{position:relative;z-index:1;flex-shrink:0;padding:9px 12px 7px;border-top:1px solid var(--line)}',
      '#__ai .ai-inputrow{display:flex;align-items:flex-end;gap:7px}',
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
  ver.textContent = 'v3.0';
  title.append(ver);
  var badge = div('ai-badge', 'ds-41-f');
  var spacer = div('ai-spacer');
  var dot = div('ai-dot');
  dot.title = '未配置 API Key';
  var cfgBtn = button('🔑', 'ai-ico', 'API Key / 设置');
  var themeBtn = button('🌓', 'ai-ico ai-themebtn', '主题');
  var closeBtn = button('✕', 'ai-ico ai-close', '关闭');
  head.append(logo, title, badge, spacer, dot, cfgBtn, themeBtn, closeBtn);

  // 设置抽屉
  var cfgBox = div('ai-cfg');

  var keyRow = div('ai-row');
  var keyLab = document.createElement('label');
  keyLab.textContent = 'API Key';
  var keyIn = document.createElement('input');
  keyIn.className = 'ai-in';
  keyIn.type = 'password';
  keyIn.placeholder = 'sk-...（只存本机）';
  keyIn.value = cfg.key;
  keyIn.autocomplete = 'off';
  keyIn.spellcheck = false;
  var eyeBtn = button('显示', 'ai-mini', '显示 / 隐藏 Key');
  keyRow.append(keyLab, keyIn, eyeBtn);

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

  var hint = div('ai-hint', 'Key 只保存在本机 localStorage，请求直连 api.deepseek.com。');
  var cfgMsg = div('ai-cfgmsg', '');
  cfgBox.append(keyRow, baseRow, themeRow, depthRow, hint, cfgMsg);

  // 对话区
  var msgs = div('ai-msgs');
  var empty = null;

  // 输入区
  var foot = div('ai-foot');
  var inputRow = div('ai-inputrow');
  var ta = document.createElement('textarea');
  ta.className = 'ai-ta';
  ta.placeholder = '问点什么…（Enter 发送 / Shift+Enter 换行）';
  ta.maxLength = 8000;
  ta.spellcheck = false;
  var sendBtn = button('发送', 'ai-send');
  inputRow.append(ta, sendBtn);

  var stat = div('ai-stat');
  var statTxt = div('grow', '');
  var clearBtn = button('清空', 'ai-mini', '清空本机对话记录');
  stat.append(statTxt, clearBtn);
  foot.append(inputRow, stat);

  card.append(head, cfgBox, msgs, foot);
  root.append(shade, card);

  var busy = false;
  var xhr = null;

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
    if (on && !cfg.key) setTimeout(function () { keyIn.focus(); }, 60);
  }

  function setDot() {
    dot.classList.toggle('on', !!cfg.key);
    dot.title = cfg.key ? 'API Key 已配置 · 点开设置' : '未配置 API Key · 点开设置';
  }
  function setStat() {
    statTxt.textContent = 'ds-41-f · 思考 ' + (DEPTH_NAME[cfg.depth] || '高') + ' · 对话 ' + history.length + ' 条';
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
      : '在上方 🔑 填 API Key，然后直接提问。Key 只保存在本机，不经过第三方服务器。'));
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
        copyText(bubble.textContent, function (ok) {
          cp.textContent = ok ? '已复制' : '失败';
          setTimeout(function () { cp.textContent = '复制'; }, 1200);
        });
      };
      meta.append(cp);
    }

    var bubble = div('ai-bubble', text || '');
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
    save(K_HIST, JSON.stringify(out));
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
    if (/\/chat\/completions$/i.test(b)) return b;
    return b + '/chat/completions';
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

  function send() {
    if (busy) { stop(); return; }
    if (!cfg.key) {
      openCfg(true);
      keyIn.focus();
      cfgMsg.textContent = '请先填 API Key（sk-...）';
      return;
    }
    var text = ta.value.trim();
    if (!text) { ta.focus(); return; }

    ta.value = '';
    grow();
    history.push({ role: 'user', content: text });
    saveHistory();
    setStat();
    addBubble('user', text);

    var ui = addBubble('assistant', '');
    ui.bubble.textContent = '正在思考…';
    ui.bubble.classList.add('ai-wait');

    var apiMessages = history.slice(-24).map(function (m) {
      return { role: m.role, content: m.content };
    });

    var payload = {
      model: 'deepseek-flash',
      messages: apiMessages,
      stream: true
    };
    if (cfg.depth === 'off') {
      payload.thinking = { type: 'disabled' };
    } else {
      payload.thinking = { type: 'enabled' };
      payload.reasoning_effort = cfg.depth;
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

    function finish() {
      if (done) return;
      done = true;
      xhr = null;
      setBusy(false);
      ui.bubble.classList.remove('ai-wait');

      if (aborted) {
        ui.meta.textContent = '已停止';
        if (!content) {
          ui.bubble.textContent = reasoning ? '（已停止，仅返回了思考过程）' : '已停止';
          ui.bubble.classList.add('err');
        }
        if (content || reasoning) {
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
      history.push({ role: 'assistant', content: content, reasoning: reasoning || undefined });
      saveHistory();
      setStat();
      scrollBottom();
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
      if (j.error) {
        err = (j.error && (j.error.message || j.error.type)) || '接口返回错误';
        return;
      }
      var ch = j.choices && j.choices[0];
      if (!ch) return;
      var d = ch.delta || ch.message || {};
      if (d.reasoning_content) {
        gotReason = true;
        reasoning += d.reasoning_content;
        setReason(ui, d.reasoning_content);
      }
      if (d.reasoning) {
        gotReason = true;
        reasoning += d.reasoning;
        setReason(ui, d.reasoning);
      }
      if (d.content) {
        gotContent = true;
        content += d.content;
        setContent(ui, d.content);
      }
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
        if (j.error) {
          err = (j.error && (j.error.message || j.error.type)) || '接口返回错误';
          return;
        }
        var ch = j.choices && j.choices[0];
        if (!ch) return;
        var m = ch.message || ch.delta || {};
        if (m.reasoning_content) {
          gotReason = true;
          reasoning += m.reasoning_content;
          setReason(ui, m.reasoning_content);
        }
        if (m.content) {
          gotContent = true;
          content += m.content;
          setContent(ui, m.content);
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
  keyIn.oninput = function () {
    cfg.key = keyIn.value.trim();
    save(K_KEY, cfg.key);
    setDot();
    cfgMsg.textContent = cfg.key ? 'Key 已保存到本机' : '';
  };
  keyIn.onblur = function () {
    cfg.key = keyIn.value.trim();
    save(K_KEY, cfg.key);
    setDot();
    if (cfg.key) cfgMsg.textContent = 'Key 已保存到本机';
  };
  baseIn.onchange = function () {
    var b = baseIn.value.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(b)) b = 'https://api.deepseek.com';
    cfg.base = b;
    baseIn.value = b;
    save(K_BASE, b);
  };
  eyeBtn.onclick = function () {
    var hidden = keyIn.type === 'password';
    keyIn.type = hidden ? 'text' : 'password';
    eyeBtn.textContent = hidden ? '隐藏' : '显示';
  };
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
    try { stop(); } catch (e) {}
    try { document.removeEventListener('keydown', onKey); } catch (e) {}
    if (window.__fhAIStop === stop) window.__fhAIStop = null;
    if (fhPanel) fhPanel.style.display = fhDisplay == null ? '' : fhDisplay;
    root.remove();
  }
  function onKey(e) {
    if (e.key !== 'Escape') return;
    if (cfgBox.classList.contains('on')) { openCfg(false); return; }
    close();
  }
  closeBtn.onclick = close;
  shade.onclick = close;
  document.addEventListener('keydown', onKey);
  window.__fhAIStop = stop;

  document.body.append(root);
  applyTheme();
  setDot();
  setStat();
  renderHistory();
  grow();

  if (!cfg.key) {
    openCfg(true);
    cfgMsg.textContent = '首次使用：先填 API Key，会自动保存在本机。';
  } else {
    setTimeout(function () { ta.focus(); }, 80);
  }
})();
