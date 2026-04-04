"use client";

import type { HeyGenAvatarCatalogItem } from "@/lib/avatars/types";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, X } from "lucide-react";

import { Input } from "@/components/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  MEETING_AVATAR_PICK_LIMIT,
  removeFavoriteAvatar,
  toggleFavoriteAvatar,
} from "@/lib/avatars/favoritesStorage";
import { useFavoriteAvatars } from "@/lib/avatars/useFavoriteAvatars";

const PAGE_SIZE = 20;

function AvatarPreviewCard({
  item,
  selected,
  canAdd,
  onToggle,
  hoverVideoId,
  onHoverChange,
}: {
  item: HeyGenAvatarCatalogItem;
  selected: boolean;
  canAdd: boolean;
  onToggle: () => void;
  hoverVideoId: string | null;
  onHoverChange: (id: string | null) => void;
}) {
  const showVideo =
    hoverVideoId === item.avatar_id && Boolean(item.preview_video_url?.trim());
  const hasImage = Boolean(item.preview_image_url?.trim());

  const atLimitBlocked = !selected && !canAdd;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow ${
        selected
          ? "border-brand-500 ring-2 ring-brand-500/25"
          : "border-slate-200 hover:border-slate-300"
      }`}
      onMouseEnter={() => onHoverChange(item.avatar_id)}
      onMouseLeave={() => onHoverChange(null)}
    >
      <div className="relative aspect-[3/4] bg-slate-100">
        {showVideo ? (
          <video
            key={item.avatar_id}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
            preload="metadata"
            src={item.preview_video_url}
          />
        ) : hasImage ? (
          <img
            alt=""
            className="h-full w-full object-cover"
            decoding="async"
            loading="lazy"
            src={item.preview_image_url}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-secondary">
            No preview
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-6 pt-12">
          <p className="line-clamp-2 text-center text-[11px] font-medium text-white drop-shadow-sm">
            {item.avatar_name}
          </p>
        </div>
        {selected ? (
          <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
            In list
          </span>
        ) : null}
      </div>
      <div className="shrink-0 border-t border-slate-200 bg-slate-50/90 p-2">
        <button
          className={`inline-flex min-h-[2.25rem] w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
            selected
              ? "bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50"
              : canAdd
                ? "bg-brand-600 text-white hover:bg-brand-700"
                : "cursor-not-allowed bg-slate-200 text-slate-600"
          }`}
          disabled={atLimitBlocked}
          title={
            selected
              ? "Remove from meeting avatars"
              : canAdd
                ? "Add to meeting avatars"
                : `You already have ${MEETING_AVATAR_PICK_LIMIT} avatars — remove one from the list above`
          }
          type="button"
          onClick={onToggle}
        >
          {selected ? (
            <>
              <X aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.25} />
              Remove
            </>
          ) : canAdd ? (
            <>
              <Plus aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.25} />
              Add to list
            </>
          ) : (
            <>Max {MEETING_AVATAR_PICK_LIMIT} — free a slot</>
          )}
        </button>
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const { favorites, setFavoritesAndPersist } = useFavoriteAvatars();
  const [catalog, setCatalog] = useState<HeyGenAvatarCatalogItem[] | null>(
    null,
  );
  const [totalCount, setTotalCount] = useState(0);
  const [nextPage, setNextPage] = useState(2);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [hoverVideoId, setHoverVideoId] = useState<string | null>(null);

  const fetchPage = useCallback(async (page: number, append: boolean) => {
    const res = await fetch(
      `/api/liveavatar/public-avatars?page=${page}&page_size=${PAGE_SIZE}`,
      { credentials: "include" },
    );
    const data = (await res.json()) as {
      success?: boolean;
      message?: string;
      avatars?: HeyGenAvatarCatalogItem[];
      count?: number;
    };

    if (!res.ok || !data.success || !Array.isArray(data.avatars)) {
      return {
        ok: false as const,
        message: data.message || "Could not load gallery",
      };
    }

    const avatars = data.avatars;

    let capTotalToLoaded = 0;
    setCatalog((prev) => {
      if (append && avatars.length === 0) {
        capTotalToLoaded = prev?.length ?? 0;
        return prev ?? [];
      }
      return append && prev ? [...prev, ...avatars] : avatars;
    });
    if (capTotalToLoaded > 0) {
      setTotalCount(capTotalToLoaded);
      return { ok: true as const };
    }

    if (typeof data.count === "number") {
      setTotalCount(data.count);
    } else if (!append) {
      setTotalCount(avatars.length);
    }
    setNextPage(page + 1);

    return { ok: true as const };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setCatalog(null);
    setTotalCount(0);
    setNextPage(2);

    void (async () => {
      const result = await fetchPage(1, false);
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = deferredQuery.trim().toLowerCase();

    if (!q) return catalog;

    return catalog.filter(
      (a) =>
        a.avatar_name.toLowerCase().includes(q) ||
        a.avatar_id.toLowerCase().includes(q),
    );
  }, [catalog, deferredQuery]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredQuery]);

  const slice = filtered.slice(0, visibleCount);
  const favoriteIds = new Set(favorites.map((f) => f.id));

  const catalogById = useMemo(() => {
    const m = new Map<string, HeyGenAvatarCatalogItem>();

    if (catalog) {
      for (const a of catalog) {
        m.set(a.avatar_id, a);
      }
    }

    return m;
  }, [catalog]);

  const hasMoreRemote =
    catalog != null &&
    (totalCount > 0 ? catalog.length < totalCount : catalog.length >= PAGE_SIZE);

  const loadMoreRemote = async () => {
    if (loadingMore || !hasMoreRemote) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const result = await fetchPage(nextPage, true);
      if (!result.ok) {
        setLoadError(result.message);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <PageHeader
        subtitle="LiveAvatar public catalog. Pick up to five — stored on your account for Create meeting link."
        title="Gallery"
      />

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Meeting avatars</p>
            <p className="text-sm text-secondary">
              {favorites.length} / {MEETING_AVATAR_PICK_LIMIT} selected — used
              in{" "}
              <Link
                className="font-medium text-brand-600 hover:text-brand-700"
                href="/dashboard/meetings"
              >
                Create meeting link
              </Link>
            </p>
          </div>
        </div>
        {favorites.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-3">
            {favorites.map((f) => {
              const meta = catalogById.get(f.id);

              return (
                <li
                  key={f.id}
                  className="relative flex w-[108px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    aria-label={`Remove ${f.name} from meeting avatars`}
                    className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/75 text-white shadow-md ring-1 ring-white/30 transition hover:bg-red-600 hover:ring-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                    title="Remove from meeting avatars"
                    type="button"
                    onClick={() =>
                      void setFavoritesAndPersist(
                        removeFavoriteAvatar(favorites, f.id),
                      )
                    }
                  >
                    <X aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                  <div className="relative aspect-[3/4] bg-slate-200">
                    {meta?.preview_image_url ? (
                      <img
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        src={meta.preview_image_url}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-1 text-center text-[10px] text-secondary">
                        No preview
                      </div>
                    )}
                  </div>
                  <p className="line-clamp-2 border-t border-slate-100 bg-slate-50/80 p-1.5 text-[10px] leading-tight text-primary">
                    {f.name}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
          Search
        </label>
        <Input
          placeholder="Filter by name or avatar id…"
          value={query}
          onChange={setQuery}
        />
        {catalog ? (
          <p className="mt-2 text-sm text-tertiary">
            Showing {slice.length} of {filtered.length}
            {deferredQuery.trim()
              ? ` (from ${catalog.length} loaded)`
              : ` avatars loaded`}
            {totalCount > catalog.length
              ? ` — ${totalCount} total in catalog`
              : null}
          </p>
        ) : null}
      </div>

      {loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : !catalog ? (
        <div className="flex justify-center py-20">
          <Loader2
            aria-label="Loading"
            className="h-8 w-8 animate-spin text-slate-400"
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {slice.map((item) => {
              const selected = favoriteIds.has(item.avatar_id);
              const canAdd =
                selected || favorites.length < MEETING_AVATAR_PICK_LIMIT;

              return (
                <AvatarPreviewCard
                  key={item.avatar_id}
                  canAdd={canAdd}
                  hoverVideoId={hoverVideoId}
                  item={item}
                  selected={selected}
                  onHoverChange={setHoverVideoId}
                  onToggle={() => {
                    const next = toggleFavoriteAvatar(favorites, item);

                    void setFavoritesAndPersist(next);
                  }}
                />
              );
            })}
          </div>
          {visibleCount < filtered.length ? (
            <div className="mt-8 flex justify-center">
              <button
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm hover:bg-slate-50"
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Show more (filter)
              </button>
            </div>
          ) : null}
          {visibleCount >= filtered.length && hasMoreRemote ? (
            <div className="mt-8 flex justify-center">
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm hover:bg-slate-50 disabled:opacity-50"
                disabled={loadingMore}
                type="button"
                onClick={() => void loadMoreRemote()}
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Load more from LiveAvatar
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
