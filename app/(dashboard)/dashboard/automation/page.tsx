'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Plus,
  X,
  Zap,
  ChevronRight,
  Trash2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  DEFAULT_APPOINTMENT_SHEET_COLUMNS,
  parseGoogleSpreadsheetId,
} from '@/lib/utils/googleSheetsAutomation';

type FlowNode = {
  id: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
};

/** Shown in the UI and prefilled when using the prebuilt flow. */
const PREBUILT_APPOINTMENT_BOOKING_NAME = 'Appointment booking';

const PREBUILT_APPOINTMENT_BOOKING_DESCRIPTION =
  'After each completed batch call: extract appointment details from the transcript, create a MeetAssistant join link (same assistant context as the call), append contact + extraction + meet URL to Google Sheets, then email that link to the contact.';

/** JSON example sent to the extract API so the model returns consistent fields. */
const APPOINTMENT_JSON_EXAMPLE = {
  appointment_booked: true,
  date: '2026-04-22',
  time: '14:30',
  confidence: 'high',
};

const APPOINTMENT_EXTRACT_PROMPT = `From the phone call transcript, decide if an appointment was booked.

Extract only scheduling fields (contact name/email/phone come from the uploaded file, not from the call):
- appointment_booked: boolean
- date: YYYY-MM-DD if stated or clearly inferable, else empty string
- time: HH:mm (24h) if stated, else empty string
- confidence: one of high, medium, low

Respond using the same field names and types as the example JSON.`;

function appointmentTemplateNodes(): FlowNode[] {
  return [
    {
      id: 'trigger',
      type: 'trigger',
      label: 'When a batch call completes',
      config: { type: 'batch_call_completed' },
    },
    {
      id: 'extract',
      type: 'aistein_extract_data',
      label: 'Extract appointment from the call',
      config: {
        type: 'aistein_extract_data',
        extraction_type: 'appointment',
        extraction_prompt: APPOINTMENT_EXTRACT_PROMPT,
        json_example: APPOINTMENT_JSON_EXAMPLE,
      },
    },
    {
      id: 'condition',
      type: 'flow_condition',
      label: 'Condition — booking confirmed',
      config: {
        kind: 'booking_gate',
        description:
          'Downstream steps run when extraction returns appointment_booked and date/time. Contact fields always come from your CSV.',
      },
    },
    {
      id: 'review',
      type: 'flow_review_extracted',
      label: 'Review extracted booking (date & time from call)',
      config: { kind: 'extracted_preview' },
    },
    {
      id: 'meet',
      type: 'aistein_create_app_meeting',
      label: 'Create MeetAssistant link (same knowledge base)',
      config: {
        type: 'aistein_create_app_meeting',
        knowledge_base_id: '',
        avatar_id: '',
        title: 'Appointment — {{contact.name}}',
        language: 'en',
        is_reusable: false,
      },
    },
    {
      id: 'sheet',
      type: 'aistein_google_sheet_append_row',
      label: 'Append booking to Google Sheet',
      config: {
        type: 'aistein_google_sheet_append_row',
        spreadsheet_id: '',
        spreadsheet_url: '',
        sheet_tab: 'Sheet1',
        range: 'Sheet1!A:Z',
        values: DEFAULT_APPOINTMENT_SHEET_COLUMNS,
      },
    },
    {
      id: 'email',
      type: 'aistein_send_email',
      label: 'Send email with meet link',
      config: {
        type: 'aistein_send_email',
        to: '{{contact.email}}',
        subject: 'Your appointment - join link inside',
        body:
          '<p>Hi {{contact.name}},</p><p>Thank you for booking. Join your MeetAssistant session here (same knowledge base and assistant as on the call):</p><p><a href="{{app_meeting.shareUrl}}">{{app_meeting.shareUrl}}</a></p><p>See you there.</p>',
      },
    },
  ];
}

function prebuiltAutomationFormData() {
  return {
    name: PREBUILT_APPOINTMENT_BOOKING_NAME,
    description: PREBUILT_APPOINTMENT_BOOKING_DESCRIPTION,
    nodes: appointmentTemplateNodes() as FlowNode[],
  };
}

function emptyCustomAutomationFormData() {
  return {
    name: '',
    description: '',
    nodes: appointmentTemplateNodes() as FlowNode[],
  };
}

