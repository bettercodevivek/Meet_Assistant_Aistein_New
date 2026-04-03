import { RoomAgentDispatch } from '@livekit/protocol';
import {
  AccessToken,
  AgentDispatchClient,
  RoomServiceClient,
} from 'livekit-server-sdk';

import {
  livekitCredentials,
  livekitHttpUrl,
  livekitWsUrl,
  meetRoomNameForConversation,
  PLATFORM_LIVEKIT_AGENT_NAME,
} from '@/lib/livekit/config';
import { parseLiveAvatarAvatarUuid } from '@/lib/livekit/liveAvatarAvatarId';

export type MeetLiveKitSessionResult = {
  serverUrl: string;
  roomName: string;
  token: string;
};

/**
 * Ensures a room exists, dispatches the Python LiveKit agent with conversation metadata,
 * and mints a guest access token for the browser.
 *
 * Avatar / voice / language are included in dispatch metadata so the agent uses the same
 * values as the Next.js conversation even if MongoDB URI database names differ.
 */
export async function createMeetLiveKitSession(options: {
  conversationId: string;
  guestName: string;
  avatarId?: string;
  voiceId?: string | null;
  language?: string | null;
}): Promise<MeetLiveKitSessionResult> {
  const httpUrl = livekitHttpUrl();
  const wsUrl = livekitWsUrl();
  const creds = livekitCredentials();

  if (!httpUrl || !wsUrl || !creds) {
    throw new Error(
      'LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.',
    );
  }

  const { conversationId, guestName, avatarId, voiceId, language } = options;
  const roomName = meetRoomNameForConversation(conversationId);

  const metaPayload: Record<string, string> = { conversationId };
  const aidRaw = avatarId?.trim();
  const aid = parseLiveAvatarAvatarUuid(aidRaw ?? null);
  if (aid) {
    metaPayload.avatarId = aid;
  } else if (aidRaw) {
    console.warn(
      '[MeetAssistant][LiveKit] Omitting avatarId from agent dispatch (not a LiveAvatar UUID):',
      aidRaw.slice(0, 80),
    );
  }
  const vid = voiceId?.trim();
  if (vid) metaPayload.voiceId = vid;
  const lang = language?.trim();
  if (lang) metaPayload.language = lang;
  const metadata = JSON.stringify(metaPayload);

  const roomService = new RoomServiceClient(httpUrl, creds.apiKey, creds.apiSecret);
  const dispatchClient = new AgentDispatchClient(httpUrl, creds.apiKey, creds.apiSecret);

  let roomCreated = false;
  let agentDispatchOutcome: 'room_created' | 'dispatch_existed' | 'dispatch_created' = 'dispatch_existed';

  try {
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 600,
      maxParticipants: 12,
      agents: [
        new RoomAgentDispatch({
          agentName: PLATFORM_LIVEKIT_AGENT_NAME,
          metadata,
        }),
      ],
    });
    roomCreated = true;
    agentDispatchOutcome = 'room_created';
  } catch {
    // Room may already exist (rejoin / same conversation).
    const existing = await roomService.listRooms([roomName]);
    if (existing.length === 0) {
      throw new Error('Could not create or find LiveKit room for this meeting.');
    }
  }

  if (!roomCreated) {
    const dispatches = await dispatchClient.listDispatch(roomName);
    const hasAgent = dispatches.some((d) => d.agentName === PLATFORM_LIVEKIT_AGENT_NAME);
    if (!hasAgent) {
      await dispatchClient.createDispatch(roomName, PLATFORM_LIVEKIT_AGENT_NAME, {
        metadata,
      });
      agentDispatchOutcome = 'dispatch_created';
    }
  }

  console.info('[MeetAssistant][LiveKit] agent dispatch payload', {
    roomName,
    agentName: PLATFORM_LIVEKIT_AGENT_NAME,
    agentDispatchMetadata: metadata,
    conversationId,
    avatarId: aid ?? null,
    avatarIdOmittedNonUuid: aidRaw && !aid ? aidRaw.slice(0, 80) : null,
    guestDisplayName: guestName.trim() || 'Guest',
    guestIdentity: `guest-${conversationId}`,
    agentDispatchOutcome,
  });

  const at = new AccessToken(creds.apiKey, creds.apiSecret, {
    identity: `guest-${conversationId}`,
    name: guestName.trim() || 'Guest',
    ttl: '2h',
  });
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  const token = await at.toJwt();

  return {
    serverUrl: wsUrl,
    roomName,
    token,
  };
}
