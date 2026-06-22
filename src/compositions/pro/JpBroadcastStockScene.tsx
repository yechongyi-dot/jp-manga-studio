import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { JpStockItem } from '../../types';
import { jpCard, type JpTheme } from './jpTheme';

/**
 * JpBroadcastStockScene — 「财经速报」专属前景（紧迫速报版式）。
 * 区别于 Prime 简约：緊急 角标 + 超大涨幅强调 + 買値→目標株価，速报冲击感。配暖 K 线背景。
 */
interface Props { item: JpStockItem; index: number; globalFrame: number; seed?: number; theme: JpTheme; }

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const FONT  = "'Noto Sans JP','Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";
const MONO  = "'Roboto Mono','SF Mono','Consolas',monospace";

const FLAGS = ['🚨 急騰間近', '🚨 短期急騰', '🚨 買いシグナル', '🚨 出来高急増', '🚨 トレンド転換'];

export const JpBroadcastStockScene: React.FC<Props> = ({ item, index, globalFrame, seed, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { ink, inkDim, accent, up, down, mystery, Bg, bgOverlay } = theme;
  const isMystery = item.name === '';
  const isUp = !item.pct.startsWith('-');
  const pctCol = isMystery ? mystery : (isUp ? up : down);
  const flag = FLAGS[index % 5];

  const headOp = interpolate(frame, [0, 14], [0, 1], clamp);
  const headY  = spring({ frame, fps, config: { damping: 20, stiffness: 300 }, from: -44, to: 0 });
  const panelOp = interpolate(frame, [20, 36], [0, 1], clamp);
  const panelY  = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 18, stiffness: 220 }, from: 40, to: 0 });

  const rawPct = parseFloat(item.pct.replace(/[^0-9.\-]/g, ''));
  const counted = interpolate(frame, [22, 56], [0, rawPct], clamp);
  const displayPct = frame < 56 ? (rawPct >= 0 ? '+' : '') + counted.toFixed(0) + '%' : item.pct;

  const card = jpCard(theme, accent);

  return (
    <AbsoluteFill>
      <Bg frame={globalFrame} trend="up" overlay={bgOverlay} seed={seed} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', paddingLeft: 48, paddingRight: 48, paddingTop: 600, paddingBottom: 300 }}>
        {/* 上部主体卡 */}
        <div style={{
          transform: `translateY(${headY}px)`, opacity: headOp, marginBottom: 22,
          background: `linear-gradient(135deg, ${accent}26 0%, ${accent}10 100%), #FFFFFF`,
          borderRadius: 18, borderLeft: `10px solid ${accent}`, padding: '20px 26px 22px',
          boxShadow: `0 14px 38px ${accent}33, 0 1px 0 rgba(255,255,255,0.85) inset`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 52, height: 52, borderRadius: 11, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 5px 16px ${accent}66` }}>
              <span style={{ fontFamily: MONO, fontWeight: 900, fontSize: 34, color: '#fff' }}>{isMystery ? '?' : index + 1}</span>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 37, fontWeight: 800, color: ink, letterSpacing: '2px' }}>{isMystery ? '??????' : item.code}</span>
            <div style={{ padding: '6px 15px', borderRadius: 8, background: `${accent}1F`, border: `1px solid ${accent}66` }}>
              <span style={{ fontFamily: FONT, fontSize: 33, fontWeight: 800, color: accent }}>{flag}</span>
            </div>
          </div>
          <div style={{ height: 1.5, background: `linear-gradient(90deg, transparent, ${accent}30 18%, ${accent}30 82%, transparent)`, margin: '14px 0' }} />
          <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: item.name.length > 8 ? 84 : 99, color: ink, lineHeight: 1.1, letterSpacing: '-1px' }}>{isMystery ? 'ミステリー銘柄' : item.name}</span>
        </div>

        {/* 下部 3 栏 panel（速报：第3栏超大涨幅）*/}
        <div style={{ transform: `translateY(${panelY}px)`, opacity: panelOp, ...card, padding: '30px 30px' }}>
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: MONO, fontSize: 39, fontWeight: 600, color: inkDim, marginBottom: 10 }}>買値</div>
              <div style={{ fontFamily: MONO, fontSize: 62, fontWeight: 700, color: ink }}>{item.buyPrice}</div>
            </div>
            <div style={{ width: 1, background: `${accent}22`, margin: '4px 0' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: MONO, fontSize: 39, fontWeight: 600, color: inkDim, marginBottom: 10 }}>目標株価</div>
              <div style={{ fontFamily: MONO, fontSize: 62, fontWeight: 700, color: pctCol }}>{item.shortTarget || item.targetPrice || '—'}</div>
            </div>
            <div style={{ width: 1, background: `${accent}22`, margin: '4px 0' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              {/* 利回り訴求タイプ（高配当/優待）は利回りを大きく。それ以外は予想上昇率。データ駆動。 */}
              {item.dividend ? (
                <>
                  <div style={{ fontFamily: MONO, fontSize: 39, fontWeight: 600, color: inkDim, marginBottom: 10 }}>{item.yutai ? '総合利回り' : '配当利回り'}</div>
                  <div style={{ fontFamily: MONO, fontSize: 88, fontWeight: 700, color: up }}>{item.dividend}</div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: MONO, fontSize: 39, fontWeight: 600, color: inkDim, marginBottom: 10 }}>予想上昇率</div>
                  <div style={{ fontFamily: MONO, fontSize: 100, fontWeight: 700, color: pctCol }}>{displayPct}</div>
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
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
