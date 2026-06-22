import React from 'react';
import { interpolate } from 'remotion';
import type { JpStockItem } from '../../types';

/**
 * JpTicker — 浅色主色调跑马灯（5 套传配色复用）。
 * 浅色基底 + 主色 accent（徽章/上下线）+ 深字报价 + 红蓝涨跌。和各套整体一脉相承，不串味。
 */

interface Props {
  stocks: JpStockItem[];
  frame:  number;
  top?:   number;
  accent: string;   // 该套主色
  ink:    string;   // 报价字色
}

const FONT = "'Noto Sans JP','Yu Gothic',sans-serif";
const MONO = "'Roboto Mono','SF Mono','Consolas',monospace";
const UP   = '#E23A2E';
const DOWN = '#1F6FE0';

export const TICKER_H = 99;
const SPEED   = 2.2;
const BADGE_W = 150;
const ITEM_W  = 400;

function pctColor(pct: string) {
  const n = parseFloat(pct.replace(/[^0-9.\-]/g, ''));
  return n < 0 ? DOWN : UP;
}

export const JpTicker: React.FC<Props> = ({ stocks, frame, top = 0, accent, ink }) => {
  if (!stocks.length) return null;

  const items = stocks.map(s => ({ code: s.code, name: s.name, pct: s.pct, color: pctColor(s.pct) }));
  const allItems = [...items, ...items, ...items];
  const totalW = items.length * ITEM_W;
  const offset = (frame * SPEED) % totalW;
  const slideIn = interpolate(frame, [0, 14], [-TICKER_H, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{
      position: 'absolute', top, left: 0, width: 1080, height: TICKER_H,
      overflow: 'hidden', transform: `translateY(${slideIn}px)`, zIndex: 100,
    }}>
      {/* 浅色基底 + 主色极淡叠加 */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(255,255,255,0.97) 0%, ${accent}12 100%)` }} />
      {/* 顶部主色细线 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `${accent}66` }} />
      {/* 底部主色粗线 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: accent, opacity: 0.85 }} />

      {/* 徽章（与报价区同底渐变、细线分隔，整条连成一体；字用主色 accent 标识）*/}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: BADGE_W,
        background: `linear-gradient(180deg, rgba(255,255,255,0.97) 0%, ${accent}12 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
        borderRight: `1.5px solid ${accent}40`,
      }}>
        <span style={{ fontFamily: FONT, fontSize: 30, fontWeight: 900, color: accent, letterSpacing: '1px' }}>注目銘柄</span>
      </div>

      {/* 滚动报价 */}
      <div style={{ position: 'absolute', left: BADGE_W, top: 0, height: TICKER_H, width: 1080 - BADGE_W, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: TICKER_H, transform: `translateX(${-offset}px)`, whiteSpace: 'nowrap' }}>
          {allItems.map((item, i) => (
            <div key={i} style={{
              display: 'inline-flex', alignItems: 'center', minWidth: ITEM_W,
              paddingLeft: 24, paddingRight: 24, gap: 12,
              borderRight: `1px solid ${accent}22`, height: TICKER_H,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 700, color: `${ink}99` }}>{item.code}</span>
              <span style={{ fontFamily: FONT, fontSize: 31, fontWeight: 700, color: ink, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
              <span style={{ fontFamily: MONO, fontSize: 36, fontWeight: 900, color: item.color }}>{item.pct}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
