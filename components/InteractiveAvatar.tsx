import {
  StreamingEvents,
  VoiceChatTransport,
  VoiceEmotion,
  StartAvatarRequest,
  STTProvider,
  ElevenLabsModel,
} from "@heygen/streaming-avatar";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";

import { Button } from "./Button";
import { AvatarConfig } from "./AvatarConfig";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { AvatarControls } from "./AvatarSession/AvatarControls";
import { useVoiceChat } from "./logic/useVoiceChat";
import { StreamingAvatarProvider, StreamingAvatarSessionState } from "./logic";
import { LoadingIcon } from "./Icons";
import { MessageHistory } from "./AvatarSession/MessageHistory";

import { AVATARS } from "@/app/lib/constants";
import { DEFAULT_STREAMING_AVATAR_QUALITY } from "@/app/lib/streamingDefaults";
import type { SessionConversation } from "@/components/meeting/sessionTypes";

export type { SessionConversation } from "@/components/meeting/sessionTypes";

const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: DEFAULT_STREAMING_AVATAR_QUALITY,
  avatarName: AVATARS[0].avatar_id,
  knowledgeId: undefined,
  voice: {
    rate: 1.5,
    emotion: VoiceEmotion.EXCITED,
    model: ElevenLabsModel.eleven_flash_v2_5,
  },
  language: "en",
  voiceChatTransport: VoiceChatTransport.LIVEKIT,
  sttSettings: {
    provider: STTProvider.DEEPGRAM,
  },
};

function InteractiveAvatar() {
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream } =
    useStreamingAvatarSession();
  const { startVoiceChat } = useVoiceChat();

  const [config, setConfig] = useState<StartAvatarRequest>(DEFAULT_CONFIG);

  const mediaStream = useRef<HTMLVideoElement>(null);

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();
      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
      throw error;
    }
  }

  const startSessionV2 = useMemoizedFn(async (isVoiceChat: boolean) => {
    try {
      const newToken = await fetchAccessToken();
      initAvatar(newToken);

      await startAvatar(config);

      if (isVoiceChat) {
        await startVoiceChat();
      }
    } catch (error) {
      console.error("Error starting avatar session:", error);
    }
  });

  useUnmount(() => {
    stopAvatar();
  });

  useEffect(() => {
    const el = mediaStream.current;
    if (!el) return;

    if (!stream) {
      el.srcObject = null;
      return;
    }

    el.srcObject = stream;
    el.muted = false;
    const play = () => {
      void el.play().catch((err) => {
        console.warn(
          "[Avatar video] play() failed (may need user gesture):",
          err,
        );
      });
    };
    el.onloadedmetadata = play;
    play();

    return () => {
      el.onloadedmetadata = null;
    };
  }, [stream]);

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col rounded-xl bg-zinc-900 overflow-hidden">
        <div className="relative w-full aspect-video overflow-hidden flex flex-col items-center justify-center">
          {sessionState !== StreamingAvatarSessionState.INACTIVE ? (
            <AvatarVideo ref={mediaStream} />
          ) : (
            <AvatarConfig config={config} onConfigChange={setConfig} />
          )}
        </div>
        <div className="flex flex-col gap-3 items-center justify-center p-4 border-t border-zinc-700 w-full">
          {sessionState === StreamingAvatarSessionState.CONNECTED ? (
            <AvatarControls />
          ) : sessionState === StreamingAvatarSessionState.INACTIVE ? (
            <div className="flex flex-row gap-4">
              <Button onClick={() => startSessionV2(true)}>
                Start Voice Chat
              </Button>
              <Button onClick={() => startSessionV2(false)}>
                Start Text Chat
              </Button>
            </div>
          ) : (
            <LoadingIcon />
          )}
        </div>
      </div>
      {sessionState === StreamingAvatarSessionState.CONNECTED && (
        <MessageHistory />
      )}
    </div>
  );
}

export type LiveTranscriptPayload = {
  role: "user" | "assistant";
  /** Full interim text so far, or final utterance when interim is false */
  text: string;
  /** True while STT / TTS chunks are streaming; false when utterance ended */
  interim: boolean;
};

