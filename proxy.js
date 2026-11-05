// 本地 CORS 代理：node proxy.js
// 用法：http://<局域网IP>:8787/?url=<encodeURIComponent(目标地址)>
const http = require('http');

const PORT = 8787;

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.end();

  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/health') return res.end('ok');

  const target = u.searchParams.get('url');
  if (!target) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('用法: /?url=<encodeURIComponent(目标地址)>');
  }

  try {
    const r = await fetch(target, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' }
    });
    const buf = Buffer.from(await r.arrayBuffer());
    res.statusCode = r.status;
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/octet-stream');
    res.end(buf);
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('proxy error: ' + e.message);
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log('proxy listening on http://0.0.0.0:' + PORT);
  console.log('用法: http://<本机局域网IP>:' + PORT + '/?url=<encoded>');
});
