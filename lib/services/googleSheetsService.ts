import User from '@/lib/db/models/User';
import { google } from 'googleapis';
import {
  parseGoogleSpreadsheetId,
  parseSheetNameFromRangeHint,
  pickMatchingSheetTitle,
  quoteGoogleSheetNameForA1,
} from '@/lib/utils/googleSheetsAutomation';

export class GoogleSheetsService {
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
   * Append row to Google Sheet.
   * Resolves the worksheet name against the file’s actual tab titles (fixes "Unable to parse range"
   * when the default is not named Sheet1) and uses a sheet-only A1 range for append, which the API accepts.
   */
  async appendRow(
    userId: string,
    organizationId: string,
    spreadsheetId: string,
    range: string,
    values: any[],
    preferredSheetTab?: string,
  ): Promise<void> {
    try {
      const user = await User.findById(userId);

      if (!user || !user.googleWorkspaceIntegration) {
        throw new Error('Google Workspace integration not found');
      }

      const oauth2Client = this.getOAuth2Client(
        user.googleWorkspaceIntegration.accessToken || '',
        user.googleWorkspaceIntegration.refreshToken
      );
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      const id = parseGoogleSpreadsheetId(spreadsheetId.trim());
      if (!id) {
        throw new Error('Invalid spreadsheet id');
      }

      const meta = await sheets.spreadsheets.get({
        spreadsheetId: id,
        fields: 'sheets.properties.title',
      });
      const titles =
        meta.data.sheets
          ?.map((s) => s.properties?.title)
          .filter((t): t is string => typeof t === 'string' && t.length > 0) ?? [];

      const fromConfig = preferredSheetTab?.trim();
      const fromRange = parseSheetNameFromRangeHint(range);
      const desired = fromConfig || fromRange || 'Sheet1';
      const matched = pickMatchingSheetTitle(desired, titles);
      if (matched !== desired) {
        console.warn(
          `[GoogleSheets] Tab "${desired}" not found; appending to first matching sheet "${matched}" (available: ${titles.join(', ')})`,
        );
      }

      const appendRange = quoteGoogleSheetNameForA1(matched);

      await sheets.spreadsheets.values.append({
        spreadsheetId: id,
        range: appendRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values],
        },
      });
    } catch (error: any) {
      throw new Error(`Google Sheets error: ${error.message}`);
    }
  }

  /**
   * List spreadsheets
   */
  async listSpreadsheets(
    userId: string,
    organizationId: string
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
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        fields: 'files(id, name, webViewLink, createdTime)',
        orderBy: 'createdTime desc'
      });

      return response.data.files || [];
    } catch (error: any) {
      throw new Error(`Google Sheets error: ${error.message}`);
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();
