import React from 'react';
import { AbsoluteFill, interpolate, spring, useVideoConfig } from 'remotion';

interface Props {
  lineId:      string;
  frame:       number;
  durationInFrames?: number;
}

const FONT   = "'Noto Sans JP','Hiragino Kaku Gothic ProN',sans-serif";
const MONO   = "'Roboto Mono','SF Mono',monospace";
const RED    = '#E8392B';
const LINE_G = '#06C755';
const GOLD   = '#FFD060';

// Simple deterministic particle field
function Particles({ frame, count = 22 }: { frame: number; count?: number }) {
  const particles = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const seed  = i * 137.508;
      const x     = ((seed * 9.3) % 100);
      const baseY = ((seed * 7.1) % 100);
      const size  = 2 + (i % 4);
      const speed = 0.12 + (i % 5) * 0.06;
      const delay = (i % 30);
      arr.push({ x, baseY, size, speed, delay });
    }
    return arr;
  }, [count]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map((p, i) => {
        const y = ((p.baseY - (frame - p.delay) * p.speed + 200) % 110) - 10;
        const op = 0.2 + 0.4 * Math.sin((frame + i * 7) * 0.08);
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${p.x}%`,
            top:  `${y}%`,
            width:  p.size,
            height: p.size,
            borderRadius: p.size,
            background: i % 3 === 0 ? GOLD : i % 3 === 1 ? RED : '#FFFFFF',
            opacity: op,
          }} />
        );
      })}
    </div>
  );
}

export const EndingCTA: React.FC<Props> = ({
  lineId,
  frame,
  durationInFrames = 90,
}) => {
  const { fps } = useVideoConfig();

  const bgOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const titleY = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 220 },
    from: -80,
    to: 0,
  });

  const titleOp = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const cardScale = spring({
    frame: Math.max(0, frame - 12),
    fps,
    config: { damping: 14, stiffness: 280 },
    from: 0.6,
    to: 1,
  });
  const cardOp = interpolate(frame, [12, 28], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const btnY = spring({
    frame: Math.max(0, frame - 28),
    fps,
    config: { damping: 18, stiffness: 250 },
    from: 60,
    to: 0,
  });
  const btnOp = interpolate(frame, [28, 44], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const subOp = interpolate(frame, [44, 60], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Fade out near end
  const fadeOut = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const pulseOp = 0.75 + 0.25 * Math.sin(frame * 0.20);
  const lineGlow = 14 + 6 * Math.sin(frame * 0.16);

  return (
    <AbsoluteFill style={{ opacity: bgOp * fadeOut, zIndex: 200 }}>

      {/* Dark gradient background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(4,6,16,0.92) 0%, rgba(2,4,12,0.97) 100%)',
      }} />

      <Particles frame={frame} />

      {/* Red diagonal accent */}
      <div style={{
        position: 'absolute',
        top: -120, right: -80,
        width: 500, height: 500,
        background: `radial-gradient(circle, rgba(232,57,43,0.18) 0%, transparent 65%)`,
      }} />
      <div style={{
        position: 'absolute',
        bottom: -80, left: -60,
        width: 420, height: 420,
        background: `radial-gradient(circle, rgba(6,199,85,0.12) 0%, transparent 65%)`,
      }} />

      {/* Main content column */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 0,
        paddingLeft: 52, paddingRight: 52,
      }}>

        {/* Title */}
        <div style={{
          transform: `translateY(${titleY}px)`,
          opacity: titleOp,
          marginBottom: 48,
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 30, fontWeight: 600,
            color: 'rgba(255,255,255,0.70)',
            lineHeight: 1.6,
            textAlign: 'center',
          }}>
            今後も最新の日本株情報を<br />毎日お届けします
          </div>
        </div>

        {/* LINE ID card */}
        <div style={{
          transform: `scale(${cardScale})`,
          opacity: cardOp,
          marginBottom: 44,
          width: '100%',
        }}>
          <div style={{
            background: `linear-gradient(135deg, #00A040 0%, ${LINE_G} 50%, #00A040 100%)`,
            borderRadius: 28,
            padding: '32px 44px',
            boxShadow: `0 8px 40px rgba(6,199,85,0.40), 0 0 ${lineGlow}px rgba(6,199,85,0.20)`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              fontFamily: FONT, fontSize: 22, fontWeight: 600,
              color: 'rgba(255,255,255,0.80)',
              letterSpacing: '1px',
            }}>
              LINE公式アカウント
            </div>
            <div style={{
              fontFamily: MONO, fontSize: 54, fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: '2px',
              textShadow: '0 2px 16px rgba(0,0,0,0.4)',
            }}>
              {lineId}
            </div>
            {/* QR placeholder */}
            <div style={{
              marginTop: 8,
              width: 120, height: 120,
              background: '#FFFFFF',
              borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            }}>
              <div style={{
                width: 96, height: 96,
                display: 'grid',
                gridTemplateColumns: 'repeat(8,12px)',
                gridTemplateRows: 'repeat(8,12px)',
                gap: 0,
              }}>
                {Array.from({ length: 64 }, (_, i) => (
                  <div key={i} style={{
                    background: ((i * 37 + Math.floor(i / 8) * 13) % 3 === 0) ? '#1A1A1A' : '#FFFFFF',
                    borderRadius: 1,
                  }} />
                ))}
              </div>
            </div>
            <div style={{
              fontFamily: FONT, fontSize: 20, fontWeight: 500,
              color: 'rgba(255,255,255,0.75)',
            }}>
              QRコードをスキャンして登録
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{
          transform: `translateY(${btnY}px)`,
          opacity: btnOp,
          display: 'flex', gap: 18,
          marginBottom: 36,
        }}>
          {[
            { icon: '👍', label: 'いいね' },
            { icon: '🔔', label: 'チャンネル登録' },
            { icon: '📤', label: 'シェア' },
          ].map(({ icon, label }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.10)',
              border: '1.5px solid rgba(255,255,255,0.20)',
              backdropFilter: 'blur(12px)',
              borderRadius: 50, padding: '12px 22px',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 2px 12px rgba(0,0,0,0.30)',
            }}>
              <span style={{ fontSize: 24 }}>{icon}</span>
              <span style={{
                fontFamily: FONT, fontSize: 22, color: 'rgba(255,255,255,0.90)', fontWeight: 600,
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Thank you message */}
        <div style={{ opacity: subOp, textAlign: 'center' }}>
          <span style={{
            fontFamily: FONT, fontSize: 28, fontWeight: 500,
            color: 'rgba(255,255,255,0.55)',
          }}>
            ご視聴ありがとうございました
          </span>
        </div>

      </div>
    </AbsoluteFill>
  );
};
