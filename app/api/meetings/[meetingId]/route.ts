import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import Meeting from '@/lib/db/models/Meeting';
import KnowledgeBase from '@/lib/db/models/KnowledgeBase';
import { getAuthUser } from '@/lib/auth/middleware';
import { isMeetingValidForJoin } from '@/lib/meetings/isMeetingValid';
import { publicAppOrigin, meetingShareUrl } from '@/lib/meetings/publicOrigin';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { parseLiveAvatarAvatarUuid } from '@/lib/livekit/liveAvatarAvatarId';

function unauthorized() {
  return NextResponse.json(
    { success: false, message: 'Unauthorized' },
    { status: 401 },
  );
}

function isOwner(
  meeting: { createdBy: { toString(): string } },
  userId: string,
) {
  return String(meeting.createdBy) === userId;
}

// GET — public subset for guests; full details for owner
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    await connectDB();
    const { meetingId: meetingSlug } = await params;

    const meeting = await Meeting.findOne({ meetingId: meetingSlug }).populate(
      'knowledgeBaseId',
      'name',
    );
    if (!meeting) {
      return NextResponse.json(
        { success: false, message: 'Meeting not found' },
        { status: 404 },
      );
    }

    const auth = getAuthUser(request);
    const owner = auth && isOwner(meeting, auth.userId);
    const isValid = isMeetingValidForJoin({
      isActive: meeting.isActive,
      status: meeting.status,
      expiresAt: meeting.expiresAt,
      maxSessions: meeting.maxSessions,
      sessionCount: meeting.sessionCount,
    });

    if (!owner) {
      return NextResponse.json({
        success: true,
        meeting: {
          title: meeting.title,
          avatarId: meeting.avatarId,
          liveAvatarAvatarUuid: meeting.liveAvatarAvatarUuid,
          status: meeting.status,
          isValid,
        },
      });
    }

    const origin = publicAppOrigin(request);
    const shareUrl = meetingShareUrl(origin, meeting.meetingId);
    const kb = meeting.knowledgeBaseId as unknown as { _id: unknown; name?: string } | null;

    return NextResponse.json({
      success: true,
      meeting: {
        meetingId: meeting.meetingId,
        shareUrl,
        title: meeting.title,
        avatarId: meeting.avatarId,
        liveAvatarAvatarUuid: meeting.liveAvatarAvatarUuid,
        voiceId: meeting.voiceId,
        language: meeting.language,
        knowledgeBaseId: kb && typeof kb === 'object' && '_id' in kb ? String(kb._id) : String(meeting.knowledgeBaseId),
        knowledgeBaseName: kb && typeof kb === 'object' && 'name' in kb && kb.name ? kb.name : '',
        status: meeting.status,
        isReusable: meeting.isReusable,
        maxSessions: meeting.maxSessions,
        sessionCount: meeting.sessionCount,
        expiresAt: meeting.expiresAt,
        settings: meeting.settings,
        isActive: meeting.isActive,
        createdAt: meeting.createdAt,
        updatedAt: meeting.updatedAt,
        isValid,
      },
    });
  } catch (error) {
    console.error('Get meeting error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}

// PATCH — update meeting (owner only): settings merge and/or core fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return unauthorized();
    }

    await connectDB();
    const { meetingId: meetingSlug } = await params;
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, message: 'Invalid body' },
        { status: 400 },
      );
    }

    const meeting = await Meeting.findOne({ meetingId: meetingSlug });
    if (!meeting) {
      return NextResponse.json(
        { success: false, message: 'Meeting not found' },
        { status: 404 },
      );
    }

    if (!isOwner(meeting, auth.userId)) {
      return NextResponse.json(
        { success: false, message: 'Forbidden' },
        { status: 403 },
      );
    }

    const hasCore =
      'title' in body ||
      'avatarId' in body ||
      'voiceId' in body ||
      'language' in body ||
      'knowledgeBaseId' in body ||
      'liveAvatarAvatarUuid' in body ||
      'maxSessions' in body ||
      'expiresAt' in body ||
      'isReusable' in body ||
      'isActive' in body;
    const hasSettings =
      'settings' in body &&
      body.settings !== null &&
      typeof body.settings === 'object' &&
      !Array.isArray(body.settings);

    if (!hasCore && !hasSettings) {
      return NextResponse.json(
        { success: false, message: 'Provide settings and/or fields to update' },
        { status: 400 },
      );
    }

    if ('title' in body && typeof body.title === 'string' && body.title.trim()) {
      meeting.title = body.title.trim();
    }
    if ('avatarId' in body && typeof body.avatarId === 'string' && body.avatarId.trim()) {
      meeting.avatarId = body.avatarId.trim();
      if (!('liveAvatarAvatarUuid' in body)) {
        const parsedAvatar = parseLiveAvatarAvatarUuid(meeting.avatarId);
        if (parsedAvatar) meeting.liveAvatarAvatarUuid = parsedAvatar;
      }
    }
    if ('voiceId' in body) {
      if (body.voiceId === '' || body.voiceId === null) {
        meeting.voiceId = undefined;
      } else if (typeof body.voiceId === 'string') {
        meeting.voiceId = body.voiceId.trim() || undefined;
      }
    }
    if ('language' in body && typeof body.language === 'string' && body.language.trim()) {
      meeting.language = body.language.trim();
    }
    if ('liveAvatarAvatarUuid' in body) {
      if (body.liveAvatarAvatarUuid === '' || body.liveAvatarAvatarUuid === null) {
        meeting.liveAvatarAvatarUuid = undefined;
      } else if (typeof body.liveAvatarAvatarUuid === 'string') {
        const parsed = parseLiveAvatarAvatarUuid(body.liveAvatarAvatarUuid.trim());
        if (!parsed) {
          return NextResponse.json(
            { success: false, message: 'liveAvatarAvatarUuid must be a valid UUID' },
            { status: 400 },
          );
        }
        meeting.liveAvatarAvatarUuid = parsed;
      }
    }

    if (body.knowledgeBaseId) {
      const ownerOid = authUserObjectId(auth.userId);
      if (!ownerOid) {
        return NextResponse.json(
          { success: false, message: 'Invalid session' },
          { status: 401 },
        );
      }
      const kb = await KnowledgeBase.findOne({
        _id: body.knowledgeBaseId,
        userId: ownerOid,
      });
      if (!kb) {
        return NextResponse.json(
          { success: false, message: 'Knowledge base not found or access denied' },
          { status: 403 },
        );
      }
      meeting.knowledgeBaseId = kb._id as mongoose.Types.ObjectId;
    }
    if ('maxSessions' in body) {
      if (body.maxSessions === '' || body.maxSessions === null) {
        meeting.maxSessions = undefined;
      } else if (typeof body.maxSessions === 'number' && body.maxSessions >= 1) {
        meeting.maxSessions = body.maxSessions;
      }
    }
    if ('expiresAt' in body) {
      if (body.expiresAt === '' || body.expiresAt === null) {
        meeting.expiresAt = undefined;
      } else if (body.expiresAt) {
        const d = new Date(body.expiresAt);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json(
            { success: false, message: 'Invalid expiresAt' },
            { status: 400 },
          );
        }
        meeting.expiresAt = d;
      }
    }
    if (typeof body.isReusable === 'boolean') {
      meeting.isReusable = body.isReusable;
    }
    if (typeof body.isActive === 'boolean') {
      meeting.isActive = body.isActive;
    }

    if (hasSettings) {
      const prev =
        meeting.settings &&
        typeof meeting.settings === 'object' &&
        !Array.isArray(meeting.settings)
          ? (meeting.settings as Record<string, unknown>)
          : {};
      meeting.settings = { ...prev, ...(body.settings as Record<string, unknown>) };
    }

    await meeting.save();
    await meeting.populate('knowledgeBaseId', 'name');
    const kb = meeting.knowledgeBaseId as unknown as { _id: unknown; name?: string } | null;

    const origin = publicAppOrigin(request);
    const shareUrl = meetingShareUrl(origin, meeting.meetingId);

    return NextResponse.json({
      success: true,
      meeting: {
        meetingId: meeting.meetingId,
        shareUrl,
        title: meeting.title,
        avatarId: meeting.avatarId,
        liveAvatarAvatarUuid: meeting.liveAvatarAvatarUuid,
        voiceId: meeting.voiceId,
        language: meeting.language,
        knowledgeBaseId: kb && typeof kb === 'object' && '_id' in kb ? String(kb._id) : String(meeting.knowledgeBaseId),
        knowledgeBaseName: kb && typeof kb === 'object' && 'name' in kb && kb.name ? kb.name : '',
        status: meeting.status,
        isReusable: meeting.isReusable,
        maxSessions: meeting.maxSessions,
        sessionCount: meeting.sessionCount,
        expiresAt: meeting.expiresAt,
        settings: meeting.settings,
        isActive: meeting.isActive,
        createdAt: meeting.createdAt,
        updatedAt: meeting.updatedAt,
        isValid: isMeetingValidForJoin({
          isActive: meeting.isActive,
          status: meeting.status,
          expiresAt: meeting.expiresAt,
          maxSessions: meeting.maxSessions,
          sessionCount: meeting.sessionCount,
        }),
      },
    });
  } catch (error) {
    console.error('Patch meeting error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorized();
    }
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}

// DELETE — soft deactivate (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return unauthorized();
    }

    await connectDB();
    const { meetingId: meetingSlug } = await params;

    const meeting = await Meeting.findOne({ meetingId: meetingSlug });
    if (!meeting) {
      return NextResponse.json(
        { success: false, message: 'Meeting not found' },
        { status: 404 },
      );
    }

    if (!isOwner(meeting, auth.userId)) {
      return NextResponse.json(
        { success: false, message: 'Forbidden' },
        { status: 403 },
      );
    }

    meeting.isActive = false;
    await meeting.save();

    return NextResponse.json({
      success: true,
      message: 'Meeting link deactivated',
    });
  } catch (error) {
    console.error('Delete meeting error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorized();
    }
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}
