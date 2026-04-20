import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import KnowledgeBase from '@/lib/db/models/KnowledgeBase';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import mongoose from 'mongoose';

/** GET saved Meet automation defaults (KB + LiveAvatar id) for batch automations. */
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();
    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json({ success: false, message: 'Invalid session' }, { status: 401 });
    }

    const doc = await User.findById(userOid).select('meetAutomationDefaults').lean();
    const d = doc?.meetAutomationDefaults as { knowledgeBaseId?: string; avatarId?: string } | undefined;

    return NextResponse.json({
      success: true,
      data: {
        knowledgeBaseId: d?.knowledgeBaseId?.trim() || '',
        avatarId: d?.avatarId?.trim() || '',
      },
    });
  } catch (error) {
    console.error('[GET /api/v1/meet-automation]', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH — save defaults used when automation “Create MeetAssistant” has empty KB / avatar. */
export async function PATCH(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();
    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json({ success: false, message: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();
    const knowledgeBaseId =
      typeof body.knowledgeBaseId === 'string' ? body.knowledgeBaseId.trim() : '';
    const avatarId = typeof body.avatarId === 'string' ? body.avatarId.trim() : '';

    if (knowledgeBaseId) {
      if (!mongoose.Types.ObjectId.isValid(knowledgeBaseId)) {
        return NextResponse.json(
          { success: false, message: 'Invalid knowledge base id' },
          { status: 400 },
        );
      }
      const kb = await KnowledgeBase.findOne({ _id: knowledgeBaseId, userId: userOid });
      if (!kb) {
        return NextResponse.json(
          { success: false, message: 'Knowledge base not found' },
          { status: 404 },
        );
      }
    }

    await User.findByIdAndUpdate(userOid, {
      $set: {
        meetAutomationDefaults: {
          knowledgeBaseId,
          avatarId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        knowledgeBaseId,
        avatarId,
      },
    });
  } catch (error) {
    console.error('[PATCH /api/v1/meet-automation]', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
