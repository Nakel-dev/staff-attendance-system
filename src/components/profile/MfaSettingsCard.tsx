"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MfaSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find((factor) => factor.status === "verified");
      setEnabled(!!verified);
      setFactorId(verified?.id || null);
      setLoading(false);
    })();
  }, []);

  const startEnrollment = async () => {
    setEnrolling(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      toast.success("Scan the QR code with your authenticator app");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start MFA enrollment");
    } finally {
      setEnrolling(false);
    }
  };

  const verifyEnrollment = async () => {
    if (!factorId || verifyCode.trim().length < 6) {
      toast.error("Enter the 6-digit code from your authenticator app");
      return;
    }
    setEnrolling(true);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verifyCode.trim(),
      });
      if (error) throw error;
      setEnabled(true);
      setQrCode(null);
      setVerifyCode("");
      toast.success("Two-factor authentication enabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid verification code");
    } finally {
      setEnrolling(false);
    }
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Two-Factor Authentication (TOTP)
        </CardTitle>
        <CardDescription>
          Add an authenticator app code as a second layer beyond your password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {enabled ? (
          <p className="text-sm text-green-600 dark:text-green-400">
            Two-factor authentication is active on your account.
          </p>
        ) : qrCode ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="Authenticator QR code" className="mx-auto h-44 w-44 rounded border" />
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Verification code</Label>
              <Input
                id="mfa-code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
              />
            </div>
            <Button onClick={verifyEnrollment} disabled={enrolling}>
              {enrolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify and enable 2FA
            </Button>
          </div>
        ) : (
          <Button onClick={startEnrollment} disabled={enrolling}>
            {enrolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enable authenticator 2FA
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
