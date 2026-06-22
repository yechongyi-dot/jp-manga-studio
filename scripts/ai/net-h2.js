'use strict';
// 全新 AI 管线 · 网络传输层（从 jp-manga-studio-pro 移植）
// 关键能力：h2GetVia —— 用 HTTP/2 (ALPN h2) 攻克「雅虎在 node HTTP/1.1 下返回 404」的反爬。
// 零依赖（Node 内置 http2），支持 SOCKS5/HTTP 代理隧道或直连。
const net   = require('net');
const http  = require('http');
const https = require('https');
const tls   = require('tls');
const http2 = require('http2');

const UA        = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const PROXY = (process.env.JP_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || '').trim();

// HTTP 代理 CONNECT → target:443 raw socket
function tunnelHttp(proxyHost, proxyPort, target) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: proxyHost, port: proxyPort || 80, method: 'CONNECT', path: `${target}:443`, headers: { Host: `${target}:443` }, timeout: 8000 });
    req.on('connect', (res, socket) => res.statusCode === 200 ? resolve(socket) : reject(new Error('HTTP代理CONNECT失败 ' + res.statusCode)));
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('HTTP代理超时')));
    req.end();
  });
}

// SOCKS5（無認証）CONNECT → target:443 raw socket
function tunnelSocks5(proxyHost, proxyPort, target) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(proxyPort, proxyHost);
    let done = false, buf = Buffer.alloc(0), stage = 0;
    const fail = e => { if (!done) { done = true; socket.destroy(); reject(e); } };
    socket.setTimeout(8000, () => fail(new Error('SOCKS5代理超时')));
    socket.on('error', fail);
    socket.once('connect', () => socket.write(Buffer.from([0x05, 0x01, 0x00])));
    socket.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      if (stage === 0) {
        if (buf.length < 2) return;
        if (buf[0] !== 0x05 || buf[1] !== 0x00) return fail(new Error('SOCKS5握手被拒(需账号密码?)'));
        buf = buf.slice(2); stage = 1;
        const h = Buffer.from(target);
        socket.write(Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x03, h.length]), h, Buffer.from([(443 >> 8) & 0xff, 443 & 0xff])]));
      }
      if (stage === 1) {
        if (buf.length < 4) return;
        if (buf[1] !== 0x00) return fail(new Error('SOCKS5 CONNECT失败 rep=' + buf[1]));
        const atyp = buf[3];
        let need = 6;
        if (atyp === 0x01) need += 4; else if (atyp === 0x04) need += 16;
        else if (atyp === 0x03) { if (buf.length < 5) return; need += 1 + buf[4]; }
        else return fail(new Error('SOCKS5未知地址类型'));
        if (buf.length < need) return;
        const leftover = buf.slice(need);
        done = true;
        socket.removeAllListeners('data'); socket.removeAllListeners('error'); socket.setTimeout(0);
        if (leftover.length) socket.unshift(leftover);
        resolve(socket);
      }
    });
  });
}

// 代理隧道 or 直連 → raw socket（443）
async function rawSocketVia(host, proxy) {
  const px = (proxy == null ? PROXY : proxy);
  if (px) {
    const u = new URL(px);
    return /^socks/i.test(u.protocol)
      ? tunnelSocks5(u.hostname, +u.port, host)
      : tunnelHttp(u.hostname, +u.port, host);
  }
  return new Promise((res, rej) => {
    const s = net.connect(443, host);
    s.once('connect', () => res(s)); s.once('error', rej);
  });
}

// 汎用 HTTPS/1.1 GET（隧道/直連）→ { status, body }
async function httpsGetVia(host, reqPath, proxy, headersOverride) {
  const px = (proxy == null ? PROXY : proxy);
  const headers = headersOverride || { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'ja,en;q=0.8' };
  let createConnection;
  if (px) {
    const sock = await rawSocketVia(host, px);
    createConnection = () => tls.connect({ socket: sock, servername: host });
  }
  return new Promise((resolve, reject) => {
    const opts = { host, path: reqPath, headers, timeout: 12000 };
    if (createConnection) opts.createConnection = createConnection;
    const req = https.get(opts, res => {
      let d = ''; res.setEncoding('utf8');
      res.on('data', c => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

// HTTP/2（ALPN h2）GET。Yahoo!ファイナンス等 HTTP/1.1 だと 404 を返すサイト用。
async function h2GetVia(host, reqPath, proxy, headersOverride) {
  const px = (proxy == null ? PROXY : proxy);
  const rawSocket = await rawSocketVia(host, px);
  const tlsSock = tls.connect({ socket: rawSocket, servername: host, ALPNProtocols: ['h2', 'http/1.1'] });
  await new Promise((res, rej) => { tlsSock.once('secureConnect', res); tlsSock.once('error', rej); });
  if (tlsSock.alpnProtocol !== 'h2') { tlsSock.destroy(); throw new Error('ALPN h2 不可用'); }

  const reqHeaders = Object.assign({
    ':method': 'GET', ':path': reqPath,
    'user-agent': MOBILE_UA, 'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'ja-JP,ja;q=0.9,en;q=0.8',
  }, headersOverride || {});
  return new Promise((resolve, reject) => {
    const client = http2.connect(`https://${host}`, { createConnection: () => tlsSock });
    let settled = false;
    const done = (fn, arg) => { if (!settled) { settled = true; try { client.close(); } catch {} fn(arg); } };
    client.on('error', e => done(reject, e));
    const req = client.request(reqHeaders);
    let status, body = '';
    req.setEncoding('utf8');
    req.on('response', h => { status = h[':status']; });
    req.on('data', d => { body += d; });
    req.on('end', () => done(resolve, { status, body }));
    req.on('error', e => done(reject, e));
    req.setTimeout(15000, () => req.destroy(new Error('h2 timeout')));
  });
}

module.exports = { httpsGetVia, h2GetVia, rawSocketVia, UA, MOBILE_UA, PROXY };
