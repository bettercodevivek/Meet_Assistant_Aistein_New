'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Download, Loader2, PhoneOutgoing, RefreshCw, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

type LeadRow = {
  _id: string;
  leadgen_id: string;
  form_id: string;
  page_id: string;
  created_time: string;
  data: Record<string, string | string[] | undefined>;
  source: string;
  created_at: string;
  batch_submitted?: boolean;
};

type LeadsResponse = {
  success: boolean;
  data: LeadRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  message?: string;
};

type SyncStatus = {
  forms_configured: number;
  forms_scanned: number;
  last_run_candidates: number;
  last_run_stored: number;
  last_run_at_unix: number;
};

type Agent = {
  _id: string;
  agent_id: string;
  name: string;
};

type PhoneNumber = {
  phone_number_id: string;
  phone_number: string;
  label: string;
};

function readField(
  data: LeadRow['data'],
  keys: string[],
): string {
  for (const key of keys) {
    const value = data?.[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value) && value.length > 0) return String(value[0] ?? '');
  }
  return '—';
}

function sanitizeCsvValue(value: string): string {
  return value.replace(/,/g, ' ').replace(/\r?\n/g, ' ').trim();
}

function leadToCsvRow(row: LeadRow): { name: string; email: string; phone_number: string } {
  return {
    name: sanitizeCsvValue(readField(row.data, ['full_name', 'name', 'first_name']) === '—' ? '' : readField(row.data, ['full_name', 'name', 'first_name'])),
    email: sanitizeCsvValue(readField(row.data, ['work_email', 'email']) === '—' ? '' : readField(row.data, ['work_email', 'email'])),
    phone_number: sanitizeCsvValue(readField(row.data, ['phone_number', 'phone']) === '—' ? '' : readField(row.data, ['phone_number', 'phone'])),
  };
}

function buildLeadsCsv(rows: LeadRow[]): string {
  const header = 'name,email,phone_number';
  const body = rows
    .map((row) => leadToCsvRow(row))
    .filter((row) => row.phone_number)
    .map((row) => `${row.name},${row.email},${row.phone_number}`)
    .join('\n');
  return `${header}\n${body}`;
}

