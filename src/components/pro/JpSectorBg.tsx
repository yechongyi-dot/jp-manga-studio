import React, { useMemo } from 'react';

/**
 * JpSectorBg — 「数据洞察·科技紫蓝」专属动态金融背景（浅色）
 * セクターヒートマップ（板块热力矩阵·涨跌色块脉动）+ セクター指数推移 + 関連株フロー。
 * 浅蓝紫科技调，数据洞察感。配板块题材。
 */

interface Props {
  frame:    number;
  trend?:   'up' | 'down' | 'flat';
  overlay?: number;
  seed?:    number;
}

function m32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PURPLE = '#6D4AE0';
const CYAN   = '#1FB6C9';
const UP     = '#E23A2E';
const DOWN   = '#1F6FE0';
const GRID   = 'rgba(80,60,180,0.06)';
const INK    = 'rgba(28,26,58,0.90)';
const TXT    = 'rgba(60,56,108,0.55)';
const PANEL  = 'rgba(80,60,180,0.12)';
const FONT   = "'Noto Sans JP','Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";
const MONO   = "'Roboto Mono','SF Mono','Consolas',monospace";

const W = 1080;

const SECTORS = [
  '半導体・HBM', 'AIデータセンター', '電力機器', '二次電池', '造船',
  '防衛・宇宙', '原発・SMR', 'バイオ', 'ロボット', '自動運転',
  '化粧品', '量子コンピューティング',
];

export const JpSectorBg: React.FC<Props> = ({ frame, overlay = 0, seed }) => {
  const data = useMemo(() => {
    const rng = m32(seed ?? 42);
    const heat = SECTORS.map(() => (rng() * 2 - 0.7) * 6);  // 板块涨跌%
    const curve: number[] = [];
    let v = 100;
    for (let i = 0; i < 36; i++) { v *= 1.01 + (rng() - 0.42) * 0.04; curve.push(v); }
    return { heat, curve };
  }, [seed]);

  const grow = Math.min(1, frame / 30);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: W, height: 1920,
      background: 'radial-gradient(125% 85% at 50% 12%, #FAFAFE 0%, #EEEFFA 52%, #E0E3F5 100%)',
      overflow: 'hidden', fontFamily: FONT,
    }}>
      <svg style={{ position: 'absolute', inset: 0 }} width={W} height={1920}>
        <defs>
          <pattern id="jpSecGrid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M64 0 H0 V64" fill="none" stroke={GRID} strokeWidth={1} />
          </pattern>
        </defs>
        <rect x={0} y={120} width={W} height={1800} fill="url(#jpSecGrid)" />
      </svg>

      {/* ── セクターヒートマップ ─────────────────────────────── */}
      <div style={{ position: 'absolute', top: 134, left: 24, right: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 14 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: INK }}>セクターヒートマップ</span>
          <span style={{ fontSize: 20, color: TXT, fontFamily: MONO }}>SECTOR HEATMAP</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {SECTORS.map((s, i) => {
            const v = data.heat[i];
            const up = v >= 0;
            const intensity = Math.min(0.85, 0.18 + Math.abs(v) / 8);
            const pulse = 0.85 + 0.15 * Math.sin(frame * 0.1 + i);
            const col = up ? UP : DOWN;
            return (
              <div key={i} style={{
                height: 116, borderRadius: 14,
                background: `${col}${Math.round(intensity * pulse * 255).toString(16).padStart(2, '0')}`,
                opacity: grow, padding: '14px 16px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                border: `1px solid ${col}33`,
              }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: intensity > 0.5 ? '#fff' : INK }}>{s}</span>
                <span style={{ fontSize: 30, fontWeight: 900, fontFamily: MONO, color: intensity > 0.5 ? '#fff' : col }}>
                  {up ? '+' : ''}{v.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── セクター指数推移 ─────────────────────────────── */}
      <div style={{ position: 'absolute', top: 768, left: 0, width: W, height: 1, background: PANEL }} />
      <svg style={{ position: 'absolute', top: 0, left: 0 }} width={W} height={1180}>
        <text x={24} y={808} fill={INK} fontSize={26} fontWeight={800}>テーマ指数推移</text>
        <text x={250} y={808} fill={TXT} fontSize={20} fontFamily={MONO}>THEME INDEX</text>
        {(() => {
          const X0 = 60, Y0 = 830, CW = W - 120, CH = 300;
          const maxV = Math.max(...data.curve), minV = Math.min(...data.curve);
          const prog = Math.min(1, Math.max(0, (frame - 20) / 50));
          const n = Math.max(2, Math.floor(data.curve.length * prog));
          const pts = data.curve.slice(0, n).map((p, i) => [X0 + (i / (data.curve.length - 1)) * CW, Y0 + CH - ((p - minV) / (maxV - minV + 1)) * (CH - 20)] as [number, number]);
          return <>
            {[0, 1, 2, 3].map(i => <line key={i} x1={X0} y1={Y0 + (i / 3) * CH} x2={X0 + CW} y2={Y0 + (i / 3) * CH} stroke={GRID} strokeWidth={1} />)}
            {pts.length > 1 && <path d={`M ${pts[0][0]} ${Y0 + CH} ${pts.map(p => `L ${p[0]} ${p[1]}`).join(' ')} L ${pts[pts.length - 1][0]} ${Y0 + CH} Z`} fill="rgba(109,74,224,0.10)" />}
            {pts.length > 1 && <polyline points={pts.map(p => `${p[0]},${p[1]}`).join(' ')} fill="none" stroke={PURPLE} strokeWidth={3.5} />}
            {pts.length > 1 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={8} fill={CYAN} />}
          </>;
        })()}
      </svg>

      {/* ── 底部状态 ─────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 1200, left: 0, width: W, height: 1, background: PANEL }} />
      <div style={{ position: 'absolute', top: 1218, left: 0, width: W, padding: '0 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 34, fontSize: 27, fontFamily: MONO, flexWrap: 'wrap' }}>
          <span style={{ color: TXT }}>主導セクター <span style={{ color: PURPLE, fontWeight: 700 }}>半導体・HBM</span></span>
          <span style={{ color: TXT }}>上昇セクター <span style={{ color: UP, fontWeight: 700 }}>8</span></span>
          <span style={{ color: TXT }}>下落セクター <span style={{ color: DOWN, fontWeight: 700 }}>4</span></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: TXT, fontSize: 22, letterSpacing: '2px' }}>テーマ・セクターインサイト</span>
          <span style={{ color: 'rgba(80,60,180,0.4)', fontSize: 22, fontFamily: MONO }}>SECTOR ROTATION</span>
        </div>
      </div>

      {overlay > 0 && <div style={{ position: 'absolute', inset: 0, background: `rgba(250,250,254,${overlay})`, pointerEvents: 'none' }} />}
    </div>
  );
};
