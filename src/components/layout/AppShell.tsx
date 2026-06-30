import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Header } from "@/components/layout/Header";
import type { Notification, Profile } from "@/lib/types";

interface AppShellProps {
  title: string;
  profile: Profile;
  organizationName: string;
  notifications: Notification[];
  pendingLeaves?: number;
  children: React.ReactNode;
}

export function AppShell({
  title,
  profile,
  organizationName,
  notifications,
  pendingLeaves = 0,
  children,
}: AppShellProps) {
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
        <main className="p-4 md:p-6 pb-24 md:pb-6 max-w-7xl mx-auto w-full">{children}</main>
      </div>
      <MobileNav role={profile.role} pendingLeaves={pendingLeaves} />
    </div>
  );
}
