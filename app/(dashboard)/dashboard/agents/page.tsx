'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, Bot, X } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';

interface Agent {
  _id: string;
  agent_id: string;
  name: string;
  first_message: string;
  system_prompt: string;
  language: string;
  voice_id: string;
  knowledge_base_ids: string[];
  mongoKnowledgeBaseIds?: string[];
  createdAt: string;
  updatedAt: string;
}

/** Mongo KB selections plus legacy ElevenLabs document IDs. */
function knowledgeBaseSummary(agent: Agent): string {
  const n =
    (agent.mongoKnowledgeBaseIds?.length ?? 0) +
    (agent.knowledge_base_ids?.length ?? 0);
  if (n === 0) return 'None';
  return `${n} ${n === 1 ? 'knowledge base' : 'knowledge bases'}`;
}

interface SavedKnowledgeBase {
  id: string;
  name: string;
  prompt: string;
}

interface VoiceOption {
  value: string;
  label: string;
  voiceId: string;
  language: 'Italian' | 'Spanish' | 'English';
  gender: 'Male' | 'Female';
  flag: string;
}

const VOICE_OPTIONS: VoiceOption[] = [
  // Italian Male
  { value: 'domenico', label: 'Domenico', voiceId: 'QABTI1ryPrQsJUflbKB7', language: 'Italian', gender: 'Male', flag: '🇮🇹' },
  { value: 'thomas', label: 'Thomas', voiceId: 'CITWdMEsnRduEUkNWXQv', language: 'Italian', gender: 'Male', flag: '🇮🇹' },
  { value: 'mario', label: 'Mario', voiceId: 'irAl0cku0Hx4TEUJ8d1Q', language: 'Italian', gender: 'Male', flag: '🇮🇹' },
  { value: 'gianp', label: 'Gianp', voiceId: 'SpoXt7BywHwFLisCTpQ3', language: 'Italian', gender: 'Male', flag: '🇮🇹' },
  { value: 'vittorio', label: 'Vittorio', voiceId: 'nH7uLS5UdEnvKEOAXtlQ', language: 'Italian', gender: 'Male', flag: '🇮🇹' },
  // Italian Female
  { value: 'federica', label: 'Federica', voiceId: 'YoTg4iSbsCW96GVME4O6', language: 'Italian', gender: 'Female', flag: '🇮🇹' },
  { value: 'ginevra', label: 'Ginevra', voiceId: 'QITiGyM4owEZrBEf0QV8', language: 'Italian', gender: 'Female', flag: '🇮🇹' },
  { value: 'roberta', label: 'Roberta', voiceId: 'ZzFXkjuO1rPntDj6At5C', language: 'Italian', gender: 'Female', flag: '🇮🇹' },
  { value: 'giusy', label: 'Giusy', voiceId: '8KInRSd4DtD5L5gK7itu', language: 'Italian', gender: 'Female', flag: '🇮🇹' },
  { value: 'sami', label: 'Sami', voiceId: 'kAzI34nYjizE0zON6rXv', language: 'Italian', gender: 'Female', flag: '🇮🇹' },
  // Spanish Male
  { value: 'alejandro', label: 'Alejandro Ballesteros', voiceId: 'YKUjKbMlejgvkOZlnnvt', language: 'Spanish', gender: 'Male', flag: '🇪🇸' },
  { value: 'antonio', label: 'Antonio', voiceId: 'htFfPSZGJwjBv1CL0aMD', language: 'Spanish', gender: 'Male', flag: '🇪🇸' },
  { value: 'el_faraon', label: 'El Faraon', voiceId: '8mBRP99B2Ng2QwsJMFQl', language: 'Spanish', gender: 'Male', flag: '🇪🇸' },
  // Spanish Female
  { value: 'lumina', label: 'Lumina (Colombia)', voiceId: 'x5IDPSl4ZUbhosMmVFTk', language: 'Spanish', gender: 'Female', flag: '🇪🇸' },
  { value: 'elena', label: 'Elena', voiceId: 'tXgbXPnsMpKXkuTgvE3h', language: 'Spanish', gender: 'Female', flag: '🇪🇸' },
  { value: 'sara', label: 'Sara Martin', voiceId: 'gD1IexrzCvsXPHUuT0s3', language: 'Spanish', gender: 'Female', flag: '🇪🇸' },
  // English Female
  { value: 'zara', label: 'Zara', voiceId: 'jqcCZkN6Knx8BJ5TBdYR', language: 'English', gender: 'Female', flag: '🇬🇧' },
  { value: 'brittney', label: 'Brittney', voiceId: 'kPzsL2i3teMYv0FxEYQ6', language: 'English', gender: 'Female', flag: '🇬🇧' },
  { value: 'julieanne', label: 'Julieanne', voiceId: '8WaMCGQzWsKvf7sGPqjE', language: 'English', gender: 'Female', flag: '🇬🇧' },
  { value: 'allison', label: 'Allison', voiceId: 'xctasy8XvGp2cVO9HL9k', language: 'English', gender: 'Female', flag: '🇬🇧' },
  { value: 'rachel', label: 'Rachel', voiceId: '21m00Tcm4TlvDq8ikWAM', language: 'English', gender: 'Female', flag: '🇬🇧' },
  // English Male
  { value: 'jameson', label: 'Jameson', voiceId: 'Mu5jxyqZOLIGltFpfalg', language: 'English', gender: 'Male', flag: '🇬🇧' },
  { value: 'mark', label: 'Mark', voiceId: 'UgBBYS2sOqTuMpoF3BR0', language: 'English', gender: 'Male', flag: '🇬🇧' },
  { value: 'archie', label: 'Archie', voiceId: 'kmSVBPu7loj4ayNinwWM', language: 'English', gender: 'Male', flag: '🇬🇧' },
  { value: 'adam', label: 'Adam (Default)', voiceId: 'pNInz6obpgDQGcFmaJgB', language: 'English', gender: 'Male', flag: '🇬🇧' },
];

