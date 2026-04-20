'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Phone, Pencil, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';

interface PhoneNumber {
  phone_number_id: string;
  label: string;
  phone_number: string;
  provider: 'twilio' | 'sip_trunk';
  supports_inbound: boolean;
  supports_outbound: boolean;
  elevenlabs_phone_number_id?: string;
  created_at_unix: number;
  agent_id?: string;
}

export default function PhoneNumbersPage() {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'twilio' | 'sip'>('list');

  const fetchPhoneNumbers = async () => {
    try {
      const response = await fetch('/api/v1/phone-numbers');
      const data = await response.json();

      if (data.phone_numbers) {
        setPhoneNumbers(data.phone_numbers);
      }
    } catch (error) {
      console.error('Failed to fetch phone numbers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPhoneNumbers();
  }, []);

  const handleDelete = async (phone_number_id: string) => {
    if (!confirm('Are you sure you want to delete this phone number?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/phone-numbers/${phone_number_id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        void fetchPhoneNumbers();
      }
    } catch (error) {
      console.error('Failed to delete phone number:', error);
    }
  };

  const handleRegister = async (phone_number_id: string) => {
    try {
      const response = await fetch(`/api/v1/phone-numbers/${phone_number_id}/register`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('Phone number registered successfully');
        void fetchPhoneNumbers();
      } else {
        alert('Failed to register phone number');
      }
    } catch (error) {
      console.error('Failed to register phone number:', error);
      alert('An error occurred while registering phone number');
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
        title="Phone Numbers"
        subtitle="Manage phone numbers for voice agent calls"
        action={
          <button
            type="button"
            onClick={() => setActiveTab('twilio')}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Add Phone Number
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
            All Numbers
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('twilio')}
            className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'twilio'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            Add Twilio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sip')}
            className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'sip'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            Add SIP Trunk
          </button>
        </nav>
      </div>

      {activeTab === 'list' && (
        <>
          {phoneNumbers.length === 0 ? (
            <EmptyState
              icon={Phone}
              title="No phone numbers yet"
              description="Add a phone number to enable voice agent calls."
            >
              <button
                type="button"
                onClick={() => setActiveTab('twilio')}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Add Phone Number
              </button>
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {phoneNumbers.map((pn) => (
                <article
                  key={pn.phone_number_id}
                  className="flex flex-col rounded-xl border border-slate-200 bg-primary p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-primary">{pn.label}</h3>
                      <p className="mt-1 text-lg font-medium text-brand-600">{pn.phone_number}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 capitalize">
                      {pn.provider}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      {pn.supports_inbound && (
                        <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Inbound
                        </span>
                      )}
                      {pn.supports_outbound && (
                        <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Outbound
                        </span>
                      )}
                    </div>
                    {pn.elevenlabs_phone_number_id ? (
                      <p className="text-xs text-tertiary">Registered with ElevenLabs</p>
                    ) : (
                      <p className="text-xs text-amber-600">Not registered with ElevenLabs</p>
                    )}
                  </div>
                  <footer className="mt-4 flex items-center justify-end gap-1 border-t border-slate-100 pt-4">
                    {!pn.elevenlabs_phone_number_id && pn.supports_outbound && (
                      <button
                        type="button"
                        onClick={() => handleRegister(pn.phone_number_id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-slate-100"
                        title="Register with ElevenLabs"
                      >
                        <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(pn.phone_number_id)}
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
        </>
      )}

      {activeTab === 'twilio' && (
        <TwilioForm onSuccess={() => { void fetchPhoneNumbers(); setActiveTab('list'); }} />
      )}
      {activeTab === 'sip' && (
        <SipForm onSuccess={() => { void fetchPhoneNumbers(); setActiveTab('list'); }} />
      )}
    </div>
  );
}

function TwilioForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    label: '',
    phone_number: '',
    sid: '',
    token: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!formData.label || !formData.phone_number || !formData.sid || !formData.token) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/v1/phone-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSuccess();
      } else {
        alert('Failed to create phone number');
      }
    } catch (error) {
      console.error('Failed to create phone number:', error);
      alert('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl rounded-xl border border-slate-200 bg-primary p-6">
      <div className="mb-4 flex items-center gap-2">
        <Phone className="h-5 w-5 text-brand-600" strokeWidth={1.75} />
        <h3 className="text-lg font-semibold text-primary">Add Twilio Phone Number</h3>
      </div>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
            Label <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Main Business Line"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
            Phone Number <span className="text-red-600">*</span>
          </label>
          <input
            type="tel"
            placeholder="+1234567890"
            value={formData.phone_number}
            onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
            Twilio Account SID <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={formData.sid}
            onChange={(e) => setFormData({ ...formData, sid: e.target.value })}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
            Twilio Auth Token <span className="text-red-600">*</span>
          </label>
          <input
            type="password"
            placeholder="Your Twilio auth token"
            value={formData.token}
            onChange={(e) => setFormData({ ...formData, token: e.target.value })}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setFormData({ label: '', phone_number: '', sid: '', token: '' })}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add Phone Number'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SipForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    label: '',
    phone_number: '',
    supports_inbound: false,
    supports_outbound: true,
    inbound_address: 'sip.rtc.elevenlabs.io:5060',
    outbound_address: '',
    outbound_username: '',
    outbound_password: '',
    media_encryption: 'allowed' as 'allowed' | 'disallowed',
    transport: 'auto' as 'auto' | 'udp' | 'tcp',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!formData.label || !formData.phone_number) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.supports_inbound && (!formData.inbound_address)) {
      alert('Please fill in inbound SIP configuration');
      return;
    }

    if (formData.supports_outbound && (!formData.outbound_address || !formData.outbound_username || !formData.outbound_password)) {
      alert('Please fill in outbound SIP configuration');
      return;
    }

    setSaving(true);

    const payload = {
      label: formData.label,
      phone_number: formData.phone_number,
      provider: 'sip_trunk' as const,
      supports_inbound: formData.supports_inbound,
      supports_outbound: formData.supports_outbound,
      inbound_trunk_config: formData.supports_inbound
        ? {
            address: formData.inbound_address,
            media_encryption: formData.media_encryption,
          }
        : undefined,
      outbound_trunk_config: formData.supports_outbound
        ? {
            address: formData.outbound_address,
            credentials: {
              username: formData.outbound_username,
              password: formData.outbound_password,
            },
            media_encryption: formData.media_encryption,
            transport: formData.transport,
          }
        : undefined,
    };

    try {
      const response = await fetch('/api/v1/phone-numbers/sip-trunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        onSuccess();
      } else {
        alert('Failed to create SIP trunk');
      }
    } catch (error) {
      console.error('Failed to create SIP trunk:', error);
      alert('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl rounded-xl border border-slate-200 bg-primary p-6">
      <div className="mb-4 flex items-center gap-2">
        <Phone className="h-5 w-5 text-brand-600" strokeWidth={1.75} />
        <h3 className="text-lg font-semibold text-primary">Add Generic SIP Trunk</h3>
      </div>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
            Label <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Italy SIP Line"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
            Phone Number <span className="text-red-600">*</span>
          </label>
          <input
            type="tel"
            placeholder="+390620199287"
            value={formData.phone_number}
            onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
            Provider <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value="SIP Trunk"
            disabled
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 outline-none"
          />
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.supports_inbound}
              onChange={(e) => setFormData({ ...formData, supports_inbound: e.target.checked })}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-600"
            />
            <span className="text-sm text-slate-600">Support Inbound</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.supports_outbound}
              onChange={(e) => setFormData({ ...formData, supports_outbound: e.target.checked })}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-600"
            />
            <span className="text-sm text-slate-600">Support Outbound</span>
          </label>
        </div>
        {formData.supports_inbound && (
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-600">Inbound Trunk Configuration</p>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                Inbound SIP Address <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="sip.rtc.elevenlabs.io:5060"
                value={formData.inbound_address}
                onChange={(e) => setFormData({ ...formData, inbound_address: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
              />
              <p className="mt-1 text-xs text-tertiary">Default: sip.rtc.elevenlabs.io:5060</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                Media Encryption <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.media_encryption}
                onChange={(e) => setFormData({ ...formData, media_encryption: e.target.value as 'allowed' | 'disallowed' })}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
              >
                <option value="allowed">Allowed</option>
                <option value="disallowed">Disallowed</option>
              </select>
            </div>
          </div>
        )}
        {formData.supports_outbound && (
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-600">Outbound Trunk Configuration</p>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                Outbound SIP Address <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="voiceagent.fibrapro.it"
                value={formData.outbound_address}
                onChange={(e) => setFormData({ ...formData, outbound_address: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                Outbound Username <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="+390620199287"
                value={formData.outbound_username}
                onChange={(e) => setFormData({ ...formData, outbound_username: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                Outbound Password <span className="text-red-600">*</span>
              </label>
              <input
                type="password"
                placeholder="your_password"
                value={formData.outbound_password}
                onChange={(e) => setFormData({ ...formData, outbound_password: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                Media Encryption <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.media_encryption}
                onChange={(e) => setFormData({ ...formData, media_encryption: e.target.value as 'allowed' | 'disallowed' })}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
              >
                <option value="allowed">Allowed</option>
                <option value="disallowed">Disallowed</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                Transport <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.transport}
                onChange={(e) => setFormData({ ...formData, transport: e.target.value as 'auto' | 'udp' | 'tcp' })}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
              >
                <option value="auto">Auto</option>
                <option value="udp">UDP</option>
                <option value="tcp">TCP</option>
              </select>
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              setFormData({
                label: '',
                phone_number: '',
                supports_inbound: false,
                supports_outbound: true,
                inbound_address: 'sip.rtc.elevenlabs.io:5060',
                outbound_address: '',
                outbound_username: '',
                outbound_password: '',
                media_encryption: 'allowed',
                transport: 'auto',
              })
            }
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Create Generic SIP Trunk'}
          </button>
        </div>
      </div>
    </div>
  );
}
