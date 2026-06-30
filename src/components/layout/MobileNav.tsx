"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  CalendarDays,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: boolean;
}

interface MobileNavProps {
  role: "admin" | "staff";
  pendingLeaves?: number;
}

const adminLinks: NavLink[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/staff", label: "Staff", icon: Users },
  { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/leaves", label: "Team", icon: CalendarDays, badge: true },
  { href: "/my-leaves", label: "My Leave", icon: CalendarDays },
  { href: "/profile", label: "Profile", icon: User },
];

const staffLinks: NavLink[] = [
  { href: "/my-attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/my-leaves", label: "Leaves", icon: CalendarDays },
  { href: "/profile", label: "Profile", icon: User },
];

export function MobileNav({ role, pendingLeaves = 0 }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const links = role === "admin" ? adminLinks : staffLinks;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 no-print pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around py-1.5 px-1 overflow-x-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const showBadge = !!link.badge && pendingLeaves > 0;
          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch
              onClick={(event) => {
                if (
                  event.defaultPrevented ||
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return;
                }
                if (pathname !== link.href) {
                  event.preventDefault();
                  router.push(link.href);
                }
              }}
              className={cn(
                "flex flex-col items-center gap-0.5 px-1.5 py-1 text-[10px] sm:text-xs relative min-w-[56px] shrink-0",
                isActive ? "text-primary font-medium" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{link.label}</span>
              {showBadge && (
                <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center">
                  {pendingLeaves > 9 ? "9+" : pendingLeaves}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
