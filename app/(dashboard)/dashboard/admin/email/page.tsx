'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/Button';

const ERROR_TEXT: Record<string, string> = {
  missing_email:
    'Authorization finished but no email was returned. Try again or check the Kepler redirect configuration.',
  save_failed: 'Could not save the connected address. Try again.',
  authorize_failed: 'Could not start Gmail authorization.',
  kepler_not_configured:
    'Kepler email API URL is not set. Add KEPLER_EMAIL_API_BASE_URL to the server environment.',
};

function AdminEmailPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/email/status');
      const data = await res.json();
      if (res.status === 403) {
        alert('Admin access required');
        router.push('/dashboard/meetings');
        return;
      }
      if (data.success) {
        setConnected(Boolean(data.connected));
        setEmail(typeof data.email === 'string' ? data.email : null);
        setApiConfigured(Boolean(data.keplerApiConfigured));
      }
    } catch {
      setBanner({ kind: 'err', text: 'Could not load email integration status.' });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get('connected') === '1') {
      setBanner({
        kind: 'ok',
        text: 'Gmail connected. Meeting invite emails will be sent through this address.',
      });
      void load();
    }
    const err = searchParams.get('error');
    if (err) {
      setBanner({
        kind: 'err',
        text: ERROR_TEXT[err] || 'Connection failed.',
      });
    }
  }, [searchParams, load]);

  const disconnect = async () => {
    if (
      !confirm(
        'Disconnect Gmail? Meeting invites will fall back to Google Workspace (Integrations) if configured.',
      )
    ) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch('/api/admin/email/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setConnected(false);
        setEmail(null);
        setBanner({ kind: 'ok', text: 'Gmail disconnected.' });
      } else {
        setBanner({ kind: 'err', text: 'Could not disconnect.' });
      }
    } catch {
      setBanner({ kind: 'err', text: 'Could not disconnect.' });
    } finally {
      setDisconnecting(false);
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
    <div className="space-y-6">
      <PageHeader
        title="Meeting email (Gmail)"
        subtitle="Authorize Gmail via the Kepler API so invite emails are sent from your inbox."
      />

      {banner ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            banner.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-primary p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Mail className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-primary">Kepler Gmail integration</h2>
              <p className="mt-1 text-sm leading-relaxed text-secondary">
                Uses{' '}
                <a
                  href="https://keplerov1-python-2.onrender.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-600 underline-offset-2 hover:underline"
                >
                  Kepler
                </a>{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-[13px]">/email/authorize</code> and{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-[13px]">/email/send</code>. Set{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-[13px]">
                  KEPLER_EMAIL_API_BASE_URL
                </code>{' '}
                on the server (e.g. <code className="text-[13px]">https://keplerov1-python-2.onrender.com</code>
                ).
              </p>
              {!apiConfigured ? (
                <p className="mt-2 text-sm font-medium text-amber-800">
                  KEPLER_EMAIL_API_BASE_URL is not configured — connect is disabled until the env var is set.
                </p>
              ) : null}
            </div>
          </div>
          {connected ? (
            <Badge variant="active">Connected</Badge>
          ) : (
            <Badge variant="deactivated">Not connected</Badge>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-primary">
            {connected && email ? email : 'No Gmail connected for invites'}
          </div>
          <div className="flex flex-wrap gap-2">
            {connected ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void disconnect()}
                disabled={disconnecting}
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            ) : (
              <a
                href={apiConfigured ? '/api/admin/email/authorize' : undefined}
                aria-disabled={!apiConfigured}
                className={
                  apiConfigured
                    ? 'inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700'
                    : 'inline-flex h-10 cursor-not-allowed items-center justify-center rounded-lg bg-slate-200 px-4 text-sm font-medium text-slate-500'
                }
              >
                Connect Gmail
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AdminEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-label="Loading" />
        </div>
      }
    >
      <AdminEmailPageInner />
    </Suspense>
  );
}
