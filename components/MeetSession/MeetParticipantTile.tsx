'use client';

import type { ReactNode } from 'react';

/**
 * Google Meet–style participant tile: media fills the frame, name on a bottom-left strip.
 */
export function MeetParticipantTile({
  name,
  children,
  className = '',
  footerRight,
}: {
  name: string;
  children: ReactNode;
  className?: string;
  /** e.g. mic/cam status icons in the bottom bar */
  footerRight?: ReactNode;
}) {
  return (
    <div
      className={`relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-[#202124] ring-1 ring-white/[0.08] ${className}`}
    >
      <div className="relative min-h-0 flex-1 bg-black">{children}</div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pb-2 pt-10">
        <span className="min-w-0 max-w-[85%] truncate rounded bg-black/55 px-2 py-1 text-left text-xs font-medium text-white shadow-sm">
          {name}
        </span>
        {footerRight ? <div className="pointer-events-auto shrink-0">{footerRight}</div> : null}
      </div>
    </div>
  );
}
