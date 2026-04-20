"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  ExternalLink,
  Shield,
  Zap,
  RefreshCw,
  Mail,
  Table2,
  FolderOpen,
  Calendar,
  LogOut,
} from "lucide-react";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GmailMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 10.267l8.073-6.774C21.69 2.28 24 3.438 24 5.457z"
      />
    </svg>
  );
}

function IntegrationsPageInner() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [googleWorkspace, setGoogleWorkspace] = useState<any>(null);
  const [gmail, setGmail] = useState<any>(null);
  const [disconnecting, setDisconnecting] = useState("");
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [banner, setBanner] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [workspaceRes, gmailRes] = await Promise.all([
        fetch("/api/v1/integrations/google-workspace/status"),
        fetch("/api/v1/integrations/gmail/status"),
      ]);
      const workspaceData = await workspaceRes.json();
      const gmailData = await gmailRes.json();
      setGoogleWorkspace(workspaceData);
      setGmail(gmailData);
      setLastChecked(new Date().toLocaleString());
    } catch {
      setBanner({ kind: "err", text: "Could not load integration status." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const success = searchParams.get("success");
    if (success === "google_workspace") {
      setBanner({ kind: "ok", text: "Google Workspace connected successfully." });
      void load();
    } else if (success === "gmail") {
      setBanner({ kind: "ok", text: "Gmail connected successfully." });
      void load();
    }
    const err = searchParams.get("error");
    if (err) {
      setBanner({ kind: "err", text: decodeURIComponent(err) });
    }
  }, [searchParams, load]);

  const connectGoogleWorkspace = async () => {
    try {
      const res = await fetch("/api/v1/integrations/google-workspace/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setBanner({
          kind: "err",
          text: data.message || "Could not start Google sign-in.",
        });
      }
    } catch {
      setBanner({ kind: "err", text: "Could not start Google sign-in." });
    }
  };

  const connectGmail = async () => {
    try {
      const res = await fetch("/api/v1/integrations/gmail/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setBanner({
          kind: "err",
          text: data.message || "Could not start Gmail sign-in.",
        });
      }
    } catch {
      setBanner({ kind: "err", text: "Could not start Gmail sign-in." });
    }
  };

  const disconnect = async (type: string) => {
    if (!confirm(`Disconnect ${type}?`)) return;
    setDisconnecting(type);
    try {
      const endpoint =
        type === "Google Workspace"
          ? "/api/v1/integrations/google-workspace/disconnect"
          : "/api/v1/integrations/gmail/disconnect";

      const res = await fetch(endpoint, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        if (type === "Google Workspace") {
          setGoogleWorkspace(null);
        } else {
          setGmail(null);
        }
        setBanner({ kind: "ok", text: `${type} disconnected.` });
      } else {
        setBanner({ kind: "err", text: "Could not disconnect." });
      }
    } catch {
      setBanner({ kind: "err", text: "Could not disconnect." });
    } finally {
      setDisconnecting("");
    }
  };

  return (
    <div className="-mx-8 -my-6 min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Integrations
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Connect external services to enhance your workflow.
          </p>
        </header>

        {banner ? (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              banner.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
            role="status"
          >
            {banner.text}
          </div>
        ) : null}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="h-10 w-10 animate-spin" aria-label="Loading" />
            <p className="mt-3 text-sm">Loading integrations…</p>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
              <div className="border-b border-slate-100 p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="relative">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                        <GoogleMark className="h-8 w-8" />
                      </div>
                      {googleWorkspace?.connected ? (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                          <CheckCircle2
                            className="h-3 w-3 text-white"
                            strokeWidth={2.5}
                          />
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-lg font-semibold text-slate-900">
                          Google Workspace
                        </h2>
                        {googleWorkspace?.connected ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                            Not connected
                          </span>
                        )}
                      </div>
                      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
                        Sheets, Drive, and Calendar — used by batch automations
                        and scheduling.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                          <Shield className="h-3 w-3" aria-hidden />
                          Secure
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                          <Zap className="h-3 w-3" aria-hidden />
                          {googleWorkspace?.connected ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {googleWorkspace?.connected ? (
                  <>
                    <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white">
                        {(googleWorkspace.email || "?")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {googleWorkspace.email || "Google account"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Workspace account
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                      {[
                        {
                          icon: Table2,
                          title: "Sheets",
                          desc: "Append rows from automations",
                          href: "https://sheets.google.com",
                          action: "Open Sheets",
                        },
                        {
                          icon: FolderOpen,
                          title: "Drive",
                          desc: "Store and share files",
                          href: "https://drive.google.com",
                          action: "Open Drive",
                        },
                        {
                          icon: Calendar,
                          title: "Calendar",
                          desc: "Events & Meet links",
                          href: "https://calendar.google.com",
                          action: "Open Calendar",
                        },
                      ].map((item) => (
                        <div
                          key={item.title}
                          className="rounded-xl border border-slate-200 bg-slate-50/80 p-4"
                        >
                          <item.icon
                            className="h-5 w-5 text-slate-500"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                          <p className="mt-2 text-sm font-medium text-slate-900">
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.desc}
                          </p>
                          <a
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
                          >
                            {item.action}
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-6 text-sm text-slate-600">
                    Connect once to enable Sheets, Drive, and Calendar for your
                    workspace.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:px-8">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    Refresh status
                  </button>
                  {googleWorkspace?.connected ? (
                    <button
                      type="button"
                      disabled={disconnecting === "Google Workspace"}
                      onClick={() => void disconnect("Google Workspace")}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      <LogOut className="h-4 w-4" aria-hidden />
                      {disconnecting === "Google Workspace"
                        ? "Disconnecting…"
                        : "Disconnect Google"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void connectGoogleWorkspace()}
                      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-500"
                    >
                      Connect Google Workspace
                    </button>
                  )}
                </div>
                {lastChecked ? (
                  <p className="text-xs text-slate-500">
                    Last checked: {lastChecked}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-red-200/80 bg-white shadow-sm ring-1 ring-red-100">
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="relative">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                        <GmailMark className="h-8 w-8" />
                      </div>
                      {gmail?.connected ? (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                          <CheckCircle2
                            className="h-3 w-3 text-white"
                            strokeWidth={2.5}
                          />
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-lg font-semibold text-slate-900">
                          Gmail
                        </h2>
                        {gmail?.connected ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                            Not setup
                          </span>
                        )}
                      </div>
                      <p className="mt-2 max-w-xl text-sm text-slate-600">
                        Connect your Gmail account to send and receive emails
                        from automations.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                          <Shield className="h-3 w-3" aria-hidden />
                          Secure
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                          <Mail className="h-3 w-3" aria-hidden />
                          {gmail?.connected ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {gmail?.connected ? (
                  <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2
                        className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                        strokeWidth={2}
                        aria-hidden
                      />
                      <div>
                        <p className="text-sm font-medium text-emerald-900">
                          Connected and active
                        </p>
                        <p className="mt-0.5 text-xs text-emerald-800/80">
                          {gmail.email || "Gmail account"}
                        </p>
                        {lastChecked ? (
                          <p className="mt-2 text-xs text-emerald-700">
                            Last checked: {lastChecked}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-6 text-sm text-slate-600">
                    Required for sending appointment emails and notifications.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:px-8">
                {gmail?.connected ? (
                  <>
                    <button
                      type="button"
                      disabled={disconnecting === "Gmail"}
                      onClick={() => void disconnect("Gmail")}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50 sm:flex-none"
                    >
                      <LogOut className="h-4 w-4" aria-hidden />
                      {disconnecting === "Gmail"
                        ? "Disconnecting…"
                        : "Disconnect"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void connectGmail()}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:flex-none"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />
                      Reconnect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void connectGmail()}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-500"
                  >
                    <Mail className="h-4 w-4" aria-hidden />
                    Connect Gmail
                  </button>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-slate-50">
          <Loader2
            className="h-10 w-10 animate-spin text-slate-400"
            aria-label="Loading"
          />
        </div>
      }
    >
      <IntegrationsPageInner />
    </Suspense>
  );
}
