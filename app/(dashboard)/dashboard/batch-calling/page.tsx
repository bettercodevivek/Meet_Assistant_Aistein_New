'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  Video,
  Play,
  X,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Upload,
  ChevronRight,
  Phone,
  Users,
  RotateCcw,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';

interface BatchCall {
  _id: string;
  batch_call_id: string;
  name: string;
  call_name: string;
  agent_id: string;
  agent_name?: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  phone_number_id: string;
  phone_provider: string;
  recipients_count: number;
  total_calls_dispatched: number;
  total_calls_scheduled: number;
  total_calls_finished: number;
  global_total_finished?: number;
  created_at_unix: number;
  scheduled_time_unix: number;
  last_updated_at_unix: number;
  createdAt: string;
  updatedAt: string;
  segment_start_index?: number;
  resume_next_index?: number;
  can_resume?: boolean;
  no_answer_auto_retry_enabled?: boolean;
  no_answer_retry_interval_seconds?: number;
  no_answer_retry_max_waves?: number;
  no_answer_retry_waves_completed?: number;
  next_no_answer_retry_at_unix?: number;
  no_answer_auto_retry_in_flight?: boolean;
}

interface Agent {
  _id: string;
  agent_id: string;
  name: string;
}

interface PhoneNumber {
  phone_number_id: string;
  phone_number: string;
  label: string;
  elevenlabs_phone_number_id?: string;
}

