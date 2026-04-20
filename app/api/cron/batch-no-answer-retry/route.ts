import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import BatchCall from '@/lib/db/models/BatchCall';
import { getBatchCallStatus } from '@/lib/elevenlabs/pythonApi';
import { applyPythonSyncToBatchCall } from '@/lib/services/batchCallProgress';
import { processCompletedBatchRecipientsForAutomation } from '@/lib/services/batchCallAutomationSync';
import { processNoAnswerAutoRetry } from '@/lib/services/batchCallNoAnswerRetry';

function authorizeCron(request: NextRequest): boolean | 'missing_secret' {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return 'missing_secret';
  }
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) {
    return true;
  }
  return request.headers.get('x-cron-secret') === secret;
}

/**
 * Processes scheduled no-answer auto-retries when no dashboard client is polling.
 * Configure Vercel Cron or another scheduler with Authorization: Bearer CRON_SECRET (or x-cron-secret).
 */
export async function POST(request: NextRequest) {
  return runBatchNoAnswerRetry(request);
}

export async function GET(request: NextRequest) {
  return runBatchNoAnswerRetry(request);
}

async function runBatchNoAnswerRetry(request: NextRequest) {
  try {
    const auth = authorizeCron(request);
    if (auth === 'missing_secret') {
      return NextResponse.json(
        { success: false, message: 'CRON_SECRET is not configured' },
        { status: 503 },
      );
    }
    if (!auth) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const now = Math.floor(Date.now() / 1000);

    const candidates = await BatchCall.find({
      no_answer_auto_retry_enabled: true,
      status: 'completed',
      next_no_answer_retry_at_unix: { $lte: now, $gt: 0 },
      no_answer_auto_retry_in_flight: false,
    })
      .limit(50)
      .exec();

    let processed = 0;
    for (const batchCall of candidates) {
      try {
        const pythonApiStatus = await getBatchCallStatus(batchCall.batch_call_id);
        applyPythonSyncToBatchCall(batchCall, pythonApiStatus);
        await batchCall.save();
        await processCompletedBatchRecipientsForAutomation(batchCall, batchCall.userId);
        await processNoAnswerAutoRetry(batchCall, batchCall.userId);
        if (batchCall.isModified()) await batchCall.save();
        processed += 1;
      } catch (e) {
        console.error('[cron batch-no-answer-retry] batch', batchCall.batch_call_id, e);
      }
    }

    return NextResponse.json({
      success: true,
      candidates: candidates.length,
      processed,
    });
  } catch (error) {
    console.error('[cron batch-no-answer-retry]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
