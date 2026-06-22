import React, { useContext } from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ImageBgSpec } from '../../types';
import { TICKER_H } from '../../components/pro/JpTicker';

const W = 1080, H = 1920;
// src 可为 http URL(渲染时经资源服务) 或 public 相对路径(Studio staticFile)
const resolveSrc = (s: string) => (/^https?:/i.test(s) ? s : staticFile(s));

// 全片总时长。背景在各场景的 <Sequence> 内渲染，而 Sequence 内 useVideoConfig().durationInFrames
// 会返回「场景时长」而非全片时长，导致长图滚动进度算错（除片头外冻结）。视频根组件经此 Context
// 提供真实全片帧数，makeImageBg 用它算连续滚动进度。
export const TotalDurationContext = React.createContext<number>(0);

export function makeImageBg(spec: ImageBgSpec): React.FC<{ frame?: number }> {
  return ({ frame: startFrame = 0 }) => {
    const local = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();
    const ctxTotal = useContext(TotalDurationContext);
    const total = ctxTotal > 1 ? ctxTotal : durationInFrames;   // Context 优先；无则退回(可能是场景时长)
    const abs = (startFrame || 0) + local;                       // 还原全局帧
    const prog = total > 1 ? Math.max(0, Math.min(1, abs / (total - 1))) : 0;
    const speed = spec.speed && spec.speed > 0 ? spec.speed : 1;

    const top = spec.top;
    const topH = top ? Math.round(W * (top.h / top.w)) : 0;

    const sc = spec.scroll;
    const availH = H - TICKER_H - topH;
    const scaledH = sc ? Math.round(W * (sc.h / sc.w)) : availH;
    // 连续滚动：speed = 整片播完时滚过几个"图身位"（availH）。
    // 不再受限于 range（图高-可视高），短图也能快速、持续移动。
    const totalScroll = availH * speed;
    const rawTy = prog * totalScroll;
    // 循环：图滚出可视区后无缝衔接回起点
    const loopLen = scaledH > 0 ? scaledH : availH;
    const tyMod = loopLen > 0 ? rawTy % loopLen : 0;
    const ty = spec.dir === 'down' ? tyMod : -tyMod;

    return (
      <AbsoluteFill style={{ overflow: 'hidden', background: '#0a0c14' }}>
        {sc && (
          <div style={{ position: 'absolute', top: TICKER_H + topH, left: 0, width: W, height: availH, overflow: 'hidden' }}>
            <Img
              src={resolveSrc(sc.src)}
              style={{ position: 'absolute', top: 0, left: 0, width: W, height: scaledH, transform: `translateY(${ty}px)`, objectFit: 'cover' }}
            />
            <Img
              src={resolveSrc(sc.src)}
              style={{ position: 'absolute', top: 0, left: 0, width: W, height: scaledH, transform: `translateY(${ty + (spec.dir === 'down' ? -scaledH : scaledH)}px)`, objectFit: 'cover' }}
            />
          </div>
        )}
        {top && (
          <Img
            src={resolveSrc(top.src)}
            style={{ position: 'absolute', top: TICKER_H, left: 0, width: W, height: topH, objectFit: 'cover' }}
          />
        )}
        {(spec.scrimOpacity ?? 0) > 0 && (
          <AbsoluteFill style={{ background: `rgba(255,255,255,${spec.scrimOpacity})` }} />
        )}
      </AbsoluteFill>
    );
  };
}
