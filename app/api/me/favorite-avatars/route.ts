import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/middleware";
import { authUserObjectId } from "@/lib/auth/userObjectId";
import type { FavoriteAvatar } from "@/lib/avatars/favoritesStorage";
import connectDB from "@/lib/db/mongodb";
import User from "@/lib/db/models/User";
import { parseLiveAvatarAvatarUuid } from "@/lib/livekit/liveAvatarAvatarId";

const MAX = 5;

function unauthorized() {
  return NextResponse.json(
    { success: false, message: "Unauthorized" },
    { status: 401 },
  );
}

function dbRowsToFavorites(
  rows: { id: string; name: string }[] | undefined,
): FavoriteAvatar[] {
  const list = Array.isArray(rows) ? rows : [];
  return list.slice(0, MAX).map((r) => {
    const id = String(r.id || "").trim();
    const name = String(r.name || "").trim() || id;
    const uuid = parseLiveAvatarAvatarUuid(id);
    const out: FavoriteAvatar = { id, name };
    if (uuid) {
      out.liveAvatarAvatarUuid = uuid;
    }
    return out;
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();
    const oid = authUserObjectId(user.userId);
    if (!oid) {
      return NextResponse.json(
        { success: false, message: "Invalid user" },
        { status: 400 },
      );
    }

    const doc = await User.findById(oid).select("favoriteLiveAvatars").lean();
    const favorites = dbRowsToFavorites(
      doc?.favoriteLiveAvatars as { id: string; name: string }[] | undefined,
    );

    return NextResponse.json({ success: true, favorites });
  } catch (error) {
    console.error("[api/me/favorite-avatars GET]", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    return NextResponse.json(
      { success: false, message: "Failed to load favorites" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = requireAuth(request);
    await connectDB();
    const oid = authUserObjectId(user.userId);
    if (!oid) {
      return NextResponse.json(
        { success: false, message: "Invalid user" },
        { status: 400 },
      );
    }

    const body = (await request.json()) as { favorites?: unknown };
    const raw = body.favorites;
    if (!Array.isArray(raw)) {
      return NextResponse.json(
        { success: false, message: "favorites must be an array" },
        { status: 400 },
      );
    }
    if (raw.length > MAX) {
      return NextResponse.json(
        { success: false, message: `At most ${MAX} favorite avatars` },
        { status: 400 },
      );
    }

    const cleaned: { id: string; name: string }[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const o = entry as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id.trim() : "";
      if (!id) continue;
      const name =
        typeof o.name === "string" && o.name.trim()
          ? o.name.trim()
          : id;
      cleaned.push({ id, name });
    }

    const saved = cleaned.slice(0, MAX);

    await User.findByIdAndUpdate(oid, {
      $set: { favoriteLiveAvatars: saved },
    });

    const favorites = dbRowsToFavorites(saved);

    return NextResponse.json({ success: true, favorites });
  } catch (error) {
    console.error("[api/me/favorite-avatars PATCH]", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }
    return NextResponse.json(
      { success: false, message: "Failed to save favorites" },
      { status: 500 },
    );
  }
}
