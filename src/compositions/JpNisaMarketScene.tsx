import React from 'react';
import {
  AbsoluteFill, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { JpBg } from '../components/JpBg';
import { JpTelop } from '../components/JpTelop';

interface Props {
  marketContext: string;
  globalFrame:   number;
  seed?:         number;
  noBg?:         boolean;
  topPad?:       number;  // 上部セーフエリア（Overlay 版で楽天資産数字に被らないよう下げる）
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const FONT  = "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif";

export const JpNisaMarketScene: React.FC<Props> = ({ marketContext, globalFrame, seed, noBg, topPad = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeOp    = interpolate(frame, [0, 12], [0, 1], clamp);
  const badgeY     = spring({ frame, fps, config: { damping: 18, stiffness: 280 }, from: -50, to: 0 });

  const dividerW   = interpolate(frame, [10, 30], [0, 1], clamp);

  const lines = marketContext.split('\n').filter(Boolean);
  // 文字数に応じてフォントを自適応（長文でも枠が肥大化して上部の資産数字に被らないように）
  const totalChars = marketContext.replace(/\s/g, '').length;
  const bodyFont  = totalChars > 100 ? 34 : totalChars > 70 ? 40 : 46;
  const firstFont = totalChars > 100 ? 42 : totalChars > 70 ? 48 : 52;

  return (
    <AbsoluteFill>
      {!noBg && <JpBg frame={globalFrame} trend="up" overlay={0.20} seed={seed} />}

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingLeft: 56, paddingRight: 56,
        paddingTop: topPad, paddingBottom: 280, gap: 0,
      }}>

        {/* ── バッジ ── */}
        <div style={{
          transform: `translateY(${badgeY}px)`, opacity: badgeOp,
          marginBottom: 36,
          display: 'inline-flex', alignItems: 'center', gap: 12,
          background: 'rgba(14,165,233,0.14)',
          border: '1.5px solid rgba(14,165,233,0.45)',
          borderRadius: 60, padding: '10px 36px',
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: 5, background: '#0EA5E9',
            opacity: 0.7 + 0.3 * Math.sin(frame * 0.22),
            boxShadow: '0 0 8px #0EA5E9',
          }} />
          <span style={{
            fontFamily: FONT, fontSize: 30, fontWeight: 800,
            color: '#60D8F8', letterSpacing: '2px',
          }}>
            市場背景
          </span>
        </div>

        {/* ── 区切り線 ── */}
        <div style={{
          width: `${dividerW * 60}%`, height: 3, borderRadius: 2,
          background: 'linear-gradient(90deg, transparent, #0EA5E9, transparent)',
          marginBottom: 40,
          boxShadow: '0 0 14px rgba(14,165,233,0.5)',
        }} />

        {/* ── 本文 ── */}
        <div style={{
          background: 'rgba(6,9,22,0.72)',
          border: '1px solid rgba(14,165,233,0.20)',
          backdropFilter: 'blur(14px)',
          borderRadius: 24, padding: '44px 52px',
          boxShadow: '0 4px 28px rgba(0,0,0,0.50)',
          width: '100%',
        }}>
          {lines.map((line, i) => {
            const lineOp = interpolate(frame, [18 + i * 8, 32 + i * 8], [0, 1], clamp);
            const lineY  = interpolate(frame, [18 + i * 8, 32 + i * 8], [20, 0], clamp);
            const isFirst = i === 0;
            return (
              <p key={i} style={{
                fontFamily: FONT,
                fontSize: isFirst ? firstFont : bodyFont,
                fontWeight: isFirst ? 900 : 600,
                color: isFirst ? '#FFFFFF' : 'rgba(255,255,255,0.80)',
                lineHeight: 1.6,
                margin: i > 0 ? '12px 0 0' : 0,
                textShadow: '0 1px 8px rgba(0,0,0,0.6)',
                opacity: lineOp,
                transform: `translateY(${lineY}px)`,
              }}>
                {line}
              </p>
            );
          })}
        </div>

      </AbsoluteFill>

      <JpTelop
        badge="市場動向"
        name="日経平均 分析レポート"
        accent="#0EA5E9"
        frame={frame}
      />
    </AbsoluteFill>
  );
};
