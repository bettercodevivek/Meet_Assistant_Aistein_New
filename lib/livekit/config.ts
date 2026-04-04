import { parseLiveAvatarAvatarUuid } from '@/lib/livekit/liveAvatarAvatarId';

/**
 * LiveKit server (HTTPS) URL for RoomService / AgentDispatch APIs.
 * LIVEKIT_URL is typically wss://… for workers; we normalize to https://…
 */
export function livekitHttpUrl(): string | null {
  const raw = process.env.LIVEKIT_URL?.trim();
  if (!raw) return null;
  return raw
    .replace(/^wss:\/\//i, 'https://')
    .replace(/^ws:\/\//i, 'http://')
    .replace(/\/$/, '');
}

/** WebSocket URL for browser clients (wss:// or ws://). */
export function livekitWsUrl(): string | null {
  const raw = process.env.LIVEKIT_URL?.trim();
  if (!raw) return null;
  if (/^wss?:\/\//i.test(raw)) {
    return raw.replace(/\/$/, '');
  }
  return null;
}

export function livekitCredentials(): { apiKey: string; apiSecret: string } | null {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

export function isLiveKitMeetEnabled(): boolean {
  return Boolean(livekitHttpUrl() && livekitWsUrl() && livekitCredentials());
}

/** Must match @server.rtc_session(agent_name=…) in Liveavatar/src/agent.py */
export const PLATFORM_LIVEKIT_AGENT_NAME = 'liveavatar-agent';

export function meetRoomNameForConversation(conversationId: string): string {
  return `meet-${conversationId}`;
}

/** Server-only fallback when meeting avatar is a HeyGen id without a stored LiveAvatar UUID. */
export function livekitFallbackAvatarUuid(): string | null {
  const raw =
    process.env.LIVEKIT_FALLBACK_AVATAR_UUID?.trim() ||
    process.env.LIVEAVATAR_AVATAR_ID?.trim() ||
    '';
  return parseLiveAvatarAvatarUuid(raw || null);
}
