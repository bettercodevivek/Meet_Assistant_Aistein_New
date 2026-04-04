import { parseLiveAvatarAvatarUuid } from '@/lib/livekit/liveAvatarAvatarId';

let cachedMap: Record<string, string> | null | undefined;

function loadMap(): Record<string, string> | null {
  if (cachedMap !== undefined) return cachedMap;
  const raw = process.env.HEYGEN_LIVEAVATAR_UUID_MAP?.trim();
  if (!raw) {
    cachedMap = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      cachedMap = null;
      return null;
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const key = k.trim();
      if (!key || typeof v !== 'string') continue;
      const uuid = parseLiveAvatarAvatarUuid(v);
      if (uuid) out[key] = uuid;
    }
    cachedMap = Object.keys(out).length ? out : null;
    return cachedMap;
  } catch {
    cachedMap = null;
    return null;
  }
}

/** Optional JSON map in HEYGEN_LIVEAVATAR_UUID_MAP: { "heygen_avatar_id": "uuid" } */
export function getHeyGenLiveAvatarUuidFromMap(avatarId: string): string | null {
  const id = avatarId.trim();
  if (!id) return null;
  const map = loadMap();
  if (!map) return null;
  const direct = map[id];
  if (direct) return direct;
  const lower = id.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}
