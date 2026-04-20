import type { HydratedDocument } from 'mongoose';
import type { IBatchCall, IRecipient } from '@/lib/db/models/BatchCall';

export type CallStatus =
  | 'pending'
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'cancelled'
  | 'skipped';

export interface PythonBatchPayload {
  status: string;
  total_calls_dispatched?: number;
  total_calls_scheduled?: number;
  total_calls_finished?: number;
  recipients?: Array<{
    phone_number?: string;
    name?: string;
    status?: string;
    call_status?: string;
    outcome?: string;
    conversation_id?: string;
  }>;
}

type PythonRecipientRow = NonNullable<PythonBatchPayload['recipients']>[number];

function normalizePhone(p: string): string {
  return String(p).replace(/\D/g, '');
}

/** Match CSV phone to API row despite +country / formatting differences. */
function pickPythonRecipient(
  byPhone: Map<string, PythonRecipientRow>,
  phone: string,
): PythonRecipientRow | undefined {
  const n = normalizePhone(phone);
  if (!n) return undefined;
  const direct = byPhone.get(n);
  if (direct) return direct;
  if (n.length > 10) {
    const hit = byPhone.get(n.slice(-10));
    if (hit) return hit;
  }
  for (const [k, v] of Array.from(byPhone.entries())) {
    if (k.endsWith(n) || n.endsWith(k)) return v;
  }
  return undefined;
}

function rawRecipientStatus(
  hit: { status?: string; call_status?: string; outcome?: string } | undefined,
): string | undefined {
  if (!hit) return undefined;
  return hit.status || hit.call_status || hit.outcome;
}

function mapExternalStatus(s: string | undefined): CallStatus {
  const x = (s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  if (
    x === 'completed' ||
    x === 'done' ||
    x === 'success' ||
    x === 'successful' ||
    x === 'answered' ||
    x === 'connected' ||
    x === 'ok'
  ) {
    return 'completed';
  }
  if (
    x === 'in_progress' ||
    x === 'ongoing' ||
    x === 'active' ||
    x === 'ringing' ||
    x === 'dialing' ||
    x === 'initiated' ||
    x === 'calling'
  ) {
    return 'in_progress';
  }
  if (x === 'failed' || x === 'error' || x === 'failure') return 'failed';
  if (
    x === 'rejected' ||
    x === 'declined' ||
    x === 'decline' ||
    x === 'user_declined' ||
    x === 'callee_declined' ||
    x === 'customer_declined' ||
    x === 'hang_up' ||
    x === 'hangup' ||
    x === 'user_hangup'
  ) {
    return 'rejected';
  }
  if (
    x === 'no_answer' ||
    x === 'noanswer' ||
    x === 'unanswered' ||
    x === 'not_answered' ||
    x === 'busy' ||
    x === 'voicemail' ||
    x === 'machine' ||
    x === 'timeout' ||
    x === 'timed_out'
  ) {
    return 'rejected';
  }
  if (x === 'cancelled' || x === 'canceled') return 'cancelled';
  if (x === 'queued' || x === 'scheduled' || x === 'pending') return 'queued';
  if (x === 'skipped') return 'skipped';
  return 'pending';
}

/**
 * Updates embedded recipient call_status from Python API payload.
 * Mutates batchCall.recipients in place.
 */
export function mergeRecipientStatuses(
  batchCall: HydratedDocument<IBatchCall>,
  python: PythonBatchPayload,
): void {
  const recipients = batchCall.recipients as IRecipient[];
  if (!recipients?.length) return;

  const segStart = batchCall.segment_start_index ?? 0;
  const apiFinished = python.total_calls_finished ?? 0;
  const globalFinished = Math.min(segStart + apiFinished, recipients.length);
  const dispatched = python.total_calls_dispatched ?? 0;
  const globalDispatched = Math.min(segStart + dispatched, recipients.length);
  const st = (python.status || '').toLowerCase();

  if (python.recipients && python.recipients.length > 0) {
    const byPhone = new Map<string, PythonRecipientRow>();
    for (const pr of python.recipients) {
      if (pr.phone_number) {
        const key = normalizePhone(pr.phone_number);
        if (key) {
          byPhone.set(key, pr);
          if (key.length > 10) {
            byPhone.set(key.slice(-10), pr);
          }
        }
      }
    }
    for (const r of recipients) {
      const hit = pickPythonRecipient(byPhone, r.phone_number);
      const raw = rawRecipientStatus(hit);
      if (raw) {
        r.call_status = mapExternalStatus(raw);
      }
      if (hit?.conversation_id) {
        r.conversation_id = hit.conversation_id;
      }
    }
    if (st === 'completed') {
      for (const r of recipients) {
        if (r.call_status === 'pending' || r.call_status === 'queued') {
          r.call_status = 'rejected';
        }
      }
    }
    return;
  }

  // Auto-retry jobs dial a non-contiguous subset; index-based mapping would mark the wrong CSV rows.
  const dialSubset = batchCall.current_job_dial_phones;
  if (dialSubset && dialSubset.length > 0) {
    return;
  }

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    if (st === 'cancelled') {
      if (i < globalFinished) {
        r.call_status = 'completed';
      } else {
        r.call_status = 'cancelled';
      }
      continue;
    }
    if (i < globalFinished) {
      r.call_status = 'completed';
    } else if (i === globalFinished && st === 'in_progress') {
      r.call_status = 'in_progress';
    } else if (i < globalDispatched && i >= globalFinished) {
      r.call_status = 'queued';
    } else if (st === 'failed') {
      r.call_status = i < globalFinished ? 'completed' : 'failed';
    } else {
      r.call_status = (r.call_status as CallStatus) || 'pending';
    }
  }

  if (st === 'completed') {
    for (const r of recipients) {
      if (r.call_status === 'pending' || r.call_status === 'queued') {
        r.call_status = 'rejected';
      }
    }
  }
}

