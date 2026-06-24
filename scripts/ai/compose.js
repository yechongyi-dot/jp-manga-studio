'use strict';
// 组稿（真数据先行）：题材角度 + 口吻persona + 格式要求 + 真实股票facts → DeepSeek 写地道日语 → 统一 Script 契约。
// 铁律：数值(价/指标)只用 select 来的真数据，AI 只负责叙事；口播不复述买价金额(株探实时价覆盖卡片)；不做收益承诺。
const { chat, getKey } = require('./deepseek');
const { validate } = require('./contract');

function buildMessages({ theme, tone, format, selection }) {
  const isPortfolio = format.structure === 'portfolio';
  const facts = selection.stocks.map(s => ({
    code: s.code, name: s.name, price: s.price,
    [s.rankMetricLabel || '指標']: s.pct,
    per: s.per, pbr: s.pbr, dividend: s.dividend, marketCap: s.marketCap, earningsTrend: s.earningsTrend,
  }));
  const schema = {
    title: '視聴維持を意識した強フックの日本語タイトル',
    subtitle: '（任意）副題',
    hook: '冒頭2秒で離脱を止める強いフック一文',
    stocks: [{ code: '銘柄コード', note: 'カード用一言コメント(日本語,20字以内)', ttsText: '口播文(日本語)。金額は言わず上昇率%や指標・材料で。続きが気になる引きを入れる' }],
    ctaText: '集客クロージング(日本語)。チャンネル登録/フォロー＋LINEで無料の銘柄リストへ自然に誘導。収益保証は言わない',
    ...(isPortfolio ? { marketContext: '市況一段(日本語)', investmentPlan: '投資方針一段(日本語)', featured: '本命銘柄の煽り一段(日本語)' } : {}),
  };
  const sys =
    `${tone.persona}\n\n` +
    `あなたは日本株ショート動画の台本ライター。次の3鉄則を全文で厳守する：\n` +
    `【真実データ鉄則】銘柄コード・社名・価格・指標は与えられた実データのみ使用。存在しない銘柄や数値は絶対に作らない（捏造厳禁）。\n` +
    `【フック鉄則】冒頭2秒で強いフック、各銘柄にも『続きが気になる』引き(疑問・意外・限定)を入れ、最後まで離脱させない。\n` +
    `【集客鉄則】視聴維持→登録/フォロー、そしてLINEで無料の銘柄リスト/レポートへ誘導する意図を全編に自然に貫く。\n` +
    `コンプラ厳守：収益保証・断定的助言はしない、リスクに一言触れる。出力は指定 JSON のみ（前置き・説明なし）。`;
  const user =
    `題材: ${theme.name}\n切り口: ${theme.angle}\n形式: ${format.name}（銘柄数 ${selection.stocks.length}・基準日 ${selection.asOf}）\n\n` +
    `実データ（これだけを使う。数値は改変しない）:\n${JSON.stringify(facts, null, 1)}\n\n` +
    `次の JSON 形式で出力（数値は書かず、ナレーション/コメントのみ。stocks は上記 code と一致させる）:\n${JSON.stringify(schema, null, 1)}`;
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}

// AI 叙事 + select 真数据 → 合并成统一 Script（数值全部来自真数据）
function mergeScript({ theme, tone, format, selection, ai }) {
  const byCode = {};
  (ai.stocks || []).forEach(s => { if (s && s.code) byCode[String(s.code)] = s; });
  const stocks = selection.stocks.map(s => {
    const a = byCode[String(s.code)] || {};
    // AI 漏配/错配该代码时，用真数据兜底，避免口播/解说为空（旁白干瘪）
    const metric = s.rankMetricLabel ? `${s.rankMetricLabel}${s.pct}` : (s.pct || '');
    const note = a.note || metric || s.name;
    const ttsText = a.ttsText || `${s.name}。${metric ? metric + 'と、' : ''}今注目の一社です。`;
    return { ...s, note, ttsText };
  });
  const script = {
    meta: { themeId: theme.id, formatId: format.id, toneId: tone.id, angle: theme.angle, asOf: selection.asOf },
    title: ai.title || theme.name,
    subtitle: ai.subtitle || '',
    hook: ai.hook || '',
    ctaText: ai.ctaText || '',   // AI 产出的引流结尾(render-adapter 用，空则用默认)
    stocks,
    toneId: tone.id,
    // 背景由背景轴(bg-provider/backgrounds.json)决定，不在组稿阶段定；口吻已是纯 persona
  };
  if (format.structure === 'portfolio') {
    script.marketContext   = ai.marketContext   || '';
    script.investmentPlan  = ai.investmentPlan  || '';
    script.featured        = ai.featured        || '';
  }
  return script;
}

