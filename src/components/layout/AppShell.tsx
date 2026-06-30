"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Header } from "@/components/layout/Header";
import type { Notification, Profile } from "@/lib/types";

const PORTAL_PAGE_TITLES: Record<string, string> = {
  "/my-attendance": "My Attendance",
  "/my-leaves": "My Leaves",
  "/profile": "My Profile",
};

interface AppShellProps {
  profile: Profile;
  organizationName: string;
  notifications: Notification[];
  pendingLeaves?: number;
  pageTitles?: Record<string, string>;
  defaultTitle?: string;
  children: React.ReactNode;
}

export function AppShell({
  profile,
  organizationName,
  notifications,
  pendingLeaves = 0,
  pageTitles = PORTAL_PAGE_TITLES,
  defaultTitle = "AttendPro",
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const title =
    pageTitles[pathname] ??
    Object.entries(pageTitles).find(([path]) => pathname.startsWith(`${path}/`))?.[1] ??
    defaultTitle;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        role={profile.role}
        organizationName={organizationName}
        pendingLeaves={pendingLeaves}
      />
      <div className="md:pl-64 min-w-0">
        <Header
          title={title}
          profile={profile}
          notifications={notifications}
          profilePath="/profile"
        />
        <main key={pathname} className="p-4 md:p-6 pb-24 md:pb-6 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
      <MobileNav role={profile.role} pendingLeaves={pendingLeaves} />
    </div>
  );
}
