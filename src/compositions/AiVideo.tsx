import React from 'react';
import type { AiVideoProps, BgSpec } from '../types';
import { JpStandardVideo } from './pro/JpStandardVideo';
import { JpNisaVideo } from './pro/JpNisaVideo';
import {
  JP_PRIME, JP_BROADCAST, JP_REPORT, JP_INSIGHT, JP_SECTOR, JP_NISA_OVERLAY, type JpTheme,
} from './pro/jpTheme';
import { JpStockScene }         from './pro/JpStockScene';
import { JpInsightStockScene }  from './pro/JpInsightStockScene';
import { JpSectorStockScene }   from './pro/JpSectorStockScene';
import { JpReportStockScene }   from './pro/JpReportStockScene';
import { JpBroadcastStockScene } from './pro/JpBroadcastStockScene';
import { AiRankCard } from './pro/AiRankCard';
import { AiDeepCard } from './pro/AiDeepCard';
import { JpPrimeBg }     from '../components/pro/JpPrimeBg';
import { JpBroadcastBg } from '../components/pro/JpBroadcastBg';
import { JpReportBg }    from '../components/pro/JpReportBg';
import { JpInsightBg }   from '../components/pro/JpInsightBg';
import { JpSectorBg }    from '../components/pro/JpSectorBg';
import { makeImageBg } from './bg/ImageBg';

const THEMES: Record<string, JpTheme> = {
  JP_PRIME, JP_BROADCAST, JP_REPORT, JP_INSIGHT, JP_SECTOR, JP_NISA_OVERLAY,
};
const STOCK_SCENES: Record<string, React.FC<any>> = {
  AiRankCard, AiDeepCard,
  JpStockScene, JpInsightStockScene, JpSectorStockScene, JpReportStockScene, JpBroadcastStockScene,
};
const PROC_BGS: Record<string, React.FC<any>> = {
  JpPrimeBg, JpBroadcastBg, JpReportBg, JpInsightBg, JpSectorBg,
};

function resolveTheme(base: JpTheme, bg?: BgSpec): JpTheme {
  if (!bg) return base;
  if (bg.type === 'image') return { ...base, Bg: makeImageBg(bg) } as JpTheme;
  if (bg.type === 'procedural' && bg.id && bg.id !== 'theme' && PROC_BGS[bg.id]) {
    return { ...base, Bg: PROC_BGS[bg.id] } as JpTheme;
  }
  return base;
}

// 字体覆盖：用属性选择器命中含原字体串的内联样式，!important 压过内联（无 !important）。
// sans 只命中标题/名称/标签（'Noto Sans JP'），mono 只命中数字/代码（'Roboto Mono'）。
// 由 AiVideo 渲染 <style> → 预览(Player)与真实出片(renderMedia)同时生效，零侵入各 composition。
function fontOverrideCss(fc?: { sans?: string; mono?: string }): string {
  if (!fc) return '';
  let css = '';
  if (fc.sans) css += `[style*="Noto Sans JP"]{font-family:${fc.sans}!important}`;
  if (fc.mono) css += `[style*="Roboto Mono"]{font-family:${fc.mono}!important}`;
  return css;
}

export const AiVideo: React.FC<AiVideoProps> = (props) => {
  const base = THEMES[props.themeId || 'JP_PRIME'] || JP_PRIME;
  const theme = resolveTheme(base, props.bg);
  const inner = props.structure === 'portfolio'
    ? <JpNisaVideo {...props} theme={theme} />
    : <JpStandardVideo {...props} theme={theme} StockScene={STOCK_SCENES[props.stockSceneId || 'JpStockScene'] || JpStockScene} />;
  const css = fontOverrideCss(props.fontConfig);
  return <>{css ? <style>{css}</style> : null}{inner}</>;
};
