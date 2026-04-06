/**
 * Kepler RAG service Gmail API — see https://keplerov1-python-2.onrender.com/docs
 * Env: KEPLER_EMAIL_API_BASE_URL (e.g. https://keplerov1-python-2.onrender.com)
 */

export function keplerEmailApiBaseUrl(): string | null {
  const raw = (process.env.KEPLER_EMAIL_API_BASE_URL || '').trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

export async function sendMeetingInviteViaKepler(params: {
  xUserEmail: string;
  to: string;
  subject: string;
  /** Plain text only — Kepler sends `body` as text/plain; HTML would show as raw markup in Gmail. */
  bodyPlain: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const base = keplerEmailApiBaseUrl();
  if (!base) {
    return {
      ok: false,
      message: 'Kepler email API is not configured (KEPLER_EMAIL_API_BASE_URL).',
    };
  }

  const from = params.xUserEmail.trim();
  if (!from.includes('@')) {
    return { ok: false, message: 'Invalid sender email.' };
  }

  try {
    const res = await fetch(`${base}/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': from,
      },
      body: JSON.stringify({
        to: params.to,
        subject: params.subject,
        body: params.bodyPlain,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        message:
          typeof data.message === 'string'
            ? data.message
            : `Email API returned ${res.status}`,
      };
    }

    if (data.success === false) {
      return {
        ok: false,
        message:
          typeof data.message === 'string' ? data.message : 'Send failed.',
      };
    }

    return { ok: true };
  } catch (e) {
    console.error('Kepler email send error:', e);
    return {
      ok: false,
      message: 'Could not reach the email service. Try again later.',
    };
  }
}
