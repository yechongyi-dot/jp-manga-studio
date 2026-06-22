import React from 'react';
import { AbsoluteFill, Audio, Sequence, useCurrentFrame } from 'remotion';
import type { JpMangaVideoProps } from '../../types';
import { JP_REPORT, type JpTheme } from './jpTheme';
import { JpIntroScene }       from './JpIntroScene';
import { JpReportStockScene } from './JpReportStockScene';
import { JpNisaMarketScene }  from './JpNisaMarketScene';
import { JpNisaPlanScene }    from './JpNisaPlanScene';
import { JpNisaFeaturedScene } from './JpNisaFeaturedScene';
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
 * JpNisaVideo — 新NISA 多シーン版（私行理财·薄荷金 JP_REPORT 基調）。
 * 組合成分（JpReportStockScene）に加え、市況 / 投資プラン / 本命銘柄 の3シーンを挿入。
 * シーン順序は generate.js の frameToSceneName と完全一致させること（ズレると音ズレ）：
 *   Intro → Stock1..N → MarketContext → InvestmentPlan → FeaturedStock → CTA(ending)
 * 各 NISA 段は dur が 0 ならスキップ（Sequence を出さず cursor も進めない）。
 */
export const JpNisaVideo: React.FC<JpMangaVideoProps & { theme?: JpTheme }> = ({
  script, introDur, stockDurations, ctaDur, durationInFrames,
  introAudioPath, stockAudioPaths, ctaAudioPath, subtitleSegs, bgSeed,
  marketContextDur = 0, investmentPlanDur = 0, featuredStockDur = 0,
  marketContextAudioPath, investmentPlanAudioPath, featuredStockAudioPath,
  marketContextText, investmentPlanText, featuredText,
  theme = JP_REPORT,
}) => {
  const frame = useCurrentFrame();
  const {
    title, stocks, ctaText, ctaLineId, ctaQrDataUrl, dateStr,
    marketContext, initialCapital, targetProfitMin, targetProfitMax,
    featuredCurrentPrice, featuredTargetPrice, featuredPct,
  } = script as any;
  const regularCount = stocks.filter(s => s.name !== '').length;

  // ── 累積カーソルでシーン開始フレームを算出（generate.js と同順） ──
  let cursor = 0;
  const introStart  = cursor; cursor += introDur;
  const stockStarts = stockDurations.map(d => { const s = cursor; cursor += d; return s; });
  const marketStart   = cursor; if (marketContextDur  > 0) cursor += marketContextDur;
  const planStart     = cursor; if (investmentPlanDur > 0) cursor += investmentPlanDur;
  const featuredStart = cursor; if (featuredStockDur  > 0) cursor += featuredStockDur;
  const ctaStart      = cursor;

  const endingStartFrame = ctaStart;
  const showEnding = frame >= endingStartFrame;
  const endingLocalFrame = Math.max(0, frame - endingStartFrame);
  const resolvedSubs = subtitleSegs && subtitleSegs.length > 0 ? subtitleSegs : [];

  return (
    <TotalDurationContext.Provider value={durationInFrames}>
    <AbsoluteFill style={{ background: '#EAF5EE' }}>
      {/* ── 音声（named path を各段に配置） ── */}
      {introAudioPath && <Sequence from={introStart} durationInFrames={introDur}><Audio src={introAudioPath} /></Sequence>}
      {stocks.map((_, i) => stockAudioPaths[i] && (
        <Sequence key={`a${i}`} from={stockStarts[i]} durationInFrames={stockDurations[i]}><Audio src={stockAudioPaths[i]} /></Sequence>
      ))}
      {marketContextDur  > 0 && marketContextAudioPath  && <Sequence from={marketStart}   durationInFrames={marketContextDur}><Audio src={marketContextAudioPath} /></Sequence>}
      {investmentPlanDur > 0 && investmentPlanAudioPath && <Sequence from={planStart}     durationInFrames={investmentPlanDur}><Audio src={investmentPlanAudioPath} /></Sequence>}
      {featuredStockDur  > 0 && featuredStockAudioPath  && <Sequence from={featuredStart} durationInFrames={featuredStockDur}><Audio src={featuredStockAudioPath} /></Sequence>}
      {ctaAudioPath && <Sequence from={ctaStart} durationInFrames={ctaDur}><Audio src={ctaAudioPath} /></Sequence>}

      {/* ── シーン ── */}
      <Sequence from={introStart} durationInFrames={introDur} name="Intro">
        <JpIntroScene title={title} stockCount={regularCount} globalFrame={introStart} seed={bgSeed} today={dateStr} theme={theme} />
      </Sequence>
      {stocks.map((item, i) => (
        <Sequence key={`s${i}`} from={stockStarts[i]} durationInFrames={stockDurations[i]} name={`Stock${i + 1}`}>
          <JpReportStockScene item={item} index={i} globalFrame={stockStarts[i]} seed={bgSeed} theme={theme} />
        </Sequence>
      ))}
      {marketContextDur > 0 && (
        <Sequence from={marketStart} durationInFrames={marketContextDur} name="MarketContext">
          <JpNisaMarketScene text={marketContextText || marketContext || ''} globalFrame={marketStart} seed={bgSeed} theme={theme} />
        </Sequence>
      )}
      {investmentPlanDur > 0 && (
        <Sequence from={planStart} durationInFrames={investmentPlanDur} name="InvestmentPlan">
          <JpNisaPlanScene initialCapital={initialCapital} targetProfitMin={targetProfitMin} targetProfitMax={targetProfitMax} subText={investmentPlanText} globalFrame={planStart} seed={bgSeed} theme={theme} />
        </Sequence>
      )}
      {featuredStockDur > 0 && (
        <Sequence from={featuredStart} durationInFrames={featuredStockDur} name="FeaturedStock">
          <JpNisaFeaturedScene currentPrice={featuredCurrentPrice} targetPrice={featuredTargetPrice} pct={featuredPct} subText={featuredText} globalFrame={featuredStart} seed={bgSeed} theme={theme} />
        </Sequence>
      )}
      <Sequence from={ctaStart} durationInFrames={ctaDur} name="CTA">
        <JpCtaScene lineId={ctaLineId} ctaText={ctaText} globalFrame={ctaStart} seed={bgSeed} theme={theme} />
      </Sequence>

      {/* ── overlay（JpStandardVideo と同じ） ── */}
      <JpTicker stocks={stocks} frame={frame} top={0} accent={theme.accent} ink={theme.ink} />
      {ctaLineId && <JpTopCtaBar lineId={ctaLineId} frame={frame} accent={theme.accent} />}
      {ctaQrDataUrl && <JpCornerQr qrDataUrl={ctaQrDataUrl} accent={theme.accent} />}
      {resolvedSubs.length > 0 && <JpLightSubtitle segments={resolvedSubs} frame={frame} y={1380} accent={theme.accent} ink={theme.ink} />}
      {showEnding && ctaLineId && <JpEndingScene lineId={ctaLineId} qrDataUrl={ctaQrDataUrl} frame={endingLocalFrame} durationInFrames={ctaDur} theme={theme} />}
      <DisclaimerWatermark tone="light" position="tr" />

      {/* 速報片头幕布 */}
      {frame < 52 && (
        <JpIntroCurtain frame={frame} bigText={theme.curtainBig} liveText={theme.curtainLive} palette={theme.curtain} durationFrames={52} />
      )}
    </AbsoluteFill>
    </TotalDurationContext.Provider>
  );
};