export default function BatchCallingPage() {
  const [batchCalls, setBatchCalls] = useState<BatchCall[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'submit'>('list');
  const [detailJobId, setDetailJobId] = useState<string | null>(null);

  const fetchBatchCalls = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/batch-calling?includeCancelled=true');
      const data = await response.json();

      if (data.success) {
        setBatchCalls(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch batch calls:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/v1/agents');
      const data = await response.json();

      if (data.success) {
        setAgents(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  const fetchPhoneNumbers = async () => {
    try {
      const response = await fetch('/api/v1/phone-numbers');
      const data = await response.json();

      if (data.phone_numbers) {
        setPhoneNumbers(data.phone_numbers);
      }
    } catch (error) {
      console.error('Failed to fetch phone numbers:', error);
    }
  };

  useEffect(() => {
    void fetchBatchCalls();
    void fetchAgents();
    void fetchPhoneNumbers();
  }, []);

  // Poll while on this page (any tab). GET /api/v1/batch-calling merges Python status and runs automations for completed contacts.
  useEffect(() => {
    const id = window.setInterval(() => void fetchBatchCalls(), 3000);
    return () => window.clearInterval(id);
  }, [fetchBatchCalls]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchBatchCalls();
    };
    const onFocus = () => void fetchBatchCalls();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchBatchCalls]);

  const handleCancel = async (batch_call_id: string) => {
    if (
      !confirm(
        'Stop this batch? Remaining contacts will not be called. You can resume later from where it left off.'
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/batch-calling/${batch_call_id}/cancel`, {
        method: 'POST',
      });

      if (response.ok) {
        void fetchBatchCalls();
        setDetailJobId((id) => (id === batch_call_id ? batch_call_id : id));
      }
    } catch (error) {
      console.error('Failed to cancel batch call:', error);
    }
  };

  const handleResume = async (batch_call_id: string) => {
    try {
      const response = await fetch(`/api/v1/batch-calling/${batch_call_id}/resume`, {
        method: 'POST',
      });
      const data = await response.json();
      if (response.ok && data?.data?.batch_call_id) {
        setDetailJobId(data.data.batch_call_id);
        void fetchBatchCalls();
      } else {
        alert(data?.error?.message || data?.message || 'Could not resume batch.');
      }
    } catch (error) {
      console.error('Failed to resume batch call:', error);
      alert('Could not resume batch.');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-600" strokeWidth={1.75} />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-amber-600" strokeWidth={1.75} />;
      case 'in_progress':
        return <Play className="h-4 w-4 text-blue-600" strokeWidth={1.75} />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" strokeWidth={1.75} />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" strokeWidth={1.75} />;
      case 'cancelled':
        return <X className="h-4 w-4 text-slate-400" strokeWidth={1.75} />;
      default:
        return <AlertCircle className="h-4 w-4 text-slate-400" strokeWidth={1.75} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      case 'scheduled':
        return 'bg-amber-100 text-amber-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      case 'cancelled':
        return 'bg-slate-100 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Batch Calling"
        subtitle={
          <span>
            Manage batch calling campaigns for voice agents. When each contact&apos;s call finishes, your
            batch is synced and{' '}
            <Link href="/dashboard/automation" className="font-medium text-brand-600 hover:underline">
              automations
            </Link>{' '}
            run automatically (no manual sync needed).
          </span>
        }
        action={
          <button
            type="button"
            onClick={() => setActiveTab('submit')}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Submit Batch Call
          </button>
        }
      />

      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'list'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            Batch Calls
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('submit')}
            className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'submit'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            Submit New
          </button>
        </nav>
      </div>

      {activeTab === 'list' && (
        <>
          {batchCalls.length === 0 ? (
            <EmptyState
              icon={Video}
              title="No batch calls yet"
              description="Submit a batch call campaign to start calling multiple recipients."
            >
              <button
                type="button"
                onClick={() => setActiveTab('submit')}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Submit Batch Call
              </button>
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {batchCalls.map((batch) => {
                const total = Math.max(1, batch.recipients_count || 0);
                const rawDone = batch.global_total_finished ?? batch.total_calls_finished ?? 0;
                const done =
                  batch.status === 'completed'
                    ? batch.recipients_count
                    : Math.min(rawDone, total);
                const pct = Math.min(100, Math.round((done / total) * 100));
                const inFlight = ['pending', 'scheduled', 'in_progress'].includes(batch.status);
                const nextRetryAt = batch.next_no_answer_retry_at_unix;
                const retryScheduled =
                  typeof nextRetryAt === 'number' &&
                  nextRetryAt > 0 &&
                  batch.no_answer_auto_retry_enabled !== false;
                return (
                  <article
                    key={batch._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailJobId(batch.batch_call_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailJobId(batch.batch_call_id);
                      }
                    }}
                    className={`flex cursor-pointer flex-col rounded-xl border bg-primary p-5 text-left shadow-sm transition-all hover:border-brand-300 hover:shadow-md ${
                      inFlight ? 'border-brand-200 ring-1 ring-brand-100' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold text-primary">{batch.name}</h3>
                        <p className="mt-1 truncate text-xs text-tertiary">{batch.call_name}</p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(batch.status)}`}
                      >
                        {getStatusIcon(batch.status)}
                        {batch.status.replace('_', ' ')}
                      </span>
                    </div>

                    {inFlight ? (
                      <p className="mt-3 text-xs font-medium text-brand-700">Batch calling in progress</p>
                    ) : null}
                    {retryScheduled && !inFlight ? (
                      <p className="mt-3 text-xs text-slate-600">
                        No-answer redial scheduled{' '}
                        {typeof nextRetryAt === 'number' ? (
                          <time dateTime={new Date(nextRetryAt * 1000).toISOString()}>
                            {new Date(nextRetryAt * 1000).toLocaleString()}
                          </time>
                        ) : null}
                      </p>
                    ) : null}
                    {batch.no_answer_auto_retry_in_flight ? (
                      <p className="mt-1 text-xs font-medium text-brand-800">Auto-retry wave running…</p>
                    ) : null}

                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Agent</span>
                        <span className="truncate font-medium text-primary">
                          {batch.agent_name || batch.agent_id}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Contacts</span>
                        <span className="font-medium text-primary">{batch.recipients_count}</span>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-slate-600">Progress</span>
                          <span className="font-medium text-primary">
                            {done} / {total}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand-600 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <footer className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
                      {batch.can_resume ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleResume(batch.batch_call_id);
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700"
                        >
                          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                          Resume
                        </button>
                      ) : null}
                      {inFlight ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleCancel(batch.batch_call_id);
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                          Cancel batch
                        </button>
                      ) : null}
                      <span className="text-xs text-tertiary">Open details</span>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'submit' && (
        <SubmitForm
          agents={agents}
          phoneNumbers={phoneNumbers}
          onSuccess={() => {
            void fetchBatchCalls();
            setActiveTab('list');
          }}
        />
      )}

      {detailJobId ? (
        <BatchDetailModal
          jobId={detailJobId}
          onClose={() => setDetailJobId(null)}
          onCancel={handleCancel}
          onResume={handleResume}
        />
      ) : null}
    </div>
  );
}

function recipientStatusStyle(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-800';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800';
    case 'queued':
      return 'bg-amber-100 text-amber-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'rejected':
      return 'bg-orange-100 text-orange-900';
    case 'cancelled':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function BatchDetailModal({
  jobId,
  onClose,
  onCancel,
  onResume,
}: {
  jobId: string;
  onClose: () => void;
  onCancel: (id: string) => void | Promise<void>;
  onResume: (id: string) => void | Promise<void>;
}) {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/batch-calling/${jobId}`);
      if (res.ok) {
        const j = (await res.json()) as Record<string, unknown>;
        setPayload(j);
      }
    } catch {
      /* ignore */
    }
  }, [jobId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const recipients = (payload?.recipients as Array<Record<string, unknown>>) || [];
  const status = String(payload?.status || '');
  const total = Math.max(
    0,
    Number(payload?.recipients_count || recipients.length || 0)
  );
  const rawDone = Number(payload?.global_total_finished ?? payload?.total_calls_finished ?? 0);
  const done =
    total <= 0
      ? 0
      : status === 'completed'
        ? total
        : Math.min(rawDone, total);
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const canResume = Boolean(payload?.can_resume);
  const inFlight = ['pending', 'scheduled', 'in_progress'].includes(status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id="batch-detail-title" className="truncate text-lg font-semibold text-slate-900">
              {String(payload?.name || 'Batch call')}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">{String(payload?.call_name || '')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {status.replace('_', ' ')}
              </span>
              {inFlight ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Live updates
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-slate-600">Overall progress</span>
            <span className="font-semibold text-slate-900">
              {done} / {total} contacts
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Each row shows this contact’s call status. Cancel anytime; you can resume from the next
            contact later.
          </p>
          {(() => {
            const enabled = payload?.no_answer_auto_retry_enabled !== false;
            const nextAt = Number(payload?.next_no_answer_retry_at_unix || 0);
            const wavesDone = Number(payload?.no_answer_retry_waves_completed ?? 0);
            const maxWaves = Number(payload?.no_answer_retry_max_waves ?? 3);
            const inRetryFlight = Boolean(payload?.no_answer_auto_retry_in_flight);
            if (!enabled) return null;
            return (
              <div className="mt-3 rounded-lg border border-brand-100 bg-brand-50/80 px-3 py-2 text-xs text-slate-700">
                <p className="font-medium text-brand-900">No-answer auto-redial</p>
                <p className="mt-1">
                  Waves completed: {wavesDone} / {maxWaves} (not counting the first list run)
                </p>
                {inRetryFlight ? (
                  <p className="mt-1 font-medium text-brand-800">A redial wave is in progress.</p>
                ) : null}
                {nextAt > 0 ? (
                  <p className="mt-1">
                    Next scheduled attempt:{' '}
                    <time dateTime={new Date(nextAt * 1000).toISOString()}>
                      {new Date(nextAt * 1000).toLocaleString()}
                    </time>
                  </p>
                ) : null}
              </div>
            );
          })()}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-2 py-2 sm:px-4">
          {!payload ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-label="Loading" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2.5 font-medium text-slate-600">#</th>
                    <th className="px-3 py-2.5 font-medium text-slate-600">Name</th>
                    <th className="px-3 py-2.5 font-medium text-slate-600">Phone</th>
                    <th className="px-3 py-2.5 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((row) => (
                    <tr key={String(row.index)} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2.5 text-slate-500">{Number(row.index) + 1}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">{String(row.name || '—')}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-700">
                        {String(row.phone_number || '')}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${recipientStatusStyle(String(row.call_status || 'pending'))}`}
                        >
                          {String(row.call_status || 'pending').replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          {canResume ? (
            <button
              type="button"
              onClick={() => void onResume(jobId)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Resume batch call
            </button>
          ) : null}
          {inFlight ? (
            <button
              type="button"
              onClick={() => void onCancel(jobId)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Cancel batch
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SubmitForm({
  agents,
  phoneNumbers,
  onSuccess,
}: {
  agents: Agent[];
  phoneNumbers: PhoneNumber[];
  onSuccess: () => void;
}) {
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState({
    call_name: '',
    phone_number_id: '',
    agent_id: '',
    file: null as File | null,
    recipients: [] as any[],
    no_answer_auto_retry_enabled: true,
    no_answer_retry_interval_minutes: 5,
    no_answer_retry_max_waves: 3,
  });
  const [testCall, setTestCall] = useState({
    phone_number: '',
    customer_name: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const outboundPhoneNumbers = phoneNumbers.filter((pn) => {
    const phoneNumber = phoneNumbers.find((p) => p.phone_number_id === pn.phone_number_id);
    return phoneNumber?.elevenlabs_phone_number_id || true;
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, file });
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setFormData({
      call_name: '',
      phone_number_id: '',
      agent_id: '',
      file: null,
      recipients: [],
      no_answer_auto_retry_enabled: true,
      no_answer_retry_interval_minutes: 5,
      no_answer_retry_max_waves: 3,
    });
  };

  const handleSubmit = async () => {
    if (!formData.call_name || !formData.phone_number_id || !formData.agent_id) {
      alert('Please fill in all required fields');
      return;
    }

    if (!formData.file && formData.recipients.length === 0) {
      alert('Please upload a recipients file');
      return;
    }

    setSaving(true);

    try {
      const submitFormData = new FormData();
      submitFormData.append('call_name', formData.call_name);
      submitFormData.append('phone_number_id', formData.phone_number_id);
      submitFormData.append('agent_id', formData.agent_id);
      if (formData.file) {
        submitFormData.append('file', formData.file);
      }
      submitFormData.append(
        'no_answer_auto_retry_enabled',
        formData.no_answer_auto_retry_enabled ? 'true' : 'false',
      );
      submitFormData.append(
        'no_answer_retry_interval_minutes',
        String(formData.no_answer_retry_interval_minutes),
      );
      submitFormData.append(
        'no_answer_retry_max_waves',
        String(formData.no_answer_retry_max_waves),
      );

      const response = await fetch('/api/v1/batch-calling/submit', {
        method: 'POST',
        body: submitFormData,
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        resetWizard();
        onSuccess();
      } else {
        alert(data?.error?.message || data?.message || 'Failed to submit batch call');
      }
    } catch (error) {
      console.error('Failed to submit batch call:', error);
      alert('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleTestCall = async () => {
    if (!testCall.phone_number || !testCall.customer_name) {
      alert('Please fill in phone number and customer name for test call');
      return;
    }

    setTesting(true);

    try {
      const response = await fetch('/api/v1/batch-calling/test-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: formData.phone_number_id,
          agent_id: formData.agent_id,
          phone_number: testCall.phone_number,
          customer_name: testCall.customer_name,
          email: testCall.email,
        }),
      });

      if (response.ok) {
        alert('Test call initiated successfully');
      } else {
        alert('Failed to initiate test call');
      }
    } catch (error) {
      console.error('Failed to initiate test call:', error);
      alert('An error occurred');
    } finally {
      setTesting(false);
    }
  };

  const steps = [
    { n: 1, label: 'Upload list' },
    { n: 2, label: 'Agent & number' },
    { n: 3, label: 'Review & start' },
  ] as const;

  return (
    <div className="max-w-4xl rounded-xl border border-slate-200 bg-primary p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-brand-600" strokeWidth={1.75} aria-hidden />
          <h3 className="text-lg font-semibold text-primary">New batch call</h3>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium text-slate-600">
          {steps.map((s) => (
            <span
              key={s.n}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                wizardStep === s.n ? 'bg-white text-slate-900 shadow-sm' : ''
              }`}
            >
              {s.n}. {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {wizardStep === 1 && (
          <>
            <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4">
              <div className="flex items-start gap-3">
                <Upload className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.75} aria-hidden />
                <div>
                  <p className="text-sm font-medium text-slate-900">Step 1 — Upload CSV or Excel</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Include a header row. Required column: <code className="rounded bg-white px-1">phone_number</code>{' '}
                    or <code className="rounded bg-white px-1">phone</code>. Optional: name, email, customer_* fields.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center transition-colors hover:border-brand-300">
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileUpload}
                className="mx-auto block w-full max-w-md text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
              />
              <p className="mt-3 text-xs text-tertiary">.csv, .xls, or .xlsx · up to ~25 MB</p>
              {formData.file ? (
                <p className="mt-2 text-sm font-medium text-slate-800">Selected: {formData.file.name}</p>
              ) : null}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-sm font-medium text-slate-700">Example columns</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[520px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-3 py-2 text-left font-medium text-slate-600">name</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">email</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">phone_number</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-600">John Doe</td>
                      <td className="px-3 py-2 text-slate-600">john@example.com</td>
                      <td className="px-3 py-2 text-slate-600">15551234567</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => resetWizard()}
                className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Reset
              </button>
              <button
                type="button"
                disabled={!formData.file}
                onClick={() => formData.file && setWizardStep(2)}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          </>
        )}

        {wizardStep === 2 && (
          <>
            <div className="grid gap-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                  Campaign name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Q1 outreach"
                  value={formData.call_name}
                  onChange={(e) => setFormData({ ...formData, call_name: e.target.value })}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-slate-600">
                  <Phone className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  Source phone number <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.phone_number_id}
                  onChange={(e) => setFormData({ ...formData, phone_number_id: e.target.value })}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                >
                  <option value="">Select a phone number</option>
                  {outboundPhoneNumbers.map((pn) => (
                    <option key={pn.phone_number_id} value={pn.phone_number_id}>
                      {pn.label} ({pn.phone_number})
                    </option>
                  ))}
                </select>
                {outboundPhoneNumbers.length === 0 ? (
                  <p className="mt-1 text-xs text-amber-600">Add an outbound-capable number first.</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-slate-600">
                  <Users className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  Agent <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.agent_id}
                  onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                >
                  <option value="">Select an agent</option>
                  {agents.map((agent) => (
                    <option key={agent._id} value={agent.agent_id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={formData.no_answer_auto_retry_enabled}
                    onChange={(e) =>
                      setFormData({ ...formData, no_answer_auto_retry_enabled: e.target.checked })
                    }
                  />
                  <span>
                    <span className="text-sm font-medium text-slate-900">
                      Auto-redial no-answer and failed numbers
                    </span>
                    <span className="mt-1 block text-xs text-slate-600">
                      After each wave completes, wait the interval below, then call again everyone who
                      did not pick up (or failed), until the max rounds are reached or everyone is
                      reached.
                    </span>
                  </span>
                </label>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Wait between redial waves (minutes)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={formData.no_answer_retry_interval_minutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          no_answer_retry_interval_minutes: Math.max(
                            1,
                            Math.min(1440, parseInt(e.target.value, 10) || 5),
                          ),
                        })
                      }
                      disabled={!formData.no_answer_auto_retry_enabled}
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Max automatic redial waves
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={formData.no_answer_retry_max_waves}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          no_answer_retry_max_waves: Math.max(
                            0,
                            Math.min(50, parseInt(e.target.value, 10) || 0),
                          ),
                        })
                      }
                      disabled={!formData.no_answer_auto_retry_enabled}
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Does not include the first CSV run. Use 0 to disable redials.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-sm font-medium text-slate-700">Optional test call</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
                  <input
                    type="tel"
                    placeholder="+1234567890"
                    value={testCall.phone_number}
                    onChange={(e) => setTestCall({ ...testCall, phone_number: e.target.value })}
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
                  <input
                    type="text"
                    value={testCall.customer_name}
                    onChange={(e) => setTestCall({ ...testCall, customer_name: e.target.value })}
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
                  <input
                    type="email"
                    value={testCall.email}
                    onChange={(e) => setTestCall({ ...testCall, email: e.target.value })}
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleTestCall()}
                  disabled={testing || !formData.phone_number_id || !formData.agent_id}
                  className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {testing ? 'Calling…' : 'Run test call'}
                </button>
              </div>
            </div>

            <div className="flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setWizardStep(3)}
                disabled={!formData.call_name || !formData.phone_number_id || !formData.agent_id}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          </>
        )}

        {wizardStep === 3 && (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Ready to start</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>
                  <span className="text-slate-500">File:</span>{' '}
                  <span className="font-medium">{formData.file?.name}</span>
                </li>
                <li>
                  <span className="text-slate-500">Campaign:</span>{' '}
                  <span className="font-medium">{formData.call_name}</span>
                </li>
                <li>
                  <span className="text-slate-500">Agent:</span>{' '}
                  <span className="font-medium">
                    {agents.find((a) => a.agent_id === formData.agent_id)?.name || formData.agent_id}
                  </span>
                </li>
                <li>
                  <span className="text-slate-500">From:</span>{' '}
                  <span className="font-medium">
                    {outboundPhoneNumbers.find((p) => p.phone_number_id === formData.phone_number_id)
                      ?.label || '—'}
                  </span>
                </li>
              </ul>
              <p className="mt-4 text-xs text-slate-500">
                Contacts are validated on the server. After starting, track progress on the batch
                cards; open a card to see every contact’s status. You can cancel and resume later —
                calling continues from the next contact after the last completed one. If you enabled
                auto-redial, numbers that did not answer are called again after your interval until max
                waves are used.
              </p>
            </div>
            <div className="flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-6 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Starting…
                  </>
                ) : (
                  'Start batch call'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

