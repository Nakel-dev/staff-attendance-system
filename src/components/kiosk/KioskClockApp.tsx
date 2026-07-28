"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2, LogIn, LogOut, ScanFace, Search, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KioskPinEntry } from "@/components/kiosk/KioskPinEntry";
import { KioskPhotoCapture } from "@/components/kiosk/KioskPhotoCapture";
import { flushQueuedClocks, enqueueClock } from "@/lib/kiosk/offline-queue";
import type { Profile } from "@/lib/types";

interface KioskClockAppProps {
  staff: Pick<Profile, "id" | "full_name" | "department" | "employee_code">[];
  deviceName: string;
}

type Step = "pick" | "pin" | "face" | "photo" | "done";

async function submitClock(payload: {
  staffId: string;
  attemptType: "check_in" | "check_out";
  pin: string;
  photoCaptureUrl?: string;
  diditSessionId?: string;
}) {
  const res = await fetch("/api/kiosk/clock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function uploadPhoto(staffId: string, blob: Blob): Promise<string | undefined> {
  const form = new FormData();
  form.append("file", blob, "capture.jpg");
  form.append("staffId", staffId);
  const res = await fetch("/api/kiosk/upload-photo", { method: "POST", body: form });
  if (!res.ok) return undefined;
  const data = (await res.json()) as { path?: string };
  return data.path;
}

export function KioskClockApp({ staff, deviceName }: KioskClockAppProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<(typeof staff)[0] | null>(null);
  const [pin, setPin] = useState("");
  const [attemptType, setAttemptType] = useState<"check_in" | "check_out">("check_in");
  const [step, setStep] = useState<Step>("pick");
  const [online, setOnline] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [diditEnabled, setDiditEnabled] = useState(false);
  const [diditSessionId, setDiditSessionId] = useState<string | null>(null);
  const [faceStatus, setFaceStatus] = useState("Waiting for face verification…");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const popupRef = useRef<Window | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.employee_code || "").toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
    );
  }, [query, staff]);

  useEffect(() => {
    void fetch("/api/kiosk/didit/config")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setDiditEnabled(!!d.configured))
      .catch(() => setDiditEnabled(false));
  }, []);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    await flushQueuedClocks(async (item) => {
      const response = await submitClock({
        staffId: item.staffId,
        attemptType: item.attemptType,
        pin: item.pin,
        photoCaptureUrl: item.photoCaptureUrl,
      });
      return { success: !!response.success };
    });
  }, []);

  useEffect(() => {
    void flushQueue();
    const id = setInterval(() => void flushQueue(), 30_000);
    return () => clearInterval(id);
  }, [flushQueue]);

  const finishClock = useCallback(
    async (opts: { diditSessionId?: string; photoCaptureUrl?: string }) => {
      if (!selected || !pin) return;
      setProcessing(true);
      const payload = {
        staffId: selected.id,
        attemptType,
        pin,
        diditSessionId: opts.diditSessionId,
        photoCaptureUrl: opts.photoCaptureUrl,
      };
      const response = await submitClock(payload);
      setResultMessage(response.message || response.error || "Attempt recorded");
      setStep("done");
      setProcessing(false);
      if (response.success) toast.success(response.message);
      else if (response.status === "review") toast.message(response.message || "Sent for admin review");
      else toast.error(response.message || "Could not clock");
    },
    [attemptType, pin, selected]
  );

  const pollDidit = useCallback(
    (sessionId: string) => {
      stopPolling();
      setFaceStatus("Complete face scan in the Didit window…");
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/kiosk/didit/status?sessionId=${sessionId}`);
          const data = (await res.json()) as {
            terminal?: boolean;
            status?: string;
            error?: string;
          };
          if (!res.ok) {
            setFaceStatus(data.error || "Could not read verification status");
            return;
          }
          setFaceStatus(`Didit status: ${data.status || "…"}`);
          if (!data.terminal) return;
          stopPolling();
          await finishClock({ diditSessionId: sessionId });
        } catch {
          setFaceStatus("Network error while checking face verification");
        }
      }, 2500);
    },
    [finishClock, stopPolling]
  );

  const handleSelectStaff = async (member: (typeof staff)[0]) => {
    setSelected(member);
    setPin("");
    setDiditSessionId(null);
    const res = await fetch(`/api/kiosk/staff-status?staffId=${member.id}`);
    if (res.ok) {
      const data = (await res.json()) as { nextAttempt?: "check_in" | "check_out" };
      setAttemptType(data.nextAttempt || "check_in");
    } else {
      setAttemptType("check_in");
    }
    setStep("pin");
  };

  const handlePinSubmit = async (enteredPin: string) => {
    setPin(enteredPin);
    if (!selected) return;

    if (!diditEnabled) {
      setStep("photo");
      return;
    }

    if (!navigator.onLine) {
      toast.error("Face verification requires internet");
      return;
    }

    setProcessing(true);
    setStep("face");
    setFaceStatus("Starting Didit face verification…");
    try {
      const res = await fetch("/api/kiosk/didit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: selected.id,
          attemptType,
          pin: enteredPin,
        }),
      });
      const data = (await res.json()) as {
        sessionId?: string;
        sessionUrl?: string;
        error?: string;
      };
      setProcessing(false);
      if (!res.ok || !data.sessionId || !data.sessionUrl) {
        toast.error(data.error || "Could not start face verification");
        setStep("pin");
        return;
      }
      setDiditSessionId(data.sessionId);
      const popup = window.open(data.sessionUrl, "didit_face", "width=480,height=720");
      popupRef.current = popup;
      if (!popup) {
        // Popup blocked — navigate same tab
        window.location.href = data.sessionUrl;
        return;
      }
      pollDidit(data.sessionId);
    } catch {
      setProcessing(false);
      toast.error("Could not start face verification");
      setStep("pin");
    }
  };

  const handlePhotoCapture = async (blob: Blob) => {
    if (!selected || !pin) return;
    setProcessing(true);
    let photoCaptureUrl: string | undefined;
    if (navigator.onLine) {
      photoCaptureUrl = await uploadPhoto(selected.id, blob);
      if (!photoCaptureUrl) {
        toast.error("Could not upload photo");
        setProcessing(false);
        return;
      }
    }
    const payload = {
      staffId: selected.id,
      attemptType,
      pin,
      photoCaptureUrl,
    };
    if (!navigator.onLine) {
      await enqueueClock(payload);
      setResultMessage("Saved offline. Will submit when connection returns.");
      setStep("done");
      setProcessing(false);
      return;
    }
    await finishClock({ photoCaptureUrl });
  };

  const reset = () => {
    stopPolling();
    setSelected(null);
    setPin("");
    setDiditSessionId(null);
    setStep("pick");
    setResultMessage("");
    setQuery("");
    setFaceStatus("Waiting for face verification…");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reception Kiosk</h1>
          <p className="text-muted-foreground text-sm">{deviceName}</p>
          <p className="text-muted-foreground text-xs">
            {diditEnabled ? "Mode: PIN + Didit face verification" : "Mode: PIN + photo (Didit not configured)"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {online ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className="h-4 w-4 text-destructive" />}
          {online ? "Online" : "Offline queue active"}
        </div>
      </div>

      {step === "pick" && (
        <Card>
          <CardHeader>
            <CardTitle>Select staff member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, ID, or department"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {filtered.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => void handleSelectStaff(member)}
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent"
                >
                  <div>
                    <p className="font-medium">{member.full_name}</p>
                    <p className="text-muted-foreground text-sm">
                      {member.employee_code || "No ID"} · {member.department}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === "pin" && selected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {attemptType === "check_in" ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
              {attemptType === "check_in" ? "Check in" : "Check out"} — {selected.full_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <KioskPinEntry
              staffName={selected.full_name}
              onSubmit={(p) => void handlePinSubmit(p)}
              onCancel={reset}
              disabled={processing}
            />
          </CardContent>
        </Card>
      )}

      {step === "face" && selected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanFace className="h-5 w-5" />
              Face verification — {selected.full_name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {processing ? (
              <Loader2 className="mx-auto h-8 w-8 animate-spin" />
            ) : (
              <ScanFace className="mx-auto h-12 w-12 text-primary" />
            )}
            <p className="text-sm">{faceStatus}</p>
            <p className="text-muted-foreground text-xs">
              Look at the camera in the Didit window. Keep this page open until verification finishes.
            </p>
            {diditSessionId && (
              <Button
                variant="outline"
                onClick={() => pollDidit(diditSessionId)}
                disabled={processing}
              >
                Recheck status
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={reset} disabled={processing}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "photo" && selected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {attemptType === "check_in" ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
              Photo — {selected.full_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {processing ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <KioskPhotoCapture onCapture={(blob) => void handlePhotoCapture(blob)} />
            )}
            <Button variant="outline" className="mt-4 w-full" onClick={reset} disabled={processing}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <p className="text-lg font-medium">{resultMessage}</p>
            <p className="text-muted-foreground text-sm">{format(new Date(), "PPpp")}</p>
            <Button onClick={reset} className="w-full">
              Next staff member
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
