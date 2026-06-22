import React, { useMemo } from 'react';

/**
 * JpPrimeBg — 「现代简约·冷调」专属动态金融背景（浅色）
 * 保留全套动态金融图表（蜡烛K线 / MA / BB / 成交量 / MACD / 需給動向），
 * 视觉：冷白柔和渐变 + 精致细网格 + 清晰红蓝蜡烛 + 柔和现价线。高级、克制、留白。
 * 去掉背景自带 ticker（顶部跑马灯由独立 overlay 负责）与日本「一目均衡表」。
 */

interface Props {
  frame:    number;
  trend?:   'up' | 'down' | 'flat';
  overlay?: number;
  seed?:    number;
}

function m32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 现代简约·冷调（浅色·红涨蓝跌）──────────────────────────────
const UP        = '#E23A2E';
const DOWN      = '#1F6FE0';
const UP_DIM    = 'rgba(226,58,46,0.52)';
const DOWN_DIM  = 'rgba(31,111,224,0.52)';
const MA5       = '#E8920A';
const MA25      = '#3B5BDB';
const GRID      = 'rgba(40,72,130,0.05)';
const GRID_H    = 'rgba(40,72,130,0.09)';
const TXT       = 'rgba(46,62,98,0.55)';
const TXT_HI    = 'rgba(20,34,64,0.92)';
const PANEL_LN  = 'rgba(40,72,130,0.12)';
const FONT      = "'Noto Sans JP','Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";
const MONO      = "'Roboto Mono','SF Mono','Consolas',monospace";

interface Candle { o: number; h: number; l: number; c: number; v: number; }

function genCandles(trend: string, seed: number, n: number): Candle[] {
  const rng  = m32(seed);
  const data: Candle[] = [];
  let p = 8000 + Math.floor(rng() * 32000);
  p = Math.round(p / 100) * 100;
  const drift = trend === 'up' ? 0.0028 : trend === 'down' ? -0.0025 : 0.0003;
  const vol   = 0.025;
  for (let i = 0; i < n; i++) {
    const r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng();
    const change = drift + vol * (r1 + r2 - 1);
    const o = p;
    const tick = p < 3000 ? 1 : p < 5000 ? 5 : p < 30000 ? 10 : p < 50000 ? 50 : 100;
    const c = Math.round((p * (1 + change)) / tick) * tick;
    const range = Math.abs(c - o) || tick;
    const h = Math.max(o, c) + Math.round(range * r3 * 0.6 / tick) * tick;
    const l = Math.min(o, c) - Math.round(range * r4 * 0.6 / tick) * tick;
    const bv = 200000 + rng() * 1800000;
    data.push({ o, h, l, c, v: Math.round(bv * (1 + Math.abs(change) * 20)) });
    p = c;
  }
  return data;
}

function calcMA(d: Candle[], p: number) {
  return d.map((_, i) => {
    if (i < p - 1) return null;
    let s = 0;
    for (let j = i - p + 1; j <= i; j++) s += d[j].c;
    return s / p;
  });
}

function calcBB(d: Candle[], p = 25, k = 2) {
  const mid = calcMA(d, p);
  const up: (number|null)[] = [], lo: (number|null)[] = [];
  for (let i = 0; i < d.length; i++) {
    if (mid[i] == null) { up.push(null); lo.push(null); continue; }
    let sq = 0;
    for (let j = i - p + 1; j <= i; j++) sq += (d[j].c - mid[i]!) ** 2;
    const std = Math.sqrt(sq / p);
    up.push(mid[i]! + k * std);
    lo.push(mid[i]! - k * std);
  }
  return { up, mid, lo };
}

