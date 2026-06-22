'use strict';

const path   = require('path');
const fs     = require('fs');
const http   = require('http');
const os     = require('os');
const crypto = require('crypto');

const ROOT     = path.join(__dirname, '..');
const TEMP_DIR = path.join(ROOT, 'temp', 'jp-audio');
// OUT_DIR は cfg 解析後に定義（cfg.outputDir 依存のため。先頭に書くと TDZ エラーになる）

// .env 読み込み
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

// 引数解析
const argvRaw = process.argv.slice(2);
let cfg = {};
const cfgIdx = argvRaw.indexOf('--config');
if (cfgIdx !== -1) {
  try { cfg = JSON.parse(argvRaw[cfgIdx + 1]); }
  catch (e) { console.error('❌ --config JSON 解析失败:', e.message); process.exit(1); }
}
const fileArg = argvRaw.indexOf('--file');
if (fileArg !== -1) cfg.text = fs.readFileSync(argvRaw[fileArg + 1], 'utf8');

const OUT_DIR         = cfg.outputDir     || path.join(ROOT, 'output');
const CONTENT_TYPE_ID = cfg.contentTypeId || '';
const LINE_ID         = cfg.lineId        || '';
const STOCK_COUNT     = cfg.stockCount    ? parseInt(cfg.stockCount) : 5;
const DEEPSEEK_KEY    = cfg.apiKey        || process.env.DEEPSEEK_KEY || '';
const BATCH_INDEX     = cfg.batchIndex    ?? 0;
const EXCLUDE_STOCKS  = Array.isArray(cfg.excludeStocks) ? cfg.excludeStocks : [];
const TTS_ENGINE      = cfg.ttsEngine     || 'auto';
const TTS_VOICE       = cfg.ttsVoice      || 'ja-JP-NanamiNeural';
const TTS_RATE        = cfg.ttsRate       || '+20%';
const VV_SPEAKER      = cfg.vvSpeaker     ?? 3;
const VV_SPEED        = cfg.vvSpeed       ?? 1.20;
const VV_VOLUME       = cfg.vvVolume      ?? 1.0;
const VV_PITCH        = cfg.vvPitch       ?? 0.0;
const VV_INTONATION   = cfg.vvIntonation  ?? 1.0;
const VV_PRE_PHONE    = cfg.vvPrePhoneme  ?? 0.1;
const VV_POST_PHONE   = cfg.vvPostPhoneme ?? 0.1;
const VARIANT_CONFIG  = cfg.variantConfig || null;
const MANUAL_SCRIPT   = cfg.manualScript  || null;
const RENDER_CONCURRENCY = cfg.renderConcurrency || null;  // 并行渲染时由上层指定的单条并发上限
const SKIN_ID         = cfg.skinId        || '';
const BG_CHOICE       = cfg.bg            || null;
const STOCK_SCENE_ID  = cfg.stockSceneId  || '';   // 编辑器选的股票卡片样式（空=按主题默认）
const THEME_ID        = cfg.themeId       || '';   // 编辑器直接指定主题（覆盖 skinId→theme）
const FONT_CONFIG     = cfg.fontConfig    || null; // 编辑器字体覆盖 { sans?, mono? }

const MODE = MANUAL_SCRIPT ? 'manual' : 'imitate';

const FPS        = 30;
const INTRO_BASE = 90;
const CTA_BASE   = 90;
const BUFFER_F   = 6;

const { parseImitate, speechify } = require('./jp-parser');
const { synthesize, checkVoicevox, getAudioDuration } = require('./jp-tts');
const { pickImageBg, loadBgConfig } = require('./ai/bg-provider');

function resolveSkin(skinId) {
  const fallback = { id: 'blue', theme: 'JP_PRIME' };
  if (!skinId) return fallback;
  try {
    const skins = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'skins.json'), 'utf8')).skins || [];
    return skins.find(s => s.id === skinId) || fallback;
  } catch { return fallback; }
}

function detectStructure(script) {
  if (script.marketContext || script.planText || script.featuredText) return 'portfolio';
  return 'standard';
}

// ── content-presets.json から type config を読み込む ──────────────────────────
function loadTypeConfig(contentTypeId) {
  if (!contentTypeId) return null;
  const presetsPath = path.join(ROOT, 'content-presets.json');
  if (!fs.existsSync(presetsPath)) return null;
  try {
    const presets = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
    const type = (presets.types || []).find(t => t.id === contentTypeId) || null;
    if (type) type._stockUniverse = presets.stockUniverse || null;  // 龍頭池を type に付与（parseImitate→buildLeaders で使用）
    return type;
  } catch (e) {
    console.warn('[presets] 读取失败:', e.message);
    return null;
  }
}

