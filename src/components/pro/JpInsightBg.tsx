import React, { useMemo } from 'react';

/**
 * JpInsightBg — 「深度研报·靛蓝」专属动态金融背景（浅色）
 * 需給・資金フロー ネットワーク（投资者节点 → 个股流光连线，净买入）+ 財務 棒グラフ（売上/営業利益）。
 * 浅灰蓝研报调，深度数据感。配单股深扒。
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

const INDIGO = '#0C8A8C';
const CYAN   = '#3D7AC9';
const SLATE  = '#5A6B8C';
const GOLD   = '#C9952F';
const GRID   = 'rgba(40,64,120,0.06)';
const INK    = 'rgba(22,34,64,0.90)';
const TXT    = 'rgba(48,66,108,0.55)';
const PANEL  = 'rgba(40,64,120,0.12)';
const FONT   = "'Noto Sans JP','Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";
const MONO   = "'Roboto Mono','SF Mono','Consolas',monospace";

const W = 1080;
const CX = 540, CY = 388;

const INVESTORS = [
  { label: '外国人', amt: '+1,240億', deg: -90,  color: INDIGO },
  { label: '機関',   amt: '+860億',   deg: -18,  color: CYAN   },
  { label: '年金基金', amt: '+420億',   deg: 54,   color: '#2C9C7A' },
  { label: '私募ファンド', amt: '+210億', deg: 126,  color: GOLD   },
  { label: '金融投資', amt: '+180億', deg: 198,  color: SLATE  },
];

function polar(r: number, deg: number): [number, number] {
  const a = deg * Math.PI / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

export const JpInsightBg: React.FC<Props> = ({ frame, overlay = 0, seed }) => {
  const data = useMemo(() => {
    const rng = m32(seed ?? 42);
    const rev = Array.from({ length: 8 }, (_, i) => 40 + i * 8 + rng() * 12);   // 売上成長
    const op  = Array.from({ length: 8 }, (_, i) => 8 + i * 2.4 + rng() * 4);    // 営業利益
    return { rev, op };
  }, [seed]);

  const grow = Math.min(1, frame / 36);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: W, height: 1920,
      background: 'radial-gradient(125% 85% at 50% 12%, #F9FBFE 0%, #EDF2FA 52%, #DFE8F5 100%)',
      overflow: 'hidden', fontFamily: FONT,
    }}>
      <svg style={{ position: 'absolute', inset: 0 }} width={W} height={1920}>
        <defs>
          <pattern id="jpInsGrid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M64 0 H0 V64" fill="none" stroke={GRID} strokeWidth={1} />
          </pattern>
        </defs>
        <rect x={0} y={120} width={W} height={1800} fill="url(#jpInsGrid)" />
      </svg>

      {/* ── 需給ネットワーク ─────────────────────────────── */}
      <svg style={{ position: 'absolute', top: 130, left: 0 }} width={W} height={560}>
        <text x={24} y={34} fill={INK} fontSize={26} fontWeight={800}>需給・資金フロー</text>
        <text x={210} y={34} fill={TXT} fontSize={20} fontFamily={MONO}>SMART MONEY FLOW</text>

        {/* 连线（流光）*/}
        {INVESTORS.map((inv, i) => {
          const [nx, ny] = polar(232, inv.deg);
          // 流光点
          const fp = ((frame * 0.025 + i * 0.2) % 1);
          const px = nx + (CX - nx) * fp;
          const py = ny + (CY - ny) * fp;
          return (
            <g key={i}>
              <line x1={nx} y1={ny} x2={CX} y2={CY} stroke={inv.color} strokeWidth={2} opacity={0.32} />
              <circle cx={px} cy={py} r={5} fill={inv.color} opacity={0.85} />
              <circle cx={px} cy={py} r={9} fill={inv.color} opacity={0.25} />
            </g>
          );
        })}

        {/* 投资者节点 */}
        {INVESTORS.map((inv, i) => {
          const [nx, ny] = polar(232 * grow, inv.deg);
          return (
            <g key={i} opacity={grow}>
              <circle cx={nx} cy={ny} r={46} fill="rgba(255,255,255,0.85)" stroke={inv.color} strokeWidth={2.5} />
              <text x={nx} y={ny - 4} fill={INK} fontSize={22} fontWeight={700} textAnchor="middle">{inv.label}</text>
              <text x={nx} y={ny + 22} fill={inv.color} fontSize={20} fontWeight={800} textAnchor="middle" fontFamily={MONO}>{inv.amt}</text>
            </g>
          );
        })}

        {/* 中央个股节点 */}
        <circle cx={CX} cy={CY} r={78} fill={INDIGO} opacity={0.12} />
        <circle cx={CX} cy={CY} r={66} fill="rgba(255,255,255,0.92)" stroke={INDIGO} strokeWidth={3} />
        <text x={CX} y={CY - 8} fill={TXT} fontSize={20} textAnchor="middle">買い越し集中</text>
        <text x={CX} y={CY + 24} fill={INDIGO} fontSize={34} fontWeight={900} textAnchor="middle" fontFamily={MONO}>TARGET</text>
      </svg>

      {/* ── 財務成長 ─────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 712, left: 0, width: W, height: 1, background: PANEL }} />
      <svg style={{ position: 'absolute', top: 0, left: 0 }} width={W} height={1120}>
        <text x={24} y={748} fill={INK} fontSize={26} fontWeight={800}>財務成長推移</text>
        <text x={250} y={748} fill={TXT} fontSize={20} fontFamily={MONO}>REVENUE / OP PROFIT</text>
        {[0, 1, 2, 3].map(i => <line key={i} x1={60} y1={780 + i * 100} x2={W - 60} y2={780 + i * 100} stroke={GRID} strokeWidth={1} />)}
        {data.rev.map((r, i) => {
          const bw = (W - 140) / 8;
          const x = 70 + i * bw;
          const maxR = Math.max(...data.rev);
          const h = (r / maxR) * 300 * Math.min(1, Math.max(0, (frame - 24 - i * 3) / 16));
          const oh = (data.op[i] / maxR) * 300 * Math.min(1, Math.max(0, (frame - 30 - i * 3) / 16));
          return (
            <g key={i}>
              <rect x={x + 8} y={1080 - h} width={bw - 40} height={Math.max(1, h)} rx={4} fill={INDIGO} opacity={0.55} />
              <rect x={x + bw - 30} y={1080 - oh} width={bw - 40} height={Math.max(1, oh)} rx={4} fill={GOLD} opacity={0.7} />
            </g>
          );
        })}
        <rect x={W - 280} y={732} width={18} height={18} rx={4} fill={INDIGO} opacity={0.6} /><text x={W - 256} y={747} fill={TXT} fontSize={20} fontFamily={MONO}>売上</text>
        <rect x={W - 180} y={732} width={18} height={18} rx={4} fill={GOLD} opacity={0.7} /><text x={W - 156} y={747} fill={TXT} fontSize={20} fontFamily={MONO}>営業利益</text>
      </svg>

      {/* ── 底部状态 ─────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 1452, left: 0, width: W, height: 1, background: PANEL }} />
      <div style={{ position: 'absolute', top: 1470, left: 0, width: W, padding: '0 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 40, fontSize: 28, fontFamily: MONO }}>
          <span style={{ color: TXT }}>外国人保有比率 <span style={{ color: INDIGO, fontWeight: 700 }}>54.2%</span></span>
          <span style={{ color: TXT }}>PER <span style={{ color: INK, fontWeight: 700 }}>12.4倍</span></span>
          <span style={{ color: TXT }}>目標株価 <span style={{ color: GOLD, fontWeight: 700 }}>+38%</span></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: TXT, fontSize: 22, letterSpacing: '2px' }}>詳細分析 · DEEP DIVE</span>
          <span style={{ color: 'rgba(40,64,120,0.4)', fontSize: 22, fontFamily: MONO }}>機関・外国人動向</span>
        </div>
      </div>

      {overlay > 0 && <div style={{ position: 'absolute', inset: 0, background: `rgba(249,251,254,${overlay})`, pointerEvents: 'none' }} />}
    </div>
  );
};
