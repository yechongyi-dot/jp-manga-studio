'use strict';
// 背景 provider：从两个文件夹(顶部短图 / 长滚动图)按文件名顺序「不重复轮选、选完循环」。
// 游标持久化到 temp/bg-cursor.json（跨次生成不重复）。返回 staticFile 相对路径 + 图片尺寸。
// 现在=读本地文件夹；将来你对接动态图库，只需替换 listImages 的来源即可（接口不变）。
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CURSOR = path.join(ROOT, 'temp', 'bg-cursor.json');

const IMG_RE = /\.(png|jpe?g|webp)$/i;

function listImages(dir) {
  const abs = path.isAbsolute(dir) ? dir : path.join(ROOT, dir);
  try {
    return fs.readdirSync(abs).filter(f => IMG_RE.test(f)).sort()
      .map(f => ({ file: f, abs: path.join(abs, f), dir: abs }));
  } catch { return []; }
}

// 零依赖读 PNG/JPEG 尺寸
function imageSize(absPath) {
  try {
    const buf = fs.readFileSync(absPath);
    if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {        // PNG
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    if (buf[0] === 0xFF && buf[1] === 0xD8) {                            // JPEG
      let o = 2;
      while (o < buf.length) {
        if (buf[o] !== 0xFF) { o++; continue; }
        const m = buf[o + 1];
        if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
          return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) };
        }
        o += 2 + buf.readUInt16BE(o + 2);
      }
    }
  } catch {}
  return { w: 1080, h: 1920 };
}

function loadCursor() { try { return JSON.parse(fs.readFileSync(CURSOR, 'utf8')); } catch { return {}; } }
function saveCursor(c) { try { fs.mkdirSync(path.dirname(CURSOR), { recursive: true }); fs.writeFileSync(CURSOR, JSON.stringify(c)); } catch {} }

// 公开路径（staticFile 相对 public/）
function toStatic(absFile) {
  const rel = path.relative(path.join(ROOT, 'public'), absFile).replace(/\\/g, '/');
  return rel;
}

// 按文件夹顺序取下一张（不重复、循环），游标持久化。返回绝对路径 abs(供资源服务) + public相对 src(若在public下,供Studio)
function nextFrom(dir, cursorKey, cursor) {
  const list = listImages(dir);
  if (!list.length) return null;
  const idx = (cursor[cursorKey] || 0) % list.length;
  cursor[cursorKey] = (idx + 1) % list.length;
  const it = list[idx];
  const sz = imageSize(it.abs);
  const rel = toStatic(it.abs);
  const inPublic = !rel.startsWith('..') && !path.isAbsolute(rel);
  return { abs: it.abs, src: inPublic ? rel : it.abs, w: sz.w, h: sz.h, file: it.file };
}

// 取一组图片背景（顶部短图 + 长滚动图）。folders 都空则返回 null（上层退回程序化）。
// dirOverride/speedOverride 来自 UI 选择，优先于 config。
function pickImageBg(imageCfg, opts = {}) {
  const cfg = imageCfg || {};
  const cursor = loadCursor();
  const top    = nextFrom(cfg.topDir    || 'public/backgrounds/top',    'top',    cursor);
  const scroll = nextFrom(cfg.scrollDir || 'public/backgrounds/scroll', 'scroll', cursor);
  saveCursor(cursor);
  if (!top && !scroll) return null;
  const dir = (opts.dir || cfg.dir) === 'down' ? 'down' : 'up';
  const speed = Number(opts.speed ?? cfg.scrollSpeed) || 1;
  return { type: 'image', top, scroll, dir, speed, scrimOpacity: cfg.scrimOpacity ?? 0.1 };
}

// procedural リスト＝committed の config/backgrounds.json（アプリ同梱データ）。
// 機器固有設定（既定 mode + 画像フォルダ image）＝app-config.json の bg キー（gitignore。
// 配布物/自動更新の reset --hard で上書きされないよう、ここに分離）。
function loadBgConfig() {
  let procedural = [];
  try { procedural = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'backgrounds.json'), 'utf8')).procedural || []; }
  catch {}
  let bg = {};
  try { bg = (JSON.parse(fs.readFileSync(path.join(ROOT, 'app-config.json'), 'utf8')).bg) || {}; }
  catch {}
  return { mode: bg.mode || 'procedural', image: bg.image || {}, procedural };
}

module.exports = { pickImageBg, loadBgConfig, listImages, imageSize };

// 自检
if (require.main === module) {
  const cfg = loadBgConfig();
  console.log('mode:', cfg.mode);
  for (let i = 0; i < 4; i++) {
    const bg = pickImageBg(cfg.image);
    console.log(`#${i + 1}`, bg ? `top=${bg.top?.file}(${bg.top?.w}x${bg.top?.h}) scroll=${bg.scroll?.file}(${bg.scroll?.w}x${bg.scroll?.h}) dir=${bg.dir}` : '(无图片→程序化)');
  }
}
