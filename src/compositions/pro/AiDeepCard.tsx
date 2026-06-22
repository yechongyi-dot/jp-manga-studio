import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { JpStockItem } from '../../types';
import { jpCard, type JpTheme } from './jpTheme';

/**
 * AiDeepCard — 单股深扒卡片（AI 智能生成专用，1 銘柄）。
 * 社名/代码大字 + 该题材核心指标 + 全部真实指标铺开(現在値/PER/PBR/時価総額/業績/配当)，缺失自动跳过。无目標株価。
 */
interface Props {
  item:        JpStockItem & { metricLabel?: string };
  index:       number;
  globalFrame: number;
  seed?:       number;
  topPad?:     number;
  theme:       JpTheme;
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const FONT  = "'Noto Sans JP','Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";
const MONO  = "'Roboto Mono','SF Mono','Consolas',monospace";

export const AiDeepCard: React.FC<Props> = ({ item, globalFrame, seed, topPad = 600, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { up, down, ink, inkDim, accent: themeAccent, Bg, bgOverlay } = theme;

  const metric = item.pct || '';
  const isPct  = /%/.test(metric);
  const isUp   = isPct ? !metric.trim().startsWith('-') : true;
  const metricColor = isPct ? (isUp ? up : down) : themeAccent;
  const label = item.metricLabel || '注目指標';

  const headOp = interpolate(frame, [0, 14], [0, 1], clamp);
  const headY  = spring({ frame, fps, config: { damping: 20, stiffness: 300 }, from: -44, to: 0 });
  const panelOp = interpolate(frame, [18, 34], [0, 1], clamp);
  const panelY  = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 18, stiffness: 220 }, from: 44, to: 0 });
  const card = jpCard(theme, themeAccent);

  // 深扒：尽可能多列真实指标
  const facts = [
    item.buyPrice && { k: '現在値', v: item.buyPrice },
    item.per && { k: 'PER', v: item.per },
    item.pbr && { k: 'PBR', v: item.pbr },
    item.dividend && { k: '配当利回り', v: item.dividend },
    item.marketCap && { k: '時価総額', v: item.marketCap },
    item.earningsTrend && { k: '今期業績', v: item.earningsTrend },
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <AbsoluteFill>
      <Bg frame={globalFrame} trend={isUp ? 'up' : 'down'} overlay={bgOverlay} seed={seed} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', paddingLeft: 48, paddingRight: 48, paddingTop: topPad, paddingBottom: 280 }}>
        {/* 头卡：徹底解剖バッジ + 代码 + 社名(大) */}
        <div style={{
          transform: `translateY(${headY}px)`, opacity: headOp, marginBottom: 22,
          background: `linear-gradient(135deg, ${themeAccent}26 0%, ${themeAccent}10 100%), #FFFFFF`,
          borderRadius: 18, borderLeft: `10px solid ${metricColor}`, padding: '22px 28px 24px',
          boxShadow: `0 14px 38px ${themeAccent}33, 0 1px 0 rgba(255,255,255,0.85) inset`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ padding: '7px 16px', borderRadius: 9, background: metricColor }}>
              <span style={{ fontFamily: FONT, fontSize: 32, fontWeight: 800, color: '#fff' }}>徹底解剖</span>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 40, fontWeight: 800, color: ink, letterSpacing: '2px' }}>{item.code}</span>
          </div>
          <div style={{ height: 1.5, background: `linear-gradient(90deg, transparent, ${themeAccent}30 18%, ${themeAccent}30 82%, transparent)`, margin: '14px 0' }} />
          <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: item.name.length > 8 ? 88 : 104, color: ink, lineHeight: 1.08, letterSpacing: '-1px' }}>{item.name}</span>
        </div>

        {/* 核心指标大字 */}
        <div style={{ transform: `translateY(${panelY}px)`, opacity: panelOp, marginBottom: 18, textAlign: 'center' }}>
          <span style={{ fontFamily: FONT, fontSize: 40, fontWeight: 700, color: inkDim }}>{label}　</span>
          <span style={{ fontFamily: MONO, fontSize: 76, fontWeight: 800, color: metricColor }}>{metric || '—'}</span>
        </div>

        {/* 全指标铺开 */}
        <div style={{ transform: `translateY(${panelY}px)`, opacity: panelOp, ...card, padding: '14px 30px' }}>
          {facts.map((f, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              padding: '16px 4px', borderTop: i ? `1px solid ${themeAccent}1A` : 'none',
            }}>
              <span style={{ fontFamily: FONT, fontSize: 40, color: inkDim, fontWeight: 600 }}>{f.k}</span>
              <span style={{ fontFamily: MONO, fontSize: 52, color: ink, fontWeight: 700 }}>{f.v}</span>
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
