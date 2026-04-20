import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import BatchCall from '@/lib/db/models/BatchCall';
import Agent from '@/lib/db/models/Agent';
import PhoneNumber from '@/lib/db/models/PhoneNumber';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { submitBatchCall } from '@/lib/elevenlabs/pythonApi';
import { parseRecipientsFromFile } from '@/lib/batchCalling/parseRecipientsFile';

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

// POST submit batch call
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();

    const formData = await request.formData();
    const agent_id = formData.get('agent_id') as string;
    const call_name = formData.get('call_name') as string;
    const phone_number_id = formData.get('phone_number_id') as string;
    const file = formData.get('file') as File | null;
    const noAnswerRetryRaw = formData.get('no_answer_auto_retry_enabled');
    const no_answer_auto_retry_enabled =
      noAnswerRetryRaw !== 'false' && noAnswerRetryRaw !== '0';
    const intervalMin = clampInt(
      parseInt(String(formData.get('no_answer_retry_interval_minutes') ?? '5'), 10),
      1,
      24 * 60,
    );
    const no_answer_retry_interval_seconds = clampInt(intervalMin * 60, 60, 24 * 3600);
    const no_answer_retry_max_waves = clampInt(
      parseInt(String(formData.get('no_answer_retry_max_waves') ?? '3'), 10),
      0,
      50,
    );

    console.log('[POST /api/v1/batch-calling/submit] Request:', {
      userId: user.userId,
      agent_id,
      call_name,
      phone_number_id,
      fileName: file?.name,
    });

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 }
      );
    }

    // Validation
    if (!agent_id || !call_name || !phone_number_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'agent_id, call_name, and phone_number_id are required',
          },
        },
        { status: 422 }
      );
    }

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'file is required',
          },
        },
        { status: 422 }
      );
    }

    let parsed: Awaited<ReturnType<typeof parseRecipientsFromFile>>;
    try {
      parsed = await parseRecipientsFromFile(file);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid file';
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: msg },
        },
        { status: 422 }
      );
    }

    const recipients = parsed.map((r) => {
      const dyn: Record<string, unknown> = {};
      if (r.customer_name) dyn.customer_name = r.customer_name;
      if (r.customer_email) dyn.customer_email = r.customer_email;
      if (r.customer_phone_number) dyn.customer_phone_number = r.customer_phone_number;
      return {
        phone_number: r.phone_number,
        name: r.name || 'Contact',
        email: r.email,
        call_status: 'pending' as const,
        ...(Object.keys(dyn).length > 0 ? { dynamic_variables: dyn } : {}),
      };
    });

    console.log('[POST /api/v1/batch-calling/submit] Parsed recipients:', recipients.length);

    if (recipients.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No valid recipients found in file (need header row and phone column)',
          },
        },
        { status: 422 }
      );
    }

    const apiRecipients = recipients.map((r) => {
      const dyn = r.dynamic_variables && Object.keys(r.dynamic_variables).length > 0 ? r.dynamic_variables : undefined;
      return {
        phone_number: r.phone_number,
        name: r.name,
        email: r.email,
        dynamic_variables: dyn,
      };
    });

    // Validate agent exists and belongs to user
    const agent = await Agent.findOne({ agent_id, userId: userOid });
    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Agent not found',
          },
        },
        { status: 404 }
      );
    }

    // Validate phone number exists and belongs to user
    const phoneNumber = await PhoneNumber.findOne({
      phone_number_id,
      userId: userOid,
    });
    if (!phoneNumber) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Phone number not found',
          },
        },
        { status: 404 }
      );
    }

    console.log('[POST /api/v1/batch-calling/submit] Parsed recipients:', recipients.length);

    // Use elevenlabs_phone_number_id if available, otherwise use local phone_number_id
    const effectivePhoneNumberId = phoneNumber.elevenlabs_phone_number_id || phone_number_id;
    console.log('[POST /api/v1/batch-calling/submit] Using phone_number_id:', effectivePhoneNumberId);

    // Submit batch call via Python API
    const pythonApiResponse = await submitBatchCall({
      agent_id,
      call_name,
      phone_number_id: effectivePhoneNumberId,
      recipients: apiRecipients,
    });

    console.log('[POST /api/v1/batch-calling/submit] Python API Response:', pythonApiResponse);

    // Create local record
    const batch_call_id = pythonApiResponse.id;
    const created_at_unix = Math.floor(Date.now() / 1000);

    const batchCall = await BatchCall.create({
      userId: userOid,
      batch_call_id,
      name: pythonApiResponse.name,
      call_name,
      agent_id,
      agent_name: agent.name,
      status: pythonApiResponse.status,
      phone_number_id: pythonApiResponse.phone_number_id,
      phone_provider: pythonApiResponse.phone_provider,
      recipients,
      recipients_count: recipients.length,
      created_at_unix,
      scheduled_time_unix: pythonApiResponse.scheduled_time_unix,
      timezone: pythonApiResponse.timezone,
      total_calls_dispatched: pythonApiResponse.total_calls_dispatched,
      total_calls_scheduled: pythonApiResponse.total_calls_scheduled,
      total_calls_finished: pythonApiResponse.total_calls_finished,
      last_updated_at_unix: pythonApiResponse.last_updated_at_unix,
      retry_count: pythonApiResponse.retry_count,
      conversations_synced: false,
      segment_start_index: 0,
      resume_next_index: 0,
      can_resume: false,
      no_answer_auto_retry_enabled,
      no_answer_retry_interval_seconds,
      no_answer_retry_max_waves,
      no_answer_retry_waves_completed: 0,
      next_no_answer_retry_at_unix: 0,
      no_answer_auto_retry_in_flight: false,
    });

    return NextResponse.json(
      { ...pythonApiResponse, recipients_count: recipients.length },
      { status: 201 }
    );
  } catch (error) {
    console.error('Submit batch call error:', error);

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
