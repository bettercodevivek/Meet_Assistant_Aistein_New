import { parseLiveAvatarAvatarUuid } from '@/lib/livekit/liveAvatarAvatarId';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Keys HeyGen / partner payloads may use for LiveAvatar session UUIDs */
const DIRECT_KEYS = [
  'live_avatar_avatar_uuid',
  'liveavatar_avatar_uuid',
  'live_avatar_id',
  'default_live_avatar_id',
  'streaming_avatar_uuid',
  'interactive_avatar_id',
  'avatar_uuid',
  'uuid',
  'id',
] as const;

const NEST_KEYS = ['live_avatar', 'liveavatar', 'liveAvatar', 'meta', 'extra'] as const;

/**
 * Best-effort UUID extraction from a HeyGen avatar object (list item or details `data`).
 */
export function extractLiveAvatarUuidFromHeyGenRecord(
  item: Record<string, unknown>,
): string | null {
  for (const key of DIRECT_KEYS) {
    const v = item[key];
    if (typeof v === 'string') {
      const p = parseLiveAvatarAvatarUuid(v);
      if (p) return p;
    }
  }

  for (const nestKey of NEST_KEYS) {
    const nested = item[nestKey];
    if (isRecord(nested)) {
      const p = extractLiveAvatarUuidFromHeyGenRecord(nested);
      if (p) return p;
    }
  }

  return null;
}

const DEEP_SCAN_MAX_DEPTH = 14;
const DEEP_SCAN_MAX_NODES = 600;

function deepScanForLiveAvatarUuid(
  value: unknown,
  depth: number,
  nodes: { n: number },
): string | null {
  if (nodes.n > DEEP_SCAN_MAX_NODES) return null;
  nodes.n += 1;
  if (depth > DEEP_SCAN_MAX_DEPTH) return null;
  if (typeof value === 'string') {
    return parseLiveAvatarAvatarUuid(value);
  }
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const el of value) {
      const r = deepScanForLiveAvatarUuid(el, depth + 1, nodes);
      if (r) return r;
    }
    return null;
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    const r = deepScanForLiveAvatarUuid(v, depth + 1, nodes);
    if (r) return r;
  }
  return null;
}

/** Parse GET /v2/avatar/{id}/details (or similar) JSON body */
export function extractLiveAvatarUuidFromHeyGenDetailsBody(
  body: unknown,
): string | null {
  if (!isRecord(body)) return null;
  if (isRecord(body.data)) {
    const d = extractLiveAvatarUuidFromHeyGenRecord(body.data);
    if (d) return d;
  }
  const shallow = extractLiveAvatarUuidFromHeyGenRecord(body);
  if (shallow) return shallow;
  return deepScanForLiveAvatarUuid(body, 0, { n: 0 });
}
