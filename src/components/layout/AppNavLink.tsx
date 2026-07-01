"use client";

import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppNavLinkProps {
  href: string;
  label: string;
  icon: LucideIcon;
  className?: string;
  iconClassName?: string;
  badge?: React.ReactNode;
}

/** Plain anchor — full page load, works even if client routing is stale or cached. */
export function AppNavLink({
  href,
  label,
  icon: Icon,
  className,
  iconClassName,
  badge,
}: AppNavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <a
      href={href}
      className={cn(className, isActive && "active-nav")}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className={iconClassName} />
      <span className="flex-1">{label}</span>
      {badge}
    </a>
  );
}
