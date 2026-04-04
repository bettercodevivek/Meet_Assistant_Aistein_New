import type { HeyGenAvatarCatalogItem } from "@/lib/avatars/types";

export type FavoriteAvatar = {
  id: string;
  name: string;
  /** LiveAvatar UUID when known (public catalog ids are UUIDs). */
  liveAvatarAvatarUuid?: string;
};

const MAX_FAVORITES = 5;

export function removeFavoriteAvatar(
  current: FavoriteAvatar[],
  id: string,
): FavoriteAvatar[] {
  return current.filter((f) => f.id !== id);
}

export function toggleFavoriteAvatar(
  current: FavoriteAvatar[],
  item: Pick<
    HeyGenAvatarCatalogItem,
    "avatar_id" | "avatar_name" | "live_avatar_avatar_uuid"
  >,
): FavoriteAvatar[] {
  const id = item.avatar_id;
  if (current.some((f) => f.id === id)) {
    return current.filter((f) => f.id !== id);
  }
  if (current.length >= MAX_FAVORITES) {
    return current;
  }
  const next: FavoriteAvatar = { id, name: item.avatar_name };
  const u = item.live_avatar_avatar_uuid;
  if (typeof u === "string" && u.trim()) {
    next.liveAvatarAvatarUuid = u.trim();
  }
  return [...current, next];
}

export const MEETING_AVATAR_PICK_LIMIT = MAX_FAVORITES;
