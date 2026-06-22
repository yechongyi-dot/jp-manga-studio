'use strict';
/**
 * jp-server.js — JP版制作服务器 (端口 3020)
 * 启动: node jp-server.js
 */

const express   = require('express');
const multer    = require('multer');
const path      = require('path');
const fs        = require('fs');
const { spawn } = require('child_process');
const http      = require('http');

const PORT    = 3020;
const ROOT    = __dirname;
const DEFAULT_OUT_DIR = path.join(ROOT, 'output');
const CONFIG_FILE = path.join(ROOT, 'app-config.json');
function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) || {}; } catch { return {}; }
}
function writeConfig(patch) {                       // 既存項目を保持してマージ書き込み（outputDir と proxy が相互に消えないように）
  const next = { ...readConfig(), ...patch };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
function loadOutputDir() {
  const c = readConfig();
  if (c.outputDir && fs.existsSync(c.outputDir)) return c.outputDir;
  return DEFAULT_OUT_DIR;
}
let OUT_DIR = loadOutputDir();   // 运行时可经 /api/output-dir 切换
const UPL_DIR = path.join(ROOT, 'temp', 'uploads');
const LOG_DIR = path.join(ROOT, 'temp', 'logs');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(UPL_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });

// ── ファイルログ（クラッシュ調査用：起動ごとに1ファイル、console出力を全部書き込む）──
const LOG_FILE = path.join(LOG_DIR, `server_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.log`);
// 古いログを掃除（最新20件のみ保持。長期運用でディスクが埋まるのを防ぐ）
try {
  const _logs = fs.readdirSync(LOG_DIR).filter(f => /^server_.*\.log$/.test(f)).sort();
  for (const f of _logs.slice(0, -20)) { try { fs.unlinkSync(path.join(LOG_DIR, f)); } catch {} }
} catch {}
const _logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function writeLog(level, ...args) {
  const msg = args.map(a => {
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(' ');
  try { _logStream.write(`[${new Date().toISOString()}] [${level}] ${msg}\n`); } catch {}
}

const _origLog   = console.log;
const _origError = console.error;
const _origWarn  = console.warn;
console.log   = (...args) => { _origLog(...args);   writeLog('INFO',  ...args); };
console.error = (...args) => { _origError(...args); writeLog('ERROR', ...args); };
console.warn  = (...args) => { _origWarn(...args);  writeLog('WARN',  ...args); };

process.on('uncaughtException', err => {
  writeLog('FATAL', '未捕获异常 Uncaught Exception:', err?.stack || err?.message || err);
});
process.on('unhandledRejection', reason => {
  writeLog('FATAL', '未处理的 Promise 拒绝 Unhandled Rejection:', reason?.stack || reason);
});

writeLog('INFO', `=== サーバー起動 (PID ${process.pid}) ===`);

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/output', (req, res, next) => express.static(OUT_DIR)(req, res, next));  // 动态：跟随当前输出目录

const { generateYouTubeMeta, translateToJapanese, translateToChinese, splitManualSegments, buildManualNisaScript } = require('./scripts/jp-parser');
const { checkVoicevox, listVoicevoxSpeakers } = require('./scripts/jp-tts');

const upload = multer({ dest: UPL_DIR, limits: { fileSize: 2 * 1024 * 1024 } });

// ── Remotion Studio 进程管理 (端口 3021) ──────────────────────
let studioProc  = null;
let studioReady = false;

function probeStudio() {
  return new Promise(resolve => {
    const req = http.get('http://127.0.0.1:3021/', res => {
      res.resume();
      studioReady = true;
      resolve(true);
    });
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

app.get('/api/studio/status', async (_req, res) => {
  const ready = await probeStudio();
  res.json({ ready, port: 3021 });
});

app.post('/api/studio/start', async (_req, res) => {
  if (await probeStudio()) return res.json({ started: false, ready: true });
  if (studioProc) return res.json({ started: false, ready: false });
  studioProc = spawn('npx', ['remotion', 'studio', '--port=3021'], {
    cwd: ROOT, shell: true,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, BROWSER: 'none', CI: '1' },
  });
  studioProc.on('exit', code => {
    console.log(`[Studio] 进程退出 (code=${code})`);
    studioProc = null; studioReady = false;
  });
  studioProc.on('error', err => {
    console.error('[Studio] 启动失败:', err.message);
    studioProc = null; studioReady = false;
  });
  res.json({ started: true, ready: false });
});

// ── 任务状态（并行ジョブ管理：バッチ並列レンダリング対応）──────────
const jobs = new Map();   // jobId → { clients:Set, outputPaths:[], metaPath:'' }
const MAX_PARALLEL = 2;   // 同時実行ジョブ数の上限（20コアで2本同時が安定）

// 带容量上限的 Map，防止长时间运行内存泄漏
class CappedMap extends Map {
  constructor(maxSize = 500) { super(); this._max = maxSize; }
  set(k, v) {
    if (this.size >= this._max) { const oldest = this.keys().next().value; this.delete(oldest); }
    return super.set(k, v);
  }
}
const _videoMeta     = new CappedMap(500);  // basename → metaData
const _ytMetaCache   = new CappedMap(200);  // videoUrl → ytMeta
const _cnScriptCache = new CappedMap(200);  // videoUrl → 完整中文翻译稿

function sseEvent(clients, type, data) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch {}
  }
}

// ── 进度文字解析 ──────────────────────────────────────────────
function parseProgress(line) {
  if (/Step 1/.test(line))        return { pct: 15, msg: '正在解析脚本...' };
  if (/仿写/.test(line))           return { pct: 20, msg: '正在AI生成脚本...' };
  if (/Step 2/.test(line))        return { pct: 35, msg: '正在合成配音...' };
  if (/Step 3/.test(line))        return { pct: 60, msg: '正在渲染视频...' };
  if (/バンドル/.test(line))       return { pct: 65, msg: '视频渲染中...' };
  if (/Step 4/.test(line))        return { pct: 95, msg: '正在变体处理...' };
  if (/完了|完成/.test(line))      return { pct: 98, msg: '即将完成...' };
  return null;
}

// ── 多段脚本分割（2+空行为分隔符）────────────────────────────
function splitScripts(text) {
  return text.split(/(?:\r?\n){3,}/)
    .map(s => s.trim())
    .filter(s => s.length >= 30);
}

// ── GET /api/content-presets ─────────────────────────────────
app.get('/api/content-presets', (_req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-presets.json'), 'utf8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'content-presets.json 读取失败', detail: e.message });
  }
});

// ── POST /api/upload ──────────────────────────────────────────
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '文件为空' });
  let text;
  try { text = fs.readFileSync(req.file.path, 'utf8'); }
  catch (e) { try { fs.unlinkSync(req.file.path); } catch {} return res.status(500).json({ error: '文件读取失败: ' + e.message }); }
  try { fs.unlinkSync(req.file.path); } catch {}
  const scripts = splitScripts(text);
  res.json({ text, scripts, count: scripts.length });
});

