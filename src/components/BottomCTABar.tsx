import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import { TICKER_H } from './TickerStrip';

interface Props {
  lineId:   string;
  ctaText?: string;
  frame:    number;
  bottom?:  number; // 保留兼容，不再使用
}

const FONT   = "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif";
const MONO   = "'Roboto Mono','SF Mono',monospace";
const LINE_G = '#06C755';

export const BAR_H = 150;

// 5秒表示 / 5秒非表示サイクル（30fps基準）
const CYCLE = 300;
const SHOW  = 150;
const ENTER = 24;
const EXIT  = SHOW - 22;

const LineIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 60 60" style={{ display: 'block', flexShrink: 0 }}>
    {/* 緑背景 */}
    <rect width="60" height="60" rx="13" fill={LINE_G} />
    {/* 白い吹き出し本体 */}
    <rect x="7" y="11" width="46" height="27" rx="7" fill="white" />
    {/* 吹き出しの尻尾（右下） */}
    <polygon points="37,37 31,50 47,39" fill="white" />
    {/* LINE テキスト（緑） */}
    <text
      x="30" y="31"
      textAnchor="middle"
      fontFamily="'Arial Black','Helvetica Neue',sans-serif"
      fontWeight="900"
      fontSize="14"
      letterSpacing="1.5"
      fill={LINE_G}
    >LINE</text>
  </svg>
);

export const BottomCTABar: React.FC<Props> = ({ lineId, frame }) => {
  const { fps } = useVideoConfig();
  const cf = frame % CYCLE;

  // ── 縦方向オフセット（TickerStripの裏から滑り出す） ──
  let offsetY: number;
  let opacity: number;
  let scale: number;

  if (cf < ENTER) {
    // 入場：TickerStripの下から春バネでスライドイン
    offsetY = spring({ frame: cf, fps, config: { damping: 14, stiffness: 200 }, from: -(BAR_H + 12), to: 0 });
    opacity = interpolate(cf, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
    scale   = spring({ frame: cf, fps, config: { damping: 18, stiffness: 260 }, from: 0.94, to: 1 });
  } else if (cf < EXIT) {
    // 表示中
    offsetY = 0;
    opacity = 1;
    scale   = 1;
  } else if (cf < SHOW) {
    // 退場：上にスライドアウト
    offsetY = interpolate(cf, [EXIT, SHOW], [0, -(BAR_H + 12)], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    opacity = interpolate(cf, [EXIT, SHOW], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    scale   = 1;
  } else {
    // 非表示
    offsetY = -(BAR_H + 12);
    opacity = 0;
    scale   = 1;
  }

  // グリーングロー脈動
  const glowOp = 0.55 + 0.45 * Math.sin(frame * 0.20);
  const glowSz = 20 + 8 * glowOp;

  // シマーライン
  const shimX = (frame * 3.0) % 1400 - 200;

  // 矢印点滅
  const arrowOp = 0.5 + 0.5 * Math.sin(frame * 0.30);

  return (
    <div style={{
      position: 'absolute',
      top: TICKER_H,
      left: 0,
      width: 1080,
      height: BAR_H,
      transform: `translateY(${offsetY}px) scaleY(${scale})`,
      transformOrigin: 'top center',
      opacity,
      zIndex: 95,
    }}>

      {/* ベース（shimmerをここでクリップ） */}
      <div style={{
        position: 'absolute', inset: 0,
        overflow: 'hidden',
        background: 'linear-gradient(90deg, #021408 0%, #04200F 40%, #062816 60%, #021408 100%)',
        boxShadow: `0 6px 48px rgba(6,199,85,0.45), 0 2px 0 rgba(6,199,85,0.30) inset`,
      }} />

      {/* 上端アクセントライン */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent 0%, ${LINE_G} 20%, #0FFF70 50%, ${LINE_G} 80%, transparent 100%)`,
      }} />

      {/* シマー */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `linear-gradient(108deg,
          transparent ${shimX - 100}px,
          rgba(255,255,255,0.035) ${shimX}px,
          transparent ${shimX + 100}px)`,
      }} />

      {/* コンテンツ — absolute で位置を直接制御 */}
      <div style={{ position: 'absolute', inset: 0 }}>

        {/* LEFT: 引導文字 */}
        <div style={{
          position: 'absolute', left: 36, top: 0, bottom: 0, width: 580,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
        }}>
          {/* ラベル — 呼吸パルス */}
          <span style={{
            fontFamily: FONT, fontSize: 40, fontWeight: 700,
            color: `rgba(255,255,255,${0.45 + 0.25 * Math.sin(cf * 0.18)})`,
            letterSpacing: '1px', lineHeight: 1,
            whiteSpace: 'nowrap',
          }}>
            今すぐ無料で登録
          </span>

          {/* メインテキスト — 金色シマースイープ */}
          <span style={{
            fontFamily: FONT, fontSize: 56, fontWeight: 900,
            letterSpacing: '0.5px', lineHeight: 1.1,
            whiteSpace: 'nowrap',
            display: 'inline-block',
            backgroundImage: (() => {
              const sx = (cf * 10) % 960 - 200;
              return `linear-gradient(90deg,
                #FFFFFF 0px,
                #FFFFFF ${sx - 80}px,
                #FFE566 ${sx}px,
                #FFFFFF ${sx + 80}px,
                #FFFFFF 760px
              )`;
            })(),
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            株情報をLINEで受取る
          </span>
        </div>

        {/* 装飾縦線 */}
        <div style={{
          position: 'absolute', left: 636, top: 16, bottom: 16, width: 2,
          background: 'linear-gradient(180deg, transparent, rgba(6,199,85,0.65) 30%, rgba(6,199,85,0.65) 70%, transparent)',
        }} />

        {/* LINE ID */}
        <div style={{
          position: 'absolute', left: 656, top: 0, bottom: 0,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <LineIcon size={62} />
          <span style={{
            fontFamily: MONO, fontSize: 62, fontWeight: 900,
            letterSpacing: '2px', lineHeight: 1,
            display: 'inline-block',
            backgroundImage: (() => {
              const sx = (cf * 9 + 80) % 680 - 120;
              return `linear-gradient(90deg,
                #FFFFFF 0px,
                #FFFFFF ${sx - 60}px,
                #0FFF70 ${sx}px,
                #FFFFFF ${sx + 60}px,
                #FFFFFF 560px
              )`;
            })(),
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: `drop-shadow(0 0 ${glowSz * 0.6}px rgba(6,199,85,${0.7 * glowOp}))`,
          }}>
            {lineId}
          </span>
        </div>

      </div>
    </div>
  );
};
