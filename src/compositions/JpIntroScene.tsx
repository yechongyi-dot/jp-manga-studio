import React from 'react';
import {
  AbsoluteFill, Audio, Sequence, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { JpBg } from '../components/JpBg';
import { JpTelop } from '../components/JpTelop';
import { SFX_ENABLED, SFX } from '../config/sfx';
import { CURTAIN_END_FRAME } from '../types';

interface Props {
  title:       string;
  stockCount:  number;
  globalFrame: number;
  seed?:       number;
  noBg?:       boolean;
  subtitle?:   string;
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const FONT  = "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif";

export const JpIntroScene: React.FC<Props> = ({ title, stockCount, globalFrame, seed, noBg, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── 片頭カーテン (frame 0 から表示) ────────────────────────────
  // 幕布は frame 32 で opacity=0、CURTAIN_END_FRAME=36 で SubtitleBar が表示開始
  const curtainOp    = interpolate(frame, [0, 12, 22, CURTAIN_END_FRAME - 4], [1, 1, 0.15, 0], clamp);
  const curtainSlideY = interpolate(frame, [20, 34], [0, -120], clamp);
  const sweepW       = interpolate(frame, [0, 14], [0, 1], clamp);
  const flashOp      = interpolate(frame, [0, 4, 14], [0.4, 0.12, 0], clamp);

  const bannerOp = interpolate(frame, [0, 10], [0, 1], clamp);
  const bannerY  = spring({ frame, fps, config: { damping: 20, stiffness: 300 }, from: -60, to: 0 });

  const titleOp = interpolate(frame, [12, 26], [0, 1], clamp);
  const titleY  = spring({ frame: Math.max(0, frame - 12), fps, config: { damping: 16, stiffness: 240 }, from: 70, to: 0 });

  const subOp = interpolate(frame, [28, 42], [0, 1], clamp);
  const subY  = spring({ frame: Math.max(0, frame - 28), fps, config: { damping: 18, stiffness: 220 }, from: 45, to: 0 });

  const badgeOp    = interpolate(frame, [42, 56], [0, 1], clamp);
  const badgeScale = spring({ frame: Math.max(0, frame - 42), fps, config: { damping: 10, stiffness: 340 }, from: 0.4, to: 1 });

  const lineW = interpolate(frame, [55, 75], [0, 1], clamp);

  const pulseOp  = 0.70 + 0.30 * Math.sin(frame * 0.16);
  const glowSize = 8 + 4 * Math.sin(frame * 0.28);

  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <AbsoluteFill>
      {!noBg && <JpBg frame={globalFrame} trend="up" overlay={0.18} seed={seed} />}

      {/* 幕布 SFX（幕布 whoosh 音、curtain.mp3 を public/sfx/ に配置後有効） */}
      {SFX_ENABLED && (
        <Sequence from={0} durationInFrames={45}>
          <Audio src={SFX.curtain} volume={0.75} />
        </Sequence>
      )}

      {/* ── 片頭カーテンカード (frame 0 から表示、32f で消える) ── */}
      {/* 外層は inset:0 固定（translateY なし）→ 底部が露出しない */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 300,
        background: 'rgba(2,6,24,0.98)',
        opacity: curtainOp,
        pointerEvents: 'none',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {/* 青スイープライン */}
        <div style={{
          position: 'absolute', top: '44%', left: 0,
          width: `${sweepW * 100}%`, height: 3,
          background: 'linear-gradient(90deg, rgba(14,165,233,0), #0EA5E9)',
          boxShadow: '0 0 22px rgba(14,165,233,0.9)',
        }} />
        {/* フラッシュ */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(14,165,233,0.12)',
          opacity: flashOp,
        }} />
        {/* テキスト — 内層だけ上スライド */}
        <div style={{
          textAlign: 'center', position: 'relative', zIndex: 1,
          transform: `translateY(${curtainSlideY}px)`,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 34, fontWeight: 600,
            color: 'rgba(255,255,255,0.38)', letterSpacing: '10px', marginBottom: 14,
          }}>
            JAPAN  STOCK
          </div>
          <div style={{
            fontFamily: FONT, fontSize: 130, fontWeight: 900,
            color: '#FFFFFF', letterSpacing: '-2px', lineHeight: 0.88,
            textShadow: '0 0 100px rgba(14,165,233,0.5), 0 8px 50px rgba(0,0,0,0.9)',
          }}>
            速　報
          </div>
          <div style={{
            width: 180, height: 4,
            background: 'linear-gradient(90deg, #0EA5E9, #22D3EE)',
            borderRadius: 2, margin: '22px auto',
            boxShadow: '0 0 20px rgba(14,165,233,0.6)',
          }} />
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            border: '2px solid rgba(14,165,233,0.50)', borderRadius: 50,
            padding: '10px 32px', background: 'rgba(14,165,233,0.10)',
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: 5,
              background: '#0EA5E9',
              opacity: 0.7 + 0.3 * Math.sin(frame * 0.4),
            }} />
            <span style={{
              fontFamily: FONT, fontSize: 26, color: '#60D8F8',
              fontWeight: 800, letterSpacing: '2px',
            }}>
              LIVE　本日の注目銘柄
            </span>
          </div>
        </div>
      </div>

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingLeft: 56, paddingRight: 56,
        paddingBottom: 300,
      }}>
        {/* ── LIVE分析バッジ ── */}
        <div style={{
          transform: `translateY(${bannerY}px)`, opacity: bannerOp,
          marginBottom: 44,
          display: 'flex', alignItems: 'center', gap: 14,
          background: 'rgba(232,57,43,0.18)',
          border: '1.5px solid rgba(232,57,43,0.55)',
          borderRadius: 60, padding: '10px 36px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 28px rgba(232,57,43,0.20)',
        }}>
          <div style={{
            width: 11, height: 11, borderRadius: 6,
            background: '#E8392B',
            boxShadow: `0 0 ${glowSize}px #E8392B`,
            opacity: pulseOp,
          }} />
          <span style={{
            fontFamily: FONT, fontSize: 30, fontWeight: 800,
            color: '#FF6B6B', letterSpacing: '2px',
          }}>
            株式分析レポート
          </span>
          <div style={{
            background: '#E8392B', borderRadius: 4,
            padding: '2px 10px',
            boxShadow: '0 0 10px rgba(232,57,43,0.5)',
          }}>
            <span style={{ fontFamily: FONT, fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: 1 }}>
              LIVE
            </span>
          </div>
        </div>

        {/* ── メインタイトル ── */}
        <div style={{ transform: `translateY(${titleY}px)`, opacity: titleOp, textAlign: 'center', marginBottom: 22 }}>
          <span style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: title.length > 16 ? 66 : title.length > 10 ? 76 : 88,
            color: '#FFFFFF',
            lineHeight: 1.22,
            display: 'block',
            textShadow: '0 2px 18px rgba(0,0,0,0.9), 0 0 40px rgba(232,57,43,0.20)',
            letterSpacing: '-1px',
          }}>
            {title}
          </span>
        </div>

        {/* ── サブタイトル（NISA など任意） ── */}
        {subtitle && (
          <div style={{ transform: `translateY(${subY}px)`, opacity: subOp, textAlign: 'center', marginBottom: 22 }}>
            <span style={{
              fontFamily: FONT, fontSize: 34, fontWeight: 600,
              color: 'rgba(255,255,255,0.75)',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 50, padding: '8px 32px',
            }}>
              {subtitle}
            </span>
          </div>
        )}

        {/* ── 銘柄数バッジ ── */}
        <div style={{ transform: `scale(${badgeScale})`, opacity: badgeOp, marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 0,
            background: '#E8392B',
            borderRadius: 60, overflow: 'hidden',
            boxShadow: '0 6px 36px rgba(232,57,43,0.50)',
          }}>
            <div style={{ padding: '14px 28px' }}>
              <span style={{
                fontFamily: FONT, fontSize: 52, fontWeight: 900,
                color: '#fff', lineHeight: 1,
              }}>
                {stockCount}
              </span>
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.22)', padding: '14px 24px',
              borderLeft: '1px solid rgba(255,255,255,0.25)',
            }}>
              <span style={{ fontFamily: FONT, fontSize: 32, fontWeight: 700, color: '#fff' }}>
                銘柄を解説
              </span>
            </div>
          </div>
        </div>

        {/* ── 日付ピル ── */}
        <div style={{ transform: `translateY(${subY}px)`, opacity: subOp, textAlign: 'center', marginBottom: 44 }}>
          <span style={{
            fontFamily: FONT, fontSize: 26, fontWeight: 500,
            color: 'rgba(255,255,255,0.72)',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 50, padding: '8px 28px',
            backdropFilter: 'blur(8px)',
          }}>
            📅 {today}
          </span>
        </div>

        {/* ── 装飾ライン ── */}
        <div style={{
          width: '78%', height: 3, borderRadius: 2,
          background: 'linear-gradient(90deg, transparent, #E8392B, transparent)',
          transform: `scaleX(${lineW})`,
          transformOrigin: 'center',
          boxShadow: '0 0 12px rgba(232,57,43,0.5)',
        }} />
      </AbsoluteFill>

      {/* ── 底部テロップ ── */}
      <JpTelop
        badge="株式分析"
        name={title}
        accent="#E8392B"
        frame={frame}
      />
    </AbsoluteFill>
  );
};
