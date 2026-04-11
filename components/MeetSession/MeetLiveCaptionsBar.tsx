'use client';

/** Google Meet–style stacked captions anchored to the bottom of the video frame */
export function MeetLiveCaptionsBar({
  guestLabel,
  hostLabel,
  userText,
  avatarText,
}: {
  guestLabel: string;
  hostLabel: string;
  userText: string;
  avatarText: string;
}) {
  const rows = [
    { key: 'user', label: guestLabel, text: userText.trim() },
    { key: 'avatar', label: hostLabel, text: avatarText.trim() },
  ].filter((r) => r.text.length > 0);

  if (rows.length === 0) return null;

  return (
    <div className="pointer-events-none w-full max-w-3xl space-y-1.5">
      {rows.map((row) => (
        <div
          key={row.key}
          className="rounded-md bg-black/80 backdrop-blur-md px-3 py-2 text-center shadow-lg border border-white/10"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8ab4f8] mr-2">
            {row.label}
          </span>
          <span className="line-clamp-2 text-sm leading-snug text-white">{row.text}</span>
        </div>
      ))}
    </div>
  );
}
