import React from 'react';
import {
  AbsoluteFill, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { jpCard, type JpTheme } from './jpTheme';

/**
 * JpNisaPlanScene —「投資プラン」シーン（新NISA 多シーン版）。
 * 初期資金 → 目標利益（min〜max）を 2 カード＋矢印で大きく見せる。JP_REPORT 基調。
 */

interface Props {
  initialCapital?:  string;   // script.initialCapital（初期資金）
  targetProfitMin?: string;   // script.targetProfitMin（目標利益 下限）
  targetProfitMax?: string;   // script.targetProfitMax（目標利益 上限）
  subText?:         string;   // investmentPlanText（サブ）
  globalFrame:      number;
  seed?:            number;
  theme:            JpTheme;
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const FONT  = "'Noto Sans JP','Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";
const MONO  = "'Roboto Mono','SF Mono','Consolas',monospace";

export const JpNisaPlanScene: React.FC<Props> = ({
  initialCapital, targetProfitMin, targetProfitMax, subText, globalFrame, seed, theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { ink, inkDim, accent, up, Bg, bgOverlay } = theme;

  const hasCapital = !!(initialCapital && initialCapital.trim());
  const hasProfit  = !!((targetProfitMin && targetProfitMin.trim()) || (targetProfitMax && targetProfitMax.trim()));
  const profitText = [targetProfitMin, targetProfitMax].filter(v => v && v.trim()).join(' 〜 ');
  const sub = (subText || '').trim();

  const badgeOp    = interpolate(frame, [4, 18], [0, 1], clamp);
  const badgeScale = spring({ frame: Math.max(0, frame - 4), fps, config: { damping: 11, stiffness: 320 }, from: 0.5, to: 1 });
  const c1Op = interpolate(frame, [18, 32], [0, 1], clamp);
  const c1Y  = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 18, stiffness: 230 }, from: 50, to: 0 });
  const arrowOp    = interpolate(frame, [34, 46], [0, 1], clamp);
  const arrowScale = spring({ frame: Math.max(0, frame - 34), fps, config: { damping: 10, stiffness: 320 }, from: 0.4, to: 1 });
  const c2Op = interpolate(frame, [44, 60], [0, 1], clamp);
  const c2Scale = spring({ frame: Math.max(0, frame - 44), fps, config: { damping: 12, stiffness: 280 }, from: 0.7, to: 1 });
  const subOp = interpolate(frame, [62, 76], [0, 1], clamp);
  const glow  = 16 + 8 * Math.sin(frame * 0.16);

  const card = jpCard(theme, accent);

  return (
    <AbsoluteFill>
      <Bg frame={globalFrame} trend="up" overlay={bgOverlay} seed={seed} />

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        paddingLeft: 56, paddingRight: 56, paddingBottom: 270,
      }}>
        {/* 見出し「投資プラン」 */}
        <div style={{ transform: `scale(${badgeScale})`, opacity: badgeOp, marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 14,
            background: `linear-gradient(135deg, ${accent} 0%, ${accent}CC 100%)`,
            borderRadius: 60, padding: '15px 42px', boxShadow: `0 12px 40px ${accent}55`,
          }}>
            <span style={{ fontSize: 40 }}>🎯</span>
            <span style={{ fontFamily: FONT, fontSize: 46, fontWeight: 900, color: '#fff', letterSpacing: '3px' }}>投資プラン</span>
          </div>
        </div>

        {/* 初期資金カード */}
        {hasCapital && (
          <div style={{
            transform: `translateY(${c1Y}px)`, opacity: c1Op,
            ...card, borderRadius: 22, padding: '30px 48px', textAlign: 'center', width: '100%',
          }}>
            <div style={{ fontFamily: FONT, fontSize: 36, fontWeight: 700, color: inkDim, marginBottom: 14, letterSpacing: '1px' }}>初期資金</div>
            <div style={{ fontFamily: MONO, fontSize: 96, fontWeight: 900, color: ink, lineHeight: 1, letterSpacing: '-1px' }}>{initialCapital}</div>
          </div>
        )}

        {/* 矢印 */}
        {hasCapital && hasProfit && (
          <div style={{ transform: `scale(${arrowScale})`, opacity: arrowOp, margin: '22px 0' }}>
            <div style={{
              width: 92, height: 92, borderRadius: 46,
              background: `linear-gradient(135deg, ${accent}, ${accent}AA)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 10px 30px ${accent}55`,
            }}>
              <span style={{ fontSize: 56, color: '#fff', fontWeight: 900, lineHeight: 1 }}>↓</span>
            </div>
          </div>
        )}

        {/* 目標利益カード（強調・グラデ） */}
        {hasProfit && (
          <div style={{
            transform: `scale(${c2Scale})`, opacity: c2Op,
            background: `linear-gradient(135deg, ${up} 0%, ${up}D0 100%)`,
            borderRadius: 26, padding: '34px 48px', textAlign: 'center', width: '100%',
            boxShadow: `0 16px 50px ${up}55, 0 0 ${glow}px ${up}40`,
            marginTop: hasCapital && hasProfit ? 0 : 22,
          }}>
            <div style={{ fontFamily: FONT, fontSize: 38, fontWeight: 800, color: 'rgba(255,255,255,0.9)', marginBottom: 14, letterSpacing: '1px' }}>目標利益</div>
            <div style={{ fontFamily: MONO, fontSize: profitText.length > 12 ? 84 : 100, fontWeight: 900, color: '#fff', lineHeight: 1.05, letterSpacing: '-1px' }}>{profitText}</div>
          </div>
        )}

        {/* サブテキスト */}
        {sub && (
          <div style={{ opacity: subOp, marginTop: 34 }}>
            <span style={{
              ...card, border: `1px solid ${accent}33`,
              fontFamily: FONT, fontSize: 36, fontWeight: 700, color: inkDim,
              borderRadius: 50, padding: '14px 38px', display: 'inline-block', lineHeight: 1.4,
            }}>
              {sub}
            </span>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
