import User from '@/lib/db/models/User';
import { google } from 'googleapis';

export interface CalendarEvent {
  summary: string;
  description?: string;
  start: {
    dateTime: string; // ISO 8601 format
    timeZone?: string;
  };
  end: {
    dateTime: string; // ISO 8601 format
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  location?: string;
}

export class GoogleCalendarService {
  private getOAuth2Client(accessToken: string, refreshToken: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_WORKSPACE_REDIRECT_URI || 'http://localhost:3000/api/v1/integrations/google-workspace/callback'
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    return oauth2Client;
  }

  /**
   * Create calendar event
   */
  async createEvent(
    userId: string,
    organizationId: string,
    event: CalendarEvent,
    calendarId: string = 'primary'
  ): Promise<{ eventId: string; htmlLink: string; hangoutLink?: string }> {
    try {
      const user = await User.findById(userId);

      if (!user || !user.googleWorkspaceIntegration) {
        throw new Error('Google Workspace integration not found');
      }

      const oauth2Client = this.getOAuth2Client(
        user.googleWorkspaceIntegration.accessToken || '',
        user.googleWorkspaceIntegration.refreshToken
      );
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const requestBody = {
        ...event,
        conferenceData: {
          createRequest: {
            requestId: `aistein-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      };

      const response = await calendar.events.insert({
        calendarId,
        requestBody,
        conferenceDataVersion: 1,
      });

      return {
        eventId: response.data.id!,
        htmlLink: response.data.htmlLink!,
        hangoutLink: response.data.hangoutLink || undefined
      };
    } catch (error: any) {
      throw new Error(`Google Calendar error: ${error.message}`);
    }
  }

  /**
   * List calendar events
   */
  async listEvents(
    userId: string,
    organizationId: string,
    calendarId: string = 'primary',
    timeMin?: Date,
    timeMax?: Date,
    maxResults: number = 50
  ): Promise<any[]> {
    try {
      const user = await User.findById(userId);

      if (!user || !user.googleWorkspaceIntegration) {
        throw new Error('Google Workspace integration not found');
      }

      const oauth2Client = this.getOAuth2Client(
        user.googleWorkspaceIntegration.accessToken || '',
        user.googleWorkspaceIntegration.refreshToken
      );
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const response = await calendar.events.list({
        calendarId,
        timeMin: timeMin?.toISOString() || new Date().toISOString(),
        timeMax: timeMax?.toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      });

      return response.data.items || [];
    } catch (error: any) {
      throw new Error(`Google Calendar error: ${error.message}`);
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