export function countRecipientStatuses(recipients: IRecipient[]): {
  pending: number;
  queued: number;
  in_progress: number;
  completed: number;
  failed: number;
  rejected: number;
  cancelled: number;
  skipped: number;
} {
  const counts = {
    pending: 0,
    queued: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    rejected: 0,
    cancelled: 0,
    skipped: 0,
  };
  for (const r of recipients) {
    const k = (r.call_status || 'pending') as keyof typeof counts;
    if (k in counts) {
      counts[k]++;
    } else {
      counts.pending++;
    }
  }
  return counts;
}

/** Finished calls across the full recipient list (handles resumed segments). */
export function computeGlobalFinished(batchCall: {
  segment_start_index?: number;
  total_calls_finished?: number;
  recipients: { length: number };
}): number {
  const segStart = batchCall.segment_start_index ?? 0;
  const apiFinished = batchCall.total_calls_finished ?? 0;
  return Math.min(segStart + apiFinished, batchCall.recipients.length);
}

export function applyPythonSyncToBatchCall(
  batchCall: HydratedDocument<IBatchCall>,
  python: PythonBatchPayload & {
    status: string;
    total_calls_dispatched?: number;
    total_calls_scheduled?: number;
    total_calls_finished?: number;
    last_updated_at_unix?: number;
  },
): void {
  batchCall.status = python.status as IBatchCall['status'];
  if (python.total_calls_dispatched !== undefined) {
    batchCall.total_calls_dispatched = python.total_calls_dispatched;
  }
  if (python.total_calls_scheduled !== undefined) {
    batchCall.total_calls_scheduled = python.total_calls_scheduled;
  }
  if (python.total_calls_finished !== undefined) {
    batchCall.total_calls_finished = python.total_calls_finished;
  }
  if (python.last_updated_at_unix !== undefined) {
    batchCall.last_updated_at_unix = python.last_updated_at_unix;
  }
  mergeRecipientStatuses(batchCall, python);
}
