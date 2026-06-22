'use strict';
// 株探(kabutan.jp) 个股真数据补全（从 pro 移植富字段解析；传输走 net-h2）。
// 用于「真数据先行」：选股后逐只补全 价/PER/PBR/配当/時価総額/業績前年比，
// 失败(代码不存在/解析不可)返回 null → 上层跳过 → 杜绝 AI 编造。
const { httpsGetVia } = require('./net-h2');

const HOST = 'kabutan.jp';
const CODE_RE = /^\d{3,4}[A-Z]?$/;   // 4桁東証コード（新コード体系 130A 等末尾英字1つも許容）

function parseKabutan(code, body) {
  if (!body || !body.includes(`【${code}】`)) return null;
  let m = body.match(/class="kabuka"[^>]*>\s*([\d,]+(?:\.\d+)?)/);
  let price = m ? Number(m[1].replace(/,/g, '')) : null;
  if (price == null || !isFinite(price)) { m = body.match(/stock_price=([\d.]+)/); price = m ? Number(m[1]) : null; }
  if (price == null || !isFinite(price) || price <= 0) return null;
  const tm = body.match(/<title>\s*([^（(【\n]+)/);
  const name = tm ? tm[1].trim() : null;

  // 株価指標テーブル（固定列順 PER / PBR / 配当利回り）
  let per = null, pbr = null, dividend = null;
  const perIdx = body.indexOf('data-help="PER"');
  if (perIdx !== -1) {
    const region = body.slice(perIdx, perIdx + 1200);
    const cells = [...region.matchAll(/<td[^>]*>\s*(－|[\d,.]+)\s*<span[^>]*>\s*(?:倍|％|%)\s*<\/span>/g)]
      .map(x => (x[1] === '－' ? null : x[1]));
    if (cells[0]) per      = cells[0] + '倍';
    if (cells[1]) pbr      = cells[1] + '倍';
    if (cells[2]) dividend = cells[2] + '%';
  }

  // 時価総額
  let marketCap = null;
  const mcIdx = body.indexOf('時価総額', perIdx >= 0 ? perIdx : 0);
  if (mcIdx !== -1) {
    const mcTxt = body.slice(mcIdx, mcIdx + 240).replace(/<[^>]+>/g, '').replace(/\s+/g, '');
    const mcM = mcTxt.match(/((?:[\d,]+兆)?[\d,]+億円|[\d,]+百万円)/);
    if (mcM) marketCap = mcM[1];
  }

  // 業績 前期比（今期会社予想の前年比）：[売上高, 経常益, ...]
  let salesYoy = null, profitYoy = null, earningsTrend = null;
  const yIdx = body.indexOf('前期比');
  if (yIdx !== -1) {
    const yTxt = body.slice(yIdx, yIdx + 400).replace(/<[^>]+>/g, ' ');
    const nums = [...yTxt.matchAll(/([+\-]?\s*\d+(?:\.\d+)?|－)/g)].map(x => x[1].replace(/\s+/g, '')).slice(0, 4);
    const norm = v => (v == null || v === '－' || v === '') ? null : ((/^[+\-]/.test(v) ? v : '+' + v) + '%');
    salesYoy  = norm(nums[0]);
    profitYoy = norm(nums[1]);
    const sUp = salesYoy  ? !salesYoy.startsWith('-')  : null;
    const pUp = profitYoy ? !profitYoy.startsWith('-') : null;
    if (sUp != null || pUp != null) {
      earningsTrend = (sUp == null ? '' : (sUp ? '増収' : '減収')) + (pUp == null ? '' : (pUp ? '増益' : '減益'));
    }
  }

  // ── 合理性校验：解析值超出现实区间→置 null（绝不输出假值；新式代码股株探表错位时兜底）──
  const num = s => { const n = parseFloat(String(s == null ? '' : s).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : NaN; };
  const inRange = (s, lo, hi) => { const n = num(s); return (n > lo && n <= hi) ? s : null; };
  per      = inRange(per, 0, 1000);     // PER：0〜1000倍
  pbr      = inRange(pbr, 0, 30);       // PBR：0〜30倍（42.74 等误抓拦掉）
  dividend = inRange(dividend, 0, 20);  // 配当利回り：0〜20%（3,244% 等误抓拦掉）
  if (marketCap) {                      // 時価総額：换算「億」上限校验（日本最大~43兆，>50兆视为误解析）
    const mm = String(marketCap).match(/(?:([\d,]+)兆)?\s*([\d,]+)?\s*億/);
    const oku = mm ? (parseInt((mm[1] || '0').replace(/,/g, '')) * 10000 + parseInt((mm[2] || '0').replace(/,/g, ''))) : 0;
    if (!(oku > 0 && oku <= 500000)) marketCap = null;
  }
  if (!(price > 0 && price < 5000000)) return null;
  // 置信度兜底：指标表全部无效＝解析基本失败＝该股数据不可信 → 整只跳过(连现价也不出假值)
  if (!per && !pbr && !dividend && !marketCap) return null;

  return { code: String(code), name, price, per, pbr, dividend, marketCap, salesYoy, profitYoy, earningsTrend, currency: 'JPY' };
}

async function fetchQuote(code, { proxy, tries = 3 } = {}) {
  if (!CODE_RE.test(String(code))) return null;
  // 200 は最終（parse が null でもそれが結論）。網絡エラー/非200 のみ退避リトライ（SOCKS5 首连抖动対策）。
  for (let i = 0; i < tries; i++) {
    try {
      const { status, body } = await httpsGetVia(HOST, `/stock/?code=${code}`, proxy);
      if (status === 200) return parseKabutan(code, body);
    } catch {}
    await new Promise(r => setTimeout(r, 400 + i * 300));
  }
  return null;
}

module.exports = { fetchQuote, parseKabutan };
