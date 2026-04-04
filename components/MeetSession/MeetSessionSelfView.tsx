'use client';

import { useEffect, useRef, useState } from 'react';

export function MeetSessionSelfView({
  audioStream,
  cameraStream,
  guestName,
  isMuted,
}: {
  audioStream: MediaStream | null;
  cameraStream: MediaStream | null;
  guestName: string;
  isMuted: boolean;
}) {
  const [levels, setLevels] = useState<number[]>([0, 0, 0, 0, 0]);
  const ctxRef = useRef<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !cameraStream) {
      if (el) el.srcObject = null;
      return;
    }
    el.srcObject = cameraStream;
    void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [cameraStream]);

  useEffect(() => {
    if (!audioStream || isMuted) {
      setLevels([0, 0, 0, 0, 0]);
      return;
    }

    let raf = 0;
    const setup = async () => {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(audioStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(buf);
        const chunk = Math.floor(buf.length / 5);
        const next: number[] = [];
        for (let i = 0; i < 5; i++) {
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
  }, [audioStream, isMuted]);

  const initial = guestName.trim().charAt(0).toUpperCase() || '?';

  const micStrip = (
    <div className="flex items-end justify-center gap-1 px-2 pb-2 pt-1">
      {audioStream && !isMuted ? (
        levels.map((v, i) => (
          <span
            key={i}
            className="w-1.5 rounded-full bg-[#8ab4f8] transition-[height] duration-75"
            style={{ height: `${8 + v * 28}px`, opacity: 0.4 + v * 0.6 }}
          />
        ))
      ) : (
        <div className="flex h-10 w-full items-center justify-center text-gray-500">
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
      )}
    </div>
  );

  if (cameraStream) {
    return (
      <div className="absolute right-4 top-16 z-[36] sm:right-6 sm:top-20">
        <div className="w-[min(200px,36vw)] overflow-hidden rounded-xl border border-white/15 bg-black shadow-2xl ring-1 ring-black/40">
          <div className="relative aspect-video bg-[#1a1a1a]">
            <video
              ref={videoRef}
              className="h-full w-full scale-x-[-1] object-cover"
              playsInline
              muted
              autoPlay
              aria-label="Your camera"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-6">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1a73e8] to-purple-600 text-[10px] font-semibold text-white">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-white">{guestName.trim() || 'Guest'}</p>
                  <p className="text-[10px] text-white/70">{isMuted ? 'Muted' : 'Mic on'}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 bg-[#2c2c2e]/95">{micStrip}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-28 right-4 z-[32] flex flex-col items-end gap-2 sm:bottom-32 sm:right-6">
      <div className="w-[140px] overflow-hidden rounded-2xl border border-white/10 bg-[#3c4043]/95 shadow-xl backdrop-blur-md sm:w-[160px]">
        <div className="flex items-center gap-2 border-b border-white/10 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1a73e8] to-purple-600 text-xs font-semibold text-white">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-white">{guestName.trim() || 'Guest'}</p>
            <p className="text-[10px] text-gray-400">{isMuted ? 'Muted' : 'Mic live'}</p>
          </div>
        </div>
        <div className="h-14">{micStrip}</div>
      </div>
    </div>
  );
}
