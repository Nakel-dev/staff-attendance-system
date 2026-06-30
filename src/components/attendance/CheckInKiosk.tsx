"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { getCheckInKioskState, refreshCheckInKioskToken } from "@/lib/actions/organization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CheckInKiosk() {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadKiosk = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await getCheckInKioskState();
    setLoading(false);
    if ("error" in result) {
      setLoadError(result.error || "Failed to load desk code");
      setEnabled(false);
      setToken(null);
      return;
    }
    if (!("enabled" in result) || !result.enabled) {
      setEnabled(false);
      setToken(null);
      return;
    }
    setEnabled(true);
    setToken(result.token);
    setExpiresAt(result.expiresAt);
  }, []);

  useEffect(() => {
    loadKiosk();
  }, [loadKiosk]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
      if (remaining <= 0) loadKiosk();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, loadKiosk]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const result = await refreshCheckInKioskToken();
    setRefreshing(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setToken(result.token || null);
    setExpiresAt(result.expiresAt || null);
    toast.success("Desk code refreshed");
  };

  const qrPayload = token && expiresAt ? JSON.stringify({ t: token, exp: expiresAt }) : "";

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Reception check-in QR
          </CardTitle>
          <CardDescription>
            {loadError
              ? "Could not load desk code settings. Mark attendance below still works — check Settings if this persists."
              : "Enable Strict attendance mode in Settings to show a scannable QR code at reception."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Reception Check-In QR
        </CardTitle>
        <CardDescription>
          Display this screen at reception. Staff scan the QR with their own phone while logged into their own account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-4 rounded-xl border bg-background p-6 sm:flex-row sm:justify-center">
          {qrPayload && (
            <QRCodeSVG value={qrPayload} size={200} level="M" includeMargin className="rounded-md" />
          )}
          <div className="text-center sm:text-left">
            <p className="text-sm text-muted-foreground">Manual code fallback</p>
            <p className="text-4xl font-mono font-bold tracking-[0.35em]">{token}</p>
            <p className="mt-2 text-sm text-muted-foreground">Expires in {secondsLeft}s</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="w-full sm:w-auto">
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh now
        </Button>
      </CardContent>
    </Card>
  );
}
