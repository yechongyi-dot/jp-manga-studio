import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { AiVideo } from '../compositions/AiVideo';
import { JP_TIMING } from '../types';
import type { AiVideoProps } from '../types';
import type { JpEditorBridge } from './EditorBridge';
import { EditorPanel } from './EditorPanel';

const PREVIEW_STOCKS = [
  {
    code: '7974', name: '任天堂',
    buyPrice: '8,900円', targetPrice: '13,400円', pct: '+50%',
    note: 'Switch 2が新製品サイクル上昇段階へ。ゲーム・映像・ライセンス3事業が相乗効果で拡大中。',
    sector: 'ゲーム・エンタメ',
    ttsText: '1つ目、任天堂（7974）。Switch 2が新製品サイクル上昇段階へ。ゲーム・映像・ライセンス3事業が相乗効果で拡大中。',
  },
  {
    code: '6758', name: 'ソニーグループ',
    buyPrice: '13,200円', targetPrice: '19,800円', pct: '+50%',
    note: 'PlayStation生態系が持続拡大し、ゲーム事業利益が過去最高を更新。半導体・エンタメ・AI三軸成長。',
    sector: 'ゲーム・エンタメ',
    ttsText: '2つ目、ソニーグループ（6758）。PlayStation生態系が持続拡大し、ゲーム事業利益が過去最高を更新。',
  },
  {
    code: '3635', name: 'コーエーテクモHD',
    buyPrice: '3,100円', targetPrice: '4,650円', pct: '+50%',
    note: 'IP資産豊富でDLC・Switch 2版が製品ライフサイクルを延長。財務安定で中長期の安定収益を確保。',
    sector: 'ゲーム',
    ttsText: '3つ目、コーエーテクモHD（3635）。IP資産豊富でDLC・Switch 2版が製品ライフサイクルを延長。',
  },
  {
    code: '    ', name: '',
    buyPrice: '890円', pct: '+3,592%', note: '',
    shortTarget: '32,860円',
    ttsText: '最後は圧軸お宝銘柄！現在価格890円から目標32,860円、予想上昇率プラス3,592パーセント！',
  },
];

const INTRO_DUR = 126;
const STOCK_DURS = [210, 230, 210, 240];
const CTA_DUR = 135;
const TOTAL_DUR = INTRO_DUR + STOCK_DURS.reduce((a, b) => a + b, 0) + CTA_DUR;

const DEFAULT_PROPS: AiVideoProps = {
  script: {
    title: '今週激震！ゲーム・エンタメ株3銘柄ついに全公開！',
    stocks: PREVIEW_STOCKS,
    ctaLineId: 'jpstock',
    ctaText: '今後も最新の日本株情報を毎日お届けします。\nチャンネル登録・フォローで見逃しなく！',
    introTts: '今回は日本ゲーム・エンタメ株、注目の3銘柄をご紹介します。最後に誰も知らないお宝銘柄も公開！',
  },
  durationInFrames: TOTAL_DUR,
  fps: JP_TIMING.FPS,
  introDur: INTRO_DUR,
  stockDurations: STOCK_DURS,
  ctaDur: CTA_DUR,
  introAudioPath: undefined,
  stockAudioPaths: PREVIEW_STOCKS.map(() => ''),
  ctaAudioPath: undefined,
  subtitleSegs: [
    { text: '今回は日本ゲーム・エンタメ株、注目の3銘柄をご紹介します。最後に誰も知らないお宝銘柄も公開！', durationInFrames: INTRO_DUR },
    { text: '1つ目、任天堂（7974）。Switch 2が新製品サイクル上昇段階へ。', durationInFrames: STOCK_DURS[0] },
    { text: '2つ目、ソニーグループ（6758）。PlayStation生態系が持続拡大。', durationInFrames: STOCK_DURS[1] },
    { text: '3つ目、コーエーテクモHD（3635）。IP資産豊富でDLC・Switch 2版が延長。', durationInFrames: STOCK_DURS[2] },
    { text: '最後は圧軸お宝銘柄！現在価格890円から目標32,860円！', durationInFrames: STOCK_DURS[3] },
    { text: '今後も最新の日本株情報を毎日お届けします。チャンネル登録・フォローで見逃しなく！', durationInFrames: CTA_DUR },
  ],
  bgSeed: 42,
  structure: 'standard',
  stockSceneId: 'JpStockScene',
  themeId: 'JP_PRIME',
  bg: { type: 'procedural', id: 'theme' },
};

export const EditorPlayer: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  const [props, setProps] = useState<AiVideoProps>(DEFAULT_PROPS);
  const [panelOpen, setPanelOpen] = useState(false);

  const patchProps = useCallback((patch: Partial<AiVideoProps>) => {
    setProps(prev => {
      const next = { ...prev, ...patch };
      if (patch.script) next.script = { ...(prev.script || {}), ...patch.script } as any;
      return next;
    });
  }, []);

  useEffect(() => {
    const bridge: JpEditorBridge = {
      setProps: patchProps,
      loadPreview: (full) => setProps(full),
      play: () => playerRef.current?.play(),
      pause: () => playerRef.current?.pause(),
      seekTo: (f) => playerRef.current?.seekTo(f),
      getCurrentFrame: () => (playerRef.current as any)?.getCurrentFrame?.() ?? 0,
      isPlaying: () => (playerRef.current as any)?.isPlaying?.() ?? false,
    };
    window.__JP_EDITOR = bridge;

    const dot = document.getElementById('studioDot');
    const label = document.getElementById('studioLabel');
    const overlay = document.getElementById('studioOverlay');
    if (dot) dot.className = 'studio-dot connected';
    if (label) label.textContent = '编辑器就绪';
    if (overlay) overlay.style.display = 'none';

    return () => { delete window.__JP_EDITOR; };
  }, [patchProps]);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#040a14' }}>
        <Player
          ref={playerRef}
          component={AiVideo as unknown as React.ComponentType<Record<string, unknown>>}
          inputProps={props as unknown as Record<string, unknown>}
          compositionWidth={1080}
          compositionHeight={1920}
          fps={props.fps || JP_TIMING.FPS}
          durationInFrames={props.durationInFrames || TOTAL_DUR}
          style={{ width: '100%', height: '100%' }}
          controls
          loop
          autoPlay={false}
          clickToPlay
        />
        {/* 面板切换按钮 */}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          style={{
            position: 'absolute', top: 8, right: 8, zIndex: 10,
            background: 'rgba(6,12,24,0.85)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6, color: '#c5d0dc', fontSize: 12, padding: '4px 10px',
            cursor: 'pointer', fontFamily: 'system-ui',
          }}
        >
          {panelOpen ? '收起面板 ▸' : '◂ 编辑'}
        </button>
      </div>
      {panelOpen && (
        <EditorPanel props={props} onChange={patchProps} />
      )}
    </div>
  );
};
