"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Bot,
  ChevronDown,
  Database,
  KeyRound,
  Images,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MonitorPlay,
  MessageSquare,
  Phone,
  PhoneOutgoing,
  Plug,
  Sparkles,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";

function Logomark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="2"
        y="6"
        width="14"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M16 10l6-3v10l-6-3v-4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function initials(username: string) {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return username.slice(0, 2).toUpperCase() || "?";
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string>("user");
  const [username, setUsername] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (data.success && data.user) {
          setUserRole(data.user.role);
          setUsername(data.user.username || data.user.email || "User");
        }
      } catch (error) {
        console.error("Failed to fetch user info:", error);
      }
    })();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const t = window.setTimeout(() => {
      document.getElementById("sidebar-close-button")?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const userNav = [
    { href: "/dashboard/meetings", label: "Meetings", Icon: Video },
    { href: "/dashboard/gallery", label: "Gallery", Icon: Images },
    {
      href: "/dashboard/integrations",
      label: "Integrations",
      Icon: Plug,
    },
    { href: "/dashboard/meta-leads", label: "Meta leads", Icon: Database },
  ] as const;
  /** Grouped by workflow: configure the agent, run calls, then automate. */
  const voiceAgentGroups = [
    {
      label: "Build & knowledge",
      items: [
        { href: "/dashboard/agents", label: "Agents", Icon: Bot },
        {
          href: "/dashboard/knowledge-bases",
          label: "Knowledge bases",
          Icon: BookOpen,
        },
      ],
    },
    {
      label: "Calling",
      items: [
        {
          href: "/dashboard/phone-numbers",
          label: "Phone numbers",
          Icon: Phone,
        },
        {
          href: "/dashboard/batch-calling",
          label: "Batch calling",
          Icon: PhoneOutgoing,
        },
      ],
    },
    {
      label: "Automations",
      items: [
        {
          href: "/dashboard/automation",
          label: "Batch automations",
          description: "Flows after batch calls",
          Icon: Zap,
        },
        {
          href: "/dashboard/meet-automation",
          label: "Meet link defaults",
          description: "KB & avatar fallbacks",
          Icon: Sparkles,
        },
      ],
    },
  ] as const;

  const adminNav =
    userRole === "admin"
      ? ([
          {
            href: "/dashboard/admin",
            label: "Admin dashboard",
            Icon: LayoutDashboard,
          },
          {
            href: "/dashboard/admin/users",
            label: "User management",
            Icon: Users,
          },
          {
            href: "/dashboard/admin/meetings",
            label: "Meetings (admin)",
            Icon: MonitorPlay,
          },
          {
            href: "/dashboard/admin/conversations",
            label: "Conversations",
            Icon: MessageSquare,
          },
          {
            href: "/dashboard/admin/api-key",
            label: "API key",
            Icon: KeyRound,
          },
          {
            href: "/dashboard/admin/email",
            label: "Email (Gmail)",
            Icon: Mail,
          },
        ] as const)
      : [];

  const isActive = (href: string) => {
    if (href === "/dashboard/meetings") {
      return pathname === href || pathname.startsWith("/dashboard/meetings");
    }
    if (href === "/dashboard/knowledge-bases") {
      return (
        pathname === href || pathname.startsWith("/dashboard/knowledge-bases")
      );
    }
    if (href === "/dashboard/gallery") {
      return pathname === href || pathname.startsWith("/dashboard/gallery");
    }
    if (href === "/dashboard/integrations") {
      return (
        pathname === href || pathname.startsWith("/dashboard/integrations")
      );
    }
    if (href === "/dashboard/agents") {
      return pathname === href || pathname.startsWith("/dashboard/agents");
    }
    if (href === "/dashboard/phone-numbers") {
      return pathname === href || pathname.startsWith("/dashboard/phone-numbers");
    }
    if (href === "/dashboard/batch-calling") {
      return pathname === href;
    }
    if (href === "/dashboard/automation") {
      return pathname === href || pathname.startsWith("/dashboard/automation");
    }
    if (href === "/dashboard/meet-automation") {
      return pathname === href || pathname.startsWith("/dashboard/meet-automation");
    }
    if (href === "/dashboard/admin") {
      return pathname === "/dashboard/admin";
    }
    if (href === "/dashboard/admin/users") {
      return pathname.startsWith("/dashboard/admin/users");
    }
    if (href === "/dashboard/admin/meetings") {
      return pathname.startsWith("/dashboard/admin/meetings");
    }
    if (href === "/dashboard/admin/conversations") {
      return pathname.startsWith("/dashboard/admin/conversations");
    }
    if (href === "/dashboard/admin/api-key") {
      return pathname.startsWith("/dashboard/admin/api-key");
    }
    if (href === "/dashboard/admin/email") {
      return pathname.startsWith("/dashboard/admin/email");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const NavLink = ({
    href,
    label,
    description,
    Icon,
  }: {
    href: string;
    label: string;
    description?: string;
    Icon: typeof Video;
  }) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? "bg-brand-50 text-brand-600"
            : "text-secondary hover:bg-slate-50 hover:text-primary"
        }`}
      >
        <Icon
          className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${active ? "text-brand-600" : "text-secondary"}`}
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="min-w-0 leading-snug">
          {label}
          {description ? (
            <span
              className={`mt-0.5 block text-[11px] font-normal ${active ? "text-brand-600/80" : "text-tertiary"}`}
            >
              {description}
            </span>
          ) : null}
        </span>
      </Link>
    );
  };

  const aside = (
    <aside
      className={`fixed left-0 top-0 z-[42] flex h-full w-60 flex-col border-r border-slate-200 bg-primary transition-transform duration-200 ease-out lg:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 min-w-0"
          onClick={() => setMobileOpen(false)}
        >
          <Logomark className="shrink-0 text-brand-600" />
          <span className="truncate text-[15px] font-semibold text-primary">
            MeetAssistant
          </span>
        </Link>
        <button
          id="sidebar-close-button"
          type="button"
          className="rounded-lg p-2 text-secondary hover:bg-slate-50 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {userNav.map((item) => (
            <li key={item.href}>
              <NavLink {...item} />
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="px-3 pb-3 text-[11px] font-medium uppercase tracking-wide text-tertiary">
            Voice Agent
          </p>
          <div className="space-y-4">
            {voiceAgentGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-tertiary">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <NavLink
                        href={item.href}
                        label={item.label}
                        Icon={item.Icon}
                        description={"description" in item ? item.description : undefined}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {adminNav.length > 0 ? (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setAdminOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-tertiary transition-colors hover:bg-slate-50 hover:text-secondary"
              aria-expanded={adminOpen}
            >
              <span>Admin</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${adminOpen ? "rotate-0" : "-rotate-90"}`}
                strokeWidth={1.75}
                aria-hidden
              />
            </button>
            {adminOpen ? (
              <ul className="mt-1 space-y-1">
                {adminNav.map((item) => (
                  <li key={item.href}>
                    <NavLink {...item} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700"
            aria-hidden
          >
            {initials(username)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-primary">
              {username || "…"}
            </p>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium text-secondary transition-colors hover:text-primary"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-[41] flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-primary text-secondary shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
        aria-label="Open menu"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" strokeWidth={1.75} />
      </button>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[40] bg-black/50 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      {aside}
    </>
  );
}
