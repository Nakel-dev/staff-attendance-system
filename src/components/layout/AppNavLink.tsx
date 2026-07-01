"use client";

import Link from "next/link";
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
    <Link
      href={href}
      prefetch
      className={cn(className, isActive && "active-nav")}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className={iconClassName} />
      <span className="flex-1">{label}</span>
      {badge}
    </Link>
  );
}
