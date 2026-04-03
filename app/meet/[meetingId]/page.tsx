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

  const guestTokenRef = useRef<string | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
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

  const requestMicrophone = async () => {
    setMicStatus('pending');
    setJoinError(null);
    try {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicStatus('granted');
    } catch {
      setMicStatus('denied');
      setJoinError('Microphone access is required to join the voice session.');
    }
  };

  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

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
    let canRejoin = false;

    try {
      await saveChainRef.current;
    } catch {
      /* chained saves already log */
    }

    const cid = conversationId;
    const token = guestTokenRef.current;
    if (cid && token) {
      try {
        const res = await fetch(`/api/conversations/${cid}/end`, {
          method: 'POST',
          headers: { 'x-guest-token': token },
        });
        if (!res.ok) {
          const errBody = await res.text();
          console.error('End session failed:', res.status, errBody);
        }
      } catch (e) {
        console.error('End session:', e);
      }
    }
    guestTokenRef.current = null;
    setConversation(null);
    setConversationId('');
    canRejoin = await resolveCanRejoin();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setMicStatus('idle');
    setLeftMeta({ durationMs, canRejoin });
    setPhase('left');
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#202124] text-white px-6">
        <h1 className="text-2xl font-medium mb-2">You can&apos;t join this call</h1>
        <p className="text-gray-400 text-center max-w-md">
          This link may have expired, reached its session limit, or been deactivated by the host.
        </p>
      </div>
    );
  }

  if (phase === 'lobby' && lobbyMeeting) {
    return (
      <MeetSessionLobby
        meetingTitle={lobbyMeeting.title}
        avatarId={lobbyMeeting.avatarId}
        guestName={guestName}
        onGuestNameChange={setGuestName}
        micStatus={micStatus}
        onRequestMic={() => void requestMicrophone()}
        joinError={joinError}
        joining={joining}
        onJoin={() => void startSession()}
        canJoin={lobbyMeeting.isValid}
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
