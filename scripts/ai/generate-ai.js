'use strict';
// 全新 AI 管线编排：题材×格式×口吻 → 选股(真数据) → 组稿(DeepSeek) → TTS → 渲染 MP4。
// 自包含，不依赖旧 jp-generate / 手动代码。TTS 失败的段降级为静音+估算时长(保证出片)。
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { resolve } = require('./layers');
const { selectStocks } = require('./select');
const { compose } = require('./compose');
const { toInputProps, FPS } = require('./render-adapter');
const { synthesize, getAudioDuration } = require('../jp-tts');   // 共享 TTS 工具(只读复用)

const ROOT = path.join(__dirname, '..', '..');
const log = (...a) => console.log('[generate-ai]', ...a);

// 随机端口静态服务：托管 temp 音频 + 任意背景文件夹的图片，给 Remotion <Audio>/<Img>。
// 路由：/<root相对路径>（ROOT 下文件）或 /__f/<encodeURIComponent(绝对路径)>（allowedDirs 下任意文件）。
const MIME = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
function startAssetServer(allowedDirs = []) {
  const allowed = allowedDirs.filter(Boolean).map(d => path.resolve(d));
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      try {
        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        let fp, ok;
        if (urlPath.startsWith('/__f/')) {                       // 任意文件夹的绝对路径(需在 allowedDirs 下)
          fp = path.resolve(decodeURIComponent(urlPath.slice('/__f/'.length)));
          ok = allowed.some(d => fp.startsWith(d));
        } else {                                                 // ROOT 下相对路径(音频等)
          fp = path.resolve(ROOT, urlPath.replace(/^\/+/, ''));
          ok = fp.startsWith(ROOT);
        }
        if (!ok || !fs.existsSync(fp)) { resp.statusCode = 404; return resp.end(); }
        resp.setHeader('Content-Type', MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream');
        fs.createReadStream(fp).pipe(resp);
      } catch { resp.statusCode = 500; resp.end(); }
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function generateAi({ themeId, toneId, skinId, count, ttsOpts = {}, exclude = [], bgChoice = null, stamp = Date.now() }) {
  const { theme, format, tone, skin } = resolve(themeId, toneId, skinId);   // 格式由题材自带
  const n = count || Math.min(theme.defaultStockCount, format.stockCount[1]);

  log(`组合 ${theme.name}(${format.name}) × ${tone.name} × 皮肤${skin.name}｜选股 ${n}`);
  const selection = await selectStocks(theme, n, { exclude });
  if (!selection.stocks.length) throw new Error('选股为空（雅虎/株探未取到）');
  log('选到', selection.stocks.map(s => s.code).join(','), '→ DeepSeek 组稿…');
  const script = await compose({ theme, tone, format, selection });
  log('标题:', script.title);

  // ── TTS（逐段；失败降级静音）──
  const ext = ttsOpts.engine === 'edge' ? 'mp3' : 'wav';
  const audioDir = path.join(ROOT, 'temp', 'ai-audio');
  fs.mkdirSync(audioDir, { recursive: true });
  const ctaText = script.ctaText || 'チャンネル登録とフォローで最新情報をお届けします！';
  const segs = [{ key: 'intro', text: script.hook || script.title }];
  script.stocks.forEach((s, i) => segs.push({ key: `stock${i}`, text: s.ttsText || s.note || s.name }));
  if (format.structure === 'portfolio') {
    if (script.marketContext)  segs.push({ key: 'market',   text: script.marketContext });
    if (script.investmentPlan) segs.push({ key: 'plan',     text: script.investmentPlan });
    if (script.featured)       segs.push({ key: 'featured', text: script.featured });
  }
  segs.push({ key: 'cta', text: ctaText });

  const rels = {}, durs = {};
  let ttsOk = 0;
  for (const seg of segs) {
    const rel = `temp/ai-audio/ai_${stamp}_${seg.key}.${ext}`;
    const out = path.join(ROOT, rel);
    try {
      await synthesize(seg.text || '　', out, ttsOpts);
      durs[seg.key] = Math.max(1, Math.round((await getAudioDuration(out)) * FPS));
      rels[seg.key] = rel; ttsOk++;
    } catch (e) {
      log(`  ⚠ TTS 失败(${seg.key})：${e.message} → 该段静音+估算时长`);
      rels[seg.key] = null; durs[seg.key] = null;   // null → 适配器用估算
    }
  }
  log(`TTS 完成 ${ttsOk}/${segs.length}${ttsOk === 0 ? '（全静音，仍出片）' : ''}`);

  // ── 静态服务 + 组装 inputProps ──
  // ── 先确定背景选择 + 需要托管的图片文件夹（bgChoice 来自 UI/参数，优先于 config）──
  const { loadBgConfig, pickImageBg } = require('./bg-provider');
  const bgCfg = loadBgConfig();
  const choice = bgChoice || (bgCfg.mode === 'image' ? { kind: 'image' } : { kind: 'procedural', id: 'theme' });
  let bgRaw;
  if (choice.kind === 'procedural') {
    bgRaw = { type: 'procedural', id: choice.id || 'theme' };
  } else {
    bgRaw = pickImageBg(bgCfg.image, { dir: choice.dir, speed: choice.speed }) || { type: 'procedural', id: 'theme' };
  }
  const bgDirs = (choice.kind === 'image' && bgCfg.image) ? [bgCfg.image.topDir, bgCfg.image.scrollDir] : [];

  // ── 资源服务（托管 temp 音频 + 背景图片文件夹）──
  const srv = await startAssetServer(bgDirs);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const toUrl = rel => (rel ? `${base}/${rel.replace(/\\/g, '/')}` : undefined);
  const fileUrl = abs => `${base}/__f/${encodeURIComponent(abs)}`;

  const audio = {
    intro: toUrl(rels.intro),
    stocks: script.stocks.map((_, i) => toUrl(rels[`stock${i}`])),
    cta: toUrl(rels.cta),
    market: toUrl(rels.market), plan: toUrl(rels.plan), featured: toUrl(rels.featured),
  };
  const durations = {
    intro: durs.intro, stocks: script.stocks.map((_, i) => durs[`stock${i}`]),
    cta: durs.cta, market: durs.market, plan: durs.plan, featured: durs.featured,
  };

  // 背景图片：绝对路径(任意文件夹)→经资源服务 URL；public 相对→保留(渲染时 staticFile)
  let bg = bgRaw;
  if (bgRaw.type === 'image') {
    const conv = img => img ? { src: (path.isAbsolute(img.src) ? fileUrl(img.abs || img.src) : img.src), w: img.w, h: img.h } : null;
    bg = { type: 'image', top: conv(bgRaw.top), scroll: conv(bgRaw.scroll), dir: bgRaw.dir, speed: bgRaw.speed, scrimOpacity: bgRaw.scrimOpacity };
    log(`背景：图片 top=${bgRaw.top && bgRaw.top.file || '-'} scroll=${bgRaw.scroll && bgRaw.scroll.file || '-'} dir=${bg.dir} speed=${bg.speed}`);
  } else {
    log('背景：程序化 ' + (bg.id && bg.id !== 'theme' ? bg.id : '跟随皮肤'));
  }
  const props = toInputProps(script, { format, tone, skin, audio, durations, bg });

  // ── bundle + render ──
  try {
    const { bundle } = require('@remotion/bundler');
    const { renderMedia, selectComposition } = require('@remotion/renderer');
    log(`bundling…（dur=${props.durationInFrames}f / ${(props.durationInFrames / FPS).toFixed(1)}s）`);
    const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src', 'index.tsx'), enableCaching: true });
    const composition = await selectComposition({ id: 'AiVideo', serveUrl, inputProps: props, timeoutInMilliseconds: 30000 });
    const outDir = path.join(ROOT, 'output');
    fs.mkdirSync(outDir, { recursive: true });
    const videoPath = path.join(outDir, `ai_${themeId}_${format.id}_${toneId}_${stamp}.mp4`);
    log('rendering…');
    await renderMedia({
      composition, serveUrl, inputProps: props,
      codec: 'h264', outputLocation: videoPath, crf: 26,
      concurrency: Math.max(2, Math.min(os.cpus().length, 8)),
      logLevel: 'error', overwrite: true,
    });
    log('✓ 出片:', videoPath);
    console.log('OUTPUT_PATH:' + videoPath);   // server 解析此标记
    return { videoPath, script, props };
  } finally {
    try { srv.close(); } catch {}
  }
}

module.exports = { generateAi };

// 直接运行 = 出一条 MP4。参数：题材 格式 口吻 [股数]；TTS 引擎/嗓音经 env(AI_TTS_ENGINE/AI_TTS_VOICE)。
if (require.main === module) {
  const [themeId = 'high-dividend', toneId = 'analyst', skinId = 'teal', countArg] = process.argv.slice(2);
  const count = countArg ? parseInt(countArg) : undefined;
  const ttsOpts = { engine: process.env.AI_TTS_ENGINE || 'edge', voice: process.env.AI_TTS_VOICE || 'ja-JP-NanamiNeural' };
  let bgChoice = null; try { if (process.env.AI_BG) bgChoice = JSON.parse(process.env.AI_BG); } catch {}
  generateAi({ themeId, toneId, skinId, count, ttsOpts, bgChoice })
    .then(r => console.log('DONE:', r.videoPath))
    .catch(e => { console.error('❌', e.message); process.exit(1); });
}
