import { NextRequest, NextResponse } from 'next/server';

import { findConversationWithAccess } from '@/lib/conversations/accessConversation';
import connectDB from '@/lib/db/mongodb';
import Meeting from '@/lib/db/models/Meeting';
import { createMeetLiveKitSession } from '@/lib/livekit/createMeetLiveKitSession';
import { isLiveKitMeetEnabled, livekitFallbackAvatarUuid } from '@/lib/livekit/config';
import { parseLiveAvatarAvatarUuid } from '@/lib/livekit/liveAvatarAvatarId';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isLiveKitMeetEnabled()) {
      return NextResponse.json(
        {
          success: false,
          message:
            'LiveKit is not configured on the server (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET).',
        },
        { status: 503 },
      );
    }

    await connectDB();
    const { id } = await params;

    const access = await findConversationWithAccess(request, id);
    if (!access) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      );
    }

    let guestName = '';
    try {
      const body = await request.json();
      if (typeof body?.guestName === 'string') {
        guestName = body.guestName.trim();
      }
    } catch {
      /* no body */
    }

    if (!guestName && access.conversation.guestName) {
      guestName = access.conversation.guestName.trim();
    }

    const conv = access.conversation;

    let knowledgeBasePrompt = '';
    const kbDoc = conv.knowledgeBaseId as unknown;
    if (
      kbDoc &&
      typeof kbDoc === 'object' &&
      'prompt' in kbDoc &&
      typeof (kbDoc as { prompt?: string }).prompt === 'string'
    ) {
      knowledgeBasePrompt = (kbDoc as { prompt: string }).prompt;
    }

    let resolvedLiveAvatarUuid =
      parseLiveAvatarAvatarUuid(conv.avatarId || null) || null;
    const mid = conv.meetingId;
    if (!resolvedLiveAvatarUuid && mid) {
      const meetingId =
        typeof mid === 'object' && mid !== null && '_id' in mid
          ? String((mid as { _id: { toString(): string } })._id)
          : String(mid);
      const meeting = await Meeting.findById(meetingId).select('liveAvatarAvatarUuid');
      if (meeting?.liveAvatarAvatarUuid) {
        resolvedLiveAvatarUuid =
          parseLiveAvatarAvatarUuid(meeting.liveAvatarAvatarUuid) || resolvedLiveAvatarUuid;
      }
    }
    if (!resolvedLiveAvatarUuid) {
      resolvedLiveAvatarUuid = livekitFallbackAvatarUuid();
    }

    const session = await createMeetLiveKitSession({
      conversationId: id,
      guestName: guestName || 'Guest',
      avatarId: conv.avatarId,
      liveAvatarAvatarUuid: resolvedLiveAvatarUuid,
      voiceId: conv.voiceId,
      language: conv.language,
      knowledgeBasePrompt: knowledgeBasePrompt || null,
    });

    console.info('[MeetAssistant][LiveKit] livekit-session OK', {
      conversationId: id,
      roomName: session.roomName,
      serverUrl: session.serverUrl,
    });

    return NextResponse.json({
      success: true,
      serverUrl: session.serverUrl,
      roomName: session.roomName,
      token: session.token,
    });
  } catch (error) {
    console.error('livekit-session error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to start LiveKit session';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
