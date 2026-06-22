import React from 'react';
import {
  AbsoluteFill, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import type { JpStockItem } from '../../types';
import { pctTrend } from '../../types';
import { jpCard, type JpTheme } from './jpTheme';

/**
 * JpStockScene — 通用个股展示场景（传 theme，JpPrime/JpBroadcast 等个股套复用）
 * 白卡 + 深色字 + 红蓝 accent，背景与配色全从 theme 取。
 */

interface Props {
  item:        JpStockItem;
  index:       number;
  globalFrame: number;
  seed?:       number;
  topPad?:     number;
  theme:       JpTheme;
}

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const FONT  = "'Noto Sans JP','Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";
const MONO  = "'Roboto Mono','SF Mono','Consolas',monospace";

export const JpStockScene: React.FC<Props> = ({ item, index, globalFrame, seed, topPad = 600, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { up, down, mystery, ink, inkDim, accent: themeAccent, Bg, bgOverlay } = theme;

  const isMystery = item.name === '';
  const isUp   = !item.pct.startsWith('-');
  const accent = isMystery ? mystery : (isUp ? up : down);
  const trend  = pctTrend(item.pct);
  const arrow  = isUp ? '▲' : '▼';

  const headOp = interpolate(frame, [0, 14], [0, 1], clamp);
  const headY  = spring({ frame, fps, config: { damping: 20, stiffness: 300 }, from: -44, to: 0 });
  const panelOp = interpolate(frame, [20, 36], [0, 1], clamp);
  const panelY  = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 18, stiffness: 220 }, from: 40, to: 0 });

  const rawPct = parseFloat(item.pct.replace(/[^0-9.\-]/g, ''));
  const counted = interpolate(frame, [34, 66], [0, rawPct], clamp);
  const displayPct = frame < 66 ? (rawPct >= 0 ? '+' : '') + counted.toFixed(1) + '%' : item.pct;

  const card = jpCard(theme, themeAccent);

  return (
    <AbsoluteFill>
      <Bg frame={globalFrame} trend={trend} overlay={bgOverlay} seed={seed} />

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        paddingLeft: 48, paddingRight: 48, paddingTop: topPad, paddingBottom: 300,
      }}>
        {/* 上部主体卡 */}
        <div style={{
          transform: `translateY(${headY}px)`, opacity: headOp, marginBottom: 22,
          background: `linear-gradient(135deg, ${themeAccent}26 0%, ${themeAccent}10 100%), #FFFFFF`,
          borderRadius: 18, borderLeft: `10px solid ${accent}`, padding: '20px 26px 22px',
          boxShadow: `0 14px 38px ${themeAccent}33, 0 1px 0 rgba(255,255,255,0.85) inset`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 52, height: 52, borderRadius: 11, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 5px 16px ${accent}66` }}>
              <span style={{ fontFamily: MONO, fontWeight: 900, fontSize: 34, color: '#fff' }}>{isMystery ? '?' : index + 1}</span>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 37, fontWeight: 800, color: ink, letterSpacing: '2px' }}>{isMystery ? '??????' : item.code}</span>
            <div style={{ padding: '6px 15px', borderRadius: 8, background: `${accent}1F`, border: `1px solid ${accent}66` }}>
              <span style={{ fontFamily: FONT, fontSize: 33, fontWeight: 800, color: accent }}>{isUp ? '強気' : '弱気'}</span>
            </div>
          </div>
          <div style={{ height: 1.5, background: `linear-gradient(90deg, transparent, ${themeAccent}30 18%, ${themeAccent}30 82%, transparent)`, margin: '14px 0' }} />
          <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: item.name.length > 8 ? 84 : 99, color: ink, lineHeight: 1.1, letterSpacing: '-1px' }}>{isMystery ? 'ミステリー銘柄' : item.name}</span>
        </div>

        {/* 下部 3 栏 panel */}
        <div style={{ transform: `translateY(${panelY}px)`, opacity: panelOp, ...card, padding: '30px 30px' }}>
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: MONO, fontSize: 39, fontWeight: 600, color: inkDim, marginBottom: 10 }}>買値</div>
              <div style={{ fontFamily: MONO, fontSize: 62, fontWeight: 700, color: ink }}>{item.buyPrice}</div>
            </div>
            <div style={{ width: 1, background: `${themeAccent}22`, margin: '4px 0' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: MONO, fontSize: 39, fontWeight: 600, color: inkDim, marginBottom: 10 }}>目標株価</div>
              <div style={{ fontFamily: MONO, fontSize: 62, fontWeight: 700, color: accent }}>{item.shortTarget || item.targetPrice || '—'}</div>
            </div>
            <div style={{ width: 1, background: `${themeAccent}22`, margin: '4px 0' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              {/* 利回り訴求タイプ（高配当/優待）はここを利回りに。それ以外は予想上昇率。データ駆動。 */}
              {item.dividend ? (
                <>
                  <div style={{ fontFamily: MONO, fontSize: 39, fontWeight: 600, color: inkDim, marginBottom: 10 }}>{item.yutai ? '総合利回り' : '配当利回り'}</div>
                  <div style={{ fontFamily: MONO, fontSize: 62, fontWeight: 700, color: up }}>{item.dividend}</div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: MONO, fontSize: 39, fontWeight: 600, color: inkDim, marginBottom: 10 }}>予想上昇率</div>
                  <div style={{ fontFamily: MONO, fontSize: 62, fontWeight: 700, color: accent }}>{arrow} {displayPct}</div>
                </>
              )}
            </div>
          </div>
          {/* 株主優待の実データ行（優待タイプのみ・みんかぶ実取得） */}
          {item.yutai && (item.yutai.perkContent || item.yutai.minShares) && (
            <div style={{
              marginTop: 16, paddingTop: 16, borderTop: `1px solid ${accent}22`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14,
            }}>
              <span style={{ fontFamily: FONT, fontSize: 36, color: inkDim, fontWeight: 700, whiteSpace: 'nowrap' }}>株主優待</span>
              <span style={{ fontFamily: FONT, fontSize: 38, fontWeight: 800, color: ink, textAlign: 'right', lineHeight: 1.2 }}>
                {[item.yutai.minShares && `${item.yutai.minShares}〜`, item.yutai.perkContent, item.yutai.recordMonths && `権利${item.yutai.recordMonths}`].filter(Boolean).join('　')}
              </span>
            </div>
          )}
          {item.finalTarget && (
            <div style={{
              marginTop: 16, paddingTop: 16, borderTop: `1px solid ${accent}22`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontFamily: MONO, fontSize: 39, color: inkDim, fontWeight: 600, letterSpacing: '1px' }}>最終目標</span>
              <span style={{ fontFamily: MONO, fontSize: 62, fontWeight: 800, color: up }}>{item.finalTarget}</span>
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