/** Rebuild flow editor state from a saved automation (trigger + actions only). */
function automationRecordToFormData(automation: {
  name?: string;
  description?: string;
  trigger?: { type?: string };
  actions?: Array<{ type: string; config?: Record<string, unknown> }>;
}): { name: string; description: string; nodes: FlowNode[] } {
  const triggerType =
    automation.trigger && typeof automation.trigger.type === 'string'
      ? automation.trigger.type
      : 'batch_call_completed';

  const nodes: FlowNode[] = [
    {
      id: 'trigger',
      type: 'trigger',
      label: 'When a batch call completes',
      config: { type: triggerType },
    },
  ];

  const actionLabels: Record<string, string> = {
    aistein_extract_data: 'Extract appointment from the call',
    aistein_google_sheet_append_row: 'Append booking to Google Sheet',
    aistein_create_app_meeting: 'Create MeetAssistant link (same knowledge base)',
    aistein_send_email: 'Send email with meet link',
    aistein_google_calendar_create_event: 'Google Calendar + Meet',
  };

  let i = 0;
  for (const action of automation.actions || []) {
    const cfg = {
      ...(action.config && typeof action.config === 'object' ? action.config : {}),
    } as Record<string, unknown>;
    if (!cfg.type) cfg.type = action.type;
    nodes.push({
      id: `saved_${i}_${action.type}`,
      type: action.type,
      label: actionLabels[action.type] || action.type,
      config: cfg,
    });
    i++;
  }

  return {
    name: automation.name || '',
    description: typeof automation.description === 'string' ? automation.description : '',
    nodes,
  };
}

type AutomationActivityStep = {
  type: string;
  label: string;
  status: 'completed' | 'skipped' | 'failed';
  detail?: string;
  at: string;
};

type AutomationActivityRun = {
  automationId?: string;
  automationName?: string;
  ranAt?: string;
  steps: AutomationActivityStep[];
};

type AutomationActivityItem = {
  conversationId: string;
  batchCallId?: string;
  phone?: string;
  contactName?: string;
  contactEmail?: string;
  ranAt: string;
  automationRuns: AutomationActivityRun[];
};

