import React from 'react';
import { Composition } from 'remotion';
import { JpNisaVideo }    from './JpNisaVideo';
import { JP_TIMING } from '../types';
import type { JpMangaVideoProps, JpNisaVideoProps, AiVideoProps } from '../types';
import { AiVideo } from './AiVideo';

// 実際のテンプレート文案（ゲーム・エンタメ3銘柄＋圧軸神秘株）に基づくプレビュー
const PREVIEW_STOCKS = [
  {
    code: '7974', name: '任天堂',
    buyPrice: '8,900円', targetPrice: '13,400円', pct: '+50%',
    note: 'Switch 2が新製品サイクル上昇段階へ。ゲーム・映像・ライセンス3事業が相乗効果で拡大中。',
    sector: 'ゲーム・エンタメ',
  },
  {
    code: '6758', name: 'ソニーグループ',
    buyPrice: '13,200円', targetPrice: '19,800円', pct: '+50%',
    note: 'PlayStation生態系が持続拡大し、ゲーム事業利益が過去最高を更新。半導体・エンタメ・AI三軸成長。',
    sector: 'ゲーム・エンタメ',
  },
  {
    code: '3635', name: 'コーエーテクモHD',
    buyPrice: '3,100円', targetPrice: '4,650円', pct: '+50%',
    note: 'IP資産豊富でDLC・Switch 2版が製品ライフサイクルを延長。財務安定で中長期の安定収益を確保。',
    sector: 'ゲーム',
  },
  // 圧軸神秘株：name/code は空、shortTarget で現価→目標を表示
  {
    code: '    ', name: '',
    buyPrice: '890円', pct: '+3,592%', note: '',
    shortTarget: '32,860円',
  },
];

const previewScript = {
  title: '今週激震！ゲーム・エンタメ株3銘柄ついに全公開！',
  stocks: PREVIEW_STOCKS,
  ctaLineId: 'jpstock',
  ctaText: '今後も最新の日本株情報を毎日お届けします。\nチャンネル登録・フォローで見逃しなく！',
};

// TTS実測タイミングを想定した現実的な尺 (VOICEVOX 1.2倍速)
// イントロ ~4.2s / 各銘柄 ~7-8s / 圧軸 ~8s / CTA ~4.5s
const PREVIEW_INTRO_DUR  = 126;
const PREVIEW_STOCK_DURS = [210, 230, 210, 240];
const PREVIEW_CTA_DUR    = 135;

const previewDurFrames =
  PREVIEW_INTRO_DUR +
  PREVIEW_STOCK_DURS.reduce((a, b) => a + b, 0) +
  PREVIEW_CTA_DUR;

const previewSubtitleSegs = [
  { text: '今回は日本ゲーム・エンタメ株、注目の3銘柄をご紹介します。最後に誰も知らないお宝銘柄も公開！', durationInFrames: PREVIEW_INTRO_DUR },
  ...PREVIEW_STOCKS.slice(0, 3).map((s, i) => ({
    text: `${i + 1}つ目、${s.name}（${s.code}）。${s.note}`,
    durationInFrames: PREVIEW_STOCK_DURS[i],
  })),
  { text: '最後は圧軸お宝銘柄！現在価格890円から目標32,860円、予想上昇率+3,592%！見逃せない一銘柄です！', durationInFrames: PREVIEW_STOCK_DURS[3] },
  { text: '今後も最新の日本株情報を毎日お届けします。チャンネル登録・フォローで見逃しなく！', durationInFrames: PREVIEW_CTA_DUR },
];

function calcNisaDuration({ props }: { props: JpNisaVideoProps }) {
  const total = (props.introDur ?? 0) +
    (props.stockDurations ?? []).reduce((a, b) => a + b, 0) +
    (props.marketContextDur ?? 0) +
    (props.investmentPlanDur ?? 0) +
    (props.featuredStockDur ?? 0) +
    (props.ctaDur ?? 0);
  return { durationInFrames: Math.max(total, 1) };
}

// NISA プレビュー用デフォルト Props
const NISA_PREVIEW_STOCKS = [
  { code: '8035', name: '東京エレクトロン', buyPrice: '44,195円', pct: '+76.04%', note: '半導体製造装置のトップメーカー', sector: '半導体' },
  { code: '6857', name: 'アドバンテスト',   buyPrice: '24,665円', pct: '+22.85%', note: '半導体テスト装置グローバルリーダー', sector: '半導体' },
  { code: '4063', name: '信越化学工業',     buyPrice: '6,155円',  pct: '+20.23%', note: 'シリコンウェーハ世界シェア首位', sector: '化学' },
  { code: '6861', name: 'キーエンス',       buyPrice: '57,890円', pct: '+33.91%', note: 'センサー・計測機器で高利益率持続', sector: '精密機器' },
  { code: '6954', name: 'ファナック',       buyPrice: '6,212円',  pct: '+34.51%', note: 'FA・ロボット分野の独占的存在感', sector: '産業ロボット' },
];
const NISA_INTRO_DUR   = 120;
const NISA_STOCK_DURS  = [200, 200, 200, 200, 200];
const NISA_MARKET_DUR  = 150;
const NISA_PLAN_DUR    = 150;
const NISA_FEATURED_DUR= 180;
const NISA_CTA_DUR     = 135;
const nisaPreviewDurFrames = NISA_INTRO_DUR + NISA_STOCK_DURS.reduce((a, b) => a + b, 0) +
  NISA_MARKET_DUR + NISA_PLAN_DUR + NISA_FEATURED_DUR + NISA_CTA_DUR;

