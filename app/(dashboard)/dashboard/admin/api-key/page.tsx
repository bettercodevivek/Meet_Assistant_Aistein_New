'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/Button';

export default function AdminApiKeyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [updatingApiKey, setUpdatingApiKey] = useState(false);

  const fetchApiKey = async () => {
    try {
      const response = await fetch('/api/admin/api-key');
      const data = await response.json();

      if (data.success) {
        setApiKey(data.apiKey);
        setApiKeySet(data.isSet);
      } else if (response.status === 403) {
        alert('Admin access required');
        router.push('/dashboard/meetings');
      }
    } catch (error) {
      console.error('Failed to fetch API key:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchApiKey();
  }, []);

  const handleUpdateApiKey = async () => {
    if (!newApiKey.trim()) {
      alert('Please enter an API key');
      return;
    }

    setUpdatingApiKey(true);
    try {
      const response = await fetch('/api/admin/api-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: newApiKey }),
      });

      const data = await response.json();

      if (data.success) {
        alert(data.message);
        setNewApiKey('');
        void fetchApiKey();
      } else {
        alert(data.message || 'Failed to update API key');
      }
    } catch (error) {
      console.error('Failed to update API key:', error);
      alert('An error occurred while updating API key');
    } finally {
      setUpdatingApiKey(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <p className="text-secondary">Loading API key status…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="HeyGen API key"
        subtitle="Update the server key used for avatar streaming."
      />

      <section className="rounded-xl border border-slate-200 bg-primary p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-primary">
            {apiKeySet ? apiKey : 'No API key set'}
          </div>
          {apiKeySet ? (
            <Badge variant="active">Active</Badge>
          ) : (
            <Badge variant="deactivated">Not set</Badge>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-primary p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Update key</h2>
        <p className="mt-2 text-sm leading-relaxed text-secondary">
          Paste your new `HEYGEN_API_KEY`. Restart the dev server if changes do not apply immediately.
        </p>

        <div className="mt-6">
          <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
            API key <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            placeholder="HeyGen API key"
            className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>

        <div className="mt-6">
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleUpdateApiKey()}
            disabled={updatingApiKey}
          >
            {updatingApiKey ? 'Updating…' : 'Update key'}
          </Button>
        </div>
      </section>
    </div>
  );
}
