import React from 'react';
import type { CurtainPalette } from '../../components/pro/JpIntroCurtain';
import { JpPrimeBg } from '../../components/pro/JpPrimeBg';
import { JpBroadcastBg } from '../../components/pro/JpBroadcastBg';
import { JpReportBg } from '../../components/pro/JpReportBg';
import { JpInsightBg } from '../../components/pro/JpInsightBg';
import { JpSectorBg } from '../../components/pro/JpSectorBg';

/**
 * JpTheme — 5 套模板的配色主题包。
 * 各套传自己的「背景组件 + 配色 + 跑马灯 + 片头钩子词」，复用同一套场景/overlay 逻辑。
 * 风格统一（同结构）+ 维护简单（改一处全套生效）+ 互不串味（各自配色背景）。
 *
 * 手机优化基调：主文字加深加饱和（强对比）、次文字不透明度 0.78（小字也清晰）、
 * accent 鲜明、卡底 0.98 近实白（挡背景花纹、更明亮）、涨跌红蓝更鲜明。
 */
export interface JpTheme {
  id:             string;
  Bg:             React.FC<{ frame: number; trend?: 'up' | 'down' | 'flat'; overlay?: number; seed?: number }>;
  up:             string;   // 涨（红）
  down:           string;   // 跌（蓝）
  mystery:        string;   // 神秘股
  ink:            string;   // 主文字
  inkDim:         string;   // 次文字
  cardGrad:       string;   // 白卡背景渐变
  cardShadow:     string;   // 白卡阴影
  accent:         string;   // 主强调（intro/ending/字幕/CTA）
  tickerTheme:    'blue' | 'red' | 'terminal';
  curtain:        CurtainPalette;
  curtainBig:     string;   // 片头大字钩子词
  curtainLive:    string;   // 片头 LIVE 文案
  bgOverlay:      number;   // 前景场景的背景压淡度
  endingGrad:     string;   // 结尾画面背景渐变
}

// 涨跌色全套统一（更鲜明，手机对比强）
const UP = '#E5281C';   // 鲜红（涨）
const DOWN = '#1568E5'; // 鲜蓝（跌）

// ── ① 现代简约·冷调（个股） ───────────────────────────────────
export const JP_PRIME: JpTheme = {
  id: 'JpPrime',
  Bg: JpPrimeBg,
  up: UP, down: DOWN, mystery: '#8A2BE2',
  ink: '#1B2F7A', inkDim: 'rgba(40,66,150,0.78)',
  cardGrad: 'linear-gradient(180deg, #EBF1FF 0%, #DBE6FD 100%)',
  cardShadow: '0 14px 44px rgba(40,72,170,0.20), 0 2px 0 rgba(255,255,255,0.7) inset',
  accent: '#2E54E6',
  tickerTheme: 'blue',
  curtain: { grad: 'radial-gradient(125% 90% at 50% 38%, #FFFFFF 0%, #ECF1F9 52%, #D6E2F4 100%)', ink: '#0C1730', accent: '#2E54E6', sub: 'rgba(28,42,78,0.62)', glow: 'rgba(46,84,230,0.30)' },
  curtainBig: '注目銘柄', curtainLive: '本日の急騰候補銘柄',
  bgOverlay: 0.32,
  endingGrad: 'radial-gradient(120% 80% at 50% 22%, #FFFFFF 0%, #EDF2FA 55%, #D9E4F5 100%)',
};

// ── ② 财经速报·暖调（个股） ───────────────────────────────────
export const JP_BROADCAST: JpTheme = {
  id: 'JpBroadcast',
  Bg: JpBroadcastBg,
  up: UP, down: DOWN, mystery: '#C2410C',
  ink: '#6B4410', inkDim: 'rgba(124,78,20,0.80)',
  cardGrad: 'linear-gradient(180deg, #FFF2DD 0%, #FFE4BE 100%)',
  cardShadow: '0 14px 44px rgba(180,110,20,0.22), 0 2px 0 rgba(255,255,255,0.7) inset',
  accent: '#E07B00',
  tickerTheme: 'red',
  curtain: { grad: 'radial-gradient(125% 90% at 50% 38%, #FFFDF8 0%, #FBF1E2 52%, #F1E0C6 100%)', ink: '#2A1A08', accent: '#E07B00', sub: 'rgba(86,58,28,0.66)', glow: 'rgba(224,123,0,0.30)' },
  curtainBig: '緊急キャッチ', curtainLive: '本日の急騰間近銘柄',
  bgOverlay: 0.32,
  endingGrad: 'radial-gradient(120% 80% at 50% 22%, #FFFDF8 0%, #FBF4E9 55%, #F0E2CC 100%)',
};

