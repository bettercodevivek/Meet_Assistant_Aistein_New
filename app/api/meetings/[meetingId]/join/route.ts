import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/db/mongodb';
import Meeting from '@/lib/db/models/Meeting';
import Conversation from '@/lib/db/models/Conversation';
import { allowMeetingJoin } from '@/lib/rateLimit/meetingJoinRateLimit';

function guestAccessToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function normalizeGuestSessionKey(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  if (t.length < 8 || t.length > 128) return undefined;
  return t;
}

// POST — guest joins (no auth); increments sessionCount and creates a guest conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    await connectDB();
    const { meetingId: meetingSlug } = await params;
    const body = await request.json().catch(() => ({}));
    const rawName = typeof body.guestName === 'string' ? body.guestName.trim() : '';
    if (rawName.length < 1 || rawName.length > 120) {
      return NextResponse.json(
        { success: false, message: 'guestName is required (1–120 characters)' },
        { status: 400 },
      );
    }

    const guestSessionKey = normalizeGuestSessionKey(body.guestSessionKey);

    const now = new Date();
    const meetingFilter: Record<string, unknown> = {
      meetingId: meetingSlug,
      isActive: true,
      status: { $ne: 'completed' },
      $and: [
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: now } },
          ],
        },
        {
          $or: [
            { maxSessions: { $exists: false } },
            { maxSessions: null },
            { $expr: { $lt: ['$sessionCount', '$maxSessions'] } },
          ],
        },
      ],
    };

    const meeting = await Meeting.findOne(meetingFilter);
    if (!meeting) {
      return NextResponse.json(
        { success: false, message: 'Meeting is not available for new joins' },
        { status: 409 },
      );
    }

    const activeQuery: Record<string, unknown> = {
      meetingId: meeting._id,
      status: 'active',
    };
    if (guestSessionKey) {
      activeQuery.guestSessionKey = guestSessionKey;
    } else {
      activeQuery.guestName = rawName;
      activeQuery.$or = [
        { guestSessionKey: { $exists: false } },
        { guestSessionKey: null },
        { guestSessionKey: '' },
      ];
    }

    const existing = await Conversation.findOne(activeQuery).select('+guestAccessToken');
    if (existing?.guestAccessToken) {
      return NextResponse.json({
        success: true,
        reconnect: true,
        conversationId: String(existing._id),
        guestToken: existing.guestAccessToken,
      });
    }

    const rate = allowMeetingJoin(meetingSlug);
    if (!rate.ok) {
      return NextResponse.json(
        {
          success: false,
          message: `Too many join attempts for this meeting. Try again in ${rate.retryAfterSec} seconds.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rate.retryAfterSec) },
        },
      );
    }

    const updated = await Meeting.findOneAndUpdate(
      { _id: meeting._id, ...meetingFilter },
      { $inc: { sessionCount: 1 } },
      { new: true },
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'Meeting is not available for new joins' },
        { status: 409 },
      );
    }

    const token = guestAccessToken();
    const conversation = await Conversation.create({
      guestName: rawName,
      ...(guestSessionKey ? { guestSessionKey } : {}),
      guestAccessToken: token,
      meetingId: meeting._id,
      avatarId: meeting.avatarId,
      voiceId: meeting.voiceId,
      language: meeting.language,
      knowledgeBaseId: meeting.knowledgeBaseId,
      title: `${meeting.title} — ${rawName}`,
      status: 'active',
    });

    await Meeting.findByIdAndUpdate(meeting._id, {
      $set: { status: 'active' },
    });

    return NextResponse.json({
      success: true,
      reconnect: false,
      conversationId: String(conversation._id),
      guestToken: token,
    });
  } catch (error) {
    console.error('Meeting join error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}
