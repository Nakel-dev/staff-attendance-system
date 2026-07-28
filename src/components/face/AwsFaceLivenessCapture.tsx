"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import { Loader2 } from "lucide-react";
import "@aws-amplify/ui-react-liveness/styles.css";

const FaceLivenessDetector = dynamic(
  () =>
    import("@aws-amplify/ui-react-liveness").then((module) => module.FaceLivenessDetector),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

export function AwsFaceLivenessCapture({
  sessionId,
  onComplete,
  onError,
}: {
  sessionId: string;
  onComplete: (sessionId: string) => void;
  onError: (message: string) => void;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const poolId = process.env.NEXT_PUBLIC_AWS_COGNITO_IDENTITY_POOL_ID;
    if (!poolId) {
      onError("AWS Face Liveness is not configured on this deployment.");
      return;
    }
    Amplify.configure({
      Auth: {
        Cognito: {
          identityPoolId: poolId,
          allowGuestAccess: true,
        },
      },
    });
    setReady(true);
  }, [onError]);

  if (!ready) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const region =
    process.env.NEXT_PUBLIC_AWS_REGION || process.env.NEXT_PUBLIC_AWS_DEFAULT_REGION || "us-east-1";

  return (
    <div className="overflow-hidden rounded-lg border">
      <FaceLivenessDetector
        sessionId={sessionId}
        region={region}
        onAnalysisComplete={async () => {
          onComplete(sessionId);
        }}
        onError={(livenessError) => {
          onError(livenessError.error.message || "AWS Face Liveness failed");
        }}
      />
    </div>
  );
}
