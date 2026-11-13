// 本地 CORS 代理：node proxy.js
// 用法：http://<局域网IP>:8787/?url=<encodeURIComponent(目标地址)>
// 支持 GET/POST/OPTIONS、Authorization、流式 SSE（聊天打字机效果）。
// 可选环境变量：
//   PORT=8787
//   ALLOW_HOSTS=oi-debug.mywwzh.top,developer.amd.com.cn,api.deepseek.com
//   PROXY_TOKEN=...（设置后请求需带 x-proxy-token；插件暂不发送，留空即可）
const http = require('http');
const { Readable } = require('stream');

const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.PROXY_TOKEN || '';
const ALLOW = String(process.env.ALLOW_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, x-proxy-token',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'Content-Type, Content-Length'
  };
}
function allowHost(host) {
  if (!ALLOW.length) return true;
  host = String(host || '').toLowerCase();
  return ALLOW.some(h => host === h || host.endsWith('.' + h));
}
function fail(res, code, msg) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, cors()));
  res.end(msg);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors());
    return res.end();
  }
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/health') return fail(res, 200, 'ok');

  const target = u.searchParams.get('url');
  if (!target) return fail(res, 400, '用法: /?url=<encodeURIComponent(目标地址)>');

  let dest;
  try { dest = new URL(target); } catch (e) { return fail(res, 400, 'url 参数不是合法地址'); }
  if (!/^https?:$/i.test(dest.protocol) || !allowHost(dest.hostname)) {
    return fail(res, 403, '目标域名不在允许列表');
  }
  if (TOKEN && req.headers['x-proxy-token'] !== TOKEN) {
    return fail(res, 401, 'proxy token 无效');
  }

  let body = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = Buffer.concat(chunks);
  }

  const headers = {};
  if (req.headers.authorization) headers.Authorization = req.headers.authorization;
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  if (req.headers.accept) headers.Accept = req.headers.accept;

  try {
    const r = await fetch(dest.toString(), { method: req.method, headers, body, redirect: 'follow' });
    const out = Object.assign({
      'Content-Type': r.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'no-store'
    }, cors());
    res.writeHead(r.status, out);
    if (!r.body) return res.end();
    Readable.fromWeb(r.body).pipe(res);
  } catch (e) {
    fail(res, 502, 'proxy error: ' + (e && e.message ? e.message : e));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('proxy listening on http://0.0.0.0:' + PORT);
  console.log('允许域名: ' + (ALLOW.length ? ALLOW.join(', ') : '全部（建议用 ALLOW_HOSTS 限制）'));
  console.log('用法: http://<本机局域网IP>:' + PORT + '/?url=<encoded>');
});