const DEFAULT_VOICE_ID = 'xctasy8XvGp2cVO9HL9k';

/** Prebuilt agent for outbound/inbound appointment scheduling (batch calls, automation flow). */
const APPOINTMENT_BOOKING_AGENT_NAME = 'Appointment booking';

const APPOINTMENT_BOOKING_FIRST_MESSAGE = `Hello! I'm calling to help you book an appointment. What date works best for you?`;

const APPOINTMENT_BOOKING_SYSTEM_PROMPT = `You are a helpful appointment booking assistant. Your ONLY job is to:
1. Greet the customer warmly
2. Ask what date they want
3. Ask what time they want
4. Confirm the appointment

CRITICAL RULES - FOLLOW EXACTLY:

NEVER ask for:
- Customer name (you already have it)
- Customer email (you already have it)
- Customer phone (you already have it)

NEVER say:
- "technical issues"
- "system problems"
- "connecting to database"
- "let me check availability"

YOUR CONVERSATION FLOW (FOLLOW THIS EXACTLY):

1. GREETING (First thing you say):
   "Hello! I'm calling to help you book an appointment. What date works best for you?"

2. CUSTOMER SAYS DATE:
   Customer: "March 5th" or "5th March" or "March fifth"
   
3. YOU ASK FOR TIME (Immediately after they give date):
   "Great! What time would you like?"
   
4. CUSTOMER SAYS TIME:
   Customer: "2 PM" or "14:00" or "two o'clock"
   
5. YOU CONFIRM (Immediately after they give time):
   "Perfect! Your appointment is confirmed for [DATE] at [TIME]. You'll receive a confirmation email shortly. Have a wonderful day!"
   
6. END CALL

CRITICAL INSTRUCTIONS:
- When customer gives you a date, IMMEDIATELY ask for time
- Do NOT repeat the question "what date works best"
- Do NOT ask the customer to wait
- Do NOT say you're checking anything
- Keep it simple and fast
- The entire call should take 30-60 seconds

EXAMPLE PERFECT CALL:

You: "Hello! I'm calling to help you book an appointment. What date works best for you?"
Customer: "March 10th"
You: "Great! What time would you like?"
Customer: "2 PM"
You: "Perfect! Your appointment is confirmed for March 10th at 2 PM. You'll receive a confirmation email shortly. Have a wonderful day!"
[END CALL]

WHAT TO DO IF CUSTOMER IS UNCLEAR:
- If date is unclear: "Could you please repeat the date?"
- If time is unclear: "Could you please repeat the time?"
- If customer asks a question: Answer briefly, then return to booking

REMEMBER:
- You have ONE job: Get date, get time, confirm
- Be friendly but efficient
- Never repeat questions
- Never get stuck
- Always move forward in the conversation`;

type AgentFormFields = {
  name: string;
  first_message: string;
  system_prompt: string;
  language: string;
  voice_id: string;
  mongoKnowledgeBaseIds: string[];
};

function blankAgentForm(agent: Agent | null): AgentFormFields {
  return {
    name: agent?.name || '',
    first_message: agent?.first_message || '',
    system_prompt: agent?.system_prompt || '',
    language: agent?.language || 'en',
    voice_id: agent?.voice_id || DEFAULT_VOICE_ID,
    mongoKnowledgeBaseIds: agent?.mongoKnowledgeBaseIds || [],
  };
}