// AI 返回里命中了多少 selection 代码（用于判断口播是否大面积兜底）
function aiCoverage(selection, ai) {
  const codes = new Set((ai && ai.stocks || []).filter(s => s && s.code).map(s => String(s.code)));
  return selection.stocks.filter(s => codes.has(String(s.code))).length;
}

async function compose({ theme, tone, format, selection, apiKey }) {
  const key = apiKey || getKey();
  if (!key) throw new Error('缺少 DEEPSEEK_KEY（设到 .env 或环境变量后重试）');
  const need = Math.ceil(selection.stocks.length / 2);   // 至少命中一半代码才算合格
  const baseMsgs = buildMessages({ theme, tone, format, selection });
  let ai = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const msgs = attempt === 1 ? baseMsgs
      : [...baseMsgs, { role: 'user', content: `前回は銘柄コードの対応が不十分でした。必ず上記 ${selection.stocks.length} 件すべての code をそのまま使い、各 code に note と ttsText を付けて JSON で再出力してください。` }];
    const raw = await chat(key, msgs, { json: true, temperature: attempt === 1 ? 0.8 : 0.5, maxTokens: 3000 });
    let cur; try { cur = JSON.parse(raw); } catch { if (attempt === 2) throw new Error('AI 返回非 JSON：' + raw.slice(0, 150)); continue; }
    ai = cur;
    if (selection.stocks.length <= 1 || aiCoverage(selection, ai) >= need) break;   // 合格或单股 → 不重试
  }
  const script = mergeScript({ theme, tone, format, selection, ai });
  const v = validate(script);
  if (!v.ok) throw new Error('生成 Script 不合契约：' + v.issues.join('；'));
  return script;
}

module.exports = { compose, buildMessages, mergeScript };

// 直接运行 = 离线自检（prompt 组装 + 真数据合并；有 key 则额外实跑）
if (require.main === module) {
  const { resolve } = require('./layers');
  const { theme, format, tone } = resolve('high-dividend', 'ranking', 'analyst');
  const selection = {
    theme: 'high-dividend', label: '配当利回り', asOf: '2026-06-22',
    stocks: [{ code: '8975', name: 'いちごオフィスリート投資法人', price: 90800, pct: '+8.47%', rankMetricLabel: '配当利回り', per: '8.0倍', pbr: '1.34倍', dividend: '12.52%', marketCap: '1,387億円', earningsTrend: '増収増益' }],
  };
  console.log('── system prompt ──\n' + buildMessages({ theme, tone, format, selection })[0].content);
  const aiMock = { title: '高配当株はこれだ', hook: '配当生活、はじめませんか', stocks: [{ code: '8975', note: '利回り12%超の優良リート', ttsText: 'まずはいちごオフィスリート。配当利回りは驚異の水準で、安定感も抜群です。' }] };
  const s = mergeScript({ theme, tone, format, selection, ai: aiMock });
  console.log('\n── merged script(mock AI) ──\n' + JSON.stringify(s, null, 1));
  console.log('\n契约校验:', JSON.stringify(validate(s)));
  if (getKey()) {
    console.log('\n[检测到 DEEPSEEK_KEY] 实跑 compose…');
    compose({ theme, tone, format, selection }).then(r => console.log('AI 标题:', r.title, '| 首股口播:', r.stocks[0].ttsText)).catch(e => console.error('compose 失败:', e.message));
  } else {
    console.log('\n[无 DEEPSEEK_KEY] 跳过实跑；配 key 后可端到端测 compose。');
  }
}
