import React from 'react';

/**
 * JpCornerQr — 全程常驻 LINE QR 角标（左下，字幕条上方、避开右侧平台互动按钮）。
 * LINE 绿标识 + 真 QR + 「友だち追加」提示；描边用各套主色，配色统一、一眼认出 LINE。
 * 有 qrDataUrl 才显示；结尾大 QR 画面（zIndex 200）会盖住它，自然过渡。
 */

interface Props {
  qrDataUrl?: string;
  accent:     string;
  bottom?:    number;   // 距底距离（默认落在字幕上方）
}

const FONT      = "'Noto Sans JP','Yu Gothic',sans-serif";
const LINE_GREEN   = '#06C755';
const LINE_ON = '#FFFFFF';

export const JpCornerQr: React.FC<Props> = ({ qrDataUrl, accent, bottom = 600 }) => {
  if (!qrDataUrl) return null;
  return (
    <div style={{ position: 'absolute', left: 30, bottom, zIndex: 120, width: 268 }}>
      <div style={{
        background: 'rgba(255,255,255,0.97)', borderRadius: 24, border: `3px solid ${accent}`,
        padding: '17px 17px 14px', textAlign: 'center', boxShadow: `0 10px 30px ${accent}44, 0 2px 8px rgba(0,0,0,0.12)`,
      }}>
        <div style={{ fontFamily: FONT, fontSize: 35, fontWeight: 900, color: LINE_ON, background: LINE_GREEN, borderRadius: 10, padding: '5px 0', marginBottom: 12, letterSpacing: '0.5px' }}>LINE</div>
        <img src={qrDataUrl} alt="LINE QR" style={{ width: 207, height: 207, display: 'block', margin: '0 auto', imageRendering: 'pixelated' }} />
        <div style={{ fontFamily: FONT, fontSize: 34, fontWeight: 900, color: accent, marginTop: 11 }}>友だち追加</div>
      </div>
    </div>
  );
};
