"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Copy, Eye, Loader2, Pencil, Plus, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { MeetingShareToolkit } from "@/components/meeting/MeetingShareToolkit";
import { Badge } from "@/components/ui/Badge";
import {
  DataTable,
  DataTableBody,
  DataTableCard,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { STT_LANGUAGE_LIST } from "@/app/lib/constants";
import { useFavoriteAvatars } from "@/lib/avatars/useFavoriteAvatars";
import { clientMeetingShareUrl } from "@/lib/meetings/clientMeetingShareUrl";
import { parseLiveAvatarAvatarUuid } from "@/lib/livekit/liveAvatarAvatarId";

type MeetingRow = {
  meetingId: string;
  title: string;
  avatarId: string;
  liveAvatarAvatarUuid?: string;
  voiceId?: string;
  language: string;
  knowledgeBaseId: string;
  status: string;
  isReusable: boolean;
  maxSessions?: number;
  sessionCount: number;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeBase = { id: string; name: string };
type MeetingAvatarRow = {
  avatar_id: string;
  name: string;
  liveAvatarAvatarUuid?: string;
};
type AvatarOption = MeetingAvatarRow | "CUSTOM";

const inputDatetimeClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-primary outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

const MEET_ASSISTANT_LOG = "[MeetAssistant]";

function MeetingFormModal({
  open,
  onClose,
  knowledgeBases,
  initial,
  onSaved,
  onCreateSuccess,
}: {
  open: boolean;
  onClose: () => void;
  knowledgeBases: KnowledgeBase[];
  initial: MeetingRow | null;
  onSaved: () => void;
  onCreateSuccess?: (payload: {
    shareUrl: string;
    title: string;
    meetingId: string;
    invite?: {
      sent: boolean;
      to?: string;
      reason?: string;
      message?: string;
    };
  }) => void;
}) {
  const { favorites, refresh } = useFavoriteAvatars();
  const meetingAvatars: MeetingAvatarRow[] = favorites.map((f) => ({
    avatar_id: f.id,
    name: f.name,
    ...(f.liveAvatarAvatarUuid ? { liveAvatarAvatarUuid: f.liveAvatarAvatarUuid } : {}),
  }));
  const [title, setTitle] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [avatarCustom, setAvatarCustom] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [language, setLanguage] = useState("en");
  const [knowledgeBaseId, setKnowledgeBaseId] = useState("");
  const [liveAvatarAvatarUuid, setLiveAvatarAvatarUuid] = useState("");
  const [uuidResolvedFrom, setUuidResolvedFrom] = useState<
    "heygen" | "env_map" | null
  >(null);
  const [uuidLookupLoading, setUuidLookupLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [maxSessions, setMaxSessions] = useState("");
  const [isReusable, setIsReusable] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setUuidResolvedFrom(null);
    void (async () => {
      const favs = await refresh();
      if (cancelled) return;
      const rows = favs.map((f) => ({
        avatar_id: f.id,
        name: f.name,
        ...(f.liveAvatarAvatarUuid
          ? { liveAvatarAvatarUuid: f.liveAvatarAvatarUuid }
          : {}),
      }));
      if (initial) {
        setTitle(initial.title);
        const known = rows.find((a) => a.avatar_id === initial.avatarId);
        if (known) {
          setAvatarId(known.avatar_id);
          setAvatarCustom("");
        } else {
          setAvatarId(initial.avatarId);
          setAvatarCustom(initial.avatarId);
        }
        setVoiceId(initial.voiceId || "");
        setLanguage(initial.language);
        setKnowledgeBaseId(initial.knowledgeBaseId);
        setLiveAvatarAvatarUuid(initial.liveAvatarAvatarUuid || "");
        setExpiresAt(initial.expiresAt ? initial.expiresAt.slice(0, 16) : "");
        setMaxSessions(
          initial.maxSessions != null ? String(initial.maxSessions) : "",
        );
        setIsReusable(initial.isReusable);
        setInviteEmail("");
      } else {
        setTitle("");
        setAvatarId(rows[0]?.avatar_id || "");
        setAvatarCustom("");
        setVoiceId("");
        setLanguage("en");
        setKnowledgeBaseId(knowledgeBases[0]?.id || "");
        setLiveAvatarAvatarUuid("");
        setExpiresAt("");
        setMaxSessions("");
        setIsReusable(false);
        setInviteEmail("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, initial, knowledgeBases, refresh]);

  const resolvedAvatarId = meetingAvatars.some((a) => a.avatar_id === avatarId)
    ? avatarId
    : avatarCustom.trim() || avatarId;

  useEffect(() => {
    if (!open) return;
    const id = resolvedAvatarId.trim();
    if (!id) {
      setLiveAvatarAvatarUuid("");
      setUuidResolvedFrom(null);
      setUuidLookupLoading(false);
      return;
    }

    const direct = parseLiveAvatarAvatarUuid(id);
    if (direct) {
      setLiveAvatarAvatarUuid(direct);
      setUuidResolvedFrom(null);
      setUuidLookupLoading(false);
      return;
    }

    if (
      initial &&
      initial.avatarId === id &&
      initial.liveAvatarAvatarUuid &&
      parseLiveAvatarAvatarUuid(initial.liveAvatarAvatarUuid)
    ) {
      setLiveAvatarAvatarUuid(parseLiveAvatarAvatarUuid(initial.liveAvatarAvatarUuid)!);
      setUuidResolvedFrom(null);
      setUuidLookupLoading(false);
      return;
    }

    const favUuid = favorites.find((f) => f.id === id)?.liveAvatarAvatarUuid;
    const fromFav = favUuid ? parseLiveAvatarAvatarUuid(favUuid) : null;
    if (fromFav) {
      setLiveAvatarAvatarUuid(fromFav);
      setUuidResolvedFrom(null);
      setUuidLookupLoading(false);
      return;
    }

    let cancelled = false;
    setUuidLookupLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/avatars/${encodeURIComponent(id)}/details`);
        const data = (await res.json()) as {
          success?: boolean;
          liveAvatarAvatarUuid?: string | null;
          resolvedFrom?: string | null;
        };
        if (cancelled) return;
        const parsed =
          typeof data.liveAvatarAvatarUuid === "string"
            ? parseLiveAvatarAvatarUuid(data.liveAvatarAvatarUuid)
            : null;
        setLiveAvatarAvatarUuid(parsed ?? "");
        const rf = data.resolvedFrom;
        setUuidResolvedFrom(
          parsed && rf
            ? rf === "env_map"
              ? "env_map"
              : "heygen"
            : null,
        );
      } catch {
        if (!cancelled) {
          setLiveAvatarAvatarUuid("");
          setUuidResolvedFrom(null);
        }
      } finally {
        if (!cancelled) setUuidLookupLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    resolvedAvatarId,
    initial?.meetingId,
    initial?.avatarId,
    initial?.liveAvatarAvatarUuid,
    favorites,
  ]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      console.info(`${MEET_ASSISTANT_LOG} meeting form submit`, {
        avatarId: resolvedAvatarId,
        mode: initial ? "edit" : "create",
        meetingId: initial?.meetingId,
      });
      const payload: Record<string, unknown> = {
        title: title.trim(),
        avatarId: resolvedAvatarId,
        language,
        knowledgeBaseId,
        isReusable,
      };
      const effectiveLiveUuid =
        parseLiveAvatarAvatarUuid(liveAvatarAvatarUuid.trim()) ??
        parseLiveAvatarAvatarUuid(resolvedAvatarId.trim());
      if (effectiveLiveUuid) {
        payload.liveAvatarAvatarUuid = effectiveLiveUuid;
      }
      if (initial) {
        payload.voiceId = voiceId.trim() || null;
      } else if (voiceId.trim()) {
        payload.voiceId = voiceId.trim();
      }
      if (expiresAt) payload.expiresAt = new Date(expiresAt).toISOString();
      else if (initial) payload.expiresAt = null;
      if (maxSessions.trim()) {
        const n = parseInt(maxSessions, 10);
        if (n >= 1) payload.maxSessions = n;
      } else if (initial) payload.maxSessions = null;
      if (!initial && inviteEmail.trim()) {
        payload.inviteEmail = inviteEmail.trim();
      }

      const url = initial
        ? `/api/meetings/${encodeURIComponent(initial.meetingId)}`
        : "/api/meetings";
      const method = initial ? "PATCH" : "POST";
      const body = initial
        ? { ...payload, settings: {} }
        : { ...payload, settings: {} };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Request failed");
        return;
      }
      if (!initial && data.meeting) {
        onCreateSuccess?.({
          shareUrl:
            typeof data.shareUrl === "string"
              ? data.shareUrl
              : clientMeetingShareUrl(data.meeting.meetingId as string),
          title: data.meeting.title as string,
          meetingId: data.meeting.meetingId as string,
          invite: data.invite as
            | {
                sent: boolean;
                to?: string;
                reason?: string;
                message?: string;
              }
            | undefined,
        });
      }
      onSaved();
      onClose();
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-primary p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-primary">
          {initial ? "Edit meeting link" : "Create meeting link"}
        </h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              Title
            </label>
            <Input
              value={title}
              onChange={setTitle}
              placeholder="Meeting title"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              Avatar
            </label>
            <Select<AvatarOption>
              options={[...meetingAvatars, "CUSTOM"]}
              getOptionKey={(opt, index) =>
                opt === "CUSTOM"
                  ? "__avatar_custom__"
                  : `${(opt as MeetingAvatarRow).avatar_id}-${index}`
              }
              placeholder="Select avatar"
              value={
                meetingAvatars.some((a) => a.avatar_id === avatarId)
                  ? meetingAvatars.find((a) => a.avatar_id === avatarId)!.name
                  : "Custom avatar ID"
              }
              isSelected={(opt) =>
                opt === "CUSTOM"
                  ? !meetingAvatars.some((a) => a.avatar_id === avatarId)
                  : (opt as MeetingAvatarRow).avatar_id === avatarId
              }
              renderOption={(opt) =>
                opt === "CUSTOM"
                  ? "Custom avatar ID"
                  : (opt as MeetingAvatarRow).name
              }
              onSelect={(opt) => {
                if (opt === "CUSTOM") {
                  setAvatarId(avatarCustom || "");
                  console.info(
                    `${MEET_ASSISTANT_LOG} meeting form: avatar selection`,
                    {
                      kind: "custom_field",
                      avatarId: avatarCustom.trim() || "(empty)",
                    },
                  );
                } else {
                  const row = opt as MeetingAvatarRow;
                  setAvatarId(row.avatar_id);
                  console.info(
                    `${MEET_ASSISTANT_LOG} meeting form: avatar selection`,
                    {
                      kind: "shortlist",
                      avatarId: row.avatar_id,
                      displayName: row.name,
                    },
                  );
                }
              }}
            />
            {!meetingAvatars.some((a) => a.avatar_id === avatarId) && (
              <div className="mt-2">
                <Input
                  value={avatarCustom}
                  onChange={(v) => {
                    setAvatarCustom(v);
                    setAvatarId(v);
                    console.info(
                      `${MEET_ASSISTANT_LOG} meeting form: custom avatar id`,
                      {
                        avatarId: v.trim() || "(empty)",
                      },
                    );
                  }}
                  placeholder="HeyGen avatar id"
                />
              </div>
            )}
            <p className="mt-1.5 text-xs text-tertiary">
              Shortlist up to five in{" "}
              <Link
                href="/dashboard/gallery"
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                Gallery
              </Link>
              . The LiveAvatar UUID for LiveKit is loaded from HeyGen when you pick an avatar.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5">
            <p className="text-[13px] font-medium text-slate-600">LiveKit / LiveAvatar UUID</p>
            <p className="mt-1 text-xs text-tertiary">
              Resolved from HeyGen (details API + deep scan). Optional per-avatar map:{" "}
              <code className="rounded bg-white px-1 text-[11px] text-slate-700">
                HEYGEN_LIVEAVATAR_UUID_MAP
              </code>{" "}
              (JSON in server env). If still missing, LiveKit can use{" "}
              <code className="rounded bg-white px-1 text-[11px] text-slate-700">
                LIVEKIT_FALLBACK_AVATAR_UUID
              </code>{" "}
              or{" "}
              <code className="rounded bg-white px-1 text-[11px] text-slate-700">
                LIVEAVATAR_AVATAR_ID
              </code>
              .
            </p>
            <div className="mt-2 flex min-h-[1.25rem] flex-col gap-1 text-xs">
              <div className="flex min-h-[1.25rem] items-center gap-2">
                {uuidLookupLoading ? (
                  <>
                    <Loader2
                      className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400"
                      aria-hidden
                    />
                    <span className="text-tertiary">Fetching from HeyGen…</span>
                  </>
                ) : liveAvatarAvatarUuid.trim() ? (
                  <code className="break-all font-mono text-[11px] text-slate-800">
                    {parseLiveAvatarAvatarUuid(liveAvatarAvatarUuid.trim()) ??
                      liveAvatarAvatarUuid.trim()}
                  </code>
                ) : (
                  <span className="text-amber-800">
                    No UUID returned for this HeyGen avatar — set HEYGEN_LIVEAVATAR_UUID_MAP or use
                    env fallback on the agent.
                  </span>
                )}
              </div>
              {uuidResolvedFrom === "env_map" && liveAvatarAvatarUuid.trim() ? (
                <p className="text-emerald-800">
                  Source: server env map <code className="text-[11px]">HEYGEN_LIVEAVATAR_UUID_MAP</code>
                </p>
              ) : null}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              Voice ID (optional)
            </label>
            <Input
              value={voiceId}
              onChange={setVoiceId}
              placeholder="ElevenLabs voice id"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              Language
            </label>
            <Select<(typeof STT_LANGUAGE_LIST)[number]>
              options={STT_LANGUAGE_LIST}
              placeholder="Language"
              value={
                STT_LANGUAGE_LIST.find((l) => l.value === language)?.label ||
                language
              }
              isSelected={(opt) => opt.value === language}
              renderOption={(opt) => opt.label}
              onSelect={(opt) => setLanguage(opt.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              Knowledge base
            </label>
            <Select<KnowledgeBase>
              options={knowledgeBases}
              placeholder="Select knowledge base"
              value={
                knowledgeBases.find((k) => k.id === knowledgeBaseId)?.name ||
                null
              }
              isSelected={(k) => k.id === knowledgeBaseId}
              renderOption={(k) => k.name}
              onSelect={(k) => setKnowledgeBaseId(k.id)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              Expires (optional)
            </label>
            <input
              type="datetime-local"
              className={inputDatetimeClass}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
              Max sessions (optional)
            </label>
            <input
              type="number"
              min={1}
              className={inputDatetimeClass}
              placeholder="Unlimited"
              value={maxSessions}
              onChange={(e) => setMaxSessions(e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              checked={isReusable}
              onChange={(e) => setIsReusable(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600/20"
            />
            Reusable link (multiple joins over time)
          </label>
          {!initial ? (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                Email invite (optional)
              </label>
              <Input
                value={inviteEmail}
                onChange={setInviteEmail}
                placeholder="guest@example.com"
                type="email"
                autoComplete="email"
              />
              <p className="mt-1.5 text-xs text-tertiary">
                Sends a join link when Gmail is configured: an admin can connect organization email
                under Admin → Email (Gmail), or you can connect your own Google account in{" "}
                <Link
                  href="/dashboard/integrations"
                  className="font-medium text-brand-600 hover:text-brand-700"
                >
                  Integrations
                </Link>
                .
              </p>
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <div className="mt-6 flex gap-3">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            onClick={() => void submit()}
            disabled={saving || !title.trim() || !knowledgeBaseId}
          >
            {saving ? "Saving…" : initial ? "Save" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s.includes("wait")) return <Badge variant="waiting">Waiting</Badge>;
  if (s.includes("complete"))
    return <Badge variant="completed">Completed</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

function MeetingsPageInner() {
  const searchParams = useSearchParams();
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MeetingRow | null>(null);
  const [createdShare, setCreatedShare] = useState<{
    shareUrl: string;
    title: string;
    meetingId: string;
    invite?: {
      sent: boolean;
      to?: string;
      reason?: string;
      message?: string;
    };
  } | null>(null);
  const [shareTarget, setShareTarget] = useState<MeetingRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setEditTarget(null);
      setCreateOpen(true);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    try {
      const [mRes, kbRes] = await Promise.all([
        fetch("/api/meetings?limit=100"),
        fetch("/api/knowledge-bases"),
      ]);
      const mData = await mRes.json();
      const kbData = await kbRes.json();
      if (mData.success) setMeetings(mData.meetings);
      if (kbData.success) {
        setKnowledgeBases(
          kbData.knowledgeBases.map((k: { id: string; name: string }) => ({
            id: k.id,
            name: k.name,
          })),
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyLink = (slug: string) => {
    const url = clientMeetingShareUrl(slug);
    void navigator.clipboard.writeText(url).then(
      () => {
        setToast("Link copied");
        window.setTimeout(() => setToast(null), 2200);
      },
      () => setToast("Could not copy"),
    );
  };

  const deactivate = async (slug: string) => {
    if (
      !confirm(
        "Deactivate this meeting link? Guests will no longer be able to join.",
      )
    )
      return;
    try {
      const res = await fetch(`/api/meetings/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (res.ok) void load();
    } catch (e) {
      console.error(e);
    }
  };

  const iconBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-slate-100";
  const iconDanger =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-40";

  return (
    <div>
      <PageHeader
        title="Meeting links"
        subtitle="Create shareable links for guest sessions"
        action={
          <button
            type="button"
            onClick={() => {
              setEditTarget(null);
              setCreateOpen(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Create meeting link
          </button>
        }
      />

      <MeetingFormModal
        open={createOpen || !!editTarget}
        onClose={() => {
          setCreateOpen(false);
          setEditTarget(null);
        }}
        knowledgeBases={knowledgeBases}
        initial={editTarget}
        onSaved={load}
        onCreateSuccess={(p) => {
          setCreatedShare(p);
          if (p.invite?.sent && p.invite.to) {
            setToast(`Invite sent to ${p.invite.to}`);
            window.setTimeout(() => setToast(null), 3200);
          } else if (p.invite && !p.invite.sent) {
            const msg =
              p.invite.reason === "invalid_email"
                ? "Invalid email — meeting was still created."
                : p.invite.message ||
                  "Invite was not sent — meeting was still created.";
            setToast(msg);
            window.setTimeout(() => setToast(null), 4200);
          }
        }}
      />

      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-lg border border-slate-200 bg-primary px-4 py-2 text-sm text-primary shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      {createdShare ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-primary p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-primary">
              Meeting link ready
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-secondary">
              Share this URL with guests. It uses your configured public domain
              when set (
              <code className="text-xs text-primary">NEXT_PUBLIC_APP_URL</code>
              ).
            </p>
            {createdShare.invite?.sent && createdShare.invite.to ? (
              <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                An invite email with a join button was sent to{" "}
                <span className="font-medium">{createdShare.invite.to}</span>.
              </p>
            ) : null}
            {createdShare.invite && !createdShare.invite.sent ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {createdShare.invite.reason === "invalid_email"
                  ? "That email address looked invalid, so no message was sent."
                  : createdShare.invite.message ||
                    "No invite email was sent. You can still share the link below."}
              </p>
            ) : null}
            <div className="mt-6">
              <MeetingShareToolkit
                shareUrl={createdShare.shareUrl}
                meetingTitle={createdShare.title}
              />
            </div>
            <Button
              type="button"
              variant="primary"
              className="mt-6 w-full"
              onClick={() => setCreatedShare(null)}
            >
              Done
            </Button>
          </div>
        </div>
      ) : null}

      {shareTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-primary p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-primary">
                Share meeting
              </h2>
              <button
                type="button"
                onClick={() => setShareTarget(null)}
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Close
              </button>
            </div>
            <MeetingShareToolkit
              shareUrl={clientMeetingShareUrl(shareTarget.meetingId)}
              meetingTitle={shareTarget.title}
            />
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2
            className="h-8 w-8 animate-spin text-slate-400"
            aria-label="Loading"
          />
        </div>
      ) : meetings.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No meeting links yet"
          description="Create a link to invite guests to an AI avatar session."
        >
          <button
            type="button"
            onClick={() => {
              setEditTarget(null);
              setCreateOpen(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Create meeting link
          </button>
        </EmptyState>
      ) : (
        <DataTableCard>
          <DataTable>
            <DataTableHead>
              <DataTableHeaderCell>Title</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Created</DataTableHeaderCell>
              <DataTableHeaderCell>Sessions</DataTableHeaderCell>
              <DataTableHeaderCell>Active</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {meetings.map((m) => (
                <DataTableRow key={m.meetingId}>
                  <DataTableCell>
                    <Link
                      href={`/dashboard/meetings/${encodeURIComponent(m.meetingId)}`}
                      className="font-medium text-primary hover:text-brand-600"
                    >
                      {m.title}
                    </Link>
                  </DataTableCell>
                  <DataTableCell>{statusBadge(m.status)}</DataTableCell>
                  <DataTableCell className="whitespace-nowrap text-tertiary">
                    {format(new Date(m.createdAt), "MMM d, yyyy · h:mm a")}
                  </DataTableCell>
                  <DataTableCell>{m.sessionCount}</DataTableCell>
                  <DataTableCell>
                    {m.isActive ? (
                      <Badge variant="active">Yes</Badge>
                    ) : (
                      <Badge variant="completed">No</Badge>
                    )}
                  </DataTableCell>
                  <DataTableCell align="right">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <button
                        type="button"
                        className={iconBtn}
                        title="Copy link"
                        onClick={() => copyLink(m.meetingId)}
                      >
                        <Copy className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        title="Share"
                        onClick={() => setShareTarget(m)}
                      >
                        <Share2 className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        title="Edit"
                        onClick={() => setEditTarget(m)}
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                      <Link
                        href={`/dashboard/meetings/${encodeURIComponent(m.meetingId)}`}
                        className={iconBtn}
                        title="View sessions"
                      >
                        <Eye className="h-4 w-4" strokeWidth={1.75} />
                      </Link>
                      <button
                        type="button"
                        className={iconDanger}
                        title="Deactivate"
                        disabled={!m.isActive}
                        onClick={() => deactivate(m.meetingId)}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </DataTableCard>
      )}
    </div>
  );
}

export default function MeetingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2
            className="h-8 w-8 animate-spin text-slate-400"
            aria-label="Loading"
          />
        </div>
      }
    >
      <MeetingsPageInner />
    </Suspense>
  );
}
