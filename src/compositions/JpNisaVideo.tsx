import React from 'react';
import { AbsoluteFill, Audio, Sequence, useCurrentFrame } from 'remotion';
import type { JpNisaVideoProps } from '../types';
import { JpIntroScene }         from './JpIntroScene';
import { JpStockScene }         from './JpStockScene';
import { JpNisaMarketScene }    from './JpNisaMarketScene';
import { JpNisaPlanScene }      from './JpNisaPlanScene';
import { JpNisaFeaturedScene }  from './JpNisaFeaturedScene';
import { JpCtaScene }           from './JpCtaScene';
import { TickerStrip }          from '../components/TickerStrip';
import { BottomCTABar }         from '../components/BottomCTABar';
import { SubtitleBar }          from '../components/SubtitleBar';
import { EndingCTA }            from '../components/EndingCTA';

export const JpNisaVideo: React.FC<JpNisaVideoProps> = ({
  script,
  introDur,
  stockDurations,
  ctaDur,
  marketContextDur   = 0,
  investmentPlanDur  = 0,
  featuredStockDur   = 0,
  introAudioPath,
  stockAudioPaths,
  ctaAudioPath,
  marketContextAudioPath,
  investmentPlanAudioPath,
  featuredStockAudioPath,
  subtitleSegs,
  bgSeed,
}) => {
  const frame = useCurrentFrame();
  const { title, stocks, ctaText, ctaLineId, subtitle } = script;

  let cursor = 0;
  const introStart  = cursor; cursor += introDur;
  const stockStarts = stockDurations.map(d => { const s = cursor; cursor += d; return s; });
  const marketStart    = cursor; cursor += marketContextDur;
  const planStart      = cursor; cursor += investmentPlanDur;
  const featuredStart  = cursor; cursor += featuredStockDur;
  const ctaStart       = cursor;

  const endingStartFrame = ctaStart + Math.max(0, ctaDur - 90);
  const showEnding = frame >= endingStartFrame;
  const endingLocalFrame = Math.max(0, frame - endingStartFrame);

  const resolvedSubs = subtitleSegs && subtitleSegs.length > 0 ? subtitleSegs : [];

  return (
    <AbsoluteFill style={{ background: '#0a0c14' }}>

      {/* ── 音声トラック ── */}
      {introAudioPath && (
        <Sequence from={introStart} durationInFrames={introDur}>
          <Audio src={introAudioPath} />
        </Sequence>
      )}
      {stocks.map((_, i) => stockAudioPaths[i] && (
        <Sequence key={i} from={stockStarts[i]} durationInFrames={stockDurations[i]}>
          <Audio src={stockAudioPaths[i]} />
        </Sequence>
      ))}
      {marketContextDur > 0 && marketContextAudioPath && (
        <Sequence from={marketStart} durationInFrames={marketContextDur}>
          <Audio src={marketContextAudioPath} />
        </Sequence>
      )}
      {investmentPlanDur > 0 && investmentPlanAudioPath && (
        <Sequence from={planStart} durationInFrames={investmentPlanDur}>
          <Audio src={investmentPlanAudioPath} />
        </Sequence>
      )}
      {featuredStockDur > 0 && featuredStockAudioPath && (
        <Sequence from={featuredStart} durationInFrames={featuredStockDur}>
          <Audio src={featuredStockAudioPath} />
        </Sequence>
      )}
      {ctaAudioPath && (
        <Sequence from={ctaStart} durationInFrames={ctaDur}>
          <Audio src={ctaAudioPath} />
        </Sequence>
      )}

      {/* ── シーン本体 ── */}
      <Sequence from={introStart} durationInFrames={introDur} name="Intro">
        <JpIntroScene
          title={title}
          stockCount={stocks.length}
          globalFrame={introStart}
          seed={bgSeed}
          subtitle={subtitle}
        />
      </Sequence>

      {stocks.map((item, i) => (
        <Sequence key={i} from={stockStarts[i]} durationInFrames={stockDurations[i]} name={`Stock${i + 1}`}>
          <JpStockScene item={item} index={i} globalFrame={stockStarts[i]} seed={bgSeed} />
        </Sequence>
      ))}

      {marketContextDur > 0 && (
        <Sequence from={marketStart} durationInFrames={marketContextDur} name="MarketContext">
          <JpNisaMarketScene
            marketContext={script.marketContext || ''}
            globalFrame={marketStart}
            seed={bgSeed}
          />
        </Sequence>
      )}

      {investmentPlanDur > 0 && (
        <Sequence from={planStart} durationInFrames={investmentPlanDur} name="InvestmentPlan">
          <JpNisaPlanScene script={script} globalFrame={planStart} seed={bgSeed} />
        </Sequence>
      )}

      {featuredStockDur > 0 && (
        <Sequence from={featuredStart} durationInFrames={featuredStockDur} name="FeaturedStock">
          <JpNisaFeaturedScene script={script} globalFrame={featuredStart} seed={bgSeed} />
        </Sequence>
      )}

      <Sequence from={ctaStart} durationInFrames={ctaDur} name="CTA">
        <JpCtaScene
          lineId={ctaLineId}
          ctaText={ctaText}
          globalFrame={ctaStart}
          seed={bgSeed}
        />
      </Sequence>

      {/* ── 常時表示オーバーレイ ── */}
      <TickerStrip stocks={stocks} frame={frame} top={0} theme="blue" />

      {resolvedSubs.length > 0 && (
        <SubtitleBar segments={resolvedSubs} frame={frame} y={1460} />
      )}

      {ctaLineId && (
        <BottomCTABar lineId={ctaLineId} ctaText={ctaText} frame={frame} bottom={0} />
      )}

      {showEnding && ctaLineId && (
        <EndingCTA lineId={ctaLineId} frame={endingLocalFrame} durationInFrames={90} />
      )}

    </AbsoluteFill>
  );
};
