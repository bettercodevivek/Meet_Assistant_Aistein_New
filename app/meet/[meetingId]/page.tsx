'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import type { SessionConversation } from '@/components/meeting/sessionTypes';
import { MeetSessionLobby } from '@/components/MeetSession/MeetSessionLobby';
import { MeetSessionLive } from '@/components/MeetSession/MeetSessionLive';
import { MeetSessionLeftScreen } from '@/components/MeetSession/MeetSessionLeftScreen';

type LobbyMeeting = {
  title: string;
  avatarId: string;
  liveAvatarAvatarUuid?: string | null;
  status: string;
  isValid: boolean;
};

type Phase = 'loading' | 'invalid' | 'lobby' | 'session' | 'left';

export default function PublicMeetPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const [meetingSlug, setMeetingSlug] = useState<string>('');
  const [phase, setPhase] = useState<Phase>('loading');
  const [lobbyMeeting, setLobbyMeeting] = useState<LobbyMeeting | null>(null);
  const [guestName, setGuestName] = useState('');
  const [micStatus, setMicStatus] = useState<'idle' | 'pending' | 'granted' | 'denied'>('idle');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [conversation, setConversation] = useState<SessionConversation | null>(null);
  const [conversationId, setConversationId] = useState('');
  const [sessionLoading, setSessionLoading] = useState(false);
  const [leftMeta, setLeftMeta] = useState<{ durationMs: number; canRejoin: boolean } | null>(null);
  const [lobbyMicStream, setLobbyMicStream] = useState<MediaStream | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarHostName, setAvatarHostName] = useState<string | null>(null);

  const guestTokenRef = useRef<string | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  cameraStreamRef.current = cameraStream;
  const sessionStartRef = useRef<number>(0);
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const lastGuestActivityRef = useRef<number>(Date.now());
  const handleEndCallRef = useRef<() => Promise<void>>(async () => {});
  const conversationIdRef = useRef('');

  const guestIdleMs = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_MEETING_GUEST_IDLE_MS;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= 30_000 ? n : 300_000;
  }, []);

  useEffect(() => {
    const load = async () => {
      const { meetingId } = await params;
      setMeetingSlug(meetingId);
    };
    void load();
  }, [params]);

  const fetchMeetingMeta = useCallback(async () => {
    if (!meetingSlug) return;
    setLobbyMeeting(null);
    setPhase('loading');
    try {
      const res = await fetch(`/api/meetings/${encodeURIComponent(meetingSlug)}`);
      const data = await res.json();
      if (!res.ok || !data.success || !data.meeting) {
        setPhase('invalid');
        setLobbyMeeting(null);
        return;
      }
      const m = data.meeting as LobbyMeeting;
      setLobbyMeeting(m);
      setPhase(m.isValid ? 'lobby' : 'invalid');
    } catch {
      setPhase('invalid');
      setLobbyMeeting(null);
    }
  }, [meetingSlug]);

  useEffect(() => {
    void fetchMeetingMeta();
  }, [fetchMeetingMeta]);

  useEffect(() => {
    const uuid = lobbyMeeting?.liveAvatarAvatarUuid?.trim();
    if (!uuid || phase !== 'lobby') {
      setAvatarPreviewUrl(null);
      setAvatarHostName(null);
      return;
    }
    let cancelled = false;
    void fetch(`/api/public/avatar-preview?uuid=${encodeURIComponent(uuid)}`)
      .then((r) => r.json())
      .then(
        (data: {
          success?: boolean;
          previewUrl?: string | null;
          name?: string | null;
        }) => {
          if (cancelled) return;
          setAvatarPreviewUrl(typeof data.previewUrl === 'string' ? data.previewUrl : null);
          setAvatarHostName(typeof data.name === 'string' ? data.name : null);
        },
      )
      .catch(() => {
        if (!cancelled) {
          setAvatarPreviewUrl(null);
          setAvatarHostName(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lobbyMeeting?.liveAvatarAvatarUuid, phase]);

  const requestMicrophone = async () => {
    setMicStatus('pending');
    setJoinError(null);
    try {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      setLobbyMicStream(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setLobbyMicStream(stream);
      setMicStatus('granted');
    } catch {
      setMicStatus('denied');
      setLobbyMicStream(null);
      setJoinError('Microphone access is required to join the voice session.');
    }
  };

  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraStream]);

  const toggleCamera = useCallback(async () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      setCameraStream(stream);
    } catch {
      console.error('Camera access was denied or unavailable.');
    }
  }, [cameraStream]);

  const startSession = async () => {
    if (!meetingSlug || !guestName.trim()) return;
    setJoining(true);
    setJoinError(null);
    try {
      const storageKey = `meet_guest_session_${meetingSlug}`;
      let guestSessionKey = sessionStorage.getItem(storageKey);
      if (!guestSessionKey) {
        guestSessionKey = crypto.randomUUID();
        sessionStorage.setItem(storageKey, guestSessionKey);
      }

      const res = await fetch(`/api/meetings/${encodeURIComponent(meetingSlug)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: guestName.trim(),
          guestSessionKey,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setJoinError(data.message || 'Could not join meeting');
        if (res.status === 409 || res.status === 429) {
          void fetchMeetingMeta();
        }
        return;
      }
      guestTokenRef.current = data.guestToken as string;
      setConversationId(data.conversationId as string);
      saveChainRef.current = Promise.resolve();
      setSessionLoading(true);
      setPhase('session');
      sessionStartRef.current = Date.now();

      const cont = await fetch(`/api/conversations/${data.conversationId}/continue`, {
        method: 'POST',
        headers: { 'x-guest-token': data.guestToken as string },
      });
      const contData = await cont.json();
      if (!cont.ok || !contData.success) {
        setJoinError(contData.message || 'Failed to start session');
        guestTokenRef.current = null;
        setPhase('lobby');
        setConversationId('');
        return;
      }
      setConversation({
        ...contData.conversation,
        messages: contData.messages || [],
      });
    } catch {
      setJoinError('Something went wrong. Please try again.');
    } finally {
      setJoining(false);
      setSessionLoading(false);
    }
  };

  const handleMessageSent = (message: string, role: 'user' | 'assistant') => {
    const cid = conversationId;
    const token = guestTokenRef.current;
    if (!cid || !token) return;
    if (role === 'user') {
      lastGuestActivityRef.current = Date.now();
    }

    saveChainRef.current = saveChainRef.current
      .then(() =>
        fetch(`/api/conversations/${cid}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-guest-token': token,
          },
          body: JSON.stringify({ role, content: message }),
        }).then(async (res) => {
          if (!res.ok) {
            const errBody = await res.text();
            console.error('Save message failed:', res.status, errBody);
          }
        }),
      )
      .catch((e) => console.error('Failed to save message:', e));
  };

  const resolveCanRejoin = useCallback(async () => {
    if (!meetingSlug) return false;
    try {
      const res = await fetch(`/api/meetings/${encodeURIComponent(meetingSlug)}`);
      const data = await res.json();
      return Boolean(data.success && data.meeting?.isValid);
    } catch {
      return false;
    }
  }, [meetingSlug]);

  const handleEndCall = async () => {
    const durationMs = Math.max(0, Date.now() - sessionStartRef.current);
    const cid = conversationId;
    const token = guestTokenRef.current;

    // Do not block leaving on a stuck message save (chain never resolves).
    try {
      await Promise.race([
        saveChainRef.current.catch(() => {}),
        new Promise<void>((r) => {
          window.setTimeout(r, 5000);
        }),
      ]);
    } catch {
      /* ignore */
    }

    guestTokenRef.current = null;

    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setMicStatus('idle');
    setConversation(null);
    setConversationId('');

    let canRejoin = false;
    try {
      canRejoin = await resolveCanRejoin();
    } catch {
      canRejoin = false;
    }

    setLeftMeta({ durationMs, canRejoin });
    setPhase('left');

    // Server finalization can take a long time (poll for LiveKit transcript + OpenAI summary).
    // Tear down UI first; complete the conversation in the background.
    if (cid && token) {
      void fetch(`/api/conversations/${cid}/end`, {
        method: 'POST',
        headers: { 'x-guest-token': token },
      })
        .then(async (res) => {
          if (!res.ok) {
            const errBody = await res.text();
            console.error('End session failed:', res.status, errBody);
          }
        })
        .catch((e) => {
          console.error('End session:', e);
        });
    }
  };

  handleEndCallRef.current = handleEndCall;
  conversationIdRef.current = conversationId;

  useEffect(() => {
    if (phase === 'session' && conversationId) {
      lastGuestActivityRef.current = Date.now();
    }
  }, [phase, conversationId]);

  useEffect(() => {
    if (phase !== 'session' || !conversationId) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastGuestActivityRef.current >= guestIdleMs) {
        void handleEndCallRef.current();
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [phase, conversationId, guestIdleMs]);

  useEffect(() => {
    if (phase !== 'session') return;
    const flushEnd = () => {
      const cid = conversationIdRef.current;
      const tok = guestTokenRef.current;
      if (!cid || !tok) return;
      void fetch(`/api/conversations/${cid}/end`, {
        method: 'POST',
        headers: { 'x-guest-token': tok },
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('beforeunload', flushEnd);
    window.addEventListener('pagehide', flushEnd);
    return () => {
      window.removeEventListener('beforeunload', flushEnd);
      window.removeEventListener('pagehide', flushEnd);
    };
  }, [phase]);

  const handleRejoinFromLeft = () => {
    setLeftMeta(null);
    setGuestName('');
    void fetchMeetingMeta();
  };

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#202124] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-label="Loading meeting" />
      </div>
    );
  }

  if (phase === 'left' && leftMeta) {
    return (
      <MeetSessionLeftScreen
        durationMs={leftMeta.durationMs}
        canRejoin={leftMeta.canRejoin}
        onRejoin={handleRejoinFromLeft}
        homeHref="/"
      />
    );
  }

  if (phase === 'invalid' || (lobbyMeeting && !lobbyMeeting.isValid && phase !== 'session')) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#202124] px-6 text-white">
        <h1 className="mb-3 text-center text-2xl font-medium">You can&apos;t join this call</h1>
        <p className="max-w-md text-center text-[15px] leading-relaxed text-[#9AA0A6]">
          This link may have expired, reached its guest limit, or been turned off by the host. Ask for a new invite or
          check that you&apos;re using the correct URL.
        </p>
      </div>
    );
  }

  if (phase === 'lobby' && lobbyMeeting) {
    return (
      <MeetSessionLobby
        meetingTitle={lobbyMeeting.title}
        avatarId={lobbyMeeting.avatarId}
        avatarPreviewUrl={avatarPreviewUrl}
        avatarHostName={avatarHostName}
        guestName={guestName}
        onGuestNameChange={setGuestName}
        micStatus={micStatus}
        onRequestMic={() => void requestMicrophone()}
        joinError={joinError}
        joining={joining}
        onJoin={() => void startSession()}
        canJoin={lobbyMeeting.isValid}
        micStream={lobbyMicStream}
      />
    );
  }

  if (phase === 'session') {
    if (sessionLoading || !conversation) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#202124] text-white">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-label="Starting session" />
        </div>
      );
    }

    return (
      <MeetSessionLive
        conversation={conversation}
        guestName={guestName}
        guestToken={guestTokenRef.current ?? ''}
        micStream={micStreamRef.current}
        cameraStream={cameraStream}
        cameraOn={Boolean(cameraStream)}
        onToggleCamera={() => void toggleCamera()}
        onMessageSent={handleMessageSent}
        onEndCall={() => void handleEndCall()}
        onRecoveryTimeout={() => void handleEndCallRef.current()}
        onGuestActivity={() => {
          lastGuestActivityRef.current = Date.now();
        }}
      />
    );
  }

  return null;
}
