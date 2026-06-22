import React from 'react';
import { AbsoluteFill, Audio, Sequence, useCurrentFrame } from 'remotion';
import type { JpMangaVideoProps } from '../../types';
import type { JpTheme } from './jpTheme';
import { JpIntroScene }  from './JpIntroScene';
import { JpStockScene }  from './JpStockScene';
import { JpCtaScene }    from './JpCtaScene';
import { JpEndingScene } from './JpEndingScene';
import { JpTicker }          from '../../components/pro/JpTicker';
import { JpLightSubtitle }   from '../../components/pro/JpLightSubtitle';
import { JpTopCtaBar }       from '../../components/pro/JpTopCtaBar';
import { JpCornerQr }        from '../../components/pro/JpCornerQr';
import { JpIntroCurtain }    from '../../components/pro/JpIntroCurtain';
import { DisclaimerWatermark } from '../../components/pro/DisclaimerWatermark';
import { TotalDurationContext } from '../bg/ImageBg';

/**
 * JpStandardVideo — 通用个股推荐模板（传 theme）。
 * 一套 Video 逻辑，5 套个股类（JpPrime/JpBroadcast…）传各自 theme 即可，风格统一、互不串味。
 */

type StockSceneProps = { item: any; index: number; globalFrame: number; seed?: number; theme: JpTheme };
type Props = JpMangaVideoProps & { theme: JpTheme; StockScene?: React.FC<StockSceneProps> };

export const JpStandardVideo: React.FC<Props> = ({
  script, introDur, stockDurations, ctaDur, durationInFrames,
  introAudioPath, stockAudioPaths, ctaAudioPath, subtitleSegs, bgSeed, theme,
  StockScene = JpStockScene,
}) => {
  const frame = useCurrentFrame();
  const { title, stocks, ctaText, ctaLineId, ctaQrDataUrl, dateStr } = script;
  const regularCount = stocks.filter(s => s.name !== '').length;

  let cursor = 0;
  const introStart  = cursor; cursor += introDur;
  const stockStarts = stockDurations.map(d => { const s = cursor; cursor += d; return s; });
  const ctaStart    = cursor;

  const endingStartFrame = ctaStart;                                 // ending 覆盖整个 CTA 段：结尾长展示、定格大 QR，结束画面也是 QR
  const showEnding = frame >= endingStartFrame;
  const endingLocalFrame = Math.max(0, frame - endingStartFrame);
  const resolvedSubs = subtitleSegs && subtitleSegs.length > 0 ? subtitleSegs : [];

  return (
    <TotalDurationContext.Provider value={durationInFrames}>
    <AbsoluteFill style={{ background: '#EBF0F7' }}>
      {introAudioPath && <Sequence from={introStart} durationInFrames={introDur}><Audio src={introAudioPath} /></Sequence>}
      {stocks.map((_, i) => stockAudioPaths[i] && (
        <Sequence key={i} from={stockStarts[i]} durationInFrames={stockDurations[i]}><Audio src={stockAudioPaths[i]} /></Sequence>
      ))}
      {ctaAudioPath && <Sequence from={ctaStart} durationInFrames={ctaDur}><Audio src={ctaAudioPath} /></Sequence>}

      <Sequence from={introStart} durationInFrames={introDur} name="Intro">
        <JpIntroScene title={title} stockCount={regularCount} globalFrame={introStart} seed={bgSeed} today={dateStr} theme={theme} />
      </Sequence>
      {stocks.map((item, i) => (
        <Sequence key={i} from={stockStarts[i]} durationInFrames={stockDurations[i]} name={`Stock${i + 1}`}>
          <StockScene item={item} index={i} globalFrame={stockStarts[i]} seed={bgSeed} theme={theme} />
        </Sequence>
      ))}
      <Sequence from={ctaStart} durationInFrames={ctaDur} name="CTA">
        <JpCtaScene lineId={ctaLineId} ctaText={ctaText} globalFrame={ctaStart} seed={bgSeed} theme={theme} />
      </Sequence>

      {/* overlay */}
      <JpTicker stocks={stocks} frame={frame} top={0} accent={theme.accent} ink={theme.ink} />
      {ctaLineId && <JpTopCtaBar lineId={ctaLineId} frame={frame} accent={theme.accent} />}
      {ctaQrDataUrl && <JpCornerQr qrDataUrl={ctaQrDataUrl} accent={theme.accent} />}
      {resolvedSubs.length > 0 && <JpLightSubtitle segments={resolvedSubs} frame={frame} y={1380} accent={theme.accent} ink={theme.ink} />}
      {showEnding && ctaLineId && <JpEndingScene lineId={ctaLineId} qrDataUrl={ctaQrDataUrl} frame={endingLocalFrame} durationInFrames={ctaDur} theme={theme} />}
      <DisclaimerWatermark tone="light" position="tr" />

      {/* 速报片头幕布（顶层，开场 ~52f）*/}
      {frame < 52 && (
        <JpIntroCurtain frame={frame} bigText={theme.curtainBig} liveText={theme.curtainLive} palette={theme.curtain} durationFrames={52} />
      )}
    </AbsoluteFill>
    </TotalDurationContext.Provider>
  );
};