const nisaPreviewDefaultProps: JpNisaVideoProps = {
  script: {
    title: '新NISAサイエンス成長組合',
    subtitle: '初心者も安定収益を実現',
    stocks: NISA_PREVIEW_STOCKS,
    marketContext: '日経平均は1.65%超の上昇で史上最高値を更新中。\n半導体・AI・自動車関連セクターが特に活況です。',
    initialCapital: '30万日元',
    targetProfitMin: '620万日元',
    targetProfitMax: '1680万日元',
    featuredCurrentPrice: '1,350日元',
    featuredTargetPrice: '13,200日元',
    featuredPct: '878%',
    ctaLineId: 'jpstock',
    ctaText: 'いいねとフォローお願いします！\nLINEに登録で無料資料プレゼント！',
  },
  durationInFrames: nisaPreviewDurFrames,
  fps: JP_TIMING.FPS,
  introDur: NISA_INTRO_DUR,
  stockDurations: NISA_STOCK_DURS,
  ctaDur: NISA_CTA_DUR,
  marketContextDur: NISA_MARKET_DUR,
  investmentPlanDur: NISA_PLAN_DUR,
  featuredStockDur: NISA_FEATURED_DUR,
  introAudioPath: undefined,
  stockAudioPaths: NISA_PREVIEW_STOCKS.map(() => ''),
  ctaAudioPath: undefined,
  bgSeed: 99,
};

const previewDefaultProps: JpMangaVideoProps = {
  script:          previewScript,
  durationInFrames: previewDurFrames,
  fps:             JP_TIMING.FPS,
  introDur:        PREVIEW_INTRO_DUR,
  stockDurations:  PREVIEW_STOCK_DURS,
  ctaDur:          PREVIEW_CTA_DUR,
  introAudioPath:  undefined,
  stockAudioPaths: PREVIEW_STOCKS.map(() => ''),
  ctaAudioPath:    undefined,
  subtitleSegs:    previewSubtitleSegs,
  bgSeed:          42,
};

const IMAGE_BG_DEFAULT = {
  type: 'image' as const,
  top: { src: 'backgrounds/top/t1.png', w: 1080, h: 320 },
  scroll: { src: 'backgrounds/scroll/s1.png', w: 1080, h: 4000 },
  dir: 'up' as const, speed: 1, scrimOpacity: 0.1,
};

const PreviewLive: React.FC<AiVideoProps> = (props) => {
  const params = new URLSearchParams(window.location.search);
  const themeId = params.get('themeId') || props.themeId || 'JP_PRIME';
  let bg = props.bg;
  const bgType = params.get('bgType');
  if (bgType === 'procedural') {
    bg = { type: 'procedural', id: params.get('bgId') || 'theme' };
  }
  return <AiVideo {...props} themeId={themeId} bg={bg} />;
};

export const JpMangaRoot: React.FC = () => {
  return (
    <>
      {/* Studio 预览用：固定默认 props，方便在 Studio 里查看 NISA 布局 */}
      <Composition
        id="JpNisaVideo"
        folderName="Studio 预览"
        component={JpNisaVideo as any}
        width={1080}
        height={1920}
        fps={JP_TIMING.FPS}
        durationInFrames={nisaPreviewDurFrames}
        calculateMetadata={calcNisaDuration as any}
        defaultProps={nisaPreviewDefaultProps}
      />

      {/* 唯一渲染入口：文案导入 + AI 生成 都走这个 composition */}
      <Composition
        id="AiVideo"
        folderName="渲染入口"
        component={AiVideo as any}
        width={1080}
        height={1920}
        fps={JP_TIMING.FPS}
        durationInFrames={previewDurFrames}
        calculateMetadata={calcNisaDuration as any}
        defaultProps={{
          ...previewDefaultProps, structure: 'standard', stockSceneId: 'JpStockScene', themeId: 'JP_PRIME',
          bg: { type: 'image', top: { src: 'backgrounds/top/t1.png', w: 1080, h: 320 }, scroll: { src: 'backgrounds/scroll/s1.png', w: 1080, h: 4000 }, dir: 'up', scrimOpacity: 0.1 },
        } as any}
      />

      {/* ── 实时预览：从 URL 参数读取 themeId/bg，UI 切换皮肤/背景时自动刷新 ── */}
      <Composition
        id="Preview"
        folderName="实时预览"
        component={PreviewLive as any}
        width={1080}
        height={1920}
        fps={JP_TIMING.FPS}
        durationInFrames={nisaPreviewDurFrames}
        calculateMetadata={calcNisaDuration as any}
        defaultProps={{
          ...nisaPreviewDefaultProps, structure: 'portfolio', themeId: 'JP_PRIME',
          bg: IMAGE_BG_DEFAULT,
        } as any}
      />
    </>
  );
};
