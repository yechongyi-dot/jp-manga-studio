import React from 'react';
import {
  AbsoluteFill, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { JpBg } from '../components/JpBg';
import { JpTelop } from '../components/JpTelop';
import type { JpScript } from '../types';

interface Props {
  script:      JpScript;
  globalFrame: number;
  seed?:       number;
  noBg?:       boolean;
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const FONT  = "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif";
const MONO  = "'Consolas','SF Mono',monospace";

const darkCard: React.CSSProperties = {
  background: 'rgba(6,9,22,0.72)',
  border: '1px solid rgba(255,255,255,0.10)',
  backdropFilter: 'blur(14px)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.40)',
};

const GOLD = '#F5C842';
const GREEN = '#22C55E';

export const JpNisaPlanScene: React.FC<Props> = ({ script, globalFrame, seed, noBg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { initialCapital, targetProfitMin, targetProfitMax } = script;

  const headerOp = interpolate(frame, [0, 14], [0, 1], clamp);
  const headerY  = spring({ frame, fps, config: { damping: 18, stiffness: 280 }, from: -55, to: 0 });

  const cardOp   = interpolate(frame, [14, 28], [0, 1], clamp);
  const cardY    = spring({ frame: Math.max(0, frame - 14), fps, config: { damping: 16, stiffness: 230 }, from: 50, to: 0 });

  const arrowOp  = interpolate(frame, [28, 42], [0, 1], clamp);
  const targetOp = interpolate(frame, [36, 52], [0, 1], clamp);
  const targetSc = spring({ frame: Math.max(0, frame - 36), fps, config: { damping: 10, stiffness: 340 }, from: 0.5, to: 1 });

  const glowSize = 8 + 5 * Math.sin(frame * 0.18);

  return (
    <AbsoluteFill>
      {!noBg && <JpBg frame={globalFrame} trend="up" overlay={0.20} seed={seed} />}

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingLeft: 56, paddingRight: 56,
        paddingBottom: 280, gap: 32,
      }}>

        {/* ── ヘッダーバッジ ── */}
        <div style={{
          transform: `translateY(${headerY}px)`, opacity: headerOp,
          display: 'inline-flex', alignItems: 'center', gap: 14,
          background: 'rgba(245,200,66,0.12)',
          border: `1.5px solid rgba(245,200,66,0.50)`,
          borderRadius: 60, padding: '12px 40px',
          boxShadow: `0 4px 28px rgba(245,200,66,0.18)`,
        }}>
          <span style={{ fontSize: 32 }}>💰</span>
          <span style={{
            fontFamily: FONT, fontSize: 32, fontWeight: 800,
            color: GOLD, letterSpacing: '2px',
          }}>
            NISA投資方案
          </span>
        </div>

        {/* ── 初期資金カード ── */}
        <div style={{
          transform: `translateY(${cardY}px)`, opacity: cardOp,
          ...darkCard,
          border: `1px solid rgba(245,200,66,0.22)`,
          borderRadius: 22, padding: '32px 44px',
          width: '100%', textAlign: 'center',
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 36, fontWeight: 600,
            color: 'rgba(255,255,255,0.50)', marginBottom: 10,
          }}>
            初期資金
          </div>
          <div style={{ fontFamily: MONO, fontSize: 88, fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>
            {initialCapital || '—'}
          </div>
        </div>

        {/* ── 矢印 ── */}
        <div style={{ opacity: arrowOp, fontSize: 56, color: GOLD, lineHeight: 1 }}>
          ↓
        </div>

        {/* ── 目標利益カード ── */}
        <div style={{
          transform: `scale(${targetSc})`, opacity: targetOp,
          background: 'rgba(6,9,22,0.80)',
          border: `1.5px solid rgba(34,197,94,0.45)`,
          backdropFilter: 'blur(14px)',
          borderRadius: 24, padding: '36px 44px',
          width: '100%', textAlign: 'center',
          boxShadow: `0 6px 36px rgba(34,197,94,0.20), 0 0 ${glowSize}px rgba(34,197,94,0.12)`,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 36, fontWeight: 600,
            color: 'rgba(255,255,255,0.50)', marginBottom: 14,
          }}>
            目標利益
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 24,
          }}>
            <span style={{ fontFamily: MONO, fontSize: 76, fontWeight: 900, color: GREEN, lineHeight: 1 }}>
              {targetProfitMin || '—'}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 52, color: 'rgba(255,255,255,0.40)', fontWeight: 300 }}>
              →
            </span>
            <span style={{
              fontFamily: MONO, fontSize: 92, fontWeight: 900, lineHeight: 1,
              color: '#E8392B',
              textShadow: '0 0 36px rgba(232,57,43,0.50)',
            }}>
              {targetProfitMax || '—'}
            </span>
          </div>
        </div>

      </AbsoluteFill>

      <JpTelop
        badge="投資方案"
        name={`${initialCapital || ''}　→　${targetProfitMax || ''}`}
        accent={GOLD}
        frame={frame}
      />
    </AbsoluteFill>
  );
};
