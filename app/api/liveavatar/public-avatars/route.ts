import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/middleware";
import { fetchLiveAvatarPublicAvatars } from "@/lib/liveavatar/fetchPublicAvatars";
import { liveAvatarPublicToCatalogItem } from "@/lib/liveavatar/mapToCatalogItem";

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("page_size") || "20", 10) || 20),
    );

    const result = await fetchLiveAvatarPublicAvatars(page, pageSize);

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
        },
        { status: result.status >= 400 && result.status < 600 ? result.status : 502 },
      );
    }

    const avatars = result.results.map(liveAvatarPublicToCatalogItem);

    return NextResponse.json({
      success: true,
      avatars,
      count: result.count,
      next: result.next,
      previous: result.previous,
      page,
      page_size: pageSize,
    });
  } catch (error) {
    console.error("[api/liveavatar/public-avatars]", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { success: false, message: "Failed to load LiveAvatar gallery" },
      { status: 500 },
    );
  }
}
