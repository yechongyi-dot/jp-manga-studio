'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── DeepSeek API ──────────────────────────────────────────────────────────────
function deepseekChatOnce(apiKey, messages, temperature = 0.75, maxTokens = 2400) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: 'deepseek-chat', messages, temperature, max_tokens: maxTokens });
    const req  = https.request({
      hostname: 'api.deepseek.com', path: '/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      timeout: 90000,
    }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200) {
            const errMsg = parsed.error?.message || JSON.stringify(parsed.error) || data.slice(0, 200);
            return reject(new Error(`DeepSeek HTTP ${res.statusCode}: ${errMsg}`));
          }
          const content = parsed.choices?.[0]?.message?.content;
          if (!content) return reject(new Error('DeepSeek 返回内容为空'));
          resolve(content);
        }
        catch (e) { reject(new Error(`DeepSeek 响应解析失败: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('DeepSeek API 请求超时（90s）')); });
    req.on('error', reject);
    req.end(body);
  });
}

// 瞬時エラー（429/5xx/超时/网络）は退避リトライ。401/403（鍵エラー）は即失敗で無駄打ちを避ける
async function deepseekChat(apiKey, messages, temperature = 0.75, maxTokens = 2400) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await deepseekChatOnce(apiKey, messages, temperature, maxTokens); }
    catch (e) {
      lastErr = e;
      const retryable = /HTTP (429|5\d\d)|超时|timeout|ECONNRESET|ETIMEDOUT|socket hang up|EAI_AGAIN|ENOTFOUND/i.test(e.message || '');
      if (!retryable || attempt === 3) break;
      await new Promise(r => setTimeout(r, attempt * 1500));   // 1.5s → 3s 退避
    }
  }
  throw lastErr;
}

// ── 全角→半角 正規化（客户が全角数字・全角カンマ・￥で入力しても解析できるように）──
function toHalfWidth(s) {
  return String(s == null ? '' : s)
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/，/g, ',')
    .replace(/．/g, '.')
    .replace(/[−－]/g, '-')   // 全角マイナス→半角（normalizePct で符号が消えて正負反転するのを防ぐ）
    .replace(/[￥¥]/g, '');
}

// ── 株式コード正規化 ──────────────────────────────────────────────────────────
function normalizeCode(raw) {
  if (!raw) return '????';
  const m = raw.match(/(\d{3,4}[A-Za-z]?)/);
  return m ? m[1] : '????';   // 数字コードを抽出できない異常値は占位符に（slice だと中文等が対照表検索/桁読みを汚染する）
}

// ── パーセント正規化 ──────────────────────────────────────────────────────────
function normalizePct(raw) {
  if (!raw) return '+0%';
  const n = parseFloat(toHalfWidth(raw).replace(/[^0-9.\-]/g, ''));
  if (isNaN(n)) return '+0%';
  const formatted = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return (n >= 0 ? '+' : '') + formatted + '%';
}

// ── 価格正規化 ────────────────────────────────────────────────────────────────
function normalizePrice(raw) {
  if (!raw) return '—';
  const s = toHalfWidth(raw).replace(/[, ]/g, '').replace(/日元$/, '').replace(/円$/, '');
  // 「万」「億」単位は倍率換算（120万円→1,200,000円。単位除去だけだと桁が壊れて 120円 になる）
  const mm = s.match(/^([0-9.]+)\s*(万|億)/);
  if (mm) {
    const base = parseFloat(mm[1]);
    if (!isNaN(base)) return Math.round(base * (mm[2] === '億' ? 1e8 : 1e4)).toLocaleString('ja-JP') + '円';
  }
  const num = parseFloat(s);
  if (isNaN(num)) return raw.trim();
  return num.toLocaleString('ja-JP') + '円';
}

// ── 「XX万円」形式の単位だけ修正（normalizePrice は万単位の桁を壊すため使えない）──
function fixManYenUnit(raw) {
  return toHalfWidth(raw || '').replace(/日元/g, '円');
}

// ── 配音用テキスト正規化（speechify）──────────────────────────────────────────
// 表示用テキスト（字幕・発布素材・プレビュー）はそのまま保持し、TTS合成の直前だけ通す：
//   ・証券コードを一桁ずつ読む（7203 → ナナ・ニー・ゼロ・サン。日本の証券コードは桁読みが慣習）
//   ・千位カンマを除去（「2,735」をカンマ区切りで不自然に読むのを防ぐ）
//   ・数字前の「＋」を除去（「プラス」と読ませない。上昇率の符号は不要）
const _digitKana = { '0': 'ゼロ', '1': 'イチ', '2': 'ニー', '3': 'サン', '4': 'ヨン', '5': 'ゴー', '6': 'ロク', '7': 'ナナ', '8': 'ハチ', '9': 'キュー' };
function codeToKana(code) {
  return String(code || '').split('').map(ch => _digitKana[ch] || ch).join('・');
}
function speechify(text) {
  return String(text == null ? '' : text)
    .replace(/コード\s*(\d{3,4}[A-Za-z]?)/g, (_, c) => 'コード' + codeToKana(c))
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/[+＋](?=\d)/g, '');
}

// ── 日本語判定（かな文字の有無で簡易判定。中国語にはかなが存在しないため、
//    自然な日本語の文・段落には必ず含まれる前提で中国語混入を検知する）────────
const KANA_RE = /[぀-ヿ]/;
function looksLikeJapanese(text) {
  if (!text || text.length < 8) return true; // 短すぎる場合は判定しない（固有名詞等）
  return KANA_RE.test(text);
}


// ── 标準フォーマット JSON 解析 ─────────────────────────────────────────────
function parseStandardResult(parsed, stockCount) {
  const stocks = (parsed.stocks || []).slice(0, stockCount).map(s => ({
    ...s,
    pct:      normalizePct(s.pct),
    buyPrice: normalizePrice(s.buyPrice),
    ttsText:  s.ttsText || '',
  }));

  if (parsed.featuredCurrentPrice && stocks.length <= stockCount) {
    const fBuy    = normalizePrice(parsed.featuredCurrentPrice);
    const fTarget = parsed.featuredTargetPrice ? normalizePrice(parsed.featuredTargetPrice) : '';
    const fPct    = parsed.featuredPct ? normalizePct(String(parsed.featuredPct).replace('%', '')) : '+0%';
    stocks.push({
      name:        '',
      code:        '    ',
      buyPrice:    fBuy,
      shortTarget: fTarget || undefined,
      pct:         fPct,
      note:        '',
      ttsText:     fTarget
        ? `最後は誰も教えてくれないお宝銘柄！現在価格${fBuy}から、目標価格${fTarget}へ。予想上昇率${fPct}！この銘柄コード、実はLINEでこっそり公開中です！プロフィールのLINEを今すぐ追加してください！`
        : '',
    });
  }

  return {
    title:     parsed.title    || '今週の注目銘柄',
    stocks,
    hook:      parsed.hook     || undefined,
    introTts:  parsed.introTts || undefined,
    themes:    parsed.themes   || [],
    ctaText:   parsed.ctaText  || undefined,
    rawText:   '',
  };
}

// ── NISA フォーマット JSON 解析 ───────────────────────────────────────────────
function parseNisaResult(parsed, stockCount) {
  const stocks = (parsed.stocks || []).slice(0, stockCount).map(s => ({
    code:     normalizeCode(s.code),
    name:     s.name || '',
    buyPrice: normalizePrice(s.buyPrice),
    pct:      normalizePct(s.pct),
    note:     '',
    sector:   undefined,
    ttsText:  s.ttsText || '',
  }));

  return {
    title:               parsed.title || '新NISA投資推薦',
    subtitle:            parsed.subtitle || '',
    introTts:            parsed.introTts || undefined,
    stocks,
    marketContext:       parsed.marketContext || '',
    planText:            parsed.planText || '',
    featuredText:        parsed.featuredText || '',
    initialCapital:      fixManYenUnit(parsed.initialCapital),
    targetProfitMin:     fixManYenUnit(parsed.targetProfitMin),
    targetProfitMax:     fixManYenUnit(parsed.targetProfitMax),
    featuredCurrentPrice: parsed.featuredCurrentPrice ? normalizePrice(parsed.featuredCurrentPrice) : undefined,
    featuredTargetPrice:  parsed.featuredTargetPrice  ? normalizePrice(parsed.featuredTargetPrice)  : undefined,
    featuredPct:          parsed.featuredPct ? normalizePct(String(parsed.featuredPct).replace('%', '')) : undefined,
    ctaText:  parsed.ctaText || undefined,
    rawText:  '',
  };
}

// ── 龍頭池ビルダー ───────────────────────────────────────────────────────────
// content-presets.json の stockUniverse から、主題に関連するセクターの「実在銘柄」を
// 「名称(コード)、…」形式で組み立て、prompt の {{leaders}} に注入する。
//   ・各セクターの tags のいずれかが主題文字列に含まれればそのセクターを採用
//   ・どのセクターもマッチしなければ全銘柄を返す（AI に常に実在の選択肢を渡す）
//   ・コード重複は排除（信越=半導体/化学 等の重複出現を防ぐ）
// → AI が実在の東証銘柄からのみ選ぶようになり、コード/名称の捏造を防ぐ（実価格は後段の jp-quote で上書き）。
function buildLeaders(theme, universe) {
  if (!universe || typeof universe !== 'object') return '';
  const t = String(theme || '');
  const sectors = Object.values(universe).filter(s => s && Array.isArray(s.stocks));
  let picked = sectors.filter(s => Array.isArray(s.tags) && s.tags.some(tag => tag && t.includes(tag)));
  if (!picked.length) picked = sectors;                       // フォールバック：全セクター
  const seen = new Set(), out = [];
  for (const sec of picked) {
    for (const pair of sec.stocks) {
      const name = pair[0], code = String(pair[1] || '');
      if (!code || seen.has(code)) continue;
      seen.add(code);
      out.push(`${name}(${code})`);
    }
  }
  return out.join('、');
}

// ── 仿写モード ─────────────────────────────────────────────────────────────────
// typeConfig: content-presets.json の type エントリ（必須）
async function parseImitate(apiKey, stockCount = 5, batchIndex = 0, excludeStocks = [], typeConfig) {
  if (!typeConfig?.prompt) throw new Error('parseImitate: typeConfig.prompt が必要です');

  const theme = typeConfig.themeVariants[batchIndex % typeConfig.themeVariants.length];
  const excludeLine = excludeStocks.length > 0
    ? `\n【使用禁止コード】以下は直近の動画で使用済みのため絶対に選ばないこと：${excludeStocks.slice(-150).join('、')}`
    : '';
  const leaders = buildLeaders(theme, typeConfig._stockUniverse);  // 実在龍頭池（{{leaders}} へ注入）

  const systemPrompt = typeConfig.prompt
    .replace(/\{\{theme\}\}/g, theme)
    .replace(/\{\{excludeLine\}\}/g, excludeLine)
    .replace(/\{\{stockCount\}\}/g, String(stockCount))
    .replace(/\{\{leaders\}\}/g, leaders);

  const userMsg = `请生成【${theme}】主题的${stockCount}支股票新脚本：`;

  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let raw;
    try {
      raw = await deepseekChat(apiKey, [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMsg },
      ], 0.95);
    } catch (e) {
      if (attempt === MAX_ATTEMPTS) throw e;
      console.warn(`[AI] 第${attempt}次/共${MAX_ATTEMPTS}次: API错误 (${e.message})，重试中...`);
      continue;
    }

    const parsed = tryParseJson(raw);
    if (!parsed) {
      console.warn(`[AI] 第${attempt}次/共${MAX_ATTEMPTS}次: 未返回有效JSON，重试中...`);
      if (attempt === MAX_ATTEMPTS) throw new Error('AI 3次均未返回有效JSON');
      continue;
    }

    const missingIntro = !parsed.introTts;
    const missingIdx   = (parsed.stocks || []).findIndex(s => !s.ttsText);
    if (missingIntro || missingIdx !== -1) {
      const field = missingIntro ? 'introTts' : `stocks[${missingIdx}].ttsText`;
      console.warn(`[AI] 第${attempt}次/共${MAX_ATTEMPTS}次: 缺少 ${field}，重试中...`);
      if (attempt === MAX_ATTEMPTS) throw new Error(`AI 3次均未返回必须字段: ${field}`);
      continue;
    }

    // 言語チェック：かな文字が一切ない長文は中国語混入の疑いが強い → リトライ
    // （name/title等の短い固有名詞は対象外。自然文のみ検査）
    const langCheckFields = [
      ['introTts', parsed.introTts],
      ...(parsed.stocks || []).map((s, i) => [`stocks[${i}].ttsText`, s.ttsText]),
      ['ctaText', parsed.ctaText],
      ...(typeConfig?.outputSchema === 'nisa' ? [['marketContext', parsed.marketContext]] : []),
    ];
    const badField = langCheckFields.find(([, text]) => !looksLikeJapanese(text));
    if (badField) {
      console.warn(`[AI] 第${attempt}次/共${MAX_ATTEMPTS}次: ${badField[0]} かな文字なし（中国語混入の疑い）、重试中...`);
      if (attempt === MAX_ATTEMPTS) throw new Error(`AI 3次均生成非日语内容: ${badField[0]}`);
      continue;
    }

    if (typeConfig?.outputSchema === 'nisa') return parseNisaResult(parsed, stockCount);
    return parseStandardResult(parsed, stockCount);
  }
}

// buildNisaSceneTexts は廃止。market/plan/featured も「口播文」として
// 脚本（手動=AI抽出 / imitate=AI生成）から直接供給する（套句式は全廃）。

// ── YouTube 公開素材生成 ─────────────────────────────────────────────────────
async function generateYouTubeMeta(scriptText, lineId, apiKey) {
  const lineCta = lineId
    ? `📲 LINE: ${lineId} 追加で最新の日本株情報を無料配信中！`
    : '📲 チャンネル登録で最新情報をお届けします！';

  const systemPrompt = `あなたは日本の株式投資系YouTubeチャンネルの運営担当です。
以下の動画スクリプトをもとに、YouTube公開に必要な3つの素材を生成してください。
必ず次のJSON形式のみで出力してください（コードブロック・前置き・説明は一切不要）：

{
  "title": "タイトル",
  "description": "説明文",
  "tags": "タグ"
}

【title】
- 絵文字で始める（🔥 または 📈）
- 銘柄数・上昇率の数字を含める（例：5選、+150%）
- 60文字以内、日本語、クリックしたくなる表現

【description】
次の構成で短くまとめること（合計10〜15行程度）：

[1行目] 動画の内容を一言で
空行
【今回の銘柄】
・銘柄名（コード）買値〇〇円 目標+〇〇%
（全銘柄を列挙）
空行
${lineCta}
空行
#日本株 #株式投資 #[板块に合うハッシュタグ]

【tags】
銘柄名・コード・板块名をカンマ区切りで列挙、最後に「日本株, 株式投資, 注目銘柄」を追加
合計15〜20個`;

  const raw = await deepseekChat(apiKey, [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: `スクリプト：\n\n${scriptText}` },
  ], 0.70, 2000);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI未返回有效JSON，原始内容：' + raw.slice(0, 300));

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    title:       parsed.title       || '',
    description: parsed.description || '',
    tags:        parsed.tags        || '',
  };
}

// ── 中文文案翻译为日文 ────────────────────────────────────────────────────────
async function translateToJapanese(text, apiKey) {
  const systemPrompt = `あなたは日本株式市場の専門翻訳者です。以下の手順で中国語の株式分析文案を処理してください。

【処理手順】
1. 誤字・脱字・不完全な文章を修正し、内容を補完する（音声認識の誤りを想定）
2. 株式銘柄名・企業名・経済用語などの固有名詞は、日本株式市場の正式名称に統一する
3. 内容の構造に従って適切に段落を分ける
4. 以下のフォーマットで正確に日本語訳する：
   - 买值 → 買値、目标 → 目標、涨幅/上涨 → 上昇率、分析/评论 → コメント
   - 価格の単位は円に統一する
5. 不要な句読点は追加しない
6. 中国語特有の言い回しは自然な日本語に置き換える
7. 文意・数値は一切省略しない
8. 翻訳結果のみ出力する。**太字**、*斜体*などのMarkdown記法を使用しない

株式コード（数字4〜5桁）は変更しない。`;

  return await deepseekChat(apiKey, [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: text },
  ], 0.3, 3000);
}

// ── 日本語配音稿を中国語に翻訳（発布素材ドキュメント用）──────────────────────
async function translateToChinese(text, apiKey) {
  const systemPrompt = `你是专业的日语笔译专家，请将以下完整的日语口播配音文案翻译为中文。

要求：
1. 按原文顺序完整翻译，不要遗漏、不要合并或拆分段落
2. 数字、价格、百分比、股票代码等信息原样保留，只翻译说明性文字
3. 翻译为自然流畅的简体中文口语，便于内部审阅配音内容是否准确
4. 不要添加原文中没有的内容，不要使用**粗体**、*斜体*等Markdown格式
5. 直接输出翻译结果，不要附加说明、注释或前言`;

  return await deepseekChat(apiKey, [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: text },
  ], 0.3, 3000);
}

// ══════════════════════════════════════════════════════════════════════════════
//  手動文案モード（NISA）：客户の中文文案を解析 → 翻訳 → 日本語 JpScript を組立
//  ・データ（コード/価格/上昇率/資金/利益）はプログラムで抽出し、AIに渡さない
//  ・市場背景5行・CTA3行はテンプレ固定の日本語をそのまま使用
//  ・株式名はコードで対照表をヒット → 未ヒットのみAI翻訳
//  ・株式の口播は固定句式で生成、導入句のみAIが生成
// ══════════════════════════════════════════════════════════════════════════════

// 旧 NISA 固定文（NISA_FIXED_MARKET / NISA_FIXED_CTA）は廃止。
// 市場背景・CTA を含む全口播文は、手動文案から抽出して翻訳する方式へ移行。

// 株式名対照表（コード→日本語正式名）の読み込み（1回だけ）
let _stockNameMap = null;
function loadStockNameMap() {
  if (_stockNameMap) return _stockNameMap;
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'jp-stock-names.json'), 'utf8'));
    _stockNameMap = data.byCode || {};
  } catch (e) {
    console.warn('[manual] 対照表の読み込み失敗:', e.message);
    _stockNameMap = {};
  }
  return _stockNameMap;
}

// ── 钩子(引子)段の自動併合 ──────────────────────────────────────────────────
// 4桁の証券コード（任意で末尾英字1つ＝新コード体系 130A 等）を含むか判定。
// 価格(1000円)・年号(2024年)・数量(8000万)等の誤検出を避けるため、前後が数字/小数点でなく、
// 直後が単位語でないものだけを「コード」とみなす（末尾に英字が付く新コードは無条件でコード扱い）。
function hasStockCode(text) {
  const s = String(text || '');
  const re = /(?<![\d.])\d{4}([A-Za-z])?(?![\d.])/g;
  const UNIT = /^[\s　]*(円|万|億|千|兆|割|倍|%|％|ポイント|pt|ドル|年|年度|ヶ月|か月|月|日|時|分|秒|件|名|人|位|社|個|株|回|度|連|期)/;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (!m[1] && UNIT.test(s.slice(re.lastIndex))) continue;  // 数値＋単位はコードではない
    return true;
  }
  return false;
}

// 株コードを含まない「钩子(引子)段」を、次の動画段の冒頭へ繰り越し併合する。
// → 客户が钩子を空行で区切って書いても「株が無い」エラーにならず、AI が冒頭紹介(introTts)として
//   取り込み、開頭口播の長さに応じて開頭シーンが自動延長される（固定の開頭時間ではなくなる）。
// 末尾に株なし段だけ残った場合は従来通り単独段で返す（真に株の無い文案は検出・警告対象のまま）。
function mergeHookSegments(segs) {
  const out = [];
  let pending = '';
  for (let i = 0; i < segs.length; i++) {
    const isLast = i === segs.length - 1;
    if (!isLast && !hasStockCode(segs[i])) {       // 株コード無し＝钩子段 → 次段へ繰り越し
      pending += (pending ? '\n\n' : '') + segs[i];
      continue;
    }
    out.push(pending ? pending + '\n\n' + segs[i] : segs[i]);
    pending = '';
  }
  if (pending) out.push(pending);
  return out;
}

// 空行（1行以上）で動画ごとに分割。段落内は空行なしの前提。
// さらに先頭/区切りの「钩子(引子)段」は次の動画段へ併合する（mergeHookSegments）。
function splitManualSegments(text) {
  const segs = String(text || '')
    .split(/\r?\n\s*\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length >= 10);
  return mergeHookSegments(segs);
}

// parseManualNisaSegment / parseManualNisa / translateManualNisaTexts は廃止。
// 手動文案は buildManualNisaScript の「AI 抽出＋翻訳」に一本化（旧規則の正規表現解析・部分翻訳は全廃）。

// ── AI 出力から JSON を頑健に抽出（コードブロック・末尾カンマ等を許容）──────────
// 客户文案不规范时 AI 易输出带 ```json 包裹或末尾逗号的 JSON，这里尽量救回。
function tryParseJson(raw) {
  if (!raw) return null;
  const s = String(raw).trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  const body = m[0];
  try { return JSON.parse(body); }
  catch {
    try { return JSON.parse(body.replace(/,(\s*[}\]])/g, '$1')); } // 末尾カンマ除去で再試行
    catch { return null; }
  }
}

// ── 1段の中文文案 → AI で日本語 JpScript(nisa)を構築 ────────────────────────
// 中文文案から「各段の口播原文 ＋ 数据」を抽出し、口播文は自然な日本語へ翻訳する。
// 旧来の「固定文・固定句式・正規表現抽出」は全廃。文案に無い段は空（→該当シーン自動スキップ）。
async function buildManualNisaScript(rawText, apiKey = '', lineId = '') {
  if (!apiKey) throw new Error('DeepSeek API キーが必要です（手動文案の抽出・翻訳に使用）');
  const map = loadStockNameMap();

  // 言語判定はコード側で確定（AIの自動判定は誤りやすい：中国語文案に日元/上昇率/日本社名が
  // 混じると「日本語」と誤判定し、口播文が中国語のまま残る）。平仮名は日本語にのみ存在し中国語
  // には皆無 ⇒ 平仮名があれば日本語、無ければ中国語。これでAIに判定させず確実に分岐させる。
  const inputLang = /[぀-ゟ]/.test(rawText) ? '日本語' : '中国語';

  const systemPrompt = `あなたは日本株ショート動画の台本処理器です。
入力された【文案】(動画1本分)から構造を抽出し、各フィールドへ整理します。

入力言語は【${inputLang}】と確定済みです（判定しなくてよい）。次の通り処理します:
- 日本語の場合: すべての口播文(introTts/各銘柄ttsText/marketContext/planText/featuredText/ctaText)は原文を一字一句そのまま保持する。翻訳・要約・言い換え・語尾変更・加筆・読点の追加を一切しない。データ(code/name/価格/上昇率)だけを抽出する。
- 中国語の場合: すべての口播文(introTts/各銘柄ttsText/marketContext/planText/featuredText/ctaText)を必ず自然で専門的な日本語に翻訳する。簡体字・中国語の語彙や言い回し(的/了/随着/或将/板块 等)を一切残してはならない。出力に中国語が一文字でも残れば不合格。社名・コード・数値はそのまま。

次のJSONのみ出力(説明・コードブロック禁止):
{
  "title": "組合タイトル(日本語、簡潔、句点なし)",
  "subtitle": "サブタイトル(日本語、20字以内、句点なし)",
  "introTts": "オープニング口播文(日本語入力ならそのまま/中国語なら翻訳。無ければ空文字)",
  "stocks": [
    { "code": "証券コード4桁", "name": "企業の日本語正式名称", "buyPrice": "買値(数字+円)", "pct": "上昇率(+XX.XX%)", "ttsText": "この銘柄の口播文(日本語入力ならそのまま/中国語なら翻訳)" }
  ],
  "marketContext": "市場背景の口播文。相場全体の説明(『日経平均』等の指数動向・主要セクター)のみ。日本語入力なら該当文をそのまま使う。中国語入力なら全角90字以内・2〜3文に要約翻訳する。『詳細な分析で厳選』『有望なセクターを選定』等の投資方案への前置き・移行句は含めない。無ければ空文字",
  "planText": "投資方案の口播文。文案に該当口播文があれば日本語入力はそのまま/中国語は翻訳して使う。口播文が無く数字のみの場合は下記 initialCapital と targetProfit から『初期資金○○から、目標利益○○〜○○を目指します』のような自然な1文を生成。数字も無ければ空文字",
  "featuredText": "主推銘柄の口播文。文案に該当口播文があれば日本語入力はそのまま/中国語は翻訳して使う。口播文が無く価格のみの場合は下記 featured の価格から『最も注目の1銘柄、現在価格○○から目標価格○○へ、予想上昇率○○』のような自然な1〜2文を生成。銘柄名は出さない。価格も無ければ空文字",
  "ctaText": "結びCTAの口播文(日本語入力ならそのまま/中国語なら翻訳。無ければ空文字)",
  "initialCapital": "初期資金(数字+円。無ければ空文字)",
  "targetProfitMin": "目標利益の下限(数字+円。無ければ空文字)",
  "targetProfitMax": "目標利益の上限(数字+円。無ければ空文字)",
  "featuredCurrentPrice": "主推銘柄の現在価格(数字+円。無ければ空文字)",
  "featuredTargetPrice": "主推銘柄の目標価格(数字+円。無ければ空文字)",
  "featuredPct": "主推銘柄の予想上昇率(XXX%。無ければ空文字)"
}

【厳守】
- 日本語入力の場合、口播文は原文保持が最優先。一字一句変えない(「自然に整える」も禁止)。中国語入力の場合のみ自然な日本語に翻訳し、簡体字・英語の混在は禁止。
- 数字・価格・パーセントは文案の値をそのまま使う(改変・捏造禁止)。
- 文案に存在しない段は必ず空文字(stocksは空配列)。内容を勝手に作らない。
- planText(投資方案)と featuredText(主推株)は、文案に口播文があればそれを優先使用し、無い場合のみ数字から生成する(その際もコロン区切りの機械的な列挙・読み上げは禁止)。marketContext にはこれら投資方案・主推株の数字を含めない。
- code は文案に出てくる実在のコードのみ。
- 出力はJSONのみ。`;

  // 客户文案可能不规范 → AI 解析最多重试 3 次（API错误 / JSON坏 / 未提取到股票 都重试）
  const MAX_ATTEMPTS = 3;
  let p = null, lastErr = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let raw;
    try {
      raw = await deepseekChat(apiKey, [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: String(rawText || '') + (attempt > 1 ? '\n\n※前回の出力は不正でした。有効なJSONのみを厳守して出力してください。' : '') },
      ], 0.3, 2600);
    } catch (e) {
      lastErr = `API错误: ${e.message}`;
      if (attempt === MAX_ATTEMPTS) throw new Error(`手动文案AI解析失败（已重试${MAX_ATTEMPTS}次）：${lastErr}`);
      continue;
    }
    const parsed = tryParseJson(raw);
    if (!parsed) {
      if (attempt === MAX_ATTEMPTS) throw new Error('AI返回的内容无法解析为JSON（已重试3次），请检查该段文案是否过于杂乱，或稍后重试');
      continue;
    }
    if (!Array.isArray(parsed.stocks) || parsed.stocks.length === 0) {
      if (attempt === MAX_ATTEMPTS) throw new Error('未能从该段文案中提取到股票（已重试3次），请确认每只股票都写明「企业名称 + 4位代码」');
      continue;
    }
    p = parsed;
    break;
  }

  const stocks = (p.stocks || []).map(s => {
    const code = normalizeCode(s.code);
    return {
      code,
      name:     map[code] || s.name || '',   // 対照表ヒットを優先（名称の正確性を担保）
      buyPrice: normalizePrice(s.buyPrice),
      pct:      normalizePct(s.pct),
      note:     '',
      ttsText:  (s.ttsText || '').trim(),
    };
  });

  return {
    title:                p.title    || '新NISA投資推薦',
    subtitle:             p.subtitle || '',
    introTts:             (p.introTts || '').trim() || `今回は${p.title || '新NISA厳選銘柄'}をご紹介します。`,
    stocks,
    marketContext:        (p.marketContext || '').trim(),
    planText:             (p.planText || '').trim(),
    featuredText:         (p.featuredText || '').trim(),
    ctaText:              (p.ctaText || '').trim(),
    ctaLineId:            lineId || undefined,
    initialCapital:       fixManYenUnit(p.initialCapital),
    targetProfitMin:      fixManYenUnit(p.targetProfitMin),
    targetProfitMax:      fixManYenUnit(p.targetProfitMax),
    featuredCurrentPrice: p.featuredCurrentPrice ? normalizePrice(p.featuredCurrentPrice) : undefined,
    featuredTargetPrice:  p.featuredTargetPrice  ? normalizePrice(p.featuredTargetPrice)  : undefined,
    featuredPct:          p.featuredPct ? normalizePct(String(p.featuredPct).replace('%', '')) : undefined,
    rawText,
  };
}

module.exports = {
  parseImitate,
  buildLeaders,
  generateYouTubeMeta,
  translateToJapanese,
  translateToChinese,
  // 手動文案モード（AI 抽出＋翻訳に一本化）
  splitManualSegments,
  buildManualNisaScript,
  loadStockNameMap,
  speechify,
};
