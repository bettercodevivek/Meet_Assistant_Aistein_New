'use client';

import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import type { AvatarStreamLifecycleHandlers } from '@/components/logic';
import type { SessionConversation } from '@/components/meeting/sessionTypes';
import { MeetLiveKitRoom, type MeetMicControls } from '@/components/MeetSession/MeetLiveKitRoom';
import { MeetSessionTopBar } from './MeetSessionTopBar';
import { MeetSessionControlBar } from './MeetSessionControlBar';
import { MeetSessionChatPanel, type LiveMessage } from './MeetSessionChatPanel';
import { MeetSessionSelfView } from './MeetSessionSelfView';
import { MeetSessionSettingsModal } from './MeetSessionSettingsModal';

function MeetSessionRoomInner({
  conversation,
  guestName,
  guestToken,
  micStream,
  onEndCall,
  streamLifecycleRef,
  onRecoveryTimeout,
}: {
  conversation: SessionConversation;
  guestName: string;
  guestToken: string;
  micStream: MediaStream | null;
  onEndCall: () => void;
  streamLifecycleRef: MutableRefObject<AvatarStreamLifecycleHandlers>;
  onRecoveryTimeout?: () => void;
}) {
  const [messages, setMessages] = useState<LiveMessage[]>(() => conversation.messages || []);
  const [chatOpen, setChatOpen] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);
  const [sessionStartedAt] = useState(() => Date.now());
  const [recoveringStream, setRecoveringStream] = useState(false);

  const [micControls, setMicControls] = useState<MeetMicControls>(() => ({
    muted: false,
    active: false,
    toggle: () => {},
  }));

  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const guestLabel = guestName.trim() || 'Guest';
  const hostLabel = 'Avatar';

  useEffect(() => {
    const raw = process.env.NEXT_PUBLIC_MEETING_STREAM_RECOVERY_MS;
    const parsed = raw ? parseInt(raw, 10) : NaN;
    const recoveryMs = Number.isFinite(parsed) ? Math.max(parsed, 30_000) : 120_000;

    streamLifecycleRef.current = {
      onStreamDisconnected: () => {
        setRecoveringStream(true);
        if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = setTimeout(() => {
          recoveryTimerRef.current = null;
          onRecoveryTimeout?.();
        }, recoveryMs);
      },
      onStreamConnected: () => {
        if (recoveryTimerRef.current) {
          clearTimeout(recoveryTimerRef.current);
          recoveryTimerRef.current = null;
        }
        setRecoveringStream(false);
      },
    };

    return () => {
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
    };
  }, [streamLifecycleRef, onRecoveryTimeout]);

  useEffect(() => {
    setMessages(conversation.messages || []);
  }, [conversation.id, conversation.messages]);

  const micForBar = useMemo(
    () => ({
      muted: micControls.muted,
      active: micControls.active,
      onToggle: micControls.toggle,
    }),
    [micControls],
  );

  return (
    <div className="fixed inset-0 bg-[#202124] text-white flex flex-col">
      <MeetSessionTopBar title={conversation.title} sessionStartedAt={sessionStartedAt} />

      <div className="flex-1 min-h-0 pt-14 relative">
        <div className="absolute inset-0 flex flex-col">
          <div className="flex-1 min-h-0 relative flex items-stretch justify-center">
            <MeetLiveKitRoom
              conversation={conversation}
              guestName={guestName}
              guestToken={guestToken}
              micStream={micStream}
              streamLifecycleRef={streamLifecycleRef}
              setMicControls={setMicControls}
            />

            <MeetSessionSelfView
              audioStream={micStream}
              guestName={guestName}
              isMuted={micControls.muted}
            />

            {recoveringStream && (
              <div className="pointer-events-none absolute inset-0 z-[40] flex items-center justify-center bg-black/35">
                <div className="pointer-events-auto mx-4 max-w-sm rounded-2xl border border-[#3C4043] bg-[#2C2C2E] px-8 py-6 text-center shadow-xl">
                  <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-white/80" aria-hidden />
                  <p className="text-lg font-medium text-white">Reconnecting…</p>
                  <p className="mt-2 text-sm text-[#9AA0A6]">
                    Your connection to the host dropped. Trying to restore the stream.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <MeetSessionChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          guestLabel={guestLabel}
          hostLabel={hostLabel}
          messages={messages}
          liveUserDraft=""
          liveAvatarDraft=""
        />
      </div>

      <MeetSessionControlBar
        chatOpen={chatOpen}
        onChatToggle={() => setChatOpen((o) => !o)}
        captionsOn={captionsOn}
        onCaptionsToggle={() => setCaptionsOn((c) => !c)}
        onSettingsOpen={() => setSettingsOpen(true)}
        onEndCall={() => setEndConfirm(true)}
        mic={micForBar}
      />

      <MeetSessionSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {endConfirm && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#3C4043] bg-[#2C2C2E] p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-white">Leave meeting?</h2>
            <p className="mb-6 text-sm text-[#9AA0A6]">You’ll disconnect from the host and your session will end.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEndConfirm(false)}
                className="flex-1 rounded-lg border border-[#3C4043] py-2.5 text-sm text-white hover:bg-white/5"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => {
                  setEndConfirm(false);
                  onEndCall();
                }}
                className="flex-1 rounded-lg bg-[#EA4335] py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MeetSessionLive({
  onMessageSent: _persistMessages,
  onGuestActivity: _onGuestActivity,
  ...inner
}: {
  conversation: SessionConversation;
  guestName: string;
  guestToken: string;
  micStream: MediaStream | null;
  onMessageSent: (message: string, role: 'user' | 'assistant') => void;
  onEndCall: () => void;
  onRecoveryTimeout?: () => void;
  onGuestActivity?: () => void;
}) {
  const streamLifecycleRef = useRef<AvatarStreamLifecycleHandlers>({});
  void _persistMessages;
  void _onGuestActivity;

  return <MeetSessionRoomInner {...inner} streamLifecycleRef={streamLifecycleRef} />;
}
