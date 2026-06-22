import React from 'react';
import {
  AbsoluteFill, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { JpBg } from '../components/JpBg';
import { JpTelop } from '../components/JpTelop';

interface Props {
  lineId?:     string;
  ctaText?:    string;
  globalFrame: number;
  seed?:       number;
  noBg?:       boolean;
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const FONT  = "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif";

// 暗いガラスカード共通スタイル
const darkCard: React.CSSProperties = {
  background: 'rgba(6,9,22,0.72)',
  border: '1px solid rgba(255,255,255,0.10)',
  backdropFilter: 'blur(14px)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.40)',
};

export const JpCtaScene: React.FC<Props> = ({ lineId, ctaText, globalFrame, seed, noBg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoOp    = interpolate(frame, [0, 14], [0, 1], clamp);
  const logoY     = spring({ frame, fps, config: { damping: 18, stiffness: 280 }, from: -55, to: 0 });

  const msgOp     = interpolate(frame, [14, 28], [0, 1], clamp);
  const msgY      = spring({ frame: Math.max(0, frame - 14), fps, config: { damping: 16, stiffness: 230 }, from: 50, to: 0 });

  const lineOp    = interpolate(frame, [28, 42], [0, 1], clamp);
  const lineScale = spring({ frame: Math.max(0, frame - 28), fps, config: { damping: 10, stiffness: 320 }, from: 0.5, to: 1 });

  const btnOp     = interpolate(frame, [44, 58], [0, 1], clamp);
  const btnY      = spring({ frame: Math.max(0, frame - 44), fps, config: { damping: 18, stiffness: 220 }, from: 35, to: 0 });

  const thanksOp  = interpolate(frame, [58, 72], [0, 1], clamp);

  const pulseOp   = 0.78 + 0.22 * Math.sin(frame * 0.14);
  const glowSize  = 8 + 4 * Math.sin(frame * 0.26);
  const lineGlow  = 10 + 5 * Math.sin(frame * 0.18);

  const defaultCta = `今後も最新の日本株情報を毎日お届けします。\nチャンネル登録・フォローで見逃しなく！`;
  const text = ctaText || defaultCta;

  return (
    <AbsoluteFill>
      {!noBg && <JpBg frame={globalFrame} trend="up" overlay={0.18} seed={seed} />}

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingLeft: 52, paddingRight: 52, gap: 0,
        paddingBottom: 300,
      }}>

        {/* ── CTAメッセージ ── */}
        <div style={{
          transform: `translateY(${msgY}px)`, opacity: msgOp,
          textAlign: 'center', marginBottom: 44,
          ...darkCard,
          borderRadius: 22, padding: '36px 40px',
          boxShadow: '0 4px 28px rgba(0,0,0,0.50)',
        }}>
          {text.split('\n').map((line, i) => (
            <p key={i} style={{
              fontFamily: FONT, fontSize: 32, fontWeight: 600,
              color: 'rgba(255,255,255,0.90)',
              lineHeight: 1.65,
              margin: i > 0 ? '8px 0 0' : 0,
              textShadow: '0 1px 8px rgba(0,0,0,0.6)',
            }}>
              {line}
            </p>
          ))}
        </div>

        {/* ── LINE IDバッジ ── */}
        {lineId && (
          <div style={{
            transform: `scale(${lineScale})`, opacity: lineOp,
            marginBottom: 44,
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #00C300, #009900)',
              borderRadius: 22, padding: '28px 60px',
              boxShadow: `0 6px 36px rgba(0,195,0,0.38), 0 0 ${lineGlow}px rgba(0,195,0,0.22)`,
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: FONT, fontSize: 22, fontWeight: 600,
                color: 'rgba(255,255,255,0.82)', marginBottom: 8,
              }}>
                LINE公式アカウント
              </div>
              <div style={{
                fontFamily: 'monospace', fontSize: 46, fontWeight: 900,
                color: '#FFFFFF', letterSpacing: '2px',
                textShadow: '0 2px 12px rgba(0,0,0,0.4)',
              }}>
                {lineId}
              </div>
            </div>
          </div>
        )}

        {/* ── アクションボタン ── */}
        <div style={{
          transform: `translateY(${btnY}px)`, opacity: btnOp,
          display: 'flex', gap: 14, marginBottom: 36,
        }}>
          {[
            { icon: '👍', label: 'いいね' },
            { icon: '🔔', label: 'チャンネル登録' },
            { icon: '📤', label: 'シェア' },
          ].map(({ icon, label }) => (
            <div key={label} style={{
              ...darkCard,
              border: '1.5px solid rgba(232,57,43,0.35)',
              borderRadius: 50, padding: '12px 22px',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 2px 14px rgba(0,0,0,0.35), 0 0 8px rgba(232,57,43,0.10)',
            }}>
              <span style={{ fontSize: 24 }}>{icon}</span>
              <span style={{ fontFamily: FONT, fontSize: 22, color: 'rgba(255,255,255,0.88)', fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* ── 感謝メッセージ ── */}
        <div style={{ opacity: thanksOp }}>
          <div style={{
            ...darkCard,
            borderRadius: 50, padding: '12px 36px',
          }}>
            <span style={{
              fontFamily: FONT, fontSize: 26, fontWeight: 500,
              color: 'rgba(255,255,255,0.60)',
            }}>
              ご視聴ありがとうございました 🙏
            </span>
          </div>
        </div>

      </AbsoluteFill>

      {/* ── 底部テロップ ── */}
      <JpTelop
        badge="無料配信中"
        name={lineId ? `LINE  ${lineId}` : '日本株情報'}
        sub="毎日株式情報をお届け"
        accent="#E8392B"
        frame={frame}
      />
    </AbsoluteFill>
  );
};
