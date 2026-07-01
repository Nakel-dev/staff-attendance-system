"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, LogIn, LogOut, Search, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FaceRegistrationCapture,
  type FaceRegistrationCaptureResult,
} from "@/components/face/FaceRegistrationCapture";
import { flushQueuedClocks, enqueueClock } from "@/lib/kiosk/offline-queue";
import type { Profile } from "@/lib/types";

interface KioskClockAppProps {
  staff: Pick<Profile, "id" | "full_name" | "department" | "employee_code">[];
  deviceName: string;
}

type Step = "pick" | "capture" | "done";

async function submitClock(payload: {
  staffId: string;
  attemptType: "check_in" | "check_out";
  frameDescriptors: number[][];
  liveDescriptor: number[];
  livenessClipUrl?: string;
}) {
  const res = await fetch("/api/kiosk/clock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export function KioskClockApp({ staff, deviceName }: KioskClockAppProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<(typeof staff)[0] | null>(null);
  const [attemptType, setAttemptType] = useState<"check_in" | "check_out">("check_in");
  const [step, setStep] = useState<Step>("pick");
  const [online, setOnline] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

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

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    await flushQueuedClocks(async (item) => {
      const response = await submitClock({
        staffId: item.staffId,
        attemptType: item.attemptType,
        frameDescriptors: item.frameDescriptors,
        liveDescriptor: item.liveDescriptor,
        livenessClipUrl: item.livenessClipUrl,
      });
      return { success: !!response.success };
    });
  }, []);

  useEffect(() => {
    void flushQueue();
    const id = setInterval(() => void flushQueue(), 30_000);
    return () => clearInterval(id);
  }, [flushQueue]);

  const handleSelectStaff = async (member: (typeof staff)[0]) => {
    setSelected(member);
    const res = await fetch(`/api/kiosk/staff-status?staffId=${member.id}`);
    if (res.ok) {
      const data = (await res.json()) as { nextAttempt?: "check_in" | "check_out" };
      setAttemptType(data.nextAttempt || "check_in");
    } else {
      setAttemptType("check_in");
    }
    setStep("capture");
  };

  const handleCaptureComplete = async (capture: FaceRegistrationCaptureResult) => {
    if (!selected) return;
    setProcessing(true);
    const front =
      capture.angles.find((a) => a.angle === "front")?.descriptor ||
      capture.angles[capture.angles.length - 1]?.descriptor;
    if (!front) {
      toast.error("Could not capture a valid face signature");
      setProcessing(false);
      return;
    }

    let livenessClipUrl: string | undefined;
    if (capture.referenceClipBlob) {
      const form = new FormData();
      form.append("file", capture.referenceClipBlob, "liveness.webm");
      const uploadRes = await fetch("/api/kiosk/upload-clip", { method: "POST", body: form });
      if (uploadRes.ok) {
        const uploadData = (await uploadRes.json()) as { path?: string };
        livenessClipUrl = uploadData.path;
      }
    }

    const payload = {
      staffId: selected.id,
      attemptType,
      frameDescriptors: capture.frameDescriptors,
      liveDescriptor: front,
      livenessClipUrl,
      frameMetadata: { motionScore: capture.motionScore, angles: capture.angles.map((a) => a.angle) },
    };

    if (!navigator.onLine) {
      await enqueueClock(payload);
      setResultMessage("Saved offline. Will submit when connection returns.");
      setStep("done");
      setProcessing(false);
      return;
    }

    const response = await submitClock(payload);
    setResultMessage(response.message || response.error || "Attempt recorded");
    setStep("done");
    setProcessing(false);
    if (response.success) toast.success(response.message);
    else toast.message(response.message || "Needs review");
  };

  const reset = () => {
    setSelected(null);
    setStep("pick");
    setResultMessage("");
    setQuery("");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reception Kiosk</h1>
          <p className="text-muted-foreground text-sm">{deviceName}</p>
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

      {step === "capture" && selected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {attemptType === "check_in" ? (
                <LogIn className="h-5 w-5" />
              ) : (
                <LogOut className="h-5 w-5" />
              )}
              {attemptType === "check_in" ? "Check in" : "Check out"} — {selected.full_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {processing ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <FaceRegistrationCapture onComplete={(r) => void handleCaptureComplete(r)} />
            )}
            <Button variant="outline" className="mt-4 w-full" onClick={reset}>
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