function calcMACD(d: Candle[]) {
  const ema = (a: number[], p: number) => {
    const k = 2 / (p + 1);
    const r = [a[0]];
    for (let i = 1; i < a.length; i++) r.push(a[i] * k + r[i - 1] * (1 - k));
    return r;
  };
  const c   = d.map(x => x.c);
  const e12 = ema(c, 12), e26 = ema(c, 26);
  const macd = e12.map((v, i) => v - e26[i]);
  const sig  = ema(macd, 9);
  return { macd, sig, hist: macd.map((v, i) => v - sig[i]) };
}

function genFlow(seed: number, n: number) {
  const rng = m32(seed + 9999);
  return Array.from({ length: n }, () => ({
    foreign: Math.round((rng() * 2 - 1) * 380),
    corp:    Math.round((rng() * 2 - 1) * 260),
  }));
}

const W       = 1080;
const VIS     = 40;
const AX_R    = 132;
const CW      = (W - AX_R) / VIS;
const BODY_W  = CW * 0.62;

const KLINE_Y  = 112; const KLINE_H = 800;
const VOL_Y    = 924; const VOL_H   = 184;
const MACD_Y   = 1120; const MACD_H = 178;
const FLOW_Y   = 1310; const FLOW_H = 238;
const BOT_Y    = 1560; const BOT_H  = 360;

function ix(i: number) { return i * CW + CW / 2; }
function fmt(n: number) { return Math.round(n).toLocaleString('ja-JP'); }
function polyln(pts: [number,number][]) { return pts.map(([x,y]) => `${x},${y}`).join(' '); }

const STATUS = [
  { label: '日経平均', base: 38742.2 }, { label: 'TOPIX', base: 2718.4 },
  { label: 'グロース250', base: 642.3 }, { label: 'USD/JPY', base: 157.3 },
];

