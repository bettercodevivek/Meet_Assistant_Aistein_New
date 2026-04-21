'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowRight, BookOpen, Loader2, PhoneOutgoing, Plug, Plus, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsCard } from '@/components/ui/StatsCard';

type MeetingRow = {
  meetingId: string;
  title: string;
  status: string;
  sessionCount: number;
  isActive: boolean;
  isReusable: boolean;
  createdAt: string;
};

function meetingStatusBadge(status: string, isActive: boolean) {
  const s = status.toLowerCase();
  if (!isActive) return <Badge variant="deactivated">Deactivated</Badge>;
  if (s.includes('wait')) return <Badge variant="waiting">Waiting</Badge>;
  if (s.includes('complete')) return <Badge variant="completed">Completed</Badge>;
  return <Badge variant="active">Active</Badge>;
}

const voiceAgentShortcuts = [
  {
    href: '/dashboard/batch-calling',
    label: 'Batch calling',
    description: 'Upload contacts and run voice campaigns',
  },
  {
    href: '/dashboard/automation',
    label: 'Batch automations',
    description: 'Flows after calls complete',
  },
  {
    href: '/dashboard/knowledge-bases',
    label: 'Knowledge bases',
    description: 'Documents for your assistant',
  },
  {
    href: '/dashboard/integrations',
    label: 'Integrations',
    description: 'Google Workspace & Gmail',
  },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setLoadError(false);
        const response = await fetch('/api/meetings?limit=100');
        const data = await response.json();
        if (data.success && Array.isArray(data.meetings)) {
          setMeetings(data.meetings);
        } else {
          setLoadError(true);
        }
      } catch (e) {
        console.error(e);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const recent = [...meetings].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5);

  const totalGuestSessions = meetings.reduce((acc, m) => acc + (m.sessionCount || 0), 0);
  const activeLinks = meetings.filter((m) => m.isActive).length;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Create meeting links, manage guest sessions, and open Voice Agent tools from shortcuts below."
        action={
          <button
            type="button"
            onClick={() => router.push('/dashboard/meetings?create=1')}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Create meeting link
          </button>
        }
      />

      <section aria-label="Voice Agent shortcuts">
        <h2 className="sr-only">Voice Agent shortcuts</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {voiceAgentShortcuts.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex flex-col rounded-xl border border-slate-200 bg-primary p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/50"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-primary group-hover:text-brand-700">
                {item.href === '/dashboard/automation' ? (
                  <Zap className="h-4 w-4 text-brand-600" strokeWidth={1.75} aria-hidden />
                ) : item.href === '/dashboard/knowledge-bases' ? (
                  <BookOpen className="h-4 w-4 text-brand-600" strokeWidth={1.75} aria-hidden />
                ) : item.href === '/dashboard/integrations' ? (
                  <Plug className="h-4 w-4 text-brand-600" strokeWidth={1.75} aria-hidden />
                ) : (
                  <PhoneOutgoing className="h-4 w-4 text-brand-600" strokeWidth={1.75} aria-hidden />
                )}
                {item.label}
              </span>
              <span className="mt-1 text-xs text-tertiary">{item.description}</span>
            </Link>
          ))}
        </div>
      </section>

      {loadError ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p>Could not load meetings. Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setLoadError(false);
              void (async () => {
                try {
                  const response = await fetch('/api/meetings?limit=100');
                  const data = await response.json();
                  if (data.success && Array.isArray(data.meetings)) {
                    setMeetings(data.meetings);
                  } else {
                    setLoadError(true);
                  }
                } catch (e) {
                  console.error(e);
                  setLoadError(true);
                } finally {
                  setLoading(false);
                }
              })();
            }}
            className="shrink-0 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-200"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard label="Total meetings" value={meetings.length} />
        <StatsCard label="Total guest sessions" value={totalGuestSessions} />
        <StatsCard label="Active links" value={activeLinks} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-primary">Recent meetings</h2>

        {recent.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="No meetings yet"
            description="Create a shareable link so guests can join your AI avatar sessions."
          >
            <button
              type="button"
              onClick={() => router.push('/dashboard/meetings?create=1')}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Create meeting link
            </button>
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {recent.map((m) => (
              <li key={m.meetingId}>
                <Link
                  href={`/dashboard/meetings/${encodeURIComponent(m.meetingId)}`}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-primary p-4 transition-all hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-primary">{m.title}</p>
                    <p className="mt-1 text-xs text-tertiary">
                      {format(new Date(m.createdAt), 'MMM d, yyyy · h:mm a')}
                      <span className="text-slate-300"> · </span>
                      {m.sessionCount} session{m.sessionCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {meetingStatusBadge(m.status, m.isActive)}
                    {!m.isReusable ? <Badge variant="single-use">Single-use</Badge> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {recent.length > 0 ? (
          <Link
            href="/dashboard/meetings"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            View all meetings
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </Link>
        ) : null}
      </section>
    </div>
  );
}