export default function MetaLeadsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [startingBatch, setStartingBatch] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [formIdFilter, setFormIdFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [batchForm, setBatchForm] = useState({
    call_name: '',
    agent_id: '',
    phone_number_id: '',
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    forms_configured: 0,
    forms_scanned: 0,
    last_run_candidates: 0,
    last_run_stored: 0,
    last_run_at_unix: 0,
  });

  const fetchLeads = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (formIdFilter.trim()) params.set('form_id', formIdFilter.trim());
      if (dateFrom) params.set('created_time_from', `${dateFrom}T00:00:00+0000`);
      if (dateTo) params.set('created_time_to', `${dateTo}T23:59:59+0000`);
      const res = await fetch(`/api/v1/meta-leads?${params.toString()}`, { cache: 'no-store' });
      const json = (await res.json()) as LeadsResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to fetch leads');
      }
      setRows(Array.isArray(json.data) ? json.data : []);
      setTotal(json.total ?? 0);
      setTotalPages(Math.max(1, json.totalPages ?? 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch leads');
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, formIdFilter, page]);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/meta-leads/status', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json?.success) return;
      setSyncStatus({
        forms_configured: Number(json.forms_configured || 0),
        forms_scanned: Number(json.forms_scanned || 0),
        last_run_candidates: Number(json.last_run_candidates || 0),
        last_run_stored: Number(json.last_run_stored || 0),
        last_run_at_unix: Number(json.last_run_at_unix || 0),
      });
    } catch {
      // Keep current status on transient errors.
    }
  }, []);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    setError('');
    try {
      const res = await fetch('/api/v1/meta-leads/sync', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || 'Failed to run periodic sync');
      }
      await Promise.all([fetchLeads(), fetchSyncStatus()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run periodic sync');
    } finally {
      setSyncing(false);
    }
  }, [fetchLeads, fetchSyncStatus]);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    void fetchSyncStatus();
  }, [fetchSyncStatus]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchLeads();
    }, 30000);
    return () => window.clearInterval(id);
  }, [fetchLeads]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchSyncStatus();
    }, 30000);
    return () => window.clearInterval(id);
  }, [fetchSyncStatus]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, formIdFilter]);

  const pageLabel = useMemo(() => `Page ${page} of ${totalPages}`, [page, totalPages]);
  const lastSyncLabel = useMemo(() => {
    if (!syncStatus.last_run_at_unix) return 'Never';
    return new Date(syncStatus.last_run_at_unix * 1000).toLocaleString();
  }, [syncStatus.last_run_at_unix]);

  const rowsWithPhones = useMemo(() => rows.filter((row) => leadToCsvRow(row).phone_number), [rows]);

  const setDayFilter = useCallback((preset: 'today' | 'yesterday' | 'last7' | 'clear') => {
    const now = new Date();
    const toYmd = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === 'clear') {
      setDateFrom('');
      setDateTo('');
      return;
    }
    if (preset === 'today') {
      const today = toYmd(now);
      setDateFrom(today);
      setDateTo(today);
      return;
    }
    if (preset === 'yesterday') {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const y = toYmd(d);
      setDateFrom(y);
      setDateTo(y);
      return;
    }
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    setDateFrom(toYmd(from));
    setDateTo(toYmd(now));
  }, []);

  const fetchAllFilteredLeads = useCallback(async (): Promise<LeadRow[]> => {
    const out: LeadRow[] = [];
    let currentPage = 1;
    let pages = 1;
    do {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', '100');
      if (formIdFilter.trim()) params.set('form_id', formIdFilter.trim());
      if (dateFrom) params.set('created_time_from', `${dateFrom}T00:00:00+0000`);
      if (dateTo) params.set('created_time_to', `${dateTo}T23:59:59+0000`);
      const res = await fetch(`/api/v1/meta-leads?${params.toString()}`, { cache: 'no-store' });
      const json = (await res.json()) as LeadsResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to fetch all leads');
      }
      out.push(...(Array.isArray(json.data) ? json.data : []));
      pages = Math.max(1, Number(json.totalPages || 1));
      currentPage += 1;
    } while (currentPage <= pages);
    return out;
  }, [dateFrom, dateTo, formIdFilter]);

  const exportCsv = useCallback(async () => {
    setExporting(true);
    setError('');
    let allRows: LeadRow[] = rows;
    try {
      allRows = await fetchAllFilteredLeads();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export CSV');
      setExporting(false);
      return;
    }
    const csv = buildLeadsCsv(allRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meta-leads-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }, [fetchAllFilteredLeads, rows]);

  const openBatchModal = useCallback(async () => {
    setError('');
    setShowBatchModal(true);
    setBatchForm((prev) => ({
      call_name:
        prev.call_name ||
        `Meta Leads ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
      agent_id: prev.agent_id,
      phone_number_id: prev.phone_number_id,
    }));
    try {
      const [agentsRes, phoneRes] = await Promise.all([
        fetch('/api/v1/agents'),
        fetch('/api/v1/phone-numbers'),
      ]);
      const [agentsJson, phoneJson] = await Promise.all([agentsRes.json(), phoneRes.json()]);
      if (agentsJson?.success && Array.isArray(agentsJson.data)) {
        setAgents(agentsJson.data);
      }
      if (Array.isArray(phoneJson?.phone_numbers)) {
        setPhoneNumbers(phoneJson.phone_numbers);
      }
    } catch {
      setError('Could not load agents or phone numbers for batch call.');
    }
  }, []);

  const submitBatchFromLeads = useCallback(async () => {
    if (!batchForm.call_name || !batchForm.agent_id || !batchForm.phone_number_id) {
      setError('Batch call name, agent, and source phone number are required.');
      return;
    }
    let allRows: LeadRow[] = rows;
    try {
      allRows = await fetchAllFilteredLeads();
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Failed to fetch leads for batch call');
    }
    const csv = buildLeadsCsv(allRows);
    const lines = csv.trim().split('\n');
    if (lines.length <= 1) {
      setError('No valid lead phone numbers found to create a batch call.');
      return;
    }

    setStartingBatch(true);
    setError('');
    try {
      const file = new File([csv], `meta-leads-${Date.now()}.csv`, { type: 'text/csv' });
      const formData = new FormData();
      formData.append('call_name', batchForm.call_name);
      formData.append('agent_id', batchForm.agent_id);
      formData.append('phone_number_id', batchForm.phone_number_id);
      formData.append('file', file);

      const res = await fetch('/api/v1/batch-calling/submit', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.message || 'Failed to create batch call');
      }
      setShowBatchModal(false);
      router.push('/dashboard/batch-calling');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create batch call');
    } finally {
      setStartingBatch(false);
    }
  }, [batchForm, fetchAllFilteredLeads, router, rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meta Leads"
        subtitle="Webhook leads with periodic Graph API sync fallback."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void exportCsv()}
              disabled={rowsWithPhones.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-primary px-3 py-2 text-sm font-medium text-primary hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
            <button
              type="button"
              onClick={() => void openBatchModal()}
              disabled={rowsWithPhones.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PhoneOutgoing className="h-4 w-4" />
              Send to batch calling
            </button>
            <button
              type="button"
              onClick={() => void fetchLeads()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-primary px-3 py-2 text-sm font-medium text-primary hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void triggerSync()}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Run sync now
            </button>
          </div>
        }
      />

      <div className="rounded-xl border border-slate-200 bg-primary p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tertiary" htmlFor="meta-form-id-filter">
              Filter by form ID
            </label>
            <input
              id="meta-form-id-filter"
              value={formIdFilter}
              onChange={(e) => setFormIdFilter(e.target.value)}
              placeholder="e.g. 939403055570752"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tertiary" htmlFor="meta-date-from">
              From date
            </label>
            <input
              id="meta-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-tertiary" htmlFor="meta-date-to">
              To date
            </label>
            <input
              id="meta-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDayFilter('today')}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-primary hover:bg-slate-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setDayFilter('yesterday')}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-primary hover:bg-slate-50"
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => setDayFilter('last7')}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-primary hover:bg-slate-50"
          >
            Last 7 days
          </button>
          <button
            type="button"
            onClick={() => setDayFilter('clear')}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-primary hover:bg-slate-50"
          >
            Clear dates
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-primary p-4">
          <p className="text-xs uppercase tracking-wide text-tertiary">Last sync run</p>
          <p className="mt-1 text-sm font-medium text-primary">{lastSyncLabel}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-primary p-4">
          <p className="text-xs uppercase tracking-wide text-tertiary">Forms scanned</p>
          <p className="mt-1 text-xl font-semibold text-primary">
            {syncStatus.forms_scanned}
            <span className="ml-1 text-sm font-medium text-secondary">/ {syncStatus.forms_configured}</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-primary p-4">
          <p className="text-xs uppercase tracking-wide text-tertiary">Leads fetched</p>
          <p className="mt-1 text-xl font-semibold text-primary">{syncStatus.last_run_candidates}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-primary p-4">
          <p className="text-xs uppercase tracking-wide text-tertiary">Leads stored</p>
          <p className="mt-1 text-xl font-semibold text-primary">{syncStatus.last_run_stored}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-primary">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-label="Loading leads" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No Meta leads yet"
          description="When webhook events arrive or periodic sync runs, your leads will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-primary">
          <div className="border-b border-slate-100 px-4 py-3 text-sm text-secondary">
            {total} lead(s) found. {pageLabel}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-secondary">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-secondary">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-secondary">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-secondary">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-secondary">Form ID</th>
                  <th className="px-4 py-3 text-left font-medium text-secondary">Lead ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td className="whitespace-nowrap px-4 py-3 text-primary">{row.created_time || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-primary">
                      <div className="flex items-center gap-2">
                        <span>{readField(row.data, ['full_name', 'name', 'first_name'])}</span>
                        {row.batch_submitted ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            Batch submitted
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-primary">
                      {readField(row.data, ['work_email', 'email'])}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-primary">
                      {readField(row.data, ['phone_number', 'phone'])}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-secondary">{row.form_id}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-secondary">{row.leadgen_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-primary hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-secondary">{pageLabel}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-primary hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showBatchModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meta-batch-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close"
            onClick={() => setShowBatchModal(false)}
          />
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 id="meta-batch-title" className="text-lg font-semibold text-slate-900">
                  Create batch call from filtered leads
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Filtered leads will be exported and submitted to batch calling.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Batch call name</label>
                <input
                  type="text"
                  value={batchForm.call_name}
                  onChange={(e) => setBatchForm((prev) => ({ ...prev, call_name: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Agent</label>
                <select
                  value={batchForm.agent_id}
                  onChange={(e) => setBatchForm((prev) => ({ ...prev, agent_id: e.target.value }))}
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
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Source phone number</label>
                <select
                  value={batchForm.phone_number_id}
                  onChange={(e) => setBatchForm((prev) => ({ ...prev, phone_number_id: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                >
                  <option value="">Select a phone number</option>
                  {phoneNumbers.map((pn) => (
                    <option key={pn.phone_number_id} value={pn.phone_number_id}>
                      {pn.label} ({pn.phone_number})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitBatchFromLeads()}
                disabled={startingBatch}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {startingBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOutgoing className="h-4 w-4" />}
                Start batch call
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
