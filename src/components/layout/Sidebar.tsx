"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  CalendarDays,
  BarChart3,
  LogOut,
  User,
  Building2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { APP_NAME, AUTH_PATH, getHomePath } from "@/constants";
import { logout } from "@/lib/actions/notifications";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";

interface SidebarProps {
  role: "admin" | "staff";
  organizationName: string;
  pendingLeaves?: number;
}

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: boolean;
}

const adminLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/staff", label: "Staff Management", icon: Users },
  { href: "/attendance", label: "Mark Attendance", icon: ClipboardCheck },
  { href: "/leaves", label: "Leave Requests", icon: CalendarDays, badge: true },
  { href: "/my-leaves", label: "My Leaves", icon: CalendarDays },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/profile", label: "Profile", icon: User },
];

const staffLinks: NavLink[] = [
  { href: "/my-attendance", label: "My Attendance", icon: ClipboardCheck },
  { href: "/my-leaves", label: "My Leaves", icon: CalendarDays },
  { href: "/profile", label: "Profile", icon: User },
];

export function Sidebar({ role, organizationName, pendingLeaves = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const links = role === "admin" ? adminLinks : staffLinks;
  const homeHref = getHomePath(role);

  const handleLogout = async () => {
    await logout();
    router.push(AUTH_PATH);
    router.refresh();
  };

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30 border-r bg-card no-print">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="p-6">
          <Link
            href={homeHref}
            className="flex items-center gap-3 rounded-lg transition-opacity hover:opacity-80"
            aria-label="Go to home"
          >
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">{organizationName}</p>
              <p className="text-xs text-muted-foreground">{APP_NAME}</p>
            </div>
          </Link>
        </div>
        <Separator />
        <nav className="flex-1 p-4 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const showBadge = !!link.badge && pendingLeaves > 0;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{link.label}</span>
                {showBadge && (
                  <span className="bg-destructive text-destructive-foreground text-xs rounded-full px-2 py-0.5">
                    {pendingLeaves}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <Separator />
        <div className="p-4">
          <Button variant="ghost" className="w-full justify-start gap-3 px-3" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </aside>
  );
}
