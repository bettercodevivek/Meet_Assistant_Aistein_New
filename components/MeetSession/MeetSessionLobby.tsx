'use client';

import { AlertTriangle, User } from 'lucide-react';

import { MeetMicLevelMeter } from '@/components/MeetSession/MeetMicLevelMeter';

function shortAvatarLabel(avatarId: string, maxLen = 36) {
  const t = avatarId.trim();
  if (!t) return '';
  if (t.length <= maxLen) return t;
  return `${t.slice(0, 14)}…${t.slice(-8)}`;
}

function joinErrorDetails(message: string): { title: string; hint: string } {
  const m = message.toLowerCase();
  if (m.includes('too many') || m.includes('429') || m.includes('try again')) {
    return {
      title: 'Too many join attempts',
      hint: 'Wait a minute and try again, or ask the host for a fresh link.',
    };
  }
  if (m.includes('not available') || m.includes('409') || m.includes('session') || m.includes('limit')) {
    return {
      title: 'This meeting can’t accept new guests',
      hint: 'The session may be full, ended, or the link may have expired.',
    };
  }
  if (m.includes('microphone') || m.includes('permission')) {
    return {
      title: 'Microphone blocked',
      hint: 'Allow microphone access in your browser settings for this site.',
    };
  }
  return {
    title: 'Couldn’t join',
    hint: message,
  };
}

export function MeetSessionLobby({
  meetingTitle,
  avatarId,
  avatarPreviewUrl,
  avatarHostName,
  guestName,
  onGuestNameChange,
  micStatus,
  onRequestMic,
  joinError,
  joining,
  onJoin,
  canJoin,
  micStream,
}: {
  meetingTitle: string;
  avatarId: string;
  avatarPreviewUrl: string | null;
  avatarHostName: string | null;
  guestName: string;
  onGuestNameChange: (v: string) => void;
  micStatus: 'idle' | 'pending' | 'granted' | 'denied';
  onRequestMic: () => void;
  joinError: string | null;
  joining: boolean;
  onJoin: () => void;
  canJoin: boolean;
  micStream: MediaStream | null;
}) {
  const displayName = avatarHostName?.trim() || 'AI host';
  const subLabel = avatarHostName?.trim() ? shortAvatarLabel(avatarId, 40) : shortAvatarLabel(avatarId);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#202124] px-4 py-12 sm:mx-0">
      <div className="w-full max-w-lg rounded-2xl bg-[#2C2C2E] p-8 shadow-xl sm:p-10">
        <p className="text-[13px] text-[#9AA0A6]">Ask to join</p>

        <h1 className="mt-2 text-xl font-semibold leading-snug text-white">{meetingTitle}</h1>

        <div className="mt-8 flex justify-center">
          <div
            className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#1a4d7a] to-[#5c2d8a] ring-2 ring-white/10 sm:h-36 sm:w-36"
            aria-hidden
          >
            {avatarPreviewUrl ? (
              <img
                src={avatarPreviewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-14 w-14 text-white/90 sm:h-16 sm:w-16" strokeWidth={1.5} />
            )}
          </div>
        </div>
        <p className="mt-3 text-center text-sm font-medium text-white">{displayName}</p>
        {subLabel ? (
          <p className="mt-1 text-center text-[12px] text-[#9AA0A6] truncate px-1" title={avatarId}>
            {subLabel}
          </p>
        ) : null}

        <div className="mt-8 space-y-5">
          <div>
            <label htmlFor="meet-guest-name" className="mb-1.5 block text-[13px] text-[#9AA0A6]">
              Your name
            </label>
            <input
              id="meet-guest-name"
              type="text"
              autoComplete="name"
              value={guestName}
              onChange={(e) => onGuestNameChange(e.target.value)}
              placeholder="Enter your name"
              maxLength={120}
              className="h-11 w-full rounded-lg border-0 bg-[#3C4043] px-3 text-white placeholder:text-[#9AA0A6] outline-none ring-0 focus:ring-2 focus:ring-[#1A73E8]/40"
            />
          </div>

          <div className="rounded-lg bg-[#3C4043] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">Microphone</p>
                <p className="mt-1 text-xs text-[#9AA0A6]">
                  {micStatus === 'idle' && 'Test your mic before you join'}
                  {micStatus === 'pending' && 'Waiting for browser…'}
                  {micStatus === 'granted' && 'Working — you’re ready'}
                  {micStatus === 'denied' && 'Allow access in browser settings'}
                </p>
              </div>
              {micStatus !== 'granted' ? (
                <button
                  type="button"
                  onClick={onRequestMic}
                  disabled={micStatus === 'pending'}
                  className="shrink-0 rounded-lg border border-white/15 bg-[#2C2C2E] px-3 py-1.5 text-sm font-medium text-white hover:bg-white/5 disabled:opacity-50"
                >
                  {micStatus === 'pending' ? '…' : 'Test mic'}
                </button>
              ) : (
                <span className="text-xs font-medium text-emerald-400">OK</span>
              )}
            </div>
            {micStatus === 'granted' && micStream ? (
              <div className="mt-3">
                <MeetMicLevelMeter stream={micStream} active />
              </div>
            ) : null}
          </div>

          {joinError ? (
            <div
              className="flex gap-3 rounded-xl border border-red-500/35 bg-red-950/40 px-4 py-3 text-left"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden />
              <div>
                <p className="text-sm font-medium text-red-100">{joinErrorDetails(joinError).title}</p>
                <p className="mt-1 text-xs leading-relaxed text-red-200/80">
                  {joinErrorDetails(joinError).hint}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 pt-1">
            <button
              type="button"
              onClick={onJoin}
              disabled={joining || !guestName.trim() || micStatus !== 'granted' || !canJoin}
              className="h-12 w-full rounded-full bg-[#1A73E8] text-[16px] font-semibold text-white shadow-lg shadow-[#1A73E8]/20 transition hover:bg-[#1557b0] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            >
              {joining ? 'Joining…' : 'Join now'}
            </button>
            {micStatus !== 'granted' ? (
              <p className="text-center text-[12px] text-[#9AA0A6]">
                Use <span className="text-white/80">Test mic</span> above, then join when the level moves.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
