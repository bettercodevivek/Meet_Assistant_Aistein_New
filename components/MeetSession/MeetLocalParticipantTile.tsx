'use client';

import { Mic, MicOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { MeetParticipantTile } from '@/components/MeetSession/MeetParticipantTile';

/** Local user tile for the Meet grid (camera or avatar + mic status). */
export function MeetLocalParticipantTile({
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
  const label = guestName.trim() || 'Guest';

  const micFooter =
    !isMuted && audioStream ? (
      <span className="flex h-5 items-end justify-end gap-0.5 pr-0.5" aria-hidden>
        {levels.map((v, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-[#8ab4f8]"
            style={{ height: `${4 + v * 10}px`, opacity: 0.4 + v * 0.6 }}
          />
        ))}
      </span>
    ) : (
      <span className="flex items-center rounded-full bg-black/45 px-1.5 py-1">
        {isMuted ? (
          <MicOff className="h-3.5 w-3.5 text-white" aria-hidden />
        ) : (
          <Mic className="h-3.5 w-3.5 text-white" aria-hidden />
        )}
      </span>
    );

  return (
    <MeetParticipantTile name={label} className="h-full min-h-[200px] flex-col" footerRight={micFooter}>
      {cameraStream ? (
        <video
          ref={videoRef}
          className="h-full min-h-[200px] w-full scale-x-[-1] object-cover"
          playsInline
          muted
          autoPlay
          aria-label="Your camera"
        />
      ) : (
        <div className="flex h-full min-h-[200px] w-full flex-col items-center justify-center bg-[#3c4043]">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#1a73e8] to-purple-600 text-2xl font-semibold text-white">
            {initial}
          </div>
          <p className="mt-3 text-xs text-white/60">{isMuted ? 'Muted' : 'Mic on'}</p>
        </div>
      )}
    </MeetParticipantTile>
  );
}