// ── POST /api/generate ────────────────────────────────────────
app.post('/api/generate', (req, res) => {
  if (jobs.size >= MAX_PARALLEL) return res.status(409).json({ error: `同時生成数が上限(${MAX_PARALLEL})に達しています、しばらくお待ちください` });

  const {
    mode          = 'direct',
    text          = '',
    lineId        = '',
    ttsEngine     = 'auto',
    ttsVoice      = 'ja-JP-NanamiNeural',
    ttsRate       = '+20%',
    vvSpeaker     = 3,
    vvSpeed       = 1.20,
    vvVolume      = 1.0,
    vvPitch       = 0.0,
    vvIntonation  = 1.0,
    vvPrePhoneme  = 0.1,
    vvPostPhoneme = 0.1,
    apiKey        = '',
    batchIndex    = 0,
    excludeStocks = [],
    variantConfig = null,
    contentTypeId = '',
    manualScript  = null,
    renderConcurrency = null,
    skinId        = '',
    bg            = null,
    stockSceneId  = '',
    themeId       = '',
    fontConfig    = null,
  } = req.body;

  // manualScript 模式：直接用现成日文脚本；contentTypeId 模式：走 imitate AI生成
  if (!manualScript && !contentTypeId && !text.trim()) return res.status(400).json({ error: '脚本内容不能为空' });

  const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const job = { clients: new Set(), outputPaths: [], metaPath: '', startAt: Date.now() };
  jobs.set(jobId, job);
  res.json({ jobId });

  const cfgObj = {
    mode, text, lineId,
    ttsEngine, ttsVoice, ttsRate,
    vvSpeaker, vvSpeed, vvVolume, vvPitch, vvIntonation, vvPrePhoneme, vvPostPhoneme,
    batchIndex, excludeStocks,
    variantConfig,
    contentTypeId,
    manualScript,
    renderConcurrency,
    skinId,
    bg,
    stockSceneId,
    themeId,
    fontConfig,
    outputDir: OUT_DIR,
  };

  // apiKey はコマンドライン引数ではなく環境変数で渡す（tasklist 等の CommandLine に平文露出するのを防ぐ。
  // jp-generate は cfg.apiKey 無→process.env.DEEPSEEK_KEY に fallback 済み）
  const proc = spawn(
    process.execPath,
    ['scripts/jp-generate.js', '--config', JSON.stringify(cfgObj)],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DEEPSEEK_KEY: apiKey || process.env.DEEPSEEK_KEY || '', JP_PROXY: readConfig().proxy || process.env.JP_PROXY || '' },
    }
  );

  job.proc = proc;
  // 兜底：子プロセスが「一定時間まったく出力しない」＝ハングとみなし強制終了する。
  //   旧実装は「総時間25分」で判定していたが、変体を多数指定すると 1 本あたり数分×本数で
  //   正常でも25分を超え、進行中のジョブを誤kill していた（slow≠hang）。出力(進捗ログ)が
  //   続く限り殺さず、無出力が IDLE_LIMIT 続いた時だけ殺す。1本の変体エンコード中は
  //   jp-generate 側が無出力になるため、窓は変体1本の上限(30分)より長くとる。
  const IDLE_LIMIT_MS = 35 * 60 * 1000;
  job.lastProgressAt = Date.now();
  job.watchdog = setInterval(() => {
    if (Date.now() - job.lastProgressAt < IDLE_LIMIT_MS) return;
    const mins = Math.round(IDLE_LIMIT_MS / 60000);
    writeLog('JOB-ERR', `[${jobId}] ${mins}分間 出力なし、ハングした子プロセスを強制終了`);
    try {
      if (proc.pid && process.platform === 'win32') require('child_process').execFile('taskkill', ['/T', '/F', '/PID', String(proc.pid)]);
      else proc.kill('SIGKILL');
    } catch {}
    clearInterval(job.watchdog);
    sseEvent(job.clients, 'error', { message: `生成タイムアウト（${mins}分間 無応答）` });
    for (const c of job.clients) { try { c.end(); } catch {} }
    jobs.delete(jobId);
  }, 60 * 1000);
  writeLog('JOB', `[${jobId}] 生成開始 ${manualScript ? 'manual' : 'imitate'} 同時実行${jobs.size}/${MAX_PARALLEL}${renderConcurrency ? ' 並列' + renderConcurrency : ''}`);

  // stdout を行バッファリングして処理（chunk 境界で OUTPUT_PATH 行が切れて消失するのを防ぐ＝「成功なのに失敗」対策）
  let stdoutBuf = '';
  const handleStdoutLine = (line) => {
    if (line.startsWith('OUTPUT_PATH:')) {
      job.outputPaths.push(line.slice('OUTPUT_PATH:'.length).trim());
      writeLog('JOB', `[${jobId}] ${line.trim()}`);
    } else if (line.startsWith('META_PATH:')) {
      job.metaPath = line.slice('META_PATH:'.length).trim();
    } else if (line.trim()) {
      writeLog('JOB', `[${jobId}] ${line.trim()}`);
      const parsed = parseProgress(line);
      sseEvent(job.clients, 'progress', {
        log: line.trim(),
        pct: parsed?.pct,
        msg: parsed?.msg,
      });
    }
  };
  proc.stdout.on('data', chunk => {
    job.lastProgressAt = Date.now();  // 出力があれば「生存」とみなし、ハング検知をリセット
    stdoutBuf += chunk.toString();
    let nl;
    while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
      handleStdoutLine(stdoutBuf.slice(0, nl));
      stdoutBuf = stdoutBuf.slice(nl + 1);
    }
  });

  proc.stderr.on('data', chunk => {
    job.lastProgressAt = Date.now();
    const msg = chunk.toString().trim();
    if (msg) {
      writeLog('JOB-ERR', `[${jobId}] ${msg}`);
      sseEvent(job.clients, 'progress', { log: `⚠ ${msg}` });
    }
  });

  proc.on('error', err => {
    clearInterval(job.watchdog);
    writeLog('JOB-ERR', `[${jobId}] 子进程启动失败: ${err.message}`);
    sseEvent(job.clients, 'error', { message: `子进程启动失败: ${err.message}` });
    for (const c of job.clients) { try { c.end(); } catch {} }
    jobs.delete(jobId);
  });

  proc.on('exit', code => {
    clearInterval(job.watchdog);
    if (stdoutBuf) { handleStdoutLine(stdoutBuf); stdoutBuf = ''; }  // 改行なしで残った最終行（OUTPUT_PATH 等）を取りこぼさない
    writeLog('JOB', `[${jobId}] 子进程退出 code=${code} 所要${((Date.now() - job.startAt) / 1000).toFixed(1)}s`);
    if (code === 0 && job.outputPaths.length > 0) {
      let metaData = {};
      try {
        if (job.metaPath && fs.existsSync(job.metaPath)) {
          metaData = JSON.parse(fs.readFileSync(job.metaPath, 'utf8'));
        }
      } catch {}
      for (const p of job.outputPaths) _videoMeta.set(path.basename(p), metaData);
      try { if (job.metaPath && fs.existsSync(job.metaPath)) fs.unlinkSync(job.metaPath); } catch {}
      sseEvent(job.clients, 'done', {
        videoUrl:   `/output/${path.basename(job.outputPaths[0])}`,
        videoPath:  job.outputPaths[0],
        videoPaths: job.outputPaths,
        meta:       metaData,
      });
    } else {
      sseEvent(job.clients, 'error', { message: `进程异常退出 (code=${code})` });
    }
    for (const c of job.clients) { try { c.end(); } catch {} }
    jobs.delete(jobId);
  });
});

// ── 全新 AI 管线（三层正交：题材×格式×口吻）。完全独立，不碰手动/旧 imitate ──────
function readEnvKey() {
  try {
    const m = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^DEEPSEEK_KEY\s*=\s*(.+)$/m);
    return m ? m[1].trim() : '';
  } catch { return ''; }
}

app.get('/api/ai/layers', (_req, res) => {
  try {
    delete require.cache[require.resolve('./scripts/ai/layers')];
    const { loadLayers, matrix } = require('./scripts/ai/layers');
    const { themes, formats, tones, skins } = loadLayers();
    let backgrounds = [];
    try { backgrounds = (JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'backgrounds.json'), 'utf8')).procedural) || []; } catch {}
    res.json({ themes, formats, tones, skins, backgrounds, matrix: matrix() });
  } catch (e) {
    res.status(500).json({ error: 'AI 配置读取失败', detail: e.message });
  }
});

