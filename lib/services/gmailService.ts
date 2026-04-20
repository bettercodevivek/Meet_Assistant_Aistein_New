import User from '@/lib/db/models/User';
import { google } from 'googleapis';

export class GmailService {
  private getOAuth2Client(accessToken: string, refreshToken: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_GMAIL_REDIRECT_URI || 'http://localhost:3000/api/v1/integrations/gmail/callback'
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    return oauth2Client;
  }

  /**
   * Send email via Gmail API
   */
  async sendEmail(
    userId: string,
    organizationId: string,
    to: string,
    subject: string,
    body: string,
    isHtml: boolean = false
  ): Promise<void> {
    try {
      const user = await User.findById(userId);

      if (!user || !user.googleIntegration) {
        throw new Error('Gmail integration not found');
      }

      const oauth2Client = this.getOAuth2Client(
        user.googleIntegration.accessToken || '',
        user.googleIntegration.refreshToken
      );
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Create email message
      const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        isHtml ? 'Content-Type: text/html; charset=utf-8' : 'Content-Type: text/plain; charset=utf-8',
        '',
        body
      ].join('\r\n');

      const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      });
    } catch (error: any) {
      throw new Error(`Gmail error: ${error.message}`);
    }
  }
}

export const gmailService = new GmailService();
