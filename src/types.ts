// 株主優待の実データ（pro 模板の優待カード用。手动路径不使用）
export interface JpYutai {
  minShares?:    string;
  perkContent?:  string;
  recordMonths?: string;
  minInvest?:    string;
  yutaiYield?:   string;
}

export interface JpStockItem {
  code:         string;
  name:         string;
  buyPrice:     string;
  targetPrice?: string;
  pct:          string;
  note:         string;
  sector?:      string;
  shortTarget?: string;
  finalTarget?: string;
  ttsText?:     string;
  // ── pro 模板拡張フィールド（すべて任意・手动路径未使用）──
  metricLabel?:   string;   // AI 排行/深扒：该题材核心指标的标签(配当利回り/PER/ROE…)
  dividend?:      string;
  weight?:        number | string;
  foreign?:       string;
  per?:           string;
  pbr?:           string;
  marketCap?:     string;
  earningsTrend?: string;
  salesYoy?:      string;
  profitYoy?:     string;
  yutai?:         JpYutai;
}

export interface JpScript {
  title:      string;
  stocks:     JpStockItem[];
  ctaLineId?: string;
  ctaText?:     string;
  ctaQrDataUrl?: string;  // pro 模板の LINE QR（任意。手动未使用）
  rawText?:   string;
  dateStr?:   string;   // pro 模板の JpIntroScene 用（任意）
  hook?:      string;
  introTts?:  string;
  themes?:    Array<{ name: string; desc: string }>;
  // NISA-specific fields
  subtitle?:             string;
  marketContext?:        string;
  initialCapital?:       string;
  targetProfitMin?:      string;
  targetProfitMax?:      string;
  featuredCurrentPrice?: string;
  featuredTargetPrice?:  string;
  featuredPct?:          string;
  planText?:             string;   // 投資方案の口播文（jp-parser が産出、jp-generate が配音/字幕に使用）
  featuredText?:         string;   // 主推株の口播文（同上）
}

export interface SubtitleLine {
  text:             string;
  durationInFrames: number;
}

export interface JpMangaVideoProps {
  script:           JpScript;
  durationInFrames: number;
  fps:              number;
  introDur:         number;
  stockDurations:   number[];
  ctaDur:           number;
  introAudioPath?:  string;
  stockAudioPaths:  string[];
  ctaAudioPath?:    string;
  subtitleSegs?:    SubtitleLine[];
  bgSeed?:          number;
  // ── pro 模板の多シーン NISA フィールド（すべて任意。手动は JpNisaVideoProps 经由で従来通り）──
  marketContextDur?:        number;
  investmentPlanDur?:       number;
  featuredStockDur?:        number;
  marketContextAudioPath?:  string;
  investmentPlanAudioPath?: string;
  featuredStockAudioPath?:  string;
  marketContextText?:       string;
  investmentPlanText?:      string;
  featuredText?:            string;
}

// ── 图片背景规格（bg/ImageBg.tsx 的 makeImageBg 使用） ──
export type ImageBgSpec = {
  type: 'image';
  top?: { src: string; w: number; h: number } | null;
  scroll?: { src: string; w: number; h: number } | null;
  dir?: 'up' | 'down';
  speed?: number;
  scrimOpacity?: number;
};

export type BgSpec =
  | { type: 'procedural'; id?: string }
  | ImageBgSpec;

// 字体覆盖（编辑器可视化编辑用；零侵入：AiVideo 注入属性选择器 CSS 覆盖内联字体）
export type FontConfig = {
  sans?: string;   // 覆盖标题/名称/标签（原 'Noto Sans JP' 族）；空=不覆盖
  mono?: string;   // 覆盖数字/代码（原 'Roboto Mono' 族）；空=不覆盖
};

// AiVideo 统一渲染入口的 Props（文案导入 + AI 生成 共用）
export interface AiVideoProps extends JpMangaVideoProps {
  structure?: 'standard' | 'portfolio';
  stockSceneId?: string;
  themeId?: string;
  bg?: BgSpec;
  fontConfig?: FontConfig;
}

export interface JpNisaVideoProps extends JpMangaVideoProps {
  marketContextDur?:        number;
  investmentPlanDur?:       number;
  featuredStockDur?:        number;
  marketContextAudioPath?:  string;
  investmentPlanAudioPath?: string;
  featuredStockAudioPath?:  string;
}

// 幕布アニメーション終了フレーム（SubtitleBar と JpIntroScene で共有）
export const CURTAIN_END_FRAME = 36 as const;

export const JP_TIMING = {
  FPS:       30,
  INTRO_DUR: 90,
  STOCK_DUR: 180,
  CTA_DUR:   90,
} as const;

export function pctColor(pct: string): string {
  const n = parseFloat(pct.replace(/[^0-9.\-]/g, ''));
  // 日本株の慣習：赤＝上昇、青＝下落（欧米と逆）。プラスは必ず赤系。
  if (isNaN(n)) return '#9CA3AF';
  if (n >= 100) return '#C81E0F';  // 特大幅上昇：濃い赤
  if (n > 0)    return '#E8392B';  // 上昇：赤
  if (n === 0)  return '#9CA3AF';  // 変わらず：グレー
  return '#1A6EDD';                // 下落：青
}

export function pctTrend(pct: string): 'up' | 'down' | 'flat' {
  const n = parseFloat(pct.replace(/[^0-9.\-]/g, ''));
  if (isNaN(n)) return 'flat';
  if (n > 2)  return 'up';
  if (n < -2) return 'down';
  return 'flat';
}
