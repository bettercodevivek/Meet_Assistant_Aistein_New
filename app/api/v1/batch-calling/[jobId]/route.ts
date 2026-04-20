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

// GET batch job status
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

    // Sync status with Python API
    try {
      const pythonApiStatus = await getBatchCallStatus(jobId);
      applyPythonSyncToBatchCall(batchCall, pythonApiStatus);
      await batchCall.save();
      await processCompletedBatchRecipientsForAutomation(batchCall, userOid);
      await processNoAnswerAutoRetry(batchCall, userOid);
      if (batchCall.isModified()) await batchCall.save();

      const global_total_finished = computeGlobalFinished(batchCall);
      const recipients = batchCall.recipients.map((r, index) => ({
        index,
        phone_number: r.phone_number,
        name: r.name,
        email: r.email,
        call_status: r.call_status || 'pending',
        conversation_id: r.conversation_id,
      }));

      return NextResponse.json({
        ...pythonApiStatus,
        global_total_finished,
        segment_start_index: batchCall.segment_start_index,
        resume_next_index: batchCall.resume_next_index,
        can_resume: batchCall.can_resume,
        no_answer_auto_retry_enabled: batchCall.no_answer_auto_retry_enabled,
        no_answer_retry_interval_seconds: batchCall.no_answer_retry_interval_seconds,
        no_answer_retry_max_waves: batchCall.no_answer_retry_max_waves,
        no_answer_retry_waves_completed: batchCall.no_answer_retry_waves_completed,
        next_no_answer_retry_at_unix: batchCall.next_no_answer_retry_at_unix,
        no_answer_auto_retry_in_flight: batchCall.no_answer_auto_retry_in_flight,
        recipients,
        call_name: batchCall.call_name,
        agent_name: batchCall.agent_name,
        recipients_count: batchCall.recipients_count,
      });
    } catch (error) {
      console.error('Sync batch call status error:', error);
      const global_total_finished = computeGlobalFinished(batchCall);
      const recipients = batchCall.recipients.map((r, index) => ({
        index,
        phone_number: r.phone_number,
        name: r.name,
        email: r.email,
        call_status: r.call_status || 'pending',
        conversation_id: r.conversation_id,
      }));
      return NextResponse.json({
        id: batchCall.batch_call_id,
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
        last_updated_at_unix: batchCall.last_updated_at_unix,
        retry_count: batchCall.retry_count,
        agent_name: batchCall.agent_name,
        global_total_finished,
        segment_start_index: batchCall.segment_start_index,
        resume_next_index: batchCall.resume_next_index,
        can_resume: batchCall.can_resume,
        no_answer_auto_retry_enabled: batchCall.no_answer_auto_retry_enabled,
        no_answer_retry_interval_seconds: batchCall.no_answer_retry_interval_seconds,
        no_answer_retry_max_waves: batchCall.no_answer_retry_max_waves,
        no_answer_retry_waves_completed: batchCall.no_answer_retry_waves_completed,
        next_no_answer_retry_at_unix: batchCall.next_no_answer_retry_at_unix,
        no_answer_auto_retry_in_flight: batchCall.no_answer_auto_retry_in_flight,
        recipients,
        call_name: batchCall.call_name,
        recipients_count: batchCall.recipients_count,
      });
    }
  } catch (error) {
    console.error('Get batch job status error:', error);

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
