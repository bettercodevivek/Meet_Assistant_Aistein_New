import mongoose from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import BatchCall from '@/lib/db/models/BatchCall';
import type { IBatchCall, IRecipient } from '@/lib/db/models/BatchCall';
import Agent from '@/lib/db/models/Agent';
import PhoneNumber from '@/lib/db/models/PhoneNumber';
import { submitBatchCall } from '@/lib/elevenlabs/pythonApi';
import { applyPythonSyncToBatchCall } from '@/lib/services/batchCallProgress';

function normalizePhone(p: string): string {
  return String(p).replace(/\D/g, '');
}

/** Recipients we can try again when the batch outcome is no-answer / line failure. */
export function collectNoAnswerRetryPhones(recipients: IRecipient[]): string[] {
  const out: string[] = [];
  for (const r of recipients) {
    const s = r.call_status;
    if (s === 'rejected' || s === 'failed') {
      out.push(r.phone_number);
    }
  }
  return out;
}

async function dispatchNoAnswerRetry(
  batchCall: HydratedDocument<IBatchCall>,
  userOid: mongoose.Types.ObjectId,
  retryPhones: string[],
): Promise<void> {
  const phoneSet = new Set(retryPhones.map(normalizePhone));
  const apiRecipients: Array<{
    phone_number: string;
    name: string;
    email?: string;
    dynamic_variables?: Record<string, unknown>;
  }> = [];

  for (const r of batchCall.recipients || []) {
    const n = normalizePhone(r.phone_number);
    if (!n || !phoneSet.has(n)) continue;
    const dyn =
      r.dynamic_variables && Object.keys(r.dynamic_variables).length > 0
        ? r.dynamic_variables
        : undefined;
    apiRecipients.push({
      phone_number: r.phone_number,
      name: r.name || 'Contact',
      email: r.email,
      dynamic_variables: dyn,
    });
    r.call_status = 'pending';
    r.conversation_id = undefined;
  }

  if (apiRecipients.length === 0) {
    return;
  }

  const agent = await Agent.findOne({ agent_id: batchCall.agent_id, userId: userOid });
  if (!agent) {
    console.error('[NoAnswerRetry] Agent not found', batchCall.agent_id);
    return;
  }

  const phoneNumber = await PhoneNumber.findOne({
    userId: userOid,
    $or: [
      { phone_number_id: batchCall.phone_number_id },
      { elevenlabs_phone_number_id: batchCall.phone_number_id },
    ],
  });
  if (!phoneNumber) {
    console.error('[NoAnswerRetry] Phone number not found');
    return;
  }

  const effectivePhoneNumberId =
    phoneNumber.elevenlabs_phone_number_id || batchCall.phone_number_id;

  const waveLabel = batchCall.no_answer_retry_waves_completed + 1;
  const call_name = `${batchCall.call_name} (auto-retry ${waveLabel})`;

  batchCall.no_answer_auto_retry_in_flight = true;
  batchCall.next_no_answer_retry_at_unix = 0;
  batchCall.current_job_dial_phones = apiRecipients.map((x) => x.phone_number);

  try {
    const pythonApiResponse = await submitBatchCall({
      agent_id: batchCall.agent_id,
      call_name,
      phone_number_id: effectivePhoneNumberId,
      recipients: apiRecipients,
    });

    batchCall.batch_call_id = pythonApiResponse.id;
    batchCall.name = pythonApiResponse.name;
    batchCall.segment_start_index = 0;
    batchCall.resume_next_index = 0;
    batchCall.can_resume = false;
    batchCall.conversations_synced = false;
    applyPythonSyncToBatchCall(batchCall, pythonApiResponse);
  } catch (e) {
    batchCall.no_answer_auto_retry_in_flight = false;
    batchCall.current_job_dial_phones = undefined;
    const iv = batchCall.no_answer_retry_interval_seconds ?? 300;
    const backoff = Math.min(120, Math.max(60, iv));
    batchCall.next_no_answer_retry_at_unix = Math.floor(Date.now() / 1000) + backoff;
    console.error('[NoAnswerRetry] submit failed:', e);
  }
}

/**
 * After merging Python status into a batch: schedule or run automatic redials for no-answer rows.
 * Safe to call on every poll; dispatch is serialized with {@link no_answer_auto_retry_in_flight}.
 */
export async function processNoAnswerAutoRetry(
  batchCall: HydratedDocument<IBatchCall>,
  userOid: mongoose.Types.ObjectId,
): Promise<void> {
  /** Missing field on older documents defaults to on. */
  if (batchCall.no_answer_auto_retry_enabled === false) {
    return;
  }

  const maxWaves = batchCall.no_answer_retry_max_waves ?? 3;
  const intervalSec = batchCall.no_answer_retry_interval_seconds ?? 300;

  const now = Math.floor(Date.now() / 1000);

  if (batchCall.status === 'completed' && batchCall.no_answer_auto_retry_in_flight) {
    const ack = await BatchCall.findOneAndUpdate(
      {
        _id: batchCall._id,
        no_answer_auto_retry_in_flight: true,
        status: 'completed',
      },
      {
        $inc: { no_answer_retry_waves_completed: 1 },
        $set: {
          no_answer_auto_retry_in_flight: false,
          current_job_dial_phones: [],
        },
      },
      { new: true },
    );
    if (ack) {
      batchCall.no_answer_retry_waves_completed = ack.no_answer_retry_waves_completed;
      batchCall.no_answer_auto_retry_in_flight = false;
      batchCall.current_job_dial_phones = undefined;
    }
  }

  if (batchCall.status !== 'completed') {
    return;
  }

  const retryPhones = collectNoAnswerRetryPhones(batchCall.recipients || []);

  if (retryPhones.length === 0) {
    batchCall.next_no_answer_retry_at_unix = 0;
    return;
  }

  if (batchCall.no_answer_retry_waves_completed >= maxWaves) {
    batchCall.next_no_answer_retry_at_unix = 0;
    return;
  }

  if (batchCall.no_answer_auto_retry_in_flight) {
    return;
  }

  if (batchCall.next_no_answer_retry_at_unix === 0) {
    batchCall.next_no_answer_retry_at_unix = now + intervalSec;
  }

  const due =
    batchCall.next_no_answer_retry_at_unix > 0 && now >= batchCall.next_no_answer_retry_at_unix;

  if (!due) {
    return;
  }

  await dispatchNoAnswerRetry(batchCall, userOid, retryPhones);
}