app.post('/api/ai/generate', (req, res) => {
  const { themeId, toneId, skinId, count, apiKey, ttsEngine, ttsVoice, bg } = req.body || {};
  if (!themeId || !toneId) return res.status(400).json({ error: '缺少 题材/口吻' });
  const key = (apiKey || readEnvKey() || process.env.DEEPSEEK_KEY || '').trim();
  if (!key) return res.status(400).json({ error: '缺少 DeepSeek API Key（填入或写进 .env）' });

  const jobId = `ai_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const job = { clients: new Set(), outputPaths: [], startAt: Date.now(), lastProgressAt: Date.now() };
  jobs.set(jobId, job);
  res.json({ jobId });

  const args = ['scripts/ai/generate-ai.js', String(themeId), String(toneId), String(skinId || 'blue')];
  if (count) args.push(String(count));
  const proc = spawn(process.execPath, args, {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env, DEEPSEEK_KEY: key,
      JP_PROXY: readConfig().proxy || process.env.JP_PROXY || '',
      AI_TTS_ENGINE: ttsEngine || 'edge', AI_TTS_VOICE: ttsVoice || 'ja-JP-NanamiNeural',
      AI_BG: bg ? JSON.stringify(bg) : '',   // 背景选择(图片库/程序化+方向)
    },
  });
  job.proc = proc;
  const IDLE = 35 * 60 * 1000;
  job.watchdog = setInterval(() => {
    if (Date.now() - job.lastProgressAt < IDLE) return;
    try { if (proc.pid && process.platform === 'win32') require('child_process').execFile('taskkill', ['/T', '/F', '/PID', String(proc.pid)]); else proc.kill('SIGKILL'); } catch {}
    clearInterval(job.watchdog);
    sseEvent(job.clients, 'error', { message: '生成超时（35分钟无输出）' });
    for (const c of job.clients) { try { c.end(); } catch {} }
    jobs.delete(jobId);
  }, 60 * 1000);
  writeLog('AI', `[${jobId}] 生成開始 ${themeId}×${toneId}×${skinId || 'blue'}${bg ? '×bg' : ''}`);

  let buf = '';
  const onLine = line => {
    if (line.startsWith('OUTPUT_PATH:')) { job.outputPaths.push(line.slice('OUTPUT_PATH:'.length).trim()); writeLog('AI', `[${jobId}] ${line.trim()}`); }
    else if (line.trim()) { writeLog('AI', `[${jobId}] ${line.trim()}`); sseEvent(job.clients, 'progress', { log: line.trim() }); }
  };
  proc.stdout.on('data', c => { job.lastProgressAt = Date.now(); buf += c.toString(); let nl; while ((nl = buf.indexOf('\n')) !== -1) { onLine(buf.slice(0, nl)); buf = buf.slice(nl + 1); } });
  proc.stderr.on('data', c => { job.lastProgressAt = Date.now(); const m = c.toString().trim(); if (m) { writeLog('AI-ERR', `[${jobId}] ${m}`); sseEvent(job.clients, 'progress', { log: `⚠ ${m}` }); } });
  proc.on('error', err => { clearInterval(job.watchdog); sseEvent(job.clients, 'error', { message: '子进程启动失败: ' + err.message }); for (const c of job.clients) { try { c.end(); } catch {} } jobs.delete(jobId); });
  proc.on('exit', code => {
    clearInterval(job.watchdog);
    if (buf) { onLine(buf); buf = ''; }
    writeLog('AI', `[${jobId}] 退出 code=${code} ${((Date.now() - job.startAt) / 1000).toFixed(1)}s`);
    if (code === 0 && job.outputPaths.length) {
      sseEvent(job.clients, 'done', { videoUrl: `/output/${path.basename(job.outputPaths[0])}`, videoPath: job.outputPaths[0], videoPaths: job.outputPaths });
    } else {
      sseEvent(job.clients, 'error', { message: `生成失败 (code=${code})` });
    }
    for (const c of job.clients) { try { c.end(); } catch {} }
    jobs.delete(jobId);
  });
});

// ── 背景图片库设置（顶部图文件夹 / 底部滚动图文件夹 / 方向 / 速度）──────────────
function readBgJson() {
  // procedural 列表来自 committed config/backgrounds.json；机器专属 mode+image 来自 app-config.json.bg
  // —— 必须与 scripts/ai/bg-provider.js loadBgConfig 一致，否则 UI 设的图片文件夹生成时读不到（出片丢背景）。
  let procedural = [];
  try { procedural = (JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'backgrounds.json'), 'utf8')).procedural) || []; } catch {}
  const bg = readConfig().bg || {};
  return { mode: bg.mode || 'image', image: bg.image || {}, procedural };
}
function countImages(d) {
  if (!d) return 0;
  try { return fs.readdirSync(path.isAbsolute(d) ? d : path.join(ROOT, d)).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).length; }
  catch { return 0; }
}
app.get('/api/bg-config', (_req, res) => {
  const j = readBgJson(); const img = j.image || {};
  res.json({
    mode: j.mode || 'image',
    image: {
      topDir: img.topDir || '', scrollDir: img.scrollDir || '',
      dir: img.dir || 'up', scrollSpeed: img.scrollSpeed ?? 1, scrimOpacity: img.scrimOpacity ?? 0.1,
      topCount: countImages(img.topDir), scrollCount: countImages(img.scrollDir),
    },
  });
});
app.post('/api/bg-config', (req, res) => {
  const b = req.body || {};
  const cur = readConfig().bg || {};
  const image = { ...(cur.image || {}) };
  if (b.topDir != null) image.topDir = String(b.topDir).trim();
  if (b.scrollDir != null) image.scrollDir = String(b.scrollDir).trim();
  if (b.dir) image.dir = b.dir === 'down' ? 'down' : 'up';
  if (b.scrollSpeed != null) image.scrollSpeed = Math.max(0.2, Math.min(5, Number(b.scrollSpeed) || 1));
  if (b.scrimOpacity != null) image.scrimOpacity = Math.max(0, Math.min(1, Number(b.scrimOpacity)));
  try {
    // 写入 app-config.json 的 bg 键（bg-provider 从这里读；该文件 gitignore，自动更新 reset --hard 不覆盖）。
    writeConfig({ bg: { mode: cur.mode || 'image', image } });
    res.json({ ok: true, image: { ...image, topCount: countImages(image.topDir), scrollCount: countImages(image.scrollDir) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 背景图片预览（给编辑器 Player 显示图片背景；取每个文件夹首张作代表，不动轮选游标）──
const { listImages: _bgListImages, imageSize: _bgImageSize } = require('./scripts/ai/bg-provider');
const _BG_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
app.get('/api/bg-preview', (_req, res) => {
  try {
    const img = readBgJson().image || {};
    const tops = _bgListImages(img.topDir || 'public/backgrounds/top');
    const scrolls = _bgListImages(img.scrollDir || 'public/backgrounds/scroll');
    const mk = (arr, slot) => arr.length ? { url: `/api/bg-file?slot=${slot}&i=0`, ..._bgImageSize(arr[0].abs) } : null;
    res.json({
      ok: true, top: mk(tops, 'top'), scroll: mk(scrolls, 'scroll'),
      dir: img.dir || 'up', speed: img.scrollSpeed ?? 1, scrimOpacity: img.scrimOpacity ?? 0.1,
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
// 只服务「配置文件夹内枚举到的」图片（按索引取，路径来自 listImages 而非用户输入，防穿越）
app.get('/api/bg-file', (req, res) => {
  const img = readBgJson().image || {};
  const slot = req.query.slot === 'scroll' ? 'scroll' : 'top';
  const i = Math.max(0, parseInt(req.query.i, 10) || 0);
  const list = _bgListImages((slot === 'scroll' ? img.scrollDir : img.topDir) || '');
  if (!list[i]) return res.status(404).end();
  res.type(_BG_MIME[path.extname(list[i].abs).toLowerCase()] || 'application/octet-stream');
  res.sendFile(list[i].abs);
});

// ── 限流并发 map（避免一次性把全部段落翻译请求打给 DeepSeek）──
function mapWithConcurrency(items, limit, fn) {
  return new Promise((resolve, reject) => {
    const results = new Array(items.length);
    let idx = 0, done = 0, failed = false;
    function pump() {
      if (failed) return;
      while (idx < items.length && (idx - done) < limit) {
        const cur = idx++;
        Promise.resolve(fn(items[cur], cur))
          .then(r => { results[cur] = r; done++; (done === items.length) ? resolve(results) : pump(); })
          .catch(e => { failed = true; reject(e); });
      }
    }
    items.length ? pump() : resolve(results);
  });
}

// ── 模板 CRUD ──────────────────────────────────────────────────────────────
const TPL_DIR = path.join(ROOT, 'config', 'templates');
if (!fs.existsSync(TPL_DIR)) fs.mkdirSync(TPL_DIR, { recursive: true });

app.get('/api/templates', (_req, res) => {
  try {
    const files = fs.readdirSync(TPL_DIR).filter(f => f.endsWith('.json')).sort();
    const list = files.map(f => {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(TPL_DIR, f), 'utf8'));
        return { name: d.name || f.replace('.json', ''), file: f, createdAt: d.createdAt };
      } catch { return { name: f.replace('.json', ''), file: f }; }
    });
    res.json(list);
  } catch { res.json([]); }
});

app.post('/api/templates', (req, res) => {
  const { name, props } = req.body || {};
  if (!name || !props) return res.status(400).json({ error: '需要 name 和 props' });
  const slug = name.replace(/[^a-zA-Z0-9一-鿿぀-ゟ゠-ヿ_-]/g, '_').substring(0, 60);
  const file = slug + '.json';
  const data = { name, createdAt: new Date().toISOString(), props };
  fs.writeFileSync(path.join(TPL_DIR, file), JSON.stringify(data, null, 2), 'utf8');
  res.json({ ok: true, file });
});

app.get('/api/templates/:file', (req, res) => {
  const fp = path.join(TPL_DIR, path.basename(req.params.file));
  if (!fs.existsSync(fp)) return res.status(404).json({ error: '模板不存在' });
  try { res.json(JSON.parse(fs.readFileSync(fp, 'utf8'))); }
  catch { res.status(500).json({ error: '读取失败' }); }
});

app.delete('/api/templates/:file', (req, res) => {
  const fp = path.join(TPL_DIR, path.basename(req.params.file));
  try { fs.unlinkSync(fp); } catch {}
  res.json({ ok: true });
});

// ── 手动文案段完整性检查 ──
function checkManualIssues(script) {
  const p = [];
  if (!script) return ['解析失败'];
  if (!script.title) p.push('缺标题');
  if (!script.stocks || !script.stocks.length) p.push('无股票');
  else {
    if (script.stocks.some(s => !s.code || s.code === '????')) p.push('有股票缺/识别不到代码');
    if (script.stocks.some(s => !s.buyPrice || s.buyPrice === '—')) p.push('有股票缺买价');
    if (script.stocks.some(s => !s.ttsText)) p.push('有股票缺口播文');
  }
  // 市场背景/投资方案/精选股/CTA 为可选：文案没写则对应场景自动跳过，不计为缺失
  return p;
}

// ── 完整配音文案（按视频播放顺序，供预览校对）──
// 配音/字幕/画面はすべてこの脚本フィールドが唯一の出所（手動文案 → AI 翻訳済み日本語）
function buildTtsList(script) {
  const list = [];
  if (script.introTts)      list.push({ label: '导入',     text: script.introTts });
  (script.stocks || []).forEach((s, i) => list.push({ label: `銘柄${i + 1} ${s.name}`, text: s.ttsText }));
  if (script.marketContext) list.push({ label: '市场背景', text: script.marketContext });
  if (script.planText)      list.push({ label: '投资方案', text: script.planText });
  if (script.featuredText)  list.push({ label: '主推股',   text: script.featuredText });
  if (script.ctaText)       list.push({ label: 'CTA',      text: script.ctaText });
  return list;
}

// ── POST /api/parse-scripts（手动文案：解析 + 翻译，返回预览）──────────────────
app.post('/api/parse-scripts', async (req, res) => {
  const { text = '', apiKey: clientKey = '', lineId = '' } = req.body;
  if (!text.trim()) return res.status(400).json({ error: '文案内容不能为空' });

  // AI 路径と同様に .env も fallback（手動導入でも .env の鍵がそのまま効くように）
  const apiKey = clientKey || readEnvKey() || process.env.DEEPSEEK_KEY || '';
  try {
    const segs = splitManualSegments(text);
    if (!segs.length) return res.status(400).json({ error: '未解析到文案段落（请用空行分隔每个视频）' });

    // 每段：AI で「各段の口播原文＋数据」を抽出し日本語へ翻訳 → script。無 key ではプレビュー不可。
    const segments = await mapWithConcurrency(segs, 3, async (rawText, i) => {
      let script = null, ttsList = [], issues = [];
      if (apiKey) {
        try {
          script  = await buildManualNisaScript(rawText, apiKey, lineId);
          ttsList = buildTtsList(script);
          issues  = checkManualIssues(script);
        }
        catch (e) { issues.push('解析/翻译失败: ' + e.message); }
      } else {
        issues.push('未配置 DeepSeek API Key，无法解析翻译');
      }
      return { index: i, cn: rawText, script, ttsList, issues };
    });

    const _ok = segments.filter(s => !s.issues.length).length;
    console.log(`[parse-scripts] 解析${segs.length}段 翻译${apiKey ? 'on' : 'off'} 数据完整${_ok}/${segs.length}`);
    res.json({ count: segs.length, hasKey: !!apiKey, segments });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/progress/:jobId ──────────────────────────────────
app.get('/api/progress/:jobId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: '任务不存在' })}\n\n`);
    res.end(); return;
  }
  job.clients.add(res);
  req.on('close', () => { job.clients.delete(res); });
});

