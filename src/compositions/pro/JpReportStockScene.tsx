import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { JpStockItem } from '../../types';
import { jpCard, type JpTheme } from './jpTheme';

/**
 * JpReportStockScene — 「私行理财」专属前景（组合成分股视角）。
 * 区别于个股卡：展示 構成比(组合权重) / 配当利回り / 役割，配合资产配置背景。前景靠下，露出背景环形。
 */

interface Props { item: JpStockItem; index: number; globalFrame: number; seed?: number; theme: JpTheme; }

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const FONT  = "'Noto Sans JP','Yu Gothic','Hiragino Kaku Gothic ProN',sans-serif";
const MONO  = "'Roboto Mono','SF Mono','Consolas',monospace";

const ROLES   = ['中核の大型株', '高配当の安定株', '成長モメンタム', 'バリュー優良株', 'ディフェンシブセクター'];

export const JpReportStockScene: React.FC<Props> = ({ item, index, globalFrame, seed, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { ink, inkDim, accent, Bg, bgOverlay } = theme;

  const isMystery = item.name === '';
  const role = ROLES[index % 5], weight = Number(item.weight) || 0;   // 占比用 AI 生成
  // 神秘股无配当数据 → 中栏改用它有的 目標株価（不留空）；普通股用 配当利回り
  const cMid = isMystery ? { l: '目標株価', v: item.shortTarget || item.targetPrice || '—' } : { l: '配当利回り', v: item.dividend || '—' };

  const headOp = interpolate(frame, [0, 14], [0, 1], clamp);
  const headY  = spring({ frame, fps, config: { damping: 20, stiffness: 300 }, from: -44, to: 0 });
  const panelOp = interpolate(frame, [20, 36], [0, 1], clamp);
  const panelY  = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 18, stiffness: 220 }, from: 40, to: 0 });
  const barW = interpolate(frame, [34, 62], [0, 1], clamp);

  const card = jpCard(theme, accent);

  return (
    <AbsoluteFill>
      <Bg frame={globalFrame} trend="up" overlay={bgOverlay} seed={seed} />

      {/* 前景靠下（topPad 大），露出上方资产配置环形 */}
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
              <span style={{ fontFamily: FONT, fontSize: 33, fontWeight: 800, color: accent }}>{isMystery ? '🔒 お宝銘柄' : role}</span>
            </div>
          </div>
          <div style={{ height: 1.5, background: `linear-gradient(90deg, transparent, ${accent}30 18%, ${accent}30 82%, transparent)`, margin: '14px 0' }} />
          <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: item.name.length > 8 ? 84 : 99, color: ink, lineHeight: 1.1, letterSpacing: '-1px' }}>{isMystery ? 'ミステリー銘柄' : item.name}</span>
        </div>

        {/* 下部 3 栏 panel：買値 / 配当利回り / 比率 */}
        <div style={{ transform: `translateY(${panelY}px)`, opacity: panelOp, ...card, padding: '30px 30px' }}>
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: MONO, fontSize: 39, fontWeight: 600, color: inkDim, marginBottom: 10 }}>買値</div>
              <div style={{ fontFamily: MONO, fontSize: 62, fontWeight: 700, color: ink }}>{item.buyPrice}</div>
            </div>
            <div style={{ width: 1, background: `${accent}22`, margin: '4px 0' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: MONO, fontSize: 39, fontWeight: 600, color: inkDim, marginBottom: 10 }}>{cMid.l}</div>
              <div style={{ fontFamily: MONO, fontSize: 62, fontWeight: 700, color: accent }}>{cMid.v}</div>
            </div>
            <div style={{ width: 1, background: `${accent}22`, margin: '4px 0' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: MONO, fontSize: 39, fontWeight: 600, color: inkDim, marginBottom: 10 }}>比率</div>
              <div style={{ fontFamily: MONO, fontSize: 62, fontWeight: 700, color: ink }}>{weight}%</div>
            </div>
          </div>
          {/* 占比进度条 */}
          <div style={{ marginTop: 20, height: 10, borderRadius: 5, background: `${accent}18`, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, weight * 2.6) * barW}%`, background: accent, borderRadius: 5 }} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
