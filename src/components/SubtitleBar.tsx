import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { SubtitleLine } from '../types';
import { CURTAIN_END_FRAME } from '../types';

// 後方互換のため re-export
export type SubtitleSegment = SubtitleLine;

interface Props {
  segments:       SubtitleLine[];
  frame:          number;
  y?:             number;
}

const FONT = "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif";

// Palette — unified with existing overlay style
const C = {
  red:    '#E8392B',
  orange: '#FF7A30',
  gold:   '#FFD060',
  yellow: '#FFE800',
  green:  '#06C755',
  cyan:   '#00CCEE',
  white:  '#FFFFFF',
  dim:    'rgba(255,255,255,0.58)',
};

// Parse text → colored segments: numbers/% = gold, 円 = orange, LINE = green, rest = white
function parseColored(text: string): Array<{ s: string; color: string }> {
  const parts: Array<{ s: string; color: string }> = [];
  // tokenize: numbers+%, 円, LINE, 万/億, other
  const re = /([+\-]?[0-9,]+(?:\.[0-9]+)?[%円万億千]?|LINE|↑|↗|▲|↓|↘|▼)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ s: text.slice(last, m.index), color: C.white });
    const tok = m[1];
    let color = C.gold;
    if (tok === 'LINE') color = C.green;
    else if (tok.includes('%')) color = C.yellow;
    else if (tok.includes('円') || tok.includes('万') || tok.includes('億')) color = C.orange;
    else if (tok === '↑' || tok === '↗' || tok === '▲') color = C.red;
    else if (tok === '↓' || tok === '↘' || tok === '▼') color = '#60AAFF';
    parts.push({ s: tok, color });
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push({ s: text.slice(last), color: C.white });
  return parts;
}

// ── 長い字幕を自動分割（最大 4 行 ≈ 80文字）────────────────────
const LINE_THRESHOLD = 80;
const SPLIT_CHARS = '。！？';
const WEAK_SPLIT  = '、 ';

function splitOnce(seg: SubtitleLine): SubtitleLine[] {
  if (seg.text.length <= LINE_THRESHOLD) return [seg];
  const t   = seg.text;
  const mid = Math.floor(t.length / 2);
  let best = -1, bestDist = Infinity;
  // 優先: 句末記号 (。！？)
  for (let i = 1; i < t.length - 1; i++) {
    if (SPLIT_CHARS.includes(t[i])) {
      const d = Math.abs(i + 1 - mid);
      if (d < bestDist) { bestDist = d; best = i; }
    }
  }
  // フォールバック: 読点・空白
  if (best < 0) {
    for (let i = 1; i < t.length - 1; i++) {
      if (WEAK_SPLIT.includes(t[i])) {
        const d = Math.abs(i - mid);
        if (d < bestDist) { bestDist = d; best = i; }
      }
    }
  }
  if (best < 0) return [seg];
  const at   = best + 1;
  const r    = at / t.length;
  const dur1 = Math.max(20, Math.round(seg.durationInFrames * r));
  const dur2 = Math.max(20, seg.durationInFrames - dur1);
  return [
    { text: t.slice(0, at),             durationInFrames: dur1 },
    { text: t.slice(at).trimStart(),    durationInFrames: dur2 },
  ];
}

function flattenSegments(segs: SubtitleLine[]): SubtitleLine[] {
  let result = segs.flatMap(splitOnce);
  // 再帰的に分割（最大 2 パス）
  result = result.flatMap(splitOnce);
  return result;
}
// ────────────────────────────────────────────────────────────────

const CURTAIN_END = CURTAIN_END_FRAME;

