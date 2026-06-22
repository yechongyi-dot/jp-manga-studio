import React, { useMemo } from 'react';

export interface RakutenBgProps {
  frame:    number;
  seed?:    number;
  overlay?: number;
}

// ── PRNG ───────────────────────────────────────────────────────────────────
function m32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fmt(n: number) { return Math.abs(Math.round(n)).toLocaleString('ja-JP'); }

// ── 銘柄プール ─────────────────────────────────────────────────────────────
const POOL = [
  { name: 'ファーストリテイリング', code: '9983', p: 55800 },
  { name: '新家工業',               code: '7305', p: 630   },
  { name: 'ムゲンエステート',       code: '3299', p: 462   },
  { name: 'TOWA',                   code: '6315', p: 4250  },
  { name: '三井金属',               code: '5706', p: 3720  },
  { name: 'Arent',                  code: '5254', p: 4890  },
  { name: '太平洋興発',             code: '8835', p: 2780  },
  { name: 'パナソニック ホールD',   code: '6752', p: 1980  },
  { name: 'モバイルファクトリー',   code: '3912', p: 3460  },
  { name: '日本電波工業',           code: '6779', p: 4310  },
  { name: '出前館',                 code: '2484', p: 198   },
  { name: 'リケンNPR',              code: '6209', p: 4090  },
  { name: 'サンリオ',               code: '8136', p: 4870  },
  { name: 'グローバル・リンク・',   code: '3486', p: 2560  },
  { name: '両毛システムズ',         code: '9691', p: 3210  },
  { name: '昭和ホールディングス',   code: '5103', p: 1280  },
  { name: '理研計器',               code: '7734', p: 2920  },
  { name: 'スクリーンホールディ',   code: '4004', p: 12640 },
  { name: '竹内製作所',             code: '6432', p: 4380  },
  { name: 'イワキ',                 code: '6237', p: 3890  },
  { name: '巴工業',                 code: '6309', p: 3580  },
  { name: '三陽商会',               code: '8011', p: 1920  },
  { name: '東レ',                   code: '3402', p: 1340  },
  { name: '住友金属鉱山',           code: '5713', p: 7850  },
  { name: 'TPR',                    code: '6463', p: 4170  },
  { name: '北川鉄工所',             code: '6317', p: 2890  },
  { name: 'オープンワーク',         code: '5139', p: 1860  },
  { name: '小森コーポレーション',   code: '6349', p: 3410  },
  { name: 'クルーズ',               code: '2138', p: 3620  },
  { name: 'SCREENホールディ',       code: '7735', p: 13200 },
  { name: 'トヨタ自動車',           code: '7203', p: 3820  },
  { name: '日立製作所',             code: '6501', p: 4180  },
  { name: '三菱UFJFG',              code: '8306', p: 1842  },
  { name: 'ソフトバンクG',          code: '9984', p: 5244  },
  { name: 'キーエンス',             code: '6861', p: 65230 },
  { name: '任天堂',                 code: '7974', p: 8690  },
  { name: 'ソニーグループ',         code: '6758', p: 13640 },
];

interface Row { name: string; code: string; pl: number; shares: number; evalK: number; }
interface Portfolio { stocks: Row[]; total: number; daily: number; }

function gen(seed: number): Portfolio {
  const rng = m32(seed);
  // Fisher-Yates shuffle（確定的）
  const arr = [...POOL];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const shuffled = arr.slice(0, 30);
  let evalTotal = 0;
  const stocks = shuffled.map(s => {
    const maxLots = Math.max(1, Math.floor(20_000_000 / s.p / 100));
    const shares  = Math.round(1 + rng() * maxLots) * 100;
    const buyP    = Math.round(s.p * (0.45 + rng() * 0.47));
    const pl      = Math.round((s.p - buyP) * shares);
    const evalYen = s.p * shares;
    evalTotal    += evalYen;
    return { name: s.name, code: s.code, pl, shares, evalK: Math.round(evalYen / 1000) };
  });
  const total = evalTotal + Math.round(evalTotal * (0.04 + rng() * 0.14));
  const daily = Math.round(evalTotal * (0.008 + rng() * 0.082));
  return { stocks, total, daily };
}

