import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import { TICKER_H } from './JpTicker';

/**
 * JpTopCtaBar — 顶部引流 CTA 条（跑马灯下方），浅色高级版，5 套传配色复用。
 * 周期显隐：白底高级条 + 顶部 accent 细线 + LINE 绿图标 + 引流文案（ID 并入）+ 追加 pill。
 * 布局抗溢出：文案区 flex + minWidth0 + ellipsis 兜底，追加 pill 永不被挤走。
 */

interface Props {
  lineId:  string;
  frame:   number;
  accent?: string;   // 该套主题强调色
}

const FONT  = "'Noto Sans JP','Yu Gothic',sans-serif";
const LINE_GREEN   = '#06C755';
const LINE_ON = '#FFFFFF';

export const TOPCTA_H = 153;

const CYCLE = 300, SHOW = 168, ENTER = 24, EXIT = SHOW - 22;

// LINE 公式アイコン：緑の角丸方块 + 白い吹き出し（左下に尾）+ 緑の「LINE」字
const LineIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 60 60" style={{ display: 'block', flexShrink: 0 }}>
    <rect width="60" height="60" rx="16" fill={LINE_GREEN} />
    <ellipse cx="30" cy="27.5" rx="22" ry="17" fill={LINE_ON} />
    <polygon points="18,40 13.5,52.5 30,42" fill={LINE_ON} />
    <text x="30" y="32" textAnchor="middle" fontFamily="'Trebuchet MS','Helvetica Neue',sans-serif" fontWeight="700" fontSize="13" fill={LINE_GREEN} letterSpacing="0.3">LINE</text>
  </svg>
);

export const JpTopCtaBar: React.FC<Props> = ({ lineId, frame, accent = '#3B5BDB' }) => {
  const { fps } = useVideoConfig();
  const cf = frame % CYCLE;

  let offsetY: number, opacity: number;
  if (cf < ENTER) {
    offsetY = spring({ frame: cf, fps, config: { damping: 15, stiffness: 200 }, from: -(TOPCTA_H + 14), to: 0 });
    opacity = interpolate(cf, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  } else if (cf < EXIT) {
    offsetY = 0; opacity = 1;
  } else if (cf < SHOW) {
    offsetY = interpolate(cf, [EXIT, SHOW], [0, -(TOPCTA_H + 14)], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    opacity = interpolate(cf, [EXIT, SHOW], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  } else {
    offsetY = -(TOPCTA_H + 14); opacity = 0;
  }

  const pulse = 0.6 + 0.4 * Math.sin(frame * 0.2);
  const shimX = (frame * 4) % 1300 - 200;

  return (
    <div style={{
      position: 'absolute', top: TICKER_H, left: 0, width: 1080, height: TOPCTA_H,
      transform: `translateY(${offsetY}px)`, opacity, zIndex: 95,
    }}>
      {/* 浅色高级底 */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        background: `linear-gradient(120deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.34) 100%), ${accent}`,
        boxShadow: `0 8px 30px ${accent}66`,
      }}>
        {/* 微光扫过 */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `linear-gradient(105deg, transparent ${shimX - 90}px, rgba(255,255,255,0.22) ${shimX}px, transparent ${shimX + 90}px)`,
        }} />
      </div>
      {/* 顶部 accent 细线 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${LINE_GREEN} 35%, #FFFFFF 50%, ${LINE_GREEN} 65%, transparent)` }} />

      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 20 }}>
        {/* LINE 图标 */}
        <LineIcon size={84} />

        {/* 引流文案（ID 并入主文案；minWidth0 + ellipsis 防横向溢出）*/}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <span style={{
            fontFamily: FONT, fontSize: 33, fontWeight: 700, color: 'rgba(255,255,255,0.92)', letterSpacing: '0.3px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            <span style={{ color: '#FFFFFF', fontWeight: 900 }}>友だち追加</span>で <span style={{ color: '#FFFFFF', fontWeight: 900 }}>注目銘柄リスト</span> を無料配布
          </span>
          <span style={{
            fontFamily: FONT, fontSize: 50, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.08,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 8px rgba(0,0,0,0.20)',
          }}>
            LINE <span style={{ color: '#FFFFFF' }}>{lineId}</span>
          </span>
        </div>

        {/* 追加 pill（flexShrink0，永不被挤走）*/}
        <div style={{
          flexShrink: 0, padding: '16px 32px', borderRadius: 46,
          background: LINE_GREEN, boxShadow: `0 5px 20px rgba(6,199,85,${0.32 + 0.22 * pulse})`,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontFamily: FONT, fontSize: 42, fontWeight: 900, color: LINE_ON, lineHeight: 1 }}>+ 追加</span>
        </div>
      </div>
    </div>
  );
};