export default function AutomationPage() {
  const [automations, setAutomations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<AutomationActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(() => prebuiltAutomationFormData());
  const [showNodeConfig, setShowNodeConfig] = useState(false);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<{ id: string; name: string }[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<'automations' | 'logs'>('automations');
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null);

  const fetchAutomations = async () => {
    try {
      const response = await fetch('/api/v1/automations');
      const data = await response.json();
      if (data.success) {
        setAutomations(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch automations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAutomations();
  }, []);

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const response = await fetch('/api/v1/automations/activity?limit=25');
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setActivity(data.data as AutomationActivityItem[]);
      }
    } catch (error) {
      console.error('Failed to fetch automation activity:', error);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    const t = window.setInterval(() => void fetchActivity(), 8000);
    return () => window.clearInterval(t);
  }, [fetchActivity]);

  const handleDeleteAutomation = async (id: string, name: string) => {
    if (
      !confirm(
        `Delete automation “${name}”? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingId(id);
    try {
      const response = await fetch(`/api/v1/automations/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setAutomations((prev) => prev.filter((a) => a._id !== id));
      } else {
        alert(data?.message || 'Could not delete automation.');
      }
    } catch {
      alert('Could not delete automation.');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/knowledge-bases');
        const data = await res.json();
        if (data.success && Array.isArray(data.knowledgeBases)) {
          setKnowledgeBases(
            data.knowledgeBases.map((k: { id: string; name: string }) => ({
              id: k.id,
              name: k.name,
            })),
          );
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const closeAutomationModal = () => {
    setShowCreateModal(false);
    setEditingAutomationId(null);
  };

  const handleSaveAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const actions = formData.nodes
        .filter(
          (n) =>
            n.type !== 'trigger' &&
            n.type !== 'flow_review_extracted' &&
            n.type !== 'flow_condition',
        )
        .map((n) => ({
          type: n.config.type as string,
          config: n.config,
        }));

      const payload = {
        name: formData.name,
        description: formData.description,
        trigger: formData.nodes[0].config,
        actions,
      };

      const isEdit = Boolean(editingAutomationId);
      const response = await fetch(
        isEdit ? `/api/v1/automations/${editingAutomationId}` : '/api/v1/automations',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (data.success) {
        setFormData(emptyCustomAutomationFormData());
        closeAutomationModal();
        void fetchAutomations();
        void fetchActivity();
      } else {
        alert(data?.message || 'Could not save automation.');
      }
    } catch (error) {
      console.error('Failed to save automation:', error);
      alert('Could not save automation.');
    } finally {
      setSaving(false);
    }
  };

  const addNode = (type: string, label: string) => {
    const base =
      type === 'aistein_extract_data'
        ? {
            type: 'aistein_extract_data',
            extraction_type: 'appointment',
            extraction_prompt: APPOINTMENT_EXTRACT_PROMPT,
            json_example: APPOINTMENT_JSON_EXAMPLE,
          }
        : type === 'aistein_google_sheet_append_row'
          ? {
              type: 'aistein_google_sheet_append_row',
              spreadsheet_id: '',
              spreadsheet_url: '',
              sheet_tab: 'Sheet1',
              range: 'Sheet1!A:Z',
              values: DEFAULT_APPOINTMENT_SHEET_COLUMNS.slice(0, 4),
            }
          : type === 'aistein_google_calendar_create_event'
            ? {
                type: 'aistein_google_calendar_create_event',
                summary: 'Call — {{contact.name}}',
                description: '',
                startTime: '',
                endTime: '',
                timeZone: 'UTC',
              }
            : type === 'aistein_create_app_meeting'
              ? {
                  type: 'aistein_create_app_meeting',
                  knowledge_base_id: '',
                  avatar_id: '',
                  title: 'Appointment — {{contact.name}}',
                  language: 'en',
                  is_reusable: false,
                }
              : type === 'aistein_send_email'
                ? {
                    type: 'aistein_send_email',
                    to: '{{contact.email}}',
                    subject: '',
                    body: '',
                  }
                : type === 'flow_review_extracted'
                  ? { kind: 'extracted_preview' }
                  : type === 'flow_condition'
                    ? {
                        kind: 'booking_gate',
                        description:
                          'Visual step — backend uses extract + CSV. Remove if you do not need a gate.',
                      }
                    : { type };

    const newNode: FlowNode = {
      id: `node_${Date.now()}`,
      type,
      label,
      config: base,
    };
    setFormData({ ...formData, nodes: [...formData.nodes, newNode] });
  };

  const removeNode = (nodeId: string) => {
    setFormData({
      ...formData,
      nodes: formData.nodes.filter((n) => n.id !== nodeId),
    });
  };

  const openNodeConfig = (node: FlowNode) => {
    setSelectedNode(node);
    setShowNodeConfig(true);
  };

  const updateNodeConfig = (config: Record<string, unknown>) => {
    if (!selectedNode) return;
    setFormData({
      ...formData,
      nodes: formData.nodes.map((n) =>
        n.id === selectedNode.id ? { ...n, config } : n,
      ),
    });
    setShowNodeConfig(false);
    setSelectedNode(null);
  };

  const availableActions = [
    {
      type: 'aistein_extract_data',
      label: 'Extract appointment',
      icon: '📅',
    },
    {
      type: 'flow_condition',
      label: 'Condition (visual)',
      icon: '🔀',
    },
    {
      type: 'flow_review_extracted',
      label: 'Review extracted booking (visual)',
      icon: '👀',
    },
    {
      type: 'aistein_google_sheet_append_row',
      label: 'Google Sheets — append row',
      icon: '📊',
    },
    {
      type: 'aistein_create_app_meeting',
      label: 'MeetAssistant — create join link',
      icon: '🔗',
    },
    {
      type: 'aistein_google_calendar_create_event',
      label: 'Google Calendar + Meet',
      icon: '🗓️',
    },
    { type: 'aistein_send_email', label: 'Gmail — send email', icon: '📧' },
  ];

  const getNodeIcon = (type: string): string => {
    const action = availableActions.find((a) => a.type === type);
    return action?.icon || '⚙️';
  };

  const isGoogleAction = (type: string): boolean => {
    return (
      type.includes('google') ||
      type === 'aistein_send_email' ||
      type === 'aistein_create_app_meeting'
    );
  };

  return (
    <div>
      <PageHeader
        title="Automation"
        subtitle="Prebuilt: after a batch call completes, extract the appointment → create a MeetAssistant join link → append row to Sheets (including the meet URL) → email the guest."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingAutomationId(null);
                setFormData(prebuiltAutomationFormData());
                setShowCreateModal(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Zap className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Appointment booking (prebuilt)
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingAutomationId(null);
                setFormData(emptyCustomAutomationFormData());
                setShowCreateModal(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-primary px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Custom automation
            </button>
          </div>
        }
      />

      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-6" aria-label="Automation sections">
          <button
            type="button"
            onClick={() => setMainTab('automations')}
            className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              mainTab === 'automations'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            Automations
          </button>
          <button
            type="button"
            onClick={() => {
              setMainTab('logs');
              void fetchActivity();
            }}
            className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              mainTab === 'logs'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            Run logs
          </button>
        </nav>
      </div>

      {mainTab === 'automations' ? (
        <>
          <div className="mb-6 rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50/90 to-slate-50 p-5 text-sm text-secondary shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-base font-semibold text-primary">Prebuilt flow: Appointment booking</p>
                <p className="mt-1 text-xs text-tertiary">
                  Same structure as batch-call → extract → condition → Sheet → Meet → email. Configure Google
                  Sheet (paste URL), KB, and avatar in the editor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingAutomationId(null);
                  setFormData(prebuiltAutomationFormData());
                  setShowCreateModal(true);
                }}
                className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 sm:mt-0"
              >
                Open prebuilt editor
              </button>
            </div>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">
              <li>
                <span className="font-medium text-primary">Trigger</span> — batch call completes (sync picks
                up the conversation).
              </li>
              <li>
                <span className="font-medium text-primary">Extract</span> — appointment fields from transcript
                (Python extract API, or OpenAI fallback).
              </li>
              <li>
                <span className="font-medium text-primary">Condition</span> — visual gate (CSV contact + extracted
                fields drive Sheet columns).
              </li>
              <li>
                <span className="font-medium text-primary">Review</span> — date/time from the call; name/email/phone
                from CSV.
              </li>
              <li>
                <span className="font-medium text-primary">Google Sheet</span> — append row (paste spreadsheet
                link or ID, map columns).
              </li>
              <li>
                <span className="font-medium text-primary">MeetAssistant</span> — join link with your knowledge
                base.
              </li>
              <li>
                <span className="font-medium text-primary">Gmail</span> — send{' '}
                <code className="rounded bg-white/80 px-1 py-0.5 text-xs text-slate-800 shadow-sm">
                  {'{{meeting_link}}'}
                </code>{' '}
                to the contact.
              </li>
            </ol>
            <p className="mt-3 text-xs text-tertiary">
              Connect Google Workspace + Gmail under Integrations. Add optional env defaults on the server for
              Sheet ID and avatar if you prefer not to store them in the flow.
            </p>
          </div>

          {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-label="Loading" />
        </div>
      ) : automations.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No automations yet"
          description="Start with the prebuilt appointment booking flow (extract → Sheet → MeetAssistant → email), or build a custom automation."
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingAutomationId(null);
                setFormData(prebuiltAutomationFormData());
                setShowCreateModal(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Zap className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Use prebuilt appointment flow
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingAutomationId(null);
                setFormData(emptyCustomAutomationFormData());
                setShowCreateModal(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-primary px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Custom automation
            </button>
          </div>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {automations.map((automation) => (
            <article
              key={automation._id}
              className="flex flex-col rounded-xl border border-slate-200 bg-primary p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-primary">{automation.name}</h3>
                  <p className="mt-1 text-xs text-tertiary">{automation.trigger?.type}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                      automation.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {automation.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAutomationId(String(automation._id));
                      setFormData(automationRecordToFormData(automation));
                      setShowCreateModal(true);
                    }}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label={`Edit ${automation.name}`}
                    title="Edit flow — choose Google Sheet, extract, email"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleDeleteAutomation(
                        String(automation._id),
                        String(automation.name || 'Automation'),
                      )
                    }
                    disabled={deletingId === String(automation._id)}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    aria-label={`Delete ${automation.name}`}
                    title="Delete automation"
                  >
                    {deletingId === String(automation._id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    )}
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-sm text-slate-600">
                  {automation.actions?.length || 0} actions configured
                </p>
                <p className="mt-2 text-xs text-tertiary">
                  Click the pencil to set spreadsheet, tab, and column mapping.
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
        </>
      ) : (
        <div className="mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-primary">Run logs</h2>
              <p className="mt-1 text-xs text-secondary">
                One card per completed batch call contact. Green = done, amber = skipped, red = failed. Name,
                phone, and email come from your CSV.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchActivity()}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              Refresh
            </button>
          </div>
          {activityLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-label="Loading activity" />
            </div>
          ) : activity.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
              <p className="text-sm text-tertiary">
                No runs yet. Finish a batch call — logs appear here automatically when sync runs.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activity.map((row) => (
                <article
                  key={row.conversationId}
                  className="flex flex-col rounded-xl border border-slate-200 bg-primary p-5 shadow-sm"
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-primary">
                      {row.contactName || '—'}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-tertiary">{row.phone || '—'}</p>
                    {row.contactEmail ? (
                      <p className="mt-0.5 truncate text-xs text-tertiary">{row.contactEmail}</p>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs text-tertiary">
                    Batch{' '}
                    <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
                      {row.batchCallId || '—'}
                    </code>
                    <span className="block pt-1">
                      {row.ranAt ? new Date(row.ranAt).toLocaleString() : ''}
                    </span>
                  </p>
                  <div className="mt-4 flex-1 space-y-3 border-t border-slate-100 pt-4">
                    {(row.automationRuns || []).map((run, ri) => (
                      <div key={`${row.conversationId}-${ri}`}>
                        <p className="text-xs font-semibold text-slate-800">
                          {run.automationName || 'Automation'}
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {(run.steps || []).map((step, si) => (
                            <li
                              key={`${step.type}-${si}-${step.at}`}
                              className="flex items-start gap-2 text-xs"
                            >
                              {step.status === 'completed' ? (
                                <CheckCircle2
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                                  aria-hidden
                                />
                              ) : step.status === 'failed' ? (
                                <AlertCircle
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600"
                                  aria-hidden
                                />
                              ) : (
                                <Circle
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
                                  aria-hidden
                                />
                              )}
                              <span>
                                <span
                                  className={
                                    step.status === 'completed'
                                      ? 'text-emerald-900'
                                      : step.status === 'failed'
                                        ? 'text-red-900'
                                        : 'text-amber-900'
                                  }
                                >
                                  {step.label}
                                </span>
                                {step.detail ? (
                                  <span className="block text-[11px] leading-snug text-slate-600">
                                    {step.detail}
                                  </span>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-primary">
                {editingAutomationId ? 'Edit automation' : 'Create automation'}
              </h3>
              <button
                type="button"
                onClick={closeAutomationModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <form onSubmit={handleSaveAutomation}>
              <div className="space-y-6">
                {formData.name.trim() === PREBUILT_APPOINTMENT_BOOKING_NAME ? (
                  <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-950">
                    <p className="font-semibold">Prebuilt flow loaded</p>
                    <p className="mt-1 text-xs leading-relaxed text-brand-900/90">
                      Extract → review → Google Sheet → MeetAssistant (your KB) → Gmail with{' '}
                      <code className="rounded bg-white/80 px-1 py-0.5 text-[11px]">{'{{meeting_link}}'}</code>.
                      Fill spreadsheet ID, knowledge base, and avatar ID, then save.
                    </p>
                  </div>
                ) : null}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    Automation name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="Appointment booking"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    Description (optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="Runs after each completed batch call"
                    rows={2}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prebuiltAutomationFormData())}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-100"
                  >
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    Reset to prebuilt appointment flow
                  </button>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-700">Flow</h4>
                  <p className="mb-4 text-xs leading-relaxed text-slate-600">
                    Click an action row to configure it. For{' '}
                    <span className="font-medium text-slate-800">Google Sheets</span>, paste your spreadsheet
                    URL or ID, set the tab name, then map columns (including{' '}
                    <code className="rounded bg-white px-1 text-[11px]">{'{{extracted.date}}'}</code>).
                  </p>
                  <div className="space-y-2">
                    {formData.nodes.map((node, index) => (
                      <div key={node.id} className="relative">
                        <div className="flex items-start gap-3">
                          {index > 0 && (
                            <div className="ml-6 h-8 w-0.5 bg-slate-300" aria-hidden />
                          )}
                          <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-brand-200">
                            {node.type === 'trigger' ||
                            node.type === 'flow_review_extracted' ||
                            node.type === 'flow_condition' ? (
                              <div className="min-w-0 flex-1 p-4 text-left">
                                <div className="flex items-start gap-4">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl">
                                    {node.type === 'trigger' ? '📤' : getNodeIcon(node.type)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-medium text-slate-900">{node.label}</p>
                                      {node.type === 'trigger' ? (
                                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                          Trigger
                                        </span>
                                      ) : node.type === 'flow_condition' ? (
                                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                                          Condition
                                        </span>
                                      ) : (
                                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                                          Preview
                                        </span>
                                      )}
                                    </div>
                                    {node.type === 'trigger' && (
                                      <p className="mt-1 text-xs text-slate-500">
                                        Fires when a batch call finishes and sync runs
                                      </p>
                                    )}
                                    {node.type === 'flow_condition' && (
                                      <p className="mt-1 text-xs text-slate-500">
                                        Visual only — not sent to the server. Use extract + Sheet columns to
                                        enforce booking data.
                                      </p>
                                    )}
                                    {node.type === 'flow_review_extracted' && (
                                      <p className="mt-1 text-xs text-slate-500">
                                        After a call, extracted fields (date, time, name) appear in logs and
                                        drive the next steps.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="min-w-0 flex-1 p-4 text-left outline-none transition hover:bg-slate-50/80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/35"
                                onClick={() => openNodeConfig(node)}
                              >
                                <div className="flex items-start gap-4">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl">
                                    {getNodeIcon(node.type)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-medium text-slate-900">{node.label}</p>
                                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                        Step {index}
                                      </span>
                                    </div>
                                    {isGoogleAction(node.type) && (
                                      <p className="mt-1 text-xs text-slate-500">
                                        Uses your connected Google account • Click to configure
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </button>
                            )}
                            {node.type !== 'trigger' ? (
                              <div className="flex shrink-0 items-start border-l border-slate-100 p-2 pt-3">
                                <button
                                  type="button"
                                  onClick={() => removeNode(node.id)}
                                  className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-xs font-medium text-slate-600">Add step</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {availableActions.map((action) => (
                        <button
                          key={action.type}
                          type="button"
                          onClick={() => addNode(action.type, action.label)}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-left text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        >
                          <span className="text-xl">{action.icon}</span>
                          <span>{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={closeAutomationModal}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingAutomationId ? 'Save changes' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNodeConfig && selectedNode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-lg ${
              selectedNode.type === 'aistein_google_sheet_append_row' ? 'max-w-2xl' : 'max-w-lg'
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-primary">
                Configure {selectedNode.label}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowNodeConfig(false);
                  setSelectedNode(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <div className="space-y-4">
              {selectedNode.type === 'aistein_extract_data' ? (
                <ExtractDataConfig node={selectedNode} setNode={setSelectedNode} />
              ) : selectedNode.type === 'aistein_google_calendar_create_event' ? (
                <GoogleCalendarConfig node={selectedNode} setNode={setSelectedNode} />
              ) : selectedNode.type === 'aistein_google_sheet_append_row' ? (
                <GoogleSheetsConfig
                  node={selectedNode}
                  setNode={setSelectedNode}
                  jsonExample={APPOINTMENT_JSON_EXAMPLE}
                />
              ) : selectedNode.type === 'aistein_create_app_meeting' ? (
                <CreateAppMeetingConfig
                  node={selectedNode}
                  setNode={setSelectedNode}
                  knowledgeBases={knowledgeBases}
                />
              ) : selectedNode.type === 'aistein_send_email' ? (
                <EmailConfig node={selectedNode} setNode={setSelectedNode} />
              ) : (
                <p className="text-sm text-slate-600">No extra settings for this step.</p>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowNodeConfig(false);
                  setSelectedNode(null);
                }}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateNodeConfig(selectedNode.config)}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatJsonExampleField(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return '';
  }
}

function ExtractDataConfig({
  node,
  setNode,
}: {
  node: FlowNode;
  setNode: (n: FlowNode) => void;
}) {
  const c = node.config as Record<string, unknown>;
  const [jsonExampleText, setJsonExampleText] = useState(() =>
    formatJsonExampleField(c.json_example),
  );

  useEffect(() => {
    setJsonExampleText(formatJsonExampleField(c.json_example));
  }, [node.id]);

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">Extraction type</label>
        <select
          value={(c.extraction_type as string) || 'appointment'}
          onChange={(e) =>
            setNode({
              ...node,
              config: { ...node.config, extraction_type: e.target.value },
            })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="appointment">Appointment</option>
          <option value="lead">Lead</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">
          Extraction prompt (optional)
        </label>
        <textarea
          value={(c.extraction_prompt as string) || ''}
          onChange={(e) =>
            setNode({
              ...node,
              config: { ...node.config, extraction_prompt: e.target.value },
            })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="What to pull from the transcript"
          rows={6}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">
          JSON example (for the extract API)
        </label>
        <textarea
          value={jsonExampleText}
          onChange={(e) => {
            const next = e.target.value;
            setJsonExampleText(next);
            try {
              const parsed = JSON.parse(next) as unknown;
              if (parsed !== null && typeof parsed === 'object') {
                setNode({
                  ...node,
                  config: { ...node.config, json_example: parsed },
                });
              }
            } catch {
              /* incomplete JSON while typing */
            }
          }}
          onBlur={() => {
            try {
              const parsed = JSON.parse(jsonExampleText) as unknown;
              if (parsed !== null && typeof parsed === 'object') {
                setNode({
                  ...node,
                  config: { ...node.config, json_example: parsed },
                });
              }
            } catch {
              setJsonExampleText(formatJsonExampleField(c.json_example));
            }
          }}
          className="font-mono w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          rows={8}
        />
        <p className="mt-1 text-xs text-slate-500">
          Shapes the structured fields returned from the transcript (e.g. date, time, appointment_booked).
        </p>
      </div>
    </div>
  );
}

function GoogleCalendarConfig({
  node,
  setNode,
}: {
  node: FlowNode;
  setNode: (n: FlowNode) => void;
}) {
  const c = node.config as Record<string, string | undefined>;
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">Event title</label>
        <input
          type="text"
          value={c.summary || ''}
          onChange={(e) =>
            setNode({ ...node, config: { ...node.config, summary: e.target.value } })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="Appointment with {{contact.name}}"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">Description</label>
        <textarea
          value={c.description || ''}
          onChange={(e) =>
            setNode({ ...node, config: { ...node.config, description: e.target.value } })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          rows={2}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">Start (ISO date-time)</label>
        <input
          type="text"
          value={c.startTime || ''}
          onChange={(e) =>
            setNode({ ...node, config: { ...node.config, startTime: e.target.value } })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="2026-04-22T15:00:00"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">End (ISO date-time)</label>
        <input
          type="text"
          value={c.endTime || ''}
          onChange={(e) =>
            setNode({ ...node, config: { ...node.config, endTime: e.target.value } })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="2026-04-22T15:30:00"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">Time zone (optional)</label>
        <input
          type="text"
          value={c.timeZone || 'UTC'}
          onChange={(e) =>
            setNode({ ...node, config: { ...node.config, timeZone: e.target.value } })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="America/New_York"
        />
      </div>
    </div>
  );
}

function GoogleSheetsConfig({
  node,
  setNode,
  jsonExample,
}: {
  node: FlowNode;
  setNode: (n: FlowNode) => void;
  jsonExample: Record<string, unknown>;
}) {
  const c = node.config as Record<string, unknown>;
  const [pasteMode, setPasteMode] = useState<'url' | 'id'>('url');
  const [urlOrIdInput, setUrlOrIdInput] = useState(
    () =>
      (c.spreadsheet_url as string) ||
      (c.spreadsheet_id as string) ||
      '',
  );
  const sheetTab = typeof c.sheet_tab === 'string' && c.sheet_tab.trim() ? c.sheet_tab.trim() : 'Sheet1';

  const valuesArr = Array.isArray(c.values) ? (c.values as string[]) : [];

  const syncRange = (tab: string) => {
    const t = tab.trim() || 'Sheet1';
    return `${t}!A:Z`;
  };

  useEffect(() => {
    setUrlOrIdInput(
      (c.spreadsheet_url as string) || (c.spreadsheet_id as string) || '',
    );
  }, [node.id]);

  const applySpreadsheetFromInput = (raw: string) => {
    const id = parseGoogleSpreadsheetId(raw);
    setNode({
      ...node,
      config: {
        ...node.config,
        spreadsheet_id: id,
        spreadsheet_url: raw.trim().startsWith('http') ? raw.trim() : '',
      },
    });
  };

  const setColumns = (cols: string[]) => {
    setNode({ ...node, config: { ...node.config, values: cols } });
  };

  const fillFromExtract = () => {
    const contact = ['{{contact.name}}', '{{contact.email}}', '{{contact.phone}}'];
    const extracted = Object.keys(jsonExample).map(
      (k) => `{{extracted.${k}}}`,
    );
    setColumns([...contact, ...extracted, '{{meeting_link}}']);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
        <p className="font-medium text-slate-800">Uses your connected Google Workspace account</p>
        <p className="mt-1">Append one row per completed call. Row 1 in your tab should contain headers.</p>
        <p className="mt-1.5 text-slate-500">
          To store the guest meet URL, put this step <span className="font-medium text-slate-700">after</span>{' '}
          <span className="font-medium text-slate-700">MeetAssistant — create join link</span> and map{' '}
          <code className="rounded bg-slate-100 px-1">{'{{meeting_link}}'}</code> (same value as{' '}
          <code className="rounded bg-slate-100 px-1">{'{{app_meeting.shareUrl}}'}</code>).
        </p>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-slate-700">Select spreadsheet *</span>
        <div className="mb-2 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
          <button
            type="button"
            onClick={() => setPasteMode('url')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              pasteMode === 'url'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Paste link
          </button>
          <button
            type="button"
            onClick={() => setPasteMode('id')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              pasteMode === 'id'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Spreadsheet ID
          </button>
        </div>
        <input
          type="text"
          value={urlOrIdInput}
          onChange={(e) => {
            const v = e.target.value;
            setUrlOrIdInput(v);
            applySpreadsheetFromInput(v);
          }}
          onBlur={() => applySpreadsheetFromInput(urlOrIdInput)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder={
            pasteMode === 'url'
              ? 'https://docs.google.com/spreadsheets/d/...'
              : '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
          }
        />
        {(c.spreadsheet_id as string) ? (
          <p className="mt-1 font-mono text-[11px] text-emerald-800">
            Resolved ID: {(c.spreadsheet_id as string).slice(0, 12)}…
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-amber-800">Paste a full Google Sheets URL or the raw ID.</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">Tab name</label>
        <input
          type="text"
          value={sheetTab}
          onChange={(e) => {
            const tab = e.target.value || 'Sheet1';
            setNode({
              ...node,
              config: {
                ...node.config,
                sheet_tab: tab,
                range: syncRange(tab),
              },
            });
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="Sheet1"
        />
        <p className="mt-1 text-xs text-slate-500">
          Tab whose row 1 contains column titles (default Sheet1). Range used:{' '}
          <code className="rounded bg-slate-100 px-1">{syncRange(sheetTab)}</code>
        </p>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-medium text-slate-700">Column mapping *</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fillFromExtract}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              Fill from Extract node
            </button>
            <button
              type="button"
              onClick={() => setColumns([...valuesArr, ''])}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              + Add column
            </button>
          </div>
        </div>
        <ul className="space-y-2">
          {valuesArr.map((col, i) => (
            <li key={`col-${i}`} className="flex gap-2">
              <input
                type="text"
                value={col}
                onChange={(e) => {
                  const next = [...valuesArr];
                  next[i] = e.target.value;
                  setColumns(next);
                }}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="{{contact.name}}"
              />
              <button
                type="button"
                onClick={() => setColumns(valuesArr.filter((_, j) => j !== i))}
                className="shrink-0 rounded-lg border border-slate-200 px-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                aria-label="Remove column"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Variables: {'{{contact.name}}'}, {'{{contact.email}}'}, {'{{contact.phone}}'}, plus{' '}
          {'{{extracted.*}}'} keys from your extract JSON (e.g. {'{{extracted.date}}'}). After the Create
          MeetAssistant step runs: {'{{meeting_link}}'} or {'{{app_meeting.shareUrl}}'} for the booking’s join URL,{' '}
          {'{{app_meeting.meetingId}}'} for the meeting id. Google Calendar step (if used):{' '}
          {'{{calendar_event.hangoutLink}}'}, {'{{calendar_event.htmlLink}}'}.
        </p>
      </div>

      <details className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-slate-700">Advanced: raw JSON</summary>
        <textarea
          value={JSON.stringify(valuesArr, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value) as unknown;
              if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
                setColumns(parsed);
              }
            } catch {
              /* typing */
            }
          }}
          className="font-mono mt-2 w-full rounded border border-slate-200 bg-white px-2 py-2 text-[11px]"
          rows={5}
        />
      </details>
    </div>
  );
}

function CreateAppMeetingConfig({
  node,
  setNode,
  knowledgeBases,
}: {
  node: FlowNode;
  setNode: (n: FlowNode) => void;
  knowledgeBases: { id: string; name: string }[];
}) {
  const c = node.config as Record<string, string | boolean | undefined>;
  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
        Leave fields empty to use your saved{' '}
        <Link href="/dashboard/meet-automation" className="font-medium text-brand-600 hover:underline">
          Meet automation
        </Link>{' '}
        defaults (KB + avatar), then batch agent KB, then server env fallbacks.
      </p>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">
          Knowledge base (same as your meetings)
        </label>
        <select
          value={typeof c.knowledge_base_id === 'string' ? c.knowledge_base_id : ''}
          onChange={(e) =>
            setNode({
              ...node,
              config: { ...node.config, knowledge_base_id: e.target.value },
            })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Select…</option>
          {knowledgeBases.map((kb) => (
            <option key={kb.id} value={kb.id}>
              {kb.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">Avatar ID</label>
        <input
          type="text"
          value={typeof c.avatar_id === 'string' ? c.avatar_id : ''}
          onChange={(e) =>
            setNode({ ...node, config: { ...node.config, avatar_id: e.target.value } })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="Same LiveAvatar / avatar ID as on Meetings"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">Meeting title</label>
        <input
          type="text"
          value={typeof c.title === 'string' ? c.title : ''}
          onChange={(e) =>
            setNode({ ...node, config: { ...node.config, title: e.target.value } })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">Language code</label>
        <input
          type="text"
          value={typeof c.language === 'string' ? c.language : 'en'}
          onChange={(e) =>
            setNode({ ...node, config: { ...node.config, language: e.target.value } })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="en"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={Boolean(c.is_reusable)}
          onChange={(e) =>
            setNode({
              ...node,
              config: { ...node.config, is_reusable: e.target.checked },
            })
          }
        />
        Reusable meeting link
      </label>
    </div>
  );
}

function EmailConfig({
  node,
  setNode,
}: {
  node: FlowNode;
  setNode: (n: FlowNode) => void;
}) {
  const c = node.config as Record<string, string | undefined>;
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">To</label>
        <input
          type="text"
          value={c.to || '{{contact.email}}'}
          onChange={(e) =>
            setNode({ ...node, config: { ...node.config, to: e.target.value } })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">Subject</label>
        <input
          type="text"
          value={c.subject || ''}
          onChange={(e) =>
            setNode({ ...node, config: { ...node.config, subject: e.target.value } })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-600">Body (HTML)</label>
        <textarea
          value={c.body || ''}
          onChange={(e) =>
            setNode({ ...node, config: { ...node.config, body: e.target.value } })
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          rows={6}
        />
        <p className="mt-1 text-xs text-slate-500">
          Include {'{{meeting_link}}'} or {'{{app_meeting.shareUrl}}'} for the MeetAssistant join URL.
        </p>
      </div>
    </div>
  );
}
