import React from 'react';
import {
  AbsoluteFill, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import type { JpTheme } from './jpTheme';

/**
 * JpCtaScene — 通用 CTA 场景（传 theme）。浅色卡 + LINE 绿徽章引流。
 */

interface Props {
  lineId?:     string;
  ctaText?:    string;
  globalFrame: number;
  seed?:       number;
  theme:       JpTheme;
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const FONT  = "'Noto Sans JP','Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";
const MONO  = "'Roboto Mono','SF Mono','Consolas',monospace";
const LINE_GREEN   = '#06C755';
const LINE_ON = '#FFFFFF';

export const JpCtaScene: React.FC<Props> = ({ lineId, ctaText, globalFrame, seed, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { ink, cardGrad, cardShadow, accent, Bg } = theme;

  const msgOp = interpolate(frame, [10, 26], [0, 1], clamp);
  const msgY  = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 18, stiffness: 230 }, from: 50, to: 0 });
  const kkOp    = interpolate(frame, [26, 42], [0, 1], clamp);
  const kkScale = spring({ frame: Math.max(0, frame - 26), fps, config: { damping: 10, stiffness: 320 }, from: 0.5, to: 1 });
  const btnOp = interpolate(frame, [44, 58], [0, 1], clamp);
  const btnY  = spring({ frame: Math.max(0, frame - 44), fps, config: { damping: 18, stiffness: 220 }, from: 34, to: 0 });
  const thxOp = interpolate(frame, [58, 72], [0, 1], clamp);
  const glow  = 12 + 6 * Math.sin(frame * 0.18);

  const text = ctaText || 'これからも最新の日本株式市場の情報を毎日お届けします。\nチャンネル登録とフォローでお見逃しなく!';
  const card: React.CSSProperties = { background: cardGrad, boxShadow: cardShadow, backdropFilter: 'blur(3px)' };

  return (
    <AbsoluteFill>
      <Bg frame={globalFrame} trend="up" overlay={0.44} seed={seed} />

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        paddingLeft: 52, paddingRight: 52, paddingBottom: 280,
      }}>
        <div style={{
          transform: `translateY(${msgY}px)`, opacity: msgOp, marginBottom: 44,
          ...card, border: `1px solid ${accent}22`, borderRadius: 22, padding: '34px 40px', textAlign: 'center',
        }}>
          {text.split('\n').map((line, i) => (
            <p key={i} style={{ fontFamily: FONT, fontSize: 43, fontWeight: 700, color: ink, lineHeight: 1.6, margin: i > 0 ? '10px 0 0' : 0 }}>{line}</p>
          ))}
        </div>

        {lineId && (
          <div style={{ transform: `scale(${kkScale})`, opacity: kkOp, marginBottom: 44 }}>
            <div style={{
              background: `linear-gradient(135deg, #34D976, ${LINE_GREEN} 50%, #04A14E)`,
              borderRadius: 24, padding: '26px 56px', textAlign: 'center',
              boxShadow: `0 10px 40px rgba(6,199,85,0.40), 0 0 ${glow}px rgba(6,199,85,0.3)`,
            }}>
              <div style={{ fontFamily: FONT, fontSize: 31, fontWeight: 800, color: 'rgba(255,255,255,0.78)', marginBottom: 10, letterSpacing: '1px' }}>LINE公式アカウント</div>
              <div style={{ fontFamily: MONO, fontSize: 65, fontWeight: 900, color: LINE_ON, letterSpacing: '2px' }}>{lineId}</div>
            </div>
          </div>
        )}

        <div style={{ transform: `translateY(${btnY}px)`, opacity: btnOp, display: 'flex', gap: 16, marginBottom: 36 }}>
          {[{ icon: '👍', label: '高評価' }, { icon: '🔔', label: 'チャンネル登録' }, { icon: '📤', label: 'シェア' }].map(({ icon, label }) => (
            <div key={label} style={{ ...card, border: `1px solid ${accent}22`, borderRadius: 50, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 34 }}>{icon}</span>
              <span style={{ fontFamily: FONT, fontSize: 31, color: ink, fontWeight: 700 }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ opacity: thxOp }}>
          <span style={{ ...card, border: `1px solid ${accent}1A`, fontFamily: FONT, fontSize: 35, fontWeight: 600, color: theme.inkDim, borderRadius: 50, padding: '13px 40px', display: 'inline-block' }}>
            ご視聴ありがとうございました 🙏
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
