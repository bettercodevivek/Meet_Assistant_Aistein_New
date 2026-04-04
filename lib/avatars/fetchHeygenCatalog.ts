import { normalizeAvatarListPayload } from "@/lib/avatars/normalizeHeyGenAvatars";
import type { HeyGenAvatarCatalogItem } from "@/lib/avatars/types";

const DEFAULT_HEYGEN_API_ORIGIN = "https://api.heygen.com";

/** Strip trailing `/v1` or `/v2` so we do not build `/v1/v1/...` URLs. */
export function normalizeHeygenApiBase(raw: string): string {
  let u = raw.trim().replace(/\/+$/, "");
  u = u.replace(/\/v[12]$/i, "");
  return u;
}

export function resolveHeygenApiBaseUrl(): string {
  const fromEnv =
    process.env.HEYGEN_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_API_URL?.trim();
  return normalizeHeygenApiBase(fromEnv || DEFAULT_HEYGEN_API_ORIGIN);
}

export function heygenRequestHeaders(apiKey: string): HeadersInit {
  return {
    "x-api-key": apiKey,
    Accept: "application/json",
  };
}

function extractRowsFromListJson(json: unknown): unknown[] {
  if (!json || typeof json !== "object" || json === null) return [];
  const data = (json as { data?: unknown }).data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && data !== null) {
    const d = data as {
      results?: unknown;
      avatars?: unknown;
    };
    if (Array.isArray(d.results)) return d.results;
    if (Array.isArray(d.avatars)) return d.avatars;
  }
  if (Array.isArray((json as { avatars?: unknown }).avatars)) {
    return (json as { avatars: unknown[] }).avatars;
  }
  return [];
}

/** Shared GET + JSON for HeyGen routes (details, catalog fallbacks). */
export async function heygenApiGetJson(
  url: string,
  apiKey: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, {
    method: "GET",
    headers: heygenRequestHeaders(apiKey),
    cache: "no-store",
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

/**
 * Paginated public catalog — response uses data.results or data as array; each row's `id` is the avatar id.
 */
async function fetchAllV1AvatarsPublic(
  base: string,
  apiKey: string,
): Promise<unknown | null> {
  const pageSize = 100;
  const maxPages = 50;
  const merged: unknown[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = `${base}/v1/avatars/public?page=${page}&page_size=${pageSize}`;
    const { ok, body } = await heygenApiGetJson(url, apiKey);
    if (!ok) {
      if (page === 1) return null;
      break;
    }
    const batch = extractRowsFromListJson(body);
    merged.push(...batch);
    if (batch.length < pageSize) break;
  }

  if (merged.length === 0) return null;
  return { code: 100, data: { results: merged } };
}

async function fetchOneShotList(
  base: string,
  path: string,
  apiKey: string,
): Promise<unknown | null> {
  const { ok, body } = await heygenApiGetJson(`${base}${path}`, apiKey);
  if (!ok || body == null) return null;
  const rows = extractRowsFromListJson(body);
  if (rows.length === 0 && body && typeof body === "object") {
    const avatars = normalizeAvatarListPayload(body);
    if (avatars.length > 0) return body;
    return null;
  }
  if (rows.length === 0) return null;
  return body;
}

export type HeygenCatalogResult =
  | { ok: true; avatars: HeyGenAvatarCatalogItem[]; source: string }
  | { ok: false; message: string; status: number };

/**
 * Tries HeyGen list endpoints in order until normalization yields avatars.
 * Uses HEYGEN_API_BASE_URL, else NEXT_PUBLIC_BASE_API_URL, else https://api.heygen.com
 */
export async function loadHeygenAvatarCatalog(apiKey: string): Promise<HeygenCatalogResult> {
  const base = resolveHeygenApiBaseUrl();

  const steps: Array<{ source: string; run: () => Promise<unknown | null> }> = [
    {
      source: "v1/avatars/public",
      run: () => fetchAllV1AvatarsPublic(base, apiKey),
    },
    {
      source: "v1/public/avatars",
      run: () => fetchOneShotList(base, "/v1/public/avatars", apiKey),
    },
    {
      source: "v1/streaming/avatar.list",
      run: () => fetchOneShotList(base, "/v1/streaming/avatar.list", apiKey),
    },
    {
      source: "v2/avatars",
      run: () => fetchOneShotList(base, "/v2/avatars", apiKey),
    },
  ];

  let lastStatus = 502;
  let lastSnippet = "";

  for (const { source, run } of steps) {
    try {
      const raw = await run();
      if (!raw) continue;
      const avatars = normalizeAvatarListPayload(raw);
      if (avatars.length > 0) {
        return { ok: true, avatars, source };
      }
    } catch (e) {
      console.warn(`[avatars] ${source} threw:`, e);
    }
  }

  const probe = await heygenApiGetJson(`${base}/v2/avatars`, apiKey);
  lastStatus = probe.status;
  lastSnippet =
    typeof probe.body === "object" && probe.body !== null
      ? JSON.stringify(probe.body).slice(0, 280)
      : "";

  return {
    ok: false,
    status: lastStatus,
    message: `Could not load any avatar list from HeyGen (base ${base}). Last /v2/avatars status=${lastStatus}. ${lastSnippet}`,
  };
}
