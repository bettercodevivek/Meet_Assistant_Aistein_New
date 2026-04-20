import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import BatchCall from '@/lib/db/models/BatchCall';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { getBatchCallStatus } from '@/lib/elevenlabs/pythonApi';
import {
  applyPythonSyncToBatchCall,
  computeGlobalFinished,
} from '@/lib/services/batchCallProgress';
import { processCompletedBatchRecipientsForAutomation } from '@/lib/services/batchCallAutomationSync';
import { processNoAnswerAutoRetry } from '@/lib/services/batchCallNoAnswerRetry';

// GET all batch calls
export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const includeCancelled = searchParams.get('includeCancelled') === 'true';

    const query: Record<string, unknown> = { userId: userOid };
    if (!includeCancelled) {
      query.$or = [
        { status: { $ne: 'cancelled' } },
        { can_resume: true },
      ];
    }

    const batchCalls = await BatchCall.find(query).sort({ createdAt: -1 });

    // Sync status with Python API for each batch call
    const syncedBatchCalls = await Promise.all(
      batchCalls.map(async (batchCall) => {
        try {
          const pythonApiStatus = await getBatchCallStatus(batchCall.batch_call_id);
          applyPythonSyncToBatchCall(batchCall, pythonApiStatus);
          await batchCall.save();
          await processCompletedBatchRecipientsForAutomation(batchCall, userOid);
          await processNoAnswerAutoRetry(batchCall, userOid);
          if (batchCall.isModified()) await batchCall.save();
        } catch (error) {
          console.error('Sync batch call status error:', error);
        }

        const global_total_finished = computeGlobalFinished(batchCall);

        return {
          _id: String(batchCall._id),
          userId: String(batchCall.userId),
          organizationId: batchCall.organizationId
            ? String(batchCall.organizationId)
            : undefined,
          batch_call_id: batchCall.batch_call_id,
          name: batchCall.name,
          agent_id: batchCall.agent_id,
          status: batchCall.status,
          phone_number_id: batchCall.phone_number_id,
          phone_provider: batchCall.phone_provider,
          created_at_unix: batchCall.created_at_unix,
          scheduled_time_unix: batchCall.scheduled_time_unix,
          timezone: batchCall.timezone,
          total_calls_dispatched: batchCall.total_calls_dispatched,
          total_calls_scheduled: batchCall.total_calls_scheduled,
          total_calls_finished: batchCall.total_calls_finished,
          global_total_finished,
          last_updated_at_unix: batchCall.last_updated_at_unix,
          retry_count: batchCall.retry_count,
          agent_name: batchCall.agent_name,
          call_name: batchCall.call_name,
          recipients_count: batchCall.recipients_count,
          conversations_synced: batchCall.conversations_synced,
          segment_start_index: batchCall.segment_start_index,
          resume_next_index: batchCall.resume_next_index,
          can_resume: batchCall.can_resume,
          no_answer_auto_retry_enabled: batchCall.no_answer_auto_retry_enabled,
          no_answer_retry_interval_seconds: batchCall.no_answer_retry_interval_seconds,
          no_answer_retry_max_waves: batchCall.no_answer_retry_max_waves,
          no_answer_retry_waves_completed: batchCall.no_answer_retry_waves_completed,
          next_no_answer_retry_at_unix: batchCall.next_no_answer_retry_at_unix,
          no_answer_auto_retry_in_flight: batchCall.no_answer_auto_retry_in_flight,
          createdAt: batchCall.createdAt,
          updatedAt: batchCall.updatedAt,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: syncedBatchCalls,
    });
  } catch (error) {
    console.error('Get batch calls error:', error);

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
