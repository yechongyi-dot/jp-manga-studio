'use strict';
// 题材层 · 雅虎财经(日本)动态榜单 feed。
// 数据源：https://finance.yahoo.co.jp/stocks/ranking/{type}?market={market}&term={term}
//   - 雅虎封 HTTP/1.1（404），故用 net-h2 的 h2GetVia（ALPN h2）。
//   - 页面内 __PRELOADED_STATE__.stocksRanking.items 即结构化榜单，直接吃 JSON。
// 产出归一化后的候选股列表，喂给后续「组稿」。每次抓取都是当日实时 → 内容自更新。
const { h2GetVia } = require('./net-h2');

const HOST = 'finance.yahoo.co.jp';

// 题材 → 雅虎榜单 type。可扩充（type 全集见 stocksRankingFilter.typeItems）。
const RANKING_TYPES = {
  surge:        'up',             // 値上がり率（暴涨）
  drop:         'down',           // 値下がり率
  dividend:     'dividendYield',  // 配当利回り（高配当）
  volume:       'tradingVolume',  // 出来高
  turnover:     'tradingValue',   // 売買代金
};

async function h2GetRetry(host, path, { proxy, tries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await h2GetVia(host, path, proxy);
      if (r.status === 200 && r.body) return r;
      lastErr = new Error('HTTP ' + r.status);
    } catch (e) { lastErr = e; }
    await new Promise(r => setTimeout(r, 500 + i * 400));   // SOCKS5 首连偶发抖动，退避重试
  }
  throw lastErr;
}

function extractPreloadedState(html) {
  const m = html.match(/__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
  if (!m) throw new Error('未找到 __PRELOADED_STATE__');
  return JSON.parse(m[1]);
}

// 巨大な円の純数字 → 兆/億 表記（売買代金・時価総額ランキング等の見やすさ）
function formatYen(n) {
  if (!isFinite(n) || n <= 0) return '';
  if (n >= 1e12) return (n / 1e12).toFixed(2).replace(/\.?0+$/, '') + '兆円';
  if (n >= 1e8)  return Math.round(n / 1e8).toLocaleString('ja-JP') + '億円';
  return Math.round(n).toLocaleString('ja-JP') + '円';
}

// 归一化一行榜单 → { rank, code, name, market, metric, metricLabel, link }
function normalizeRow(row, metricLabel) {
  const v = Array.isArray(row.values) && row.values[0] ? row.values[0] : {};
  let metric = [v.prefix, v.value, v.suffix].filter(Boolean).join('');
  // 9桁以上の純数字(売買代金/時価総額など)は 兆/億 に整形
  const plain = metric.replace(/[,\s]/g, '');
  if (/^\d{9,}$/.test(plain)) metric = formatYen(parseInt(plain, 10));
  return {
    rank:   row.rank,
    code:   String(row.code || '').trim(),
    name:   String(row.name || '').trim(),
    market: row.marketName || '',
    metric,                       // 例 "+8.47%"（该榜单的指标值）
    metricLabel: metricLabel || '',
    link:   row.link || '',
  };
}

/**
 * 抓取一个雅虎榜单。
 * @param {string} theme  RANKING_TYPES 的键（surge/dividend/...）或直接传雅虎 type
 * @param {object} opts   { market='all', term='daily', limit=20, proxy }
 * @returns {Promise<{theme,type,asOf,label,items:Array}>}
 */
async function fetchRanking(theme, opts = {}) {
  const { market = 'all', term = 'daily', limit = 20, proxy } = opts;
  const type = RANKING_TYPES[theme] || theme;
  const path = `/stocks/ranking/${type}?market=${market}&term=${term}`;
  const r = await h2GetRetry(HOST, path, { proxy });
  const state = extractPreloadedState(r.body);
  const sr = state.stocksRanking || {};
  const items = (sr.items || (sr.stocksRankingResult && sr.stocksRankingResult.items) || []);
  // 当前榜单的指标中文/日文标签（从 filter 里找选中的 type）
  let label = type;
  const ti = state.stocksRankingFilter && state.stocksRankingFilter.typeItems;
  if (Array.isArray(ti)) {
    for (const grp of ti) for (const it of (grp.items || [])) if (it.value === type) label = it.label;
  }
  return {
    theme, type, label,
    asOf: new Date().toISOString().slice(0, 10),
    items: items.slice(0, limit).map(row => normalizeRow(row, label)),
  };
}

// 列出雅虎当前支持的全部榜单 type（用于扩充 RANKING_TYPES）
async function listRankingTypes(opts = {}) {
  const r = await h2GetRetry(HOST, '/stocks/ranking/up?market=all&term=daily', { proxy: opts.proxy });
  const state = extractPreloadedState(r.body);
  const out = [];
  const ti = state.stocksRankingFilter && state.stocksRankingFilter.typeItems;
  if (Array.isArray(ti)) for (const grp of ti) for (const it of (grp.items || [])) out.push({ value: it.value, label: it.label });
  return out;
}

module.exports = { fetchRanking, listRankingTypes, RANKING_TYPES };

// 直接运行 = 自检
if (require.main === module) {
  (async () => {
    console.log('支持的榜单 type：');
    console.log((await listRankingTypes()).map(t => `${t.value}(${t.label})`).join(' / '));
    for (const theme of ['surge', 'dividend']) {
      const r = await fetchRanking(theme, { limit: 5 });
      console.log(`\n[${r.theme}] ${r.label}  ${r.asOf}`);
      r.items.forEach(s => console.log(`  #${s.rank} ${s.code} ${s.name}  ${s.metric}`));
    }
  })().catch(e => console.error('❌', e.message));
}
