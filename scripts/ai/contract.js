'use strict';
// 统一 Script 契约（防火墙）。
// AI 智能生成 与（阶段2 的）文案导入 都产出此结构 → 下游 格式/口吻/背景 自动共用。
// 原则：可加性超集，「字段即场景，空则模板自动跳过」，只增不改。
//
// Script {
//   meta:    { themeId, formatId, toneId, angle, asOf }   // 生成元信息
//   title, subtitle?
//   stocks:  [{ code,name, price?,pct?, per?,pbr?,dividend?,marketCap?,roe?, weight?, note?, sector? }]
//   // 组合(portfolio)专属（空则不出对应场景）：
//   marketContext?, initialCapital?, targetProfitMin?, targetProfitMax?,
//   featuredCurrentPrice?, featuredTargetPrice?, featuredPct?,
//   // 渲染：
//   toneId, bg:{ type:'procedural'|'image', id?, src?, motion? },
//   ctaLineId?, ctaText?, subtitleSegs?, ...时长字段(generate 注入)
// }

const REQUIRED = ['title', 'stocks'];

function validate(script) {
  const issues = [];
  if (!script || typeof script !== 'object') return { ok: false, issues: ['script 不是对象'] };
  for (const k of REQUIRED) if (script[k] == null || script[k] === '') issues.push(`缺必填字段 ${k}`);
  if (script.stocks != null && !Array.isArray(script.stocks)) issues.push('stocks 必须是数组');
  if (Array.isArray(script.stocks)) {
    if (!script.stocks.length) issues.push('stocks 为空');
    script.stocks.forEach((s, i) => {
      if (!s || !s.code) issues.push(`stocks[${i}] 缺 code`);
      if (!s || !s.name) issues.push(`stocks[${i}] 缺 name`);
    });
  }
  return { ok: issues.length === 0, issues };
}

// 「字段即场景」：根据 script 字段判断哪些多场景需要出（组合格式用）
function scenePresence(script) {
  return {
    market:   !!script.marketContext,
    plan:     !!(script.initialCapital || script.targetProfitMin || script.targetProfitMax),
    featured: !!(script.featuredCurrentPrice || script.featuredTargetPrice || script.featuredPct),
  };
}

// 空壳：给 compose 一个起点
function emptyScript(meta = {}) {
  return { meta, title: '', stocks: [], toneId: meta.toneId || '', bg: null };
}

module.exports = { validate, scenePresence, emptyScript, REQUIRED };
