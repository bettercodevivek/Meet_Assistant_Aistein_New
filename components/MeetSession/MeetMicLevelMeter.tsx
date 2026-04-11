'use client';

import { useEffect, useRef, useState } from 'react';

/** Simple mic input level bars for lobby / self-view (Web Audio API). */
export function MeetMicLevelMeter({
  stream,
  active,
  barCount = 5,
}: {
  stream: MediaStream | null;
  active: boolean;
  barCount?: number;
}) {
  const [levels, setLevels] = useState<number[]>(() => Array(barCount).fill(0));
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || !active) {
      setLevels(Array(barCount).fill(0));
      return;
    }

    let raf = 0;
    const setup = async () => {
      const Ctx =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(buf);
        const chunk = Math.floor(buf.length / barCount);
        const next: number[] = [];
        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          for (let j = 0; j < chunk; j++) {
            sum += buf[i * chunk + j] ?? 0;
          }
          next.push(sum / chunk / 255);
        }
        setLevels(next);
        raf = requestAnimationFrame(tick);
      };
      tick();
    };

    void setup();

    return () => {
      cancelAnimationFrame(raf);
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, [stream, active, barCount]);

  return (
    <div
      className="flex h-10 items-end justify-center gap-1.5 rounded-lg bg-black/25 px-3 py-2"
      role="meter"
      aria-label={active ? 'Microphone level' : 'Microphone idle'}
    >
      {levels.map((v, i) => (
        <span
          key={i}
          className="w-2 rounded-full bg-emerald-400/90 motion-reduce:transition-none transition-[height,opacity] duration-75"
          style={{
            height: `${10 + v * 22}px`,
            opacity: 0.35 + v * 0.65,
          }}
        />
      ))}
    </div>
  );
}
