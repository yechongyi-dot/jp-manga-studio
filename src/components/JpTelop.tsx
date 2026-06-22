import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';

export interface TelopData {
  badge?:   string;   // 左バッジ "第1位" / "注目銘柄" / "チャンネル登録"
  name:     string;   // 銘柄名 or チャンネル名（メインテキスト）
  code?:    string;   // 銘柄コード "6758"
  price?:   string;   // 買値 "¥13,200"
  pct?:     string;   // 上昇率 "+50.00%"
  sub?:     string;   // 補足テキスト（CTA用 "LINE @xxxx" など）
  accent:   string;   // アクセントカラー
  frame:    number;   // 親シーンのフレーム
}

const FONT = "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif";
const MONO = "'Consolas','SF Mono','Courier New',monospace";

// 8方向テキストアウトライン（日本バラエティ番組テロップ風）
function telop(color: string, size = 2): string {
  const dirs = [[-1,-1],[ 0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  return dirs.map(([x,y]) => `${x*size}px ${y*size}px 0 ${color}`).join(', ');
}

export const JpTelop: React.FC<TelopData> = ({
  badge, name, code, price, pct, sub, accent, frame,
}) => {
  const { fps } = useVideoConfig();

  const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

  // スライドイン（下から）
  const slideY = spring({ frame: Math.max(0, frame), fps,
    config: { damping: 24, stiffness: 280 }, from: 140, to: 0 });
  const opacity = interpolate(frame, [0, 8], [0, 1], clamp);

  // パーセントバッジ拡大（少し遅れて）
  const pctScale = spring({ frame: Math.max(0, frame - 8), fps,
    config: { damping: 12, stiffness: 320 }, from: 0.4, to: 1 });

  // パルスグロー
  const glow = 12 + 6 * Math.sin(frame * 0.20);
  const dot  = 0.75 + 0.25 * Math.sin(frame * 0.18);

  const isUp = pct ? !pct.startsWith('-') : true;
  const arrow = isUp ? '▲' : '▼';

  // アクセントカラーの暗い版（背景用）
  const accentBg = `${accent}22`;
  const accentBd = `${accent}88`;

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      transform: `translateY(${slideY}px)`,
      opacity,
      pointerEvents: 'none',
    }}>
      {/* ── グラデーションフェード ── */}
      <div style={{
        height: 110,
        background: 'linear-gradient(to bottom, transparent, rgba(4,6,14,0.82))',
      }} />

      {/* ── メインバー ── */}
      <div style={{
        background: 'rgba(4,6,14,0.93)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'stretch',
        minHeight: 160,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* 左アクセントストライプ */}
        <div style={{
          width: 7, background: accent, flexShrink: 0,
          boxShadow: `0 0 ${glow}px ${accent}`,
        }} />

        {/* ── コンテンツエリア ── */}
        <div style={{
          flex: 1, padding: '18px 28px 18px 22px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12,
        }}>

          {/* 上段: バッジ + 銘柄名 + コード */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'nowrap' }}>

            {/* ● パルスドット */}
            <div style={{
              width: 11, height: 11, borderRadius: 6,
              background: accent, flexShrink: 0,
              boxShadow: `0 0 ${glow}px ${accent}`,
              opacity: dot,
            }} />

            {/* カテゴリバッジ */}
            {badge && (
              <div style={{
                background: accent,
                borderRadius: 8, padding: '4px 16px',
                flexShrink: 0,
                boxShadow: `0 2px 12px ${accent}66`,
              }}>
                <span style={{
                  fontFamily: FONT, fontSize: 26, fontWeight: 900,
                  color: '#fff',
                  textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                  letterSpacing: '0.5px',
                }}>
                  {badge}
                </span>
              </div>
            )}

            {/* 銘柄名（テロップ風アウトライン） */}
            <span style={{
              fontFamily: FONT, fontSize: 46, fontWeight: 900,
              color: '#FFFFFF',
              textShadow: telop('rgba(0,0,0,0.85)', 2),
              lineHeight: 1,
              letterSpacing: '-0.5px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {name}
            </span>

            {/* 銘柄コードバッジ */}
            {code && code.trim() && (
              <div style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 8, padding: '3px 14px',
                flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: MONO, fontSize: 26, fontWeight: 700,
                  color: 'rgba(255,255,255,0.60)',
                  letterSpacing: '2px',
                }}>
                  {code}
                </span>
              </div>
            )}
          </div>

          {/* 下段: 価格 + 上昇率 or 補足テキスト */}
          {(price || pct || sub) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>

              {price && (
                <span style={{
                  fontFamily: MONO, fontSize: 34, fontWeight: 700,
                  color: 'rgba(255,255,255,0.82)',
                  textShadow: '0 1px 6px rgba(0,0,0,0.5)',
                }}>
                  {price}
                </span>
              )}

              {price && pct && (
                <span style={{
                  fontFamily: FONT, fontSize: 28,
                  color: 'rgba(255,255,255,0.30)',
                }}>
                  →
                </span>
              )}

              {/* 上昇率バッジ（メインの見どころ） */}
              {pct && (
                <div style={{
                  transform: `scale(${pctScale})`, transformOrigin: 'left center',
                  background: accentBg,
                  border: `2px solid ${accentBd}`,
                  borderRadius: 10, padding: '6px 20px',
                  boxShadow: `0 0 ${glow}px ${accent}44`,
                }}>
                  <span style={{
                    fontFamily: FONT, fontSize: 42, fontWeight: 900,
                    color: accent,
                    textShadow: [
                      telop('rgba(0,0,0,0.7)', 2),
                      `0 0 20px ${accent}66`,
                    ].join(', '),
                    letterSpacing: '0.5px',
                  }}>
                    {arrow} {pct}
                  </span>
                </div>
              )}

              {/* 補足テキスト（CTA等） */}
              {sub && !pct && (
                <span style={{
                  fontFamily: FONT, fontSize: 30, fontWeight: 600,
                  color: 'rgba(255,255,255,0.62)',
                  textShadow: telop('rgba(0,0,0,0.5)', 1),
                }}>
                  {sub}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 右側装飾ライン（アクセント色のグロー） */}
        <div style={{
          width: 3, background: `linear-gradient(to bottom, transparent, ${accent}, transparent)`,
          opacity: 0.4 + 0.2 * Math.sin(frame * 0.12),
          flexShrink: 0,
        }} />
      </div>
    </div>
  );
};
