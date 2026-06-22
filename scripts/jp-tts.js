'use strict';
/**
 * jp-tts.js
 *
 * 利用可能音声:
 *   Edge TTS: ja-JP-NanamiNeural（女声）、ja-JP-KeitaNeural（男声）
 *   VOICEVOX: localhost:50021 HTTP API
 */

const http      = require('http');
const fs        = require('fs');
const path      = require('path');
const { spawn } = require('child_process');

let _ttsSeq = 0;  // 一時スクリプト名の衝突防止（並列合成で Date.now() のみだと同ミリ秒で衝突→相互削除→偽失敗）

const VOICEVOX_HOST = 'localhost';
const VOICEVOX_PORT = 50021;

// ── 確認済み Edge TTS 日本語音声 ─────────────────────────────────────────────
const EDGE_VOICES = [
  { id: 'ja-JP-NanamiNeural', label: 'Nanami（女声・標準）', gender: 'Female' },
  { id: 'ja-JP-KeitaNeural',  label: 'Keita（男声・標準）',  gender: 'Male'   },
];

// ── VOICEVOX ─────────────────────────────────────────────────────────────────
function voicevoxRequest(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: VOICEVOX_HOST,
      port:     VOICEVOX_PORT,
      path:     pathname,
      method,
      headers: body
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
        : {},
    };
    const req = http.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode >= 400) return reject(new Error(`VOICEVOX ${res.statusCode}: ${buf}`));
        resolve(buf);
      });
    });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('VOICEVOX 请求超时 (30s)')); });
    req.on('error', reject);
    if (body) req.write(bodyStr);
    req.end();
  });
}

async function synthesizeVoicevox(text, outPath, speakerId = 1, opts = {}) {
  const qBuf  = await voicevoxRequest('POST', `/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`);
  const query = JSON.parse(qBuf.toString());
  query.speedScale        = opts.speedScale        ?? 1.15;
  query.volumeScale       = opts.volumeScale       ?? 1.0;
  query.pitchScale        = opts.pitchScale        ?? 0.0;
  query.intonationScale   = opts.intonationScale   ?? 1.0;
  query.prePhonemeLength  = opts.prePhonemeLength  ?? 0.1;
  query.postPhonemeLength = opts.postPhonemeLength ?? 0.1;
  const audioBuf = await voicevoxRequest('POST', `/synthesis?speaker=${speakerId}`, query);
  if (!audioBuf || audioBuf.length < 44) throw new Error(`VOICEVOX 合成結果が空です (${audioBuf?.length || 0} bytes)`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, audioBuf);
  return outPath;
}

async function checkVoicevox() {
  try { await voicevoxRequest('GET', '/version'); return true; }
  catch { return false; }
}

async function listVoicevoxSpeakers() {
  const buf = await voicevoxRequest('GET', '/speakers');
  return JSON.parse(buf.toString());
}

// ── Edge TTS ─────────────────────────────────────────────────────────────────
function synthesizeEdge(text, outPath, voice = 'ja-JP-NanamiNeural', rate = '+0%') {
  // voice を検証（無効な音声名を使わないため）
  const validIds = EDGE_VOICES.map(v => v.id);
  if (!validIds.includes(voice)) {
    console.warn(`[TTS] 無効な音声 "${voice}"、Nanami にフォールバック`);
    voice = 'ja-JP-NanamiNeural';
  }

  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const script = `
import asyncio, edge_tts, sys

async def main():
    try:
        tts = edge_tts.Communicate(
            text=${JSON.stringify(text)},
            voice=${JSON.stringify(voice)},
            rate=${JSON.stringify(rate)},
        )
        await tts.save(${JSON.stringify(outPath)})
    except Exception as e:
        print(f"TTS error: {e}", file=sys.stderr)
        sys.exit(1)

asyncio.run(main())
`;
    const tmpScript = path.join(path.dirname(outPath), `_tts_${process.pid}_${++_ttsSeq}.py`);
    fs.writeFileSync(tmpScript, script, 'utf8');

    const proc = spawn('python', [tmpScript], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stdout.resume();
    proc.stderr.on('data', d => (stderr += d));
    proc.on('error', e => {   // python 未インストール等で spawn 失敗時に Promise がハングするのを防ぐ
      try { fs.unlinkSync(tmpScript); } catch {}
      reject(new Error(`Edge TTS 起動失敗（python が見つからない可能性）: ${e.message}`));
    });
    proc.on('exit', code => {
      try { fs.unlinkSync(tmpScript); } catch {}
      if (code === 0 && fs.existsSync(outPath)) {
        resolve(outPath);
      } else {
        reject(new Error(`Edge TTS 失敗 (code=${code}): ${stderr}`));
      }
    });
  });
}

