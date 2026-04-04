import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/middleware';
import { extractLiveAvatarUuidFromHeyGenDetailsBody } from '@/lib/avatars/extractHeyGenLiveAvatarUuid';
import { resolveHeygenApiBaseUrl } from '@/lib/avatars/fetchHeygenCatalog';
import { getHeyGenLiveAvatarUuidFromMap } from '@/lib/avatars/heygenLiveAvatarUuidMap';
import {
  resolveUuidFromV1PublicAvatarsPages,
  resolveUuidFromV2AvatarsList,
} from '@/lib/avatars/resolveHeygenAvatarLiveUuid';
import { parseLiveAvatarAvatarUuid } from '@/lib/livekit/liveAvatarAvatarId';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

export type AvatarDetailsResolvedFrom =
  | 'avatar_id'
  | 'env_map'
  | 'heygen_details'
  | 'catalog_v2'
  | 'catalog_public'
  | null;

/**
 * GET — Resolve LiveAvatar UUID for an avatar id (UUID or legacy HeyGen `*_public` string).
 * Uses the same API base as /api/avatars (HEYGEN_API_BASE_URL → NEXT_PUBLIC → api.heygen.com).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ avatarId: string }> },
) {
  try {
    requireAuth(request);

    if (!HEYGEN_API_KEY?.trim()) {
      return NextResponse.json(
        { success: false, message: 'HEYGEN_API_KEY is not configured' },
        { status: 500 },
      );
    }

    const apiKey = HEYGEN_API_KEY.trim();
    const base = resolveHeygenApiBaseUrl();

    const { avatarId: rawParam } = await params;
    const avatarId = decodeURIComponent(rawParam || '').trim();
    if (!avatarId) {
      return NextResponse.json(
        { success: false, message: 'avatarId is required' },
        { status: 400 },
      );
    }

    const asUuid = parseLiveAvatarAvatarUuid(avatarId);
    if (asUuid) {
      return NextResponse.json({
        success: true,
        liveAvatarAvatarUuid: asUuid,
        resolvedFrom: 'avatar_id' satisfies AvatarDetailsResolvedFrom,
      });
    }

    const fromMap = getHeyGenLiveAvatarUuidFromMap(avatarId);
    if (fromMap) {
      return NextResponse.json({
        success: true,
        liveAvatarAvatarUuid: fromMap,
        resolvedFrom: 'env_map' satisfies AvatarDetailsResolvedFrom,
      });
    }

    const url = `${base}/v2/avatar/${encodeURIComponent(avatarId)}/details`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    let liveAvatarAvatarUuid: string | null = res.ok
      ? extractLiveAvatarUuidFromHeyGenDetailsBody(body)
      : null;
    let resolvedFrom: AvatarDetailsResolvedFrom = liveAvatarAvatarUuid ? 'heygen_details' : null;

    if (!liveAvatarAvatarUuid) {
      const fromV2 = await resolveUuidFromV2AvatarsList(avatarId, apiKey);
      if (fromV2) {
        liveAvatarAvatarUuid = fromV2;
        resolvedFrom = 'catalog_v2';
      }
    }

    if (!liveAvatarAvatarUuid) {
      const fromPub = await resolveUuidFromV1PublicAvatarsPages(avatarId, apiKey);
      if (fromPub) {
        liveAvatarAvatarUuid = fromPub;
        resolvedFrom = 'catalog_public';
      }
    }

    if (!res.ok && liveAvatarAvatarUuid == null) {
      return NextResponse.json({
        success: true,
        liveAvatarAvatarUuid: null,
        resolvedFrom: null,
        heygenStatus: res.status,
        message:
          'HeyGen avatar details request failed — use a gallery avatar whose id is a UUID, or set HEYGEN_LIVEAVATAR_UUID_MAP',
      });
    }

    return NextResponse.json({
      success: true,
      liveAvatarAvatarUuid,
      resolvedFrom,
      heygenDetailsOk: res.ok,
      message:
        liveAvatarAvatarUuid == null
          ? 'HeyGen did not return a LiveAvatar UUID for this id. Use Gallery avatars from /v1/avatars/public (UUID id) or HEYGEN_LIVEAVATAR_UUID_MAP.'
          : undefined,
    });
  } catch (error) {
    console.error('HeyGen avatar details error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to load avatar details' },
      { status: 500 },
    );
  }
}
