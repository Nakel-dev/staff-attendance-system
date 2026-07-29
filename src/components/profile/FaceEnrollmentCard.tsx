"use client";



import { useCallback, useEffect, useState } from "react";

import { format } from "date-fns";

import { CheckCircle2, ExternalLink, Loader2, ScanFace, Trash2 } from "lucide-react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { clearFaceEnrollment, getFaceEnrollmentStatus } from "@/lib/actions/face";



type VerifyPhase = "idle" | "waiting" | "done";



export function FaceEnrollmentCard({ promptEnrollment = false }: { promptEnrollment?: boolean }) {

  const [diditReady, setDiditReady] = useState(true);

  const [setupHint, setSetupHint] = useState<string | null>(null);

  const [enrolled, setEnrolled] = useState(false);

  const [enrolledAt, setEnrolledAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const [processing, setProcessing] = useState(false);

  const [phase, setPhase] = useState<VerifyPhase>("idle");

  const [sessionId, setSessionId] = useState<string | null>(null);

  const [statusText, setStatusText] = useState("");

  const [loadError, setLoadError] = useState<string | null>(null);



  const refreshStatus = useCallback(async () => {

    const [status, configRes] = await Promise.all([

      getFaceEnrollmentStatus(),

      fetch("/api/staff/biometric/config").then((r) => r.json().catch(() => ({}))),

    ]);



    setDiditReady(configRes.ready !== false);

    setSetupHint(typeof configRes.setupHint === "string" ? configRes.setupHint : null);



    if ("error" in status) {

      setLoadError(status.error || "Failed to load verification status");

      return;

    }



    setLoadError(null);

    setEnrolled(status.enrolled);

    setEnrolledAt(status.enrolledAt);

  }, []);



  useEffect(() => {

    void (async () => {

      await refreshStatus();

      setLoading(false);

    })();

  }, [refreshStatus]);



  useEffect(() => {

    if (promptEnrollment && !loading && !enrolled && diditReady) {

      document.getElementById("face-enrollment")?.scrollIntoView({ behavior: "smooth", block: "start" });

    }

  }, [promptEnrollment, loading, enrolled, diditReady]);



  const pollDidit = useCallback(async (id: string) => {

    setPhase("waiting");

    setStatusText("Waiting for Didit KYC verification…");



    for (let i = 0; i < 60; i++) {

      await new Promise((r) => setTimeout(r, 2000));

      try {

        const res = await fetch(`/api/staff/didit/status?sessionId=${id}`);

        const data = (await res.json()) as {

          error?: string;

          status?: string;

          terminal?: boolean;

          approved?: boolean;

          enrolled?: boolean;

          enrolledAt?: string | null;

        };

        if (!res.ok) {

          setStatusText(data.error || "Could not check verification status");

          continue;

        }

        setStatusText(`Didit KYC status: ${data.status || "…"}`);

        if (data.terminal) {

          if (data.approved && data.enrolled) {

            setEnrolled(true);

            setEnrolledAt(data.enrolledAt || new Date().toISOString());

            setPhase("done");

            setSessionId(null);

            toast.success("Identity verified with Didit KYC");

            if (promptEnrollment) window.location.href = "/my-attendance";

            return;

          }

          setPhase("idle");

          setSessionId(null);

          toast.error(

            data.status === "Declined"

              ? "Didit declined verification. Check your ID and try again."

              : `Verification ended: ${data.status}`

          );

          return;

        }

      } catch {

        setStatusText("Network error while checking Didit status");

      }

    }

    setPhase("idle");

    toast.error("Verification timed out. Complete the Didit window, then try again.");

  }, [promptEnrollment]);



  const startDiditKyc = async () => {

    setProcessing(true);

    setStatusText("");

    try {

      const res = await fetch("/api/staff/didit/start", { method: "POST" });

      const data = (await res.json()) as { error?: string; sessionId?: string; sessionUrl?: string };

      if (!res.ok || !data.sessionId || !data.sessionUrl) {

        throw new Error(data.error || "Could not start Didit KYC");

      }

      setSessionId(data.sessionId);

      const popup = window.open(data.sessionUrl, "didit_kyc", "width=480,height=720");

      if (!popup) toast.message("Popup blocked — allow popups for Didit.");

      void pollDidit(data.sessionId);

    } catch (err) {

      toast.error(err instanceof Error ? err.message : "Could not start verification");

      setPhase("idle");

    } finally {

      setProcessing(false);

    }

  };



  const handleClear = async () => {

    setProcessing(true);

    const result = await clearFaceEnrollment();

    setProcessing(false);

    if ("error" in result) {

      toast.error(result.error);

      return;

    }

    setEnrolled(false);

    setEnrolledAt(null);

    setPhase("idle");

    setSessionId(null);

    toast.success("KYC verification cleared");

  };



  if (loading) {

    return (

      <Card>

        <CardContent className="flex justify-center py-8">

          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />

        </CardContent>

      </Card>

    );

  }



  return (

    <Card

      id="face-enrollment"

      className={

        promptEnrollment && !enrolled ? "border-primary ring-1 ring-primary/30" : undefined

      }

    >

      <CardHeader>

        <CardTitle className="flex items-center gap-2">

          <ScanFace className="h-5 w-5" />

          Didit KYC verification

        </CardTitle>

        <CardDescription>

          Required once: complete Didit KYC (ID document + liveness) in the portal. The kiosk runs
          Didit verification again on every check-in and check-out.

        </CardDescription>

      </CardHeader>

      <CardContent className="space-y-4">

        {loadError && (

          <Alert variant="destructive">

            <AlertTitle>Could not load status</AlertTitle>

            <AlertDescription>{loadError}</AlertDescription>

          </Alert>

        )}



        {setupHint && (

          <Alert variant="destructive">

            <AlertTitle>Didit not available</AlertTitle>

            <AlertDescription>{setupHint}</AlertDescription>

          </Alert>

        )}



        {enrolled ? (

          <Alert>

            <CheckCircle2 className="h-4 w-4" />

            <AlertTitle>KYC verified</AlertTitle>

            <AlertDescription>

              {enrolledAt

                ? `Verified on ${format(new Date(enrolledAt), "MMM d, yyyy 'at' h:mm a")}. Use the kiosk to clock in/out.`

                : "Your identity is verified. Use the kiosk to clock in/out."}

            </AlertDescription>

          </Alert>

        ) : (

          <Alert>

            <AlertTitle>KYC required</AlertTitle>

            <AlertDescription>

              Complete Didit KYC here before using the kiosk. You will scan your ID and take a live selfie.

            </AlertDescription>

          </Alert>

        )}



        {statusText && (

          <p className="text-sm text-muted-foreground flex items-center gap-2">

            {phase === "waiting" && <Loader2 className="h-4 w-4 animate-spin" />}

            {statusText}

          </p>

        )}



        <div className="flex flex-wrap gap-2">

          {!enrolled && (

            <Button

              onClick={() => void startDiditKyc()}

              disabled={processing || phase === "waiting" || !diditReady}

            >

              {processing || phase === "waiting" ? (

                <Loader2 className="mr-2 h-4 w-4 animate-spin" />

              ) : (

                <ExternalLink className="mr-2 h-4 w-4" />

              )}

              Start Didit KYC

            </Button>

          )}

          {enrolled && (

            <>

              <Button

                variant="outline"

                size="sm"

                onClick={() => void startDiditKyc()}

                disabled={processing || phase === "waiting"}

              >

                Re-verify with Didit

              </Button>

              <Button

                variant="outline"

                size="sm"

                onClick={() => void handleClear()}

                disabled={processing || phase === "waiting"}

              >

                <Trash2 className="mr-2 h-4 w-4" />

                Clear verification

              </Button>

            </>

          )}

          {sessionId && phase === "waiting" && (

            <Button variant="ghost" size="sm" onClick={() => void pollDidit(sessionId)}>

              Check status again

            </Button>

          )}

        </div>

      </CardContent>

    </Card>

  );

}

