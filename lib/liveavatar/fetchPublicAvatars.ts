/**
 * LiveAvatar public catalog — GET /v1/avatars/public (no auth per OpenAPI).
 * Optional LIVEAVATAR_API_KEY as X-API-KEY.
 */

export type LiveAvatarPublicAvatar = {
  id: string;
  name: string;
  preview_url?: string;
  type?: string;
  default_voice?: { id?: string; name?: string };
};

export type LiveAvatarPublicListOk = {
  ok: true;
  count: number;
  results: LiveAvatarPublicAvatar[];
  next: string | null;
  previous: string | null;
};

export type LiveAvatarPublicListResult =
  | LiveAvatarPublicListOk
  | { ok: false; message: string; status: number };

const DEFAULT_BASE = "https://api.liveavatar.com";

function resolveBase(): string {
  const raw =
    process.env.LIVEAVATAR_API_BASE_URL?.trim() || DEFAULT_BASE;
  return raw.replace(/\/$/, "");
}

export async function fetchLiveAvatarPublicAvatars(
  page: number,
  pageSize: number,
): Promise<LiveAvatarPublicListResult> {
  const base = resolveBase();
  const url = new URL(`${base}/v1/avatars/public`);
  url.searchParams.set("page", String(Math.max(1, page)));
  url.searchParams.set(
    "page_size",
    String(Math.min(100, Math.max(1, pageSize))),
  );

  const headers: Record<string, string> = { Accept: "application/json" };
  const key = process.env.LIVEAVATAR_API_KEY?.trim();
  if (key) {
    headers["X-API-KEY"] = key;
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), { headers, cache: "no-store" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, message: msg, status: 502 };
  }

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    return {
      ok: false,
      message: "Invalid JSON from LiveAvatar",
      status: res.ok ? 502 : res.status,
    };
  }

  if (!res.ok) {
    const message =
      typeof (body as { message?: string })?.message === "string"
        ? (body as { message: string }).message
        : `LiveAvatar HTTP ${res.status}`;
    return { ok: false, message, status: res.status };
  }

  const data = (body as { data?: unknown })?.data;
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      message: "LiveAvatar response missing data",
      status: 502,
    };
  }

  const d = data as {
    count?: number;
    results?: unknown;
    next?: unknown;
    previous?: unknown;
  };

  const rawResults = Array.isArray(d.results) ? d.results : [];
  const results: LiveAvatarPublicAvatar[] = [];

  for (const item of rawResults) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!id) continue;
    const row: LiveAvatarPublicAvatar = {
      id,
      name: name || id,
    };
    if (typeof o.preview_url === "string" && o.preview_url.trim()) {
      row.preview_url = o.preview_url.trim();
    }
    if (typeof o.type === "string") row.type = o.type;
    const dv = o.default_voice;
    if (dv && typeof dv === "object" && !Array.isArray(dv)) {
      const v = dv as Record<string, unknown>;
      row.default_voice = {
        id: typeof v.id === "string" ? v.id : undefined,
        name: typeof v.name === "string" ? v.name : undefined,
      };
    }
    results.push(row);
  }

  const count = typeof d.count === "number" ? d.count : results.length;
  const next =
    typeof d.next === "string" && d.next.trim() ? d.next.trim() : null;
  const previous =
    typeof d.previous === "string" && d.previous.trim()
      ? d.previous.trim()
      : null;

  return { ok: true, count, results, next, previous };
}