// ── 定数 ──────────────────────────────────────────────────────────────────
const W        = 1080;
const NAV_H    = 128;   // ナビゲーションバー
const SUBNAV_H = 62;    // 金額非表示バー
const ASSET_H  = 240;   // 資産合計セクション
const HEADER_H = NAV_H + SUBNAV_H + ASSET_H; // 430px
const ROW_H    = 178;   // 1行の高さ
const SPEED    = 1.25;  // px/frame

// ── カラー（Rakuten ブランド完全準拠）──────────────────────────────────────
const FONT   = "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif";
const MONO   = "'Consolas','SF Mono','Courier New',monospace";
const RAK    = '#BF0000';
const UP     = '#E6001A';
const DN     = '#0050B3';
const TEAL   = '#007DC5';
const SB     = '#EAF1FC';
const ST     = '#2756C8';
const BORDER = '#E8E8E8';
const TXT    = '#1A1A1A';
const TXT2   = '#888888';

// ── SVG アイコン ──────────────────────────────────────────────────────────
const EyeIcon = () => (
  <svg width="36" height="26" viewBox="0 0 40 28" style={{ display: 'block' }}>
    <ellipse cx="20" cy="14" rx="19" ry="13" fill="none" stroke={TEAL} strokeWidth="3"/>
    <circle cx="20" cy="14" r="6" fill={TEAL}/>
    <circle cx="20" cy="14" r="3" fill="white"/>
  </svg>
);