// ── 軽量アセットサーバー（音声 + 背景画像を Remotion に配信）──────────────────
const ASSET_MIME = {
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
};
function startAssetServer(allowedDirs = []) {
  const allowed = allowedDirs.filter(Boolean).map(d => path.resolve(d));
  return new Promise(resolve => {
    const conns = new Set();
    const srv = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        let filePath, ok;
        if (urlPath.startsWith('/__f/')) {
          filePath = path.resolve(decodeURIComponent(urlPath.slice('/__f/'.length)));
          ok = allowed.some(d => filePath.startsWith(d));
        } else {
          filePath = path.resolve(ROOT, urlPath.replace(/^\/+/, ''));
          ok = filePath.startsWith(ROOT);
        }
        if (!ok || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.writeHead(404); res.end(); return;
        }
        const ext  = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': ASSET_MIME[ext] || 'application/octet-stream', 'Accept-Ranges': 'bytes' });
        fs.createReadStream(filePath).pipe(res);
      } catch { res.writeHead(500); res.end(); }
    });
    srv.on('connection', s => { conns.add(s); s.on('close', () => conns.delete(s)); });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, conns }));
  });
}
function closeAssetServer({ srv, conns }) {
  for (const s of conns) s.destroy();
  srv.close();
}

// ── Chrome 解決 ──────────────────────────────────────────────────────────────
function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find(p => p && fs.existsSync(p)) || undefined;
}

const CHROMIUM_OPTIONS = {
  disableWebSecurity: true,
  enableMultiProcessOnLinux: false,
};

// ── メイン ────────────────────────────────────────────────────────────────────
// ── TTS 固定文案キャッシュ（同一テキスト＋同一設定なら音声を再利用。同一文案を複数本生成する時や、市場背景/CTA等の固定文で合成を大幅短縮）──
const TTS_CACHE_DIR = path.join(ROOT, 'temp', 'tts-cache');
let _ttsHit = 0, _ttsMiss = 0;  // TTSキャッシュ統計（ログ用）
async function synthCached(text, outPath, opts) {
  const spoken = speechify(text);
  const key = crypto.createHash('md5').update(spoken + '|' + JSON.stringify(opts)).digest('hex');
  const cachePath = path.join(TTS_CACHE_DIR, key + path.extname(outPath));
  if (fs.existsSync(cachePath)) {
    _ttsHit++;
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.copyFileSync(cachePath, outPath);
    return getAudioDuration(outPath);
  }
  _ttsMiss++;
  await synthesize(spoken, outPath, opts);
  try {
    fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
    const tmp = `${cachePath}.${process.pid}.tmp`;
    fs.copyFileSync(outPath, tmp);
    fs.renameSync(tmp, cachePath);  // 原子操作：並列で同一テキストを書く時、読み手が半端なファイルを掴まないように
  } catch {}
  return getAudioDuration(outPath);
}

// TTSキャッシュが増えすぎないよう古い順に削除（バッチ大量生成でディスクを食い潰さない）
function pruneTtsCache(max = 600, keep = 400) {
  try {
    const files = fs.readdirSync(TTS_CACHE_DIR)
      .map(f => ({ f, t: fs.statSync(path.join(TTS_CACHE_DIR, f)).mtimeMs }))
      .sort((a, b) => a.t - b.t);
    if (files.length > max) {
      for (const { f } of files.slice(0, files.length - keep)) {
        try { fs.unlinkSync(path.join(TTS_CACHE_DIR, f)); } catch {}
      }
    }
  } catch {}
}

const _tempAudio = new Set();  // 生成過程の一時音声ファイル。成功/失敗どちらでも確実に削除し temp の蓄積を防ぐ

