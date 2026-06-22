'use strict';
// 渲染适配：统一 Script（契约）→ AiVideo 的 inputProps（pro 模板要的形状）。
// 数值映射：price(数字) → buyPrice(字符串"…円")；口播 ttsText → 字幕段。
// 时长/音频：传 opts.durations(帧) / opts.audio(URL) 用真实值；否则估算、无音频。
const FPS = 30;
const INTRO_DUR = 120, CTA_DUR = 120, STOCK_DUR = 200;
const NISA_MARKET_DUR = 150, NISA_PLAN_DUR = 150, NISA_FEATURED_DUR = 170;

function yen(price) {
  if (price == null || price === '') return '';
  if (typeof price === 'number') return price.toLocaleString('ja-JP') + '円';
  return String(price);
}

function toInputProps(script, { format, tone, skin, bgSeed = 42, audio = null, durations = null, bg = null } = {}) {
  const stocks = (script.stocks || []).map(s => ({
    code: s.code, name: s.name,
    buyPrice: yen(s.price),
    pct: s.pct || '',
    metricLabel: s.rankMetricLabel || '',   // 题材核心指标的标签(给新卡片大字显示)
    note: s.note || '',
    per: s.per, pbr: s.pbr, dividend: s.dividend, marketCap: s.marketCap,
    earningsTrend: s.earningsTrend, sector: s.sector,
    ttsText: s.ttsText,
  }));
  const isPortfolio = format.structure === 'portfolio';

  const introDur = (durations && durations.intro) || INTRO_DUR;
  const stockDurations = stocks.map((_, i) => (durations && durations.stocks && durations.stocks[i]) || STOCK_DUR);
  const ctaDur = (durations && durations.cta) || CTA_DUR;
  const marketContextDur  = isPortfolio ? ((durations && durations.market)   || NISA_MARKET_DUR)   : 0;
  const investmentPlanDur = isPortfolio ? ((durations && durations.plan)     || NISA_PLAN_DUR)     : 0;
  const featuredStockDur  = isPortfolio ? ((durations && durations.featured) || NISA_FEATURED_DUR) : 0;

  const ctaText = script.ctaText || 'チャンネル登録とフォローで最新情報をお届けします！';

  // 字幕段（顺序须与模板场景一致：Intro→Stock…→[Market→Plan→Featured]→CTA）
  const subtitleSegs = [
    { text: script.hook || script.title || '', durationInFrames: introDur },
    ...stocks.map((s, i) => ({ text: s.ttsText || s.note || '', durationInFrames: stockDurations[i] })),
  ];
  if (isPortfolio) {
    subtitleSegs.push({ text: script.marketContext  || '', durationInFrames: marketContextDur });
    subtitleSegs.push({ text: script.investmentPlan || '', durationInFrames: investmentPlanDur });
    subtitleSegs.push({ text: script.featured       || '', durationInFrames: featuredStockDur });
  }
  subtitleSegs.push({ text: ctaText, durationInFrames: ctaDur });

  const durationInFrames = introDur + stockDurations.reduce((a, b) => a + b, 0)
    + marketContextDur + investmentPlanDur + featuredStockDur + ctaDur;

  return {
    structure: format.structure,
    stockSceneId: format.stockScene,
    themeId: (skin && skin.theme) || 'JP_PRIME',   // 配色来自皮肤轴(与口吻解耦)
    bg: bg || { type: 'procedural', id: 'theme' },
    script: {
      title: script.title || '',
      subtitle: script.subtitle || '',
      stocks,
      ctaText,
      ctaLineId: script.ctaLineId || '',
      dateStr: script.meta && script.meta.asOf,
      marketContext: script.marketContext,
      initialCapital: script.initialCapital,
      targetProfitMin: script.targetProfitMin,
      targetProfitMax: script.targetProfitMax,
      featuredCurrentPrice: script.featuredCurrentPrice,
      featuredTargetPrice: script.featuredTargetPrice,
      featuredPct: script.featuredPct,
    },
    fps: FPS,
    durationInFrames,
    introDur,
    stockDurations,
    ctaDur,
    marketContextDur, investmentPlanDur, featuredStockDur,
    marketContextText: script.marketContext,
    investmentPlanText: script.investmentPlan,
    featuredText: script.featured,
    introAudioPath: audio ? audio.intro : undefined,
    stockAudioPaths: stocks.map((_, i) => (audio && audio.stocks && audio.stocks[i]) || ''),
    ctaAudioPath: audio ? audio.cta : undefined,
    marketContextAudioPath:  audio ? audio.market   : undefined,
    investmentPlanAudioPath: audio ? audio.plan     : undefined,
    featuredStockAudioPath:  audio ? audio.featured : undefined,
    subtitleSegs,
    bgSeed,
  };
}

module.exports = { toInputProps, FPS };
