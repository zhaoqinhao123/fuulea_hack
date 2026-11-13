// Cloudflare Worker：给中转站补 CORS 头，插件里填 Worker 地址即可。
// 部署：Cloudflare Dashboard → Workers & Pages → Create Worker → 粘贴本文件 → Deploy。
// 用法：https://<你的>.workers.dev/?url=<encodeURIComponent(目标地址)>
// 可选环境变量：
//   ALLOW_HOSTS = "oi-debug.mywwzh.top,developer.amd.com.cn,api.deepseek.com"（逗号分隔）
//   PROXY_TOKEN = "..."（设置后插件请求需带 x-proxy-token 头；本插件暂不发送，留空即可）
// 说明：Authorization 只透传，不落盘、不打印；不会把 Key 写进日志。

const DEFAULT_HOSTS = ['oi-debug.mywwzh.top', 'developer.amd.com.cn', 'api.deepseek.com'];

function cors(extra) {
  return Object.assign({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, x-proxy-token',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'Content-Type, Content-Length'
  }, extra || {});
}

function allowHost(host, env) {
  const raw = (env && env.ALLOW_HOSTS) || '';
  const list = (raw ? String(raw).split(',') : DEFAULT_HOSTS).map(s => s.trim().toLowerCase()).filter(Boolean);
  host = String(host || '').toLowerCase();
  return list.some(h => host === h || host.endsWith('.' + h));
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() });
    }

    const u = new URL(request.url);
    const target = u.searchParams.get('url');
    if (!target) {
      return new Response('用法: /?url=<encodeURIComponent(目标地址)>', {
        status: 400,
        headers: cors({ 'Content-Type': 'text/plain; charset=utf-8' })
      });
    }

    let dest;
    try { dest = new URL(target); } catch (e) {
      return new Response('url 参数不是合法地址', { status: 400, headers: cors({ 'Content-Type': 'text/plain; charset=utf-8' }) });
    }
    if (!/^https?:$/i.test(dest.protocol) || !allowHost(dest.hostname, env)) {
      return new Response('目标域名不在允许列表', { status: 403, headers: cors({ 'Content-Type': 'text/plain; charset=utf-8' }) });
    }
    if (env && env.PROXY_TOKEN) {
      if (request.headers.get('x-proxy-token') !== env.PROXY_TOKEN) {
        return new Response('proxy token 无效', { status: 401, headers: cors({ 'Content-Type': 'text/plain; charset=utf-8' }) });
      }
    }

    const headers = new Headers();
    const auth = request.headers.get('Authorization');
    const ct = request.headers.get('Content-Type');
    const accept = request.headers.get('Accept');
    if (auth) headers.set('Authorization', auth);
    if (ct) headers.set('Content-Type', ct);
    if (accept) headers.set('Accept', accept);

    const init = { method: request.method, headers, redirect: 'follow' };
    if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;

    try {
      const r = await fetch(dest.toString(), init);
      const out = new Headers(cors());
      out.set('Content-Type', r.headers.get('Content-Type') || 'application/octet-stream');
      out.set('Cache-Control', 'no-store');
      return new Response(r.body, { status: r.status, headers: out });
    } catch (e) {
      return new Response('proxy error: ' + (e && e.message ? e.message : e), {
        status: 502,
        headers: cors({ 'Content-Type': 'text/plain; charset=utf-8' })
      });
    }
  }
};
