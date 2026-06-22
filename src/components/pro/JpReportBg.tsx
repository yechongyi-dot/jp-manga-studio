import React, { useMemo } from 'react';

/**
 * JpReportBg — 「私行理财·薄荷金」专属动态金融背景（浅色）
 * 资产配置环形图（扇区生长+中心总资产）+ 复利成长曲线（绘制上扬）+ 配当フロー柱。
 * 米白薄荷渐变，墨绿+金，稳重高级。配 ISA 组合。
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

const GREEN = '#0E7C5A';
const GOLD  = '#C99A3C';
const NAVY  = '#2A4A7C';
const ROSE  = '#B5567A';
const TEAL  = '#2C9C9C';
const GRID  = 'rgba(30,90,70,0.06)';
const INK   = 'rgba(26,46,38,0.90)';
const TXT   = 'rgba(40,72,60,0.55)';
const PANEL = 'rgba(30,90,70,0.12)';
const FONT  = "'Noto Sans JP','Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";
const MONO  = "'Roboto Mono','SF Mono','Consolas',monospace";

const W = 1080;

// 资产类别（环形扇区）
const ALLOC = [
  { label: '半導体・AI', pct: 28, color: GREEN },
  { label: '二次電池',   pct: 22, color: GOLD  },
  { label: 'バイオ',    pct: 16, color: NAVY  },
  { label: '金融・配当', pct: 18, color: TEAL  },
  { label: '消費・その他', pct: 16, color: ROSE  },
];

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function arcPath(cx: number, cy: number, rO: number, rI: number, a0: number, a1: number): string {
  const [x0o, y0o] = polar(cx, cy, rO, a0);
  const [x1o, y1o] = polar(cx, cy, rO, a1);
  const [x1i, y1i] = polar(cx, cy, rI, a1);
  const [x0i, y0i] = polar(cx, cy, rI, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0o} ${y0o} A ${rO} ${rO} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rI} ${rI} 0 ${large} 0 ${x0i} ${y0i} Z`;
}

export const JpReportBg: React.FC<Props> = ({ frame, overlay = 0, seed }) => {
  const data = useMemo(() => {
    const rng = m32(seed ?? 42);
    // 复利曲线点（上扬）
    const pts: number[] = [];
    let v = 30;
    for (let i = 0; i < 40; i++) { v *= 1.04 + rng() * 0.02; pts.push(v); }
    // 配当柱
    const divs = Array.from({ length: 12 }, () => 0.4 + rng() * 0.6);
    const total = 8000 + Math.floor(rng() * 4000);
    return { pts, divs, total };
  }, [seed]);

  // 环形生长动画
  const grow = Math.min(1, frame / 40);
  const spin = frame * 0.15;
  const cx = 340, cy = 380, rO = 188, rI = 116;

  // 复利曲线绘制
  const curveProg = Math.min(1, Math.max(0, (frame - 20) / 50));
  const maxV = Math.max(...data.pts);
  const CX0 = 60, CY0 = 760, CW = W - 120, CH = 300;
  const curvePts = data.pts.map((p, i) => [CX0 + (i / (data.pts.length - 1)) * CW, CY0 + CH - (p / maxV) * (CH - 20)] as [number, number]);
  const shownCount = Math.max(2, Math.floor(curvePts.length * curveProg));
  const shownPts = curvePts.slice(0, shownCount);

  let accDeg = 0;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: W, height: 1920,
      background: 'radial-gradient(125% 85% at 50% 15%, #FBFDFB 0%, #F0F6F1 52%, #E3EEE6 100%)',
      overflow: 'hidden', fontFamily: FONT,
    }}>
      {/* 细网格 */}
      <svg style={{ position: 'absolute', inset: 0 }} width={W} height={1920}>
        <defs>
          <pattern id="jpRepGrid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M64 0 H0 V64" fill="none" stroke={GRID} strokeWidth={1} />
          </pattern>
        </defs>
        <rect x={0} y={120} width={W} height={1800} fill="url(#jpRepGrid)" />
      </svg>

      {/* ── 資産配分リング ─────────────────────────────── */}
      <svg style={{ position: 'absolute', top: 130, left: 0 }} width={W} height={520}>
        <text x={24} y={36} fill={INK} fontSize={26} fontWeight={800}>資産配分ポートフォリオ</text>
        <text x={250} y={36} fill={TXT} fontSize={20} fontFamily={MONO}>ASSET ALLOCATION</text>

        {/* 扇区 */}
        <g transform={`rotate(${spin} ${cx} ${cy})`}>
          {ALLOC.map((a, i) => {
            const a0 = accDeg;
            const a1 = accDeg + (a.pct / 100) * 360 * grow;
            accDeg = a0 + (a.pct / 100) * 360;
            return <path key={i} d={arcPath(cx, cy, rO, rI, a0, a1)} fill={a.color} opacity={0.88} />;
          })}
        </g>
        {/* 中心 */}
        <circle cx={cx} cy={cy} r={rI - 10} fill="rgba(255,255,255,0.7)" />
        <text x={cx} y={cy - 14} fill={TXT} fontSize={22} textAnchor="middle">総評価額</text>
        <text x={cx} y={cy + 26} fill={INK} fontSize={46} fontWeight={900} textAnchor="middle" fontFamily={MONO}>{data.total.toLocaleString('ja-JP')}万</text>
        <text x={cx} y={cy + 58} fill={GREEN} fontSize={26} fontWeight={700} textAnchor="middle" fontFamily={MONO}>+18.4%</text>

        {/* 图例 */}
        {ALLOC.map((a, i) => (
          <g key={i} transform={`translate(620, ${110 + i * 58})`}>
            <rect x={0} y={0} width={26} height={26} rx={6} fill={a.color} />
            <text x={38} y={20} fill={INK} fontSize={27} fontWeight={600}>{a.label}</text>
            <text x={400} y={20} fill={TXT} fontSize={27} fontFamily={MONO} textAnchor="end">{a.pct}%</text>
          </g>
        ))}
      </svg>

      {/* ── 複利成長曲線 ─────────────────────────────── */}
      <div style={{ position: 'absolute', top: 712, left: 0, width: W, height: 1, background: PANEL }} />
      <svg style={{ position: 'absolute', top: 0, left: 0 }} width={W} height={1100}>
        <text x={24} y={748} fill={INK} fontSize={26} fontWeight={800}>複利成長シミュレーション</text>
        <text x={300} y={748} fill={TXT} fontSize={20} fontFamily={MONO}>COMPOUND GROWTH</text>
        {/* 网格线 */}
        {[0, 1, 2, 3].map(i => (
          <line key={i} x1={CX0} y1={CY0 + (i / 3) * CH} x2={CX0 + CW} y2={CY0 + (i / 3) * CH} stroke={GRID} strokeWidth={1} />
        ))}
        {/* 填充 */}
        {shownPts.length > 1 && (
          <path d={`M ${shownPts[0][0]} ${CY0 + CH} ${shownPts.map(p => `L ${p[0]} ${p[1]}`).join(' ')} L ${shownPts[shownPts.length - 1][0]} ${CY0 + CH} Z`}
            fill="rgba(14,124,90,0.10)" />
        )}
        {/* 曲线 */}
        {shownPts.length > 1 && (
          <polyline points={shownPts.map(p => `${p[0]},${p[1]}`).join(' ')} fill="none" stroke={GREEN} strokeWidth={3.5} />
        )}
        {/* 末端点 */}
        {shownPts.length > 1 && (() => {
          const last = shownPts[shownPts.length - 1];
          return <>
            <circle cx={last[0]} cy={last[1]} r={8} fill={GOLD} />
            <circle cx={last[0]} cy={last[1]} r={14} fill="none" stroke={GOLD} strokeWidth={2} opacity={0.5} />
          </>;
        })()}
      </svg>

      {/* ── 配当フロー ─────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 1112, left: 0, width: W, height: 1, background: PANEL }} />
      <svg style={{ position: 'absolute', top: 1130, left: 0 }} width={W} height={230}>
        <text x={24} y={30} fill={INK} fontSize={26} fontWeight={800}>月間配当フロー</text>
        <text x={200} y={30} fill={TXT} fontSize={20} fontFamily={MONO}>DIVIDEND (万円)</text>
        {data.divs.map((d, i) => {
          const bw = (W - 80) / 12;
          const x = 40 + i * bw;
          const h = d * 130 * Math.min(1, Math.max(0, (frame - 30 - i * 2) / 14));
          return <rect key={i} x={x + 6} y={200 - h} width={bw - 12} height={Math.max(1, h)} rx={4} fill={i % 2 === 0 ? GREEN : GOLD} opacity={0.8} />;
        })}
      </svg>

      {/* ── 底部状态 ─────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 1392, left: 0, width: W, height: 1, background: PANEL }} />
      <div style={{ position: 'absolute', top: 1410, left: 0, width: W, padding: '0 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 40, fontSize: 28, fontFamily: MONO }}>
          <span style={{ color: TXT }}>初期資金 <span style={{ color: INK, fontWeight: 700 }}>500万</span></span>
          <span style={{ color: TXT }}>目標利益 <span style={{ color: GREEN, fontWeight: 700 }}>6,200万</span></span>
          <span style={{ color: TXT }}>配当利回り <span style={{ color: GOLD, fontWeight: 700 }}>4.2%</span></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: TXT, fontSize: 22, letterSpacing: '2px' }}>新NISA · 少額投資非課税制度</span>
          <span style={{ color: 'rgba(30,90,70,0.4)', fontSize: 22, fontFamily: MONO }}>長期分散投資</span>
        </div>
      </div>

      {overlay > 0 && <div style={{ position: 'absolute', inset: 0, background: `rgba(250,253,250,${overlay})`, pointerEvents: 'none' }} />}
    </div>
  );
};
