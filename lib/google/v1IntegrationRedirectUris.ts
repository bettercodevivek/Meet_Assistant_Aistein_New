import { NextRequest } from 'next/server';

function trimExplicit(uri: string | undefined): string | undefined {
  const t = uri?.trim();
  if (!t) return undefined;
  return t.replace(/\/$/, '');
}

/**
 * OAuth redirect URIs must match Google Cloud Console exactly and stay identical
 * between the connect (authorize) and callback (token) handlers.
 * Prefer env when set; otherwise derive from this request's origin (correct in dev + prod).
 */
export function resolveGoogleWorkspaceRedirectUri(request: NextRequest): string {
  return (
    trimExplicit(process.env.GOOGLE_WORKSPACE_REDIRECT_URI) ??
    `${new URL(request.url).origin}/api/v1/integrations/google-workspace/callback`
  );
}

export function resolveGoogleGmailRedirectUri(request: NextRequest): string {
  return (
    trimExplicit(process.env.GOOGLE_GMAIL_REDIRECT_URI) ??
    `${new URL(request.url).origin}/api/v1/integrations/gmail/callback`
  );
}

export function resolveGoogleV1RedirectUri(request: NextRequest): string {
  return (
    trimExplicit(process.env.GOOGLE_REDIRECT_URI) ??
    `${new URL(request.url).origin}/api/v1/integrations/google/callback`
  );
}
