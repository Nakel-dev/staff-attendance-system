"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function WelcomeBanner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("welcome") === "1") {
      toast.success("Welcome to AttendPro! Your account is ready.");
    }
  }, [searchParams]);

  return null;
}
