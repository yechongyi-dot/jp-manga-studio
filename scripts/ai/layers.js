'use strict';
// 三层配置加载 + 兼容矩阵。题材×格式×口吻 正交组合，过滤掉不合法/不可渲染的组合。
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const readJson = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'config', f), 'utf8'));

function loadLayers() {
  return {
    themes:  readJson('themes.json').themes  || [],
    formats: readJson('formats.json').formats || [],
    tones:   readJson('tones.json').tones     || [],
    skins:   readJson('skins.json').skins     || [],   // 皮肤(配色)轴，与口吻解耦
  };
}

// 不合法的组合（口吻×格式 等语义冲突）。可扩充。
const EXCLUSIONS = [
  // 目前格式只有 排行榜/单股深扒，与全部口吻皆可搭；如需排除特定组合在此加
];

// 格式现由题材自带（theme.format → formats.json 的布局定义）
function formatOf(theme, formats) {
  return formats.find(f => f.id === theme.format) || null;
}

function isValid(theme, format, tone) {
  if (!format || !format.renderable) return false;                       // 题材的布局必须可渲染
  const min = (format.stockCount && format.stockCount[0]) || 1;
  if ((theme.defaultStockCount || 99) < min) return false;
  return !EXCLUSIONS.some(e =>
    (!e.theme || e.theme === theme.id) &&
    (!e.format || e.format === format.id) &&
    (!e.tone || e.tone === tone.id));
}

// 全量合法组合（格式由题材派生，故矩阵=题材×口吻；皮肤/背景为自由轴不在内）
function matrix() {
  const { themes, formats, tones } = loadLayers();
  const out = [];
  for (const th of themes) {
    const fm = formatOf(th, formats);
    for (const tn of tones) if (isValid(th, fm, tn)) out.push({ theme: th.id, format: fm.id, tone: tn.id });
  }
  return out;
}

// 按 id 取各轴对象（generate 用）。格式由题材自带；皮肤(skin)正交、缺省取第一个。
function resolve(themeId, toneId, skinId) {
  const { themes, formats, tones, skins } = loadLayers();
  const theme  = themes.find(t => t.id === themeId);
  const tone   = tones.find(t => t.id === toneId);
  const skin   = skins.find(s => s.id === skinId) || skins[0];
  if (!theme)  throw new Error(`未知题材 ${themeId}`);
  if (!tone)   throw new Error(`未知口吻 ${toneId}`);
  if (!skin)   throw new Error('皮肤配置为空');
  const format = formatOf(theme, formats);
  if (!format) throw new Error(`题材 ${themeId} 的布局 ${theme.format} 在 formats.json 中未找到`);
  if (!isValid(theme, format, tone)) throw new Error(`组合不合法/不可渲染：${themeId}(${theme.format})×${toneId}`);
  return { theme, format, tone, skin };
}

module.exports = { loadLayers, isValid, matrix, resolve, EXCLUSIONS };

// 直接运行 = 自检
if (require.main === module) {
  const { themes, formats, tones } = loadLayers();
  console.log(`题材 ${themes.length} · 格式 ${formats.length}(可渲染 ${formats.filter(f => f.renderable).length}) · 口吻 ${tones.length}`);
  const m = matrix();
  console.log(`合法组合数：${m.length}（题材×可渲染格式×口吻，去除排除项）`);
  console.log('样本：');
  m.slice(0, 6).forEach(c => console.log(`  ${c.theme} × ${c.format} × ${c.tone}`));
  // 契约自检
  const { validate } = require('./contract');
  console.log('契约校验(空 stocks)：', JSON.stringify(validate({ title: 'x', stocks: [] })));
  console.log('契约校验(正常)：', JSON.stringify(validate({ title: 'x', stocks: [{ code: '7203', name: 'トヨタ' }] })));
}
