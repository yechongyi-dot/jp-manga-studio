'use strict';
// 选股：题材 → 雅虎实时榜单候选 → 株探补全真数据 → 返回 count 只（真数据先行，防编造）。
const { fetchRanking } = require('./feed-yahoo');
const { fetchQuote } = require('./quote');

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
  const stocks = [];
  for (const row of feed.items) {
    if (stocks.length >= count) break;
    if (!row.code || ex.has(row.code)) continue;
    const q = await fetchQuote(row.code, { proxy });   // 真数据补全；失败=跳过(代码不存在/解析失败)
    if (!q) continue;
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
