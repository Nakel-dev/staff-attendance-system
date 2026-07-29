"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { KioskSetupForm } from "@/components/kiosk/KioskSetupForm";
import { KioskFaceClockApp } from "@/components/kiosk/KioskFaceClockApp";
import type { Profile } from "@/lib/types";

type KioskStaffRow = Pick<Profile, "id" | "full_name" | "department" | "employee_code"> & {
  nextAttempt: "check_in" | "check_out";
};

export function KioskPageClient() {
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [staff, setStaff] = useState<KioskStaffRow[]>([]);
  const [booting, setBooting] = useState(true);

  const loadStaff = () =>
    fetch("/api/kiosk/staff-list")
      .then((r) => r.json())
      .then((d: { staff?: KioskStaffRow[] }) => setStaff(d.staff || []));

  useEffect(() => {
    void (async () => {
      const sessionRes = await fetch("/api/kiosk/session");
      if (sessionRes.ok) {
        const sessionData = (await sessionRes.json()) as { deviceName?: string };
        setDeviceName(sessionData.deviceName || "Kiosk");
        await loadStaff();
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
            void loadStaff();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <KioskFaceClockApp staff={staff} deviceName={deviceName} onStaffRefresh={loadStaff} />
    </div>
  );
}
