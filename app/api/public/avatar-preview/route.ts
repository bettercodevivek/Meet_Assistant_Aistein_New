import { NextRequest, NextResponse } from 'next/server';

import { fetchLiveAvatarPublicAvatars } from '@/lib/liveavatar/fetchPublicAvatars';
import { parseLiveAvatarAvatarUuid } from '@/lib/livekit/liveAvatarAvatarId';

/**
 * Public GET — resolve preview image URL for a LiveAvatar UUID (lobby hero, no auth).
 * Searches the public catalog (paginated) for a matching avatar id.
 */
export async function GET(request: NextRequest) {
  try {
    const uuid = request.nextUrl.searchParams.get('uuid')?.trim() ?? '';
    const parsed = parseLiveAvatarAvatarUuid(uuid);
    if (!parsed) {
      return NextResponse.json(
        { success: false, message: 'Invalid uuid', previewUrl: null },
        { status: 400 },
      );
    }

    const target = parsed.toLowerCase();
    const maxPages = 8;
    const pageSize = 100;

    for (let page = 1; page <= maxPages; page++) {
      const result = await fetchLiveAvatarPublicAvatars(page, pageSize);
      if (!result.ok) {
        return NextResponse.json({
          success: false,
          message: result.message,
          previewUrl: null,
        });
      }
      const hit = result.results.find(
        (r) => r.id && r.id.toLowerCase() === target && r.preview_url?.trim(),
      );
      if (hit?.preview_url?.trim()) {
        return NextResponse.json({
          success: true,
          previewUrl: hit.preview_url.trim(),
          name: hit.name?.trim() || null,
        });
      }
      if (!result.next) break;
    }

    return NextResponse.json({
      success: true,
      previewUrl: null,
      name: null,
    });
  } catch (e) {
    console.error('[api/public/avatar-preview]', e);
    return NextResponse.json(
      { success: false, message: 'Failed to resolve preview', previewUrl: null },
      { status: 500 },
    );
  }
}
