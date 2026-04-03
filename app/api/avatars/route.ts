import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/middleware";
import { normalizeAvatarListPayload } from "@/lib/avatars/normalizeHeyGenAvatars";

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

function baseApiUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_BASE_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

async function fetchPublicAvatars(base: string, apiKey: string): Promise<Response> {
  return fetch(`${base}/v1/public/avatars`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });
}

async function fetchV2Avatars(base: string, apiKey: string): Promise<Response> {
  return fetch(`${base}/v2/avatars`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });
}

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);

    if (!HEYGEN_API_KEY) {
      return NextResponse.json(
        { success: false, message: "HEYGEN_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const base = baseApiUrl();
    if (!base) {
      return NextResponse.json(
        { success: false, message: "NEXT_PUBLIC_BASE_API_URL is not configured" },
        { status: 500 },
      );
    }

    let res = await fetchPublicAvatars(base, HEYGEN_API_KEY);
    let body: unknown = null;

    if (res.ok) {
      body = await res.json();
    } else {
      const errText = await res.text().catch(() => "");
      console.warn(
        "GET /v1/public/avatars failed:",
        res.status,
        errText.slice(0, 200),
      );
      res = await fetchV2Avatars(base, HEYGEN_API_KEY);
      if (!res.ok) {
        const fallbackText = await res.text().catch(() => "");
        console.error("GET /v2/avatars failed:", res.status, fallbackText.slice(0, 200));
        return NextResponse.json(
          {
            success: false,
            message: "Could not load avatars from HeyGen API",
          },
          { status: res.status >= 400 ? res.status : 502 },
        );
      }
      body = await res.json();
    }

    let avatars = normalizeAvatarListPayload(body);
    if (avatars.length === 0 && res.ok) {
      const v2 = await fetchV2Avatars(base, HEYGEN_API_KEY);
      if (v2.ok) {
        body = await v2.json();
        avatars = normalizeAvatarListPayload(body);
      }
    }

    if (avatars.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "HeyGen returned no avatars — check API response shape",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, avatars });
  } catch (error) {
    console.error("Get avatars catalog error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { success: false, message: "Failed to load avatar catalog" },
      { status: 500 },
    );
  }
}
