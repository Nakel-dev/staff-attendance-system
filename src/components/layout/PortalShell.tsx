"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import type { Notification, Profile } from "@/lib/types";

const PAGE_TITLES: Record<string, string> = {
  "/my-attendance": "My Attendance",
  "/my-leaves": "My Leaves",
  "/profile": "My Profile",
};

interface PortalShellProps {
  profile: Profile;
  organizationName: string;
  notifications: Notification[];
  pendingLeaves?: number;
  children: React.ReactNode;
}

export function PortalShell({
  profile,
  organizationName,
  notifications,
  pendingLeaves = 0,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "AttendPro";

  return (
    <AppShell
      title={title}
      profile={profile}
      organizationName={organizationName}
      notifications={notifications}
      pendingLeaves={pendingLeaves}
    >
      {children}
    </AppShell>
  );
}
