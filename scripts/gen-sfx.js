// 合成 4 个音效 WAV 文件，保存到 public/sfx/
// 运行: node scripts/gen-sfx.js
const fs   = require('fs');
const path = require('path');

const SR = 44100; // 采样率

function writeWav(filepath, samples) {
  const dataSize = samples.length * 2; // 16-bit = 2 bytes/sample
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);      // PCM chunk size
  buf.writeUInt16LE(1,  20);      // PCM format
  buf.writeUInt16LE(1,  22);      // mono
  buf.writeUInt32LE(SR, 24);      // sample rate
  buf.writeUInt32LE(SR * 2, 28);  // byte rate
  buf.writeUInt16LE(2,  32);      // block align
  buf.writeUInt16LE(16, 34);      // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filepath, buf);
  console.log(`✓ ${path.basename(filepath)}  (${(buf.length / 1024).toFixed(1)} KB)`);
}

// 1. curtain.wav — 幕布 whoosh：高频→低频扫描 + 噪声
function curtain() {
  const n = Math.floor(SR * 0.65);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t   = i / SR;
    const env = Math.exp(-t * 2.2) * (1 - Math.exp(-t * 30));
    const f   = 2400 * Math.exp(-t * 5);  // 2400Hz → ~16Hz
    const noise = (Math.random() * 2 - 1) * 0.35;
    s[i] = (Math.sin(2 * Math.PI * f * t) * 0.55 + noise) * env * 0.88;
  }
  return s;
}

// 2. card.wav — 卡片切换：短促高频点击 + 轻微噪声
function card() {
  const n = Math.floor(SR * 0.22);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t   = i / SR;
    const env = Math.exp(-t * 22);
    const f   = 900 + 500 * Math.exp(-t * 40);
    const noise = (Math.random() * 2 - 1) * 0.38;
    s[i] = (Math.sin(2 * Math.PI * f * t) * 0.62 + noise * 0.38) * env * 0.8;
  }
  return s;
}

// 3. notification.wav — CTA 通知：双音叮声（880Hz + 1320Hz）
function notification() {
  const n = Math.floor(SR * 0.55);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t   = i / SR;
    const env = Math.exp(-t * 5.5) * (1 - Math.exp(-t * 60));
    s[i] = (
      Math.sin(2 * Math.PI * 880  * t) * 0.50 +
      Math.sin(2 * Math.PI * 1320 * t) * 0.30 +
      Math.sin(2 * Math.PI * 1760 * t) * 0.14
    ) * env * 0.9;
  }
  return s;
}

// 4. chime.wav — 结尾颤音：C5→E5→G5→C6 琶音（4 音）
function chime() {
  const n = Math.floor(SR * 2.0);
  const s = new Float32Array(n);
  // C5=523.25, E5=659.25, G5=783.99, C6=1046.5
  const notes   = [523.25, 659.25, 783.99, 1046.5];
  const offsets = [0, 0.14, 0.28, 0.46]; // 音符间隔（秒）

  for (let ni = 0; ni < notes.length; ni++) {
    const freq  = notes[ni];
    const start = Math.floor(offsets[ni] * SR);
    const dur   = Math.floor((1.55 - offsets[ni]) * SR);
    for (let i = 0; i < dur && start + i < n; i++) {
      const t   = i / SR;
      const env = Math.exp(-t * 2.8) * (1 - Math.exp(-t * 80));
      s[start + i] += (
        Math.sin(2 * Math.PI * freq     * t) * 0.60 +
        Math.sin(2 * Math.PI * freq * 2 * t) * 0.22 +
        Math.sin(2 * Math.PI * freq * 3 * t) * 0.08
      ) * env * 0.52;
    }
  }
  // 归一化防止叠加溢出
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(s[i]));
  if (peak > 0) for (let i = 0; i < n; i++) s[i] = s[i] / peak * 0.88;
  return s;
}

const outDir = path.resolve(__dirname, '..', 'public', 'sfx');
fs.mkdirSync(outDir, { recursive: true });

writeWav(path.join(outDir, 'curtain.wav'),      curtain());
writeWav(path.join(outDir, 'card.wav'),         card());
writeWav(path.join(outDir, 'notification.wav'), notification());
writeWav(path.join(outDir, 'chime.wav'),        chime());

console.log('\n全て完了 → public/sfx/ に4ファイル生成されました');
