import { extractLiveAvatarUuidFromHeyGenRecord } from "@/lib/avatars/extractHeyGenLiveAvatarUuid";
import { heygenApiGetJson, resolveHeygenApiBaseUrl } from "@/lib/avatars/fetchHeygenCatalog";
import { parseLiveAvatarAvatarUuid } from "@/lib/livekit/liveAvatarAvatarId";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Row fields that may carry the same id as GET /v2/avatar/{avatar_id}/details */
const MATCH_KEYS = [
  "avatar_id",
  "slug",
  "external_id",
  "avatar_key",
  "streaming_avatar_id",
  "heygen_avatar_id",
  "pose_id",
] as const;

function rowReferencesAvatarId(row: Record<string, unknown>, avatarId: string): boolean {
  for (const k of MATCH_KEYS) {
    const v = row[k];
    if (typeof v === "string" && v === avatarId) return true;
  }
  return false;
}

function uuidFromAvatarRow(row: Record<string, unknown>): string | null {
  return (
    extractLiveAvatarUuidFromHeyGenRecord(row) ||
    (typeof row.id === "string" ? parseLiveAvatarAvatarUuid(row.id) : null)
  );
}

/**
 * /v2/avatars list rows sometimes include LiveAvatar fields that /v2/avatar/{id}/details omits.
 */
export async function resolveUuidFromV2AvatarsList(
  avatarId: string,
  apiKey: string,
): Promise<string | null> {
  const base = resolveHeygenApiBaseUrl();
  const { ok, body } = await heygenApiGetJson(`${base}/v2/avatars`, apiKey);
  if (!ok || !isRecord(body)) return null;
  const data = body.data;
  if (!isRecord(data) || !Array.isArray(data.avatars)) return null;
  for (const raw of data.avatars) {
    if (!isRecord(raw)) continue;
    if (raw.avatar_id !== avatarId) continue;
    const u = uuidFromAvatarRow(raw);
    if (u) return u;
  }
  return null;
}

/**
 * /v1/avatars/public rows use UUID `id`; some payloads also include a legacy HeyGen id on another key.
 */
export async function resolveUuidFromV1PublicAvatarsPages(
  avatarId: string,
  apiKey: string,
): Promise<string | null> {
  const base = resolveHeygenApiBaseUrl();
  const pageSize = 100;
  const maxPages = 50;
  for (let page = 1; page <= maxPages; page++) {
    const url = `${base}/v1/avatars/public?page=${page}&page_size=${pageSize}`;
    const { ok, body } = await heygenApiGetJson(url, apiKey);
    if (!ok) break;

    let rows: unknown[] = [];
    if (isRecord(body)) {
      const d = body.data;
      if (Array.isArray(d)) rows = d;
      else if (isRecord(d) && Array.isArray(d.results)) rows = d.results;
    }

    for (const raw of rows) {
      if (!isRecord(raw)) continue;
      if (!rowReferencesAvatarId(raw, avatarId)) continue;
      const u = uuidFromAvatarRow(raw);
      if (u) return u;
    }
    if (rows.length < pageSize) break;
  }
  return null;
}