// ── ナビアイコン ──────────────────────────────────────────────────────────
const NavBtn: React.FC<{ sym: string; label: string }> = ({ sym, label }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
    <div style={{
      width: 54, height: 54, borderRadius: 27,
      border: `1.5px solid ${TXT2}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: 24, color: TXT2, fontFamily: FONT, fontWeight: 700, lineHeight: 1 }}>
        {sym}
      </span>
    </div>
    <span style={{ fontFamily: FONT, fontSize: 19, color: TXT2 }}>{label}</span>
  </div>
);

// ── 銘柄行 ────────────────────────────────────────────────────────────────
const StockRow: React.FC<{ s: Row }> = ({ s }) => (
  <div style={{
    height: ROW_H,
    borderBottom: `1px solid ${BORDER}`,
    background: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    padding: '0 44px',
  }}>
    {/* 左: 銘柄名 + コード */}
    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
      <div style={{
        fontFamily: FONT, fontSize: 44, fontWeight: 700, color: TXT,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        lineHeight: 1.25, marginBottom: 10,
      }}>
        {s.name}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 30, color: TXT2, lineHeight: 1 }}>
        {s.code}
      </div>
    </div>

    {/* 中: 売埋バッジ + 評価損益（右揃え）*/}
    <div style={{
      width: 300, flexShrink: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12,
    }}>
      <span style={{ fontFamily: FONT, fontSize: 26, fontWeight: 500, color: TEAL }}>
        売埋
      </span>
      <span style={{
        fontFamily: MONO, fontSize: 44, fontWeight: 700,
        color: s.pl >= 0 ? UP : DN,
        letterSpacing: '-1px',
      }}>
        {s.pl >= 0 ? '+' : '−'}{fmt(s.pl)}
      </span>
    </div>

    {/* 右: 保有株数 + 評価額（右揃え）*/}
    <div style={{
      width: 210, flexShrink: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 40, color: TXT, letterSpacing: '-0.5px' }}>
        {fmt(s.shares)}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 36, color: TXT2, letterSpacing: '-0.5px' }}>
        {fmt(s.evalK)}
      </span>
    </div>
  </div>
);

// ── メインコンポーネント ──────────────────────────────────────────────────
export const RakutenBg: React.FC<RakutenBgProps> = ({ frame, seed = 42, overlay = 0 }) => {
  const { stocks, total, daily } = useMemo(() => gen(seed), [seed]);

  const LIST_H  = stocks.length * ROW_H;
  const scrollY = (frame * SPEED) % LIST_H;
  const isUp    = daily >= 0;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: W, height: 1920,
      background: '#FFFFFF', overflow: 'hidden',
    }}>

      {/* ═══════════ 固定ヘッダー ═══════════ */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_H,
        background: '#FFFFFF', zIndex: 10,
        borderBottom: `2px solid ${BORDER}`,
      }}>

        {/* ── ナビゲーションバー ── */}
        <div style={{
          height: NAV_H,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px',
          borderBottom: `1px solid ${BORDER}`,
        }}>
          {/* LEFT: ≡メニュー + Rakuten楽天証券ロゴ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 38 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ height: 3, background: TXT2, borderRadius: 2 }} />
                ))}
              </div>
              <span style={{ fontFamily: FONT, fontSize: 20, color: TXT2 }}>メニュー</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{
                fontFamily: "'Arial Black','Helvetica Neue',Arial,sans-serif",
                fontSize: 52, fontWeight: 900, color: RAK,
                letterSpacing: '-1px', lineHeight: 1,
              }}>Rakuten</span>
              <span style={{
                fontFamily: FONT, fontSize: 32, fontWeight: 800, color: RAK,
                letterSpacing: '2px', lineHeight: 1,
              }}>楽天証券</span>
            </div>
          </div>

          {/* RIGHT: 右アイコン群 */}
          <div style={{ display: 'flex', gap: 24 }}>
            <NavBtn sym="？" label="サポート" />
            <NavBtn sym="！" label="お知らせ" />
            <NavBtn sym="三" label="マイメニュー" />
          </div>
        </div>

        {/* ── 金額非表示 / 保有商品一覧 ── */}
        <div style={{
          height: SUBNAV_H,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 34px',
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <EyeIcon />
            <span style={{ fontFamily: FONT, fontSize: 23, color: TEAL, fontWeight: 500 }}>
              金額非表示
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: FONT, fontSize: 23, color: TEAL, fontWeight: 500 }}>
              保有商品一覧
            </span>
            <span style={{ fontSize: 30, color: TEAL, lineHeight: 1 }}>›</span>
          </div>
        </div>

        {/* ── 資産合計セクション ── */}
        <div style={{
          height: ASSET_H,
          padding: '20px 34px 20px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          {/* 上段: 資産合計ラベル + 合計金額 */}
          <div style={{
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontFamily: FONT, fontSize: 40, fontWeight: 700, color: TXT, lineHeight: 1 }}>
                資産合計
              </span>
              <span style={{ fontFamily: FONT, fontSize: 22, color: TXT2, lineHeight: 1 }}>
                ※楽天銀行残高除く
              </span>
            </div>
            <div style={{ textAlign: 'right', lineHeight: 1 }}>
              <span style={{
                fontFamily: MONO, fontSize: 78, fontWeight: 900, color: TXT,
                letterSpacing: '-2px',
              }}>
                {fmt(total)}
              </span>
              <span style={{
                fontFamily: FONT, fontSize: 64, fontWeight: 700, color: TXT,
                marginLeft: 4,
              }}>
                円
              </span>
            </div>
          </div>

          {/* 前日比行 */}
          <div style={{
            marginTop: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              border: `1.5px solid #C8C8C8`, borderRadius: 8,
              padding: '10px 24px',
            }}>
              <span style={{ fontFamily: FONT, fontSize: 32, color: TXT, fontWeight: 400 }}>
                前日比
              </span>
              <span style={{ fontSize: 24, color: TXT, lineHeight: 1 }}>▼</span>
            </div>
            <div style={{ lineHeight: 1 }}>
              <span style={{
                fontFamily: MONO, fontSize: 68, fontWeight: 900,
                color: isUp ? UP : DN, letterSpacing: '-2px',
              }}>
                {isUp ? '+' : '−'}{fmt(daily)}
              </span>
              <span style={{
                fontFamily: FONT, fontSize: 56, fontWeight: 700,
                color: isUp ? UP : DN, marginLeft: 4,
              }}>
                円
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ スクロールリスト ═══════════ */}
      <div style={{
        position: 'absolute', top: HEADER_H, left: 0, right: 0,
        height: 1920 - HEADER_H, overflow: 'hidden',
      }}>
        <div style={{ transform: `translateY(-${scrollY}px)` }}>
          {stocks.map((s, i) => <StockRow key={i} s={s} />)}
          {stocks.map((s, i) => <StockRow key={stocks.length + i} s={s} />)}
        </div>
      </div>

      {/* オーバーレイ */}
      {overlay > 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          background: `rgba(247,248,250,${overlay})`,
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
};
