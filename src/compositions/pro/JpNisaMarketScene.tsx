import React from 'react';
import {
  AbsoluteFill, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { jpCard, type JpTheme } from './jpTheme';

/**
 * JpNisaMarketScene —「市況」シーン（新NISA 多シーン版）。
 * 足元の地合いを中央テキストカードで提示。JP_REPORT（ミントグリーン）基調。
 */

interface Props {
  text:        string;        // marketContextText（無ければ親で script.marketContext を渡す）
  globalFrame: number;
  seed?:       number;
  theme:       JpTheme;
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const FONT  = "'Noto Sans JP','Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";

export const JpNisaMarketScene: React.FC<Props> = ({ text, globalFrame, seed, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { ink, inkDim, accent, Bg, bgOverlay } = theme;

  const badgeOp    = interpolate(frame, [4, 18], [0, 1], clamp);
  const badgeScale = spring({ frame: Math.max(0, frame - 4), fps, config: { damping: 11, stiffness: 320 }, from: 0.5, to: 1 });
  const cardOp = interpolate(frame, [18, 34], [0, 1], clamp);
  const cardY  = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 18, stiffness: 220 }, from: 56, to: 0 });
  const lineW  = interpolate(frame, [34, 60], [0, 1], clamp);
  const pulse  = 0.6 + 0.4 * Math.sin(frame * 0.18);

  const body = (text || '').trim() || '足元の地合いは堅調。押し目を狙いたい局面です。';
  const card = jpCard(theme, accent);

  return (
    <AbsoluteFill style={{ background: theme.Bg ? undefined : '#EAF5EE' }}>
      <Bg frame={globalFrame} trend="up" overlay={bgOverlay} seed={seed} />

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        paddingLeft: 56, paddingRight: 56, paddingBottom: 280,
      }}>
        {/* 見出しバッジ「市況」 */}
        <div style={{ transform: `scale(${badgeScale})`, opacity: badgeOp, marginBottom: 44 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 14,
            background: `linear-gradient(135deg, ${accent} 0%, ${accent}CC 100%)`,
            borderRadius: 60, padding: '15px 40px',
            boxShadow: `0 12px 40px ${accent}55`,
          }}>
            <div style={{ width: 13, height: 13, borderRadius: 7, background: '#fff', opacity: pulse, boxShadow: '0 0 12px rgba(255,255,255,0.8)' }} />
            <span style={{ fontFamily: FONT, fontSize: 46, fontWeight: 900, color: '#fff', letterSpacing: '3px' }}>市況</span>
            <span style={{ fontFamily: FONT, fontSize: 30, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '1px' }}>マーケット環境</span>
          </div>
        </div>

        {/* 中央テキストカード */}
        <div style={{
          transform: `translateY(${cardY}px)`, opacity: cardOp,
          ...card, borderLeft: `10px solid ${accent}`, borderRadius: 22,
          padding: '46px 52px', textAlign: 'center', width: '100%',
        }}>
          <div style={{ fontSize: 60, marginBottom: 18 }}>📈</div>
          <p style={{ fontFamily: FONT, fontSize: body.length > 44 ? 50 : 58, fontWeight: 800, color: ink, lineHeight: 1.55, margin: 0, letterSpacing: '-0.5px' }}>
            {body}
          </p>
          <div style={{ height: 1.5, background: `linear-gradient(90deg, transparent, ${accent}40 20%, ${accent}40 80%, transparent)`, margin: '30px 0 22px' }} />
          <span style={{ fontFamily: FONT, fontSize: 33, fontWeight: 700, color: inkDim, letterSpacing: '1px' }}>
            新NISA で着実に資産形成
          </span>
        </div>

        {/* 下線 */}
        <div style={{
          marginTop: 44, width: '70%', height: 4, borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          transform: `scaleX(${lineW})`, transformOrigin: 'center',
        }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
