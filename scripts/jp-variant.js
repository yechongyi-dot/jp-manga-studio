'use strict';
/**
 * jp-variant.js — 视频变体后处理（VideoVariantMaker 完整移植）
 *
 * 每次调用 applyVariant() 生成独立随机参数，实现裂变：
 *   P0  缩放裁剪 (1.03~1.08×，随机偏移)
 *   P1  角标色块 (drawbox 四角随机，可选)
 *   P2  音频微变调 ±0.5半音 + 色彩微调
 *   Ov  1~3 叠加层：噪声/文件夹 × 固定/顺时针/逆时针
 *         文件夹模式：每次调用从文件夹中随机抽取一个视频文件
 */

const { execFile } = require('child_process');
const fs   = require('fs');
const path = require('path');

function rnd(a, b) { return a + Math.random() * (b - a); }
function rndInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
function even(n) { const c = Math.ceil(n); return c % 2 === 0 ? c : c + 1; }

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.webm', '.mkv', '.flv']);

// shuffle-deck：每个文件夹维护一个洗牌队列，用完再重新洗牌，保证不重复不浪费
const _decks = new Map();
function getNextFromDeck(folderPath) {
  let files;
  try {
    files = fs.readdirSync(folderPath)
      .filter(f => VIDEO_EXTS.has(path.extname(f).toLowerCase()))
      .map(f => path.join(folderPath, f));
  } catch { return null; }
  if (!files.length) return null;

  if (!_decks.has(folderPath) || _decks.get(folderPath).length === 0) {
    // Fisher-Yates 洗牌
    const deck = [...files];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    _decks.set(folderPath, deck);
  }
  return _decks.get(folderPath).shift();
}

function resolveOverlayPath(p) {
  if (!p) return null;
  try {
    if (!fs.existsSync(p)) return null;
    if (fs.statSync(p).isDirectory()) return getNextFromDeck(p);
    return VIDEO_EXTS.has(path.extname(p).toLowerCase()) ? p : null;
  } catch { return null; }
}

function ffprobeInfo(filePath) {
  return new Promise((resolve, reject) => {
    execFile('ffprobe', [
      '-v', 'quiet', '-print_format', 'json',
      '-show_format', '-show_streams', filePath,
    ], { maxBuffer: 2 * 1024 * 1024, timeout: 15000 }, (err, stdout) => {
      if (err) return reject(new Error(`ffprobe failed: ${err.message}`));
      try {
        const d  = JSON.parse(stdout);
        const streams = d.streams || [];
        const vs = streams.find(s => s.codec_type === 'video');
        const as = streams.find(s => s.codec_type === 'audio');
        const [fpsNum, fpsDen] = (vs?.r_frame_rate || '30/1').split('/').map(Number);
        resolve({
          duration:   parseFloat(d.format?.duration) || 0,
          width:      vs?.width       || 1080,
          height:     vs?.height      || 1920,
          fps:        (fpsDen ? Math.round(fpsNum / fpsDen) : 30) || 30,
          hasAudio:   !!as,
          sampleRate: as?.sample_rate ? parseInt(as.sample_rate) : 44100,
        });
      } catch (e) { reject(new Error(`ffprobe JSON parse failed: ${e.message}`)); }
    });
  });
}

/**
 * 对已渲染视频施加一次变体处理（每次调用独立随机参数）。
 * 调用方如需裂变，只需循环调用本函数 N 次即可。
 *
 * @param {string} inputPath   原始 MP4（只读）
 * @param {string} outputPath  目标 MP4
 * @param {object} config      变体配置，见 getVariantConfig() in index.html
 */
