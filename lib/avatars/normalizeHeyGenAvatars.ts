import type { HeyGenAvatarCatalogItem } from "@/lib/avatars/types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Normalize HeyGen / LiveAvatar list responses to the gallery catalog shape.
 * Supports:
 * - GET /v2/avatars → { error, data: { avatars, talking_photos } }
 * - GET /v1/public/avatars (varies) — common patterns: data.avatars, data as array
 */
export function normalizeAvatarListPayload(body: unknown): HeyGenAvatarCatalogItem[] {
  if (!isRecord(body)) return [];

  const data = body.data;
  let raw: unknown[] = [];

  if (isRecord(data)) {
    const avatars = data.avatars;
    if (Array.isArray(avatars)) {
      raw = avatars;
    }
  } else if (Array.isArray(data)) {
    raw = data;
  } else if (Array.isArray(body.avatars)) {
    raw = body.avatars;
  }

  const out: HeyGenAvatarCatalogItem[] = [];

  for (const item of raw) {
    if (!isRecord(item)) continue;

    const avatarId = typeof item.avatar_id === "string" ? item.avatar_id : null;

    if (!avatarId?.trim()) continue;

    const name =
      typeof item.avatar_name === "string"
        ? item.avatar_name
        : typeof item.pose_name === "string"
          ? item.pose_name
          : avatarId;

    const previewImage =
      typeof item.preview_image_url === "string"
        ? item.preview_image_url
        : typeof item.normal_preview === "string"
          ? item.normal_preview
          : "";

    const previewVideo =
      typeof item.preview_video_url === "string" ? item.preview_video_url : "";

    const gender = typeof item.gender === "string" ? item.gender : "";
    const premium = typeof item.premium === "boolean" ? item.premium : false;
    const type = item.type === null || typeof item.type === "string" ? item.type : null;
    const tags = item.tags ?? null;
    const defaultVoice =
      item.default_voice_id === null || typeof item.default_voice_id === "string"
        ? item.default_voice_id
        : typeof item.default_voice === "string"
          ? item.default_voice
          : null;

    out.push({
      avatar_id: avatarId,
      avatar_name: name,
      gender,
      preview_image_url: previewImage,
      preview_video_url: previewVideo,
      premium,
      type,
      tags,
      default_voice_id: defaultVoice,
    });
  }

  return out;
}
