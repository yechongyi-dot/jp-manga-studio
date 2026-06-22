import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { JpStockItem } from '../../types';
import { jpCard, type JpTheme } from './jpTheme';

/**
 * AiRankCard — 指标驱动的排行榜卡片（AI 智能生成专用）。
 * 大字突出「该题材的核心指标」(metricLabel + pct，由题材榜单决定：配当利回り/PER/PBR/ROE/上昇率/出来高…)，
 * 下方只列真实存在的支撑指标(現在値/PER/PBR/配当/時価総額/業績)，缺失自动跳过。无目標株価(无该真数据)。
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

export const AiRankCard: React.FC<Props> = ({ item, index, globalFrame, seed, topPad = 600, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { up, down, ink, inkDim, accent: themeAccent, Bg, bgOverlay } = theme;

  const metric = item.pct || '';
  const isPct  = /%/.test(metric);
  const isUp   = isPct ? !metric.trim().startsWith('-') : true;
  const metricColor = isPct ? (isUp ? up : down) : themeAccent;   // %→红蓝；倍等→主强调
  const label = item.metricLabel || '注目指標';

  const headOp = interpolate(frame, [0, 14], [0, 1], clamp);
  const headY  = spring({ frame, fps, config: { damping: 20, stiffness: 300 }, from: -44, to: 0 });
  const panelOp = interpolate(frame, [20, 36], [0, 1], clamp);
  const panelY  = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 18, stiffness: 220 }, from: 40, to: 0 });
  const card = jpCard(theme, themeAccent);

  const facts = [
    item.buyPrice && { k: '現在値', v: item.buyPrice },
    item.per && { k: 'PER', v: item.per },
    item.pbr && { k: 'PBR', v: item.pbr },
    item.dividend && { k: '配当', v: item.dividend },
    item.marketCap && { k: '時価総額', v: item.marketCap },
    item.earningsTrend && { k: '業績', v: item.earningsTrend },
  ].filter(Boolean).slice(0, 4) as { k: string; v: string }[];

  return (
    <AbsoluteFill>
      <Bg frame={globalFrame} trend={isUp ? 'up' : 'down'} overlay={bgOverlay} seed={seed} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', paddingLeft: 48, paddingRight: 48, paddingTop: topPad, paddingBottom: 300 }}>
        {/* 头卡：排名 + 代码 + 社名 */}
        <div style={{
          transform: `translateY(${headY}px)`, opacity: headOp, marginBottom: 22,
          background: `linear-gradient(135deg, ${themeAccent}26 0%, ${themeAccent}10 100%), #FFFFFF`,
          borderRadius: 18, borderLeft: `10px solid ${metricColor}`, padding: '20px 26px 22px',
          boxShadow: `0 14px 38px ${themeAccent}33, 0 1px 0 rgba(255,255,255,0.85) inset`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 52, height: 52, borderRadius: 11, background: metricColor, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 5px 16px ${metricColor}66` }}>
              <span style={{ fontFamily: MONO, fontWeight: 900, fontSize: 34, color: '#fff' }}>{index + 1}</span>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 37, fontWeight: 800, color: ink, letterSpacing: '2px' }}>{item.code}</span>
          </div>
          <div style={{ height: 1.5, background: `linear-gradient(90deg, transparent, ${themeAccent}30 18%, ${themeAccent}30 82%, transparent)`, margin: '14px 0' }} />
          <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: item.name.length > 8 ? 80 : 96, color: ink, lineHeight: 1.1, letterSpacing: '-1px' }}>{item.name}</span>
        </div>

        {/* 主卡：核心指标大字 + 真实支撑指标 */}
        <div style={{ transform: `translateY(${panelY}px)`, opacity: panelOp, ...card, padding: '28px 30px' }}>
          <div style={{ textAlign: 'center', marginBottom: facts.length ? 20 : 0 }}>
            <div style={{ fontFamily: FONT, fontSize: 40, fontWeight: 700, color: inkDim, marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: MONO, fontSize: 104, fontWeight: 800, color: metricColor, lineHeight: 1 }}>{metric || '—'}</div>
          </div>
          {facts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: `1px solid ${themeAccent}22`, paddingTop: 16 }}>
              {facts.map((f, i) => (
                <div key={i} style={{ width: '50%', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '9px 8px' }}>
                  <span style={{ fontFamily: FONT, fontSize: 36, color: inkDim, fontWeight: 600 }}>{f.k}</span>
                  <span style={{ fontFamily: MONO, fontSize: 42, color: ink, fontWeight: 700 }}>{f.v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
