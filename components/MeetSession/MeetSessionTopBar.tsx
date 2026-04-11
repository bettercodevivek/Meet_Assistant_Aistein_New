'use client';

import { useEffect, useState } from 'react';

export function MeetSessionTopBar({
  title,
  sessionStartedAt,
}: {
  title: string;
  sessionStartedAt: number;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => {
      setElapsed(Math.floor((Date.now() - sessionStartedAt) / 1000));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sessionStartedAt]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const label = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  return (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between bg-transparent px-4 sm:px-6">
      <div className="min-w-0 flex-1 pr-4">
        <h1 className="truncate text-sm font-medium text-white/90">{title}</h1>
      </div>
      <time
        className="shrink-0 font-mono text-sm tabular-nums text-[#9AA0A6]"
        dateTime={`PT${Math.floor(elapsed / 3600)}H${Math.floor((elapsed % 3600) / 60)}M${elapsed % 60}S`}
      >
        {label}
      </time>
    </header>
  );
}
