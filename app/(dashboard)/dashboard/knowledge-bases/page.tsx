'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';

interface KnowledgeBase {
  id: string;
  name: string;
  prompt: string;
  firstMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export default function KnowledgeBasesPage() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingKb, setEditingKb] = useState<KnowledgeBase | null>(null);

  const fetchKnowledgeBases = async () => {
    try {
      const response = await fetch('/api/knowledge-bases');
      const data = await response.json();

      if (data.success) {
        setKnowledgeBases(data.knowledgeBases);
      }
    } catch (error) {
      console.error('Failed to fetch knowledge bases:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchKnowledgeBases();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this knowledge base?')) {
      return;
    }

    try {
      const response = await fetch(`/api/knowledge-bases/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        void fetchKnowledgeBases();
      }
    } catch (error) {
      console.error('Failed to delete knowledge base:', error);
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
        title="Knowledge bases"
        subtitle="Manage your avatar knowledge bases, system prompts, and optional first message"
        action={
          <button
            type="button"
            onClick={() => {
              setEditingKb(null);
              setShowModal(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Create new
          </button>
        }
      />

      {knowledgeBases.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No knowledge bases yet"
          description="Add a knowledge base with a system prompt to ground your avatar."
        >
          <button
            type="button"
            onClick={() => {
              setEditingKb(null);
              setShowModal(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Create new
          </button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {knowledgeBases.map((kb) => (
            <article
              key={kb.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-primary p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
            >
              <h3 className="text-base font-semibold text-primary">{kb.name}</h3>
              <div className="mt-3 min-h-0 flex-1 space-y-2">
                <div>
                  <p className="text-[13px] font-medium text-slate-600">System prompt preview</p>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-tertiary">{kb.prompt}</p>
                </div>
                {kb.firstMessage ? (
                  <div>
                    <p className="text-[13px] font-medium text-slate-600">First message</p>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-tertiary">
                      {kb.firstMessage}
                    </p>
                  </div>
                ) : null}
              </div>
              <footer className="mt-4 flex items-center justify-end gap-1 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingKb(kb);
                    setShowModal(true);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-slate-100"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(kb.id)}
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
        <KnowledgeBaseModal
          knowledgeBase={editingKb}
          onClose={() => {
            setShowModal(false);
            setEditingKb(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingKb(null);
            void fetchKnowledgeBases();
          }}
        />
      ) : null}
    </div>
  );
}

function KnowledgeBaseModal({
  knowledgeBase,
  onClose,
  onSuccess,
}: {
  knowledgeBase: KnowledgeBase | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: knowledgeBase?.name || '',
    prompt: knowledgeBase?.prompt || '',
    firstMessage: knowledgeBase?.firstMessage || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name || !formData.prompt) {
      alert('Please fill in all fields');
      return;
    }

    setSaving(true);

    try {
      const url = knowledgeBase ? `/api/knowledge-bases/${knowledgeBase.id}` : '/api/knowledge-bases';

      const method = knowledgeBase ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSuccess();
      } else {
        alert('Failed to save knowledge base');
      }
    } catch (error) {
      console.error('Failed to save knowledge base:', error);
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
            {knowledgeBase ? 'Edit knowledge base' : 'Create knowledge base'}
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
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              Knowledge base name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Business advisor"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              System prompt <span className="text-red-600">*</span>
            </label>
            <textarea
              placeholder="e.g., You are a helpful business advisor…"
              value={formData.prompt}
              onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
              rows={10}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-relaxed text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
            <p className="mt-1 text-xs text-tertiary">
              This prompt defines the avatar&apos;s behavior. Previous conversation summaries will be appended
              automatically.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              First message <span className="text-xs font-normal text-tertiary">(optional)</span>
            </label>
            <textarea
              placeholder="e.g., Greet the guest and briefly explain what you can help with…"
              value={formData.firstMessage}
              onChange={(e) => setFormData({ ...formData, firstMessage: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-relaxed text-primary outline-none placeholder:text-tertiary focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
            <p className="mt-1 text-xs text-tertiary">
              When this knowledge base is used for a meet, the voice agent speaks this text exactly as the first
              thing guests hear. If empty, a short default greeting is generated instead.
            </p>
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
