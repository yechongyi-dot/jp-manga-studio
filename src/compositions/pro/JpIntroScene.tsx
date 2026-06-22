import React from 'react';
import {
  AbsoluteFill, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import type { JpTheme } from './jpTheme';

/**
 * JpIntroScene — 通用片头 intro 内容（传 theme）。速报幕布由 Video 顶层负责。
 */

interface Props {
  title:       string;
  stockCount:  number;
  globalFrame: number;
  seed?:       number;
  subtitle?:   string;
  today?:      string;   // 日付は Node 側で算出して渡す（コンポーネント内 new Date() 禁止＝毎フレーム重く非決定的）
  theme:       JpTheme;
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const FONT  = "'Noto Sans JP','Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";
const MONO  = "'Roboto Mono','SF Mono','Consolas',monospace";
const ENTER = 44;

export const JpIntroScene: React.FC<Props> = ({ title, stockCount, globalFrame, seed, subtitle, today, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { accent, ink, inkDim, cardGrad, cardShadow, Bg } = theme;
  const t = Math.max(0, frame - ENTER);

  const liveOp = interpolate(t, [0, 12], [0, 1], clamp);
  const liveY  = spring({ frame: t, fps, config: { damping: 20, stiffness: 300 }, from: -50, to: 0 });
  const titleOp = interpolate(t, [10, 26], [0, 1], clamp);
  const titleY  = spring({ frame: Math.max(0, t - 10), fps, config: { damping: 16, stiffness: 230 }, from: 64, to: 0 });
  const subOp = interpolate(t, [26, 40], [0, 1], clamp);
  const subY  = spring({ frame: Math.max(0, t - 26), fps, config: { damping: 18, stiffness: 220 }, from: 40, to: 0 });
  const badgeOp    = interpolate(t, [40, 54], [0, 1], clamp);
  const badgeScale = spring({ frame: Math.max(0, t - 40), fps, config: { damping: 11, stiffness: 330 }, from: 0.4, to: 1 });
  const lineW = interpolate(t, [52, 74], [0, 1], clamp);
  const pulse = 0.6 + 0.4 * Math.sin(frame * 0.18);

  const card: React.CSSProperties = { background: cardGrad, boxShadow: cardShadow, backdropFilter: 'blur(3px)' };

  return (
    <AbsoluteFill>
      <Bg frame={globalFrame} trend="up" overlay={0.42} seed={seed} />

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        paddingLeft: 56, paddingRight: 56, paddingBottom: 280,
      }}>
        <div style={{
          transform: `translateY(${liveY}px)`, opacity: liveOp, marginBottom: 40,
          display: 'flex', alignItems: 'center', gap: 13,
          ...card, border: `1px solid ${accent}40`, borderRadius: 60, padding: '11px 30px',
        }}>
          <div style={{ width: 11, height: 11, borderRadius: 6, background: accent, opacity: pulse, boxShadow: `0 0 10px ${accent}` }} />
          <span style={{ fontFamily: FONT, fontSize: 28, fontWeight: 800, color: accent, letterSpacing: '2px' }}>LIVE · 分析レポート</span>
        </div>

        <div style={{ transform: `translateY(${titleY}px)`, opacity: titleOp, textAlign: 'center', marginBottom: 24 }}>
          <span style={{
            fontFamily: FONT, fontWeight: 900,
            fontSize: title.length > 16 ? 68 : title.length > 10 ? 78 : 90,
            color: ink, lineHeight: 1.2, display: 'block', letterSpacing: '-1px',
            textShadow: '0 2px 16px rgba(255,255,255,0.7)',
          }}>
            {title}
          </span>
        </div>

        {subtitle && (
          <div style={{ transform: `translateY(${subY}px)`, opacity: subOp, marginBottom: 24 }}>
            <span style={{ ...card, border: `1px solid ${accent}22`, fontFamily: FONT, fontSize: 34, fontWeight: 600, color: inkDim, borderRadius: 50, padding: '9px 34px', display: 'inline-block' }}>
              {subtitle}
            </span>
          </div>
        )}

        <div style={{ transform: `scale(${badgeScale})`, opacity: badgeOp, marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 60, overflow: 'hidden', boxShadow: `0 10px 34px ${accent}40` }}>
            <div style={{ background: accent, padding: '15px 30px' }}>
              <span style={{ fontFamily: MONO, fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{stockCount}</span>
            </div>
            <div style={{ background: '#fff', padding: '15px 26px' }}>
              <span style={{ fontFamily: FONT, fontSize: 32, fontWeight: 800, color: ink }}>銘柄分析</span>
            </div>
          </div>
        </div>

        {today && (
          <div style={{ transform: `translateY(${subY}px)`, opacity: subOp, marginBottom: 40 }}>
            <span style={{ ...card, border: `1px solid ${accent}1F`, fontFamily: FONT, fontSize: 26, fontWeight: 500, color: inkDim, borderRadius: 50, padding: '8px 28px', display: 'inline-block' }}>
              {today}
            </span>
          </div>
        )}

        <div style={{
          width: '74%', height: 3, borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          transform: `scaleX(${lineW})`, transformOrigin: 'center',
        }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
