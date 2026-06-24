'use strict';
// 选股：题材 → 雅虎实时榜单候选 → 株探补全真数据 → 返回 count 只（真数据先行，防编造）。
const { fetchRanking } = require('./feed-yahoo');
const { fetchQuote } = require('./quote');
const { mapConc } = require('./util');

/**
 * @param {object} theme   themes.json 的一项（含 feed 配置）
 * @param {number} count   需要的股票数
 * @param {object} opts    { proxy, exclude=[], pool=该题材榜单上限 }
 * @returns {Promise<{theme,label,asOf,stocks:Array}>}
 */
async function selectStocks(theme, count, opts = {}) {
  const { proxy, exclude = [] } = opts;
  const f = theme.feed || {};
  const feed = await fetchRanking(f.ranking, { market: f.market, term: f.term, limit: f.limit, proxy });
  const ex = new Set(exclude.map(String));
  // 候选去重去排除。多取一批(count 的 ~2.5 倍 + 缓冲)做株探补全，抵消补全失败 → 尽量保证选够 count 只。
  const seen = new Set();
  const candidates = feed.items.filter(r => {
    if (!r.code || ex.has(r.code) || seen.has(r.code)) return false;
    seen.add(r.code); return true;
  });
  const tryList = candidates.slice(0, Math.min(candidates.length, Math.max(count * 2 + 4, count + 6)));
  // 并行补全(株探)，保持榜单顺序；并发 4，过高易被株探限流
  const quotes = await mapConc(tryList, 4, async row => {
    const q = await fetchQuote(row.code, { proxy });   // 失败 → null(代码不存在/解析失败/限流)
    return q ? { row, q } : null;
  });
  const stocks = [];
  for (const r of quotes) {                              // 仍按榜单顺序取前 count 只成功的
    if (stocks.length >= count) break;
    if (!r) continue;
    const { row, q } = r;
    stocks.push({
      code: row.code,
      name: q.name || row.name,
      price: q.price,
      pct: row.metric,                 // 该题材榜单指标值(涨幅/利回り等)
      rankMetricLabel: row.metricLabel,
      per: q.per, pbr: q.pbr, dividend: q.dividend, marketCap: q.marketCap,
      salesYoy: q.salesYoy, profitYoy: q.profitYoy, earningsTrend: q.earningsTrend,
    });
  }
  return { theme: theme.id, label: feed.label, asOf: feed.asOf, stocks };
}

module.exports = { selectStocks };

// 直接运行 = 自检（实时数据）
if (require.main === module) {
  const { loadLayers } = require('./layers');
  (async () => {
    const { themes } = loadLayers();
    const theme = themes.find(t => t.id === (process.argv[2] || 'surge'));
    console.log(`选股自检：题材 ${theme.id} (${theme.name})`);
    const r = await selectStocks(theme, 3);
    console.log(`${r.label} ${r.asOf}  实选 ${r.stocks.length} 只：`);
    r.stocks.forEach(s => console.log(
      `  ${s.code} ${s.name}  価=${s.price} ${s.rankMetricLabel}=${s.pct}  PER=${s.per||'-'} PBR=${s.pbr||'-'} 配当=${s.dividend||'-'} 時価=${s.marketCap||'-'} 業績=${s.earningsTrend||'-'}`
    ));
  })().catch(e => console.error('❌', e.message));
}
