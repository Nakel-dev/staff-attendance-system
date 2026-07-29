"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2, LogIn, LogOut, QrCode, Search, Wifi, WifiOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
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

type Step = "pick" | "pin" | "qr" | "photo" | "done";

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
  const providerMode = "didit";
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(60);
  const [qrStatus, setQrStatus] = useState("Waiting for phone…");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
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
    async (opts: { photoCaptureUrl?: string }) => {
      if (!selected || !pin) return;
      setProcessing(true);
      const response = await submitClock({
        staffId: selected.id,
        attemptType,
        pin,
        photoCaptureUrl: opts.photoCaptureUrl,
      });
      setResultMessage(response.message || response.error || "Attempt recorded");
      setStep("done");
      setProcessing(false);
      if (response.success) toast.success(response.message);
      else toast.error(response.message || "Could not clock");
    },
    [attemptType, pin, selected]
  );

  const pollQrStatus = useCallback(
    (token: string) => {
      stopPolling();
      setQrStatus("Waiting for phone…");
      countdownRef.current = setInterval(() => {
        setQrSecondsLeft((s) => Math.max(0, s - 1));
      }, 1000);
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/kiosk/phone-challenge/${token}`);
          const data = (await res.json()) as {
            status?: string;
            message?: string;
            error?: string;
          };
          if (!res.ok) {
            setQrStatus(data.error || "Could not check status");
            return;
          }
          setQrStatus(data.message || data.status || "…");
          if (data.status === "completed") {
            stopPolling();
            setResultMessage(data.message || "Phone verification complete");
            setStep("done");
            toast.success(data.message || "Clocked via phone");
            return;
          }
          if (data.status === "failed" || data.status === "expired") {
            stopPolling();
            setQrStatus(data.message || `QR ${data.status}`);
            toast.error(data.message || `QR ${data.status}`);
          }
        } catch {
          setQrStatus("Network error while waiting for phone");
        }
      }, 2000);
    },
    [stopPolling]
  );

  const startPhoneQr = useCallback(
    async (enteredPin: string) => {
      if (!selected) return;
      setProcessing(true);
      try {
        const res = await fetch("/api/kiosk/phone-challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffId: selected.id,
            attemptType,
            pin: enteredPin,
          }),
        });
        const data = (await res.json()) as {
          token?: string;
          qrUrl?: string;
          ttlSeconds?: number;
          error?: string;
        };
        setProcessing(false);
        if (!res.ok || !data.token || !data.qrUrl) {
          toast.error(data.error || "Could not create phone QR");
          setStep("pin");
          return;
        }
        setQrToken(data.token);
        setQrUrl(data.qrUrl);
        setQrSecondsLeft(data.ttlSeconds || 60);
        setStep("qr");
        pollQrStatus(data.token);
      } catch {
        setProcessing(false);
        toast.error("Could not create phone QR");
        setStep("pin");
      }
    },
    [attemptType, pollQrStatus, selected]
  );

  const handleSelectStaff = async (member: (typeof staff)[0]) => {
    setSelected(member);
    setPin("");
    setQrToken(null);
    setQrUrl(null);
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

    if (!navigator.onLine) {
      toast.message("Offline — use kiosk camera instead");
      setStep("photo");
      return;
    }

    await startPhoneQr(enteredPin);
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
    setQrToken(null);
    setQrUrl(null);
    setStep("pick");
    setResultMessage("");
    setQuery("");
    setQrStatus("Waiting for phone…");
    setQrSecondsLeft(60);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reception Kiosk</h1>
          <p className="text-muted-foreground text-sm">{deviceName}</p>
          <p className="text-muted-foreground text-xs">
            PIN → 60s QR → face on staff phone ({providerMode})
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

      {step === "qr" && selected && qrUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scan with your phone — {selected.full_name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {processing ? (
              <Loader2 className="mx-auto h-8 w-8 animate-spin" />
            ) : (
              <div className="mx-auto inline-block rounded-lg bg-white p-4 shadow-sm">
                <QRCodeSVG value={qrUrl} size={240} level="M" includeMargin />
              </div>
            )}
            <p className="font-medium">
              {qrSecondsLeft > 0 ? `${qrSecondsLeft}s left` : "Expired"}
            </p>
            <p className="text-sm">{qrStatus}</p>
            <p className="text-muted-foreground text-xs">
              Staff finishes face verification on their own phone. Keep this screen open.
            </p>
            <div className="flex flex-col gap-2">
              {pin && (
                <Button
                  variant="secondary"
                  onClick={() => void startPhoneQr(pin)}
                  disabled={processing}
                >
                  New QR code
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  stopPolling();
                  setStep("photo");
                }}
                disabled={processing}
              >
                Use kiosk camera instead
              </Button>
              <Button variant="outline" onClick={reset} disabled={processing}>
                Cancel
              </Button>
            </div>
            {qrToken ? (
              <p className="break-all text-muted-foreground text-[10px]">{qrUrl}</p>
            ) : null}
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
