<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: *');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$url = isset($_GET['url']) ? trim($_GET['url']) : '';
if ($url === '') { header('Content-Type: text/plain; charset=utf-8'); echo "proxy ok\n"; exit; }
if (!preg_match('#^https?://#i', $url)) { http_response_code(400); echo 'bad url'; exit; }

$ctx = stream_context_create([
  'http' => [
    'method' => 'GET',
    'header' => "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36\r\n",
    'follow_location' => 1,
    'max_redirects' => 5,
    'timeout' => 15,
  ],
]);

$body = @file_get_contents($url, false, $ctx);
if ($body === false) {
  http_response_code(502);
  header('Content-Type: text/plain; charset=utf-8');
  echo 'fetch failed';
  exit;
}

$ct = 'text/plain; charset=utf-8';
if (isset($http_response_header)) {
  foreach ($http_response_header as $h) {
    if (stripos($h, 'content-type:') === 0) { $ct = trim(substr($h, 13)); }
  }
}
header('Content-Type: ' . $ct);
echo $body;
