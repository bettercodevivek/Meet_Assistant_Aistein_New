import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { requireAuth } from '@/lib/auth/middleware';
import { authUserObjectId } from '@/lib/auth/userObjectId';
import { signGoogleOAuthState } from '@/lib/auth/auth';
import { resolveGoogleWorkspaceRedirectUri } from '@/lib/google/v1IntegrationRedirectUris';

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = resolveGoogleWorkspaceRedirectUri(request);

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { success: false, message: 'Google OAuth credentials not configured' },
        { status: 500 }
      );
    }

    const userOid = authUserObjectId(user.userId);
    if (!userOid) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 401 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const scopes: string[] = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    const state = signGoogleOAuthState(user.userId);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state,
      prompt: 'consent'
    });

    return NextResponse.json({ success: true, authUrl });
  } catch (error) {
    console.error('Google Workspace connect error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
