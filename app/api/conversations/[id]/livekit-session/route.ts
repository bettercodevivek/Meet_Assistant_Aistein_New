import { NextRequest, NextResponse } from 'next/server';

import { findConversationWithAccess } from '@/lib/conversations/accessConversation';
import connectDB from '@/lib/db/mongodb';
import { createMeetLiveKitSession } from '@/lib/livekit/createMeetLiveKitSession';
import { isLiveKitMeetEnabled } from '@/lib/livekit/config';

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
    const session = await createMeetLiveKitSession({
      conversationId: id,
      guestName: guestName || 'Guest',
      avatarId: conv.avatarId,
      voiceId: conv.voiceId,
      language: conv.language,
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
