import React from 'react';
import {
  AbsoluteFill, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { jpCard, type JpTheme } from './jpTheme';

/**
 * JpNisaFeaturedScene —「本命銘柄」シーン（新NISA 多シーン版）。
 * name/code は伏せた圧軸ミステリー株。現在価格 → 目標株価、予想上昇率を大きく強調。
 */

interface Props {
  currentPrice?: string;   // script.featuredCurrentPrice（現在価格）
  targetPrice?:  string;   // script.featuredTargetPrice（目標株価）
  pct?:          string;   // script.featuredPct（予想上昇率）
  subText?:      string;   // featuredText（サブ煽り）
  globalFrame:   number;
  seed?:         number;
  theme:         JpTheme;
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const FONT  = "'Noto Sans JP','Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";
const MONO  = "'Roboto Mono','SF Mono','Consolas',monospace";

export const JpNisaFeaturedScene: React.FC<Props> = ({
  currentPrice, targetPrice, pct, subText, globalFrame, seed, theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { ink, inkDim, accent, up, mystery, Bg, bgOverlay } = theme;

  const hasCur = !!(currentPrice && currentPrice.trim());
  const hasTgt = !!(targetPrice && targetPrice.trim());
  const hasPct = !!(pct && pct.trim());
  const sub = (subText || '').trim();

  const badgeOp    = interpolate(frame, [4, 18], [0, 1], clamp);
  const badgeScale = spring({ frame: Math.max(0, frame - 4), fps, config: { damping: 11, stiffness: 320 }, from: 0.4, to: 1 });
  const lockOp    = interpolate(frame, [16, 30], [0, 1], clamp);
  const lockScale = spring({ frame: Math.max(0, frame - 16), fps, config: { damping: 9, stiffness: 300 }, from: 0.3, to: 1 });
  const rowOp = interpolate(frame, [32, 48], [0, 1], clamp);
  const rowY  = spring({ frame: Math.max(0, frame - 32), fps, config: { damping: 18, stiffness: 220 }, from: 50, to: 0 });
  const pctOp = interpolate(frame, [50, 64], [0, 1], clamp);
  const pctScale = spring({ frame: Math.max(0, frame - 50), fps, config: { damping: 11, stiffness: 300 }, from: 0.5, to: 1 });
  const subOp = interpolate(frame, [64, 78], [0, 1], clamp);
  const glow   = 18 + 10 * Math.sin(frame * 0.16);
  const sparkle = 0.6 + 0.4 * Math.sin(frame * 0.22);

  const card = jpCard(theme, accent);

  return (
    <AbsoluteFill>
      <Bg frame={globalFrame} trend="up" overlay={bgOverlay} seed={seed} />

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        paddingLeft: 52, paddingRight: 52, paddingBottom: 270,
      }}>
        {/* 見出し「本命銘柄」 */}
        <div style={{ transform: `scale(${badgeScale})`, opacity: badgeOp, marginBottom: 30 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 14,
            background: `linear-gradient(135deg, ${mystery} 0%, ${accent} 100%)`,
            borderRadius: 60, padding: '15px 44px', boxShadow: `0 12px 40px ${mystery}55`,
          }}>
            <span style={{ fontSize: 42, opacity: sparkle }}>⭐</span>
            <span style={{ fontFamily: FONT, fontSize: 48, fontWeight: 900, color: '#fff', letterSpacing: '3px' }}>本命銘柄</span>
          </div>
        </div>

        {/* ミステリー銘柄カード（伏せ） */}
        <div style={{ transform: `scale(${lockScale})`, opacity: lockOp, marginBottom: 30, width: '100%' }}>
          <div style={{
            ...card, borderRadius: 24, padding: '34px 40px', textAlign: 'center',
            border: `2px solid ${mystery}66`,
          }}>
            <div style={{ fontSize: 70, marginBottom: 10 }}>🔒</div>
            <div style={{ fontFamily: FONT, fontSize: 78, fontWeight: 900, color: ink, lineHeight: 1.1, letterSpacing: '-1px' }}>お宝銘柄</div>
            <div style={{ fontFamily: FONT, fontSize: 36, fontWeight: 700, color: mystery, marginTop: 12, letterSpacing: '2px' }}>ミステリー銘柄 ?????</div>
          </div>
        </div>

        {/* 現在価格 → 目標株価 */}
        {(hasCur || hasTgt) && (
          <div style={{ transform: `translateY(${rowY}px)`, opacity: rowOp, display: 'flex', alignItems: 'stretch', gap: 18, width: '100%', marginBottom: 26 }}>
            {hasCur && (
              <div style={{ flex: 1, ...card, borderRadius: 20, padding: '24px 18px', textAlign: 'center' }}>
                <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 700, color: inkDim, marginBottom: 10 }}>現在価格</div>
                <div style={{ fontFamily: MONO, fontSize: 64, fontWeight: 900, color: ink, lineHeight: 1 }}>{currentPrice}</div>
              </div>
            )}
            {hasCur && hasTgt && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 52, color: accent, fontWeight: 900 }}>→</span>
              </div>
            )}
            {hasTgt && (
              <div style={{
                flex: 1, borderRadius: 20, padding: '24px 18px', textAlign: 'center',
                background: `linear-gradient(135deg, ${up} 0%, ${up}D0 100%)`,
                boxShadow: `0 12px 36px ${up}55`,
              }}>
                <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 800, color: 'rgba(255,255,255,0.9)', marginBottom: 10 }}>目標株価</div>
                <div style={{ fontFamily: MONO, fontSize: 64, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{targetPrice}</div>
              </div>
            )}
          </div>
        )}

        {/* 予想上昇率（特大強調） */}
        {hasPct && (
          <div style={{ transform: `scale(${pctScale})`, opacity: pctOp, width: '100%' }}>
            <div style={{
              background: `linear-gradient(135deg, ${up} 0%, ${mystery} 120%)`,
              borderRadius: 28, padding: '28px 40px', textAlign: 'center',
              boxShadow: `0 16px 52px ${up}55, 0 0 ${glow}px ${up}45`,
            }}>
              <div style={{ fontFamily: FONT, fontSize: 36, fontWeight: 800, color: 'rgba(255,255,255,0.9)', marginBottom: 10, letterSpacing: '2px' }}>予想上昇率</div>
              <div style={{ fontFamily: MONO, fontSize: 118, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-2px' }}>{pct}</div>
            </div>
          </div>
        )}

        {/* サブ煽り */}
        {sub && (
          <div style={{ opacity: subOp, marginTop: 30 }}>
            <span style={{
              ...card, border: `1px solid ${accent}33`,
              fontFamily: FONT, fontSize: 38, fontWeight: 800, color: ink,
              borderRadius: 50, padding: '14px 40px', display: 'inline-block', lineHeight: 1.4,
            }}>
              {sub}
            </span>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
