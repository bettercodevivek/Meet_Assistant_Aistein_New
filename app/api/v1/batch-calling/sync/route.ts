import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import BatchCall from '@/lib/db/models/BatchCall';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { applyPythonSyncToBatchCall } from '@/lib/services/batchCallProgress';
import { processCompletedBatchRecipientsForAutomation } from '@/lib/services/batchCallAutomationSync';
import { processNoAnswerAutoRetry } from '@/lib/services/batchCallNoAnswerRetry';
import { getPythonApiBaseUrl } from '@/lib/elevenlabs/pythonApi';

const PYTHON_API_URL = getPythonApiBaseUrl();

// POST /api/v1/batch-calling/sync
// Sync batch call status from Python API and trigger automations for completed calls
export async function POST(request: NextRequest) {
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

    const { batch_call_id } = await request.json();

    if (!batch_call_id) {
      return NextResponse.json(
        { success: false, message: 'batch_call_id is required' },
        { status: 400 },
      );
    }

    const batchCall = await BatchCall.findOne({ batch_call_id, userId: userOid });
    if (!batchCall) {
      return NextResponse.json(
        { success: false, message: 'Batch call not found' },
        { status: 404 },
      );
    }

    const pythonApiResponse = await fetch(
      `${PYTHON_API_URL}/api/v1/batch-calling/${batch_call_id}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.ELEVEN_API_KEY}`,
        },
      },
    );

    if (!pythonApiResponse.ok) {
      return NextResponse.json(
        { success: false, message: 'Failed to fetch batch status from Python API' },
        { status: 500 },
      );
    }

    const pythonApiData = await pythonApiResponse.json();
    applyPythonSyncToBatchCall(batchCall, pythonApiData);
    await batchCall.save();

    await processCompletedBatchRecipientsForAutomation(batchCall, userOid);
    await processNoAnswerAutoRetry(batchCall, userOid);
    if (batchCall.isModified()) await batchCall.save();

    return NextResponse.json({
      success: true,
      batch_call_id: batchCall.batch_call_id,
      status: batchCall.status,
      total_calls_finished: batchCall.total_calls_finished,
      total_calls_scheduled: batchCall.total_calls_scheduled,
      conversations_synced: batchCall.conversations_synced,
    });
  } catch (error) {
    console.error('Batch sync error:', error);

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
