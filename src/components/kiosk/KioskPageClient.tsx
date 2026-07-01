"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { KioskSetupForm } from "@/components/kiosk/KioskSetupForm";
import { KioskClockApp } from "@/components/kiosk/KioskClockApp";
import type { Profile } from "@/lib/types";

export function KioskPageClient() {
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [staff, setStaff] = useState<Pick<Profile, "id" | "full_name" | "department" | "employee_code">[]>(
    []
  );
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    void (async () => {
      const sessionRes = await fetch("/api/kiosk/session");
      if (sessionRes.ok) {
        const sessionData = (await sessionRes.json()) as { deviceName?: string };
        setDeviceName(sessionData.deviceName || "Kiosk");
        const staffRes = await fetch("/api/kiosk/staff-list");
        if (staffRes.ok) {
          const data = (await staffRes.json()) as { staff: typeof staff };
          setStaff(data.staff || []);
        }
      }
      setBooting(false);
    })();
  }, []);

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!deviceName) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <KioskSetupForm
          onAuthenticated={(name) => {
            setDeviceName(name);
            void fetch("/api/kiosk/staff-list")
              .then((res) => res.json())
              .then((data: { staff?: typeof staff }) => setStaff(data.staff || []));
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <KioskClockApp staff={staff} deviceName={deviceName} />
    </div>
  );
}
