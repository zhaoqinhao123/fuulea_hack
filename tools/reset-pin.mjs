#!/usr/bin/env node
/**
 * fuulea_hack · 云端配置 PIN 重置（仓库管理员用）
 *
 * 用途：用户忘记 PIN 时，管理员用自己保存的「管理员密钥」解出配置的随机会话密钥，
 *       只重新包裹新 PIN，配置内容（box）与配置 ID 完全不变。
 *
 * 运行（GitLab CI 手动任务 reset-pin，或本机）：
 *   CONFIG_ID=u1a2b3c4d5 NEW_PIN='新PIN' ADMIN_KEY='管理员密钥' node tools/reset-pin.mjs
 *   若同时提供 GITLAB_TOKEN（api 权限），会把新 JSON 直接写回仓库；
 *   否则把 stdout 里的 JSON 手动提交到 config/<id>.json。
 *
 * 环境变量：
 *   CONFIG_ID     必填，配置文件名（不带 config/ 与 .json）
 *   NEW_PIN       必填，6-30 位，不含空格
 *   ADMIN_KEY     必填，上传配置时设置的管理员密钥
 *   GITLAB_TOKEN  可选，有写权限时直接写回
 */
'use strict';

const PROJ = '88544686';
const BRANCH = 'main';
const ITER = 150000;
const API = 'https://gitlab.com/api/v4/projects/' + PROJ;

const env = process.env;
const id = String(env.CONFIG_ID || '').trim().replace(/^config\//, '').replace(/\.json$/, '');
const pin = String(env.NEW_PIN || '').trim();
const adm = String(env.ADMIN_KEY || '').trim();
const tok = String(env.GITLAB_TOKEN || '').trim();

function die(msg) {
  console.error('✖ ' + msg);
  process.exit(1);
}

if (!id) die('缺少 CONFIG_ID');
if (!/^[^\s]{6,30}$/.test(pin)) die('NEW_PIN 需 6-30 位且不含空格');
if (!adm) die('缺少 ADMIN_KEY');
if (!globalThis.crypto || !crypto.subtle) die('需要 Node 20+（WebCrypto）');

const te = new TextEncoder();
const td = new TextDecoder();

const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64');
const unb64 = (s) => new Uint8Array(Buffer.from(String(s || ''), 'base64'));

async function kdf(pass, saltB64) {
  const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

async function enc(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
  return b64(iv) + '.' + b64(ct);
}

async function dec(key, s) {
  const p = String(s || '').split('.');
  if (p.length !== 2) throw new Error('密文格式不对');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p[0]) }, key, unb64(p[1]));
  return JSON.parse(td.decode(pt));
}

async function main() {
  const rawUrl = API + '/repository/files/' + encodeURIComponent('config/' + id + '.json') +
    '/raw?ref=' + BRANCH + '&t=' + Date.now();
  const r = await fetch(rawUrl);
  if (!r.ok) die('读取配置失败 HTTP ' + r.status);
  const o = await r.json();
  if (!o || !o.kdf || !o.id || !o.box) die('配置内容不完整（缺 kdf/id/box）');
  if (o.id !== id) die('配置 id 与文件名不一致：' + o.id);

  let dkRaw;
  try {
    dkRaw = await dec(await kdf('adm|' + o.id + '|' + adm, o.kdf.salt), o.wrapAdm);
  } catch (e) {
    die('管理员密钥不正确（或该配置没有 wrapAdm）');
  }

  const payload = Object.assign({}, o, {
    at: new Date().toISOString(),
    wrapPin: await enc(await kdf('pin|' + o.id + '|' + pin, o.kdf.salt), dkRaw)
  });

  if (!tok) {
    console.log(JSON.stringify(payload, null, 2));
    console.error('ℹ 未提供 GITLAB_TOKEN：请把上面的 JSON 手动提交到 config/' + id + '.json');
    return;
  }

  const body = JSON.stringify({
    branch: BRANCH,
    content: JSON.stringify(payload, null, 2),
    encoding: 'text',
    commit_message: 'reset pin ' + o.id + ' @ ' + new Date().toISOString()
  });
  const url = API + '/repository/files/' + encodeURIComponent('config/' + id + '.json');
  let w = await fetch(url, { method: 'PUT', headers: { 'PRIVATE-TOKEN': tok, 'Content-Type': 'application/json' }, body });
  if (!w.ok) {
    w = await fetch(url, { method: 'POST', headers: { 'PRIVATE-TOKEN': tok, 'Content-Type': 'application/json' }, body });
  }
  if (!w.ok) die('写回失败 HTTP ' + w.status + '：' + (await w.text()).slice(0, 300));
  console.error('✅ 已重置 PIN：config/' + id + '.json');
}

main().catch((e) => die(e && e.message ? e.message : String(e)));