/** Conversation-driven streaming avatar (dashboard split view or Meet-style stage). */
export function MeetConversationAvatar({
  conversation,
  onMessageReceived,
  onUserMessage,
  variant = "dashboard",
  onLiveTranscript,
  meetFooterOverlay,
  onGuestVoiceActivity,
}: {
  conversation: SessionConversation;
  onMessageReceived: (message: string) => void;
  onUserMessage: (message: string) => void;
  variant?: "dashboard" | "meet";
  /** Fired from HeyGen user/avatar streaming events for live captions and sidebar drafts */
  onLiveTranscript?: (payload: LiveTranscriptPayload) => void;
  /** Rendered inside the meet video frame at the bottom (e.g. live captions) */
  meetFooterOverlay?: ReactNode;
  /** Guest spoke (STT) — for idle-timeout / activity tracking */
  onGuestVoiceActivity?: () => void;
}) {
  const {
    initAvatar,
    startAvatar,
    stopAvatar,
    sessionState,
    stream,
    interruptModeReady,
  } = useStreamingAvatarSession();
  const { startVoiceChat } = useVoiceChat();

  const mediaStream = useRef<HTMLVideoElement>(null);
  const userCameraRef = useRef<HTMLVideoElement>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const currentUserMessage = useRef("");
  const currentAvatarMessage = useRef("");

  const [startError, setStartError] = useState<string | null>(null);

  const fetchAccessToken = useMemoizedFn(async () => {
    const response = await fetch("/api/get-access-token", { method: "POST" });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        text?.trim() ||
          `Streaming token failed (${response.status}). Is HEYGEN_API_KEY set?`,
      );
    }
    const token = text?.trim();
    if (!token) {
      throw new Error(
        "Empty token from server — set HEYGEN_API_KEY and NEXT_PUBLIC_BASE_API_URL (HeyGen API base).",
      );
    }
    return token;
  });

  const startSession = useMemoizedFn(async () => {
    try {
      setStartError(null);
      setIsInitializing(true);
      const newToken = await fetchAccessToken();
      const avatar = initAvatar(newToken);

      const emitLive = (payload: LiveTranscriptPayload) => {
        onLiveTranscript?.(payload);
      };

      avatar.on(StreamingEvents.USER_START, () => {
        currentUserMessage.current = "";
        emitLive({ role: "user", text: "", interim: true });
        onGuestVoiceActivity?.();
      });
      avatar.on(
        StreamingEvents.USER_TALKING_MESSAGE,
        (event: { detail?: { message?: string } }) => {
          if (event.detail?.message) {
            currentUserMessage.current += event.detail.message;
            emitLive({
              role: "user",
              text: currentUserMessage.current,
              interim: true,
            });
            onGuestVoiceActivity?.();
          }
        },
      );
      avatar.on(StreamingEvents.USER_END_MESSAGE, () => {
        const text = currentUserMessage.current;
        if (text) {
          emitLive({ role: "user", text, interim: false });
          onUserMessage(text);
          onGuestVoiceActivity?.();
        } else {
          emitLive({ role: "user", text: "", interim: false });
        }
        currentUserMessage.current = "";
      });

      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
        currentAvatarMessage.current = "";
        emitLive({ role: "assistant", text: "", interim: true });
      });
      avatar.on(
        StreamingEvents.AVATAR_TALKING_MESSAGE,
        (event: { detail?: { message?: string } }) => {
          if (event.detail?.message) {
            currentAvatarMessage.current += event.detail.message;
            emitLive({
              role: "assistant",
              text: currentAvatarMessage.current,
              interim: true,
            });
          }
        },
      );
      avatar.on(StreamingEvents.AVATAR_END_MESSAGE, () => {
        const text = currentAvatarMessage.current;
        if (text) {
          emitLive({ role: "assistant", text, interim: false });
          onMessageReceived(text);
        } else {
          emitLive({ role: "assistant", text: "", interim: false });
        }
        currentAvatarMessage.current = "";
      });

      const config: StartAvatarRequest = {
        quality: DEFAULT_STREAMING_AVATAR_QUALITY,
        avatarName: conversation.avatarId,
        knowledgeId: conversation.sessionContext
          ? undefined
          : conversation.knowledgeBase.id,
        knowledgeBase:
          conversation.sessionContext || conversation.knowledgeBase.prompt,
        voice: {
          rate: 1.5,
          emotion: VoiceEmotion.EXCITED,
          model: ElevenLabsModel.eleven_flash_v2_5,
        },
        language: conversation.language || "en",
        voiceChatTransport: VoiceChatTransport.LIVEKIT,
        sttSettings: { provider: STTProvider.DEEPGRAM },
      };

      console.info(
        "[MeetAssistant] streaming avatar loading (HeyGen startAvatar)",
        {
          avatarId: conversation.avatarId,
          context:
            variant === "meet" ? "guest_joined_meet" : "dashboard_session",
          conversationId: conversation.id,
          title: conversation.title,
        },
      );

      await startAvatar(config);
      await startVoiceChat(false);
      setIsInitializing(false);
    } catch (error) {
      console.error("Error starting avatar session:", error);
      setIsInitializing(false);
      const msg =
        error instanceof Error
          ? error.message
          : "Could not start avatar session.";
      setStartError(msg);
    }
  });

  const retrySession = useMemoizedFn(async () => {
    setStartError(null);
    await stopAvatar().catch(() => {});
  });

  useEffect(() => {
    if (sessionState === StreamingAvatarSessionState.CONNECTED) {
      setStartError(null);
    }
  }, [sessionState]);

  useEffect(() => {
    if (variant !== "meet" || startError) return;
    if (sessionState !== StreamingAvatarSessionState.CONNECTING) return;
    const ms = 90_000;
    const t = window.setTimeout(() => {
      setStartError(
        "Still connecting after 90s. Confirm HEYGEN_API_KEY, NEXT_PUBLIC_BASE_API_URL, and that this avatar ID exists in HeyGen. Then tap Retry.",
      );
    }, ms);
    return () => window.clearTimeout(t);
  }, [variant, sessionState, startError]);

  useEffect(() => {
    if (!interruptModeReady) return;
    if (sessionState === StreamingAvatarSessionState.INACTIVE) {
      startSession();
    }
  }, [sessionState, startSession, interruptModeReady]);

  useEffect(() => {
    if (variant !== "dashboard") return;
    const startUserCamera = async () => {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        const videoElement = userCameraRef.current;
        if (videoElement) {
          videoElement.srcObject = cam;
        }
      } catch (error) {
        console.error("Failed to enable user camera:", error);
      }
    };
    if (sessionState === StreamingAvatarSessionState.CONNECTED) {
      startUserCamera();
    }
    return () => {
      const videoElement = userCameraRef.current;
      if (videoElement?.srcObject) {
        (videoElement.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }
    };
  }, [sessionState, variant]);

  useUnmount(() => {
    if (sessionState === StreamingAvatarSessionState.CONNECTED) {
      stopAvatar().catch(() => {});
    }
  });

  useEffect(() => {
    const el = mediaStream.current;
    if (!el) return;
    if (!stream) {
      el.srcObject = null;
      el.onloadedmetadata = null;
      setAudioEnabled(false);
      return;
    }
    stream.getAudioTracks().forEach((t) => {
      t.enabled = true;
    });
    el.srcObject = stream;
    el.muted = false;
    el.volume = 1;
    const tryPlay = () => {
      void el
        .play()
        .then(() => setAudioEnabled(true))
        .catch(() => setAudioEnabled(false));
    };
    el.onloadedmetadata = tryPlay;
    tryPlay();
    return () => {
      el.onloadedmetadata = null;
    };
  }, [stream]);

  const enableAudio = () => {
    const el = mediaStream.current;
    if (!el) return;
    el.muted = false;
    el.volume = 1;
    void el.play().then(() => setAudioEnabled(true));
  };

  const isMeet = variant === "meet";
  const outerClass = isMeet
    ? "w-full h-full min-h-0 flex items-center justify-center p-3 sm:p-6"
    : "w-full h-full flex flex-col bg-gradient-to-br from-gray-900 to-gray-800";
  const videoWrap = isMeet
    ? "relative h-[80vh] max-h-[80vh] w-full max-w-[960px] overflow-hidden rounded-2xl bg-black shadow-lg"
    : "relative w-full h-full";

  return (
    <div className={outerClass}>
      <div
        className={
          isMeet
            ? "relative w-full h-full flex items-center justify-center"
            : "flex-1 relative min-h-0"
        }
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {startError ? (
            <div
              className={`text-center px-6 max-w-md ${isMeet ? "" : "bg-gray-800/90 rounded-2xl p-8 border border-gray-600"}`}
            >
              <p
                className={`text-sm mb-4 leading-relaxed ${isMeet ? "text-red-300" : "text-red-200"}`}
              >
                {startError}
              </p>
              <button
                type="button"
                onClick={() => void retrySession()}
                className="px-6 py-3 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-100"
              >
                Retry connection
              </button>
              <p
                className={`text-xs mt-4 ${isMeet ? "text-gray-500" : "text-gray-400"}`}
              >
                Tip: open the browser devtools Console for detailed errors.
              </p>
            </div>
          ) : sessionState === StreamingAvatarSessionState.CONNECTED ? (
            <div className={videoWrap}>
              <AvatarVideo
                ref={mediaStream}
                objectFit="contain"
              />
              {variant === "dashboard" && (
                <div className="absolute bottom-6 right-6 w-48 h-36 bg-gray-900 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700">
                  <video
                    ref={userCameraRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 rounded text-xs text-white font-medium">
                    You
                  </div>
                </div>
              )}
              {!audioEnabled && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/50 rounded-2xl">
                  <button
                    type="button"
                    onClick={enableAudio}
                    className="px-8 py-4 bg-[#1a73e8] text-white font-semibold rounded-full hover:bg-[#1967d2] shadow-xl"
                  >
                    Enable audio
                  </button>
                  <p className="text-white/90 text-sm mt-3 px-4 text-center">
                    Tap to hear the host
                  </p>
                </div>
              )}
              {variant === "meet" && meetFooterOverlay ? (
                <div className="absolute bottom-0 left-0 right-0 z-[25] pointer-events-none flex justify-center px-3 pb-3 pt-12 bg-gradient-to-t from-black/85 via-black/40 to-transparent rounded-b-2xl">
                  {meetFooterOverlay}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="px-6 text-center text-white">
              {isMeet ? (
                <>
                  <div className="mb-6 flex justify-center">
                    <div
                      className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 animate-pulse"
                      aria-hidden
                    />
                  </div>
                  <p className="mb-1 text-lg font-medium">
                    {conversation.avatarId}
                  </p>
                  <p className="text-sm text-[#9AA0A6]">
                    {isInitializing ? "Preparing your session…" : "Connecting…"}
                  </p>
                </>
              ) : (
                <>
                  <div className="mb-6 flex justify-center">
                    <div className="h-20 w-20">
                      <LoadingIcon />
                    </div>
                  </div>
                  <p className="mb-1 text-lg font-medium">
                    {conversation.avatarId}
                  </p>
                  <p className="text-sm text-gray-400">
                    {isInitializing ? "Preparing your session…" : "Connecting…"}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {sessionState === StreamingAvatarSessionState.CONNECTED &&
          variant === "dashboard" && (
            <div className="absolute bottom-4 left-0 right-0 px-6">
              <div className="flex items-center justify-center gap-3">
                <div
                  className={`px-4 py-2 rounded-lg text-sm font-medium shadow-lg ${
                    audioEnabled
                      ? "bg-green-600 text-white"
                      : "bg-red-600 text-white"
                  }`}
                >
                  {audioEnabled ? "Audio on" : "Audio blocked"}
                </div>
                <AvatarControls />
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

export default function InteractiveAvatarWrapper() {
  return (
    <StreamingAvatarProvider basePath={process.env.NEXT_PUBLIC_BASE_API_URL}>
      <InteractiveAvatar />
    </StreamingAvatarProvider>
  );
}
