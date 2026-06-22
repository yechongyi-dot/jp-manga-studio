import { staticFile } from 'remotion';

// 音効を有効にする手順:
//   1. node scripts/gen-sfx.js を実行（既に public/sfx/*.wav が生成済み）
//   2. 下の SFX_ENABLED を true に変更する
export const SFX_ENABLED = false;

export const SFX = {
  curtain:      staticFile('sfx/curtain.wav'),
  card:         staticFile('sfx/card.wav'),
  notification: staticFile('sfx/notification.wav'),
  chime:        staticFile('sfx/chime.wav'),
};