// ── メイン合成 ────────────────────────────────────────────────────────────────
async function synthesize(text, outPath, opts = {}) {
  const engine    = opts.engine || 'auto';
  const voice     = opts.voice  || 'ja-JP-NanamiNeural';
  const rate      = opts.rate   || '+0%';
  const speakerId = opts.speakerId ?? 1;

  if (engine === 'voicevox') return synthesizeVoicevox(text, outPath, speakerId, opts);
  if (engine === 'edge')     return synthesizeEdge(text, outPath, voice, rate);

  // auto: VOICEVOX 優先
  const vvOk = await checkVoicevox();
  if (vvOk) return synthesizeVoicevox(text, outPath, speakerId, opts);
  return synthesizeEdge(text, outPath, voice, rate);
}

// ── 音声長さ取得 ──────────────────────────────────────────────────────────────
function getAudioDuration(audioPath) {
  return new Promise(resolve => {
    // ffprobe を最初に試す（最も信頼性が高い）
    const ff = spawn('ffprobe', [
      '-v', 'quiet', '-show_entries', 'format=duration',
      '-of', 'csv=p=0', audioPath,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    ff.stdout.on('data', d => (out += d));
    ff.on('error', () => resolve(3.0));   // ffprobe 未インストール時にハングせず兜底
    ff.on('exit', c => {
      const sec = parseFloat(out.trim());
      if (c === 0 && !isNaN(sec) && sec > 0) { resolve(sec); return; }

      // WAV fallback via python wave module
      const proc = spawn('python', ['-c', `
import wave, contextlib, sys
try:
    with contextlib.closing(wave.open(sys.argv[1],'r')) as f:
        print(f.getnframes()/float(f.getframerate()))
except:
    print(0)
`, audioPath], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out2 = '';
      proc.stdout.on('data', d => (out2 += d));
      proc.on('error', () => resolve(3.0));   // python 未インストール時にハングせず兜底
      proc.on('exit', () => {
        const wavSec = parseFloat(out2.trim());
        if (!isNaN(wavSec) && wavSec > 0) { resolve(wavSec); return; }
        // 最終手段：ファイルサイズから推定
        try {
          const bytes = require('fs').statSync(audioPath).size;
          const isWav = audioPath.toLowerCase().endsWith('.wav');
          // WAV: 16bit/48kHz/mono ≈ 96KB/s、MP3: 128kbps ≈ 16KB/s
          const bytesPerSec = isWav ? (48000 * 2) : (128 * 1024 / 8);
          const est = Math.max(1, bytes / bytesPerSec);
          console.warn(`[TTS] 音声時長をファイルサイズから推定 (${isWav ? 'WAV' : 'MP3'}): ${audioPath} → ${est.toFixed(1)}s`);
          resolve(est);
        } catch {
          console.error(`[TTS] 音声時長取得失敗、3秒で代替: ${audioPath}`);
          resolve(3.0);
        }
      });
    });
  });
}

module.exports = {
  synthesize,
  checkVoicevox,
  listVoicevoxSpeakers,
  getAudioDuration,
  EDGE_VOICES,
};
