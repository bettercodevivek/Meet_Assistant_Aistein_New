'use client';

import { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { SessionConversation } from '@/components/meeting/sessionTypes';

export type LiveMessage = SessionConversation['messages'][number];

function formatTranscriptLine(speaker: string, content: string, timestamp: string | Date) {
  const t = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `[${time}] ${speaker}: ${content}`;
}

export function MeetSessionChatPanel({
  open,
  onClose,
  guestLabel,
  hostLabel,
  messages,
  liveUserDraft,
  liveAvatarDraft,
}: {
  open: boolean;
  onClose: () => void;
  guestLabel: string;
  hostLabel: string;
  messages: LiveMessage[];
  liveUserDraft: string;
  liveAvatarDraft: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (open) {
      scrollToBottom();
    }
  }, [messages, liveUserDraft, liveAvatarDraft, open, scrollToBottom]);

  const copyTranscript = useCallback(async () => {
    const lines: string[] = [];
    for (const m of messages) {
      const speaker = m.role === 'user' ? guestLabel : hostLabel;
      lines.push(formatTranscriptLine(speaker, m.content, m.timestamp));
    }
    if (liveUserDraft.trim()) {
      lines.push(`[…] ${guestLabel}: ${liveUserDraft.trim()} (in progress)`);
    }
    if (liveAvatarDraft.trim()) {
      lines.push(`[…] ${hostLabel}: ${liveAvatarDraft.trim()} (in progress)`);
    }
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }, [guestLabel, hostLabel, messages, liveUserDraft, liveAvatarDraft]);

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          aria-label="Close transcript"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={[
          'fixed right-0 top-14 z-[35] flex w-full max-w-[360px] flex-col border-l border-[#3C4043] bg-[#2C2C2E] shadow-xl transition-transform duration-300 ease-out',
          'bottom-28',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#3C4043] px-4 py-3">
          <h2 className="min-w-0 shrink text-base font-semibold text-white">Transcript</h2>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => void copyTranscript()}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#8AB4F8] hover:bg-white/10"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-[#9AA0A6] hover:bg-white/10 hover:text-white"
              aria-label="Close panel"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-3 py-3">
          {messages.length === 0 && !liveUserDraft.trim() && !liveAvatarDraft.trim() ? (
            <p className="py-8 text-center text-sm text-[#9AA0A6]">No transcript yet</p>
          ) : (
            <>
              {messages.map((m, i) => {
                const isUser = m.role === 'user';
                const ts = new Date(m.timestamp);
                return (
                  <div
                    key={m.id || i}
                    className={`rounded-lg p-3 ${isUser ? 'bg-[#394457]' : 'bg-[#3C4043]'}`}
                  >
                    <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-xs text-[#9AA0A6]">
                        {isUser ? guestLabel : hostLabel}
                      </span>
                      <time className="text-[11px] tabular-nums text-[#9AA0A6]" dateTime={ts.toISOString()}>
                        {ts.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </time>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white">
                      {m.content}
                    </p>
                  </div>
                );
              })}

              {liveUserDraft.trim() ? (
                <div className="rounded-lg bg-[#394457] p-3 opacity-80">
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs text-[#9AA0A6]">{guestLabel}</span>
                    <span className="text-[10px] uppercase tracking-wide text-[#9AA0A6]">Speaking…</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm italic leading-relaxed text-white/90">
                    {liveUserDraft}
                  </p>
                </div>
              ) : null}

              {liveAvatarDraft.trim() ? (
                <div className="rounded-lg bg-[#3C4043] p-3 opacity-80">
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs text-[#9AA0A6]">{hostLabel}</span>
                    <span className="text-[10px] uppercase tracking-wide text-[#9AA0A6]">Speaking…</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm italic leading-relaxed text-white/90">
                    {liveAvatarDraft}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
