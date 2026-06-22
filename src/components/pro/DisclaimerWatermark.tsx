import React from 'react';

/**
 * DisclaimerWatermark — 免责水印「投資判断は自己責任で」
 * 5 套模板通用的常驻角标层，半透明小字，按模板色调（dark/light）适配。
 * 默认右上角紧贴顶部跑马灯下沿，避让字幕(y≈1460)与底部 CTA。
 */

interface Props {
  tone?:     'dark' | 'light';
  position?: 'tr' | 'br' | 'bl' | 'tl';
}

const FONT = "'Noto Sans JP','Yu Gothic',sans-serif";

const POS: Record<NonNullable<Props['position']>, React.CSSProperties> = {
  tr: { top: 112, right: 16 },
  tl: { top: 112, left: 16 },
  br: { bottom: 196, right: 16 },
  bl: { bottom: 196, left: 16 },
};

export const DisclaimerWatermark: React.FC<Props> = ({ tone = 'dark', position = 'tr' }) => {
  const dark = tone === 'dark';
  return (
    <div style={{
      position: 'absolute',
      ...POS[position],
      zIndex: 250,
      padding: '4px 13px',
      borderRadius: 7,
      background: dark ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.42)',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
      backdropFilter: 'blur(4px)',
      pointerEvents: 'none',
    }}>
      <span style={{
        fontFamily: FONT, fontSize: 19, fontWeight: 600, letterSpacing: '0.5px',
        color: dark ? 'rgba(255,255,255,0.52)' : 'rgba(0,0,0,0.48)',
      }}>
        投資判断は自己責任で
      </span>
    </div>
  );
};
