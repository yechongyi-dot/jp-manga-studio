import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { SubtitleLine } from '../../types';
import { CURTAIN_END_FRAME } from '../../types';

/**
 * JpLightSubtitle — 浅色简约字幕条（5 套浅色模板通用）
 * 白条 + 深字 + 冷调细线 + karaoke 进度。去掉彩虹花哨，干净专业。
 * 关键 token（数字/%/円/LINE）用深色系强调色。
 */

interface Props {
  segments: SubtitleLine[];
  frame:    number;
  y?:       number;
  accent?:  string;   // 该套主题强调色（顶线/进度条/框底彩），默认靛蓝
  ink?:     string;   // 主题深彩字色（非数字 token 用）
}

const FONT = "'Noto Sans JP','Yu Gothic',sans-serif";

const RED   = '#E5281C';
const BLUE  = '#1568E5';
const ORANGE = '#D97400';
const LINE_COLOR  = '#06C755';

function parseColored(text: string, ink: string): Array<{ s: string; color: string }> {
  const parts: Array<{ s: string; color: string }> = [];
  const re = /([+\-]?[0-9,]+(?:\.[0-9]+)?[%円万億千]?|LINE|↑|↗|▲|↓|↘|▼)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ s: text.slice(last, m.index), color: ink });
    const tok = m[1];
    let color = RED;
    if (tok === 'LINE') color = LINE_COLOR;
    else if (tok.includes('%')) color = RED;
    else if (tok.includes('円') || tok.includes('万') || tok.includes('億')) color = ORANGE;
    else if (tok === '↑' || tok === '↗' || tok === '▲') color = RED;
    else if (tok === '↓' || tok === '↘' || tok === '▼') color = BLUE;
    parts.push({ s: tok, color });
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push({ s: text.slice(last), color: ink });
  return parts;
}

const LINE_THRESHOLD = 80;
const SPLIT_CHARS = '。！？.!?';
const WEAK_SPLIT  = '、,; ';

function splitOnce(seg: SubtitleLine): SubtitleLine[] {
  if (seg.text.length <= LINE_THRESHOLD) return [seg];
  const t = seg.text;
  const mid = Math.floor(t.length / 2);
  let best = -1, bestDist = Infinity;
  for (let i = 1; i < t.length - 1; i++) {
    if (SPLIT_CHARS.includes(t[i])) { const d = Math.abs(i + 1 - mid); if (d < bestDist) { bestDist = d; best = i; } }
  }
  if (best < 0) {
    for (let i = 1; i < t.length - 1; i++) {
      if (WEAK_SPLIT.includes(t[i])) { const d = Math.abs(i - mid); if (d < bestDist) { bestDist = d; best = i; } }
    }
  }
  if (best < 0) return [seg];
  const at = best + 1;
  const r = at / t.length;
  const dur1 = Math.max(20, Math.round(seg.durationInFrames * r));
  const dur2 = Math.max(20, seg.durationInFrames - dur1);
  return [
    { text: t.slice(0, at), durationInFrames: dur1 },
    { text: t.slice(at).trimStart(), durationInFrames: dur2 },
  ];
}

function flattenSegments(segs: SubtitleLine[]): SubtitleLine[] {
  return segs.flatMap(splitOnce).flatMap(splitOnce);
}

const CURTAIN_END = CURTAIN_END_FRAME;

export const JpLightSubtitle: React.FC<Props> = ({ segments, frame, y = 1460, accent = '#3B5BDB', ink = '#1B2F7A' }) => {
  const { fps } = useVideoConfig();
  if (!segments.length) return null;
  if (frame < CURTAIN_END) return null;

  const segs = flattenSegments(segments);
  let elapsed = 0, segIndex = 0, segFrame = 0;
  for (let i = 0; i < segs.length; i++) {
    if (frame < elapsed + segs[i].durationInFrames) { segIndex = i; segFrame = frame - elapsed; break; }
    elapsed += segs[i].durationInFrames; segIndex = i; segFrame = frame - elapsed + segs[i].durationInFrames;
  }
  const seg = segs[segIndex];

  const fadeIn = interpolate(segFrame, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const slideY = spring({ frame: segFrame, fps, config: { damping: 22, stiffness: 320 }, from: 24, to: 0 });
  const entryY = spring({ frame: frame - CURTAIN_END, fps, config: { damping: 18, stiffness: 250 }, from: 120, to: 0 });
  const progress = Math.min(1, segFrame / Math.max(1, seg.durationInFrames));
  const tokens = parseColored(seg.text, ink);

  return (
    <div style={{ position: 'absolute', left: 0, top: y, width: 1080, zIndex: 125, transform: `translateY(${entryY}px)` }}>
      <div style={{
        position: 'relative', margin: '0 196px 0 30px', borderRadius: 16, overflow: 'hidden',
        background: `linear-gradient(180deg, ${accent}29 0%, ${accent}1A 100%), #FFFFFF`,
        boxShadow: `0 10px 36px ${accent}2E, 0 1px 0 rgba(255,255,255,0.75) inset`,
        backdropFilter: 'blur(12px)',
        border: `1.5px solid ${accent}40`,
      }}>
        {/* 顶部冷调细线 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, zIndex: 2 }} />

        {/* 内容 */}
        <div style={{
          position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center',
          padding: '20px 26px 24px 20px', gap: 16,
          transform: `translateY(${slideY}px)`, opacity: fadeIn,
        }}>
          <div style={{ flexShrink: 0, width: 8, alignSelf: 'stretch', borderRadius: 4, background: accent }} />
          <div style={{ flexShrink: 0, fontSize: 39, lineHeight: 1 }}>🎙</div>
          <div style={{
            flex: 1, fontFamily: FONT,
            fontSize: seg.text.length > 40 ? 46 : seg.text.length > 28 ? 51 : 56,
            fontWeight: 800, lineHeight: 1.4, letterSpacing: '0.3px', wordBreak: 'break-word',
          }}>
            {tokens.map((tok, i) => (
              <span key={i} style={{ color: tok.color, fontWeight: tok.color === ink ? 800 : 900 }}>{tok.s}</span>
            ))}
          </div>
        </div>

        {/* karaoke 进度 */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(40,72,130,0.10)', zIndex: 4 }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: accent }} />
        </div>
      </div>
    </div>
  );
};
