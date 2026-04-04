import type { HeyGenAvatarCatalogItem } from "@/lib/avatars/types";
import { parseLiveAvatarAvatarUuid } from "@/lib/livekit/liveAvatarAvatarId";

import type { LiveAvatarPublicAvatar } from "./fetchPublicAvatars";

/** Map LiveAvatar public API row to the gallery card shape. */
export function liveAvatarPublicToCatalogItem(
  item: LiveAvatarPublicAvatar,
): HeyGenAvatarCatalogItem {
  const uuid = parseLiveAvatarAvatarUuid(item.id);
  return {
    avatar_id: item.id,
    avatar_name: item.name || item.id,
    gender: "",
    preview_image_url: item.preview_url?.trim() || "",
    preview_video_url: "",
    premium: false,
    type: item.type ?? null,
    tags: null,
    default_voice_id: item.default_voice?.id?.trim() || null,
    live_avatar_avatar_uuid: uuid,
  };
}