async function main() {
  if (!MANUAL_SCRIPT && !DEEPSEEK_KEY) {
    console.error('❌ DEEPSEEK_KEY が未設定です');
    process.exit(1);
  }

  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR,  { recursive: true });
  pruneTtsCache();

  // ── Step 1: スクリプト準備（手動文案 or AI生成）─────────────────────────────
  let script;
  if (MANUAL_SCRIPT) {
    log('Step 1: 手動文案を使用（AI生成をスキップ）');
    script = MANUAL_SCRIPT;
    script.ctaLineId = LINE_ID || script.ctaLineId || undefined;
  } else {
    log('Step 1: AI でスクリプト生成中...');
    const typeConfig = loadTypeConfig(CONTENT_TYPE_ID);
    if (!typeConfig) { console.error(`❌ contentTypeId "${CONTENT_TYPE_ID}" が content-presets.json に見つかりません`); process.exit(1); }
    log(`  タイプ: ${typeConfig.name}`);
    script = await parseImitate(DEEPSEEK_KEY, STOCK_COUNT, BATCH_INDEX, EXCLUDE_STOCKS, typeConfig);
    script.ctaLineId = LINE_ID || undefined;
  }

  // 脚本の妥当性チェック（手動文案が不正でも子プロセスが意味不明に落ちず、明確なエラーを返す）
  if (!script || !Array.isArray(script.stocks) || script.stocks.length === 0) {
    console.error('❌ 脚本に銘柄(stocks)がありません。文案の形式をご確認ください。');
    process.exit(1);
  }
  if (!script.introTts) {
    console.error('❌ 脚本にイントロ口播文(introTts)がありません。');
    process.exit(1);
  }

  // ── Step 1.5: 実株価で買値を補正（imitateモードのみ。手動文案はユーザー提供データを尊重）──
  // AI が選んだ実在コードの最新株価を株探(jp-quote)から取得し buyPrice を実価格へ上書きし、
  // 社名も正式名へ補正する。取得できないコード（捏造の疑い/ネット不可）は容错除外する。
  if (!MANUAL_SCRIPT && Array.isArray(script.stocks) && script.stocks.length) {
    const { fetchQuote } = require('./jp-quote');
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    log('Step 1.5: 実株価を取得して補正中（株探）...');
    const kept = [];
    for (const s of script.stocks) {
      const code = String(s.code || '').trim();
      if (!/^\d{4}[A-Z]?$/.test(code)) { kept.push(s); continue; }   // 神秘株等のダミーコードはそのまま
      let q = null;
      for (let a = 1; a <= 3 && !q; a++) {
        q = await fetchQuote(code);
        if (!q && a < 3) await sleep(500 * a);                       // スロットリング回避のバックオフ
      }
      if (q) {
        const real = Math.round(q.price).toLocaleString('ja-JP') + '円';
        log(`  ✓ ${code} ${q.name || s.name}：実価格 ${real}（AI値 ${s.buyPrice} を上書き）`);
        s.buyPrice = real;
        if (q.name) s.name = q.name;
        s.targetPrice = undefined; s.shortTarget = undefined;        // 実買値×pct で後段再計算させる
        kept.push(s);
      } else {
        log(`  ⚠ ${code} ${s.name}：実価格取得不可 → 除外（コード誤り/プロキシ未設定の可能性）`);
      }
      await sleep(300);                                              // 連続アクセスを緩和
    }
    script.stocks = kept;
    if (!script.stocks.length) {
      console.error('❌ 全銘柄の実株価取得に失敗しました。ネット/プロキシ設定（JP_PROXY）をご確認ください。');
      process.exit(1);
    }
    log(`  実価格補正完了：${script.stocks.length}銘柄`);
  }

  // 目標価格がない銘柄は買値×pctから自動計算
  for (const s of script.stocks) {
    if (!s.targetPrice && !s.shortTarget) {
      const buyNum = parseFloat((s.buyPrice || '').replace(/[^0-9.]/g, ''));
      const pctNum = parseFloat((s.pct     || '').replace(/[^0-9.\-]/g, ''));
      if (!isNaN(buyNum) && !isNaN(pctNum) && buyNum > 0 && pctNum > 0) {
        s.targetPrice = Math.round(buyNum * (1 + pctNum / 100)).toLocaleString('ja-JP') + '円';
      }
    }
  }

  log(`  ✓ タイトル: ${script.title}`);
  log(`  ✓ 銘柄数: ${script.stocks.length}`);

  const structure = detectStructure(script);
  const isNisa = structure === 'portfolio';

  // ── Step 2: TTS 音声合成 ────────────────────────────────────────────────────
  log('\nStep 2: 音声合成中（並列）...');

  let resolvedEngine = TTS_ENGINE;
  if (TTS_ENGINE === 'auto') {
    resolvedEngine = (await checkVoicevox()) ? 'voicevox' : 'edge';
    log(`  TTS engine: ${resolvedEngine}`);
  }

  const ttsOpts = {
    engine: resolvedEngine, voice: TTS_VOICE, rate: TTS_RATE,
    speakerId:        VV_SPEAKER,
    speedScale:       VV_SPEED,
    volumeScale:      VV_VOLUME,
    pitchScale:       VV_PITCH,
    intonationScale:  VV_INTONATION,
    prePhonemeLength: VV_PRE_PHONE,
    postPhonemeLength:VV_POST_PHONE,
  };
  // process.pid を付与：並列レンダリング時に2プロセスが同じ秒に起動しても音声/動画ファイル名が衝突しない
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '_' + process.pid;
  const audioExt  = resolvedEngine === 'voicevox' ? 'wav' : 'mp3';

  const introAudioRel  = `temp/jp-audio/jp_intro_${timestamp}.${audioExt}`;
  const introAudioPath = path.join(ROOT, introAudioRel);
  const stockAudioRels  = script.stocks.map((_, i) => `temp/jp-audio/jp_stock${i + 1}_${timestamp}.${audioExt}`);
  const stockAudioPaths = stockAudioRels.map(r => path.join(ROOT, r));
  const ctaAudioRel  = `temp/jp-audio/jp_cta_${timestamp}.${audioExt}`;
  const ctaAudioPath = path.join(ROOT, ctaAudioRel);

  let marketContextAudioRel, marketContextAudioPath;
  let investmentPlanAudioRel, investmentPlanAudioPath;
  let featuredStockAudioRel, featuredStockAudioPath;

  // AI が生成した自然文をそのまま使用
  const introText  = script.introTts;
  const stockTexts = script.stocks.map(s => s.ttsText);
  const ctaFinal   = script.ctaText || 'ご視聴いただきありがとうございました。チャンネル登録と高評価をよろしくお願いいたします。';
  const ctaTts     = ctaFinal;

  let marketContextText = '', investmentPlanText = '', featuredText = '';

  if (isNisa) {
    // 手動・AI生成とも、脚本の日本語口播文をそのまま使う（無ければ空 → 該当シーン自動スキップ）。
    // 配音/字幕/画面データはこの脚本フィールドが唯一の出所（単一事実源）。
    marketContextText  = script.marketContext || '';
    investmentPlanText = script.planText      || '';
    featuredText       = script.featuredText  || '';

    // 音声パスは対応テキストがある時だけ設定（単一事実源：テキスト無→音声無→URL無→シーン自動スキップ）
    if (marketContextText)  { marketContextAudioRel  = `temp/jp-audio/jp_market_${timestamp}.${audioExt}`;   marketContextAudioPath  = path.join(ROOT, marketContextAudioRel); }
    if (investmentPlanText) { investmentPlanAudioRel = `temp/jp-audio/jp_plan_${timestamp}.${audioExt}`;      investmentPlanAudioPath = path.join(ROOT, investmentPlanAudioRel); }
    if (featuredText)       { featuredStockAudioRel  = `temp/jp-audio/jp_featured_${timestamp}.${audioExt}`;  featuredStockAudioPath  = path.join(ROOT, featuredStockAudioRel); }
  }

  // 一時音声を登録（成功・失敗どちらでも後で確実に削除するため）
  [introAudioPath, ...stockAudioPaths, ctaAudioPath, marketContextAudioPath, investmentPlanAudioPath, featuredStockAudioPath]
    .forEach(p => { if (p) _tempAudio.add(p); });

  // 並列合成（タスクは関数として保持し、実行は runWithConcurrency に委ねる）
  // 配音は speechify を通す（コード桁読み・千位カンマ/＋除去）。字幕（subtitleSegs）は表示用の原文をそのまま使う。
  const synthTaskFns = [
    () => synthCached(introText, introAudioPath, ttsOpts),
    ...script.stocks.map((_, i) => () => synthCached(stockTexts[i], stockAudioPaths[i], ttsOpts)),
    () => synthCached(ctaTts, ctaAudioPath, ttsOpts),
  ];

  if (isNisa) {
    if (marketContextText)  synthTaskFns.push(() => synthCached(marketContextText,  marketContextAudioPath,  ttsOpts));
    if (investmentPlanText) synthTaskFns.push(() => synthCached(investmentPlanText, investmentPlanAudioPath, ttsOpts));
    if (featuredText)       synthTaskFns.push(() => synthCached(featuredText,       featuredStockAudioPath,  ttsOpts));
  }

  // VOICEVOX はローカルの神経音声合成エンジンのため、全段を同時に投げると過負荷でタイムアウトしやすい
  // → 同時実行数を抑える（Edge TTS はクラウド側のため制限を緩める）
  const TTS_CONCURRENCY = resolvedEngine === 'voicevox' ? 2 : 6;
  const ttsStart = Date.now();
  const allSecs  = await runWithConcurrency(synthTaskFns, TTS_CONCURRENCY);
  if (_ttsHit + _ttsMiss > 0) log(`  TTS: 新規合成 ${_ttsMiss} 件 / キャッシュ再利用 ${_ttsHit} 件`);

  const introSec = allSecs[0];
  const stockSecs= allSecs.slice(1, 1 + script.stocks.length);
  const ctaSec   = allSecs[1 + script.stocks.length];

  let marketContextSec = 0, investmentPlanSec = 0, featuredStockSec = 0;
  if (isNisa) {
    let nisaIdx = 2 + script.stocks.length;
    if (marketContextText)  { marketContextSec  = allSecs[nisaIdx++] || 0; }
    if (investmentPlanText) { investmentPlanSec  = allSecs[nisaIdx++] || 0; }
    if (featuredText)       { featuredStockSec   = allSecs[nisaIdx++] || 0; }
  }

  log(`  ✓ イントロ (${introSec.toFixed(1)}s)`);
  script.stocks.forEach((s, i) => log(`  ✓ 銘柄${i + 1}: ${s.name} (${stockSecs[i].toFixed(1)}s)`));
  log(`  ✓ CTA (${ctaSec.toFixed(1)}s)  [並列合成 ${((Date.now() - ttsStart) / 1000).toFixed(1)}s]`);
  if (isNisa) {
    if (marketContextSec)  log(`  ✓ 市場背景 (${marketContextSec.toFixed(1)}s)`);
    if (investmentPlanSec) log(`  ✓ 投資方案 (${investmentPlanSec.toFixed(1)}s)`);
    if (featuredStockSec)  log(`  ✓ 主推銘柄 (${featuredStockSec.toFixed(1)}s)`);
  }

  // ── Step 3: フレーム計算 ────────────────────────────────────────────────────
  const introDurF  = Math.max(INTRO_BASE, Math.ceil(introSec  * FPS) + BUFFER_F);
  const stockDursF = stockSecs.map(s => Math.max(120, Math.ceil(s * FPS) + BUFFER_F));
  const ctaDurF    = Math.max(CTA_BASE,  Math.ceil(ctaSec    * FPS) + BUFFER_F);

  let marketContextDurF = 0, investmentPlanDurF = 0, featuredStockDurF = 0;
  if (isNisa) {
    marketContextDurF  = marketContextSec  > 0 ? Math.max(90, Math.ceil(marketContextSec  * FPS) + BUFFER_F) : 0;
    investmentPlanDurF = investmentPlanSec > 0 ? Math.max(90, Math.ceil(investmentPlanSec * FPS) + BUFFER_F) : 0;
    featuredStockDurF  = featuredStockSec  > 0 ? Math.max(120,Math.ceil(featuredStockSec  * FPS) + BUFFER_F) : 0;
  }

  const totalF = introDurF
    + stockDursF.reduce((a, b) => a + b, 0)
    + (isNisa ? marketContextDurF + investmentPlanDurF + featuredStockDurF : 0)
    + ctaDurF;
  const totalSec = (totalF / FPS).toFixed(1);
  log(`\n  総尺: ${totalSec}秒 (${totalF}フレーム)`);

  // ── Step 4: 背景解決 + Remotion レンダリング ─────────────────────────────────
  log('\nStep 3: 動画レンダリング中...');
  const skin = resolveSkin(SKIN_ID);
  let bg = { type: 'procedural', id: 'theme' };
  const bgCfg = loadBgConfig();
  const bgChoice = BG_CHOICE || (bgCfg.mode === 'image' ? { kind: 'image' } : null);
  if (bgChoice) {
    if (bgChoice.kind === 'procedural') {
      bg = { type: 'procedural', id: bgChoice.id || 'theme' };
    } else if (bgChoice.kind === 'image') {
      bg = pickImageBg(bgCfg.image, { dir: bgChoice.dir, speed: bgChoice.speed }) || { type: 'procedural', id: 'theme' };
    }
  }
  const bgDirs = (bgChoice && bgChoice.kind === 'image' && bgCfg.image) ? [bgCfg.image.topDir, bgCfg.image.scrollDir] : [];

  const assetSrv  = await startAssetServer(bgDirs);
  const assetBase = `http://127.0.0.1:${assetSrv.srv.address().port}`;
  const toUrl     = rel => `${assetBase}/${rel.replace(/\\/g, '/')}`;
  const fileUrl   = abs => `${assetBase}/__f/${encodeURIComponent(abs)}`;

  if (bg.type === 'image') {
    const conv = img => img ? { src: path.isAbsolute(img.abs || img.src) ? fileUrl(img.abs || img.src) : img.src, w: img.w, h: img.h } : null;
    bg = { type: 'image', top: conv(bg.top), scroll: conv(bg.scroll), dir: bg.dir, speed: bg.speed, scrimOpacity: bg.scrimOpacity };
    log(`  背景：画像 dir=${bg.dir} speed=${bg.speed}`);
  } else {
    log(`  背景：プロシージャル ${bg.id === 'theme' ? '(スキン既定)' : bg.id}`);
  }
  log(`  スキン: ${skin.id} → ${skin.theme}`);

  const { bundle }      = require('@remotion/bundler');
  const { renderMedia, selectComposition, openBrowser } = require('@remotion/renderer');
  const chromePath = resolveChrome();

  const entryPoint = path.join(ROOT, 'src', 'index.tsx');
  const bundleCachePath = path.join(ROOT, 'temp', '.jp-bundle-cache.json');
  const srcDir  = path.join(ROOT, 'src');
  const srcMtime = getAllMtimeMax(srcDir);

  let serveUrl, cacheHit = false;
  if (fs.existsSync(bundleCachePath)) {
    try {
      const cache = JSON.parse(fs.readFileSync(bundleCachePath, 'utf8'));
      if (srcMtime > 0 && cache.srcMtime === srcMtime && cache.serveUrl) {
        serveUrl = cache.serveUrl; cacheHit = true;
      }
    } catch (e) {
      console.warn('[bundle] キャッシュ読み込み失敗、再バンドル:', e.message);
      try { fs.unlinkSync(bundleCachePath); } catch {}
    }
  }
  if (!cacheHit) {
    serveUrl = await bundle({ entryPoint, enableCaching: true });
    fs.mkdirSync(path.dirname(bundleCachePath), { recursive: true });
    const _bcTmp = `${bundleCachePath}.${process.pid}.tmp`;
    fs.writeFileSync(_bcTmp, JSON.stringify({ srcMtime, serveUrl }));
    fs.renameSync(_bcTmp, bundleCachePath);  // 原子写：並列で同時に書いても破損JSONを読まない
  }
  log(`  バンドル完了${cacheHit ? ' (キャッシュ)' : ''}`);

  // 字幕セグメント
  const subtitleSegs = [
    { text: introText, durationInFrames: introDurF },
    ...script.stocks.map((_, i) => ({ text: stockTexts[i], durationInFrames: stockDursF[i] })),
  ];
  if (isNisa) {
    if (marketContextDurF  > 0) subtitleSegs.push({ text: marketContextText,  durationInFrames: marketContextDurF });
    if (investmentPlanDurF > 0) subtitleSegs.push({ text: investmentPlanText, durationInFrames: investmentPlanDurF });
    if (featuredStockDurF  > 0) subtitleSegs.push({ text: featuredText,       durationInFrames: featuredStockDurF });
  }
  subtitleSegs.push({ text: ctaTts, durationInFrames: ctaDurF });

  const inputProps = {
    structure,
    themeId: THEME_ID || skin.theme,        // 编辑器指定优先，否则 skinId→theme
    bg,
    script,
    durationInFrames: totalF,
    fps:             FPS,
    introDur:        introDurF,
    stockDurations:  stockDursF,
    ctaDur:          ctaDurF,
    introAudioPath:  toUrl(introAudioRel),
    stockAudioPaths: stockAudioRels.map(toUrl),
    ctaAudioPath:    toUrl(ctaAudioRel),
    subtitleSegs,
    bgSeed: Math.floor(Math.random() * 999983),
    ...(STOCK_SCENE_ID ? { stockSceneId: STOCK_SCENE_ID } : {}),  // 编辑器选的卡片样式
    ...(FONT_CONFIG    ? { fontConfig: FONT_CONFIG }       : {}),  // 编辑器字体覆盖
  };

  if (isNisa) {
    inputProps.marketContextDur        = marketContextDurF;
    inputProps.investmentPlanDur       = investmentPlanDurF;
    inputProps.featuredStockDur        = featuredStockDurF;
    inputProps.marketContextAudioPath  = marketContextAudioPath  ? toUrl(marketContextAudioRel)  : undefined;
    inputProps.investmentPlanAudioPath = investmentPlanAudioPath ? toUrl(investmentPlanAudioRel) : undefined;
    inputProps.featuredStockAudioPath  = featuredStockAudioPath  ? toUrl(featuredStockAudioRel)  : undefined;
    inputProps.marketContextText       = marketContextText  || undefined;
    inputProps.investmentPlanText      = investmentPlanText || undefined;
    inputProps.featuredText            = featuredText       || undefined;
  }

  // selectComposition と renderMedia でブラウザを共有（起動を1回に減らす。
  // concurrency=タブ数の制御とは無関係なので安定性への影響はない）
  let browser = await openBrowser('chrome', { browserExecutable: chromePath, chromiumOptions: CHROMIUM_OPTIONS });

  const composition = await selectComposition({
    id: 'AiVideo', serveUrl, inputProps,
    puppeteerInstance: browser,
    timeoutInMilliseconds: 30000,
  });

  const videoPath = path.join(OUT_DIR, `jp_${timestamp}.mp4`);
  const cpuCount  = os.cpus().length;
  // 1回目はフル並列で速度優先。クラッシュした場合のみ段階的に並列数を落として再試行する
  // （Remotion自体もタブクラッシュ時に自動でタブを再生成して復旧するため、フル並列が即失敗に直結するわけではない）
  const baseConc = RENDER_CONCURRENCY
    ? Math.max(2, Math.min(RENDER_CONCURRENCY, cpuCount))
    : Math.max(2, Math.min(cpuCount, 12));
  const concurrencyByAttempt = [
    baseConc,
    Math.max(2, Math.min(Math.ceil(baseConc / 2), 6)),
    2,
  ];

  // フレーム番号からシーン名を逆算（onSlowestFrames の調査用）
  function frameToSceneName(frame) {
    let cursor = introDurF;
    if (frame < cursor) return 'Intro';
    for (let i = 0; i < stockDursF.length; i++) {
      if (frame < cursor + stockDursF[i]) return `Stock${i + 1}`;
      cursor += stockDursF[i];
    }
    if (isNisa) {
      if (marketContextDurF > 0)  { if (frame < cursor + marketContextDurF)  return 'MarketContext';  cursor += marketContextDurF; }
      if (investmentPlanDurF > 0) { if (frame < cursor + investmentPlanDurF) return 'InvestmentPlan'; cursor += investmentPlanDurF; }
      if (featuredStockDurF > 0)  { if (frame < cursor + featuredStockDurF)  return 'FeaturedStock';  cursor += featuredStockDurF; }
    }
    return 'CTA';
  }

  const RENDER_MAX_ATTEMPTS = concurrencyByAttempt.length;
  const renderStart = Date.now();
  for (let attempt = 1; attempt <= RENDER_MAX_ATTEMPTS; attempt++) {
    const concurrency = concurrencyByAttempt[attempt - 1];
    try {
      const renderResult = await renderMedia({
        composition, serveUrl, inputProps,
        codec: 'h264', outputLocation: videoPath,
        concurrency,
        crf: 26,
        logLevel: 'error', overwrite: true,
        timeoutInMilliseconds: 300000,
        puppeteerInstance: browser,
      });
      log(`  ✓ レンダリング完了 ${((Date.now() - renderStart) / 1000).toFixed(1)}s（${totalF}フレーム、並列${concurrency}）`);
      const slowest = (renderResult?.slowestFrames || []).slice(0, 5);
      if (slowest.length) {
        log(`  最も遅いフレーム: ${slowest.map(f => `#${f.frame}(${frameToSceneName(f.frame)}) ${f.time}ms`).join(', ')}`);
      }
      break;
    } catch (e) {
      if (attempt === RENDER_MAX_ATTEMPTS) { try { await browser.close(); } catch {} throw e; }
      log(`  ⚠ レンダリング失敗（並列数${concurrency}、タブクラッシュの可能性、第${attempt}/${RENDER_MAX_ATTEMPTS}回): ${e.message}`);
      log(`  並列数を${concurrencyByAttempt[attempt]}に落としてリトライ中...`);
      try { await browser.close(); } catch {}
      browser = await openBrowser('chrome', { browserExecutable: chromePath, chromiumOptions: CHROMIUM_OPTIONS });
    }
  }
  try { await browser.close(); } catch {}

  closeAssetServer(assetSrv);

  // ── Step 5: 変体処理 ─────────────────────────────────────────────────────────
  const finalPaths = [];

  if (VARIANT_CONFIG?.enabled) {
    const rawPath = videoPath.replace(/\.mp4$/, '_raw.mp4');

    try {
      const { applyVariant } = require('./jp-variant');
      const fissionCount = Math.max(1, Math.min(99, parseInt(VARIANT_CONFIG.fissionCount) || 1));
      log(`\nStep 4: 変体処理中（${fissionCount} 副本）...`);

      if (fs.existsSync(rawPath)) try { fs.unlinkSync(rawPath); } catch {}
      fs.renameSync(videoPath, rawPath);

      const varStart = Date.now();
      for (let idx = 0; idx < fissionCount; idx++) {
        const n       = idx + 1;
        const pad     = String(n).padStart(2, '0');
        const varPath = videoPath.replace(/\.mp4$/, `_v${pad}.mp4`);
        try {
          await applyVariant(rawPath, varPath, VARIANT_CONFIG);
          log(`  ✓ 副本 ${n}/${fissionCount}`);
          finalPaths.push(varPath);
        } catch (e) {
          log(`  ⚠ 副本 ${n}/${fissionCount} 失败: ${e.message}`);
          try { fs.unlinkSync(varPath); } catch {}
        }
      }
      log(`  変体完了 ${((Date.now() - varStart) / 1000).toFixed(1)}s`);

    } catch (e) {
      log(`  ⚠ 変体処理エラー: ${e.message}`);
      console.error(e.stack || e);
    }

    if (fs.existsSync(rawPath)) {
      try { fs.renameSync(rawPath, videoPath); } catch (e) {
        log(`  ⚠ 原始视频恢复失败: ${e.message}`);
      }
    }
    if (fs.existsSync(videoPath)) {
      finalPaths.push(videoPath);
      log(finalPaths.length > 1
        ? `  ✓ 本体保留: ${path.basename(videoPath)}`
        : '  ⚠ 全副本失败，使用原始视频');
    } else {
      log('  ❌ 原始视频丢失，跳过输出');
    }
  } else {
    finalPaths.push(videoPath);
  }

  // ── Step 6: メタデータ保存 ───────────────────────────────────────────────────
  const metaDir = path.join(ROOT, 'temp', 'meta');
  fs.mkdirSync(metaDir, { recursive: true });
  let metaPath = '';
  for (const fp of finalPaths) {
    const mp = path.join(metaDir, path.basename(fp).replace(/\.mp4$/, '.json'));
    fs.writeFileSync(mp, JSON.stringify({
      mode:          MODE,
      contentTypeId: CONTENT_TYPE_ID || undefined,
      title:         script.title,
      date:          new Date().toISOString().slice(0, 10),
      stocks:        script.stocks,
      videoFile:     path.basename(fp),
      ttsEngine:     TTS_ENGINE,
      totalSec:      parseFloat(totalSec),
      ttsTexts:      {
        intro: introText,
        stocks: stockTexts,
        marketContext:  isNisa && marketContextText  ? marketContextText  : undefined,
        investmentPlan: isNisa && investmentPlanText ? investmentPlanText : undefined,
        featured:       isNisa && featuredText       ? featuredText       : undefined,
        cta: ctaTts,
      },
    }, null, 2), 'utf8');
    if (!metaPath) metaPath = mp;
  }

  for (const p of finalPaths) {
    try {
      const sizeMb = (fs.statSync(p).size / 1024 / 1024).toFixed(1);
      log(`\n✅ 完了: ${p} (${sizeMb} MB)`);
    } catch {
      log(`\n✅ 完了: ${p}`);
    }
    process.stdout.write(`OUTPUT_PATH:${p}\n`);
  }
  process.stdout.write(`META_PATH:${metaPath}\n`);

  // 一時音声ファイルを削除（成功パス）
  for (const p of _tempAudio) { try { fs.unlinkSync(p); } catch {} }
  _tempAudio.clear();
}

