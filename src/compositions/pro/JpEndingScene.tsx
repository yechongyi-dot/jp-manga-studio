import React from 'react';
import { AbsoluteFill, interpolate, spring, useVideoConfig } from 'remotion';
import type { JpTheme } from './jpTheme';

/**
 * JpEndingScene — 通用结尾画面（传 theme）。浅色渐变 + LINE 徽章 + QR + 订阅引导。
 */

interface Props {
  lineId:            string;
  qrDataUrl?:        string;
  frame:             number;
  durationInFrames?: number;
  theme:             JpTheme;
}

const FONT = "'Noto Sans JP','Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";
const MONO = "'Roboto Mono','SF Mono','Consolas',monospace";
const LINE_GREEN   = '#06C755';
const LINE_ON = '#FFFFFF';

export const JpEndingScene: React.FC<Props> = ({ lineId, qrDataUrl, frame, durationInFrames = 90, theme }) => {
  const { fps } = useVideoConfig();
  const { accent, ink, inkDim, endingGrad } = theme;

  const bgOp    = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY  = spring({ frame, fps, config: { damping: 16, stiffness: 220 }, from: -60, to: 0 });
  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cardScale = spring({ frame: Math.max(0, frame - 12), fps, config: { damping: 13, stiffness: 280 }, from: 0.7, to: 1 });
  const cardOp = interpolate(frame, [12, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const btnY  = spring({ frame: Math.max(0, frame - 28), fps, config: { damping: 18, stiffness: 250 }, from: 50, to: 0 });
  const btnOp = interpolate(frame, [28, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const subOp = interpolate(frame, [44, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glow = 14 + 6 * Math.sin(frame * 0.16);

  return (
    <AbsoluteFill style={{ opacity: bgOp, zIndex: 200 }}>
      <div style={{ position: 'absolute', inset: 0, background: endingGrad }} />
      <div style={{ position: 'absolute', top: -120, right: -90, width: 520, height: 520, background: `radial-gradient(circle, ${accent}1A 0%, transparent 65%)` }} />
      <div style={{ position: 'absolute', bottom: -80, left: -70, width: 440, height: 440, background: 'radial-gradient(circle, rgba(6,199,85,0.10) 0%, transparent 65%)' }} />

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingLeft: 52, paddingRight: 52 }}>
        <div style={{ opacity: titleOp, marginBottom: 22 }}>
          <span style={{ fontFamily: FONT, fontSize: 36, fontWeight: 800, color: accent, letterSpacing: '2px', background: 'rgba(255,255,255,0.7)', border: `1px solid ${accent}33`, borderRadius: 50, padding: '10px 30px' }}>
            毎日更新 · チャンネル登録必須
          </span>
        </div>

        <div style={{ transform: `translateY(${titleY}px)`, opacity: titleOp, marginBottom: 46, textAlign: 'center' }}>
          <span style={{ fontFamily: FONT, fontSize: 81, fontWeight: 900, color: ink, lineHeight: 1.25, letterSpacing: '-1px' }}>
            明日もこの時間に<br />会いましょう
          </span>
        </div>

        <div style={{ transform: `scale(${cardScale})`, opacity: cardOp, marginBottom: 40, width: '100%' }}>
          <div style={{
            background: `linear-gradient(135deg, #34D976, ${LINE_GREEN} 50%, #04A14E)`,
            borderRadius: 28, padding: '30px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            boxShadow: `0 12px 44px rgba(6,199,85,0.40), 0 0 ${glow}px rgba(6,199,85,0.25)`,
          }}>
            <div style={{ fontFamily: FONT, fontSize: 31, fontWeight: 800, color: 'rgba(255,255,255,0.8)', letterSpacing: '1px' }}>LINE公式アカウント</div>
            <div style={{ fontFamily: MONO, fontSize: 70, fontWeight: 900, color: LINE_ON, letterSpacing: '2px' }}>{lineId}</div>
            <div style={{ fontFamily: FONT, fontSize: 35, fontWeight: 900, color: LINE_ON, lineHeight: 1.32, textAlign: 'center', marginTop: 2 }}>
              <span style={{ color: '#FFFFFF' }}>友だち追加</span>で<br /><span style={{ color: '#FFFFFF' }}>注目銘柄リスト</span> を <span style={{ color: '#FFFFFF' }}>無料</span>プレゼント
            </div>
            {qrDataUrl && (
              <div style={{ marginTop: 12, width: 320, height: 320, background: '#fff', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 28px rgba(0,0,0,0.22)' }}>
                <img src={qrDataUrl} alt="LINE QR" style={{ width: 290, height: 290, display: 'block', imageRendering: 'pixelated' }} />
              </div>
            )}
            {qrDataUrl && <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 800, color: 'rgba(255,255,255,0.74)' }}>QRをスキャンして友だち追加</div>}
          </div>
        </div>

        <div style={{ transform: `translateY(${btnY}px)`, opacity: btnOp, display: 'flex', gap: 16, marginBottom: 32 }}>
          {[{ icon: '👍', label: '高評価' }, { icon: '🔔', label: 'チャンネル登録' }, { icon: '📤', label: 'シェア' }].map(({ icon, label }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.85)', border: `1px solid ${accent}22`, borderRadius: 50, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 9, boxShadow: '0 4px 18px rgba(40,72,130,0.10)' }}>
              <span style={{ fontSize: 34 }}>{icon}</span>
              <span style={{ fontFamily: FONT, fontSize: 31, color: ink, fontWeight: 700 }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ opacity: subOp }}>
          <span style={{ fontFamily: FONT, fontSize: 35, fontWeight: 600, color: inkDim }}>ご視聴ありがとうございました 🙏</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
