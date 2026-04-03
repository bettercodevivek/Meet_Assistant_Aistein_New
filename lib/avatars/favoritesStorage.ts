import { AVATARS } from "@/app/lib/constants";

import type { HeyGenAvatarCatalogItem } from "@/lib/avatars/types";

export const FAVORITE_AVATARS_STORAGE_KEY = "meetassistant:favoriteAvatarsV1";

export type FavoriteAvatar = { id: string; name: string };

const MAX_FAVORITES = 5;

/** Stable defaults for SSR and the first client paint — avoids hydration mismatches. Real prefs load after mount. */
export function defaultFavoriteAvatars(): FavoriteAvatar[] {
  return AVATARS.slice(0, MAX_FAVORITES).map((a) => ({
    id: a.avatar_id,
    name: a.name,
  }));
}

export function readFavoriteAvatars(): FavoriteAvatar[] {
  if (typeof window === "undefined") {
    return defaultFavoriteAvatars();
  }
  try {
    const raw = localStorage.getItem(FAVORITE_AVATARS_STORAGE_KEY);
    if (!raw) {
      const seeded = defaultFavoriteAvatars();
      localStorage.setItem(
        FAVORITE_AVATARS_STORAGE_KEY,
        JSON.stringify(seeded),
      );
      return seeded;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      const seeded = defaultFavoriteAvatars();
      localStorage.setItem(
        FAVORITE_AVATARS_STORAGE_KEY,
        JSON.stringify(seeded),
      );
      return seeded;
    }
    const cleaned = parsed
      .filter(
        (x): x is FavoriteAvatar =>
          !!x &&
          typeof (x as FavoriteAvatar).id === "string" &&
          typeof (x as FavoriteAvatar).name === "string",
      )
      .slice(0, MAX_FAVORITES);
    if (cleaned.length === 0) {
      const seeded = defaultFavoriteAvatars();
      localStorage.setItem(
        FAVORITE_AVATARS_STORAGE_KEY,
        JSON.stringify(seeded),
      );
      return seeded;
    }
    return cleaned;
  } catch {
    const seeded = defaultFavoriteAvatars();
    try {
      localStorage.setItem(
        FAVORITE_AVATARS_STORAGE_KEY,
        JSON.stringify(seeded),
      );
    } catch {
      /* ignore */
    }
    return seeded;
  }
}

export function writeFavoriteAvatars(items: FavoriteAvatar[]): void {
  if (typeof window === "undefined") return;
  const next = items.slice(0, MAX_FAVORITES);
  localStorage.setItem(FAVORITE_AVATARS_STORAGE_KEY, JSON.stringify(next));
}

export function removeFavoriteAvatar(
  current: FavoriteAvatar[],
  id: string,
): FavoriteAvatar[] {
  return current.filter((f) => f.id !== id);
}

export function toggleFavoriteAvatar(
  current: FavoriteAvatar[],
  item: Pick<HeyGenAvatarCatalogItem, "avatar_id" | "avatar_name">,
): FavoriteAvatar[] {
  const id = item.avatar_id;
  if (current.some((f) => f.id === id)) {
    return current.filter((f) => f.id !== id);
  }
  if (current.length >= MAX_FAVORITES) {
    return current;
  }
  return [...current, { id, name: item.avatar_name }];
}

export const MEETING_AVATAR_PICK_LIMIT = MAX_FAVORITES;
