'use strict';
const net   = require('net');
const http  = require('http');
const https = require('https');
const tls   = require('tls');

// 株探（kabutan.jp）から東証銘柄の実価格・日本語社名を取得する。
//   GET https://kabutan.jp/stock/?code={code}
// ページに「【{code}】」が含まれることを検証する（存在しないコードはエラーページ＝弾かれる）。
// → AI が捏造したコードは価格取得に失敗 → 上位で除外できる。
//
// ※ Yahoo Finance API はサーバー側の TLS フィンガープリント判定で Node からの取得が
//    404 になる（curl は可）。株探は素直に取れ、かつ日本語の正式社名が得られるため採用。
//
// 中国大陸からの直連は不安定なため、代理トンネル（零依存、HTTP / SOCKS5）に対応：
//   JP_PROXY=http://127.0.0.1:7890       （Clash 等 HTTP 代理）
//   JP_PROXY=socks5://127.0.0.1:7890     （v2rayN 等 SOCKS5 代理）
// 海外/日本のマシンは未設定なら直連。
//
//   fetchQuote(code)           → JP_PROXY を使用、失敗は null（バッチ生成用）
//   fetchQuoteVia(proxy, code) → 指定 proxy（''=強制直連）、失敗は throw（UI テストで原因表示）

const HOST  = 'kabutan.jp';
const UA    = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const PROXY = (process.env.JP_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || '').trim();
const CODE_RE = /^\d{4}[A-Z]?$/;   // 4桁東証コード（新コード体系 130A 等の末尾英字1つも許容）

// HTTP 代理 CONNECT → target:443 への raw socket
function tunnelHttp(proxyHost, proxyPort, target) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: proxyHost, port: proxyPort || 80, method: 'CONNECT', path: `${target}:443`, headers: { Host: `${target}:443` }, timeout: 8000 });
    req.on('connect', (res, socket) => res.statusCode === 200 ? resolve(socket) : reject(new Error('HTTP代理CONNECT失败 ' + res.statusCode)));
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('HTTP代理超时')));
    req.end();
  });
}

// SOCKS5（無認証）CONNECT → target:443 への raw socket
function tunnelSocks5(proxyHost, proxyPort, target) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(proxyPort, proxyHost);
    let done = false, buf = Buffer.alloc(0), stage = 0;
    const fail = e => { if (!done) { done = true; socket.destroy(); reject(e); } };
    socket.setTimeout(8000, () => fail(new Error('SOCKS5代理超时')));
    socket.on('error', fail);
    socket.once('connect', () => socket.write(Buffer.from([0x05, 0x01, 0x00])));   // 挨拶：無認証
    socket.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      if (stage === 0) {
        if (buf.length < 2) return;
        if (buf[0] !== 0x05 || buf[1] !== 0x00) return fail(new Error('SOCKS5握手被拒(需账号密码?)'));
        buf = buf.slice(2); stage = 1;
        const h = Buffer.from(target);                                             // CONNECT domain:443
        socket.write(Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x03, h.length]), h, Buffer.from([(443 >> 8) & 0xff, 443 & 0xff])]));
      }
      if (stage === 1) {
        if (buf.length < 4) return;
        if (buf[1] !== 0x00) return fail(new Error('SOCKS5 CONNECT失败 rep=' + buf[1]));
        const atyp = buf[3];
        let need = 6;                                                              // VER REP RSV ATYP + PORT(2)
        if (atyp === 0x01) need += 4; else if (atyp === 0x04) need += 16;
        else if (atyp === 0x03) { if (buf.length < 5) return; need += 1 + buf[4]; }
        else return fail(new Error('SOCKS5未知地址类型'));
        if (buf.length < need) return;
        const leftover = buf.slice(need);
        done = true;
        socket.removeAllListeners('data'); socket.removeAllListeners('error'); socket.setTimeout(0);
        if (leftover.length) socket.unshift(leftover);                            // 粘着データを後続 TLS に戻す
        resolve(socket);
      }
    });
  });
}

// 隧道（proxy 协议別）または直連で株探の銘柄ページを GET → { status, body }
async function apiGet(code, proxy) {
  const px = (proxy == null ? PROXY : proxy);                                     // null/undefined→環境変数；''→強制直連
  const reqPath = `/stock/?code=${code}`;
  const headers = { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'ja,en;q=0.8' };
  let createConnection;
  if (px) {
    const u = new URL(px);
    const sock = /^socks/i.test(u.protocol)
      ? await tunnelSocks5(u.hostname, +u.port, HOST)
      : await tunnelHttp(u.hostname, +u.port, HOST);
    createConnection = () => tls.connect({ socket: sock, servername: HOST });
  }
  return new Promise((resolve, reject) => {
    const opts = { host: HOST, path: reqPath, headers, timeout: 10000 };
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

function parseKabutan(code, body) {
  if (!body || !body.includes(`【${code}】`)) return null;   // コード不一致/存在しない → null（天然校验）
  // 現在値：class="kabuka" の表示値（カンマ込み）優先、無ければ affiliate link の stock_price=
  let m = body.match(/class="kabuka"[^>]*>\s*([\d,]+(?:\.\d+)?)/);
  let price = m ? Number(m[1].replace(/,/g, '')) : null;
  if (price == null || !isFinite(price)) { m = body.match(/stock_price=([\d.]+)/); price = m ? Number(m[1]) : null; }
  if (price == null || !isFinite(price) || price <= 0) return null;
  // 企業名：<title>「○○（…）【code】…」の冒頭（全角/半角括弧の手前まで）
  const tm = body.match(/<title>\s*([^（(【\n]+)/);
  const name = tm ? tm[1].trim() : null;
  return { code: String(code), name, price, currency: 'JPY' };
}

// バッチ生成用：JP_PROXY を使用。失敗（HTTP非200 / 解析不可 / 例外）は null。
async function fetchQuote(code) {
  if (!CODE_RE.test(String(code))) return null;
  try {
    const { status, body } = await apiGet(code);
    if (status !== 200) return null;
    return parseKabutan(code, body);
  } catch {
    return null;
  }
}

// UI テスト用：指定 proxy（''=直連）。失敗は throw して原因を表示。
async function fetchQuoteVia(proxy, code) {
  if (!CODE_RE.test(String(code))) throw new Error('股票代码格式错误（需4位东证代码）');
  const { status, body } = await apiGet(code, (proxy || '').trim());
  if (status !== 200) throw new Error('HTTP ' + status);
  const q = parseKabutan(code, body);
  if (!q) throw new Error('返回无法解析或该代码不存在');
  return q;
}

module.exports = { fetchQuote, fetchQuoteVia, PROXY };
