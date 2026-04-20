import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import BatchCall from '@/lib/db/models/BatchCall';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { getBatchCallStatus } from '@/lib/elevenlabs/pythonApi';
import { applyPythonSyncToBatchCall } from '@/lib/services/batchCallProgress';

// GET batch job calls (individual call results with pagination)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = requireAuth(request);
    await connectDB();
    const { jobId } = await params;

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 }
      );
    }

    const batchCall = await BatchCall.findOne({
      batch_call_id: jobId,
      userId: userOid,
    });

    if (!batchCall) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BATCH_CALL_NOT_FOUND',
            message: 'Batch call not found or does not belong to your organization',
          },
        },
        { status: 404 }
      );
    }

    try {
      const pythonApiStatus = await getBatchCallStatus(jobId);
      applyPythonSyncToBatchCall(batchCall, pythonApiStatus);
      await batchCall.save();
    } catch (e) {
      console.error('Sync in calls route:', e);
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const cursor = searchParams.get('cursor') || undefined;
    const page_size = searchParams.get('page_size')
      ? parseInt(searchParams.get('page_size')!, 10)
      : undefined;

    let calls = batchCall.recipients.map((recipient, index) => ({
      index,
      phone_number: recipient.phone_number,
      name: recipient.name,
      email: recipient.email,
      dynamic_variables: recipient.dynamic_variables,
      status: recipient.call_status || 'pending',
      conversation_id: recipient.conversation_id,
      duration_seconds: 0,
      started_at_unix: null as number | null,
      ended_at_unix: null as number | null,
    }));

    if (status) {
      calls = calls.filter((call) => call.status === status);
    }

    const pageSize = page_size || 50;
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const paginatedCalls = calls.slice(startIndex, startIndex + pageSize);
    const nextCursor =
      startIndex + pageSize < calls.length
        ? String(startIndex + pageSize)
        : undefined;

    return NextResponse.json({
      success: true,
      data: {
        calls: paginatedCalls,
        cursor: nextCursor,
        total_count: calls.length,
      },
    });
  } catch (error) {
    console.error('Get batch job calls error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
