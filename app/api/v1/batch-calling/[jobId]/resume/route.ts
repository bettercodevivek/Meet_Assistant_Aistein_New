import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import BatchCall from '@/lib/db/models/BatchCall';
import Agent from '@/lib/db/models/Agent';
import PhoneNumber from '@/lib/db/models/PhoneNumber';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { submitBatchCall } from '@/lib/elevenlabs/pythonApi';
import { applyPythonSyncToBatchCall } from '@/lib/services/batchCallProgress';

/** Continue a cancelled batch from `resume_next_index` with remaining recipients. */
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
            message: 'Batch call not found',
          },
        },
        { status: 404 }
      );
    }

    if (!batchCall.can_resume) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CANNOT_RESUME',
            message: 'This batch cannot be resumed (nothing left or not paused).',
          },
        },
        { status: 400 }
      );
    }

    const start = batchCall.resume_next_index;
    const remaining = batchCall.recipients.slice(start);
    if (remaining.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NO_REMAINING', message: 'No remaining contacts to call.' },
        },
        { status: 400 }
      );
    }

    const agent = await Agent.findOne({ agent_id: batchCall.agent_id, userId: userOid });
    if (!agent) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } },
        { status: 404 }
      );
    }

    const phoneNumber = await PhoneNumber.findOne({
      userId: userOid,
      $or: [
        { phone_number_id: batchCall.phone_number_id },
        { elevenlabs_phone_number_id: batchCall.phone_number_id },
      ],
    });
    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Phone number not found' } },
        { status: 404 }
      );
    }

    const effectivePhoneNumberId =
      phoneNumber.elevenlabs_phone_number_id || batchCall.phone_number_id;

    const apiRecipients = remaining.map((r) => {
      const dyn =
        r.dynamic_variables && Object.keys(r.dynamic_variables).length > 0
          ? r.dynamic_variables
          : undefined;
      return {
        phone_number: r.phone_number,
        name: r.name || 'Contact',
        email: r.email,
        dynamic_variables: dyn,
      };
    });

    const call_name = `${batchCall.call_name} (resumed)`;

    batchCall.next_no_answer_retry_at_unix = 0;
    batchCall.no_answer_auto_retry_in_flight = false;
    batchCall.current_job_dial_phones = undefined;

    const pythonApiResponse = await submitBatchCall({
      agent_id: batchCall.agent_id,
      call_name,
      phone_number_id: effectivePhoneNumberId,
      recipients: apiRecipients,
    });

    batchCall.batch_call_id = pythonApiResponse.id;
    batchCall.name = pythonApiResponse.name;
    batchCall.segment_start_index = start;
    batchCall.resume_next_index = start;
    batchCall.can_resume = false;
    batchCall.conversations_synced = false;
    applyPythonSyncToBatchCall(batchCall, pythonApiResponse);
    await batchCall.save();

    return NextResponse.json({
      success: true,
      data: {
        batch_call_id: batchCall.batch_call_id,
        segment_start_index: batchCall.segment_start_index,
        remaining_count: remaining.length,
        ...pythonApiResponse,
      },
    });
  } catch (error) {
    console.error('Resume batch call error:', error);

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
