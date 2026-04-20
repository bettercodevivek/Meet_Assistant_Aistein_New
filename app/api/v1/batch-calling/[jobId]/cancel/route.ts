import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import BatchCall from '@/lib/db/models/BatchCall';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { cancelBatchCall, getBatchCallStatus } from '@/lib/elevenlabs/pythonApi';
import {
  applyPythonSyncToBatchCall,
  computeGlobalFinished,
} from '@/lib/services/batchCallProgress';

// POST cancel batch job
export async function POST(
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
    } catch (e) {
      console.error('Pre-cancel sync failed:', e);
    }

    const globalDone = computeGlobalFinished(batchCall);
    batchCall.resume_next_index = globalDone;
    batchCall.can_resume = globalDone < batchCall.recipients.length;

    batchCall.next_no_answer_retry_at_unix = 0;
    batchCall.no_answer_auto_retry_in_flight = false;
    batchCall.current_job_dial_phones = undefined;

    const response = await cancelBatchCall(jobId);

    batchCall.status = 'cancelled';
    batchCall.last_updated_at_unix = Math.floor(Date.now() / 1000);
    applyPythonSyncToBatchCall(batchCall, {
      status: 'cancelled',
      total_calls_finished: batchCall.total_calls_finished,
      total_calls_dispatched: batchCall.total_calls_dispatched,
      total_calls_scheduled: batchCall.total_calls_scheduled,
    });
    await batchCall.save();

    return NextResponse.json({
      ...response,
      resume_next_index: batchCall.resume_next_index,
      can_resume: batchCall.can_resume,
      global_total_finished: globalDone,
    });
  } catch (error) {
    console.error('Cancel batch job error:', error);

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
