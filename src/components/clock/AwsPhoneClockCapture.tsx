"use client";

import { MotionLivenessCapture } from "@/components/face/MotionLivenessCapture";

export type AwsPhoneClockPayload = {
  photoBytes?: Blob;
  motionScore?: number;
};

/** AWS phone clock: motion liveness + server CompareFaces only. */
export function AwsPhoneClockCapture({
  disabled,
  onSubmit,
}: {
  disabled?: boolean;
  onSubmit: (payload: AwsPhoneClockPayload) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-center text-sm">
        Record a short live clip. Static photos are rejected, then AWS matches your face.
      </p>
      <MotionLivenessCapture
        disabled={disabled}
        onVerified={(result) =>
          void onSubmit({ photoBytes: result.blob, motionScore: result.motionScore })
        }
      />
    </div>
  );
}
