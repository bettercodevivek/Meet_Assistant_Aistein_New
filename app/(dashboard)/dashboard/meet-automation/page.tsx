'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';
import { Select } from '@/components/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFavoriteAvatars } from '@/lib/avatars/useFavoriteAvatars';

type KnowledgeBaseOption = { id: string; name: string };
type AvatarOption = { id: string; name: string } | 'CUSTOM';

export default function MeetAutomationPage() {
  const { favorites, refresh } = useFavoriteAvatars();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseOption[]>([]);
  const [knowledgeBaseId, setKnowledgeBaseId] = useState('');
  const [avatarId, setAvatarId] = useState('');
  const [avatarCustom, setAvatarCustom] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const avatarOptions: AvatarOption[] = [...favorites.map((f) => ({ id: f.id, name: f.name })), 'CUSTOM'];
  const selectedKnownAvatar = favorites.find((f) => f.id === avatarId);
  const resolvedAvatarId = selectedKnownAvatar ? avatarId : avatarCustom.trim() || avatarId;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await refresh();
      const [kbRes, meetRes] = await Promise.all([
        fetch('/api/knowledge-bases'),
        fetch('/api/v1/meet-automation'),
      ]);
      const kbData = await kbRes.json();
      if (kbData.success && Array.isArray(kbData.knowledgeBases)) {
        setKnowledgeBases(
          kbData.knowledgeBases.map((k: { id: string; name: string }) => ({
            id: k.id,
            name: k.name,
          })),
        );
      }
      const meetData = await meetRes.json();
      if (meetData.success && meetData.data) {
        setKnowledgeBaseId(meetData.data.knowledgeBaseId || '');
        const nextAvatar = meetData.data.avatarId || '';
        setAvatarId(nextAvatar);
        setAvatarCustom(nextAvatar);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setSavedAt(null);
    try {
      const res = await fetch('/api/v1/meet-automation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knowledgeBaseId,
          avatarId: resolvedAvatarId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data?.message || 'Could not save settings.');
        return;
      }
      setSavedAt(new Date().toISOString());
    } catch {
      alert('Could not save settings.');
    } finally {
      setSaving(false);
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
        title="Meet automation"
        subtitle={
          <span>
            Choose the knowledge base and LiveAvatar id used when a batch automation runs{' '}
            <span className="font-medium text-slate-800">Create MeetAssistant link</span> and the node
            does not set its own KB / avatar. You can still override per automation in the flow editor.
          </span>
        }
        action={
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            )}
            Save defaults
          </button>
        }
      />

      <div className="mx-auto max-w-2xl space-y-8 rounded-xl border border-slate-200 bg-primary p-6 shadow-sm">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Knowledge base for Meet sessions
          </label>
          <select
            value={knowledgeBaseId}
            onChange={(e) => setKnowledgeBaseId(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          >
            <option value="">— Select a knowledge base —</option>
            {knowledgeBases.map((kb) => (
              <option key={kb.id} value={kb.id}>
                {kb.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-tertiary">
            Need a new one?{' '}
            <Link href="/dashboard/knowledge-bases" className="font-medium text-brand-600 hover:underline">
              Knowledge bases
            </Link>
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Avatar (same picker as Meetings)</label>
          <Select<AvatarOption>
            options={avatarOptions}
            getOptionKey={(opt, i) =>
              opt === 'CUSTOM' ? '__avatar_custom__' : `${opt.id}-${i}`
            }
            placeholder="Select avatar"
            value={selectedKnownAvatar ? selectedKnownAvatar.name : 'Custom avatar ID'}
            isSelected={(opt) =>
              opt === 'CUSTOM' ? !selectedKnownAvatar : opt.id === avatarId
            }
            onSelect={(opt) => {
              if (opt === 'CUSTOM') {
                setAvatarId(avatarCustom || avatarId || '');
                return;
              }
              setAvatarId(opt.id);
              setAvatarCustom('');
            }}
            renderOption={(opt) => (opt === 'CUSTOM' ? 'Custom avatar ID' : `${opt.name} (${opt.id})`)}
          />
          {!selectedKnownAvatar ? (
            <input
              type="text"
              value={avatarCustom}
              onChange={(e) => {
                const v = e.target.value.trim();
                setAvatarCustom(v);
                setAvatarId(v);
              }}
              placeholder="LiveAvatar UUID (e.g. 513fd1b7-7ef9-466d-9af2-344e51eeb833)"
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          ) : null}
          <p className="mt-2 text-xs text-tertiary">
            Uses your saved favorite avatars like Meetings. If empty, fallback env values may be used (
            <code className="rounded bg-slate-100 px-1">AUTOMATION_DEFAULT_AVATAR_ID</code> /{' '}
            <code className="rounded bg-slate-100 px-1">LIVEAVATAR_AVATAR_ID</code>).
          </p>
        </div>

        {savedAt ? (
          <p className="text-sm text-emerald-700">
            Saved — defaults will apply on the next automation run when the Meet step has no KB/avatar
            set.
          </p>
        ) : null}

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs text-tertiary">
            Related:{' '}
            <Link href="/dashboard/automation" className="font-medium text-brand-600 hover:underline">
              Automation
            </Link>{' '}
            ·{' '}
            <Link href="/dashboard/batch-calling" className="font-medium text-brand-600 hover:underline">
              Batch calling
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
