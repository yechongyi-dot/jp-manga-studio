import React, { useMemo } from 'react';

interface Props {
  frame:    number;
  trend?:   'up' | 'down' | 'flat';
  overlay?: number;
  seed?:    number;
}

// ── Seeded PRNG ───────────────────────────────────────────────────────────────
function m32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 日本株カラー (赤=上昇, 青=下落) ─────────────────────────────────────────
const UP       = '#E8392B';
const DOWN     = '#1A6EDD';
const UP_DIM   = 'rgba(232,57,43,0.60)';
const DOWN_DIM = 'rgba(26,110,221,0.60)';
const MA5      = '#D4880A';
const MA25     = '#1A9850';
const GRID     = 'rgba(0,0,0,0.05)';
const GRID_H   = 'rgba(0,0,0,0.08)';
const TXT      = 'rgba(0,0,0,0.42)';
const BG       = '#F7F8FA';

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

// 一目均衡表（日本発祥のテクニカル指標）。転換線・基準線・先行スパンA/B（雲）
function calcIchimoku(d: Candle[]) {
  const mid = (i: number, p: number) => {
    let hi = -Infinity, lo = Infinity;
    for (let j = Math.max(0, i - p + 1); j <= i; j++) { hi = Math.max(hi, d[j].h); lo = Math.min(lo, d[j].l); }
    return (hi + lo) / 2;
  };
  const tenkan = d.map((_, i) => i < 8  ? null : mid(i, 9));   // 転換線
  const kijun  = d.map((_, i) => i < 25 ? null : mid(i, 26));  // 基準線
  const spanA  = d.map((_, i) => (tenkan[i] == null || kijun[i] == null) ? null : (tenkan[i]! + kijun[i]!) / 2); // 先行スパンA
  const spanB  = d.map((_, i) => i < 51 ? null : mid(i, 52));  // 先行スパンB
  return { tenkan, kijun, spanA, spanB };
}

function genFlow(seed: number, n: number) {
  const rng = m32(seed + 9999);
  return Array.from({ length: n }, () => ({
    foreign: Math.round((rng() * 2 - 1) * 380),
    corp:    Math.round((rng() * 2 - 1) * 260),
  }));
}

// ── レイアウト定数 ─────────────────────────────────────────────────────────────
const W       = 1080;
const VIS     = 40;
const AX_R    = 130;
const CW      = (W - AX_R) / VIS;
const BODY_W  = CW * 0.62;

const TICKER_H = 66;
const KLINE_Y  = 70;  const KLINE_H  = 820;
const VOL_Y    = 894; const VOL_H    = 210;
const MACD_Y   = 1108; const MACD_H  = 195;
const FLOW_Y   = 1307; const FLOW_H  = 260;
const BOT_Y    = 1571; const BOT_H   = 349;

function ix(i: number) { return i * CW + CW / 2; }
function fmt(n: number) { return Math.round(n).toLocaleString('ja-JP'); }
function polyln(pts: [number,number][]) { return pts.map(([x,y]) => `${x},${y}`).join(' '); }

const TICKERS = [
  { label: '日経平均',      val: '38,742', chg: '+342',   pct: '+0.89%', up: true  },
  { label: 'TOPIX',        val: '2,714',  chg: '-12',    pct: '-0.44%', up: false },
  { label: 'JPX400',       val: '25,183', chg: '+88',    pct: '+0.35%', up: true  },
  { label: 'USD/JPY',      val: '156.42', chg: '+0.38',  pct: '+0.24%', up: true  },
  { label: 'トヨタ自動車', val: '3,820',  chg: '+62',    pct: '+1.65%', up: true  },
  { label: 'ソニーG',      val: '13,640', chg: '-240',   pct: '-1.73%', up: false },
  { label: 'ソフトバンクG',val: '5,244',  chg: '+178',   pct: '+3.51%', up: true  },
  { label: '任天堂',        val: '8,690',  chg: '+120',   pct: '+1.40%', up: true  },
  { label: 'キーエンス',   val: '65,230', chg: '-870',   pct: '-1.32%', up: false },
  { label: '日立製作所',   val: '4,182',  chg: '+94',    pct: '+2.30%', up: true  },
  { label: '三菱UFJ',      val: '1,842',  chg: '+28',    pct: '+1.54%', up: true  },
  { label: 'ファーストR',  val: '574,000',chg: '-8,000', pct: '-1.37%', up: false },
];

