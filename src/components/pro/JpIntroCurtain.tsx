import React from 'react';
import { interpolate } from 'remotion';

/**
 * JpIntroCurtain — 速报式片头幕布动画（5 套传配色复用，各自风格）
 * 幕布 → 中央柔光焦点 → 巨字 bigText → 粗下划线 → label/LIVE → 扫描线 → 上滑消退。
 * 精致排版 + 焦点光，浅色/深色皆高级。
 */

export interface CurtainPalette {
  grad:   string;   // 幕布渐变背景
  ink:    string;   // 巨字色
  accent: string;   // 扫描线/下划线/徽章
  sub:    string;   // label / 小字
  glow:   string;   // 焦点光 / 辉光
}

interface Props {
  frame:           number;
  bigText:         string;          // 速報 / 緊急 / 独自 …
  label?:          string;          // JAPAN STOCK
  liveText?:       string;          // LIVE · 本日の注目銘柄
  palette:         CurtainPalette;
  durationFrames?: number;
}

const FONT = "'Noto Sans JP','Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";

export const JpIntroCurtain: React.FC<Props> = ({
  frame, bigText, label = 'JAPAN STOCK', liveText = 'LIVE · 本日の注目銘柄',
  palette, durationFrames = 52,
}) => {
  const D = durationFrames;
  const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
  if (frame >= D) return null;

  const short = bigText.length <= 2;

  const curtainOp = interpolate(frame, [0, D - 12, D - 2], [1, 1, 0], clamp);
  const slideY    = interpolate(frame, [D - 14, D], [0, -190], clamp);
  const innerY    = interpolate(frame, [D - 16, D - 2], [0, -80], clamp);
  const sweepW    = interpolate(frame, [2, 16], [0, 1], clamp);
  const flashOp   = interpolate(frame, [0, 5, 18], [0.5, 0.14, 0], clamp);
  const haloOp    = interpolate(frame, [4, 20], [0, 1], clamp);
  const bigOp     = interpolate(frame, [3, 15], [0, 1], clamp);
  const bigScale  = interpolate(frame, [3, 20], [1.16, 1], clamp);
  const lineW     = interpolate(frame, [13, 30], [0, 1], clamp);
  const liveOp    = interpolate(frame, [20, 32], [0, 1], clamp);
  const labelOp   = interpolate(frame, [6, 18], [0, 1], clamp);
  const dotPulse  = 0.6 + 0.4 * Math.sin(frame * 0.4);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 300,
      background: palette.grad, opacity: curtainOp,
      transform: `translateY(${slideY}px)`,
      overflow: 'hidden', pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* 中央焦点柔光 */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 900, height: 620, transform: 'translate(-50%,-54%)',
        background: `radial-gradient(ellipse, ${palette.glow} 0%, transparent 62%)`,
        opacity: haloOp,
      }} />
      {/* 扫描线 */}
      <div style={{
        position: 'absolute', top: '50%', left: 0, marginTop: short ? -8 : -4,
        width: `${sweepW * 100}%`, height: 2.5,
        background: `linear-gradient(90deg, transparent, ${palette.accent})`,
        boxShadow: `0 0 26px ${palette.glow}`,
      }} />
      {/* 开场闪光 */}
      <div style={{ position: 'absolute', inset: 0, background: palette.glow, opacity: flashOp }} />

      {/* 中央块 */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, transform: `translateY(${innerY}px)` }}>
        <div style={{
          fontFamily: FONT, fontSize: 38, fontWeight: 800, color: palette.sub,
          letterSpacing: '14px', marginBottom: 16, opacity: labelOp, paddingLeft: 14,
        }}>
          {label}
        </div>
        <div style={{
          fontFamily: FONT, fontSize: short ? 200 : 124, fontWeight: 900, color: palette.ink,
          letterSpacing: short ? '20px' : '-1px', lineHeight: 0.92,
          opacity: bigOp, transform: `scale(${bigScale})`,
          textShadow: `0 6px 34px ${palette.glow}`,
          paddingLeft: short ? 20 : 0,
        }}>
          {bigText}
        </div>
        {/* 粗下划线 */}
        <div style={{
          width: short ? 280 : 360, height: 7, margin: '26px auto 0', borderRadius: 4,
          background: `linear-gradient(90deg, transparent, ${palette.accent} 30%, ${palette.accent} 70%, transparent)`,
          transform: `scaleX(${lineW})`, boxShadow: `0 0 22px ${palette.glow}`,
        }} />
        {/* LIVE 徽章 */}
        <div style={{
          marginTop: 30, opacity: liveOp, display: 'inline-flex', alignItems: 'center', gap: 12,
          border: `2px solid ${palette.accent}`, borderRadius: 50, padding: '12px 36px',
          background: `${palette.accent}14`,
        }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: palette.accent, opacity: dotPulse, boxShadow: `0 0 14px ${palette.accent}` }} />
          <span style={{ fontFamily: FONT, fontSize: 28, fontWeight: 800, color: palette.ink, letterSpacing: '1px' }}>{liveText}</span>
        </div>
      </div>
    </div>
  );
};
