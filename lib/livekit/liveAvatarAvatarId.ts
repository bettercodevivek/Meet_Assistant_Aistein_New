/**
 * LiveAvatar session API (`api.liveavatar.com`) requires `avatar_id` to be a UUID.
 * HeyGen-style ids (e.g. `Amelia_standing_...`) must not be sent or the API returns 422.
 */
/** Standard 8-4-4-4-12 hex UUID (LiveAvatar rejects HeyGen-style string ids). */
const UUID_RE =
  /^(?:urn:uuid:)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLiveAvatarAvatarUuid(value: string | null | undefined): boolean {
  if (value == null || typeof value !== 'string') return false;
  const s = value.trim();
  if (!s) return false;
  const body = s.toLowerCase().startsWith('urn:uuid:') ? s.slice(9).trim() : s;
  return UUID_RE.test(body);
}

/** Returns lowercase hyphenated UUID or null if invalid. */
export function parseLiveAvatarAvatarUuid(
  value: string | null | undefined,
): string | null {
  if (value == null || typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  const body = s.toLowerCase().startsWith('urn:uuid:') ? s.slice(9).trim() : s;
  if (!UUID_RE.test(body)) return null;
  return body.toLowerCase();
}