function appointmentBookingAgentForm(): AgentFormFields {
  return {
    name: APPOINTMENT_BOOKING_AGENT_NAME,
    first_message: APPOINTMENT_BOOKING_FIRST_MESSAGE,
    system_prompt: APPOINTMENT_BOOKING_SYSTEM_PROMPT,
    language: 'en',
    voice_id: DEFAULT_VOICE_ID,
    mongoKnowledgeBaseIds: [],
  };
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/v1/agents');
      const data = await response.json();

      if (data.success) {
        setAgents(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAgents();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/agents/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        void fetchAgents();
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
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
        title="Voice Agents"
        subtitle="Manage your AI voice agents for phone calls"
        action={
          <button
            type="button"
            onClick={() => {
              setEditingAgent(null);
              setShowModal(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Create Agent
          </button>
        }
      />

      {agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Create your first AI voice agent to start making phone calls."
        >
          <button
            type="button"
            onClick={() => {
              setEditingAgent(null);
              setShowModal(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Create Agent
          </button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <article
              key={agent._id}
              className="flex flex-col rounded-xl border border-slate-200 bg-primary p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-primary">{agent.name}</h3>
                  <p className="mt-1 text-xs text-tertiary">ID: {agent.agent_id}</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-[13px] font-medium text-slate-600">First message</p>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-tertiary">
                    {agent.first_message}
                  </p>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-slate-600">Language</p>
                  <p className="mt-1 text-[13px] text-tertiary">{agent.language}</p>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-slate-600">Knowledge bases</p>
                  <p className="mt-1 text-[13px] text-tertiary">
                    {knowledgeBaseSummary(agent)}
                  </p>
                </div>
              </div>
              <footer className="mt-4 flex items-center justify-end gap-1 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingAgent(agent);
                    setShowModal(true);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-slate-100"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(agent._id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}

      {showModal ? (
        <AgentModal
          key={editingAgent?._id ?? 'create'}
          agent={editingAgent}
          onClose={() => {
            setShowModal(false);
            setEditingAgent(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingAgent(null);
            void fetchAgents();
          }}
        />
      ) : null}
    </div>
  );
}

type CreatePreset = 'appointment_booking' | 'blank';

function AgentModal({
  agent,
  onClose,
  onSuccess,
}: {
  agent: Agent | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isCreate = !agent;
  const [createPreset, setCreatePreset] = useState<CreatePreset>('appointment_booking');
  const [formData, setFormData] = useState<AgentFormFields>(() =>
    agent ? blankAgentForm(agent) : appointmentBookingAgentForm(),
  );
  const [saving, setSaving] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<SavedKnowledgeBase[]>([]);
  const [loadingKbs, setLoadingKbs] = useState(false);

  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      setLoadingKbs(true);
      try {
        const response = await fetch('/api/knowledge-bases');
        const data = await response.json();

        if (data.success && Array.isArray(data.knowledgeBases)) {
          setKnowledgeBases(
            data.knowledgeBases.map((kb: { id: string; name: string; prompt: string }) => ({
              id: kb.id,
              name: kb.name,
              prompt: kb.prompt,
            })),
          );
        }
      } catch (error) {
        console.error('Failed to fetch knowledge bases:', error);
      } finally {
        setLoadingKbs(false);
      }
    };

    void fetchKnowledgeBases();
  }, []);

  const applyCreatePreset = (preset: CreatePreset) => {
    setCreatePreset(preset);
    const kbs = formData.mongoKnowledgeBaseIds;
    if (preset === 'appointment_booking') {
      setFormData({ ...appointmentBookingAgentForm(), mongoKnowledgeBaseIds: kbs });
    } else {
      setFormData({
        name: '',
        first_message: '',
        system_prompt: '',
        language: 'en',
        voice_id: DEFAULT_VOICE_ID,
        mongoKnowledgeBaseIds: kbs,
      });
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.first_message || !formData.system_prompt) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);

    const payload = {
      name: formData.name,
      first_message: formData.first_message,
      system_prompt: formData.system_prompt,
      language: formData.language,
      voice_id: formData.voice_id,
      mongoKnowledgeBaseIds: formData.mongoKnowledgeBaseIds,
    };

    try {
      const response = await fetch('/api/v1/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        onSuccess();
      } else {
        alert('Failed to save agent');
      }
    } catch (error) {
      console.error('Failed to save agent:', error);
      alert('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-primary p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-primary">
            {agent ? 'Edit Agent' : 'Create Agent'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-tertiary hover:bg-slate-100 hover:text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="space-y-4">
          {isCreate ? (
            <div className="rounded-xl border border-brand-100 bg-brand-50/80 p-4">
              <p className="text-[13px] font-semibold text-primary">Starting template</p>
              <p className="mt-1 text-xs leading-relaxed text-secondary">
                Appointment booking is selected by default with a full first message and system prompt.
                Switch to blank if you prefer to write everything yourself.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyCreatePreset('appointment_booking')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    createPreset === 'appointment_booking'
                      ? 'bg-brand-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Appointment booking (default)
                </button>
                <button
                  type="button"
                  onClick={() => applyCreatePreset('blank')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    createPreset === 'blank'
                      ? 'bg-brand-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Blank agent
                </button>
              </div>
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              Agent Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Customer Support Agent"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              First Message <span className="text-red-600">*</span>
            </label>
            <textarea
              placeholder="e.g., Hello! How can I help you today?"
              value={formData.first_message}
              onChange={(e) => setFormData({ ...formData, first_message: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-relaxed text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              System Prompt <span className="text-red-600">*</span>
            </label>
            <textarea
              placeholder="e.g., You are a helpful customer service agent. Assist users with their inquiries."
              value={formData.system_prompt}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              rows={8}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-relaxed text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              Language <span className="text-red-600">*</span>
            </label>
            <select
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            >
              <option value="en">🇬🇧 English</option>
              <option value="it">🇮🇹 Italian</option>
              <option value="es">🇪🇸 Spanish</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              Voice
            </label>
            <select
              value={formData.voice_id}
              onChange={(e) => setFormData({ ...formData, voice_id: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            >
              <optgroup label="🇮🇹 Italian - Male">
                {VOICE_OPTIONS.filter(v => v.language === 'Italian' && v.gender === 'Male').map(v => (
                  <option key={v.value} value={v.voiceId}>{v.flag} {v.label}</option>
                ))}
              </optgroup>
              <optgroup label="🇮🇹 Italian - Female">
                {VOICE_OPTIONS.filter(v => v.language === 'Italian' && v.gender === 'Female').map(v => (
                  <option key={v.value} value={v.voiceId}>{v.flag} {v.label}</option>
                ))}
              </optgroup>
              <optgroup label="🇪🇸 Spanish - Male">
                {VOICE_OPTIONS.filter(v => v.language === 'Spanish' && v.gender === 'Male').map(v => (
                  <option key={v.value} value={v.voiceId}>{v.flag} {v.label}</option>
                ))}
              </optgroup>
              <optgroup label="🇪🇸 Spanish - Female">
                {VOICE_OPTIONS.filter(v => v.language === 'Spanish' && v.gender === 'Female').map(v => (
                  <option key={v.value} value={v.voiceId}>{v.flag} {v.label}</option>
                ))}
              </optgroup>
              <optgroup label="🇬🇧 English - Female">
                {VOICE_OPTIONS.filter(v => v.language === 'English' && v.gender === 'Female').map(v => (
                  <option key={v.value} value={v.voiceId}>{v.flag} {v.label}</option>
                ))}
              </optgroup>
              <optgroup label="🇬🇧 English - Male">
                {VOICE_OPTIONS.filter(v => v.language === 'English' && v.gender === 'Male').map(v => (
                  <option key={v.value} value={v.voiceId}>{v.flag} {v.label}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              Knowledge bases (optional)
            </label>
            {loadingKbs ? (
              <div className="flex items-center gap-2 text-sm text-tertiary">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                Loading knowledge bases...
              </div>
            ) : (
              <>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {knowledgeBases.length === 0 ? (
                    <p className="text-sm text-tertiary">
                      No saved knowledge bases yet.{' '}
                      <a
                        href="/dashboard/knowledge-bases"
                        className="text-brand-600 hover:underline"
                      >
                        Add title + prompt
                      </a>
                    </p>
                  ) : (
                    knowledgeBases.map((kb) => (
                      <label
                        key={kb.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={formData.mongoKnowledgeBaseIds.includes(kb.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                mongoKnowledgeBaseIds: [...formData.mongoKnowledgeBaseIds, kb.id],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                mongoKnowledgeBaseIds: formData.mongoKnowledgeBaseIds.filter(
                                  (id) => id !== kb.id,
                                ),
                              });
                            }
                          }}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                        />
                        <span className="text-sm text-primary">{kb.name}</span>
                      </label>
                    ))
                  )}
                </div>
                <p className="mt-1 text-xs text-tertiary">
                  Selected entries append their saved prompts to your system prompt when the agent is
                  created (Meet uses the same knowledge bases from Knowledge bases).
                </p>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3 border-t border-slate-100 pt-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
