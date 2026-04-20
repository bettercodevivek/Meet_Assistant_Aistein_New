import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import PhoneConversation from '@/lib/db/models/PhoneConversation';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';

/**
 * Recent automation runs (per completed batch call conversation) with step outcomes.
 */
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
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '25', 10) || 25));

    const rows = await PhoneConversation.find({
      userId: userOid,
      'metadata.automation_runs.0': { $exists: true },
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('customerId', 'name email phone')
      .lean();

    const data = rows.map((doc) => {
      const c = doc.customerId as { name?: string; email?: string; phone?: string } | null;
      const meta = doc.metadata as {
        batch_call_id?: string;
        phone_number?: string;
        automation_runs?: unknown[];
      };
      return {
        conversationId: String(doc._id),
        batchCallId: meta?.batch_call_id,
        phone: meta?.phone_number || c?.phone,
        contactName: c?.name,
        contactEmail: c?.email,
        ranAt: doc.updatedAt,
        automationRuns: meta?.automation_runs || [],
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Automation activity error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}
