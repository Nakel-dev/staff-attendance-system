"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, LogIn, LogOut, Search, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Profile } from "@/lib/types";

type Step = "identify" | "verify" | "done";
type ListMode = "check_in" | "check_out";

type KioskStaffRow = Pick<Profile, "id" | "full_name" | "department" | "employee_code"> & {
  nextAttempt: ListMode;
  lastType?: string | null;
};

interface KioskFaceClockAppProps {
  staff: KioskStaffRow[];
  deviceName: string;
  onStaffRefresh?: () => void | Promise<void>;
}

/** Reception kiosk: staff ID → Didit verification every clock in/out. */
export function KioskFaceClockApp({ staff, deviceName, onStaffRefresh }: KioskFaceClockAppProps) {
  const [query, setQuery] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [listMode, setListMode] = useState<ListMode>("check_in");
  const [selected, setSelected] = useState<KioskStaffRow | null>(null);
  const [step, setStep] = useState<Step>("identify");
  const [processing, setProcessing] = useState(false);
  const [online, setOnline] = useState(true);
  const [resultMessage, setResultMessage] = useState("");
  const [diditEnabled, setDiditEnabled] = useState(false);
  const [diditUrl, setDiditUrl] = useState<string | null>(null);
  const [diditSessionId, setDiditSessionId] = useState<string | null>(null);

  const attemptType = listMode;

  useEffect(() => {
    void fetch("/api/kiosk/face-clock/config")
      .then((r) => r.json())
      .then((d: { didit?: boolean }) => setDiditEnabled(!!d.didit))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => window.removeEventListener("offline", sync);
  }, []);

  const eligibleStaff = useMemo(
    () => staff.filter((s) => s.nextAttempt === listMode),
    [staff, listMode]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligibleStaff;
    return eligibleStaff.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.employee_code || "").toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
    );
  }, [query, eligibleStaff]);

  const pickStaff = (member: KioskStaffRow) => {
    if (member.nextAttempt !== listMode) {
      toast.error(
        member.nextAttempt === "check_out"
          ? `${member.full_name} already checked in — use Check out list.`
          : `${member.full_name} is not checked in — use Check in list.`
      );
      return;
    }
    setSelected(member);
    setEmployeeCode(member.employee_code || "");
    setStep("verify");
  };

  const pickByCode = () => {
    const code = employeeCode.trim().toUpperCase();
    if (!code) {
      toast.error("Enter your staff ID");
      return;
    }
    const member = staff.find((s) => (s.employee_code || "").toUpperCase() === code);
    if (!member) {
      toast.error("Staff ID not found");
      return;
    }
    if (member.nextAttempt !== listMode) {
      toast.error(
        listMode === "check_in"
          ? "This staff member already checked in. Switch to Check out."
          : "This staff member is not checked in. Switch to Check in."
      );
      return;
    }
    pickStaff(member);
  };

  const startDidit = useCallback(async () => {
    if (!selected || !diditEnabled) {
      toast.error("Didit is not configured on this server.");
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch("/api/kiosk/didit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: selected.id, attemptType }),
      });
      const data = (await res.json()) as { error?: string; sessionUrl?: string; sessionId?: string };
      if (!res.ok || !data.sessionUrl || !data.sessionId) {
        throw new Error(data.error || "Could not start Didit");
      }
      setDiditUrl(data.sessionUrl);
      setDiditSessionId(data.sessionId);
      window.open(data.sessionUrl, "didit_kiosk", "width=480,height=720");
      toast.message("Complete Didit verification in the popup window");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Didit failed");
    } finally {
      setProcessing(false);
    }
  }, [attemptType, diditEnabled, selected]);

  useEffect(() => {
    if (step !== "verify" || !diditSessionId || !selected) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/kiosk/didit/status?sessionId=${diditSessionId}`);
        const data = (await res.json()) as {
          terminal?: boolean;
          status?: string;
          clockApproved?: boolean;
        };
        if (!res.ok || !data.terminal) return;

        if (data.clockApproved) {
          clearInterval(interval);
          const complete = await fetch("/api/kiosk/face-clock/didit-complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              staffId: selected.id,
              attemptType,
              diditSessionId,
            }),
          });
          const result = (await complete.json()) as { success?: boolean; message?: string };
          if (result.success) {
            setResultMessage(result.message || "Clock recorded via Didit.");
            setStep("done");
            toast.success(result.message);
            void onStaffRefresh?.();
          } else {
            toast.error(result.message || "Clock failed");
            setStep("identify");
          }
        } else {
          clearInterval(interval);
          toast.error(`Didit ${data.status || "declined"}`);
          setStep("identify");
        }
      } catch {
        // keep polling
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [attemptType, diditSessionId, onStaffRefresh, selected, step]);

  const reset = () => {
    setSelected(null);
    setEmployeeCode("");
    setQuery("");
    setStep("identify");
    setResultMessage("");
    setDiditUrl(null);
    setDiditSessionId(null);
  };

  const listLabel = listMode === "check_in" ? "Check in" : "Check out";

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reception Kiosk</h1>
          <p className="text-muted-foreground text-sm">{deviceName}</p>
          <p className="text-muted-foreground text-xs">
            {listLabel} list → Didit verification · {eligibleStaff.length} staff eligible
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {online ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className="h-4 w-4 text-destructive" />}
          {online ? "Online" : "Offline"}
        </div>
      </div>

      {step === "identify" && (
        <Card>
          <CardHeader>
            <CardTitle>{listLabel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center gap-2">
              <Button
                size="sm"
                variant={listMode === "check_in" ? "default" : "outline"}
                onClick={() => {
                  setListMode("check_in");
                  setQuery("");
                  setEmployeeCode("");
                }}
              >
                <LogIn className="mr-1 h-4 w-4" />
                Check in ({staff.filter((s) => s.nextAttempt === "check_in").length})
              </Button>
              <Button
                size="sm"
                variant={listMode === "check_out" ? "default" : "outline"}
                onClick={() => {
                  setListMode("check_out");
                  setQuery("");
                  setEmployeeCode("");
                }}
              >
                <LogOut className="mr-1 h-4 w-4" />
                Check out ({staff.filter((s) => s.nextAttempt === "check_out").length})
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. EMP-0042"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && pickByCode()}
              />
              <Button onClick={pickByCode}>Continue</Button>
            </div>
            <p className="text-muted-foreground text-center text-xs">
              Only staff who need to {listMode === "check_in" ? "check in" : "check out"} are shown
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name or department"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No one needs to {listMode === "check_in" ? "check in" : "check out"} right now.
                </p>
              ) : (
                filtered.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => pickStaff(member)}
                    className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent"
                  >
                    <span>{member.full_name}</span>
                    <span className="text-muted-foreground text-sm">{member.employee_code || "—"}</span>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === "verify" && selected && (
        <Card>
          <CardHeader>
            <CardTitle>{selected.full_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-center text-sm">
              Verify with Didit to {attemptType === "check_in" ? "check in" : "check out"}.
            </p>
            <Button
              className="w-full"
              size="lg"
              onClick={() => void startDidit()}
              disabled={processing || !diditEnabled}
            >
              {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Start Didit verification
            </Button>
            {diditSessionId && (
              <div className="space-y-2 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm">Waiting for Didit…</p>
                {diditUrl && (
                  <Button variant="outline" size="sm" onClick={() => window.open(diditUrl, "didit_kiosk")}>
                    Re-open Didit
                  </Button>
                )}
              </div>
            )}
            <Button variant="ghost" className="w-full" onClick={reset}>
              Back
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <p className="text-lg font-semibold">{resultMessage}</p>
            <Button onClick={reset}>Next staff member</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
