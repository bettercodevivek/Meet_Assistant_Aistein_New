import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/middleware";
import { loadHeygenAvatarCatalog, resolveHeygenApiBaseUrl } from "@/lib/avatars/fetchHeygenCatalog";

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);

    if (!HEYGEN_API_KEY?.trim()) {
      return NextResponse.json(
        { success: false, message: "HEYGEN_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const base = resolveHeygenApiBaseUrl();
    const result = await loadHeygenAvatarCatalog(HEYGEN_API_KEY.trim());

    if (!result.ok) {
      console.error("[api/avatars]", result.message);
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          hint: `Using HeyGen base: ${base}. Set HEYGEN_API_BASE_URL or NEXT_PUBLIC_BASE_API_URL if wrong.`,
        },
        { status: result.status >= 400 && result.status < 600 ? result.status : 502 },
      );
    }

    return NextResponse.json({
      success: true,
      avatars: result.avatars,
      source: result.source,
    });
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
