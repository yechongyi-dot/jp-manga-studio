import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import type { JpStockItem } from '../types';

interface Props {
  stocks: JpStockItem[];
  frame:  number;
  top?:   number;
  theme?: 'red' | 'blue';
}

const FONT  = "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif";
const MONO  = "'Roboto Mono','SF Mono',monospace";
const RED   = '#E8392B';

export const TICKER_H = 99; // 导出给 OverlayDemo 用于背景偏移
const SPEED   = 2.2;
const BADGE_W = 128;
const ITEM_W  = 400;

function pctColor(pct: string, theme: 'red' | 'blue') {
  const n = parseFloat(pct.replace(/[^0-9.\-]/g, ''));
  if (n < 0) return '#60AAFF';
  return theme === 'red' ? '#FFE566' : '#FF6060';
}

export const TickerStrip: React.FC<Props> = ({ stocks, frame, top = 0, theme = 'red' }) => {
  if (!stocks.length) return null;

  const isBlue = theme === 'blue';
  const bgGrad = isBlue
    ? 'linear-gradient(90deg, #063264 0%, #0B4EA8 45%, #063264 100%)'
    : `linear-gradient(90deg, #C0201A 0%, ${RED} 45%, #C0201A 100%)`;
  const badgeBg  = isBlue ? '#04203F' : '#8B0000';
  const badgeLabel = '注目株';

  const items = stocks.map(s => ({
    code: s.code, name: s.name, pct: s.pct, color: pctColor(s.pct, theme),
  }));

  const allItems = [...items, ...items, ...items];
  const totalW   = items.length * ITEM_W;
  const offset   = (frame * SPEED) % totalW;

  const slideIn = interpolate(frame, [0, 14], [-TICKER_H, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      position: 'absolute',
      top,
      left: 0,
      width: 1080,
      height: TICKER_H,
      overflow: 'hidden',
      transform: `translateY(${slideIn}px)`,
      zIndex: 100,
    }}>
      {/* Background gradient */}
      <div style={{ position: 'absolute', inset: 0, background: bgGrad }} />
      {/* Top shimmer */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 55%)',
      }} />
      {/* Bottom shadow line */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        background: 'rgba(0,0,0,0.35)',
      }} />

      {/* Badge */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: BADGE_W,
        background: badgeBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2,
        borderRight: '3px solid rgba(255,255,255,0.22)',
      }}>
        <span style={{
          fontFamily: FONT, fontSize: 33, fontWeight: 900,
          color: '#FFFFFF', letterSpacing: '2px',
        }}>
          {badgeLabel}
        </span>
      </div>

      {/* Scrolling track */}
      <div style={{
        position: 'absolute',
        left: BADGE_W, top: 0,
        height: TICKER_H, width: 1080 - BADGE_W,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          height: TICKER_H,
          transform: `translateX(${-offset}px)`,
          whiteSpace: 'nowrap',
        }}>
          {allItems.map((item, i) => (
            <div key={i} style={{
              display: 'inline-flex', alignItems: 'center',
              minWidth: ITEM_W,
              paddingLeft: 22, paddingRight: 22,
              gap: 12,
              borderRight: '1px solid rgba(255,255,255,0.22)',
              height: TICKER_H,
            }}>
              <span style={{
                fontFamily: MONO, fontSize: 33, fontWeight: 700,
                color: 'rgba(255,255,255,0.72)',
              }}>
                {item.code}
              </span>
              <span style={{
                fontFamily: FONT, fontSize: 33, fontWeight: 600,
                color: '#FFFFFF',
                maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {item.name}
              </span>
              <span style={{
                fontFamily: MONO, fontSize: 42, fontWeight: 900,
                color: item.color,
                textShadow: '0 1px 8px rgba(0,0,0,0.6)',
              }}>
                {item.pct}
              </span>
              <span style={{
                fontFamily: FONT, fontSize: 22,
                color: 'rgba(255,255,255,0.40)',
              }}>◆</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