// ── ③ 私行理财·薄荷金（ISA 组合） ───────────────────────────
export const JP_REPORT: JpTheme = {
  id: 'JpReport',
  Bg: JpReportBg,
  up: UP, down: DOWN, mystery: '#B5567A',
  ink: '#0C4A36', inkDim: 'rgba(20,92,68,0.80)',
  cardGrad: 'linear-gradient(180deg, #E6F7EF 0%, #CFEEDD 100%)',
  cardShadow: '0 14px 44px rgba(16,130,92,0.22), 0 2px 0 rgba(255,255,255,0.7) inset',
  accent: '#0A9266',
  tickerTheme: 'blue',
  curtain: { grad: 'radial-gradient(125% 90% at 50% 38%, #FBFDFB 0%, #EAF5EE 52%, #D6E9DD 100%)', ink: '#0D2019', accent: '#0A9266', sub: 'rgba(28,64,52,0.62)', glow: 'rgba(10,146,102,0.28)' },
  curtainBig: 'ポートフォリオ', curtainLive: '新NISA 資産配分おすすめ',
  bgOverlay: 0.44,
  endingGrad: 'radial-gradient(120% 80% at 50% 22%, #FBFDFB 0%, #EAF5EE 55%, #D6E9DD 100%)',
};

// ── ④ 深度研报·青蓝（单股深扒） ───────────────────────────
export const JP_INSIGHT: JpTheme = {
  id: 'JpInsight',
  Bg: JpInsightBg,
  up: UP, down: DOWN, mystery: '#7C5BD0',
  ink: '#0A4548', inkDim: 'rgba(18,86,90,0.80)',
  cardGrad: 'linear-gradient(180deg, #E3F6F6 0%, #CCEBEB 100%)',
  cardShadow: '0 14px 44px rgba(14,150,152,0.22), 0 2px 0 rgba(255,255,255,0.7) inset',
  accent: '#0AA0A2',
  tickerTheme: 'blue',
  curtain: { grad: 'radial-gradient(125% 90% at 50% 38%, #F8FDFD 0%, #E7F5F5 52%, #D2ECEC 100%)', ink: '#08272D', accent: '#0AA0A2', sub: 'rgba(26,72,80,0.62)', glow: 'rgba(10,160,162,0.28)' },
  curtainBig: '独自分析', curtainLive: '機関・外国人の需給を捕捉',
  bgOverlay: 0.44,
  endingGrad: 'radial-gradient(120% 80% at 50% 22%, #F8FDFD 0%, #E7F5F5 55%, #D2ECEC 100%)',
};

// ── ⑤ 数据洞察·科技紫蓝（板块题材） ───────────────────────
export const JP_SECTOR: JpTheme = {
  id: 'JpSector',
  Bg: JpSectorBg,
  up: UP, down: DOWN, mystery: '#9333EA',
  ink: '#2C2168', inkDim: 'rgba(72,56,150,0.80)',
  cardGrad: 'linear-gradient(180deg, #F0ECFF 0%, #E0D7FC 100%)',
  cardShadow: '0 14px 44px rgba(110,80,210,0.22), 0 2px 0 rgba(255,255,255,0.7) inset',
  accent: '#7A4DF0',
  tickerTheme: 'blue',
  curtain: { grad: 'radial-gradient(125% 90% at 50% 38%, #FAFAFE 0%, #EDEEFA 52%, #DCDFF5 100%)', ink: '#100E26', accent: '#7A4DF0', sub: 'rgba(52,48,98,0.62)', glow: 'rgba(122,77,240,0.28)' },
  curtainBig: 'セクターインサイト', curtainLive: '本日の主導テーマ',
  bgOverlay: 0.44,
  endingGrad: 'radial-gradient(120% 80% at 50% 22%, #FAFAFE 0%, #EDEEFA 55%, #DCDFF5 100%)',
};

// ── ⑥ NISA·红金速报（新NISA 多场景 Overlay 皮肤：暖色速报背景 + 红跑马灯）──
export const JP_NISA_OVERLAY: JpTheme = {
  id: 'JpNisaOverlay',
  Bg: JpBroadcastBg,
  up: UP, down: DOWN, mystery: '#B0103A',
  ink: '#7A1222', inkDim: 'rgba(122,18,34,0.80)',
  cardGrad: 'linear-gradient(180deg, #FFF1E6 0%, #FFE0CC 100%)',
  cardShadow: '0 14px 44px rgba(180,30,40,0.24), 0 2px 0 rgba(255,255,255,0.7) inset',
  accent: '#C8102E',
  tickerTheme: 'red',
  curtain: { grad: 'radial-gradient(125% 90% at 50% 38%, #FFFBF8 0%, #FBE8E0 52%, #F3D0C6 100%)', ink: '#2A0A0E', accent: '#C8102E', sub: 'rgba(90,30,30,0.66)', glow: 'rgba(200,16,46,0.30)' },
  curtainBig: '速報', curtainLive: '新NISA 注目ポートフォリオ',
  bgOverlay: 0.36,
  endingGrad: 'radial-gradient(120% 80% at 50% 22%, #FFFBF8 0%, #FBEDE6 55%, #F3D8CC 100%)',
};

/**
 * jpCard — 增强前景卡样式（5 套前景统一用）。
 * 强模糊（背景花纹化氛围）+ 强阴影（浮起、拉开层次）+ 近实白底（挡花纹），解决前景看不清。
 */
export function jpCard(theme: JpTheme, accent?: string): React.CSSProperties {
  const a = accent ?? theme.accent;
  return {
    background: theme.cardGrad,
    border: `1.5px solid ${a}5A`,
    borderRadius: 18,
    boxShadow: `0 24px 64px rgba(14,22,44,0.34), 0 8px 20px rgba(14,22,44,0.20), 0 1px 0 rgba(255,255,255,0.97) inset`,
    backdropFilter: 'blur(28px) saturate(1.2)',
  };
}
