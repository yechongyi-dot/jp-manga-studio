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
const RED   = '#E8392B';
const GOLD  = '#F5C842';

export const JpNisaFeaturedScene: React.FC<Props> = ({ script, globalFrame, seed, noBg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { featuredCurrentPrice, featuredTargetPrice, featuredPct } = script;

  const headerOp  = interpolate(frame, [0, 14], [0, 1], clamp);
  const headerY   = spring({ frame, fps, config: { damping: 18, stiffness: 280 }, from: -55, to: 0 });

  const priceOp   = interpolate(frame, [14, 28], [0, 1], clamp);
  const priceY    = spring({ frame: Math.max(0, frame - 14), fps, config: { damping: 16, stiffness: 230 }, from: 50, to: 0 });

  const arrowOp   = interpolate(frame, [26, 38], [0, 1], clamp);

  const pctOp     = interpolate(frame, [36, 52], [0, 1], clamp);
  const pctScale  = spring({ frame: Math.max(0, frame - 36), fps, config: { damping: 8, stiffness: 360 }, from: 0.3, to: 1 });

  const rawPct    = parseFloat((featuredPct || '0').replace(/[^0-9.]/g, ''));
  const countedPct = interpolate(frame, [36, 70], [0, rawPct], clamp);
  const displayPct = frame < 70 ? countedPct.toFixed(0) + '%' : (featuredPct || '—');

  const pulseOp   = 0.75 + 0.25 * Math.sin(frame * 0.15);
  const glowSize  = 10 + 6 * Math.sin(frame * 0.20);
  const shimX     = interpolate(frame, [40, 65], [-200, 1400], clamp);
  const shimOp    = interpolate(frame, [40, 48, 65, 70], [0, 0.4, 0.4, 0], clamp);

  return (
    <AbsoluteFill>
      {!noBg && <JpBg frame={globalFrame} trend="up" overlay={0.22} seed={seed} />}

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingLeft: 52, paddingRight: 52,
        paddingBottom: 280, gap: 28,
      }}>

        {/* ── ヘッダー：注目単銘柄 ── */}
        <div style={{
          transform: `translateY(${headerY}px)`, opacity: headerOp,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'rgba(232,57,43,0.16)',
            border: `1.5px solid rgba(232,57,43,0.55)`,
            borderRadius: 60, padding: '10px 40px',
            boxShadow: `0 4px 28px rgba(232,57,43,0.22)`,
          }}>
            <div style={{
              width: 12, height: 12, borderRadius: 6, background: RED,
              opacity: pulseOp, boxShadow: `0 0 ${glowSize}px ${RED}`,
            }} />
            <span style={{
              fontFamily: FONT, fontSize: 30, fontWeight: 800,
              color: '#FF6B6B', letterSpacing: '2px',
            }}>
              注目　単銘柄
            </span>
          </div>
          <div style={{
            fontFamily: FONT, fontSize: 28, fontWeight: 500,
            color: 'rgba(255,255,255,0.50)',
          }}>
            ▶ 圧倒的リターン狙いの隠れた成長株
          </div>
        </div>

        {/* ── 価格カード ── */}
        <div style={{
          transform: `translateY(${priceY}px)`, opacity: priceOp,
          background: 'rgba(6,9,22,0.75)',
          border: `1px solid rgba(232,57,43,0.22)`,
          backdropFilter: 'blur(14px)',
          borderRadius: 24, padding: '40px 44px',
          width: '100%', position: 'relative', overflow: 'hidden',
          boxShadow: '0 4px 28px rgba(0,0,0,0.50)',
        }}>
          {/* シャインエフェクト */}
          <div style={{
            position: 'absolute', top: 0,
            left: shimX, width: 120, height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
            opacity: shimOp, pointerEvents: 'none', transform: 'skewX(-20deg)',
          }} />

          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
            {/* 現在株価 */}
            <div style={{ flex: 1, textAlign: 'center', paddingRight: 20 }}>
              <div style={{
                fontFamily: FONT, fontSize: 38, fontWeight: 600,
                color: 'rgba(255,255,255,0.45)', marginBottom: 10,
              }}>
                当前股价
              </div>
              <div style={{ fontFamily: MONO, fontSize: 72, fontWeight: 700, color: '#FFFFFF' }}>
                {featuredCurrentPrice || '—'}
              </div>
            </div>

            {/* 矢印 */}
            <div style={{
              display: 'flex', alignItems: 'center', padding: '0 16px',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              borderRight: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{
                fontSize: 56, color: RED,
                opacity: arrowOp,
              }}>→</div>
            </div>

            {/* 目標価格 */}
            <div style={{ flex: 1, textAlign: 'center', paddingLeft: 20 }}>
              <div style={{
                fontFamily: FONT, fontSize: 38, fontWeight: 600,
                color: 'rgba(255,255,255,0.45)', marginBottom: 10,
              }}>
                目标价格
              </div>
              <div style={{ fontFamily: MONO, fontSize: 72, fontWeight: 700, color: RED }}>
                {featuredTargetPrice || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* ── 上昇率バッジ（超大字） ── */}
        <div style={{
          transform: `scale(${pctScale})`, opacity: pctOp,
          background: 'rgba(6,9,22,0.80)',
          border: `1.5px solid rgba(245,200,66,0.50)`,
          backdropFilter: 'blur(14px)',
          borderRadius: 24, padding: '32px 0', width: '100%',
          textAlign: 'center',
          boxShadow: `0 6px 36px rgba(245,200,66,0.18), 0 0 ${glowSize}px rgba(245,200,66,0.12)`,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 36, fontWeight: 600,
            color: 'rgba(255,255,255,0.50)', marginBottom: 8,
          }}>
            预计上涨率
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 120, fontWeight: 900, lineHeight: 1,
            color: GOLD,
            textShadow: `0 0 48px ${GOLD}66`,
          }}>
            ▲ {displayPct}
          </div>
        </div>

      </AbsoluteFill>

      <JpTelop
        badge="主推銘柄"
        name={`${featuredCurrentPrice || ''}　→　${featuredTargetPrice || ''}　▲${featuredPct || ''}`}
        accent={RED}
        frame={frame}
      />
    </AbsoluteFill>
  );
};
