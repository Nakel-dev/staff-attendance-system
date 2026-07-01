"use client";

import Link from "next/link";
import { Bell, Building2, LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getInitials, timeAgo } from "@/lib/utils/formatDate";
import { markAllNotificationsRead, markNotificationRead, logout } from "@/lib/actions/notifications";
import type { Notification, Profile } from "@/lib/types";
import { getHomePath } from "@/constants";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  profile: Profile;
  notifications: Notification[];
  profilePath?: string;
}

export function Header({ title, profile, notifications, profilePath }: HeaderProps) {
  const router = useRouter();
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const homeHref = getHomePath(profile.role);

  const handleLogout = () => {
    void logout();
  };

  const handleMarkRead = async (id: string) => {
    const result = await markNotificationRead(id);
    if (result.error) toast.error(result.error);
    else router.refresh();
  };

  const handleMarkAllRead = async () => {
    const result = await markAllNotificationsRead();
    if (result.error) toast.error(result.error);
    else {
      toast.success("All notifications marked as read");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 no-print">
      <div className="flex h-16 items-center justify-between px-4 md:px-6 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={homeHref}
            className="md:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            aria-label="Go to home"
          >
            <Building2 className="h-4 w-4" />
          </Link>
          <h1 className="text-lg md:text-xl font-semibold truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[11px] text-white flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                    Mark all read
                  </Button>
                )}
              </div>
              <ScrollArea className="h-80">
                {notifications.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">No notifications</p>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => !n.is_read && handleMarkRead(n.id)}
                      className={cn(
                        "w-full text-left p-4 border-b hover:bg-accent transition-colors",
                        !n.is_read && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {!n.is_read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                        <div className={cn(!n.is_read ? "" : "ml-4")}>
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile.avatar_url} />
                  <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium">{profile.full_name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{profile.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {profilePath && (
                <DropdownMenuItem asChild>
                  <Link href={profilePath} className="flex items-center cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    View Profile
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
