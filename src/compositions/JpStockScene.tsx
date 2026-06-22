import React from 'react';
import {
  AbsoluteFill, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { JpBg } from '../components/JpBg';
import type { JpStockItem } from '../types';
import { pctColor, pctTrend } from '../types';

interface Props {
  item:        JpStockItem;
  index:       number;
  globalFrame: number;
  seed?:       number;
  noBg?:       boolean;
  topPad?:     number;
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const FONT  = "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif";
const MONO  = "'Consolas','SF Mono',monospace";

// 暗いガラスカード共通スタイル
const darkCard = (accent?: string): React.CSSProperties => ({
  background: 'rgba(6,9,22,0.72)',
  border: `1px solid ${accent ? accent + '30' : 'rgba(255,255,255,0.10)'}`,
  backdropFilter: 'blur(14px)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.40)',
});

export const JpStockScene: React.FC<Props> = ({ item, index, globalFrame, seed, noBg, topPad = 320 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 神秘株判定（name が空 = 圧軸神秘株）
  const isMystery = item.name === '';

  // ── 入場アニメーション ──────────────────────────────────────
  const headerOp = interpolate(frame, [0,  14], [0, 1], clamp);
  const headerY  = spring({ frame, fps, config: { damping: 20, stiffness: 300 }, from: -55, to: 0 });

  const nameOp   = interpolate(frame, [10, 24], [0, 1], clamp);
  const nameX    = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 16, stiffness: 240 }, from: -70, to: 0 });

  const priceOp  = interpolate(frame, [20, 34], [0, 1], clamp);
  const priceY   = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 18, stiffness: 220 }, from: 40, to: 0 });

  const pctOp    = interpolate(frame, [32, 46], [0, 1], clamp);
  const pctScale = spring({ frame: Math.max(0, frame - 32), fps, config: { damping: 10, stiffness: 350 }, from: 0.3, to: 1 });

  const barW     = interpolate(frame, [40, 70], [0, 1], clamp);

  // ── 数値カウンター ──────────────────────────────────────────
  const rawPct = parseFloat(item.pct.replace(/[^0-9.\-]/g, ''));
  const countedPct = interpolate(frame, [32, 64], [0, rawPct], clamp);
  const displayPct = frame < 64
    ? (rawPct >= 0 ? '+' : '') + countedPct.toFixed(1) + '%'
    : item.pct;

  // ── カラー / 方向 ──────────────────────────────────────────
  const accent  = isMystery ? '#7C3AED' : pctColor(item.pct);
  const trend   = pctTrend(item.pct);
  const isUp    = !item.pct.startsWith('-');
  const arrow   = isUp ? '▲' : '▼';

  // ── シャインスイープ ────────────────────────────────────────
  const shineX = interpolate(frame, [38, 60], [-200, 1400], clamp);
  const shinOp = interpolate(frame, [38, 45, 60, 65], [0, 0.40, 0.40, 0], clamp);

  return (
    <AbsoluteFill>
      {!noBg && <JpBg frame={globalFrame} trend={trend} overlay={0.18} seed={seed} />}

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'stretch',
        paddingLeft: 44, paddingRight: 44,
        paddingTop: topPad, paddingBottom: 300,
      }}>

        {/* ── ヘッダー: 番号 + コード + 進捗ドット ── */}
        <div style={{
          transform: `translateY(${headerY}px)`, opacity: headerOp,
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22,
        }}>
          {/* 番号バッジ / 神秘株は「？」 */}
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 24px ${accent}66`,
          }}>
            <span style={{ fontFamily: MONO, fontWeight: 900, fontSize: isMystery ? 36 : 30, color: '#fff' }}>
              {isMystery ? '？' : index + 1}
            </span>
          </div>

          {/* 銘柄コード / 神秘株は「？？？？」 */}
          <div style={{
            ...darkCard(accent),
            borderRadius: 12, padding: '5px 18px',
          }}>
            <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', letterSpacing: '3px' }}>
              {isMystery ? '？？？？' : item.code}
            </span>
          </div>

        </div>

        {/* ── 銘柄名 ── */}
        <div style={{
          transform: `translateX(${nameX}px)`, opacity: nameOp,
          marginBottom: 24, overflow: 'hidden',
        }}>
          <span style={{
            fontFamily: FONT, fontWeight: 900,
            fontSize: item.name.length > 10 ? 62 : item.name.length > 6 ? 72 : 82,
            color: '#FFFFFF',
            textShadow: '0 2px 16px rgba(0,0,0,0.95), 0 0 32px rgba(0,0,0,0.5)',
            lineHeight: 1.18,
            display: 'block',
          }}>
            {item.name}
          </span>
          <div style={{
            width: 80, height: 4, borderRadius: 2,
            background: accent, marginTop: 8,
            opacity: nameOp,
            boxShadow: `0 0 12px ${accent}88`,
          }} />
        </div>

        {/* ── 価格カード（ダークガラス） ── */}
        <div style={{
          transform: `translateY(${priceY}px)`, opacity: priceOp,
          ...darkCard(accent),
          borderRadius: 22, padding: '40px 36px',
          marginBottom: 22,
          overflow: 'hidden', position: 'relative',
        }}>
          {/* シャインエフェクト */}
          <div style={{
            position: 'absolute', top: 0,
            left: shineX, width: 120, height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
            opacity: shinOp, pointerEvents: 'none', transform: 'skewX(-20deg)',
          }} />

          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
            {/* 買値 */}
            <div style={{ flex: 1, textAlign: 'center', paddingRight: 20 }}>
              <div style={{
                fontFamily: FONT, fontSize: 40, fontWeight: 600,
                color: 'rgba(255,255,255,0.45)', marginBottom: 10,
              }}>買値</div>
              <div style={{ fontFamily: MONO, fontSize: 68, fontWeight: 700, color: '#FFFFFF' }}>
                {item.buyPrice}
              </div>
            </div>

            {/* 矢印 */}
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '0 16px',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              borderRight: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{
                fontSize: 56, color: accent,
                opacity: 0.8 + 0.2 * Math.sin(frame * 0.12),
              }}>→</div>
            </div>

            {/* 目標値 */}
            <div style={{ flex: 1, textAlign: 'center', paddingLeft: 20 }}>
              <div style={{
                fontFamily: FONT, fontSize: 40, fontWeight: 600,
                color: 'rgba(255,255,255,0.45)', marginBottom: 10,
              }}>
                {item.shortTarget ? '短期目標' : '目標価格'}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 68, fontWeight: 700, color: accent }}>
                {item.shortTarget || item.targetPrice || '—'}
              </div>
            </div>
          </div>

          {/* 最終目標 */}
          {item.finalTarget && (
            <div style={{
              marginTop: 12, paddingTop: 12,
              borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontFamily: FONT, fontSize: 38, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
                最終目標
              </span>
              <span style={{ fontFamily: MONO, fontSize: 60, fontWeight: 800, color: '#E8392B' }}>
                {item.finalTarget}
              </span>
            </div>
          )}
        </div>

        {/* ── 上昇率バッジ + プログレスバー ── */}
        <div style={{
          transform: `scale(${pctScale})`, opacity: pctOp,
          marginBottom: 22, transformOrigin: 'center',
        }}>
          <div style={{
            ...darkCard(accent),
            borderRadius: 20, padding: '30px 0',
            textAlign: 'center', position: 'relative', overflow: 'hidden',
            boxShadow: `0 4px 28px ${accent}28`,
          }}>
            <div style={{
              fontFamily: FONT, fontSize: 38, fontWeight: 600,
              color: 'rgba(255,255,255,0.45)', marginBottom: 8,
            }}>
              目標上昇率
            </div>
            <div style={{
              fontFamily: MONO, fontSize: 110, fontWeight: 900,
              color: accent, lineHeight: 1,
              textShadow: `0 0 36px ${accent}66`,
            }}>
              {arrow} {displayPct}
            </div>
          </div>

          {/* プログレスバー */}
          <div style={{
            height: 8, borderRadius: 4,
            background: 'rgba(255,255,255,0.10)',
            marginTop: 10, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: `linear-gradient(90deg, ${accent}88, ${accent})`,
              width: `${Math.min(100, Math.abs(rawPct) / 2) * barW}%`,
              boxShadow: `0 0 10px ${accent}88`,
            }} />
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: MONO, fontSize: 28, color: 'rgba(255,255,255,0.30)', marginTop: 6,
          }}>
            <span>0%</span><span>50%</span><span>100%+</span>
          </div>
        </div>


      </AbsoluteFill>

    </AbsoluteFill>
  );
};
