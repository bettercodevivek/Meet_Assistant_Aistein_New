import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Meeting from '@/lib/db/models/Meeting';
import KnowledgeBase from '@/lib/db/models/KnowledgeBase';
import User from '@/lib/db/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { parseLiveAvatarAvatarUuid } from '@/lib/livekit/liveAvatarAvatarId';
import { labelForLanguageCode } from '@/app/lib/constants';
import { publicAppOrigin, meetingShareUrl } from '@/lib/meetings/publicOrigin';
import { sendMeetingInviteEmail } from '@/lib/google/sendMeetingInviteEmail';

const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MEETING_STATUSES = ['waiting', 'active', 'completed'] as const;

function unauthorized() {
  return NextResponse.json(
    { success: false, message: 'Unauthorized' },
    { status: 401 },
  );
}

function serializeMeetingListItem(m: InstanceType<typeof Meeting>) {
  return {
    meetingId: m.meetingId,
    title: m.title,
    avatarId: m.avatarId,
    liveAvatarAvatarUuid: m.liveAvatarAvatarUuid,
    voiceId: m.voiceId,
    language: m.language,
    knowledgeBaseId: String(m.knowledgeBaseId),
    status: m.status,
    isReusable: m.isReusable,
    maxSessions: m.maxSessions,
    sessionCount: m.sessionCount,
    expiresAt: m.expiresAt,
    isActive: m.isActive,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

// GET list (paginated, optional status filter)
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limitRaw = parseInt(searchParams.get('limit') || '20', 10) || 20;
    const limit = Math.min(100, Math.max(1, limitRaw));
    const statusParam = searchParams.get('status');

    const filter: Record<string, unknown> = {
      createdBy: userOid,
    };
    if (
      statusParam &&
      MEETING_STATUSES.includes(statusParam as (typeof MEETING_STATUSES)[number])
    ) {
      filter.status = statusParam;
    }

    const skip = (page - 1) * limit;
    const [meetings, total] = await Promise.all([
      Meeting.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Meeting.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      meetings: meetings.map((m) => serializeMeetingListItem(m)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    });
  } catch (error) {
    console.error('List meetings error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorized();
    }
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}

// POST create meeting
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();

    const body = await request.json();
    const {
      title,
      avatarId,
      liveAvatarAvatarUuid,
      voiceId,
      language,
      knowledgeBaseId,
      isReusable,
      maxSessions,
      expiresAt,
      settings,
      inviteEmail,
    } = body;

    if (!title || !avatarId || !language || !knowledgeBaseId) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 },
      );
    }

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 },
      );
    }

    const kb = await KnowledgeBase.findOne({
      _id: knowledgeBaseId,
      userId: userOid,
    });

    if (!kb) {
      return NextResponse.json(
        { success: false, message: 'Knowledge base not found or access denied' },
        { status: 403 },
      );
    }

    let expires: Date | undefined;
    if (expiresAt != null && expiresAt !== '') {
      expires = new Date(expiresAt);
      if (Number.isNaN(expires.getTime())) {
        return NextResponse.json(
          { success: false, message: 'Invalid expiresAt' },
          { status: 400 },
        );
      }
    }

    if (maxSessions != null && (typeof maxSessions !== 'number' || maxSessions < 1)) {
      return NextResponse.json(
        { success: false, message: 'maxSessions must be a positive number' },
        { status: 400 },
      );
    }

    let liveUuid: string | undefined;
    if (typeof liveAvatarAvatarUuid === 'string' && liveAvatarAvatarUuid.trim()) {
      const parsed = parseLiveAvatarAvatarUuid(liveAvatarAvatarUuid.trim());
      if (!parsed) {
        return NextResponse.json(
          { success: false, message: 'liveAvatarAvatarUuid must be a valid UUID' },
          { status: 400 },
        );
      }
      liveUuid = parsed;
    } else {
      const fromAvatar = parseLiveAvatarAvatarUuid(String(avatarId).trim());
      if (fromAvatar) liveUuid = fromAvatar;
    }

    const meeting = await Meeting.create({
      createdBy: userOid,
      title,
      avatarId,
      ...(liveUuid ? { liveAvatarAvatarUuid: liveUuid } : {}),
      voiceId,
      language,
      knowledgeBaseId,
      isReusable: Boolean(isReusable),
      maxSessions: maxSessions != null ? maxSessions : undefined,
      expiresAt: expires,
      settings:
        settings && typeof settings === 'object' && !Array.isArray(settings)
          ? settings
          : {},
    });

    const origin = publicAppOrigin(request);
    const shareUrl = meetingShareUrl(origin, meeting.meetingId);

    let invite:
      | { sent: true; to: string }
      | { sent: false; to?: string; reason?: string; message?: string }
      | undefined;

    const inviteTo =
      typeof inviteEmail === 'string' ? inviteEmail.trim() : '';
    if (inviteTo) {
      if (!EMAIL_RE.test(inviteTo)) {
        invite = { sent: false, reason: 'invalid_email' };
      } else {
        const organizer = await User.findById(userOid).select('username');
        const organizerName = organizer?.username?.trim() || 'Host';
        const sendResult = await sendMeetingInviteEmail(
          request,
          userOid.toString(),
          {
            to: inviteTo,
            meetingTitle: title,
            joinUrl: shareUrl,
            organizerName,
            assistantLanguageLabel:
              typeof language === 'string' && language.trim()
                ? labelForLanguageCode(language)
                : undefined,
          },
        );
        if (sendResult.ok) {
          invite = { sent: true, to: inviteTo };
        } else {
          invite = {
            sent: false,
            to: inviteTo,
            reason: sendResult.code,
            message: sendResult.message,
          };
        }
      }
    }

    return NextResponse.json({
      success: true,
      meetingId: meeting.meetingId,
      shareUrl,
      invite,
      meeting: {
        meetingId: meeting.meetingId,
        shareUrl,
        title: meeting.title,
        avatarId: meeting.avatarId,
        liveAvatarAvatarUuid: meeting.liveAvatarAvatarUuid,
        voiceId: meeting.voiceId,
        language: meeting.language,
        knowledgeBaseId: String(meeting.knowledgeBaseId),
        status: meeting.status,
        isReusable: meeting.isReusable,
        maxSessions: meeting.maxSessions,
        sessionCount: meeting.sessionCount,
        expiresAt: meeting.expiresAt,
        settings: meeting.settings,
        isActive: meeting.isActive,
        createdAt: meeting.createdAt,
        updatedAt: meeting.updatedAt,
      },
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorized();
    }
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}
