"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ScanFace } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BIOMETRIC_PROVIDER_HINTS } from "@/lib/biometrics/providers";

export function BiometricProviderCard() {
  const [diditConfigured, setDiditConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/biometric-availability")
      .then((r) => r.json())
      .then((d: { didit?: boolean }) => {
        if (!cancelled) setDiditConfigured(!!d.didit);
      })
      .catch(() => {
        if (!cancelled) setDiditConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanFace className="h-4 w-4" />
          Face verification
        </CardTitle>
        <CardDescription className="text-xs">
          Staff complete Didit KYC once in the portal; every kiosk clock runs Didit again.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {diditConfigured === null ? (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Checking Didit connection…
          </div>
        ) : diditConfigured ? (
          <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Didit is configured. Method: <strong>Didit KYC</strong> (ID document + liveness).
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Didit is not configured. Add DIDIT_API_KEY and DIDIT_WORKFLOW_ID to Vercel / .env.local.
            </span>
          </div>
        )}
        <p className="text-muted-foreground text-[11px]">{BIOMETRIC_PROVIDER_HINTS.didit}</p>
      </CardContent>
    </Card>
  );
}
