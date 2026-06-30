"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, ScanLine } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Label } from "@/components/ui/label";
import { parseCheckInQrPayload } from "@/lib/face/client";

interface QrCheckInScannerProps {
  onScan: (token: string) => void;
  disabled?: boolean;
}

export function QrCheckInScanner({ onScan, disabled }: QrCheckInScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "attendpro-qr-scanner";

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => undefined)
          .finally(() => {
            try {
              scannerRef.current?.clear();
            } catch {
              // scanner already cleared
            }
            scannerRef.current = null;
          });
      }
    };
  }, []);

  const startScanner = async () => {
    if (disabled || scanning) return;
    setError(null);
    setScanning(true);
    try {
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          const token = parseCheckInQrPayload(decoded);
          if (!token) {
            setError("Invalid QR code");
            return;
          }
          setLastCode(token);
          onScan(token);
          scanner
            .stop()
            .catch(() => undefined)
            .finally(() => {
              try {
                scanner.clear();
              } catch {
                // scanner already cleared
              }
              scannerRef.current = null;
              setScanning(false);
            });
        },
        () => undefined
      );
    } catch (err) {
      setScanning(false);
      setError(err instanceof Error ? err.message : "Could not start camera scanner");
    }
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <ScanLine className="h-4 w-4" />
        Scan reception QR code
      </Label>
      <div
        id={containerId}
        className="overflow-hidden rounded-lg border bg-muted/20 min-h-[16rem]"
      />
      {!scanning && (
        <button
          type="button"
          onClick={startScanner}
          disabled={disabled}
          className="inline-flex items-center text-sm text-primary hover:underline disabled:opacity-50"
        >
          <Camera className="mr-2 h-4 w-4" />
          Open camera to scan QR
        </button>
      )}
      {scanning && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Point your camera at the reception screen…
        </p>
      )}
      {lastCode && (
        <p className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          Desk code captured: {lastCode}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