export const SubtitleBar: React.FC<Props> = ({ segments, frame, y = 1530 }) => {
  const { fps } = useVideoConfig();
  if (!segments.length) return null;
  // 幕布期间完全不渲染，避免 backdropFilter 合成层穿透问题
  if (frame < CURTAIN_END) return null;

  // 分割済み配列を使用
  const segs = flattenSegments(segments);

  // Determine current segment
  let elapsed = 0;
  let segIndex = 0;
  let segFrame = 0;
  for (let i = 0; i < segs.length; i++) {
    if (frame < elapsed + segs[i].durationInFrames) {
      segIndex = i;
      segFrame = frame - elapsed;
      break;
    }
    elapsed += segs[i].durationInFrames;
    segIndex = i; // last segment persists
    segFrame = frame - elapsed + segs[i].durationInFrames;
  }

  const seg = segs[segIndex];

  // Fade in new segment
  const fadeIn = interpolate(segFrame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Slide in from below
  const slideY = spring({
    frame: segFrame,
    fps,
    config: { damping: 22, stiffness: 320 },
    from: 28,
    to: 0,
  });

  // First entrance slide-up from off screen（幕布消失後にカウント開始）
  const entryY = spring({
    frame: frame - CURTAIN_END,
    fps,
    config: { damping: 18, stiffness: 250 },
    from: 120,
    to: 0,
  });

  // Karaoke progress bar
  const progress = Math.min(1, segFrame / Math.max(1, seg.durationInFrames));

  // Colorful top border animation
  const borderShift = (frame * 1.5) % 360;

  // Subtle rainbow cycle for left badge
  const hue = (frame * 1.2) % 360;

  const tokens = parseColored(seg.text);

  return (
    <div style={{
      position: 'absolute',
      left: 0,
      top: y,
      width: 1080,
      zIndex: 125,
      transform: `translateY(${entryY}px)`,
    }}>
      {/* Outer container with animated border */}
      <div style={{
        position: 'relative',
        margin: '0 24px',
        overflow: 'hidden',
      }}>

        {/* Animated rainbow top line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 5,
          background: `linear-gradient(90deg,
            ${C.red} 0%,
            ${C.orange} 20%,
            ${C.gold} 40%,
            ${C.green} 60%,
            ${C.cyan} 80%,
            ${C.red} 100%
          )`,
          backgroundSize: '200% 100%',
          backgroundPositionX: `${-borderShift * 2}px`,
          zIndex: 2,
        }} />

        {/* Dark background */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(4,6,20,0.95) 0%, rgba(2,4,14,0.97) 100%)',
          backdropFilter: 'blur(14px)',
        }} />

        {/* Karaoke progress underlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(90deg,
            rgba(232,57,43,0.08) 0%,
            rgba(255,208,96,0.06) ${progress * 100}%,
            transparent ${progress * 100}%
          )`,
          zIndex: 1,
        }} />

        {/* Content row */}
        <div style={{
          position: 'relative', zIndex: 3,
          display: 'flex', alignItems: 'center',
          padding: '18px 24px 22px 18px',
          gap: 18,
          transform: `translateY(${slideY}px)`,
          opacity: fadeIn,
        }}>

          {/* Left colored badge — 字幕 */}
          <div style={{
            flexShrink: 0,
            width: 10,
            alignSelf: 'stretch',
            borderRadius: 4,
            background: `hsl(${hue},90%,58%)`,
            boxShadow: `0 0 10px hsl(${hue},90%,58%)`,
          }} />

          {/* Speaker icon */}
          <div style={{
            flexShrink: 0,
            fontFamily: FONT,
            fontSize: 30,
            lineHeight: 1,
          }}>🎙</div>

          {/* Colored text — inline flow で日本語禁則処理を維持 */}
          <div style={{
            flex: 1,
            fontFamily: FONT,
            fontSize: seg.text.length > 40 ? 34 : seg.text.length > 28 ? 38 : 42,
            fontWeight: 800,
            lineHeight: 1.42,
            letterSpacing: '0.5px',
            textShadow: '0 2px 10px rgba(0,0,0,0.80)',
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}>
            {tokens.map((tok, i) => (
              <span key={i} style={{
                color: tok.color,
                fontWeight: tok.color === C.white ? 700 : 900,
                fontSize: tok.color !== C.white ? 46 : 42,
              }}>
                {tok.s}
              </span>
            ))}
          </div>

          {/* Segment counter dot */}
          <div style={{
            flexShrink: 0,
            alignSelf: 'flex-start',
            marginTop: 6,
            width: 12, height: 12, borderRadius: 6,
            background: `hsl(${hue},85%,60%)`,
            boxShadow: `0 0 8px hsl(${hue},85%,60%)`,
          }} />
        </div>

        {/* Bottom karaoke progress bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
          background: 'rgba(255,255,255,0.08)',
          zIndex: 4,
        }}>
          <div style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: `linear-gradient(90deg, ${C.red}, ${C.orange}, ${C.gold})`,
          }} />
        </div>

        {/* Segment number badge */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: `rgba(255,255,255,0.08)`,
          borderRadius: 6,
          padding: '2px 8px',
          zIndex: 5,
        }}>
          <span style={{
            fontFamily: FONT, fontSize: 20, fontWeight: 700,
            color: `hsl(${hue},80%,70%)`,
          }}>
            {segIndex + 1} / {segs.length}
          </span>
        </div>
      </div>
    </div>
  );
};
