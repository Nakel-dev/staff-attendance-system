"use client";

import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { navigateToLogout } from "@/lib/auth/logout";
import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  className?: string;
  variant?: "ghost" | "default" | "outline";
  showIcon?: boolean;
  label?: string;
}

export function LogoutButton({
  className,
  variant = "ghost",
  showIcon = true,
  label = "Logout",
}: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleLogout = () => {
    if (loading) return;
    setLoading(true);
    navigateToLogout();
  };

  return (
    <Button
      type="button"
      variant={variant}
      className={cn("inline-flex items-center gap-3", className)}
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        showIcon && <LogOut className="h-4 w-4 shrink-0" />
      )}
      <span>{label}</span>
    </Button>
  );
}