async function applyVariant(inputPath, outputPath, config = {}) {
  const { duration, width: W, height: H, fps: FPS, hasAudio, sampleRate } =
    await ffprobeInfo(inputPath);
  if (!isFinite(duration) || duration <= 0) throw new Error(`無効な動画長さ: ${duration}`);

  // ── P2: 音频变调参数 ──────────────────────────────────────────
  const semitones  = rnd(-0.5, 0.5);
  const pitchRatio = Math.pow(2, semitones / 12);
  const newRate    = Math.round(sampleRate * pitchRatio);
  const tempoComp  = Math.max(0.5, Math.min(2.0, 1 / pitchRatio)).toFixed(6);

  // ── P2: 色彩参数 ──────────────────────────────────────────────
  const brightness = rnd(-0.05, 0.05).toFixed(4);
  const saturation = rnd(0.92, 1.10).toFixed(4);

  // ── P0: 缩放裁剪参数 ──────────────────────────────────────────
  const enableScale = config.enableScale !== false;
  const scaleF  = rnd(1.03, 1.08);
  const scaledW = Math.floor(W * scaleF);
  const scaledH = Math.floor(H * scaleF);
  const cropX   = rndInt(0, scaledW - W);
  const cropY   = rndInt(0, scaledH - H);

  // ── P1: 角标色块参数 ──────────────────────────────────────────
  const enableDrawbox = !!config.enableDrawbox;
  const dbSize    = rndInt(15, 30);
  const dbColors  = ['red', 'blue', 'green', 'yellow'];
  const dbColor   = dbColors[rndInt(0, 3)];
  const dbCorners = [
    { bx: 0,         by: 0 },
    { bx: W - dbSize, by: 0 },
    { bx: 0,         by: H - dbSize },
    { bx: W - dbSize, by: H - dbSize },
  ];
  const dbCorner = dbCorners[rndInt(0, 3)];

  // ── 有效叠加层（文件层在此处解析路径，文件夹则随机取一个文件）────
  const layers = (config.layers || []).filter(l => l && l.enabled);
  // 为每个文件型叠加层解析出实际文件路径（每次裂变调用各自独立随机）
  const resolvedFilePaths = layers.map(l =>
    l.sourceType === 'file' ? resolveOverlayPath(l.filePath || '') : null
  );

  // ── 构建 FFmpeg 参数 ──────────────────────────────────────────
  const args = ['-i', inputPath];
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].sourceType === 'file' && resolvedFilePaths[i]) {
      args.push('-stream_loop', '-1', '-i', resolvedFilePaths[i]);
    }
  }

  // ── filter_complex ────────────────────────────────────────────
  const filters = [];
  let currentV;

  // P0: 缩放裁剪
  if (enableScale) {
    filters.push(
      `[0:v]scale=${scaledW}:${scaledH}:flags=bilinear,` +
      `crop=${W}:${H}:${cropX}:${cropY}[v_p0]`
    );
    currentV = 'v_p0';
  } else {
    currentV = '0:v';
  }

  // P2: 色彩微调
  filters.push(`[${currentV}]eq=brightness=${brightness}:saturation=${saturation}[vbase]`);
  currentV = 'vbase';

  // P1: 角标色块
  if (enableDrawbox) {
    filters.push(
      `[${currentV}]drawbox=` +
      `x=${dbCorner.bx}:y=${dbCorner.by}:w=${dbSize}:h=${dbSize}:` +
      `color=${dbColor}@0.3:t=fill[v_db]`
    );
    currentV = 'v_db';
  }

  // 叠加层（旋转类需要对角尺寸 D，保证旋转不漏黑角）
  const D = even(Math.hypot(W, H) + 20);
  let fileInputIdx = 1;

  for (let i = 0; i < layers.length; i++) {
    const layer      = layers[i];
    // 文件层：若文件夹内无可用文件则跳过此层
    if (layer.sourceType === 'file' && !resolvedFilePaths[i]) continue;

    const opacity    = ((layer.opacity ?? 8) / 100).toFixed(4);
    const baseSpeed  = layer.speed || 0.3;
    const speed      = (baseSpeed * rnd(0.8, 1.2)).toFixed(4);  // ±20% 每副本随机
    const motionMode = layer.motionMode || 'fixed';
    const ovLabel    = `ov_${i}`;
    const outLabel   = `v_after_ov${i}`;

    let srcLabel;
    if (layer.sourceType === 'noise') {
      const nsLabel = `ns_${i}`;
      filters.push(`nullsrc=s=${W}x${H}:r=${FPS},noise=alls=80:allf=t[${nsLabel}]`);
      srcLabel = nsLabel;
    } else {
      srcLabel = `${fileInputIdx}:v`;
      fileInputIdx++;
    }

    const fileScale = layer.sourceType === 'file' ? `scale=${W}:${H}:flags=bilinear,` : '';

    if (motionMode === 'clockwise' || motionMode === 'counter_clockwise') {
      const sign = motionMode === 'clockwise' ? '' : '-';
      filters.push(
        `[${srcLabel}]scale=${D}:${D}:flags=bilinear,` +
        `rotate=${sign}t*${speed}:fillcolor=none:ow=${D}:oh=${D},` +
        `crop=${W}:${H}:(iw-${W})/2:(ih-${H})/2,` +
        `format=rgba,colorchannelmixer=aa=${opacity}[${ovLabel}]`
      );
      filters.push(`[${currentV}][${ovLabel}]overlay=0:0:shortest=1[${outLabel}]`);
    } else {
      // fixed
      filters.push(
        `[${srcLabel}]${fileScale}format=rgba,` +
        `colorchannelmixer=aa=${opacity}[${ovLabel}]`
      );
      filters.push(`[${currentV}][${ovLabel}]overlay=0:0:shortest=1[${outLabel}]`);
    }

    currentV = outLabel;
  }

  // P2: 音频处理
  if (hasAudio) {
    filters.push(`[0:a]asetrate=${newRate},aresample=${sampleRate},atempo=${tempoComp}[a_proc]`);
  }

  // ── 最终参数 ──────────────────────────────────────────────────
  args.push('-filter_complex', filters.join(';'));
  args.push('-map', `[${currentV}]`);
  if (hasAudio) {
    args.push('-map', '[a_proc]', '-c:a', 'aac', '-b:a', '192k');
  }
  args.push('-t', String(duration));
  args.push(
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-y', outputPath,
  );

  // ── 動的タイムアウト ──────────────────────────────────────────
  // 重い合成（ノイズ/回転オーバーレイ）+ 複数ジョブの並列実行で、エンコード速度は
  // 0.18x 程度まで低下する（実測: 76.9s 動画が 5 分でも 53s 地点までしか進まず固定
  // 300s タイムアウトで誤って kill されていた）。最悪 0.08x 程度でも完走できるよう、
  // 尺に比例させる（係数18）。下限10分・上限30分でクランプ
  // （上限30分は jp-server 側の「無出力ハング検知」窓35分より短く保ち、誤killを防ぐ）。
  const variantTimeoutMs =
    Math.min(1800, Math.max(600, Math.ceil(duration * 18))) * 1000;

  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024, timeout: variantTimeoutMs }, (err, _out, stderr) => {
      if (!err) return resolve(outputPath);
      const why = err.killed
        ? `タイムアウト（${Math.round(variantTimeoutMs / 1000)}秒超過）。重いレイヤー（ノイズ/回転）や同時生成数が多いと極端に遅くなります`
        : (stderr || '').slice(-800);
      reject(new Error(`FFmpeg variant failed: ${why}`));
    });
  });
}

module.exports = { applyVariant };
