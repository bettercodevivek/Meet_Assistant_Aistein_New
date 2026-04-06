import { google } from 'googleapis';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/db/models/User';
import { getAppSettings } from '@/lib/db/getAppSettings';
import { sendMeetingInviteViaKepler, keplerEmailApiBaseUrl } from '@/lib/email/keplerEmailClient';
import { createGoogleOAuth2Client } from '@/lib/google/createOAuth2Client';
import {
  buildMeetInviteEmailHtml,
  buildMeetInviteEmailPlainText,
} from '@/lib/google/meetInviteHtml';
import type { NextRequest } from 'next/server';

function encodeRawEmail(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): string {
  const subject = params.subject.replace(/\r?\n/g, ' ');
  const lines = [
    `To: ${params.to}`,
    `From: ${params.from}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    params.html,
  ];
  return Buffer.from(lines.join('\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export type SendInviteResult =
  | { ok: true }
  | { ok: false; code: 'not_connected' | 'send_failed'; message: string };

/**
 * Sends a Gmail message on behalf of the user. `request` is only used to build
 * the OAuth2 client’s redirect metadata when refreshing tokens (not sent to Google).
 */
export async function sendMeetingInviteEmail(
  request: NextRequest,
  userId: string,
  params: {
    to: string;
    meetingTitle: string;
    joinUrl: string;
    organizerName: string;
    /** Optional; e.g. "Spanish" for invite copy */
    assistantLanguageLabel?: string;
  },
): Promise<SendInviteResult> {
  await connectDB();

  const html = buildMeetInviteEmailHtml({
    meetingTitle: params.meetingTitle,
    joinUrl: params.joinUrl,
    organizerName: params.organizerName,
    assistantLanguageLabel: params.assistantLanguageLabel,
  });
  const plainText = buildMeetInviteEmailPlainText({
    meetingTitle: params.meetingTitle,
    joinUrl: params.joinUrl,
    organizerName: params.organizerName,
    assistantLanguageLabel: params.assistantLanguageLabel,
  });
  const subject = `Invitation: ${params.meetingTitle}`;

  const appSettings = await getAppSettings();
  const keplerFrom = appSettings.keplerGmailEmail?.trim();
  if (keplerFrom && keplerFrom.includes('@') && keplerEmailApiBaseUrl()) {
    const keplerResult = await sendMeetingInviteViaKepler({
      xUserEmail: keplerFrom,
      to: params.to,
      subject,
      bodyPlain: plainText,
    });
    if (keplerResult.ok) {
      return { ok: true };
    }
    return {
      ok: false,
      code: 'send_failed',
      message: keplerResult.message,
    };
  }

  const user = await User.findById(userId);
  if (!user?.googleIntegration?.refreshToken) {
    return {
      ok: false,
      code: 'not_connected',
      message:
        'Connect Gmail under Admin → Email (recommended) or Google Workspace under Integrations to send invites.',
    };
  }

  const fromEmail = user.googleIntegration.email;
  if (!fromEmail?.includes('@')) {
    return {
      ok: false,
      code: 'not_connected',
      message: 'Reconnect Google Workspace so we know which Gmail address to send from.',
    };
  }

  const oauth2Client = createGoogleOAuth2Client(request);
  oauth2Client.setCredentials({
    refresh_token: user.googleIntegration.refreshToken,
    access_token: user.googleIntegration.accessToken,
    expiry_date: user.googleIntegration.accessTokenExpiresAt
      ? user.googleIntegration.accessTokenExpiresAt.getTime()
      : undefined,
  });

  const uid = new mongoose.Types.ObjectId(userId);
  oauth2Client.on('tokens', async (tokens) => {
    const $set: Record<string, unknown> = {};
    if (tokens.access_token) {
      $set['googleIntegration.accessToken'] = tokens.access_token;
    }
    if (tokens.expiry_date) {
      $set['googleIntegration.accessTokenExpiresAt'] = new Date(
        tokens.expiry_date,
      );
    }
    if (tokens.refresh_token) {
      $set['googleIntegration.refreshToken'] = tokens.refresh_token;
    }
    if (Object.keys($set).length) {
      await User.updateOne({ _id: uid }, { $set });
    }
  });

  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodeRawEmail({
          from: fromEmail,
          to: params.to,
          subject,
          html,
        }),
      },
    });
    return { ok: true };
  } catch (e) {
    console.error('Gmail send error:', e);
    return {
      ok: false,
      code: 'send_failed',
      message: 'Could not send the invite email. Try again or check Gmail permissions.',
    };
  }
}