const TIME_LABELS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:30','13:00','13:30','14:00','14:30','15:00','15:30'];

export const JpBg: React.FC<Props> = ({ frame, trend = 'up', overlay = 0.20, seed }) => {
  const data = useMemo(() => {
    const s = seed != null ? seed : (trend === 'up' ? 42 : trend === 'down' ? 137 : 89);
    const candles = genCandles(trend, s, 150);
    const ma5     = calcMA(candles, 5);
    const ma25    = calcMA(candles, 25);
    const bb      = calcBB(candles);
    const macd    = calcMACD(candles);
    const flow    = genFlow(s, candles.length);
    const ichimoku = calcIchimoku(candles);
    return { candles, ma5, ma25, bb, ...macd, flow, ichimoku };
  }, [trend, seed]);

  const mktRnd = useMemo(() => {
    const rng = m32(((seed ?? 42) ^ 0xA37F1C) >>> 0);
    const order = Array.from({ length: TICKERS.length }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const tickers = order.map(idx => {
      const t = TICKERS[idx];
      return {
        label:   t.label,
        base:    parseFloat(t.val.replace(/,/g, '')),
        delta:   (rng() - 0.5) * 0.05,
        isFloat: t.val.includes('.'),
      };
    });
    const up   = 420 + Math.round(rng() * 880);
    const flat = 55  + Math.round(rng() * 240);
    const down = Math.max(40, 1895 - up - flat);
    const to   = (1.6 + rng() * 4.2).toFixed(2);
    const sHi  = Math.round(rng() * 11);
    const sLo  = Math.round(rng() * 6);
    const bot = [
      { label: 'TOPIX Core30', val: fmt(2350 + rng() * 750),   up: rng() > 0.45 },
      { label: 'JPX日経400',   val: fmt(20800 + rng() * 6500), up: rng() > 0.45 },
      { label: '東証REIT指数', val: fmt(1420 + rng() * 680),   up: rng() > 0.45 },
      { label: '日経VI',  val: (10.8 + rng() * 24).toFixed(2), up: false },
    ];
    return { tickers, up, flat, down, to, sHi, sLo, bot };
  }, [seed]);

  const CF    = 10;
  const scrollP = frame / CF;
  const s0    = Math.floor(scrollP);
  const frac  = scrollP - s0;
  const vStart = s0;
  const vEnd  = Math.min(s0 + VIS, data.candles.length - 1);
  const formIdx = vEnd;
  const formP   = frac;

  const visCandles = useMemo(() => {
    // wobble を formP ベースで計算し frame を deps から除外
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
  // visCandles 空（vStart>vEnd 等の異常）時に ±Infinity→NaN 座標で react-dom が大量エラーを出すのを防ぐ
  const minP  = prices.length ? Math.min(...prices) : 0;
  const maxP  = prices.length ? Math.max(...prices) : 1;
  const padP  = (maxP - minP) * 0.08;
  const pLo   = minP - padP, pHi = maxP + padP;
  const py    = (p: number, h: number, pad = 18) => pad + (1 - (p - pLo) / (pHi - pLo)) * (h - pad * 2);

  const maxVol = visCandles.length ? Math.max(...visCandles.map(c => c.v)) : 1;

  const mSlice   = data.hist.slice(vStart, vEnd + 1);
  const macSlice = data.macd.slice(vStart, vEnd + 1);
  const sigSlice = data.sig.slice(vStart, vEnd + 1);
  const allMac   = [...mSlice, ...macSlice, ...sigSlice];
  const macRange = Math.max(Math.abs(Math.min(...allMac)), Math.abs(Math.max(...allMac))) * 1.15;
  const my = (v: number) => MACD_H / 2 - (v / macRange) * (MACD_H / 2 - 16);

  const fSlice  = data.flow.slice(vStart, vEnd + 1);
  const maxFlow = Math.max(...fSlice.flatMap(f => [Math.abs(f.foreign), Math.abs(f.corp)])) * 1.1;
  const fy = (v: number) => FLOW_H / 2 - (v / maxFlow) * (FLOW_H / 2 - 20);

  const tickerOff = (frame * 1.6) % 2600;

  const gridPrices: number[] = [];
  const step = (pHi - pLo) / 6;
  for (let i = 1; i <= 5; i++) gridPrices.push(pLo + step * i);

  const sec    = Math.floor(frame / 30);
  const mktMin = 9 * 60 + sec;
  const hh     = Math.floor(mktMin / 60) % 24;
  const mm     = mktMin % 60;
  const timeStr = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(frame % 60).padStart(2,'0')}`;

  const last  = visCandles[visCandles.length - 1];
  const lastUp = last ? last.c >= last.o : true;
  const glowOp = 0.22 + 0.12 * Math.sin(frame * 0.18);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: W, height: 1920,
      background: BG, overflow: 'hidden',
      fontFamily: "'Noto Sans JP','Hiragino Kaku Gothic ProN','Meiryo',sans-serif",
    }}>

      {/* ── ティッカーテープ ─────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: W, height: TICKER_H,
        borderBottom: `1px solid rgba(0,0,0,0.07)`,
        overflow: 'hidden', display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          whiteSpace: 'nowrap', transform: `translateX(${-tickerOff}px)`,
          display: 'flex', gap: 44, fontSize: 29, fontWeight: 600, letterSpacing: '-0.3px',
        }}>
          {[...mktRnd.tickers, ...mktRnd.tickers].map((t, i) => {
            const wave = Math.sin(frame * 0.06 + i * 1.7) * 0.004;  // ±0.4% 実時間ティック
            const live = t.base * (1 + t.delta + wave);
            const chg  = live - t.base;
            const up   = chg >= 0;
            const valStr = t.isFloat ? live.toFixed(2) : Math.round(live).toLocaleString('ja-JP');
            const chgStr = t.isFloat
              ? `${up ? '+' : ''}${chg.toFixed(2)}`
              : `${up ? '+' : '-'}${Math.round(Math.abs(chg)).toLocaleString('ja-JP')}`;
            const pctStr = `${up ? '+' : ''}${(chg / t.base * 100).toFixed(2)}%`;
            return (
              <span key={i} style={{ display: 'inline-flex', gap: 7 }}>
                <span style={{ color: TXT }}>{t.label}</span>
                <span style={{ color: 'rgba(0,0,0,0.78)', fontVariantNumeric: 'tabular-nums' }}>{valStr}</span>
                <span style={{ color: up ? UP : DOWN, fontVariantNumeric: 'tabular-nums' }}>
                  {up ? '▲' : '▼'}{chgStr} ({pctStr})
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ── 日足チャート ─────────────────────────────────────── */}
      <svg style={{ position: 'absolute', top: KLINE_Y, left: 0 }} width={W} height={KLINE_H}>
        <text x={12} y={30} fill={TXT} fontSize={25} fontWeight={700}>日足チャート</text>
        <text x={150} y={30} fill="rgba(0,0,0,0.22)" fontSize={21}>MA5 / MA25 / BB(25,2) / 一目均衡表</text>
        {last && (() => {
          const prev = visCandles[visCandles.length - 2];
          const diff = prev ? last.c - prev.c : 0;
          const dp   = prev && prev.c ? diff / prev.c * 100 : 0;
          const up   = diff >= 0;
          return (
            <text x={12} y={56} fontSize={21} style={{ fontVariantNumeric: 'tabular-nums' }}>
              <tspan fill={TXT}>始 </tspan><tspan fill="rgba(0,0,0,0.62)">{fmt(last.o)}　</tspan>
              <tspan fill={TXT}>高 </tspan><tspan fill={UP}>{fmt(last.h)}　</tspan>
              <tspan fill={TXT}>安 </tspan><tspan fill={DOWN}>{fmt(last.l)}　</tspan>
              <tspan fill={TXT}>終 </tspan><tspan fill="rgba(0,0,0,0.80)" fontWeight={700}>{fmt(last.c)}　</tspan>
              <tspan fill={up ? UP : DOWN} fontWeight={700}>{up ? '+' : ''}{fmt(diff)} ({up ? '+' : ''}{dp.toFixed(2)}%)</tspan>
            </text>
          );
        })()}

        {/* 水平グリッド */}
        {gridPrices.map((p, i) => (
          <g key={i}>
            <line x1={0} y1={py(p, KLINE_H)} x2={W - AX_R} y2={py(p, KLINE_H)} stroke={GRID_H} strokeWidth={1} />
            <text x={W - AX_R + 8} y={py(p, KLINE_H) + 6} fill={TXT} fontSize={22}>¥{fmt(p)}</text>
          </g>
        ))}
        {/* 時間グリッド */}
        {TIME_LABELS.map((h, i) => {
          const x = ((i + 0.5) / TIME_LABELS.length) * (W - AX_R);
          return (
            <g key={h}>
              <line x1={x} y1={32} x2={x} y2={KLINE_H} stroke={GRID} strokeWidth={1} />
              <text x={x} y={KLINE_H - 4} fill={TXT} fontSize={19} textAnchor="middle">{h}</text>
            </g>
          );
        })}
        {/* 昼休みゾーン */}
        {(() => {
          const x1 = (5.5 / TIME_LABELS.length) * (W - AX_R);
          const x2 = (6.5 / TIME_LABELS.length) * (W - AX_R);
          return <rect x={x1} y={30} width={x2 - x1} height={KLINE_H - 40} fill="rgba(0,0,0,0.015)" />;
        })()}

        {/* 一目均衡表の雲（先行スパンA/Bを26期前へずらして描画）*/}
        {(() => {
          const SHIFT = 26;
          const aPts: [number, number][] = [], bPts: [number, number][] = [];
          let aLast = 0, bLast = 0;
          for (let i = 0; i < visCandles.length; i++) {
            const di = vStart + i - SHIFT;
            if (di < 0) continue;
            const a = data.ichimoku.spanA[di], b = data.ichimoku.spanB[di];
            if (a == null || b == null) continue;
            aPts.push([ix(i), py(a, KLINE_H)]);
            bPts.unshift([ix(i), py(b, KLINE_H)]);
            aLast = a; bLast = b;
          }
          if (aPts.length < 2) return null;
          return <polygon points={[...aPts, ...bPts].map(([x, y]) => `${x},${y}`).join(' ')}
            fill={aLast >= bLast ? 'rgba(232,57,43,0.07)' : 'rgba(26,110,221,0.07)'} />;
        })()}

        {/* BBバンド */}
        {(() => {
          const pts: [number,number][] = [], lo: [number,number][] = [];
          for (let i = 0; i < visCandles.length; i++) {
            const di = vStart + i;
            if (data.bb.up[di] == null) continue;
            pts.push([ix(i), py(data.bb.up[di]!, KLINE_H)]);
            lo.unshift([ix(i), py(data.bb.lo[di]!, KLINE_H)]);
          }
          if (pts.length < 2) return null;
          return <polygon points={[...pts, ...lo].map(([x,y]) => `${x},${y}`).join(' ')} fill="rgba(0,0,0,0.018)" />;
        })()}
        {(['up','lo'] as const).map(band => {
          const pts: [number,number][] = [];
          for (let i = 0; i < visCandles.length; i++) {
            const v = (data.bb as any)[band][vStart + i];
            if (v == null) continue;
            pts.push([ix(i), py(v, KLINE_H)]);
          }
          return pts.length > 1
            ? <polyline key={band} points={polyln(pts)} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={1} strokeDasharray="6,4" />
            : null;
        })}

        {/* MA5 */}
        {(() => {
          const pts: [number,number][] = [];
          for (let i = 0; i < visCandles.length; i++) {
            const v = data.ma5[vStart + i];
            if (v == null) continue;
            pts.push([ix(i), py(v, KLINE_H)]);
          }
          return pts.length > 1 ? <polyline points={polyln(pts)} fill="none" stroke={MA5} strokeWidth={1.8} opacity={0.85} /> : null;
        })()}

        {/* MA25 */}
        {(() => {
          const pts: [number,number][] = [];
          for (let i = 0; i < visCandles.length; i++) {
            const v = data.ma25[vStart + i];
            if (v == null) continue;
            pts.push([ix(i), py(v, KLINE_H)]);
          }
          return pts.length > 1 ? <polyline points={polyln(pts)} fill="none" stroke={MA25} strokeWidth={1.8} opacity={0.85} /> : null;
        })()}

        {/* 一目均衡表 転換線(9) / 基準線(26) */}
        {(['tenkan', 'kijun'] as const).map(key => {
          const pts: [number, number][] = [];
          for (let i = 0; i < visCandles.length; i++) {
            const v = data.ichimoku[key][vStart + i];
            if (v == null) continue;
            pts.push([ix(i), py(v, KLINE_H)]);
          }
          return pts.length > 1
            ? <polyline key={key} points={polyln(pts)} fill="none"
                stroke={key === 'tenkan' ? '#0AA0C8' : '#9333EA'} strokeWidth={1.2} opacity={0.55} />
            : null;
        })}

        {/* ローソク足 */}
        {visCandles.map((c, i) => {
          const x    = ix(i);
          const isUp = c.c >= c.o;
          const col  = isUp ? UP : DOWN;
          const bTop = py(Math.max(c.o, c.c), KLINE_H);
          const bBot = py(Math.min(c.o, c.c), KLINE_H);
          const bH   = Math.max(1, bBot - bTop);
          return (
            <g key={i}>
              <line x1={x} y1={py(c.h, KLINE_H)} x2={x} y2={py(c.l, KLINE_H)} stroke={col} strokeWidth={1.5} />
              <rect x={x - BODY_W / 2} y={bTop} width={BODY_W} height={bH} fill={col} rx={1.5} />
            </g>
          );
        })}

        {/* 現在値ライン */}
        {last && (() => {
          const yp = py(last.c, KLINE_H);
          return (
            <>
              <line x1={0} y1={yp} x2={W - AX_R} y2={yp} stroke={lastUp ? UP : DOWN} strokeWidth={4} opacity={glowOp + 0.1} />
              <line x1={0} y1={yp} x2={W - AX_R} y2={yp} stroke={lastUp ? UP : DOWN} strokeWidth={1} strokeDasharray="5,4" opacity={0.7} />
              <rect x={W - AX_R} y={yp - 18} width={AX_R} height={36} fill={lastUp ? UP : DOWN} rx={3} />
              <text x={W - AX_R + 8} y={yp + 8} fill="#fff" fontSize={22} fontWeight={700}>¥{fmt(last.c)}</text>
            </>
          );
        })()}

        {/* MA凡例 */}
        <rect x={W - 280} y={6} width={12} height={12} fill={MA5}  rx={2} />
        <text x={W - 262} y={18} fill={TXT} fontSize={20}>MA5</text>
        <rect x={W - 210} y={6} width={12} height={12} fill={MA25} rx={2} />
        <text x={W - 192} y={18} fill={TXT} fontSize={20}>MA25</text>
      </svg>

      {/* ── 出来高 ───────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: VOL_Y - 4, left: 0, width: W, height: 1, background: 'rgba(0,0,0,0.07)' }} />
      <svg style={{ position: 'absolute', top: VOL_Y, left: 0 }} width={W} height={VOL_H}>
        <text x={12} y={28} fill={TXT} fontSize={25} fontWeight={700}>出来高</text>
        <line x1={0} y1={VOL_H / 2} x2={W - AX_R} y2={VOL_H / 2} stroke={GRID} strokeWidth={1} />
        {visCandles.map((c, i) => {
          const x = ix(i), isUp = c.c >= c.o;
          const h = Math.max(1, (c.v / maxVol) * (VOL_H - 38));
          return <rect key={i} x={x - BODY_W / 2} y={VOL_H - h - 4} width={BODY_W} height={h}
            fill={isUp ? UP_DIM : DOWN_DIM} rx={1.5} />;
        })}
        <text x={W - AX_R + 8} y={44} fill={TXT} fontSize={21}>{fmt(maxVol / 1000)}千株</text>
      </svg>

      {/* ── MACD ─────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: MACD_Y - 4, left: 0, width: W, height: 1, background: 'rgba(0,0,0,0.07)' }} />
      <svg style={{ position: 'absolute', top: MACD_Y, left: 0 }} width={W} height={MACD_H}>
        <text x={12} y={28} fill={TXT} fontSize={25} fontWeight={700}>MACD(12,26,9)</text>
        <line x1={0} y1={MACD_H / 2} x2={W - AX_R} y2={MACD_H / 2} stroke={GRID_H} strokeWidth={1} />
        {mSlice.map((v, i) => {
          const h = Math.abs(my(v) - MACD_H / 2);
          const y0 = v >= 0 ? MACD_H / 2 - h : MACD_H / 2;
          return <rect key={i} x={ix(i) - BODY_W * 0.4} y={y0} width={BODY_W * 0.8} height={Math.max(1, h)}
            fill={v >= 0 ? UP_DIM : DOWN_DIM} rx={1} />;
        })}
        {macSlice.length > 1 && <polyline points={polyln(macSlice.map((v, i) => [ix(i), my(v)] as [number,number]))}
          fill="none" stroke="#1A6EDD" strokeWidth={1.5} opacity={0.8} />}
        {sigSlice.length > 1 && <polyline points={polyln(sigSlice.map((v, i) => [ix(i), my(v)] as [number,number]))}
          fill="none" stroke={MA5} strokeWidth={1.8} opacity={0.9} />}
      </svg>

      {/* ── 需給動向 ──────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: FLOW_Y - 4, left: 0, width: W, height: 1, background: 'rgba(0,0,0,0.07)' }} />
      <svg style={{ position: 'absolute', top: FLOW_Y, left: 0 }} width={W} height={FLOW_H}>
        <text x={12} y={28} fill={TXT} fontSize={25} fontWeight={700}>需給動向</text>
        <text x={154} y={28} fill="rgba(0,0,0,0.22)" fontSize={21}>外国人 / 法人 (億円)</text>
        <line x1={0} y1={FLOW_H / 2} x2={W - AX_R} y2={FLOW_H / 2} stroke={GRID_H} strokeWidth={1} />
        {fSlice.map((f, i) => {
          const x = ix(i);
          const hf = Math.abs(fy(f.foreign) - FLOW_H / 2);
          const hi = Math.abs(fy(f.corp) - FLOW_H / 2);
          return (
            <g key={i}>
              <rect x={x - BODY_W * 0.45} y={f.foreign >= 0 ? FLOW_H / 2 - hf : FLOW_H / 2}
                width={BODY_W * 0.44} height={Math.max(1, hf)}
                fill={f.foreign >= 0 ? UP_DIM : DOWN_DIM} rx={1} />
              <rect x={x} y={f.corp >= 0 ? FLOW_H / 2 - hi : FLOW_H / 2}
                width={BODY_W * 0.44} height={Math.max(1, hi)}
                fill={f.corp >= 0 ? 'rgba(255,160,0,0.55)' : 'rgba(80,80,160,0.55)'} rx={1} />
            </g>
          );
        })}
        <rect x={W - 270} y={7} width={14} height={14} fill={UP_DIM} rx={2} />
        <text x={W - 250} y={21} fill={TXT} fontSize={20}>外国人</text>
        <rect x={W - 168} y={7} width={14} height={14} fill="rgba(255,160,0,0.70)" rx={2} />
        <text x={W - 148} y={21} fill={TXT} fontSize={20}>法人</text>
      </svg>

      {/* ── 市場概況 ─────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: BOT_Y - 4, left: 0, width: W, height: 1, background: 'rgba(0,0,0,0.07)' }} />
      <div style={{
        position: 'absolute', top: BOT_Y, left: 0, width: W, height: BOT_H,
        padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 9,
      }}>
        <div style={{ fontSize: 25, fontWeight: 700, color: TXT }}>市場概況</div>
        <div style={{ display: 'flex', gap: 20, fontSize: 30, fontWeight: 600 }}>
          <span style={{ color: UP }}>値上がり {mktRnd.up.toLocaleString('ja-JP')}</span>
          <span style={{ color: 'rgba(0,0,0,0.32)' }}>変わらず {mktRnd.flat.toLocaleString('ja-JP')}</span>
          <span style={{ color: DOWN }}>値下がり {mktRnd.down.toLocaleString('ja-JP')}</span>
        </div>
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', width: W - 40 }}>
          <div style={{ flex: mktRnd.up, background: UP, opacity: 0.55 }} />
          <div style={{ flex: mktRnd.flat, background: 'rgba(0,0,0,0.07)' }} />
          <div style={{ flex: mktRnd.down, background: DOWN, opacity: 0.55 }} />
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 27, color: TXT }}>
          <span>ストップ高 <span style={{ color: UP }}>{mktRnd.sHi}</span></span>
          <span>ストップ安 <span style={{ color: DOWN }}>{mktRnd.sLo}</span></span>
          <span>売買代金 <span style={{ color: 'rgba(0,0,0,0.55)', fontWeight: 600 }}>{mktRnd.to}兆円</span></span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 25, marginTop: 2 }}>
          {mktRnd.bot.map((d, i) => (
            <span key={i} style={{ display: 'inline-flex', gap: 6 }}>
              <span style={{ color: TXT }}>{d.label}</span>
              <span style={{ color: d.up ? UP : DOWN, fontWeight: 600 }}>{d.val}</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span style={{ color: TXT, fontSize: 23 }}>東京証券取引所 プライム市場</span>
          <span style={{ color: 'rgba(0,0,0,0.25)', fontSize: 23, fontVariantNumeric: 'tabular-nums' }}>
            JST {timeStr}
          </span>
        </div>
      </div>

      {/* 暗化オーバーレイ */}
      <div style={{ position: 'absolute', inset: 0, background: `rgba(247,248,250,${overlay})`, pointerEvents: 'none' }} />
    </div>
  );
};
