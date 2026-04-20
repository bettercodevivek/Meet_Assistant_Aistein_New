import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import { google } from 'googleapis';
import { verifyGoogleOAuthState } from '@/lib/auth/auth';
import { resolveGoogleGmailRedirectUri } from '@/lib/google/v1IntegrationRedirectUris';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${frontendUrl}/dashboard/integrations?error=${error}`);
    }

    if (!code || !state) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${frontendUrl}/dashboard/integrations?error=missing_code_or_state`);
    }

    const statePayload = verifyGoogleOAuthState(state);
    if (!statePayload) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${frontendUrl}/dashboard/integrations?error=invalid_state`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = resolveGoogleGmailRedirectUri(request);

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const tokenResponse = await oauth2Client.getToken(code);
    const tokens = tokenResponse.tokens;

    if (!tokens.refresh_token && !tokens.access_token) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${frontendUrl}/dashboard/integrations?error=no_tokens`);
    }

    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userinfo } = await oauth2.userinfo.get();
    const googleEmail = userinfo.email || undefined;

    await connectDB();

    const existingUser = await User.findById(statePayload.userId);
    const refreshToken = tokens.refresh_token || existingUser?.googleIntegration?.refreshToken;

    if (!refreshToken) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${frontendUrl}/dashboard/integrations?error=no_refresh_token`);
    }

    await User.findByIdAndUpdate(statePayload.userId, {
      $set: {
        googleIntegration: {
          refreshToken,
          accessToken: tokens.access_token ?? undefined,
          accessTokenExpiresAt: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : undefined,
          email: googleEmail,
        },
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      `${frontendUrl}/dashboard/integrations?success=gmail`
    );
  } catch (error) {
    console.error('Gmail callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${frontendUrl}/dashboard/integrations?error=callback_failed`);
  }
}