// 同時実行数を制限してタスク群を実行する（ローカルTTSエンジン等の過負荷防止）
async function runWithConcurrency(taskFns, limit) {
  const results = new Array(taskFns.length);
  let next = 0;
  async function worker() {
    while (next < taskFns.length) {
      const i = next++;
      results[i] = await taskFns[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, taskFns.length) }, worker));
  return results;
}

function getAllMtimeMax(dir) {
  let max = 0;
  try {
    for (const f of fs.readdirSync(dir, { recursive: true })) {
      if (/\.(tsx?|css|json)$/.test(f)) {
        try { max = Math.max(max, fs.statSync(path.join(dir, f)).mtimeMs); } catch {}
      }
    }
  } catch {}
  return max;
}

function log(msg) { console.log(msg); }

main()
  .then(() => {
    // stdout を flush してから明示終了する。
    //  ・明示終了の理由: Remotion/Chromium の残留ハンドルでプロセスがハングし、親が完了通知を
    //    受け取れず・並列枠が解放されない問題を防ぐ（特に Node24 + 並列レンダリング時に発生）。
    //  ・flush する理由: process.exit は未完了の stdout 書き込みを切り捨てるため、
    //    OUTPUT_PATH が親に届かず「成功したのに失敗扱い」になるのを防ぐ（FIFO + コールバックで保証）。
    process.stdout.write('', () => process.exit(0));
  })
  .catch(e => {
    for (const p of _tempAudio) { try { fs.unlinkSync(p); } catch {} }  // 失敗時も一時音声を掃除
    console.error('❌', e.stack || e.message || e);                     // stack も出して原因を追えるように
    process.exit(1);
  });
