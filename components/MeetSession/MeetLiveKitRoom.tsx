'use client';

import type { MutableRefObject, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';

import type { AvatarStreamLifecycleHandlers } from '@/components/logic';
import type { SessionConversation } from '@/components/meeting/sessionTypes';
import { MeetParticipantTile } from '@/components/MeetSession/MeetParticipantTile';

/** Shown while connecting and until the agent publishes video (can be 10–15+ seconds). */
const MEET_PREP_MESSAGES = [
  'Setting up your environment…',
  'Connecting to the session…',
  'Preparing your AI host…',
  'Almost there…',
] as const;

const AGENT_VIDEO_WAIT_MAX_MS = 60_000;
const PREP_MESSAGE_ROTATE_MS = 2800;

export type MeetMicControls = {
  muted: boolean;
  toggle: () => void;
  active: boolean;
};

function attachVideo(track: RemoteTrack, el: HTMLVideoElement | null) {
  if (!el) return;
  track.attach(el);
}

function attachAudio(track: RemoteTrack, el: HTMLAudioElement | null) {
  if (!el) return;
  track.attach(el);
  void el.play().catch(() => {});
}

function isLikelyAgentParticipant(p: RemoteParticipant): boolean {
  if (p.isAgent) return true;
  const id = (p.identity || '').toLowerCase();
  return id.includes('agent') || id.startsWith('lk-agent');
}

function RemoteGuestTile({
  participant,
  onVideoRef,
  onAudioRef,
}: {
  participant: RemoteParticipant;
  onVideoRef: (sid: string, el: HTMLVideoElement | null) => void;
  onAudioRef: (sid: string, el: HTMLAudioElement | null) => void;
}) {
  const vRef = useCallback(
    (el: HTMLVideoElement | null) => {
      onVideoRef(participant.sid, el);
    },
    [participant.sid, onVideoRef],
  );
  const aRef = useCallback(
    (el: HTMLAudioElement | null) => {
      onAudioRef(participant.sid, el);
    },
    [participant.sid, onAudioRef],
  );

  const displayName =
    (participant.name && participant.name.trim()) ||
    participant.identity.replace(/^guest-/, '') ||
    'Guest';

  const initial = displayName.charAt(0).toUpperCase() || '?';
  const cameraOn = participant.isCameraEnabled;

  return (
    <MeetParticipantTile name={displayName} className="h-full min-h-[200px] flex-col">
      <div className="relative h-full min-h-[200px] w-full bg-[#202124]">
        {cameraOn ? (
          <video
            ref={vRef}
            className="h-full w-full object-cover"
            playsInline
            autoPlay
            muted
          />
        ) : (
          <div className="flex h-full min-h-[200px] w-full flex-col items-center justify-center bg-[#3c4043]">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#5f6368] text-2xl font-medium text-white">
              {initial}
            </div>
          </div>
        )}
        <audio ref={aRef} className="hidden" autoPlay />
      </div>
    </MeetParticipantTile>
  );
}

export function MeetLiveKitRoom({
  conversation,
  guestToken,
  guestName,
  micStream,
  streamLifecycleRef,
  setMicControls,
  hostDisplayName = 'Host',
  children,
}: {
  conversation: SessionConversation;
  guestToken: string;
  guestName: string;
  micStream: MediaStream | null;
  streamLifecycleRef: MutableRefObject<AvatarStreamLifecycleHandlers>;
  setMicControls: (c: MeetMicControls) => void;
  /** Label on the AI host tile (Meet-style bottom-left). */
  hostDisplayName?: string;
  /** Local participant tile (you) — rendered as the last tile in the grid. */
  children?: ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const roomRef = useRef<Room | null>(null);
  const micStreamRef = useRef(micStream);
  micStreamRef.current = micStream;

  const guestVideoElsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const guestAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'connecting' | 'live' | 'failed'>('connecting');
  const [agentVideoReady, setAgentVideoReady] = useState(false);
  const [prepMessageIndex, setPrepMessageIndex] = useState(0);
  const [otherGuests, setOtherGuests] = useState<RemoteParticipant[]>([]);
  /** Bumped when remote guests publish/unpublish camera so tiles re-read `isCameraEnabled`. */
  const [, setGuestUiEpoch] = useState(0);
  const micMutedRef = useRef(false);

  const refreshOtherGuests = useCallback(() => {
    const r = roomRef.current;
    if (!r) return;
    setOtherGuests(
      Array.from(r.remoteParticipants.values()).filter((p) => !isLikelyAgentParticipant(p)),
    );
  }, []);

  const registerGuestVideo = useCallback((sid: string, el: HTMLVideoElement | null) => {
    const room = roomRef.current;
    if (el) {
      guestVideoElsRef.current.set(sid, el);
      if (!room) return;
      const p = Array.from(room.remoteParticipants.values()).find((x) => x.sid === sid);
      if (!p) return;
      Array.from(p.trackPublications.values()).forEach((pub) => {
        if (pub.track && pub.kind === Track.Kind.Video) {
          attachVideo(pub.track as RemoteTrack, el);
        }
      });
    } else {
      guestVideoElsRef.current.delete(sid);
    }
  }, []);

  const registerGuestAudio = useCallback((sid: string, el: HTMLAudioElement | null) => {
    const room = roomRef.current;
    if (el) {
      guestAudioElsRef.current.set(sid, el);
      if (!room) return;
      const p = Array.from(room.remoteParticipants.values()).find((x) => x.sid === sid);
      if (!p) return;
      Array.from(p.trackPublications.values()).forEach((pub) => {
        if (pub.track && pub.kind === Track.Kind.Audio) {
          attachAudio(pub.track as RemoteTrack, el);
        }
      });
    } else {
      guestAudioElsRef.current.delete(sid);
    }
  }, []);

  const showPrepOverlay =
    phase !== 'failed' && !error && (phase === 'connecting' || (phase === 'live' && !agentVideoReady));

  const pushMicControls = useCallback(
    (active: boolean) => {
      setMicControls({
        active,
        muted: micMutedRef.current,
        toggle: () => {
          micMutedRef.current = !micMutedRef.current;
          void roomRef.current?.localParticipant.setMicrophoneEnabled(
            !micMutedRef.current,
          );
          pushMicControls(active);
        },
      });
    },
    [setMicControls],
  );

  const markAgentVideoReady = useCallback(() => {
    setAgentVideoReady(true);
  }, []);

  const bindRemoteTrack = useCallback(
    (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (isLikelyAgentParticipant(participant)) {
        if (track.kind === Track.Kind.Video) {
          attachVideo(track, videoRef.current);
          const el = videoRef.current;
          if (el) {
            const onReady = () => markAgentVideoReady();
            if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              onReady();
            } else {
              el.addEventListener('loadeddata', onReady, { once: true });
            }
          }
        }
        if (track.kind === Track.Kind.Audio) {
          attachAudio(track, audioRef.current);
        }
        return;
      }

      if (track.kind === Track.Kind.Video) {
        const el = guestVideoElsRef.current.get(participant.sid);
        if (el) attachVideo(track, el);
      }
      if (track.kind === Track.Kind.Audio) {
        const el = guestAudioElsRef.current.get(participant.sid);
        if (el) attachAudio(track, el);
      }
    },
    [markAgentVideoReady],
  );

  const publishMic = useCallback(async (room: Room) => {
    const stream = micStreamRef.current;
    const t = stream?.getAudioTracks()[0];
    if (!t) return;
    const existing = Array.from(room.localParticipant.audioTrackPublications.values()).filter(
      (p) => p.source === Track.Source.Microphone,
    );
    for (const pub of existing) {
      if (pub.track) {
        await room.localParticipant.unpublishTrack(pub.track);
      }
    }
    const pub = await room.localParticipant.publishTrack(t, {
      source: Track.Source.Microphone,
    });
    if (micMutedRef.current) {
      await pub.mute();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAgentVideoReady(false);
    setPrepMessageIndex(0);
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    const onDisconnected = () => {
      streamLifecycleRef.current.onStreamDisconnected?.();
    };
    const onReconnected = () => {
      streamLifecycleRef.current.onStreamConnected?.();
    };

    const bumpGuestTiles = () => setGuestUiEpoch((e) => e + 1);

    const onTrackPublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      void publication;
      if (!isLikelyAgentParticipant(participant)) bumpGuestTiles();
    };
    const onTrackUnpublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      void publication;
      if (!isLikelyAgentParticipant(participant)) bumpGuestTiles();
    };

    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.TrackSubscribed, bindRemoteTrack);
    room.on(RoomEvent.TrackPublished, onTrackPublished);
    room.on(RoomEvent.TrackUnpublished, onTrackUnpublished);
    room.on(RoomEvent.ParticipantConnected, refreshOtherGuests);
    room.on(RoomEvent.ParticipantDisconnected, refreshOtherGuests);

    (async () => {
      try {
        const res = await fetch(`/api/conversations/${conversation.id}/livekit-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-guest-token': guestToken,
          },
          body: JSON.stringify({ guestName: guestName.trim() || 'Guest' }),
        });
        const data = (await res.json()) as {
          success?: boolean;
          message?: string;
          serverUrl?: string;
          token?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.success || !data.serverUrl || !data.token) {
          setError(data.message || 'Could not start LiveKit session');
          setPhase('failed');
          pushMicControls(false);
          return;
        }

        await room.connect(data.serverUrl, data.token);
        if (cancelled) {
          room.disconnect();
          return;
        }

        await publishMic(room);
        pushMicControls(true);
        streamLifecycleRef.current.onStreamConnected?.();

        for (const p of Array.from(room.remoteParticipants.values())) {
          if (!isLikelyAgentParticipant(p)) continue;
          for (const pub of Array.from(p.trackPublications.values())) {
            if (pub.track) {
              bindRemoteTrack(pub.track as RemoteTrack, pub, p);
            }
          }
        }

        setPhase('live');
        refreshOtherGuests();
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError(e instanceof Error ? e.message : 'LiveKit connection failed');
          setPhase('failed');
          pushMicControls(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.TrackSubscribed, bindRemoteTrack);
      room.off(RoomEvent.TrackPublished, onTrackPublished);
      room.off(RoomEvent.TrackUnpublished, onTrackUnpublished);
      room.off(RoomEvent.ParticipantConnected, refreshOtherGuests);
      room.off(RoomEvent.ParticipantDisconnected, refreshOtherGuests);
      room.disconnect();
      setOtherGuests([]);
      roomRef.current = null;
      guestVideoElsRef.current.clear();
      guestAudioElsRef.current.clear();
      pushMicControls(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
    };
  }, [
    conversation.id,
    guestToken,
    guestName,
    bindRemoteTrack,
    publishMic,
    streamLifecycleRef,
    pushMicControls,
    refreshOtherGuests,
  ]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    const hasAudio = Boolean(micStream?.getAudioTracks()[0]);
    if (!hasAudio) return;
    void publishMic(room);
  }, [micStream, publishMic]);

  useEffect(() => {
    if (!showPrepOverlay) return;
    const id = window.setInterval(() => {
      setPrepMessageIndex((i) => (i + 1) % MEET_PREP_MESSAGES.length);
    }, PREP_MESSAGE_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [showPrepOverlay]);

  useEffect(() => {
    if (!showPrepOverlay) return;
    const id = window.setTimeout(() => {
      setAgentVideoReady(true);
    }, AGENT_VIDEO_WAIT_MAX_MS);
    return () => window.clearTimeout(id);
  }, [showPrepOverlay]);

  if (error || phase === 'failed') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg font-medium text-white">Couldn&apos;t connect to this meeting</p>
        <p className="max-w-md text-sm leading-relaxed text-[#9AA0A6]">
          Something went wrong starting the video session. Check your internet connection and try joining again. If the
          problem continues, ask the host to verify the meeting is active.
        </p>
        <details className="max-w-md text-left text-xs text-[#9AA0A6]/80">
          <summary className="cursor-pointer select-none text-[#8AB4F8] hover:underline">Technical details</summary>
          <p className="mt-2 font-mono text-[11px] break-words text-[#9AA0A6]">{error}</p>
          <p className="mt-2">
            Hosts: ensure LiveKit env vars are set and the Liveavatar worker matches this project.
          </p>
        </details>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-black">
      <div className="mx-auto grid h-full min-h-0 w-full max-w-[1600px] content-start gap-3 overflow-y-auto p-3 [grid-auto-rows:minmax(200px,1fr)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <MeetParticipantTile name={hostDisplayName} className="h-full min-h-[200px] flex-col">
          <video
            ref={videoRef}
            className="h-full min-h-[200px] w-full object-contain"
            playsInline
            autoPlay
            muted={false}
          />
        </MeetParticipantTile>

        {[...otherGuests]
          .sort((a, b) => {
            const na = ((a.name && a.name.trim()) || a.identity || '').toLowerCase();
            const nb = ((b.name && b.name.trim()) || b.identity || '').toLowerCase();
            return na.localeCompare(nb);
          })
          .map((p) => (
            <RemoteGuestTile
              key={p.sid}
              participant={p}
              onVideoRef={registerGuestVideo}
              onAudioRef={registerGuestAudio}
            />
          ))}

        {children}
      </div>

      <audio ref={audioRef} className="hidden" autoPlay />

      {showPrepOverlay ? (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-[#0b0b0c]/92 px-8 text-center"
          aria-busy="true"
          aria-live="polite"
          aria-label="Session starting"
        >
          <Loader2 className="h-10 w-10 shrink-0 animate-spin text-white/85" aria-hidden />
          <p className="max-w-sm text-base font-medium leading-snug text-white">
            {MEET_PREP_MESSAGES[prepMessageIndex]}
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-[#9AA0A6]">
            Your AI host may take a few seconds to join. You can speak as soon as the call is live.
          </p>
        </div>
      ) : null}
    </div>
  );
}
