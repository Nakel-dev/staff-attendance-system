"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { MotionLivenessCapture } from "@/components/face/MotionLivenessCapture";
import { extractDescriptorFromJpegBlob, preloadRegistrationModels } from "@/lib/face/client";

export type LocalPhoneClockPayload = {
  blob: Blob;
  descriptor: number[];
  motionScore: number;
};

/** Local phone clock: fast motion clip, then one lightweight face read from the captured frame. */
export function LocalPhoneClockCapture({
  disabled,
  onSubmit,
}: {
  disabled?: boolean;
  onSubmit: (payload: LocalPhoneClockPayload) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    preloadRegistrationModels();
  }, []);

  const handleMotionVerified = async (result: { blob: Blob; motionScore: number }) => {
    setBusy(true);
    setError(null);
    setStatus("Reading face… (first time may take a minute on slow PCs)");
    try {
      const descriptor = await extractDescriptorFromJpegBlob(result.blob);
      await onSubmit({ blob: result.blob, descriptor, motionScore: result.motionScore });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Face read failed");
      setBusy(false);
      setStatus(null);
    }
  };

  return (
    <div className="space-y-3">
      {!busy ? (
        <>
          <p className="text-muted-foreground text-center text-sm">
            Record a short live clip, then we match your face to your enrollment.
          </p>
          <MotionLivenessCapture
            disabled={disabled}
            onVerified={(result) => void handleMotionVerified(result)}
          />
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 py-10">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-center text-sm">{status}</p>
        </div>
      )}
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
    </div>
  );
}