// ── GET /api/status ───────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  res.json({ running: jobs.size > 0, count: jobs.size, jobIds: [...jobs.keys()] });
});

// ── 日志文件下载（故障排查用）────────────────────────────────────
app.get('/api/logs', (_req, res) => {
  try {
    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.log'))
      .map(f => {
        const stat = fs.statSync(path.join(LOG_DIR, f));
        return { name: f, size: stat.size, mtime: stat.mtime };
      })
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    res.json({ current: path.basename(LOG_FILE), files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/logs/download', (req, res) => {
  const name = req.query.name ? path.basename(req.query.name) : path.basename(LOG_FILE);
  const filePath = path.join(LOG_DIR, name);
  if (!filePath.startsWith(LOG_DIR) || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: '日志文件不存在' });
  }
  _logStream.write('', () => res.download(filePath, name));
});

// ── POST /api/reset ───────────────────────────────────────────
app.post('/api/reset', (_req, res) => {
  for (const job of jobs.values()) {
    try {
      if (job.proc?.pid && process.platform === 'win32') {
        // Windows: /T で子プロセス（Chromium/ffmpeg/python）ごとツリー削除
        require('child_process').execFile('taskkill', ['/T', '/F', '/PID', String(job.proc.pid)]);
      } else {
        job.proc?.kill('SIGKILL');
      }
    } catch {}
  }
  jobs.clear();
  res.json({ ok: true });
});

// ── GET /api/browse-folder ────────────────────────────────────
app.get('/api/browse-folder', (_req, res) => {
  const { execFile } = require('child_process');
  // -STA 是 Windows Forms 对话框必须，不能带 -NonInteractive
  // 创建一个置顶的隐藏 Form 作为 owner，确保对话框弹到最前面
  const ps = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
Add-Type -AssemblyName System.Windows.Forms;
[System.Windows.Forms.Application]::EnableVisualStyles();
$owner = New-Object System.Windows.Forms.Form;
$owner.TopMost = $true;
$owner.ShowInTaskbar = $false;
$owner.WindowState = 'Minimized';
$owner.Show();
$d = New-Object System.Windows.Forms.FolderBrowserDialog;
$d.Description = '选择叠加素材文件夹';
$d.ShowNewFolderButton = $false;
if ($d.ShowDialog($owner) -eq 'OK') { Write-Output $d.SelectedPath }
$owner.Dispose()
`.trim();
  execFile('powershell', ['-NoProfile', '-STA', '-Command', ps],
    { timeout: 120000 },
    (err, stdout) => {
      const folder = stdout.trim();
      res.json(folder ? { ok: true, path: folder } : { ok: false, path: '' });
    }
  );
});

// ── 输出目录 GET / POST ───────────────────────────────────────
app.get('/api/output-dir', (_req, res) => {
  res.json({ outputDir: OUT_DIR, isDefault: OUT_DIR === DEFAULT_OUT_DIR });
});
app.post('/api/output-dir', (req, res) => {
  const dir = ((req.body && req.body.outputDir) || '').trim();
  if (!dir) return res.status(400).json({ error: '目录不能为空' });
  // 安全校验：本地绝对路径のみ、UNC とシステムディレクトリは拒否
  if (!path.isAbsolute(dir) || /^\\\\/.test(dir)) return res.status(400).json({ error: '请使用本地绝对路径' });
  if (/[\\/](Windows|Program Files( \(x86\))?)([\\/]|$)/i.test(dir)) return res.status(400).json({ error: '不能使用系统目录' });
  try {
    fs.mkdirSync(dir, { recursive: true });
    OUT_DIR = dir;
    writeConfig({ outputDir: dir });   // マージ書き込み（proxy 等を保持）
    writeLog('SYS', `输出目录已切换: ${dir}`);
    res.json({ ok: true, outputDir: OUT_DIR });
  } catch (e) {
    res.status(500).json({ error: '设置失败: ' + e.message });
  }
});

// ── 代理设置（行情抓取走代理；中国网络访问株探需要）GET / 保存 / 测试 ──────────
app.get('/api/proxy', (_req, res) => {
  res.json({ proxy: readConfig().proxy || '' });
});
app.post('/api/proxy', (req, res) => {
  const proxy = ((req.body && req.body.proxy) || '').trim();
  if (proxy && !/^(socks5?|https?):\/\/[^\s/]+:\d+$/i.test(proxy)) {
    return res.status(400).json({ error: '格式应为 http://127.0.0.1:7890 或 socks5://127.0.0.1:7890' });
  }
  try { writeConfig({ proxy }); res.json({ ok: true, proxy }); }
  catch (e) { res.status(500).json({ error: '保存失败: ' + e.message }); }
});
app.post('/api/test-proxy', async (req, res) => {
  const proxy = ((req.body && req.body.proxy != null ? req.body.proxy : readConfig().proxy) || '').trim();
  const code  = ((req.body && req.body.code) || '7203').trim();
  try {
    const { fetchQuoteVia } = require('./scripts/jp-quote');
    const q = await fetchQuoteVia(proxy, code);
    res.json({ ok: true, proxy: proxy || '(直连)', quote: q });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message, proxy: proxy || '(直连)' });
  }
});

// ── GET /api/outputs ──────────────────────────────────────────
app.get('/api/outputs', (_req, res) => {
  let files = [];
  try {
    files = fs.readdirSync(OUT_DIR)
      .filter(f => f.endsWith('.mp4') && f.startsWith('jp_') && !f.includes('_raw.'))
      .map(f => {
        try {
          const stat = fs.statSync(path.join(OUT_DIR, f));
          const meta = _videoMeta.get(f) || {};
          return { name: f, url: `/output/${f}`, size: stat.size, mtime: stat.mtime, title: meta.title || f, mode: meta.mode || '—' };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
  } catch (e) { writeLog('SYS', `输出目录读取失败（可能已被移动/删除）: ${e.message}`); }
  res.json(files);
});

// ── HTML 转义 ────────────────────────────────────────────────
function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── AI 不要のローカル YouTube メタ生成（API キー未設定時フォールバック）──
function buildFallbackYTMeta(meta, lineId) {
  const stocks   = meta.stocks || [];
  const names    = stocks.map(s => s.name).filter(Boolean);
  const topPct   = stocks[0]?.pct || '';
  const title    = `🔥 ${meta.title || '注目銘柄'}【${names.join('・') || '厳選銘柄'}】${topPct ? ' 最大' + topPct : ''}`;

  const lineCta  = lineId
    ? `📲 LINE: ${lineId} 追加で最新の日本株情報を無料配信中！`
    : '📲 チャンネル登録で最新情報をお届けします！';
  const stockLines = stocks.map(s =>
    `・${s.name || ''}（${s.code || ''}）買値 ${s.buyPrice || '—'}　目標 ${s.pct || '—'}`
  ).join('\n');
  const description = [
    `${meta.title || '注目銘柄'}をご紹介します。プロが厳選した${stocks.length}銘柄の分析レポートです。`,
    '',
    '【今回の銘柄】',
    stockLines,
    '',
    lineCta,
    '',
    '#日本株 #株式投資 #注目銘柄 #株価分析 #投資',
  ].join('\n');

  const stockTags = stocks.flatMap(s => [s.name, s.code, s.sector].filter(Boolean));
  const tags = [...new Set([...stockTags, '日本株', '株式投資', '注目銘柄', '株価', '投資', '銘柄分析'])].join(', ');

  return { title, description, tags, _source: 'auto' };
}

// ── meta.ttsTexts から完整な日本語配音全文を再構築（再生順）──────────────
function buildFullJpScript(meta) {
  const stocks = meta.stocks || [];
  const tts    = meta.ttsTexts || {};
  const parts  = [];
  if (tts.intro) parts.push(tts.intro);
  stocks.forEach((_, i) => { const t = (tts.stocks || [])[i]; if (t) parts.push(t); });
  if (tts.marketContext)  parts.push(tts.marketContext);
  if (tts.investmentPlan) parts.push(tts.investmentPlan);
  if (tts.featured)       parts.push(tts.featured);
  if (tts.cta) parts.push(tts.cta);
  return parts.join('\n\n');
}

// ── 生成发布素材 HTML ────────────────────────────────────────
function buildPublishHTML(items, batchName) {
  const indexLinks = items.map((item, i) => {
    const vb = (item.videoUrl || '').split('/').pop();
    return `<a href="#v${i + 1}" class="idx-item">
        <span class="idx-n">#${String(i + 1).padStart(2, '0')}</span>
        <span class="idx-f">${escHtml(vb)}</span>
      </a>`;
  }).join('\n');

  const sections = items.map((item, i) => {
    const { videoUrl, ytMeta, jpScript = '', cnScript = '' } = item;
    const videoBase   = (videoUrl || '').split('/').pop();
    const isAuto      = ytMeta?._source === 'auto';
    const title       = ytMeta?.title       || '';
    const description = ytMeta?.description || '';
    const tags        = ytMeta?.tags        || '';

    const ttsPanel = jpScript ? `
    <details class="tts-panel">
      <summary><i>📋</i> 配音文案对照（日 / 中）</summary>
      <div class="tts-grid">
        <div class="tts-col">
          <div class="tts-col-h">日本語原文</div>
          <div class="tts-box">${escHtml(jpScript)}</div>
          <button class="copy-btn sm" onclick="cp(this,'.tts-box')">复制日文</button>
        </div>
        <div class="tts-col">
          <div class="tts-col-h">中文翻译</div>
          ${cnScript ? `<div class="tts-box">${escHtml(cnScript)}</div>
          <button class="copy-btn sm" onclick="cp(this,'.tts-box')">复制中文</button>` : `<div class="tts-box muted">未配置 DeepSeek API Key，无法生成中文翻译</div>`}
        </div>
      </div>
    </details>` : '';

    return `
<section id="v${i + 1}" data-fname="${escHtml(videoBase.toLowerCase())}" data-title="${escHtml((title || '').toLowerCase())}">
  <div class="sec-title">
    <span class="vid-num">#${String(i + 1).padStart(2, '0')}</span>
    <span class="vid-fname">${escHtml(videoBase)}</span>
    ${isAuto ? '<span class="badge-auto">自动生成</span>' : '<span class="badge-ai">✦ AI</span>'}
    <button class="copy-all" onclick="cpAll(this)"><i>⧉</i> 一键复制全部</button>
  </div>
  ${title ? `<div class="yt-title-row">${escHtml(title)}</div>` : ''}
  ${ttsPanel}
  <div class="fields">
    <div class="field">
      <div class="field-hd"><span class="field-lbl">① タイトル（标题）</span><span class="cnt" data-kind="title"></span></div>
      <div class="frow"><div class="fval" data-kind="title">${escHtml(title)}</div><button class="copy-btn" onclick="cp(this)">复制</button></div>
    </div>
    <div class="field">
      <div class="field-hd"><span class="field-lbl">② 説明文（简介）</span><span class="cnt" data-kind="desc"></span></div>
      <div class="frow"><div class="fval tall" data-kind="desc">${escHtml(description)}</div><button class="copy-btn" onclick="cp(this)">复制</button></div>
    </div>
    <div class="field">
      <div class="field-hd"><span class="field-lbl">③ タグ（标签）</span><span class="cnt" data-kind="tags"></span></div>
      <div class="frow"><div class="fval" data-kind="tags">${escHtml(tags)}</div><button class="copy-btn" onclick="cp(this)">复制</button></div>
    </div>
  </div>
</section>`;
  }).join('\n');

  const now = new Date().toLocaleString('zh-CN');
  const aiCount = items.filter(it => it.ytMeta && it.ytMeta._source !== 'auto').length;
  const autoCount = items.length - aiCount;

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>YouTube 发布素材 · ${escHtml(batchName)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#eef1f5;--card:#fff;--ink:#181b22;--sub:#656b78;--hint:#9097a3;--line:#e4e8ee;--soft:#f5f7fa;--brand:#3a5bd9;--brand-d:#2742a8;--brand-soft:#eaf0fe;--yt:#ff0033;--ok:#15a866;--over:#e0392b;--radius:14px;--mono:ui-monospace,'SFMono-Regular',Consolas,monospace}
body{font-family:-apple-system,'Segoe UI','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,'Microsoft YaHei',system-ui,sans-serif;background:var(--bg);color:var(--ink);font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased}
header{background:rgba(255,255,255,.94);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);padding:11px 24px;position:sticky;top:0;z-index:100}
.hd-row{display:flex;align-items:center;gap:12px;max-width:1000px;margin:0 auto;flex-wrap:wrap}
.logo{display:flex;align-items:center;gap:7px;font-size:15px;font-weight:800;white-space:nowrap}
.logo .yt{color:var(--yt);font-size:17px}
.hd-batch{font-family:var(--mono);font-size:12px;color:var(--brand-d);background:var(--brand-soft);padding:3px 9px;border-radius:6px;font-weight:700}
.hd-stats{margin-left:auto;display:flex;gap:7px;flex-wrap:wrap}
.stat{font-size:11px;color:var(--sub);background:var(--soft);border:1px solid var(--line);border-radius:20px;padding:3px 10px;white-space:nowrap}
.stat b{color:var(--ink);font-weight:800;font-variant-numeric:tabular-nums}
.hd-tools{max-width:1000px;margin:9px auto 0}
.search{display:flex;align-items:center;gap:8px;background:var(--soft);border:1px solid var(--line);border-radius:9px;padding:7px 12px}
.search:focus-within{border-color:var(--brand);background:#fff}
.search input{flex:1;border:0;background:transparent;font-size:13px;color:var(--ink);outline:none}
.search i{color:var(--hint);font-style:normal}
#searchCnt{font-size:11px;color:var(--sub);white-space:nowrap}
main{max-width:1000px;margin:0 auto;padding:22px 16px 90px;display:flex;flex-direction:column;gap:18px}
.index-card{background:var(--card);border-radius:var(--radius);border:1px solid var(--line);overflow:hidden}
.index-card>summary{display:flex;align-items:center;gap:10px;padding:13px 20px;cursor:pointer;user-select:none;list-style:none}
.index-card>summary::-webkit-details-marker{display:none}
.index-card>summary:hover{background:var(--soft)}
.index-card[open]>summary{border-bottom:1px solid var(--line)}
.idx-sum-title{font-size:13px;font-weight:800}
.idx-sum-sub{font-size:11px;color:var(--sub)}
.idx-sum-toggle{font-size:11px;color:var(--hint);margin-left:auto}
.index-card[open] .idx-sum-toggle::after{content:'收起 ▲'}
.index-card:not([open]) .idx-sum-toggle::after{content:'展开 ▼'}
.index-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:2px;padding:10px 12px 14px}
.idx-item{display:flex;align-items:center;gap:8px;padding:6px 9px;border-radius:7px;text-decoration:none;color:inherit;overflow:hidden;min-width:0}
.idx-item:hover{background:var(--brand-soft)}
.idx-n{font-size:12px;font-weight:900;color:var(--brand);width:30px;flex-shrink:0;font-variant-numeric:tabular-nums}
.idx-f{font-family:var(--mono);font-size:12px;color:var(--sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
section{background:var(--card);border-radius:var(--radius);border:1px solid var(--line);padding:20px 22px;scroll-margin-top:120px}
.sec-title{display:flex;align-items:center;gap:11px;padding-bottom:13px;border-bottom:1px solid var(--line);margin-bottom:15px;flex-wrap:wrap}
.vid-num{font-size:26px;font-weight:900;color:var(--brand);line-height:1;font-variant-numeric:tabular-nums;flex-shrink:0}
.vid-fname{font-family:var(--mono);font-size:13px;font-weight:700;background:var(--soft);padding:4px 10px;border-radius:6px;border:1px solid var(--line);word-break:break-all}
.badge-auto{font-size:10px;font-weight:700;color:var(--sub);background:var(--soft);border:1px solid var(--line);border-radius:5px;padding:2px 8px;white-space:nowrap}
.badge-ai{font-size:10px;font-weight:800;color:#0f8a52;background:#e7f8f0;border:1px solid #bfe9d5;border-radius:5px;padding:2px 8px;white-space:nowrap}
.copy-all{margin-left:auto;font-size:11px;font-weight:700;color:var(--brand-d);background:var(--brand-soft);border:1px solid #c9d8fb;border-radius:7px;padding:5px 11px;cursor:pointer;transition:.15s;white-space:nowrap}
.copy-all:hover{background:var(--brand);color:#fff;border-color:var(--brand)}
.copy-all.ok{background:var(--ok);color:#fff;border-color:var(--ok)}
.copy-all i{font-style:normal;margin-right:3px}
.yt-title-row{font-size:15px;font-weight:700;color:var(--ink);margin:0 0 14px;line-height:1.45}
.tts-panel{margin:0 0 15px;border:1px solid var(--line);border-radius:9px;overflow:hidden}
.tts-panel summary{cursor:pointer;padding:9px 14px;font-size:12px;font-weight:700;color:var(--sub);background:var(--soft);user-select:none;list-style:none}
.tts-panel summary::-webkit-details-marker{display:none}
.tts-panel summary i{font-style:normal;margin-right:5px}
.tts-panel[open] summary{border-bottom:1px solid var(--line);color:var(--brand)}
.tts-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:13px}
.tts-col{display:flex;flex-direction:column;gap:7px;min-width:0}
.tts-col-h{font-size:10px;font-weight:800;color:var(--hint);letter-spacing:.6px}
.tts-box{background:var(--soft);border:1px solid var(--line);border-radius:7px;padding:9px 11px;font-size:12.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:220px;overflow-y:auto}
.tts-box.muted{color:#b0473d}
.fields{display:flex;flex-direction:column;gap:12px}
.field-hd{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.field-lbl{font-size:11px;font-weight:800;color:var(--sub)}
.cnt{font-size:10px;color:var(--hint);font-variant-numeric:tabular-nums;margin-left:auto;background:var(--soft);border:1px solid var(--line);border-radius:5px;padding:1px 7px;white-space:nowrap}
.cnt.over{color:#fff;background:var(--over);border-color:var(--over)}
.frow{display:flex;align-items:flex-start;gap:8px}
.fval{flex:1;background:var(--soft);border:1px solid var(--line);border-radius:7px;padding:8px 11px;font-size:13px;white-space:pre-wrap;word-break:break-word;max-height:96px;overflow-y:auto;line-height:1.55;min-height:34px}
.fval.tall{max-height:210px}
.copy-btn{flex-shrink:0;font-size:11px;font-weight:700;padding:5px 12px;border-radius:7px;border:1.5px solid var(--brand);color:var(--brand);background:transparent;cursor:pointer;transition:.15s;white-space:nowrap}
.copy-btn:hover{background:var(--brand);color:#fff}
.copy-btn.ok{background:var(--ok);border-color:var(--ok);color:#fff}
.copy-btn.sm{padding:4px 10px;align-self:flex-start}
.to-top{position:fixed;right:22px;bottom:22px;width:42px;height:42px;border-radius:50%;background:var(--brand);color:#fff;border:0;font-size:18px;cursor:pointer;opacity:0;pointer-events:none;transition:.2s;box-shadow:0 4px 14px rgba(58,91,217,.4);z-index:90}
.to-top.show{opacity:1;pointer-events:auto}
.to-top:hover{background:var(--brand-d)}
@media(max-width:680px){.tts-grid{grid-template-columns:1fr}.hd-stats{width:100%;margin-left:0}}
</style>
</head>
<body>
<header>
  <div class="hd-row">
    <span class="logo"><span class="yt">▶</span> YouTube 发布素材</span>
    <span class="hd-batch">${escHtml(batchName)}</span>
    <div class="hd-stats">
      <span class="stat">视频 <b>${items.length}</b> 个</span>
      <span class="stat">AI <b>${aiCount}</b></span>
      <span class="stat">自动 <b>${autoCount}</b></span>
      <span class="stat">${now}</span>
    </div>
  </div>
  <div class="hd-tools">
    <label class="search"><i>🔍</i><input type="text" placeholder="按文件名 / 标题筛选…" oninput="filterSecs(this.value)"><span id="searchCnt"></span></label>
  </div>
</header>
<main>
  <details class="index-card" open>
    <summary>
      <span class="idx-sum-title">📁 文件对照表</span>
      <span class="idx-sum-sub">共 ${items.length} 个视频，顺序与视频排序一致</span>
      <span class="idx-sum-toggle"></span>
    </summary>
    <div class="index-grid">
${indexLinks}
    </div>
  </details>
${sections}
</main>
<button class="to-top" onclick="scrollTo({top:0,behavior:'smooth'})" aria-label="回到顶部">↑</button>
<script>
function cp(btn,sel){
  const box=btn.parentNode.querySelector(sel||'.fval');if(!box)return;
  navigator.clipboard.writeText(box.textContent).then(()=>{
    const o=btn.textContent;btn.textContent='✓ 已复制';btn.classList.add('ok');
    setTimeout(()=>{btn.textContent=o;btn.classList.remove('ok');},1800);
  });
}
function cpAll(btn){
  const s=btn.closest('section');
  const g=k=>{const e=s.querySelector('.fval[data-kind="'+k+'"]');return e?e.textContent:'';};
  const text=[g('title'),g('desc'),g('tags')].filter(Boolean).join('\\n\\n');
  navigator.clipboard.writeText(text).then(()=>{
    const o=btn.innerHTML;btn.innerHTML='✓ 已复制全部';btn.classList.add('ok');
    setTimeout(()=>{btn.innerHTML=o;btn.classList.remove('ok');},1800);
  });
}
function filterSecs(q){
  q=(q||'').trim().toLowerCase();const secs=document.querySelectorAll('section');let n=0;
  secs.forEach(s=>{const hit=!q||(s.dataset.fname||'').includes(q)||(s.dataset.title||'').includes(q);s.style.display=hit?'':'none';if(hit)n++;});
  const sc=document.getElementById('searchCnt');if(sc)sc.textContent=q?('匹配 '+n+' / '+secs.length):'';
}
(function(){
  const len=s=>[...(s||'')].length;
  document.querySelectorAll('.cnt').forEach(c=>{
    const k=c.dataset.kind,sec=c.closest('section');
    const v=sec&&sec.querySelector('.fval[data-kind="'+k+'"]');if(!v)return;
    const t=v.textContent;
    if(k==='title'){const x=len(t);c.textContent=x+' / 100 字';if(x>100)c.classList.add('over');}
    else if(k==='desc'){c.textContent=len(t)+' 字';}
    else if(k==='tags'){const a=t.split(',').map(x=>x.trim()).filter(Boolean);c.textContent=a.length+' 个 · '+len(t)+' 字';}
  });
  const tt=document.querySelector('.to-top');
  if(tt)window.addEventListener('scroll',()=>{tt.classList.toggle('show',window.scrollY>500);},{passive:true});
})();
<\/script>
</body>
</html>`;
}

// ── POST /api/generate-publish-doc ───────────────────────────
app.post('/api/generate-publish-doc', async (req, res) => {
  const { items = [], lineId = '', batchName = 'batch', apiKey: clientKey = '' } = req.body;
  if (!items.length) return res.status(400).json({ error: '无视频数据' });

  const apiKey = clientKey || process.env.DEEPSEEK_KEY || '';

  try {
    const results = [];

    for (const item of items) {
      const { scriptText = '', videoUrl = '', meta: stockMeta = {} } = item;
      // 先查缓存，同一批次同一视频不重复调 AI
      let ytMeta = _ytMetaCache.get(videoUrl);
      if (!ytMeta) {
        if (scriptText.trim() && apiKey) {
          try {
            ytMeta = await generateYouTubeMeta(scriptText.trim(), lineId, apiKey);
          } catch (e) {
            console.error('[publish-doc] YT meta AI error:', e.message);
            ytMeta = buildFallbackYTMeta(stockMeta, lineId);
          }
        } else {
          ytMeta = buildFallbackYTMeta(stockMeta, lineId);
          if (!apiKey) console.warn('[publish-doc] DeepSeek API キー未設定、ローカル生成で代替');
        }
        _ytMetaCache.set(videoUrl, ytMeta);
      }

      // 完整日文配音稿 + 中文翻译稿（同一视频缓存，避免重复调 AI）
      const jpScript = buildFullJpScript(stockMeta);
      let cnScript = _cnScriptCache.get(videoUrl);
      if (cnScript === undefined) {
        cnScript = '';
        if (jpScript && apiKey) {
          try {
            cnScript = await translateToChinese(jpScript, apiKey);
          } catch (e) {
            console.error('[publish-doc] 中文翻译 AI error:', e.message);
          }
        }
        _cnScriptCache.set(videoUrl, cnScript);
      }

      results.push({ videoUrl, ytMeta, meta: stockMeta, jpScript, cnScript });
    }

    // 固定文件名（同一 batchName 覆盖同一文件，支持逐视频更新）
    const safeName = batchName.replace(/[^a-zA-Z0-9_\-一-鿿]/g, '_').slice(0, 40);
    const filename = `jp_publish_${safeName}.html`;
    const filePath = path.join(OUT_DIR, filename);
    fs.writeFileSync(filePath, buildPublishHTML(results, batchName), 'utf8');

    res.json({ ok: true, url: `/output/${filename}`, filename });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/generate-yt ─────────────────────────────────────
app.post('/api/generate-yt', async (req, res) => {
  const { text = '', lineId = '', apiKey: clientKey = '' } = req.body;
  if (!text.trim()) return res.status(400).json({ error: '脚本内容不能为空' });

  const apiKey = clientKey || process.env.DEEPSEEK_KEY || '';
  if (!apiKey) return res.status(400).json({ error: '请在设置中填写 DeepSeek API Key，或在服务器 .env 中配置 DEEPSEEK_KEY' });

  try {
    const meta = await generateYouTubeMeta(text.trim(), lineId.trim(), apiKey);
    res.json({ ok: true, meta });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── VOICEVOX ─────────────────────────────────────────────────
app.get('/api/voicevox/status', async (_req, res) => {
  res.json({ available: await checkVoicevox() });
});

app.get('/api/voicevox/speakers', async (_req, res) => {
  try {
    res.json(await listVoicevoxSpeakers());
  } catch (e) {
    res.status(503).json({ error: 'VOICEVOX未启动', detail: e.message });
  }
});

// ── 中文翻译日文 ──────────────────────────────────────────────
app.post('/api/translate', async (req, res) => {
  const { text = '', apiKey: clientKey = '' } = req.body;
  const apiKey = clientKey || process.env.DEEPSEEK_KEY || '';
  if (!apiKey) return res.status(400).json({ error: '请在设置中填写 DeepSeek API Key' });
  if (!text.trim()) return res.status(400).json({ error: '文案不能为空' });
  try {
    // 按批量分隔符（3+换行）拆段，逐段翻译后原样拼回，保留空行结构
    const segments = text.split(/(?:\r?\n){3,}/).map(s => s.trim()).filter(s => s);
    const results = await mapWithConcurrency(segments, 3, seg => translateToJapanese(seg, apiKey));
    // 原文段落内无空行，压缩翻译时多余的空行（段间分隔符保持3换行）
    const normalized = results.map(r => r.trim().replace(/\n{2,}/g, '\n'));
    res.json({ translated: normalized.join('\n\n\n') });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 应用内更新 ────────────────────────────────────────────────
const { execFile } = require('child_process');

function git(args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: ROOT, timeout: 30000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

let _updating = false;  // 同時更新防止フラグ

app.get('/api/update/check', async (_req, res) => {
  try {
    await git(['fetch', 'origin']);
    const log = await git(['log', 'HEAD..origin/master', '--oneline']);
    const commits = log ? log.split('\n').map(l => {
      const [hash, ...rest] = l.split(' ');
      return { hash: hash.trim(), message: rest.join(' ').trim() };
    }) : [];
    res.json({ hasUpdate: commits.length > 0, commits });
  } catch (e) {
    res.json({ hasUpdate: false, commits: [], error: e.message });
  }
});

app.post('/api/update/apply', async (_req, res) => {
  if (_updating) return res.status(409).json({ ok: false, error: '更新已在进行中，请勿重复操作' });
  if (jobs.size > 0) return res.status(409).json({ ok: false, error: '有生成任务进行中，请等待完成后再更新' });
  _updating = true;
  try {
    const pkgBefore = await git(['show', 'HEAD:package.json']).catch(() => '');
    // app 代码是只读分发物：用 fetch + reset --hard 强制同步到远程，避免本地改动/
    // 行尾(CRLF)差异令 git pull 被「local changes would be overwritten」挡住而更新失败。
    // output/app-config.json/temp 均为 gitignore，reset 不会触及，用户数据安全。
    await git(['fetch', 'origin', 'master']);
    await git(['reset', '--hard', 'origin/master']);
    const pkgAfter = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
    const needsInstall = pkgBefore !== pkgAfter;
    res.json({ ok: true, needsInstall });
    if (needsInstall) {
      const { spawn: sp } = require('child_process');
      const npm = sp('npm', ['install', '--registry=https://registry.npmmirror.com'], { cwd: ROOT, shell: true, stdio: 'inherit' });
      npm.on('exit', (code) => {
        if (code === 0) process.exit(123);   // 正常 → 再起動
        else { _updating = false; writeLog('SYS', `npm install 失败 (code=${code})，已取消重启，请手动检查依赖`); }
      });
    } else {
      setTimeout(() => process.exit(123), 500);
    }
  } catch (e) {
    _updating = false;
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── 残留子プロセスのクリーンアップ（ソフト強制終了後のゾンビ対策）──────────────
// ×ボタンやクラッシュでソフトを強制終了すると、レンダリング中の子プロセス
// （node jp-generate と Remotion が起動した headless Chrome）が後台に残留し、
// 次回起動時に新ジョブがGPU/メモリ競合で「全部失敗」になる（従来はPC再起動でしか直らなかった）。
// → 起動時に必ず掃除して、再起動を不要にする。
// 安全策: 普段使いの Chrome は絶対に殺さない。--headless かつ --remote-debugging 付きの
//         レンダリング専用インスタンスのみを対象にする（通常のブラウジングには付かないフラグ）。
function killStaleRenderProcesses(reason = '') {
  if (process.platform !== 'win32') {
    try { require('child_process').execFileSync('pkill', ['-f', 'jp-generate.js'], { stdio: 'ignore' }); } catch {}
    return;
  }
  const me = process.pid;
  const ps = `
$ErrorActionPreference='SilentlyContinue';
$nodes = Get-CimInstance Win32_Process -Filter "Name='node.exe'";
$nodes | Where-Object { $_.CommandLine -like '*jp-server.js*' -and $_.ProcessId -ne ${me} } | ForEach-Object { & taskkill /T /F /PID $_.ProcessId 2>$null };
$nodes | Where-Object { $_.CommandLine -like '*jp-generate.js*' } | ForEach-Object { & taskkill /T /F /PID $_.ProcessId 2>$null };
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*--headless*' -and $_.CommandLine -like '*--remote-debugging*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force };
`.trim();
  try {
    require('child_process').execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 20000, stdio: 'ignore' });
    writeLog('SYS', `残留レンダリングプロセスをクリーンアップしました${reason ? '（' + reason + '）' : ''}`);
  } catch (e) {
    try { writeLog('SYS', `残留プロセスのクリーンアップ失敗: ${e.message}`); } catch {}
  }
}

// 実行中のジョブと Studio をツリーごと終了（正常終了・シグナル受信時に呼ぶ）
function killAllChildren() {
  for (const job of jobs.values()) {
    try {
      if (job.proc?.pid && process.platform === 'win32') {
        require('child_process').execFileSync('taskkill', ['/T', '/F', '/PID', String(job.proc.pid)], { stdio: 'ignore' });
      } else { job.proc?.kill('SIGKILL'); }
    } catch {}
  }
  try {
    if (studioProc?.pid && process.platform === 'win32') {
      require('child_process').execFileSync('taskkill', ['/T', '/F', '/PID', String(studioProc.pid)], { stdio: 'ignore' });
    } else { studioProc?.kill(); }
  } catch {}
}

let _shuttingDown = false;
function shutdown(sig) {
  if (_shuttingDown) return;
  _shuttingDown = true;
  try { writeLog('SYS', `${sig} を受信、子プロセスを片付けて終了します`); } catch {}
  killAllChildren();
  process.exit(0);
}
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig => { try { process.on(sig, () => shutdown(sig)); } catch {} });

// ── 编辑器构建（陈旧检测）──────────────────────────────────────────────────
// public/editor-dist/editor.js 是 Vite 打包产物。一旦 src/editor 或 src/compositions
// 改动而未重新构建，编辑器预览就会停留在旧版本。启动时自动检测并按需构建，
// 避免「改了组件但预览没变」的隐形坑。构建失败不致命（仅影响预览，不影响出片）。
function newestMtime(dir, acc = { t: 0 }) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc.t; }
  for (const e of entries) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) { newestMtime(fp, acc); continue; }
    if (!/\.(tsx?|jsx?|json)$/.test(e.name)) continue;
    try { const m = fs.statSync(fp).mtimeMs; if (m > acc.t) acc.t = m; } catch {}
  }
  return acc.t;
}
function ensureEditorBuilt() {
  const out = path.join(ROOT, 'public', 'editor-dist', 'editor.js');
  let outM = 0;
  try { outM = fs.statSync(out).mtimeMs; } catch {}
  const srcM = Math.max(
    newestMtime(path.join(ROOT, 'src', 'editor')),
    newestMtime(path.join(ROOT, 'src', 'compositions')),
    (() => { try { return fs.statSync(path.join(ROOT, 'vite.config.ts')).mtimeMs; } catch { return 0; } })(),
    (() => { try { return fs.statSync(path.join(ROOT, 'src', 'types.ts')).mtimeMs; } catch { return 0; } })(),
  );
  if (outM && outM >= srcM) return;                     // 产物比源码新 → 无需构建
  console.log(outM ? '   编辑器源码有更新，正在重新构建…' : '   首次构建编辑器…');
  try {
    require('child_process').execSync('npx vite build', {
      cwd: ROOT, stdio: 'ignore', timeout: 180000,
    });
    console.log('   ✓ 编辑器构建完成');
  } catch (e) {
    writeLog('SYS', `编辑器构建失败（仅影响预览，不影响出片）: ${e.message}`);
    console.log('   ⚠ 编辑器构建失败，预览可能为旧版本（不影响视频生成）');
  }
}

// 起動時に前回の残留を掃除（ゾンビ対策の本命：これで電源再起動が不要になる）
killStaleRenderProcesses('起動時');
ensureEditorBuilt();

app.listen(PORT, '127.0.0.1', () => {
  let ver = 'unknown';
  try { ver = require('child_process').execFileSync('git', ['log', '-1', '--format=%h %s'], { cwd: ROOT, timeout: 3000 }).toString().trim(); } catch {}
  console.log('\n🎬 JP Manga Studio 制作面板');
  console.log(`   http://localhost:${PORT}`);
  console.log(`   版本: ${ver}`);
  console.log(`   环境: Node ${process.version} | ${process.platform} | ${require('os').cpus().length}核 | 同時生成上限 ${MAX_PARALLEL}`);
  console.log('   Remotion Studio 将在端口 3021 启动');
});

process.on('exit', () => { try { killAllChildren(); } catch {} });
