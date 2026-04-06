function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Single-line safe text for plain-text email (no HTML). */
function oneLine(s: string): string {
  return s.replace(/\r?\n/g, ' ').trim();
}

/**
 * Plain-text invite for APIs (e.g. Kepler `/email/send`) that send `body` as text/plain.
 * HTML in `body` is shown as raw tags in Gmail — do not use HTML there.
 */
export function buildMeetInviteEmailPlainText(params: {
  meetingTitle: string;
  joinUrl: string;
  organizerName: string;
  assistantLanguageLabel?: string;
}): string {
  const title = oneLine(params.meetingTitle);
  const url = oneLine(params.joinUrl);
  const organizer = oneLine(params.organizerName);
  const lang = params.assistantLanguageLabel?.trim();
  const langBlock = lang
    ? `\nAssistant language for this session: ${oneLine(lang)}\n`
    : '\n';

  return `MeetAssistant — You're invited

${organizer} shared a meeting link with you.
${langBlock}
Meeting: ${title}

Join the meeting:
${url}

If the link does not work, copy and paste the URL into your browser.

—
Sent via MeetAssistant`;
}

export function buildMeetInviteEmailHtml(params: {
  meetingTitle: string;
  joinUrl: string;
  organizerName: string;
  /** e.g. "Spanish" — shown so guests know which language the assistant will use */
  assistantLanguageLabel?: string;
}): string {
  const title = escapeHtml(params.meetingTitle);
  const url = escapeHtml(params.joinUrl);
  const organizer = escapeHtml(params.organizerName);
  const langLabel = params.assistantLanguageLabel?.trim();
  const langLine = langLabel
    ? `<p style="margin:14px 0 0 0;font-size:14px;line-height:1.5;color:#475569;">Assistant language for this session: <strong style="color:#0f172a;">${escapeHtml(langLabel)}</strong></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.35);">
          <tr>
            <td style="padding:28px 28px 8px 28px;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">MeetAssistant</p>
              <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.25;color:#0f172a;">You’re invited</h1>
              <p style="margin:14px 0 0 0;font-size:15px;line-height:1.55;color:#475569;">${organizer} shared a meeting link with you.</p>
              ${langLine}
              <p style="margin:18px 0 0 0;padding:14px 16px;background:#f1f5f9;border-radius:12px;font-size:16px;font-weight:600;color:#0f172a;">${title}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px 28px;">
              <a href="${url}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:9999px;">Join meeting</a>
              <p style="margin:20px 0 0 0;font-size:13px;line-height:1.5;color:#64748b;">If the button doesn’t work, copy and paste this link into your browser:</p>
              <p style="margin:8px 0 0 0;font-size:12px;word-break:break-all;color:#2563eb;">${url}</p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;">Sent via MeetAssistant</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
