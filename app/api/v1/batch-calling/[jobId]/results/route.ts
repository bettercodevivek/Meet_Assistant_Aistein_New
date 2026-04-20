import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import BatchCall from '@/lib/db/models/BatchCall';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { getBatchCallStatus } from '@/lib/elevenlabs/pythonApi';
import { applyPythonSyncToBatchCall } from '@/lib/services/batchCallProgress';

// GET batch job results with optional transcripts
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
      console.error('Sync in results route:', e);
    }

    const searchParams = request.nextUrl.searchParams;
    const include_transcript =
      searchParams.get('include_transcript') !== 'false';

    const results = batchCall.recipients.map((recipient, index) => ({
      index,
      call_id: recipient.conversation_id || `row_${index}`,
      phone_number: recipient.phone_number,
      name: recipient.name,
      email: recipient.email,
      dynamic_variables: recipient.dynamic_variables,
      status: recipient.call_status || 'pending',
      transcript: include_transcript ? '' : undefined,
      summary: '',
      sentiment: 'neutral',
    }));

    return NextResponse.json({
      success: true,
      data: {
        batch_call_id: batchCall.batch_call_id,
        results,
      },
    });
  } catch (error) {
    console.error('Get batch job results error:', error);

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