export const JpPrimeBg: React.FC<Props> = ({ frame, trend = 'up', overlay = 0, seed }) => {
  const data = useMemo(() => {
    const s = seed != null ? seed : (trend === 'up' ? 42 : trend === 'down' ? 137 : 89);
    const candles = genCandles(trend, s, 150);
    return {
      candles,
      ma5:  calcMA(candles, 5),
      ma25: calcMA(candles, 25),
      bb:   calcBB(candles),
      ...calcMACD(candles),
      flow: genFlow(s, candles.length),
    };
  }, [trend, seed]);

  const mkt = useMemo(() => {
    const rng = m32(((seed ?? 42) ^ 0xA37F1C) >>> 0);
    const up   = 420 + Math.round(rng() * 880);
    const flat = 55  + Math.round(rng() * 240);
    const down = Math.max(40, 1895 - up - flat);
    const to   = (1.6 + rng() * 4.2).toFixed(2);
    return { up, flat, down, to, deltas: STATUS.map(() => (rng() - 0.45) * 0.03) };
  }, [seed]);

  const CF      = 10;
  const scrollP = frame / CF;
  const s0      = Math.floor(scrollP);
  const frac    = scrollP - s0;
  const vStart  = s0;
  const vEnd    = Math.min(s0 + VIS, data.candles.length - 1);
  const formIdx = vEnd;
  const formP   = frac;

  const visCandles = useMemo(() => {
    const wobble = Math.sin(formP * Math.PI * 2.5) * 0.04 * formP;
    const out: Candle[] = [];
    for (let i = vStart; i <= vEnd; i++) {
      if (i < 0 || i >= data.candles.length) continue;
      if (i === formIdx) {
        const c = data.candles[i];
        const fp = formP + wobble;
        out.push({
          o: c.o,
          c: c.o + (c.c - c.o) * fp,
          h: Math.max(c.o, c.o + (c.h - c.o) * Math.min(1, fp * 1.4)),
          l: Math.min(c.o, c.o + (c.l - c.o) * Math.min(1, fp * 1.4)),
          v: Math.round(c.v * formP),
        });
      } else {
        out.push(data.candles[i]);
      }
    }
    return out;
  }, [vStart, vEnd, formIdx, formP, data.candles]);

  const prices = visCandles.flatMap(c => [c.h, c.l]);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const padP = (maxP - minP) * 0.08;
  const pLo  = minP - padP, pHi = maxP + padP;
  const py   = (p: number, h: number, pad = 18) => pad + (1 - (p - pLo) / (pHi - pLo)) * (h - pad * 2);

  const maxVol = Math.max(...visCandles.map(c => c.v));

  const mSlice   = data.hist.slice(vStart, vEnd + 1);
  const macSlice = data.macd.slice(vStart, vEnd + 1);
  const sigSlice = data.sig.slice(vStart, vEnd + 1);
  const allMac   = [...mSlice, ...macSlice, ...sigSlice];
  const macRange = Math.max(Math.abs(Math.min(...allMac)), Math.abs(Math.max(...allMac))) * 1.15 || 1;
  const my = (v: number) => MACD_H / 2 - (v / macRange) * (MACD_H / 2 - 16);

  const fSlice  = data.flow.slice(vStart, vEnd + 1);
  const maxFlow = Math.max(...fSlice.flatMap(f => [Math.abs(f.foreign), Math.abs(f.corp)])) * 1.1 || 1;
  const fy = (v: number) => FLOW_H / 2 - (v / maxFlow) * (FLOW_H / 2 - 20);

  const gridPrices: number[] = [];
  const step = (pHi - pLo) / 6;
  for (let i = 1; i <= 5; i++) gridPrices.push(pLo + step * i);

  const sec    = Math.floor(frame / 30);
  const mktMin = 9 * 60 + sec;
  const timeStr = `${String(Math.floor(mktMin / 60) % 24).padStart(2,'0')}:${String(mktMin % 60).padStart(2,'0')}:${String(frame % 60).padStart(2,'0')}`;

  const last   = visCandles[visCandles.length - 1];
  const lastUp = last ? last.c >= last.o : true;
  const glowOp = 0.30 + 0.12 * Math.sin(frame * 0.18);
  const scanY  = (frame * 1.4) % 1920;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: W, height: 1920,
      background: 'radial-gradient(125% 85% at 50% 12%, #FCFDFF 0%, #F1F5FB 52%, #E7EEF7 100%)',
      overflow: 'hidden', fontFamily: FONT,
    }}>
      {/* 精致细网格 + 浅色扫描线 */}
      <svg style={{ position: 'absolute', inset: 0 }} width={W} height={1920}>
        <defs>
          <pattern id="kpGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M60 0 H0 V60" fill="none" stroke={GRID} strokeWidth={1} />
          </pattern>
        </defs>
        <rect x={0} y={KLINE_Y - 8} width={W} height={1920 - KLINE_Y} fill="url(#kpGrid)" />
        <rect x={0} y={scanY} width={W} height={2} fill="rgba(60,110,200,0.045)" />
      </svg>

      {/* ── 日足チャート ───────────────────────────────────────── */}
      <svg style={{ position: 'absolute', top: KLINE_Y, left: 0 }} width={W} height={KLINE_H}>
        <text x={14} y={30} fill={TXT_HI} fontSize={25} fontWeight={800} letterSpacing="0.5">日足チャート</text>
        <text x={150} y={30} fill={TXT} fontSize={20} fontFamily={MONO}>MA5 · MA25 · BB(25,2)</text>
        {last && (() => {
          const prev = visCandles[visCandles.length - 2];
          const diff = prev ? last.c - prev.c : 0;
          const dp   = prev && prev.c ? diff / prev.c * 100 : 0;
          const up   = diff >= 0;
          return (
            <text x={14} y={58} fontSize={21} fontFamily={MONO} style={{ fontVariantNumeric: 'tabular-nums' }}>
              <tspan fill={TXT}>O </tspan><tspan fill={TXT_HI}>{fmt(last.o)}  </tspan>
              <tspan fill={TXT}>H </tspan><tspan fill={UP}>{fmt(last.h)}  </tspan>
              <tspan fill={TXT}>L </tspan><tspan fill={DOWN}>{fmt(last.l)}  </tspan>
              <tspan fill={TXT}>C </tspan><tspan fill={TXT_HI} fontWeight={700}>{fmt(last.c)}  </tspan>
              <tspan fill={up ? UP : DOWN} fontWeight={700}>{up ? '+' : ''}{dp.toFixed(2)}%</tspan>
            </text>
          );
        })()}

        {gridPrices.map((p, i) => (
          <g key={i}>
            <line x1={0} y1={py(p, KLINE_H)} x2={W - AX_R} y2={py(p, KLINE_H)} stroke={GRID_H} strokeWidth={1} />
            <text x={W - AX_R + 10} y={py(p, KLINE_H) + 6} fill={TXT} fontSize={21} fontFamily={MONO}>{fmt(p)}</text>
          </g>
        ))}

        {/* BB 带 */}
        {(() => {
          const pts: [number,number][] = [], lo: [number,number][] = [];
          for (let i = 0; i < visCandles.length; i++) {
            const di = vStart + i;
            if (data.bb.up[di] == null) continue;
            pts.push([ix(i), py(data.bb.up[di]!, KLINE_H)]);
            lo.unshift([ix(i), py(data.bb.lo[di]!, KLINE_H)]);
          }
          if (pts.length < 2) return null;
          return <polygon points={[...pts, ...lo].map(([x,y]) => `${x},${y}`).join(' ')} fill="rgba(59,91,219,0.045)" />;
        })()}
        {(['up','lo'] as const).map(band => {
          const pts: [number,number][] = [];
          for (let i = 0; i < visCandles.length; i++) {
            const v = (data.bb as any)[band][vStart + i];
            if (v == null) continue;
            pts.push([ix(i), py(v, KLINE_H)]);
          }
          return pts.length > 1
            ? <polyline key={band} points={polyln(pts)} fill="none" stroke="rgba(59,91,219,0.22)" strokeWidth={1} strokeDasharray="5,5" />
            : null;
        })}

        {/* MA5 / MA25 */}
        {([['ma5', MA5], ['ma25', MA25]] as const).map(([key, col]) => {
          const pts: [number,number][] = [];
          for (let i = 0; i < visCandles.length; i++) {
            const v = (data as any)[key][vStart + i];
            if (v == null) continue;
            pts.push([ix(i), py(v, KLINE_H)]);
          }
          return pts.length > 1
            ? <polyline key={key} points={polyln(pts)} fill="none" stroke={col} strokeWidth={2} opacity={0.9} />
            : null;
        })}

        {/* 蜡烛（清晰纯色，柔和无霓虹）*/}
        {visCandles.map((c, i) => {
          const x    = ix(i);
          const isUp = c.c >= c.o;
          const col  = isUp ? UP : DOWN;
          const bTop = py(Math.max(c.o, c.c), KLINE_H);
          const bBot = py(Math.min(c.o, c.c), KLINE_H);
          const bH   = Math.max(1.5, bBot - bTop);
          return (
            <g key={i}>
              <line x1={x} y1={py(c.h, KLINE_H)} x2={x} y2={py(c.l, KLINE_H)} stroke={col} strokeWidth={1.5} />
              <rect x={x - BODY_W / 2} y={bTop} width={BODY_W} height={bH} fill={col} rx={1.5} />
            </g>
          );
        })}

        {/* 现价线（柔和）*/}
        {last && (() => {
          const yp  = py(last.c, KLINE_H);
          const col = lastUp ? UP : DOWN;
          return (
            <>
              <line x1={0} y1={yp} x2={W - AX_R} y2={yp} stroke={col} strokeWidth={3} opacity={glowOp} />
              <line x1={0} y1={yp} x2={W - AX_R} y2={yp} stroke={col} strokeWidth={1} strokeDasharray="4,4" opacity={0.7} />
              <rect x={W - AX_R} y={yp - 18} width={AX_R} height={36} fill={col} rx={4} />
              <text x={W - AX_R + 10} y={yp + 8} fill="#fff" fontSize={22} fontWeight={800} fontFamily={MONO}>{fmt(last.c)}</text>
            </>
          );
        })()}

        <circle cx={W - 270} cy={12} r={5} fill={MA5} />
        <text x={W - 258} y={18} fill={TXT} fontSize={19} fontFamily={MONO}>MA5</text>
        <circle cx={W - 200} cy={12} r={5} fill={MA25} />
        <text x={W - 188} y={18} fill={TXT} fontSize={19} fontFamily={MONO}>MA25</text>
      </svg>

      {/* ── 出来高 ───────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: VOL_Y - 6, left: 0, width: W, height: 1, background: PANEL_LN }} />
      <svg style={{ position: 'absolute', top: VOL_Y, left: 0 }} width={W} height={VOL_H}>
        <text x={14} y={26} fill={TXT_HI} fontSize={23} fontWeight={800}>出来高</text>
        <line x1={0} y1={VOL_H / 2} x2={W - AX_R} y2={VOL_H / 2} stroke={GRID} strokeWidth={1} />
        {visCandles.map((c, i) => {
          const isUp = c.c >= c.o;
          const h = Math.max(1, (c.v / maxVol) * (VOL_H - 36));
          return <rect key={i} x={ix(i) - BODY_W / 2} y={VOL_H - h - 4} width={BODY_W} height={h}
            fill={isUp ? UP_DIM : DOWN_DIM} rx={1.5} />;
        })}
        <text x={W - AX_R + 10} y={40} fill={TXT} fontSize={20} fontFamily={MONO}>{fmt(maxVol / 1000)}K</text>
      </svg>

      {/* ── MACD ─────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: MACD_Y - 6, left: 0, width: W, height: 1, background: PANEL_LN }} />
      <svg style={{ position: 'absolute', top: MACD_Y, left: 0 }} width={W} height={MACD_H}>
        <text x={14} y={26} fill={TXT_HI} fontSize={23} fontWeight={800}>MACD <tspan fill={TXT} fontSize={18} fontFamily={MONO}>(12,26,9)</tspan></text>
        <line x1={0} y1={MACD_H / 2} x2={W - AX_R} y2={MACD_H / 2} stroke={GRID_H} strokeWidth={1} />
        {mSlice.map((v, i) => {
          const h = Math.abs(my(v) - MACD_H / 2);
          const y0 = v >= 0 ? MACD_H / 2 - h : MACD_H / 2;
          return <rect key={i} x={ix(i) - BODY_W * 0.4} y={y0} width={BODY_W * 0.8} height={Math.max(1, h)}
            fill={v >= 0 ? UP_DIM : DOWN_DIM} rx={1} />;
        })}
        {macSlice.length > 1 && <polyline points={polyln(macSlice.map((v, i) => [ix(i), my(v)] as [number,number]))}
          fill="none" stroke={DOWN} strokeWidth={1.6} opacity={0.85} />}
        {sigSlice.length > 1 && <polyline points={polyln(sigSlice.map((v, i) => [ix(i), my(v)] as [number,number]))}
          fill="none" stroke={MA5} strokeWidth={1.8} opacity={0.9} />}
      </svg>

      {/* ── 需給動向 ─────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: FLOW_Y - 6, left: 0, width: W, height: 1, background: PANEL_LN }} />
      <svg style={{ position: 'absolute', top: FLOW_Y, left: 0 }} width={W} height={FLOW_H}>
        <text x={14} y={26} fill={TXT_HI} fontSize={23} fontWeight={800}>需給動向</text>
        <text x={150} y={26} fill={TXT} fontSize={19} fontFamily={MONO}>外国人 / 機関 (億円)</text>
        <line x1={0} y1={FLOW_H / 2} x2={W - AX_R} y2={FLOW_H / 2} stroke={GRID_H} strokeWidth={1} />
        {fSlice.map((f, i) => {
          const x = ix(i);
          const hf = Math.abs(fy(f.foreign) - FLOW_H / 2);
          const hi = Math.abs(fy(f.corp) - FLOW_H / 2);
          return (
            <g key={i}>
              <rect x={x - BODY_W * 0.45} y={f.foreign >= 0 ? FLOW_H / 2 - hf : FLOW_H / 2}
                width={BODY_W * 0.44} height={Math.max(1, hf)} fill={f.foreign >= 0 ? UP_DIM : DOWN_DIM} rx={1} />
              <rect x={x} y={f.corp >= 0 ? FLOW_H / 2 - hi : FLOW_H / 2}
                width={BODY_W * 0.44} height={Math.max(1, hi)} fill={f.corp >= 0 ? 'rgba(232,146,10,0.55)' : 'rgba(120,100,210,0.55)'} rx={1} />
            </g>
          );
        })}
        <circle cx={W - 268} cy={13} r={6} fill={UP_DIM} />
        <text x={W - 256} y={19} fill={TXT} fontSize={19} fontFamily={MONO}>外国人</text>
        <circle cx={W - 168} cy={13} r={6} fill="rgba(232,146,10,0.70)" />
        <text x={W - 156} y={19} fill={TXT} fontSize={19} fontFamily={MONO}>機関</text>
      </svg>

      {/* ── 下部マーケットステータスバー ──────────────────────────────────── */}
      <div style={{ position: 'absolute', top: BOT_Y - 6, left: 0, width: W, height: 1, background: PANEL_LN }} />
      <div style={{ position: 'absolute', top: BOT_Y, left: 0, width: W, height: BOT_H, padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 26, fontSize: 30, fontWeight: 700, fontFamily: MONO }}>
          <span style={{ color: UP }}>▲ 上昇 {mkt.up.toLocaleString('ja-JP')}</span>
          <span style={{ color: 'rgba(46,62,98,0.42)' }}>― 変わらず {mkt.flat.toLocaleString('ja-JP')}</span>
          <span style={{ color: DOWN }}>▼ 下落 {mkt.down.toLocaleString('ja-JP')}</span>
        </div>
        <div style={{ display: 'flex', height: 7, borderRadius: 4, overflow: 'hidden', width: W - 44 }}>
          <div style={{ flex: mkt.up, background: UP, opacity: 0.7 }} />
          <div style={{ flex: mkt.flat, background: 'rgba(40,72,130,0.14)' }} />
          <div style={{ flex: mkt.down, background: DOWN, opacity: 0.7 }} />
        </div>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: 26, fontFamily: MONO }}>
          {STATUS.map((d, i) => {
            const live = d.base * (1 + mkt.deltas[i]);
            const up = mkt.deltas[i] >= 0;
            return (
              <span key={i} style={{ display: 'inline-flex', gap: 8 }}>
                <span style={{ color: TXT }}>{d.label}</span>
                <span style={{ color: TXT_HI, fontWeight: 700 }}>{live.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}</span>
                <span style={{ color: up ? UP : DOWN }}>{up ? '+' : ''}{(mkt.deltas[i] * 100).toFixed(2)}%</span>
              </span>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <span style={{ color: TXT, fontSize: 22, letterSpacing: '2px' }}>JAPAN EXCHANGE · リアルタイム</span>
          <span style={{ color: 'rgba(40,72,130,0.42)', fontSize: 22, fontFamily: MONO }}>KST {timeStr}</span>
        </div>
      </div>

      {overlay > 0 && <div style={{ position: 'absolute', inset: 0, background: `rgba(247,250,254,${overlay})`, pointerEvents: 'none' }} />}
    </div>
  );
};
